import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Magnetometer, Accelerometer } from 'expo-sensors';

export default function App() {
  // Magnetometer raw data (microteslas)
  const [magnetometerData, setMagnetometerData] = useState({ x: 0, y: 0, z: 0 });
  // Accelerometer data (g-force) for tilt
  const [accelerometerData, setAccelerometerData] = useState({ x: 0, y: 0, z: 0 });
  
  const [subscriptionMag, setSubscriptionMag] = useState(null);
  const [subscriptionAcc, setSubscriptionAcc] = useState(null);

  // Toggle sensors on and off
  useEffect(() => {
    // 1. Subscribe to Magnetometer
    Magnetometer.setUpdateInterval(100); // update every 100ms
    setSubscriptionMag(
      Magnetometer.addListener(result => {
        setMagnetometerData(result);
      })
    );

    // 2. Subscribe to Accelerometer (for tilt)
    Accelerometer.setUpdateInterval(100);
    setSubscriptionAcc(
      Accelerometer.addListener(result => {
        setAccelerometerData(result);
      })
    );

    return () => {
      subscriptionMag && subscriptionMag.remove();
      subscriptionAcc && subscriptionAcc.remove();
    };
  }, []);

  // Calculate Compass Heading (0 to 360 degrees) from magnetometer X and Y
  const getCompassHeading = (x, y) => {
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    if (angle < 0) {
      angle += 360;
    }
    return Math.round(angle);
  };

  // Convert degrees to cardinal direction (N, NE, E, etc.)
  const getCardinalDirection = (heading) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round((heading % 360) / 45);
    return directions[index % 8];
  };

  // Calculate Tilt (Pitch & Roll) using accelerometer data
  const getTiltAngles = (x, y, z) => {
    const pitch = Math.atan2(-x, Math.sqrt(y * y + z * z)) * (180 / Math.PI);
    const roll = Math.atan2(y, z) * (180 / Math.PI);
    return {
      pitch: pitch.toFixed(1),
      roll: roll.toFixed(1),
    };
  };

  const { x: mx, y: my, z: mz } = magnetometerData;
  const { x: ax, y: ay, z: az } = accelerometerData;

  const heading = getCompassHeading(mx, my);
  const cardinal = getCardinalDirection(heading);
  const { pitch, roll } = getTiltAngles(ax, ay, az);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>iPhone Sensor Dashboard</Text>

      {/* Compass Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧭 Compass Direction</Text>
        <Text style={styles.bigValue}>{heading}° {cardinal}</Text>
      </View>

      {/* Tilt Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📐 Tilt & Orientation</Text>
        <Text style={styles.text}>Pitch (Up/Down): {pitch}°</Text>
        <Text style={styles.text}>Roll (Left/Right): {roll}°</Text>
      </View>

      {/* Magnetometer Raw Data */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧲 Magnetometer (μT)</Text>
        <Text style={styles.text}>X: {mx.toFixed(2)}</Text>
        <Text style={styles.text}>Y: {my.toFixed(2)}</Text>
        <Text style={styles.text}>Z: {mz.toFixed(2)}</Text>
      </View>

      {/* Accelerometer Raw Data */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📱 Accelerometer (G-force)</Text>
        <Text style={styles.text}>X: {ax.toFixed(2)}</Text>
        <Text style={styles.text}>Y: {ay.toFixed(2)}</Text>
        <Text style={styles.text}>Z: {az.toFixed(2)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  bigValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  text: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
});