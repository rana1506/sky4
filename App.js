import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Magnetometer, Accelerometer } from 'expo-sensors';

export default function App() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  const [magnetometerData, setMagnetometerData] = useState({ x: 0, y: 0, z: 0 });
  const [accelerometerData, setAccelerometerData] = useState({ x: 0, y: 0, z: 0 });

  const [currentScreen, setCurrentScreen] = useState('camera');
  const [capturedData, setCapturedData] = useState({ heading: 0, pitch: 0, cardinal: 'N' });

  useEffect(() => {
    Magnetometer.setUpdateInterval(100);
    Accelerometer.setUpdateInterval(100);

    const magSubscription = Magnetometer.addListener(setMagnetometerData);
    const accSubscription = Accelerometer.addListener(setAccelerometerData);

    return () => {
      magSubscription && magSubscription.remove();
      accSubscription && accSubscription.remove();
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

  const getCompassHeading = (mx, my) => {
    let angle = Math.atan2(my, mx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return Math.round(angle);
  };

  const getVerticalTilt = (az) => {
    let angle = Math.asin(Math.max(-1, Math.min(1, az))) * (180 / Math.PI);
    return Math.round(angle);
  };

  const getCardinalDirection = (heading) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round((heading % 360) / 45) % 8];
  };

  const { x: mx, y: my } = magnetometerData;
  const { z: az } = accelerometerData;

  const heading = getCompassHeading(mx, my);
  const pitch = getVerticalTilt(az);
  const cardinal = getCardinalDirection(heading);

  const handleCapture = () => {
    setCapturedData({ heading, pitch, cardinal });
    setCurrentScreen('result');
  };

  // --- RESULT SCREEN ---
  if (currentScreen === 'result') {
    return (
      <View style={styles.resultContainer}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>🎯 Target Captured</Text>
          
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Compass Heading:</Text>
            <Text style={styles.dataValue}>{capturedData.heading}° ({capturedData.cardinal})</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Vertical Tilt:</Text>
            <Text style={styles.dataValue}>{capturedData.pitch > 0 ? `+${capturedData.pitch}°` : `${capturedData.pitch}°`}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('camera')}>
          <Text style={styles.backButtonText}>Aim at Another Object</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- CAMERA SCREEN ---
  return (
    <View style={styles.container}>
      {/* 1. Background Camera View fills the container completely */}
      <CameraView style={styles.camera} facing="back" />

      {/* 2. Foreground UI Overlay positioned strictly on top */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        
        {/* Top Banner */}
        <View style={styles.topBanner}>
          <Text style={styles.bannerText}>Center crosshair on your target</Text>
        </View>

        {/* Center Target Crosshair */}
        <View style={styles.crosshairContainer}>
          <View style={styles.crosshairH} />
          <View style={styles.crosshairV} />
          <View style={styles.crosshairCenter} />
        </View>

        {/* Bottom Capture Button */}
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
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  permText: {
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60, // Clears the iPhone notch/island safely
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  topBanner: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  crosshairContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(0, 255, 102, 0.9)',
  },
  crosshairV: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(0, 255, 102, 0.9)',
  },
  crosshairCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#00FF66',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: '#00FF66',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  captureButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Result Screen Styles
  resultContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultCard: {
    backgroundColor: '#1E1E1E',
    width: '100%',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 30,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  dataLabel: {
    fontSize: 16,
    color: '#aaa',
  },
  dataValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00FF66',
  },
  backButton: {
    backgroundColor: '#333',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});