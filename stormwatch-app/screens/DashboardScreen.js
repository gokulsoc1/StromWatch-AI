import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart, ProgressChart } from 'react-native-chart-kit';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { BACKEND_URL } from '../config';

const screenWidth = Dimensions.get('window').width;

// Generate Elegant Dark Mode Leaflet Map
const generateMapHTML = (lat, lng) => `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body { padding: 0; margin: 0; background-color: #0f172a; }
        #map { height: 100vh; width: 100vw; background-color: #0f172a; }
        .pin-wrapper {
            position: relative;
        }
        .css-pin {
            width: 30px;
            height: 30px;
            background-color: #ff3b3b;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid white;
            box-shadow: -4px 4px 10px rgba(0,0,0,0.5);
            position: absolute;
            left: -15px;
            top: -30px;
        }
        .css-pin::after {
            content: '';
            width: 12px;
            height: 12px;
            background-color: white;
            border-radius: 50%;
            position: absolute;
            top: 9px;
            left: 9px;
        }
        .pulse-shadow {
            width: 14px;
            height: 14px;
            background: rgba(255, 59, 59, 0.4);
            border-radius: 50%;
            position: absolute;
            left: -7px;
            top: -7px;
            animation: ping 1.5s infinite;
        }
        @keyframes ping {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(3); opacity: 0; }
        }
        .leaflet-container { background: #0f172a; outline: 0; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], 15);
        
        // Esri World Imagery (High-Res Satellite, Free, No API Key)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19
        }).addTo(map);

        const customIcon = L.divIcon({ 
            className: 'pin-wrapper', 
            html: '<div class="pulse-shadow"></div><div class="css-pin"></div>',
            iconSize: [0, 0] 
        });
        
        const marker = L.marker([${lat}, ${lng}], { icon: customIcon, draggable: true }).addTo(map);
        
        marker.on('dragend', function(e) {
            const pos = marker.getLatLng();
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PIN_MOVED', lat: pos.lat, lng: pos.lng }));
        });
    </script>
</body>
</html>
`;

export default function DashboardScreen() {
  const [data, setData] = useState({ depth: 0, rain: 0 });
  const [risk, setRisk] = useState({ level: 'LOW', color: '#00ff88' });
  const [depthHistory, setDepthHistory] = useState([0]);
  const [region, setRegion] = useState(null); // Controlled region
  const [location, setLocation] = useState(null); // Actual device location
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationError, setLocationError] = useState(null);

  // Get device location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          return;
        }

        let loc = await Location.getLastKnownPositionAsync({}).catch(() => null);
        
        if (!loc) {
          // Try fetching, but fallback if it errors or takes longer than 5 seconds
          const fetchPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            .catch(err => {
              console.log('Location fetch error:', err);
              return { coords: { latitude: 37.7749, longitude: -122.4194 } }; // Fallback
            });
            
            const timeoutPromise = new Promise(resolve => 
              setTimeout(async () => {
                console.log('Location fetch timed out - using IP Geolocation fallback');
                try {
                  const ipRes = await fetch('https://ipapi.co/json/');
                  const ipData = await ipRes.json();
                  resolve({ coords: { latitude: ipData.latitude, longitude: ipData.longitude } });
                } catch (e) {
                  resolve({ coords: { latitude: 37.7749, longitude: -122.4194 } });
                }
              }, 12000)
            );
          
          loc = await Promise.race([fetchPromise, timeoutPromise]);
        }
        
        console.log('Location fetched:', loc.coords);

        const currentLoc = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        
        setLocation(currentLoc);
        setRegion({
          ...currentLoc,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (err) {
        console.log('Location error:', err);
        setLocationError('Failed to fetch location. Please ensure location services are enabled.');
      }
    })();
  }, []);

  // Fetch backend data
  const fetchData = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/dashboard`);
      const result = await response.json();
      if (result.depth !== undefined) {
        setData(result);

        // AI Risk logic (New Thresholds: 800m = HIGH, 400m = MEDIUM)
        if (result.depth >= 800) setRisk({ level: 'HIGH', color: '#ff3b3b' });
        else if (result.depth >= 400) setRisk({ level: 'MEDIUM', color: '#ffaa00' });
        else setRisk({ level: 'SAFE', color: '#00ff88' });

        // Depth history (last 10 points)
        setDepthHistory(prev => {
          const newLogs = [...prev, result.depth];
          if (newLogs.length > 10) newLogs.shift();
          return newLogs;
        });
      }
    } catch (error) {
      console.log('Backend not connected - check IP address');
    }
  };

  // Predictive Engine (JS Implementation)
  const getPredictiveInfo = () => {
    const depth = data.depth || 0;
    const rain = data.rain === 1;
    let score = (depth / 1000) * 100; // Linear for 1000m scale
    if (rain) score += 15;
    const finalScore = Math.min(Math.round(score), 99);
    
    let label = "SAFE";
    let color = "#22c55e"; // Green
    if (finalScore > 80) { label = "CRITICAL"; color = "#ef4444"; }
    else if (finalScore > 40) { label = "ELEVATED"; color = "#f97316"; }
    else if (finalScore > 10) { label = "MODERATE"; color = "#eab308"; }

    return { score: finalScore, label, color };
  };

  const predInfo = getPredictiveInfo();

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.panel}>

        {/* Map View */}
        <Text style={styles.sectionTitle}>Location Tracking</Text>
        <View style={styles.mapContainer}>
          {region && location ? (
            <WebView 
              originWhitelist={['*']}
              source={{ html: generateMapHTML(location.latitude, location.longitude) }}
              style={{ flex: 1, backgroundColor: '#0f172a' }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'PIN_MOVED') {
                    console.log('Pin manually moved to:', data.lat, data.lng);
                    setLocation({ latitude: data.lat, longitude: data.lng });
                  }
                } catch (e) {}
              }}
            />
          ) : (
            <Text style={styles.loading}>{locationError || 'Fetching location...'}</Text>
          )}
        </View>

        {location && (
          <View style={styles.pinDetails}>
            <Text style={styles.pinText}>📍 Pinned: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text>
            <Text style={styles.pinHint}>(Drag the pin to update location)</Text>
          </View>
        )}

        {/* Depth Chart - Pro Style */}
        <Text style={styles.sectionTitle}>Depth Trend (Max 1000m)</Text>
        <LineChart
          data={{ labels: Array(depthHistory.length).fill(''), datasets: [{ data: depthHistory.length > 0 ? depthHistory : [0], strokeWidth: 3 }] }}
          width={screenWidth - 40}
          height={220}
          chartConfig={proChartConfig}
          fromZero
          yAxisMax={1000}
          bezier
          withHorizontalLines={true}
          withVerticalLines={false}
          style={{ alignSelf: 'center', marginBottom: 20 }}
        />

        {/* Predictive Intelligence Card */}
        <View style={styles.predictiveCard}>
          <View>
            <Text style={styles.predLabel}>AI FLOOD PROBABILITY</Text>
            <Text style={[styles.predValue, { color: predInfo.color }]}>{predInfo.score}%</Text>
            <Text style={[styles.predStatus, { color: predInfo.color }]}>{predInfo.label} RISK LEVEL</Text>
          </View>
          <View style={styles.predRight}>
             <View style={[styles.glowOrb, { backgroundColor: predInfo.color }]} />
             <Text style={styles.predHint}>Live Sync</Text>
          </View>
        </View>

        {/* Rain Gauge - Pro Style */}
        <Text style={styles.sectionTitle}>Rain Gauge</Text>
        <ProgressChart
          data={{ labels: ['Rain'], data: [data.rain === 1 ? 1 : 0] }}
          width={screenWidth - 40}
          height={180}
          strokeWidth={18}
          radius={65}
          chartConfig={{
            ...proChartConfig,
            color: (opacity = 1) =>
              data.rain === 1
                ? `rgba(0, 170, 255, ${opacity})`
                : `rgba(0, 255, 136, ${opacity})`,
          }}
          hideLegend={false}
          style={{ alignSelf: 'center', right: 10, marginBottom: 20 }}
        />

        {/* Live Metrics */}
        <Text style={styles.sectionTitle}>Live Metrics</Text>
        <MetricRow label="Date" value={currentTime.toLocaleDateString()} />
        <MetricRow label="Time" value={currentTime.toLocaleTimeString()} />
        <MetricRow label="Depth" value={`${data.depth.toFixed(2)} m`} />
        <MetricRow label="Rain" value={data.rain === 1 ? 'Rain Occurring' : 'No Rain'} />
        <MetricRow label="AI Risk" value={risk.level} valueColor={risk.color} />

      </View>
    </ScrollView>
  );
}

const MetricRow = ({ label, value, valueColor = 'white' }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
  </View>
);

const proChartConfig = {
  backgroundColor: 'transparent',
  backgroundGradientFrom: '#0f172a',
  backgroundGradientTo: '#0f172a',
  backgroundGradientFromOpacity: 0,
  backgroundGradientToOpacity: 0,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(0, 242, 254, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: '5', strokeWidth: '2', stroke: '#00f2fe', fill: '#0f172a' },
  propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.05)', strokeDasharray: '0', strokeWidth: 1 },
  propsForVerticalLabels: { fontSize: 11, fontWeight: '700' },
  propsForHorizontalLabels: { fontSize: 11, fontWeight: '700' },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  panel: { backgroundColor: 'transparent', paddingVertical: 10, paddingHorizontal: 20, paddingBottom: 50 },
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900', marginTop: 20, marginBottom: 15, letterSpacing: 0.5 },
  mapContainer: { height: 280, width: screenWidth - 40, overflow: 'hidden', borderRadius: 24, marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(0, 242, 254, 0.2)', shadowColor: '#00f2fe', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, alignSelf: 'center' },
  pinDetails: { alignItems: 'center', marginBottom: 25 },
  pinText: { color: '#00f2fe', fontSize: 14, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  pinHint: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  map: { width: '100%', height: '100%' },
  loading: { color: '#94a3b8', textAlign: 'center', marginTop: 120, fontSize: 16, fontWeight: '600' },
  chart: { marginBottom: 20, alignSelf: 'center' },
  metric: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.8)', paddingHorizontal: 24, paddingVertical: 20, marginBottom: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10 },
  metricHighlight: { backgroundColor: 'rgba(0, 242, 254, 0.08)', borderColor: 'rgba(0, 242, 254, 0.3)', shadowColor: '#00f2fe', shadowOpacity: 0.2 },
  metricLabel: { color: '#cbd5e1', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { fontWeight: '900', fontSize: 20, letterSpacing: -0.5 },
  predictiveCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#00f2fe',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  predLabel: { color: '#64748b', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 5 },
  predValue: { fontSize: 42, fontWeight: '900', letterSpacing: -2, color: '#ffffff' },
  predStatus: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  predRight: { alignItems: 'center' },
  glowOrb: { width: 12, height: 12, borderRadius: 6, marginBottom: 8 },
  predHint: { color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});