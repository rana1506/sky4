import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { DeviceMotion, Magnetometer } from 'expo-sensors';

export default function App() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [currentScreen, setCurrentScreen] = useState('camera');
  const [capturedData, setCapturedData] = useState({ heading: 0, pitch: 0, cardinal: 'N' });

  useEffect(() => {
    DeviceMotion.setUpdateInterval(100);
    Magnetometer.setUpdateInterval(100);

    let latestAccel = { x: 0, y: 0, z: 9.8 };

    // 1. Process DeviceMotion for Pitch and baseline gravity orientation
    const motionSub = DeviceMotion.addListener((data) => {
      if (data && data.accelerationIncludingGravity) {
        latestAccel = data.accelerationIncludingGravity;
        const { x, y, z } = latestAccel;

        // Roll-immune pitch calculation
        const horizontalMag = Math.sqrt(x * x + z * z);
        const pitchRadians = Math.atan2(-y, horizontalMag);
        const pitchDeg = Math.round(pitchRadians * (180 / Math.PI));
        setPitch(pitchDeg);
      }
    });

    // 2. Process Magnetometer combined with Accel for 3D Tilt-Compensated Azimuth
    const magSub = Magnetometer.addListener((magData) => {
      const { x: ax, y: ay, z: az } = latestAccel;
      const { x: mx, y: my, z: mz } = magData;

      // Normalize gravity vector
      const normA = Math.sqrt(ax * ax + ay * ay + az * az);
      if (normA === 0) return;
      const gX = ax / normA;
      const gY = ay / normA;
      const gZ = az / normA;

      // East vector = Magnetic cross Gravity
      const eX = my * gZ - mz * gY;
      const eY = mz * gX - mx * gZ;
      const eZ = mx * gY - my * gX;
      const normE = Math.sqrt(eX * eX + eY * eY + eZ * eZ);
      if (normE === 0) return;
      const nE_x = eX / normE;
      const nE_y = eY / normE;
      const nE_z = eZ / normE;

      // North vector = East cross Gravity
      const nN_x = nE_y * gZ - nE_z * gY;
      const nN_y = nE_z * gX - nE_x * gZ;
      const nN_z = nE_x * gY - nE_y * gX;

      // Calculate Azimuth heading angle
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

  const handleCapture = () => {
    setCapturedData({ heading, pitch, cardinal });
    setCurrentScreen('result');
  };

  if (currentScreen === 'result') {
    return (
      <View style={styles.resultContainer}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>🎯 Target Captured (Option 2)</Text>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Bearing (Heading):</Text>
            <Text style={styles.dataValue}>{capturedData.heading}° ({capturedData.cardinal})</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Altitude (Vertical Tilt):</Text>
            <Text style={styles.dataValue}>{capturedData.pitch > 0 ? `+${capturedData.pitch}°` : `${capturedData.pitch}°`}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('camera')}>
          <Text style={styles.backButtonText}>Aim at Another Object</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" />
      <View style={styles.overlayContainer} pointerEvents="box-none">
        <View style={styles.topBanner}>
          <Text style={styles.bannerText}>
            {`🧭 ${heading}° (${cardinal}) | 📐 ${pitch > 0 ? `+${pitch}°` : `${pitch}°`}`}
          </Text>
        </View>
        <View style={styles.crosshairContainer}>
          <View style={styles.crosshairH} />
          <View style={styles.crosshairV} />
          <View style={styles.crosshairCenter} />
        </View>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
            <Text style={styles.captureButtonText}>Capture Angles</Text>
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
  resultContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultCard: { backgroundColor: '#1E1E1E', width: '100%', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#333', marginBottom: 30 },
  resultTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  dataLabel: { fontSize: 16, color: '#aaa' },
  dataValue: { fontSize: 16, fontWeight: 'bold', color: '#00FF66' },
  backButton: { backgroundColor: '#333', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 25 },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});