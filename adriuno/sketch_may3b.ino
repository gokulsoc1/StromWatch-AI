#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>

// ---------------- WIFI ----------------
#define WIFI_SSID "17"      // ⚠️ Replace with your WiFi SSID
#define WIFI_PASSWORD "987654321"

// ---------------- FIREBASE ----------------
#define API_KEY "AIzaSyCX0gpXXCys0UeYk4YoLRzUn1xwm9Oluiw"
#define DATABASE_URL "stromwatch-ai-default-rtdb.asia-southeast1.firebasedatabase.app"

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ---------------- PINS ----------------
#define TRIG_PIN D5
#define ECHO_PIN D6
#define RAIN_PIN D7

// ---------------- VARIABLES ----------------
long duration;
float distance;  // float for more precise measurement
int rainValue;

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  delay(100);

  // Pin setup
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RAIN_PIN, INPUT);

  // -------- WiFi --------
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nWiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // -------- Firebase --------
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true;
  config.tcp_data_sending_retry = 5;

  // Required for ESP8266 SSL
  fbdo.setBSSLBufferSize(2048, 1024);

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

// ---------------- LOOP ----------------
void loop() {

  // -------- ULTRASONIC SENSOR --------
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  duration = pulseIn(ECHO_PIN, HIGH);

  // Convert to distance in cm (round-trip)
  if (duration == 0) {
    distance = 0;  // No echo received
  } else {
    distance = duration * 0.034 / 2.0;  // cm
  }

  // -------- RAIN SENSOR --------
  rainValue = (digitalRead(RAIN_PIN) == LOW) ? 1 : 0;  // 1 = rain, 0 = dry

  // -------- SERIAL OUTPUT --------
  Serial.print("Depth: ");
  Serial.print(distance, 2);  // 2 decimal places
  Serial.print(" m | Rain: ");
  Serial.println(rainValue);

  // -------- FIREBASE --------
  if (Firebase.ready()) {
    FirebaseJson json;
    json.set("depth", distance);
    json.set("rain", rainValue);
    json.set("timestamp", millis());

    if (Firebase.RTDB.pushJSON(&fbdo, "/sensor", &json)) {
      Serial.println("✅ Sent to Firebase");
    } else {
      Serial.println("❌ Firebase Error: " + fbdo.errorReason());
    }
  } else {
    Serial.println("⚠️ Firebase not ready");
  }

  delay(10000);  // 1-second interval
}