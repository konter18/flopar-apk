import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { ENDPOINTS } from "../constants/endpoints";
import CustomHeader from "./components/CustomHeader";
import { ROUTES } from "../constants/routes";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native";

interface Product {
  id: number;
  name: string;
  code: string;
  patent: string;
  status: string;
}

export default function ScanScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [patente, setPatente] = useState<string | null>(null);
  // Router para navegación
  const router = useRouter();
  // Estado para mostrar/ocultar menú de cerrar sesión
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    setShowMenu(false); // Cierra menú
    await AsyncStorage.clear();
    router.replace(ROUTES.LOGIN);
  };

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        setLoading(true);

        // Obtener usuario desde AsyncStorage
        const userDataString = await AsyncStorage.getItem("userData");
        if (!userDataString) throw new Error("No hay usuario autenticado");

        const userData = JSON.parse(userDataString);
        const userPatente = userData.patent;
        setPatente(userPatente);

        // Obtener batch ID
        const { data: batchId } = await axios.get(ENDPOINTS.LAST_BATCH);

        // Obtener productos filtrados por batch y patente
        const { data: productos } = await axios.get(ENDPOINTS.GET_PRODUCT, {
          params: {
            batch_id: batchId,
            patent: userPatente,
          },
        });

        setProducts(productos);
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "No se pudieron cargar los productos.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductos();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* HEADER */}
      <CustomHeader title="Pioneta" onAvatarPress={() => setShowMenu(true)} />
      
      {/* MENU DESPLEGABLE */}
      {showMenu && (
        <TouchableOpacity
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
          activeOpacity={1}
        >
          <View style={styles.dropdownMenu}>
            <TouchableOpacity onPress={handleLogout} style={styles.menuItem}>
              <MaterialIcons name="logout" size={20} color="#333" />
              <Text style={styles.menuText}>Salir</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
      <View style={styles.container}>
        <Text style={styles.text}>
          {patente
            ? `Trabajando con patente: ${patente}`
            : "Cargando patente..."}
        </Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => {
            router.push("/ScanProduct");
          }}
        >
          <Text style={styles.scanButtonText}>Escanear producto</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" />
        ) : products.length === 0 ? (
          <Text style={styles.text}>No hay productos para hoy..</Text>
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
                <Text>
                  Estado:{" "}
                  <Text
                    style={{
                      color: item.status === "Verificado" ? "green" : "red",
                    }}
                  >
                    {item.status}
                  </Text>
                </Text>
              </View>
            )}
          />
        )}
      </View>
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
    fontWeight: "500",
    marginBottom: 10,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  productName: {
    fontWeight: "bold",
    fontSize: 16,
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.1)",
    zIndex: 999,
  },
  dropdownMenu: {
    position: "absolute",
    top: 55, // debajo del header
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    minWidth: 120,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 8,
    color: "#333",
  },
  scanButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
    marginHorizontal: 10,
  },
  scanButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
});
