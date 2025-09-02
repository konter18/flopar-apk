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
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import CustomHeader from "./components/CustomHeader";
import { ROUTES } from "../constants/routes";
import { ENDPOINTS } from "../constants/endpoints";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import api from "../utils/api";

// ✅ modales reutilizables
import AppModal from "./components/AppModal";
import AppModalCard from "./components/AppModalCard";

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
  address: string;
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

  // manual
  const [manualModal, setManualModal] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // detalle
  const [detailModal, setDetailModal] = useState(false);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(
    null
  );
  const [loadingDetail, setLoadingDetail] = useState(false);

  // selección múltiple
  const [selectModal, setSelectModal] = useState(false);
  const [selectResults, setSelectResults] = useState<Product[]>([]);
  const [selectLoading, setSelectLoading] = useState(false);

  // batch/filtros
  const [batchId, setBatchId] = useState<number>(0);
  const [showOnlyPending, setShowOnlyPending] = useState<boolean>(false);

  // refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProductos();
    setRefreshing(false);
  };

  // ✅ modal de éxito (mensaje bonito en vez de Alert.alert)
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleLogout = async () => {
    setShowMenu(false);
    await AsyncStorage.clear();
    router.replace(ROUTES.LOGIN);
  };

  async function verifyProductBodega(product: Product) {
    if ((product.status_b || "").toLowerCase() === "verificado") {
      Alert.alert("Producto ya verificado", `Folio: ${product.code}`);
      return;
    }

    const userDataString = await AsyncStorage.getItem("userData");
    if (!userDataString) throw new Error("No hay usuario autenticado");
    const user = JSON.parse(userDataString);
    const userId = user.user_id;

    const patchPayload = {
      status_b: "Verificado",
      verified_by_b: userId,
      verified_at_b: new Date().toISOString(),
    };

    await api.patch(ENDPOINTS.PATCH_PRODUCT(product.id), patchPayload);

    // modal de éxito
    setSuccessMsg(`Producto: ${product.name}\nCódigo: ${product.code}`);
    setSuccessOpen(true);

    setManualModal(false);
    setManualCode("");
    await fetchProductos();
  }

  const fetchProductos = useCallback(async () => {
    try {
      setLoading(true);
      const { data: lastBatch } = await api.get(ENDPOINTS.LAST_BATCH);
      setBatchId(lastBatch);
      const { data: productos } = await api.get(ENDPOINTS.GET_PRODUCT, {
        params: { batch_id: lastBatch },
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

  // búsqueda + pendiente
  const applyFilters = useCallback((base: Product[], text: string) => {
    const s = text.toLowerCase().trim();
    if (!s) return base;
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s)
    );
  }, []);

  const handleSearch = (text: string) => {
    setSearch(text);
    const base = showOnlyPending
      ? products.filter((p) => p.status_b !== "Verificado")
      : products;
    setFiltered(applyFilters(base, text));
  };

  React.useEffect(() => {
    const base = showOnlyPending
      ? products.filter((p) => p.status_b !== "Verificado")
      : products;
    setFiltered(applyFilters(base, search));
  }, [showOnlyPending, search, products, applyFilters]);

  // escaneo manual
  const handleManualScan = async () => {
    setManualLoading(true);
    try {
      const code = manualCode.trim();
      if (!code) {
        Alert.alert("Código vacío", "Ingresa el código del producto");
        return;
      }

      const { data: lastBatch } = await api.get(ENDPOINTS.LAST_BATCH);
      const res = await api.get<Product[]>(
        ENDPOINTS.GET_PRODUCTS_FILTERED(code, lastBatch)
      );
      const resultados = res.data ?? [];

      if (resultados.length === 0) {
        Alert.alert(
          "Producto no encontrado",
          `No existe producto con código: ${code}`
        );
        return;
      }
      
      const pendientes = resultados.filter(
        (p) => (p.status_b || "").toLowerCase() !== "verificado"
      );

      if (pendientes.length === 0) {
        Alert.alert(
          "Ya verificado",
          "El/los producto(s) encontrado(s) ya fueron verificados."
        );
        return;
      }

      if (pendientes.length === 1) {
        await verifyProductBodega(pendientes[0]);
        return;
      }

      setSelectResults(pendientes);
      setManualModal(false);
      setSelectModal(true);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.detail || "No se pudo verificar el producto"
      );
    } finally {
      setManualLoading(false);
    }
  };

  // detalle
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
        {/* acciones */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push("/ScanProduct")}
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

        {/* búsqueda + escaneo manual */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar producto"
            placeholderTextColor="#111827"
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

        {/* ----- MODAL: escaneo manual ----- */}
        <AppModalCard
          visible={manualModal}
          onRequestClose={() => setManualModal(false)}
        >
          <Text
            style={{
              fontWeight: "bold",
              fontSize: 18,
              marginBottom: 12,
              color: "#000",
            }}
          >
            Ingresar código manualmente
          </Text>
          <TextInput
            style={styles.manualInput}
            placeholder="Código del producto"
            placeholderTextColor="#000"
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
        </AppModalCard>

        {/* ----- MODAL: detalle producto ----- */}
        <AppModalCard
          visible={detailModal}
          onRequestClose={() => setDetailModal(false)}
        >
          {loadingDetail ? (
            <ActivityIndicator size="large" color="#2196F3" />
          ) : productDetail ? (
            <>
              <Text
                style={{ fontWeight: "bold", fontSize: 18, marginBottom: 8 }}
              >
                Detalle del Producto
              </Text>
              <Text>Código: {productDetail.code}</Text>
              <Text>Nombre: {productDetail.name}</Text>
              <Text>Dirección: {productDetail.address}</Text>
              <Text>Cliente: {productDetail.name_client}</Text>
              <Text>Teléfono: {productDetail.phone_client}</Text>
              <Text>Estado: {productDetail.status_b}</Text>
              <Text>Patente: {productDetail.patent}</Text>
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
        </AppModalCard>

        {/* ----- MODAL: selección múltiple ----- */}
        <AppModalCard
          visible={selectModal}
          onRequestClose={() => setSelectModal(false)}
        >
          <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 12 }}>
            Seleccionar producto a escanear
          </Text>

          {selectLoading ? (
            <ActivityIndicator size="large" color="#2196F3" />
          ) : (
            <FlatList
              data={selectResults}
              keyExtractor={(p) => p.id.toString()}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.selectItem}
                  onPress={async () => {
                    try {
                      setSelectLoading(true);
                      await verifyProductBodega(item);
                      setSelectModal(false);
                    } finally {
                      setSelectLoading(false);
                    }
                  }}
                >
                  <Text style={{ fontWeight: "bold" }}>
                    Folio: {item.code} — {item.name}
                  </Text>
                  <Text>Patente: {item.patent || "—"}</Text>
                  <Text>
                    Estado:{" "}
                    <Text
                      style={{
                        color: item.status_b === "Verificado" ? "green" : "red",
                      }}
                    >
                      {item.status_b}
                    </Text>
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity
            style={[
              styles.manualSendButton,
              { marginTop: 12, backgroundColor: "#ddd" },
            ]}
            onPress={() => setSelectModal(false)}
            disabled={selectLoading}
          >
            <Text style={{ color: "#333", fontWeight: "bold" }}>Cancelar</Text>
          </TouchableOpacity>
        </AppModalCard>

        {/* listado */}
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
            removeClippedSubviews
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        )}
      </View>

      {/* ✅ modal de éxito */}
      <AppModal
        visible={successOpen}
        title="¡Producto verificado!"
        message={successMsg}
        onClose={() => setSuccessOpen(false)}
        iconName="check-circle"
        accentColor="#24c96b"
        backgroundColor="#fff"
        textColor="#1f2937"
      />
    </View>
  );
}

const ACTION_HEIGHT = 54;
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
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
  productName: { fontWeight: "bold", fontSize: 16 },

  // menú
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
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  menuText: { fontSize: 16, marginLeft: 8, color: "#333" },

  // acciones
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
  scanButtonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
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

  // búsqueda
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderColor: "#bbb",
    color: "#000",
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

  // inputs/botones dentro de modales
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
    color: "#000",
  },
  manualSendButton: {
    backgroundColor: "#2196F3",
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 22,
    alignItems: "center",
    marginHorizontal: 2,
  },

  separator: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  selectItem: { paddingVertical: 10 },
});
