import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import datetime

# --- Data Simulation for Training ---
# In a real scenario, you would load this from a CSV or Firebase
def simulate_historical_data(samples=1000):
    data = []
    for _ in range(samples):
        # Randomly generate features
        depth = np.random.uniform(0, 1000)  # depth in meters (fixed max 1000m)
        rain = np.random.choice([0, 1])     # 0=No, 1=Yes
        hour = np.random.randint(0, 24)
        month = np.random.randint(1, 13)
        
        # Logic for target (Risk)
        # Based on new 1000m scale: Safe (0-400), Medium (400-800), High (>800)
        risk = 0  # SAFE
        if depth >= 800:
            risk = 2  # HIGH
        elif depth >= 400 or (depth >= 300 and rain == 1):
            risk = 1  # MEDIUM
            
        data.append([depth, rain, hour, month, risk])
    
    return pd.DataFrame(data, columns=['depth', 'rain', 'hour', 'month', 'risk'])

# --- Machine Learning Engine ---
class FloodPredictor:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        
    def preprocess_time(self, df):
        # Encode cyclic time (hour and month) using trig functions
        df['hour_sin'] = np.sin(2 * np.pi * df['hour']/23.0)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour']/23.0)
        df['month_sin'] = np.sin(2 * np.pi * df['month']/12.0)
        df['month_cos'] = np.cos(2 * np.pi * df['month']/12.0)
        return df.drop(['hour', 'month'], axis=1)

    def train(self, df):
        processed_df = self.preprocess_time(df)
        X = processed_df.drop('risk', axis=1)
        y = processed_df['risk']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
        self.model.fit(X_train, y_train)
        accuracy = self.model.score(X_test, y_test)
        print(f"Model Trained Successfully. Accuracy: {accuracy*100:.2f}%")

    def predict_possibility(self, depth, rain, hour, month):
        # Prepare input
        input_data = pd.DataFrame([[depth, rain, hour, month]], 
                                  columns=['depth', 'rain', 'hour', 'month'])
        processed_input = self.preprocess_time(input_data)
        
        # Get probabilities
        probs = self.model.predict_proba(processed_input)[0]
        # risk classes: [0, 1, 2] -> [LOW, MEDIUM, HIGH]
        # Weighted score (possibility %)
        possibility = (probs[1] * 50) + (probs[2] * 100)
        
        risk_label = "LOW"
        if possibility > 70: risk_label = "CRITICAL"
        elif possibility > 40: risk_label = "ELEVATED"
        
        return round(float(possibility), 2), risk_label

# --- Execution ---
if __name__ == "__main__":
    print("--- StormWatch AI ML System ---")
    predictor = FloodPredictor()
    
    # 1. Simulate and Train
    print("Simulating historical telemetry data...")
    raw_data = simulate_historical_data(2000)
    predictor.train(raw_data)
    
    # 2. Test Prediction
    now = datetime.datetime.now()
    test_cases = [
        (0.1, 0),   # Low depth, no rain
        (0.35, 1),  # Medium depth, raining
        (0.7, 1)    # High depth, raining
    ]
    
    print("\nRunning Risk Validations:")
    for d, r in test_cases:
        p, label = predictor.predict_possibility(d, r, now.hour, now.month)
        print(f"Depth: {d}m | Rain: {'YES' if r==1 else 'NO'} | "
              f"Flood Possibility: {p}% ({label})")
