import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { ENDPOINTS } from '../constants/endpoints';

interface Product {
  id: number;
  name: string;
  code: string;
  patent: string;
}

export default function ScanScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [patente, setPatente] = useState<string | null>(null);

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        setLoading(true);

        // Obtener usuario desde AsyncStorage
        const userDataString = await AsyncStorage.getItem('userData');
        if (!userDataString) throw new Error('No hay usuario autenticado');

        const userData = JSON.parse(userDataString);
        const userPatente = userData.patent;
        setPatente(userPatente);

        // Obtener batch ID
        const { data: batchId } = await axios.get(ENDPOINTS.LAST_BATCH);

        // Obtener productos filtrados por batch y patente
        const { data: productos } = await axios.get(ENDPOINTS.GET_PRODUCT, {
          params: {
            product_batch_id: batchId,
            patent: userPatente,
          },
        });

        setProducts(productos);
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'No se pudieron cargar los productos.');
      } finally {
        setLoading(false);
      }
    };

    fetchProductos();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {patente ? `Trabajando con patente: ${patente}` : 'Cargando patente...'}
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" />
      ) : products.length === 0 ? (
        <Text style={styles.text}>No hay productos para hoy.</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingTop: 10 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.productName}>Nombre: {item.name}</Text>
              <Text>Código: {item.code}</Text>
              <Text>Patente: {item.patent}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  text: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  productName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});
