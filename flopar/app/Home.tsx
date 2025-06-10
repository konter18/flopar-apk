import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ROUTES } from "../constants/routes";

export default function HomeScreen() {
  const [firstName, setFirstName] = useState<string | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem('userData');
        if (jsonValue) {
          const user = JSON.parse(jsonValue);
          setFirstName(user.first_name || '');
        }
      } catch (error) {
        console.error('Error al obtener el usuario:', error);
      }
    };

    loadUser();
  }, []);

  const handleScan = () => {
    router.push(ROUTES.SCAN)
  };

  const handleGridCheck = () => {
    router.push(ROUTES.GRILLA)
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {firstName ? `¡Bienvenido, ${firstName}!` : '¡Bienvenido!'}
      </Text>
      <TouchableOpacity style={styles.customButton} onPress={handleScan}>
        <Text style={styles.buttonText}>Escanear</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.customButton} onPress={handleGridCheck}>
        <Text style={styles.buttonText}>Revisar Grilla</Text>
      </TouchableOpacity>
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
  title: {
    fontSize: 24,
    marginBottom: 40,
    textAlign: 'center',
  },
  customButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 10,
    width: '70%',
    alignItems: 'center',
  },
  
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
