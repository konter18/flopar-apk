import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  Modal,
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
  status_p: string;
}

type ProductCardProps = {
  item: Product;
};

const ProductCard = React.memo(
  ({ item, onPress }: ProductCardProps & { onPress: (id: number) => void }) => (
    <TouchableOpacity onPress={() => onPress(item.id)} activeOpacity={0.8}>
      <View style={styles.card}>
        <Text style={styles.productName}>Nombre: {item.name}</Text>
        <Text>Código: {item.code}</Text>
        <Text>Patente: {item.patent}</Text>
        <Text>
          Estado:{" "}
          <Text
            style={{ color: item.status_p === "Verificado" ? "green" : "red" }}
          >
            {item.status_p}
          </Text>
        </Text>
      </View>
    </TouchableOpacity>
  )
);

export default function ScanScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [patente, setPatente] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  //modal manual
  const [manualModal, setManualModal] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  //modal producto detalles
  const [detailModal, setDetailModal] = useState(false);
  const [productDetail, setProductDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const router = useRouter();

  // ----------- Cargar productos
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
      setFiltered(productos);
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

  // ------------- LOGOUT
  const handleLogout = async () => {
    setShowMenu(false);
    await AsyncStorage.clear();
    router.replace(ROUTES.LOGIN);
  };

  // ------------- FILTRO LOCAL
  const handleSearch = (text: string) => {
    setSearch(text);
    if (text.trim() === "") {
      setFiltered(products);
    } else {
      const s = text.toLowerCase();
      setFiltered(
        products.filter(
          (prod) =>
            prod.name.toLowerCase().includes(s) ||
            prod.code.toLowerCase().includes(s)
        )
      );
    }
  };

  // ------------- CUADRATURA
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
      const detail = err?.response?.data?.detail;
      let mensaje = "Aún tienes productos pendientes por verificar.";

      if (
        detail &&
        typeof detail === "object" &&
        Array.isArray(detail.pending_products)
      ) {
        const pendientes = detail.pending_products
          .map((prod: any) => `${prod.code}`)
          .join(", ");
        mensaje = `Productos pendientes de verificación:\n${pendientes}`;
      } else if (
        typeof detail === "string" &&
        detail.includes("verificación")
      ) {
        mensaje = detail;
      }
      Alert.alert("No puedes confirmar aún", mensaje);
    }
  };

  // ------------- ESCANEO MANUAL
  const handleManualScan = async () => {
    setManualLoading(true);
    try {
      const code = manualCode.trim();
      if (!code) {
        Alert.alert("Código vacío", "Ingresa el código del producto");
        setManualLoading(false);
        return;
      }
      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) throw new Error("No hay usuario autenticado");
      const userData = JSON.parse(userDataString);
      const userId = userData.user_id;
      const { data: batchId } = await axios.get(ENDPOINTS.LAST_BATCH);
      const res = await axios.get(
        ENDPOINTS.GET_PRODUCTS_FILTERED(code, batchId)
      );
      if (!res.data || res.data.length === 0) {
        Alert.alert(
          "Producto no encontrado",
          `No existe producto con código: ${code}`
        );
        setManualLoading(false);
        return;
      }
      const product = res.data[0];
      const patchPayload = {
        status_p: "Verificado",
        verified_by_p: userId,
        verified_at_p: new Date().toISOString(),
      };
      await axios.patch(ENDPOINTS.PATCH_PRODUCT(product.id), patchPayload, {
        headers: {
          Authorization: `Bearer ${userData.access_token}`,
        },
      });

      Alert.alert(
        "¡Producto verificado!",
        `Producto: ${product.name}\nCódigo: ${product.code}`
      );
      setManualModal(false);
      setManualCode("");
      fetchProductos(); // Actualiza la lista
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.detail || "No se pudo verificar el producto"
      );
    } finally {
      setManualLoading(false);
    }
  };
  // Handler para mostrar detalle del producto
  const handleOpenDetail = async (productId: number) => {
    setLoadingDetail(true);
    setDetailModal(true);
    try {
      const { data } = await axios.get(ENDPOINTS.GET_PRODUCT_DETAIL(productId));
      setProductDetail(data);
    } catch (error) {
      Alert.alert("Error", "No se pudo cargar el detalle del producto");
      setProductDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };
  // ---- RENDER
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
            ? `Patente asignada: ${patente}`
            : "Cargando patente..."}
        </Text>
        {/* Botones de escaneo y confirmación */}
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
        {/* Barra búsqueda + botón escaneo manual */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar producto"
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setManualModal(true)}
          >
            <MaterialIcons name="edit" size={22} color="#2196F3" />
            <Text style={styles.manualButtonText}>Escaneo manual</Text>
          </TouchableOpacity>
        </View>
        {/* Modal escaneo manual */}
        <Modal
          visible={manualModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setManualModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text
                style={{ fontWeight: "bold", fontSize: 18, marginBottom: 12 }}
              >
                Ingresar código manualmente
              </Text>
              <TextInput
                style={styles.manualInput}
                placeholder="Código del producto"
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="none"
                autoFocus
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={styles.manualSendButton}
                  onPress={handleManualScan}
                  disabled={manualLoading}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>
                    {manualLoading ? "Verificando..." : "Verificar"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.manualSendButton, { backgroundColor: "#ddd" }]}
                  onPress={() => setManualModal(false)}
                  disabled={manualLoading}
                >
                  <Text style={{ color: "#333", fontWeight: "bold" }}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* Modal de detalle del producto: */}
        <Modal
          visible={detailModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setDetailModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {loadingDetail ? (
                <ActivityIndicator size="large" color="#2196F3" />
              ) : productDetail ? (
                <>
                  <Text
                    style={{
                      fontWeight: "bold",
                      fontSize: 18,
                      marginBottom: 8,
                    }}
                  >
                    Detalle del Producto
                  </Text>
                  <Text>Nombre: {productDetail.name}</Text>
                  <Text>Código: {productDetail.code}</Text>
                  <Text>Patente: {productDetail.patent}</Text>
                  <Text>Estado: {productDetail.status_p}</Text>
                  <Text>Cliente: {productDetail.name_client}</Text>
                  <Text>Teléfono: {productDetail.phone_client}</Text>
                  {/* Aquí puedes agregar más campos que te entregue tu API */}
                  <TouchableOpacity
                    style={[styles.manualSendButton, { marginTop: 12 }]}
                    onPress={() => setDetailModal(false)}
                  >
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      Cerrar
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text>No hay detalles disponibles.</Text>
              )}
            </View>
          </View>
        </Modal>
        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" />
        ) : filtered.length === 0 ? (
          <Text style={styles.text}>No hay productos para hoy..</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 30 }}
            renderItem={({ item }) => (
              <ProductCard item={item} onPress={handleOpenDetail} />
            )}
            initialNumToRender={10}
            windowSize={7}
            removeClippedSubviews={true}
          />
        )}
      </View>
    </View>
  );
}
const ACTION_HEIGHT = 54;
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
    marginBottom: 15,
    gap: 10,
  },
  scanButton: {
    backgroundColor: "#2196F3",
    height: ACTION_HEIGHT,
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
    height: ACTION_HEIGHT,
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderColor: "#bbb",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    height: ACTION_HEIGHT,
  },
  manualButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eaf3fa",
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: "#2196F3",
    paddingHorizontal: 12,
    height: ACTION_HEIGHT,
    justifyContent: "center",
    minWidth: 150,
  },
  manualButtonText: {
    color: "#2196F3",
    fontWeight: "bold",
    marginLeft: 5,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 12,
    width: "90%",
    alignItems: "center",
    elevation: 8,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    width: "100%",
    marginBottom: 8,
    backgroundColor: "#f5f5f5",
  },
  manualSendButton: {
    backgroundColor: "#2196F3",
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 22,
    alignItems: "center",
    marginHorizontal: 2,
  },
});
