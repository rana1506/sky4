import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { DeviceMotion } from 'expo-sensors';
import * as Location from 'expo-location';

export default function App() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [headingData, setHeadingData] = useState({ trueHeading: 0, magHeading: 0 });
  const [pitchData, setPitchData] = useState(0);
  const [locationGranted, setLocationGranted] = useState(false);

  const [currentScreen, setCurrentScreen] = useState('camera');
  const [capturedData, setCapturedData] = useState({ heading: 0, pitch: 0, cardinal: 'N' });

  useEffect(() => {
    // 1. Get True Heading & Compass
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationGranted(true);
        await Location.watchHeadingAsync((obj) => {
          setHeadingData({
            trueHeading: Math.round(obj.trueHeading >= 0 ? obj.trueHeading : obj.magHeading),
            magHeading: Math.round(obj.magHeading)
          });
        });
      }
    })();

    // 2. Get Device Motion for True Horizon Pitch (0° Horizon, +90° Zenith, -90° Nadir)
    DeviceMotion.setUpdateInterval(100);
    const motionSubscription = DeviceMotion.addListener((data) => {
      if (data && data.accelerationIncludingGravity) {
        const { x, y, z } = data.accelerationIncludingGravity;
        
        const totalG = Math.sqrt(x * x + y * y + z * z);

        if (totalG > 0) {
          // z represents the axis perpendicular to the screen. 
          // Using arcsin of normalized z gives the angle relative to the horizon plane.
          const sinPitch = z / totalG;
          const pitchRadians = Math.asin(sinPitch);
          const pitchDeg = Math.round(pitchRadians * (180 / Math.PI));
          
          setPitchData(pitchDeg);
        }
      }
    });

    return () => {
      motionSubscription && motionSubscription.remove();
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

  const getCardinalDirection = (heading) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round((heading % 360) / 45) % 8];
  };

  const currentHeading = headingData.trueHeading;
  const cardinal = getCardinalDirection(currentHeading);
  const currentPitch = pitchData;

  const handleCapture = () => {
    setCapturedData({ 
      heading: currentHeading, 
      pitch: currentPitch, 
      cardinal 
    });
    setCurrentScreen('result');
  };

  // --- RESULT SCREEN ---
  if (currentScreen === 'result') {
    return (
      <View style={styles.resultContainer}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>🎯 Target Captured</Text>
          
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

  // --- CAMERA SCREEN ---
  return (
    <View style={styles.container}>
      {/* 1. Background Camera View */}
      <CameraView style={styles.camera} facing="back" />

      {/* 2. Foreground UI Overlay */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        
        {/* Top Banner showing live angles */}
        <View style={styles.topBanner}>
          <Text style={styles.bannerText}>
            {locationGranted ? `🧭 ${currentHeading}° (${cardinal}) | 📐 ${currentPitch > 0 ? `+${currentPitch}°` : `${currentPitch}°`}` : "Waiting for compass lock..."}
          </Text>
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
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  topBanner: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.3)',
  },
  bannerText: {
    color: '#00FF66',
    fontSize: 15,
    fontWeight: 'bold',
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
    backgroundColor: 'rgba(0, 255, 10, 0.9)',
  },
  crosshairV: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(0, 255, 10, 0.9)',
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