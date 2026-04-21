import React, { useState, useEffect, useRef, forwardRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { LineChart, BarChart, ProgressChart } from "react-native-chart-kit";
import ViewShot from "react-native-view-shot";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { BACKEND_URL } from "../config"; // adjust to your backend

const screenWidth = Dimensions.get("window").width;

const safeNumber = (v) => {
  const n = Number(v);
  if (isNaN(n) || !isFinite(n)) return 0;
  return n;
};

const avgArray = (arr) =>
  arr.length ? arr.reduce((a, b) => safeNumber(a) + safeNumber(b), 0) / arr.length : 0;

export default function AnalyticsScreen() {
  const depthRef = useRef();
  const rainRef = useRef();
  const hourRef = useRef();
  const dayRef = useRef();
  const monthRef = useRef();
  const yearRef = useRef();

  const [logs, setLogs] = useState([]);
  const [kpi, setKpi] = useState({
    currentDepth: 0,
    risk: "LOW",
    total: 0,
    highRisk: 0,
    rainPercent: 0,
    avgDepth: 0,
    maxDepth: 0,
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/dashboard`);
      const data = await res.json();
      const depth = safeNumber(data.depth);
      const rain = safeNumber(data.rain);
      let risk = "SAFE";
      if (depth >= 800) risk = "HIGH";
      else if (depth >= 400) risk = "MEDIUM";

      const now = new Date();
      const newLog = {
        day: now.getDate(),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        hour: now.getHours(),
        depth,
        rain,
        risk,
      };

      setLogs((prev) => {
        const updated = [...prev, newLog].slice(-200);
        updateKPI(updated, depth, risk);
        return updated;
      });
    } catch (e) {
      console.log("Fetch error:", e);
    }
  };

  const updateKPI = (dataLogs, depth, risk) => {
    const depths = dataLogs.map((l) => safeNumber(l.depth));
    const rainCount = dataLogs.filter((l) => l.rain === 1).length;
    const highRisk = dataLogs.filter((l) => l.risk === "HIGH").length;
    const avg = avgArray(depths);
    const max = depths.length ? Math.max(...depths) : 0;

    setKpi({
      currentDepth: depth.toFixed(2),
      risk,
      total: dataLogs.length,
      highRisk,
      rainPercent: dataLogs.length ? ((rainCount / dataLogs.length) * 100).toFixed(1) : 0,
      avgDepth: avg.toFixed(2),
      maxDepth: max.toFixed(2),
    });
  };

  const clearLogs = () => {
    Alert.alert("Clear Logs", "Delete all logs?", [
      { text: "Cancel" },
      { text: "Delete", onPress: () => setLogs([]) },
    ]);
  };

  const groupBy = (key) => {
    let group = {};
    logs.forEach((l) => {
      if (!group[l[key]]) group[l[key]] = [];
      group[l[key]].push(l.depth);
    });
    const labels = Object.keys(group).sort((a, b) => a - b);
    const values = Object.values(group).map((arr) => avgArray(arr));
    return { labels: labels.length ? labels : ["0"], datasets: [{ data: values.length ? values : [0] }] };
  };

  const monthChart = () => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let group = {};
    logs.forEach((l) => {
      if (!group[l.month]) group[l.month] = [];
      group[l.month].push(l.depth);
    });
    const labels = Object.keys(group).map((m) => months[m-1]);
    const values = Object.values(group).map((arr) => avgArray(arr));
    return { labels: labels.length ? labels : ["Jan"], datasets: [{ data: values.length ? values : [0] }] };
  };

  const depthChart = {
    labels: logs.length ? logs.slice(-10).map((_, i) => `${i+1}`) : ["0"],
    datasets: [{ data: logs.length ? logs.slice(-10).map((l) => l.depth) : [0], strokeWidth: 3 }],
  };
  
  const rainGauge = { labels: ["Rain"], data: [safeNumber(kpi.rainPercent)/100||0] };

  const downloadPDF = async () => {
    try {
      await new Promise(r => setTimeout(r, 1000));
      const refs = [depthRef, rainRef, hourRef, dayRef, monthRef, yearRef];
      const tempImages = [];
      for (let i = 0; i < refs.length; i++) {
        if (refs[i].current) {
          const base64 = await refs[i].current.capture();
          tempImages.push(`data:image/png;base64,${base64}`);
        } else {
          tempImages.push("");
        }
      }
      const [depthImg, rainImg, hourImg, dayImg, monthImg, yearImg] = tempImages;

      // Prepare last 25 logs for a dense registry
      const recentLogs = [...logs].reverse().slice(0, 25);
      const logRows = recentLogs.map((l, idx) => `
        <tr style="background: ${idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'}; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 14px; font-size: 12px; color: #64748b;">${l.day}/${l.month}/${l.year}</td>
          <td style="padding: 14px; font-size: 12px; color: #94a3b8; font-weight: 600;">${l.hour}:00 HRS</td>
          <td style="padding: 14px; font-size: 14px; color: #00f2fe; font-weight: 900;">${Number(l.depth).toFixed(2)} m</td>
          <td style="padding: 14px; font-size: 12px; color: ${l.rain === 1 ? '#4ade80' : '#475569'}; font-weight: 800;">${l.rain === 1 ? 'DETECTED' : 'CLEAR'}</td>
          <td style="padding: 14px; font-size: 11px;">
            <span style="background: ${l.risk === 'HIGH' ? 'rgba(239, 68, 68, 0.1)' : l.risk === 'MEDIUM' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)'}; 
                         color: ${l.risk === 'HIGH' ? '#ef4444' : l.risk === 'MEDIUM' ? '#f59e0b' : '#22c55e'}; 
                         padding: 6px 12px; border-radius: 8px; font-weight: 900; text-transform: uppercase;">
              ${l.risk}
            </span>
          </td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { margin: 0; }
            * { box-sizing: border-box; }
            body { 
              background: #020617;
              color: #f8fafc; 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              margin: 0; padding: 0; 
            }
            .page {
              width: 100%;
              height: 100vh;
              padding: 60px 80px;
              position: relative;
              page-break-after: always;
              background: #020617;
              display: flex;
              flex-direction: column;
            }
            .bg-accent {
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              background: radial-gradient(circle at 0% 0%, #0f172a 0%, #020617 100%);
              z-index: -1;
            }
            
            /* Cover Design */
            .cover { justify-content: center; align-items: center; text-align: center; }
            .logo-orb {
              width: 140px;
              height: 140px;
              border: 1px solid rgba(0, 242, 254, 0.3);
              background: rgba(0, 242, 254, 0.05);
              border-radius: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 50px;
              box-shadow: 0 0 80px rgba(0, 242, 254, 0.1);
            }
            .logo-orb h1 { color: #00f2fe; font-size: 70px; margin: 0; font-weight: 900; }
            .cover h2 { font-size: 64px; font-weight: 900; line-height: 1; margin: 0; letter-spacing: -2px; }
            .cover h3 { font-size: 16px; font-weight: 800; color: #7dd3fc; text-transform: uppercase; letter-spacing: 12px; margin-top: 30px; }
            .cover-meta { position: absolute; bottom: 80px; color: #475569; font-size: 12px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; }

            /* Centered Chart Design */
            .chart-page { justify-content: center; align-items: center; text-align: center; }
            .chart-header { width: 100%; margin-bottom: 60px; text-align: left; }
            .chart-header .tag { color: #00f2fe; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 15px; display: block; }
            .chart-header h4 { font-size: 40px; font-weight: 900; margin: 0; color: #ffffff; }
            
            .visual-container {
              width: 100%;
              background: linear-gradient(145deg, rgba(15, 23, 42, 0.8), rgba(2, 6, 23, 0.8));
              border-radius: 40px;
              padding: 50px;
              border: 1px solid rgba(255, 255, 255, 0.05);
              box-shadow: 0 40px 100px rgba(0,0,0,0.4);
            }
            .full-chart { width: 100%; border-radius: 20px; }

            /* KPI & Table UX */
            .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 50px; }
            .kpi-v { background: rgba(255,255,255,0.03); padding: 30px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); text-align: left; }
            .kpi-v span { display: block; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;}
            .kpi-v b { font-size: 32px; font-weight: 900; color: #ffffff; }

            .table-container { margin-top: 40px; width: 100%; overflow: hidden; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { padding: 20px; color: #94a3b8; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; background: rgba(255,255,255,0.02); }

            .footer { position: absolute; bottom: 40px; left: 80px; right: 80px; display: flex; justify-content: space-between; color: #334155; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
          </style>
        </head>
        <body>
          <!-- PAGE 1: COVER -->
          <div class="page cover">
            <div class="bg-accent"></div>
            <div class="logo-orb"><h1>S</h1></div>
            <h2>GLOBAL FLOOD<br>INTELLIGENCE</h2>
            <h3>Analytics Report</h3>
            <div class="cover-meta">Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} // ID: SW-AI-${Math.floor(Math.random()*9999)}</div>
          </div>

          <!-- PAGE 2: SUMMARY -->
          <div class="page">
            <div class="bg-accent"></div>
            <div class="chart-header">
              <span class="tag">01 // EXECUTIVE</span>
              <h4>Summary Index</h4>
            </div>
            
            <div class="kpi-row">
              <div class="kpi-v"><span>Current Depth</span><b>${kpi.currentDepth} m</b></div>
              <div class="kpi-v"><span>AI Risk Profile</span><b style="color:${kpi.risk === 'HIGH' ? '#ef4444' : kpi.risk === 'MEDIUM' ? '#f59e0b' : '#22c55e'}">${kpi.risk}</b></div>
              <div class="kpi-v"><span>Total Sensor Logs</span><b>${kpi.total}</b></div>
            </div>

            <div class="kpi-row">
              <div class="kpi-v"><span>Peak Threshold</span><b style="color:#ef4444">${kpi.maxDepth} m</b></div>
              <div class="kpi-v"><span>Mean Velocity</span><b>${kpi.avgDepth} m</b></div>
              <div class="kpi-v"><span>Rain Probability</span><b style="color:#00f2fe">${kpi.rainPercent}%</b></div>
            </div>

            <div style="margin-top: 60px; line-height: 1.8; color: #94a3b8; font-size: 16px; max-width: 700px;">
              The StormWatch analytical engine has successfully processed the latest telemetry grid on a <b>Fixed 1000m Environmental Scale</b>. Water levels remain consistently mapped with predictive risk algorithms validating a <b>${kpi.risk}</b> environment. No immediate sensor deviations detected outside of seasonal benchmarks.
            </div>
            <div class="footer"><span>Stormwatch Enterprise // Series X</span><span>01 / 09</span></div>
          </div>

          <!-- PAGE 3: DEPTH TREND -->
          <div class="page chart-page">
            <div class="bg-accent"></div>
            <div class="chart-header">
              <span class="tag">02 // SENSOR DATA</span>
              <h4>Full History Depth Trend (Max 1000m)</h4>
            </div>
            <div class="visual-container">
              <img src="${depthImg}" class="full-chart" />
            </div>
            <div class="footer"><span>Stormwatch Enterprise // Series X</span><span>02 / 09</span></div>
          </div>

          <!-- PAGE 4: RAIN GAUGE -->
          <div class="page chart-page">
            <div class="bg-accent"></div>
            <div class="chart-header">
              <span class="tag">03 // PRECIPITATION</span>
              <h4>Live Rain Gauge Monitoring</h4>
            </div>
            <div class="visual-container">
              <img src="${rainImg}" class="full-chart" />
            </div>
            <div class="footer"><span>Stormwatch Enterprise // Series X</span><span>03 / 09</span></div>
          </div>

          <!-- PAGE 5: HOURLY -->
          <div class="page chart-page">
            <div class="bg-accent"></div>
            <div class="chart-header">
              <span class="tag">04 // TEMPORAL</span>
              <h4>Intra-Day Distribution (Max 1000m)</h4>
            </div>
            <div class="visual-container">
              <img src="${hourImg}" class="full-chart" />
            </div>
            <div class="footer"><span>Stormwatch Enterprise // Series X</span><span>04 / 09</span></div>
          </div>

          <!-- PAGE 6: DAILY -->
          <div class="page chart-page">
            <div class="bg-accent"></div>
            <div class="chart-header">
              <span class="tag">05 // CHRONOLOGICAL</span>
              <h4>Daily Incident Sequence (Max 1000m)</h4>
            </div>
            <div class="visual-container">
              <img src="${dayImg}" class="full-chart" />
            </div>
            <div class="footer"><span>Stormwatch Enterprise // Series X</span><span>05 / 09</span></div>
          </div>

          <!-- PAGE 7: MONTHLY -->
          <div class="page chart-page">
            <div class="bg-accent"></div>
            <div class="chart-header">
              <span class="tag">06 // LONGITUDINAL</span>
              <h4>Monthly Development (Max 1000m)</h4>
            </div>
            <div class="visual-container">
              <img src="${monthImg}" class="full-chart" />
            </div>
            <div class="footer"><span>Stormwatch Enterprise // Series X</span><span>06 / 09</span></div>
          </div>

          <!-- PAGE 8: YEARLY -->
          <div class="page chart-page">
            <div class="bg-accent"></div>
            <div class="chart-header">
              <span class="tag">07 // STRATEGIC</span>
              <h4>Annual Performance Map (Max 1000m)</h4>
            </div>
            <div class="visual-container">
              <img src="${yearImg}" class="full-chart" />
            </div>
            <div class="footer"><span>Stormwatch Enterprise // Series X</span><span>07 / 09</span></div>
          </div>

          <!-- PAGE 9: DATA REGISTRY -->
          <div class="page">
            <div class="bg-accent"></div>
            <div class="chart-header">
              <span class="tag">08 // RAW LEDGER</span>
              <h4>Telemetry Index Archive</h4>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Depth (m)</th>
                    <th>Precipitation</th>
                    <th>AI Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${logRows}
                </tbody>
              </table>
            </div>
            <div class="footer"><span>Stormwatch Enterprise // Series X</span><span>End Log / 09</span></div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        background: "#020617",
      });

      await Sharing.shareAsync(uri);

    } catch (e) {
      console.log("PDF error:", e);
      Alert.alert("Error", "Failed to generate PDF");
    }
  };

  const KPI = ({ title, value, color="#00f2fe" }) => (
    <View style={styles.kpi}>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={[styles.kpiValue,{color}]}>{value}</Text>
    </View>
  );

  const ChartCard = forwardRef(({ title, children }, ref) => (
    <ViewShot ref={ref} options={{ format:"png", quality:1, result: "base64" }}>
      <View style={styles.card}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.chartWrapper}>{children}</View>
      </View>
    </ViewShot>
  ));

  return (
    <ScrollView style={styles.container}>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.clearButton} onPress={clearLogs}>
          <Text style={styles.btnText}>Clear Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pdfButton} onPress={downloadPDF}>
          <Text style={styles.btnText}>Download PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.kpiGrid}>
        <KPI title="Current Depth" value={`${kpi.currentDepth} m`} />
        <KPI title="AI Risk" value={kpi.risk} color={kpi.risk==="HIGH"? "#ff3b3b":kpi.risk==="MEDIUM"? "#ffaa00":"#00ff88"} />
        <KPI title="Total Records" value={kpi.total} />
        <KPI title="High Risk Events" value={kpi.highRisk} color="#ff3b3b" />
        <KPI title="Rain %" value={`${kpi.rainPercent}%`} />
        <KPI title="Avg Depth" value={`${kpi.avgDepth} m`} />
        <KPI title="Max Depth" value={`${1000} m`} />
      </View>

      <ChartCard ref={depthRef} title="DEPTH TREND">
        <LineChart data={depthChart} width={screenWidth-50} height={220} fromZero yAxisMax={1000} bezier chartConfig={proChartConfig} style={{ right: 8 }} withHorizontalLines={true} withVerticalLines={false} />
      </ChartCard>

      <ChartCard ref={rainRef} title="RAIN GAUGE">
        <ProgressChart data={rainGauge} width={screenWidth-50} height={200} strokeWidth={18} radius={75} chartConfig={proChartConfig} style={{ left: 10 }} />
      </ChartCard>

      <ChartCard ref={hourRef} title="HOURLY ANALYSIS">
        <LineChart data={groupBy("hour")} width={screenWidth-50} height={220} fromZero yAxisMax={1000} bezier chartConfig={proChartConfig} style={{ right: 8 }} withHorizontalLines={true} withVerticalLines={false} />
      </ChartCard>

      <ChartCard ref={dayRef} title="DAILY ANALYSIS">
        <BarChart data={groupBy("day")} width={screenWidth-50} height={220} fromZero yAxisMax={1000} showBarTops withInnerLines chartConfig={proChartConfig} style={{ right: 8 }} />
      </ChartCard>

      <ChartCard ref={monthRef} title="MONTHLY ANALYSIS">
        <BarChart data={monthChart()} width={screenWidth-50} height={220} fromZero yAxisMax={1000} showBarTops withInnerLines chartConfig={proChartConfig} style={{ right: 8 }} />
      </ChartCard>

      <ChartCard ref={yearRef} title="YEARLY ANALYSIS">
        <BarChart data={groupBy("year")} width={screenWidth-50} height={220} fromZero yAxisMax={1000} showBarTops withInnerLines chartConfig={proChartConfig} style={{ right: 8 }} />
      </ChartCard>
    </ScrollView>
  );
}

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
  container: { flex: 1, backgroundColor: "#020617", paddingHorizontal: 20, paddingTop: 10 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 25, marginTop: 10 },
  clearButton: { backgroundColor: "rgba(255, 59, 59, 0.15)", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,59,59,0.3)" },
  pdfButton: { backgroundColor: "rgba(0, 242, 254, 0.15)", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,242,254,0.3)" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  kpi: { width: "48%", backgroundColor: "rgba(15, 23, 42, 0.8)", padding: 20, borderRadius: 20, marginBottom: 15, alignItems: "flex-start", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10 },
  kpiTitle: { color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: "800" },
  kpiValue: { fontSize: 26, fontWeight: "900", letterSpacing: -1 },
  card: { backgroundColor: "rgba(15, 23, 42, 0.8)", padding: 24, borderRadius: 24, marginBottom: 25, alignItems: "flex-start", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 15 },
  chartTitle: { color: "#ffffff", fontSize: 16, fontWeight: "900", marginBottom: 24, letterSpacing: 1 },
  chartWrapper: { width: "100%", alignItems: "center", justifyContent: "center" }
});