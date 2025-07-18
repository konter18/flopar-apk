import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { ENDPOINTS } from "../constants/endpoints";
import CustomHeader from "./components/CustomHeader";
import { ROUTES } from "../constants/routes";
import { MaterialIcons } from "@expo/vector-icons";

interface Product {
  id: number;
  name: string;
  code: string;
  patent: string;
  status: string;
}

type ProductCardProps = {
  item: Product;
};

const ProductCard = React.memo(({ item }: ProductCardProps) => (
  <View style={styles.card}>
    <Text style={styles.productName}>Nombre: {item.name}</Text>
    <Text>Código: {item.code}</Text>
    <Text>Patente: {item.patent}</Text>
    <Text>
      Estado:{" "}
      <Text style={{ color: item.status === "Verificado" ? "green" : "red" }}>
        {item.status}
      </Text>
    </Text>
  </View>
));

export default function ScanScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [patente, setPatente] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  const fetchProductos = useCallback(async () => {
    try {
      setLoading(true);
      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) throw new Error("No hay usuario autenticado");
      const userData = JSON.parse(userDataString);
      const userPatente = userData.patent;
      setPatente(userPatente);
      const { data: batchId } = await axios.get(ENDPOINTS.LAST_BATCH);
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProductos();
    }, [fetchProductos])
  );

  const handleLogout = async () => {
    setShowMenu(false);
    await AsyncStorage.clear();
    router.replace(ROUTES.LOGIN);
  };

  // ---- Nuevo handler que asegura patente de usuario autenticado ----
  const handleConfirmQuadrature = async () => {
    try {
      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) throw new Error("No hay usuario autenticado");
      const userData = JSON.parse(userDataString);
      const userPatente = userData.patent;

      await axios.post(ENDPOINTS.CONFIRM_QUADRATURE(userPatente));
      Alert.alert(
        "¡Cuadratura confirmada!",
        "Todos los productos están verificados. Puedes salir de bodega."
      );
    } catch (err: any) {
      // Comienza chequeando si tienes productos pendientes en el detail
      const detail = err?.response?.data?.detail;
      let mensaje = "Aún tienes productos pendientes por verificar.";

      // Si detail es un objeto y tiene pending_products (la versión más útil)
      if (
        detail &&
        typeof detail === "object" &&
        Array.isArray(detail.pending_products)
      ) {
        const pendientes = detail.pending_products
          .map((prod: any) => `${prod.code} (${prod.name})`)
          .join(", ");
        mensaje = `Productos pendientes de verificación:\n${pendientes}`;
      }
      // Si detail es un string que contiene los códigos (como en la versión solo arreglo)
      else if (typeof detail === "string" && detail.includes("verificación")) {
        mensaje = detail;
      }
      Alert.alert("No puedes confirmar aún", mensaje);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <CustomHeader title="Pioneta" onAvatarPress={() => setShowMenu(true)} />
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

        {/* Botones en fila, ahora ambos son del mismo alto y estilo */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => {
              router.push("/ScanProduct");
            }}
          >
            <Text style={styles.scanButtonText}>Escanear producto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmQuadrature}
          >
            <MaterialIcons name="check" size={26} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirmar</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" />
        ) : products.length === 0 ? (
          <Text style={styles.text}>No hay productos para hoy..</Text>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 30 }}
            renderItem={({ item }) => <ProductCard item={item} />}
            initialNumToRender={10}
            windowSize={7}
            removeClippedSubviews={true}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
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
    top: 55,
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
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 10,
  },
  scanButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 170,
    marginRight: 10,
    flexDirection: "row",
    flex: 1,
  },
  scanButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  confirmButton: {
    backgroundColor: "#24c96b",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 110,
    flexDirection: "row",
    flex: 0.8,
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 5,
  },
});
