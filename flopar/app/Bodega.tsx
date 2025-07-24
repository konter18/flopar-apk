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
import CustomHeader from "./components/CustomHeader";
import { ROUTES } from "../constants/routes";
import { ENDPOINTS } from "../constants/endpoints";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import api from "../utils/api";
import { AxiosError } from "axios";

interface Product {
  id: number;
  name: string;
  code: string;
  patent: string;
  status_b: string;
}
interface ProductDetail extends Product {
  name_client: string;
  phone_client: string;
}

type ProductCardProps = {
  item: Product;
  onPress: (id: number) => void;
};

const ProductCard = React.memo(({ item, onPress }: ProductCardProps) => (
  <TouchableOpacity onPress={() => onPress(item.id)} activeOpacity={0.8}>
    <View style={styles.card}>
      <Text style={styles.productName}>Nombre: {item.name}</Text>
      <Text>Código: {item.code}</Text>
      <Text>Patente: {item.patent}</Text>
      <Text>
        Estado:{" "}
        <Text
          style={{ color: item.status_b === "Verificado" ? "green" : "red" }}
        >
          {item.status_b}
        </Text>
      </Text>
    </View>
  </TouchableOpacity>
));

export default function BodegaScreen() {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState<string>("");
  const [manualModal, setManualModal] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(
    null
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [batchId, setBatchId] = useState<number>(0);
  //constate para filtrar pendientes
  const [showOnlyPending, setShowOnlyPending] = useState<boolean>(false);

  // ---------- LOGOUT
  const handleLogout = async () => {
    setShowMenu(false);
    await AsyncStorage.clear();
    router.replace(ROUTES.LOGIN);
  };

  // ---------- CARGAR PRODUCTOS (todos los del batch)
  const fetchProductos = useCallback(async () => {
    try {
      setLoading(true);
      const { data: batchId } = await api.get(ENDPOINTS.LAST_BATCH);
      setBatchId(batchId);
      const { data: productos } = await api.get(ENDPOINTS.GET_PRODUCT, {
        params: {
          batch_id: batchId,
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

  // ---------- BÚSQUEDA LOCAL
  const handleSearch = (text: string) => {
    setSearch(text);
    const searchText = text.toLowerCase();

    const baseList = showOnlyPending
      ? products.filter((p: Product) => p.status_b !== "Verificado")
      : products;

    if (searchText.trim() === "") {
      setFiltered(baseList);
    } else {
      setFiltered(
        baseList.filter(
          (prod) =>
            prod.name.toLowerCase().includes(searchText) ||
            prod.code.toLowerCase().includes(searchText)
        )
      );
    }
  };
  //filter para mostrar solo pendientes
  React.useEffect(() => {
    const searchText = search.toLowerCase();

    const baseList = showOnlyPending
      ? products.filter((p: Product) => p.status_b !== "Verificado")
      : products;

    if (searchText.trim() === "") {
      setFiltered(baseList);
    } else {
      setFiltered(
        baseList.filter(
          (prod) =>
            prod.name.toLowerCase().includes(searchText) ||
            prod.code.toLowerCase().includes(searchText)
        )
      );
    }
  }, [showOnlyPending, search, products]);

  // ---------- ESCANEO MANUAL
  const handleManualScan = async () => {
    setManualLoading(true);
    try {
      const code = manualCode.trim();
      if (!code) {
        Alert.alert("Código vacío", "Ingresa el código del producto");
        return setManualLoading(false);
      }

      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) throw new Error("No hay usuario autenticado");

      const userData = JSON.parse(userDataString);
      const userId = userData.user_id;
      const role = userData.role;

      const { data: batchId } = await api.get(ENDPOINTS.LAST_BATCH);
      const res = await api.get<Product[]>(
        ENDPOINTS.GET_PRODUCTS_FILTERED(code, batchId)
      );

      if (!res.data.length) {
        Alert.alert(
          "Producto no encontrado",
          `No existe producto con código: ${code}`
        );
        return setManualLoading(false);
      }

      const product = res.data[0];
      const now = new Date().toISOString();

      // payload según rol
      let patchPayload: any = {};
      if (role === "pioneta") {
        patchPayload = {
          status_p: "Verificado",
          verified_by_p: userId,
          verified_at_p: now,
        };
      } else if (role === "bodega") {
        patchPayload = {
          status_b: "Verificado",
          verified_by_b: userId,
          verified_at_b: now,
        };
      } else {
        throw new Error("Rol no autorizado para escaneo manual");
      }

      await api.patch(ENDPOINTS.PATCH_PRODUCT(product.id), patchPayload);

      Alert.alert(
        "¡Producto verificado!",
        `Producto: ${product.name}\nCódigo: ${product.code}`
      );
      setManualModal(false);
      setManualCode("");
      fetchProductos(); // refresca la lista
    } catch (err: any) {
      const axiosErr = err as AxiosError<{ detail: string }>;
      Alert.alert(
        "Error",
        axiosErr.response?.data?.detail || "No se pudo verificar el producto"
      );
    } finally {
      setManualLoading(false);
    }
  };

  // ---------- DETALLE DE PRODUCTO
  const handleOpenDetail = async (productId: number) => {
    setLoadingDetail(true);
    setDetailModal(true);
    try {
      const { data } = await api.get<ProductDetail>(
        ENDPOINTS.GET_PRODUCT_DETAIL(productId)
      );
      setProductDetail(data);
    } catch {
      Alert.alert("Error", "No se pudo cargar el detalle del producto");
      setProductDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // ---------- RENDER
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <CustomHeader title="Bodega" onAvatarPress={() => setShowMenu(true)} />
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
        {/* Botones escaneo y confirmación */}
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
            style={styles.filterButton}
            onPress={() => setShowOnlyPending(!showOnlyPending)}
          >
            <MaterialIcons
              name={showOnlyPending ? "filter-list-off" : "filter-list"}
              size={22}
              color="#2196F3"
            />
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
        {/* Modal de detalle del producto */}
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
                  <Text>Estado: {productDetail.status_b}</Text>
                  <Text>Cliente: {productDetail.name_client}</Text>
                  <Text>Teléfono: {productDetail.phone_client}</Text>
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
  filterButton: {
    height: ACTION_HEIGHT,
    width: ACTION_HEIGHT,
    backgroundColor: "#eaf3fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2196F3",
    alignItems: "center",
    justifyContent: "center",
  },
});
