import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>LIVE SYSTEM</Text>
        </View>
        <Text style={styles.title}>STORMWATCH<Text style={styles.titleHighlight}> AI</Text></Text>
        <Text style={styles.subtitle}>Intelligent Flood Monitoring & Detection System</Text>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('Dashboard')} activeOpacity={0.8}>
          <Text style={styles.cardIcon}>📍</Text>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Live Dashboard</Text>
            <Text style={styles.cardDesc}>View real-time map tracking, rainfall, and AI risk analysis.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.mainCard, { borderColor: 'rgba(0, 255, 136, 0.3)' }]} onPress={() => navigation.navigate('Analytics')} activeOpacity={0.8}>
          <Text style={styles.cardIcon}>📊</Text>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Pro Analytics</Text>
            <Text style={styles.cardDesc}>Deep dive into historical depth trends and export PDF reports.</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>SYSTEM CAPABILITIES</Text>
        <View style={styles.infoRow}><Text style={styles.infoDot}>•</Text><Text style={styles.infoText}>Real-time Sensor Telemetry</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoDot}>•</Text><Text style={styles.infoText}>Predictive AI Threat Modeling</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoDot}>•</Text><Text style={styles.infoText}>Automated Mapping & Routing</Text></View>
      </View>

      <Text style={styles.footer}>© 2026 StormWatch AI Ecosystem</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', paddingHorizontal: 24 },
  header: { marginTop: 40, marginBottom: 40, alignItems: 'flex-start' },
  badge: { backgroundColor: 'rgba(0, 242, 254, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0, 242, 254, 0.3)' },
  badgeText: { color: '#00f2fe', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 38, color: '#ffffff', fontWeight: '900', letterSpacing: -1, marginBottom: 12 },
  titleHighlight: { color: '#00f2fe' },
  subtitle: { color: '#94a3b8', fontSize: 16, lineHeight: 24, fontWeight: '500', paddingRight: 20 },
  cardContainer: { width: '100%', marginBottom: 30 },
  mainCard: { flexDirection: 'row', backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: 24, borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0, 242, 254, 0.3)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, alignItems: 'center' },
  cardIcon: { fontSize: 32, marginRight: 20 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 20, color: '#ffffff', fontWeight: '800', marginBottom: 6, letterSpacing: -0.5 },
  cardDesc: { color: '#8b9db4', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  infoBox: { backgroundColor: 'transparent', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', width: '100%' },
  infoTitle: { color: '#64748b', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoDot: { color: '#00f2fe', fontSize: 20, marginRight: 12, fontWeight: 'bold' },
  infoText: { color: '#cbd5e1', fontSize: 15, fontWeight: '500' },
  footer: { color: '#475569', fontSize: 12, fontWeight: '600', position: 'absolute', bottom: 20, alignSelf: 'center', letterSpacing: 0.5 }
});
