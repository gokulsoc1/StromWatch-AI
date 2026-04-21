from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import datetime
import threading
import os
import numpy as np
import math

try:
    from sklearn.linear_model import LinearRegression
except ImportError:
    LinearRegression = None

app = Flask(__name__)
# Enable CORS so your mobile phone app can connect to this API securely
CORS(app) 

# Get the path to your Firebase key
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
key_path = os.path.join(BASE_DIR, "serviceAccountKey.json")

# Initialize Firebase
MAX_DEPTH = 1000
cred = credentials.Certificate(key_path)
firebase_admin.initialize_app(cred, {
    "databaseURL": "add your firebase url" \\add your database url
})

sensor_ref = db.reference("sensor")

# Global variables to store the data
latest_data = {"depth": 0, "rain": 0, "flood_level": "LOW"}
sensor_history = []  

# -------------------------------
# Firebase Listener (Runs in background)
# -------------------------------
def firebase_listener(event):
    global latest_data, sensor_history

    # Make sure we actually received dictionary data
    if event.data and isinstance(event.data, dict):
        # User clarified: 'depth' is already in meters (e.g., 400)
        depth_m = round(float(event.data.get("depth", 0)), 2)
        
        rain_raw = event.data.get("rain", 0)
        # Convert raw rain data to 1 (yes) or 0 (no)
        rain = 1 if rain_raw > 50 else 0

        now = datetime.datetime.now()

        # Calculate AI Risk Level (Rescaled for static MAX_DEPTH=1000m)
        flood_level = "LOW"
        if depth_m > (MAX_DEPTH * 0.3):
            flood_level = "MEDIUM"
        if depth_m > (MAX_DEPTH * 0.6):
            flood_level = "HIGH"

        # Update latest_data
        latest_data = {
            "depth": depth_m,
            "rain": rain,
            "flood_level": flood_level
        }

        # Create a log entry for history
        log_entry = {
            "depth": depth_m,
            "rain": rain,
            "flood_level": flood_level,
            "date": now.strftime("%d/%m/%Y"),
            "month": now.strftime("%m"),
            "year": now.strftime("%Y"),
            "timestamp": now.strftime("%H:%M:%S")
        }

        # Add to history and keep only the last 500 records
        sensor_history.append(log_entry)
        if len(sensor_history) > 500:
            sensor_history.pop(0)

# -------------------------------
# Initial Data Sync (Prevents "Gathering" state on start)
# -------------------------------
def sync_initial_data():
    global latest_data, sensor_history
    print("AI Engine: Syncing initial state from Firebase...")
    data = sensor_ref.get()
    if data and isinstance(data, dict):
        # User clarified: 'depth' is already in meters (e.g., 400)
        depth_m = round(float(data.get("depth", 0)), 2)
        
        rain_raw = data.get("rain", 0)
        rain = 1 if rain_raw > 50 else 0
        
        latest_data = {
            "depth": depth_m,
            "rain": rain,
            "flood_level": "LOW" # Initial check
        }
        # Recalculate flood level for initial data (static 1000m)
        if depth_m > (MAX_DEPTH * 0.3): latest_data["flood_level"] = "MEDIUM"
        if depth_m > (MAX_DEPTH * 0.6): latest_data["flood_level"] = "HIGH"

        # Create initial history point
        sensor_history.append({
            "depth": depth_m, 
            "rain": rain, 
            "flood_level": latest_data["flood_level"],
            "timestamp": "BOOT"
        })

sync_initial_data()

def get_ml_prediction():
    """Improved ML helper with immediate warm-up logic"""
    global sensor_history, latest_data
    if not latest_data or len(sensor_history) < 1:
        return "Calibrating AI...", 0

    history_vals = [h['depth'] for h in sensor_history[-15:]]
    if len(history_vals) < 2:
        # Dummy history for immediate feedback
        history_vals = [latest_data.get('depth', 0) - 0.01, latest_data.get('depth', 0)]
    
    current_depth = history_vals[-1]
    print(f"AI Engine: Depth={current_depth}m, HistoryLen={len(sensor_history)}")
    rain = latest_data.get("rain", 0)

    if current_depth >= MAX_DEPTH:
        return "Flood Active", 0

    # Calculate rate of change (meters per step)
    if LinearRegression is not None and len(history_vals) >= 5:
        X = np.array(range(len(history_vals))).reshape(-1, 1)
        y = np.array(history_vals)
        model = LinearRegression()
        model.fit(X, y)
        slope = model.coef_[0]
    else:
        # Simple slope for small datasets
        slope = (history_vals[-1] - history_vals[0]) / (len(history_vals) - 1)

    # Factor in rain (rain accelerates flooding)
    # Scaled for meters: if MAX_DEPTH is 1000, 0.01 is 10m.
    if rain == 1:
        slope = max(slope, MAX_DEPTH * 0.001) + (MAX_DEPTH * 0.0015) 

    if slope <= (MAX_DEPTH * 0.0001):
        return "Stable / Safe", 30

    # Prediction countdown (based on MAX_DEPTH target)
    days_to_flood = max(1, math.ceil((MAX_DEPTH - current_depth) / slope))
    return f"{days_to_flood} possible days to flood occur", days_to_flood

# Start listening to Firebase in the background
threading.Thread(
    target=lambda: sensor_ref.listen(firebase_listener),
    daemon=True
).start()

# -------------------------------
# MOBILE API ROUTES (JSON ONLY)
# -------------------------------

@app.route("/dashboard", methods=["GET"])
def dashboard_api():
    """Returns the single live data point + AI prediction"""
    pred_text, pred_days = get_ml_prediction()
    response = {**latest_data}
    response["prediction"] = pred_text
    response["days_estimated"] = pred_days
    return jsonify(response)

@app.route("/analytics_data", methods=["GET"])
def analytics_data():
    """Returns the full history array for the Analytics screen"""
    return jsonify(sensor_history)

if __name__ == "__main__":
    # Host="0.0.0.0" is CRITICAL! It allows your mobile phone to connect!
    print("Starting StormWatch API for Mobile App...")
    app.run(host="0.0.0.0", debug=True, port=5000)
