import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { DeviceMotion, Magnetometer } from 'expo-sensors';
import * as Location from 'expo-location';

export default function App() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [currentScreen, setAlignmentScreen] = useState('camera');
  const [capturedData, setCapturedData] = useState({ heading: 0, pitch: 0, cardinal: 'N', timestamp: null });
  const [fixResult, setFixResult] = useState(null);

  useEffect(() => {
    DeviceMotion.setUpdateInterval(100);
    Magnetometer.setUpdateInterval(100);

    let latestAccel = { x: 0, y: 0, z: 9.8 };

    const motionSub = DeviceMotion.addListener((data) => {
      if (data && data.accelerationIncludingGravity) {
        latestAccel = data.accelerationIncludingGravity;
        const { x, y, z } = latestAccel;
        const horizontalMag = Math.sqrt(x * x + z * z);
        const pitchRadians = Math.atan2(-y, horizontalMag);
        setPitch(Math.round(pitchRadians * (180 / Math.PI)));
      }
    });

    const magSub = Magnetometer.addListener((magData) => {
      const { x: ax, y: ay, z: az } = latestAccel;
      const { x: mx, y: my, z: mz } = magData;

      const normA = Math.sqrt(ax * ax + ay * ay + az * az);
      if (normA === 0) return;
      const gX = ax / normA, gY = ay / normA, gZ = az / normA;

      const eX = my * gZ - mz * gY;
      const eY = mz * gX - mx * gZ;
      const eZ = mx * gY - my * gX;
      const normE = Math.sqrt(eX * eX + eY * eY + eZ * eZ);
      if (normE === 0) return;
      const nE_x = eX / normE, nE_y = eY / normE, nE_z = eZ / normE;

      const nN_x = nE_y * gZ - nE_z * gY;
      const nN_y = nE_z * gX - nE_x * gZ;
      const nN_z = nE_x * gY - nE_y * gX;

      const headingRad = Math.atan2(nE_y, nN_y);
      let headingDeg = Math.round(headingRad * (180 / Math.PI));
      if (headingDeg < 0) headingDeg += 360;

      setHeading(headingDeg);
    });

    return () => {
      motionSub && motionSub.remove();
      magSub && magSub.remove();
    };
  }, []);

  if (!cameraPermission) {
    return <View style={styles.centerContainer}><Text>Loading permissions...</Text></View>;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permText}>Camera access is required to use this feature.</Text>
        <Button onPress={requestCameraPermission} title="Grant Camera Permission" />
      </View>
    );
  }

  const getCardinalDirection = (hdg) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round((hdg % 360) / 45) % 8];
  };

  const cardinal = getCardinalDirection(heading);

  // --- INTERCEPT REDUCTION CALCULATION ---
  const calculateIntercept = async (obsAlt, obsAzimuth, captureTime) => {
    try {
      // 1. Get a rough fallback position (Assumed Position) from device GPS
      let { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 33.8938; // Default fallback (e.g., Beirut / mid-latitudes)
      let lon = 35.5018;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      }

      // 2. Compute Sun Ephemeris for the exact capture timestamp
      const JD = captureTime.getTime() / 86400000 + 2440587.5;
      const T = (JD - 2451545.0) / 36525.0;

      let L0 = (280.46646 + 36000.76983 * T) % 360;
      let M = (357.52911 + 35999.05029 * T) % 360;
      let C = (1.914602 - 0.004817 * T) * Math.sin((M * Math.PI) / 180) + (0.019993 - 0.000101 * T) * Math.sin((2 * M * Math.PI) / 180);
      let Sun_true_long = L0 + C;

      let epsilon = 23.439291 - 0.0130042 * T;
      const sinDec = Math.sin((epsilon * Math.PI) / 180) * Math.sin((Sun_true_long * Math.PI) / 180);
      const dec = Math.asin(sinDec) * (180 / Math.PI); // Declination

      let GMST = (280.46061837 + 360.98564736629 * (JD - 2451545.0)) % 360;
      let GHA = (GMST - Sun_true_long + 180 + 360) % 360;

      // Local Hour Angle (LHA)
      let LHA = (GHA + lon) % 360;

      // 3. Calculate Calculated Altitude (Hc) and Calculated Azimuth (Zc)
      const latRad = (lat * Math.PI) / 180;
      const decRad = (dec * Math.PI) / 180;
      const lhaRad = (LHA * Math.PI) / 180;

      const sinHc = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(lhaRad);
      const Hc = Math.asin(sinHc) * (180 / Math.PI); // Calculated Altitude

      // Azimuth calculation
      const cosZ = (Math.sin(decRad) - Math.sin(latRad) * sinHc) / (Math.cos(latRad) * Math.cos(Math.asin(sinHc)));
      let Zc = Math.acos(Math.min(Math.max(cosZ, -1), 1)) * (180 / Math.PI);
      if (Math.sin(lhaRad) > 0) Zc = 360 - Zc; // Quadrant correction

      // 4. Compute Intercept Distance (in Nautical Miles)
      // 1 degree of arc = 60 nautical miles
      const interceptMinutes = (obsAlt - Hc) * 60; 
      const interceptDistance = Math.abs(Math.round(interceptMinutes));
      
      // Determine Toward (+) or Away (-) from the Sun
      // If Observed Altitude > Calculated Altitude, you are TOWARD the sun.
      const direction = interceptMinutes >= 0 ? "TOWARD the Sun" : "AWAY from the Sun";

      setFixResult({
        assumedLat: lat.toFixed(4),
        assumedLon: lon.toFixed(4),
        calculatedAlt: Hc.toFixed(1),
        calculatedAz: Zc.toFixed(1),
        interceptNM: interceptDistance,
        interceptDir: direction
      });
      setAlignmentScreen('result');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCapture = () => {
    const now = new Date();
    setCapturedData({ heading, pitch, cardinal, timestamp: now });
    calculateIntercept(pitch, heading, now);
  };

  // --- RESULT SCREEN ---
  if (currentScreen === 'result' && fixResult) {
    return (
      <ScrollView contentContainerStyle={styles.resultContainer}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>📐 Celestial Fix (Intercept)</Text>
          
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Observed Altitude ($H_o$):</Text>
            <Text style={styles.dataValue}>{capturedData.pitch}°</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Calculated Altitude ($H_c$):</Text>
            <Text style={styles.dataValue}>{fixResult.calculatedAlt}°</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Observed Bearing ($Z_o$):</Text>
            <Text style={styles.dataValue}>{capturedData.heading}° ({capturedData.cardinal})</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Calculated Bearing ($Z_c$):</Text>
            <Text style={styles.dataValue}>{fixResult.calculatedAz}°</Text>
          </View>

          <View style={styles.interceptBox}>
            <Text style={styles.interceptTitle}>Final Intercept Vector</Text>
            <Text style={styles.interceptValue}>{fixResult.interceptNM} NM {fixResult.interceptDir}</Text>
            <Text style={styles.interceptSub}>along azimuth bearing {capturedData.heading}°</Text>
          </View>

          <Text style={styles.noteText}>
            Assumed Position Base: {fixResult.assumedLat}° N, {fixResult.assumedLon}° E
          </Text>
        </View>

        <TouchableOpacity style={styles.backButton} onPress={() => setAlignmentScreen('camera')}>
          <Text style={styles.backButtonText}>Take Another Sight</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // --- CAMERA SCREEN ---
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" />
      <View style={styles.overlayContainer} pointerEvents="box-none">
        <View style={styles.topBanner}>
          <Text style={styles.bannerText}>
            {`🧭 Azimuth: ${heading}° (${cardinal}) | 📐 Alt: ${pitch > 0 ? `+${pitch}°` : `${pitch}°`}`}
          </Text>
        </View>
        <View style={styles.crosshairContainer}>
          <View style={styles.crosshairH} />
          <View style={styles.crosshairV} />
          <View style={styles.crosshairCenter} />
        </View>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
            <Text style={styles.captureButtonText}>Capture Solar Sight</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1, width: '100%', height: '100%' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  permText: { textAlign: 'center', marginBottom: 15, fontSize: 16, color: '#333' },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 40, paddingHorizontal: 20 },
  topBanner: { backgroundColor: 'rgba(0, 0, 0, 0.75)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0, 255, 102, 0.3)' },
  bannerText: { color: '#00FF66', fontSize: 15, fontWeight: 'bold' },
  crosshairContainer: { width: 60, height: 60, justifyContent: 'center', alignItems: 'center' },
  crosshairH: { position: 'absolute', width: '100%', height: 2, backgroundColor: 'rgba(0, 255, 10, 0.9)' },
  crosshairV: { position: 'absolute', width: 2, height: '100%', backgroundColor: 'rgba(0, 255, 10, 0.9)' },
  crosshairCenter: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#00FF66' },
  footer: { width: '100%', alignItems: 'center' },
  captureButton: { backgroundColor: '#00FF66', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30 },
  captureButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  resultContainer: { flexGrow: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', padding: 20, paddingVertical: 40 },
  resultCard: { backgroundColor: '#1E1E1E', width: '100%', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#333', marginBottom: 20 },
  resultTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  dataLabel: { fontSize: 15, color: '#aaa' },
  dataValue: { fontSize: 15, fontWeight: 'bold', color: '#00FF66' },
  interceptBox: { backgroundColor: '#252525', borderRadius: 12, padding: 16, alignItems: 'center', marginVertical: 20, borderWidth: 1, borderColor: '#00FF66' },
  interceptTitle: { fontSize: 14, color: '#aaa', marginBottom: 5 },
  interceptValue: { fontSize: 22, fontWeight: 'bold', color: '#00FF66' },
  interceptSub: { fontSize: 12, color: '#888', marginTop: 4 },
  noteText: { fontSize: 12, color: '#777', textAlign: 'center', marginTop: 10 },
  backButton: { backgroundColor: '#333', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 25 },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});