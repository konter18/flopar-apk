import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function GrillaScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hola, soy la grilla.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: '500',
  },
});
