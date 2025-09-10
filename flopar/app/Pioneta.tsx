import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../utils/api";
import { ENDPOINTS } from "../constants/endpoints";
import CustomHeader from "./components/CustomHeader";
import { ROUTES } from "../constants/routes";
import { MaterialIcons } from "@expo/vector-icons";

import AppModal from "./components/AppModal";
import AppModalCard from "./components/AppModalCard";

interface Product {
  id: number;
  name: string;
  code: string;
  code_do?: string;
  code_lpn?: string;
  patent: string;
  status_p: string;
  location: string;
  address: string;
  stock: number;
}

type ProductCardProps = { item: Product };

const ProductCard = React.memo(
  ({ item, onPress }: ProductCardProps & { onPress: (id: number) => void }) => (
    <TouchableOpacity onPress={() => onPress(item.id)} activeOpacity={0.8}>
      <View style={styles.card}>
        <Text style={styles.productName}>Nombre: {item.name}</Text>
        <Text>Código 1: {item.code}</Text>
        <Text>Código 2: {item.code_lpn}</Text>
        <Text>Patente: {item.patent}</Text>
        <Text>
          Estado:{" "}
          <Text
            style={{ color: item.status_p === "Verificado" ? "green" : "red" }}
          >
            {item.status_p}
          </Text>
        </Text>
        <Text>Sucursal: {item.location}</Text>
      </View>
    </TouchableOpacity>
  )
);

// ---- tipos para el modal unificado ----
type FeedbackType = "success" | "warning" | "error" | "info";
type AppModalIconName =
  | "check-circle"
  | "alert-circle"
  | "close-circle"
  | "information";

export default function ScanScreen() {
  const [selectModal, setSelectModal] = useState(false);
  const [selectResults, setSelectResults] = useState<Product[]>([]);
  const [selectLoading, setSelectLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [patente, setPatente] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");

  // manual
  const [manualModal, setManualModal] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // detalle
  const [detailModal, setDetailModal] = useState(false);
  const [productDetail, setProductDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // admin / confirm
  const [adminPhone, setAdminPhone] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  // feedback unificado
  const [feedback, setFeedback] = useState<{
    open: boolean;
    type: FeedbackType;
    title: string;
    message: string;
    iconName: AppModalIconName;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
  }>({
    open: false,
    type: "info",
    title: "",
    message: "",
    iconName: "information",
    accentColor: "#3B82F6",
    backgroundColor: "#fff",
    textColor: "#1f2937",
  });

  const showFeedback = (type: FeedbackType, title: string, message: string) => {
    const map: Record<
      FeedbackType,
      { iconName: AppModalIconName; accentColor: string }
    > = {
      success: { iconName: "check-circle", accentColor: "#22C55E" },
      warning: { iconName: "alert-circle", accentColor: "#EF4444" },
      error: { iconName: "close-circle", accentColor: "#EF4444" },
      info: { iconName: "information", accentColor: "#3B82F6" },
    };
    setFeedback({
      open: true,
      type,
      title,
      message,
      iconName: map[type].iconName,
      accentColor: map[type].accentColor,
      backgroundColor: "#fff",
      textColor: "#1f2937",
    });
  };

  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProductos();
    setRefreshing(false);
  };

  // verificar producto
  async function verifyProduct(product: Product) {
    if ((product.status_p || "").toLowerCase() === "verificado") {
      showFeedback(
        "warning",
        "Producto ya verificado",
        `Folio: ${product.code}`
      );
      return;
    }

    const userDataString = await AsyncStorage.getItem("userData");
    if (!userDataString) throw new Error("No hay usuario autenticado");
    const userData = JSON.parse(userDataString);
    const userId = userData.user_id;

    if (userData.role === "pioneta") {
      if (
        !product.patent ||
        !userData.patent ||
        product.patent !== userData.patent
      ) {
        showFeedback(
          "warning",
          "Patente no autorizada",
          `Este producto pertenece a la patente ${product.patent}, no puedes escanearlo`
        );
        return;
      }
    }

    const patchPayload = {
      status_p: "Verificado",
      verified_by_p: userId,
      verified_at_p: new Date().toISOString(),
    };

    await api.patch(ENDPOINTS.PATCH_PRODUCT(product.id), patchPayload);
    await api.post(ENDPOINTS.SCAN_PRODUCT(product.id), {});

    showFeedback(
      "success",
      "¡Producto verificado!",
      `Producto: ${product.name}\nCódigo 1: ${product.code}\nCódigo 2: ${product.code_lpn}`
    );
    setManualModal(false);
    setManualCode("");
    await fetchProductos();
  }

  const fetchProductos = useCallback(async () => {
    try {
      setLoading(true);
      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) throw new Error("No hay usuario autenticado");
      const userData = JSON.parse(userDataString);
      const userPatente = userData.patent;
      setPatente(userPatente);
      const { data: batchId } = await api.get(ENDPOINTS.LAST_BATCH);
      const { data: productos } = await api.get(ENDPOINTS.GET_PRODUCT_PIONETA, {
        params: { batch_id: batchId, patent: userPatente },
      });
      setProducts(productos);
      setFiltered(productos);
    } catch (error) {
      console.error(error);
      showFeedback("error", "Error", "No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProductos();
    }, [fetchProductos])
  );

  const fetchAdminPhone = async () => {
    try {
      const { data } = await api.get(ENDPOINTS.GET_ADMIN_PHONE);
      setAdminPhone(data.phone);
    } catch (error) {
      console.error("No se pudo obtener el teléfono del admin", error);
    }
  };

  const handleLogout = async () => {
    setShowMenu(false);
    await AsyncStorage.clear();
    router.replace(ROUTES.LOGIN);
  };

  const applyFilters = useCallback((base: Product[], text: string) => {
    const s = text.toLowerCase().trim();
    if (!s) return base;

    const norm = (v?: string) => (v || "").toLowerCase();

    return base.filter(
      (p) =>
        norm(p.name).includes(s) ||
        norm(p.code).includes(s) ||
        norm(p.code_lpn).includes(s) ||
        norm(p.code_do).includes(s)
    );
  }, []);

  const handleSearch = (text: string) => {
    setSearch(text);
    setFiltered(applyFilters(products, text));
  };

  React.useEffect(() => {
    if (!search.trim()) {
      setFiltered(products);
      return;
    }
    setFiltered(applyFilters(products, search));
  }, [products, search, applyFilters]);

  const getAxiosError = (err: any) =>
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    (typeof err?.response?.data === "string" ? err.response.data : null) ||
    err?.message ||
    "Error desconocido";

  const normalizePhone = (raw: string) =>
    ("+" + String(raw).replace(/[^\d+]/g, "")).replace(/\+{2,}/, "+");

  const handleConfirmQuadrature = async () => {
    if (confirmado) return;

    try {
      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) throw new Error("No hay usuario autenticado");
      const userData = JSON.parse(userDataString);
      const userPatente = userData.patent;
      const usuario = `${userData.first_name} ${userData.last_name}`;

      await api.post(ENDPOINTS.CONFIRM_QUADRATURE(userPatente));
      setConfirmado(true);

      let phone: string | null = null;
      try {
        const { data } = await api.get(ENDPOINTS.GET_ADMIN_PHONE);
        phone = data?.phone || null;
      } catch (e) {
        console.warn("No se pudo obtener el número del administrador:", e);
      }

      if (phone) {
        const to = normalizePhone(phone);
        try {
          const { data } = await api.post(ENDPOINTS.SEND_WHATSAPP, {
            to,
            patente: userPatente,
            usuario,
          });
          if (data?.sid) console.log("Twilio SID:", data.sid);
        } catch (err: any) {
          const why = getAxiosError(err);
          showFeedback(
            "warning",
            "Cuadratura confirmada",
            `Se confirmó la cuadratura, pero falló el envío de WhatsApp.\n\nMotivo: ${why}`
          );
          return;
        }
      } else {
        showFeedback(
          "warning",
          "Cuadratura confirmada",
          "No se encontró número de teléfono del administrador para enviar mensaje."
        );
        return;
      }

      showFeedback(
        "success",
        "¡Cuadratura confirmada!",
        "Todos los productos están verificados y se ha enviado el mensaje de confirmación."
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
          .map((p: any) => `${p.code}`)
          .join(", ");
        mensaje = `Productos pendientes de verificación:\n${pendientes}`;
      } else if (
        typeof detail === "string" &&
        detail.includes("verificación")
      ) {
        mensaje = detail;
      }
      showFeedback("warning", "No puedes confirmar aún", mensaje);
    }
  };

  // --- helpers selección múltiple (para el manual) ---
  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () =>
    setSelectedIds(new Set(selectResults.map((p) => p.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const verifySelectedManual = async () => {
    if (!selectedIds.size) {
      showFeedback(
        "warning",
        "Nada seleccionado",
        "Selecciona al menos un producto."
      );
      return;
    }
    setSelectLoading(true);
    try {
      const userData = JSON.parse(
        (await AsyncStorage.getItem("userData")) || "{}"
      );
      const userId = userData.user_id;

      let ok = 0;
      let fails: { code: string; reason: string }[] = [];

      for (const p of selectResults) {
        if (!selectedIds.has(p.id)) continue;
        try {
          // Reutilizamos verifyProduct pero sin abrir/cerrar modales a cada éxito:
          const patchPayload = {
            status_p: "Verificado",
            verified_by_p: userId,
            verified_at_p: new Date().toISOString(),
          };
          await api.patch(ENDPOINTS.PATCH_PRODUCT(p.id), patchPayload);
          await api.post(ENDPOINTS.SCAN_PRODUCT(p.id), {});
          ok++;
        } catch (e: any) {
          fails.push({
            code: p.code,
            reason:
              e?.response?.data?.detail || e?.message || "Error desconocido",
          });
        }
      }

      setSelectModal(false);
      setSelectedIds(new Set());
      setManualModal(false);
      setManualCode("");

      if (fails.length === 0) {
        showFeedback(
          "success",
          "¡Productos verificados!",
          `Se verificaron ${ok} producto(s) correctamente.`
        );
      } else {
        const list = fails
          .slice(0, 5)
          .map((f) => `• ${f.code}: ${f.reason}`)
          .join("\n");
        const extra = fails.length > 5 ? `\n… y ${fails.length - 5} más.` : "";
        showFeedback(
          ok > 0 ? "warning" : "error",
          ok > 0 ? "Verificación parcial" : "No se pudieron verificar",
          `Éxitos: ${ok}\nFallos: ${fails.length}\n${list}${extra}`
        );
      }

      await fetchProductos();
    } finally {
      setSelectLoading(false);
    }
  };

  // escaneo manual
  const handleManualScan = async () => {
    setManualLoading(true);
    try {
      const code = manualCode.trim();
      if (!code) {
        showFeedback(
          "warning",
          "Código vacío",
          "Ingresa el código del producto"
        );
        return;
      }

      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) throw new Error("No hay usuario autenticado");
      const userData = JSON.parse(userDataString);

      const { data: batchId } = await api.get(ENDPOINTS.LAST_BATCH);
      const res = await api.get(ENDPOINTS.GET_PRODUCTS_FILTERED(code, batchId));
      const resultados: Product[] = res.data ?? [];

      if (resultados.length === 0) {
        showFeedback(
          "error",
          "Producto no encontrado",
          `No existe producto con código: ${code}`
        );
        return;
      }

      // pendientes
      let pendientes = resultados.filter(
        (p) => (p.status_p || "").toLowerCase() !== "verificado"
      );

      // si es pioneta, que coincida la patente del usuario
      if (userData.role === "pioneta") {
        pendientes = pendientes.filter(
          (p) => p.patent && userData.patent && p.patent === userData.patent
        );
      }

      if (pendientes.length === 0) {
        showFeedback(
          "warning",
          "Ya verificado",
          "El/los producto(s) ya fueron verificados o no pertenecen a tu patente."
        );
        return;
      }

      if (pendientes.length === 1) {
        await verifyProduct(pendientes[0]);
        return;
      }

      // selección múltiple
      setSelectResults(pendientes);
      setSelectedIds(new Set());
      setSelectModal(true);
    } catch (err: any) {
      showFeedback(
        "error",
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
      const { data } = await api.get(ENDPOINTS.GET_PRODUCT_DETAIL(productId));
      setProductDetail(data);
    } catch (error) {
      showFeedback(
        "error",
        "Error",
        "No se pudo cargar el detalle del producto"
      );
      setProductDetail(null);
    } finally {
      setLoadingDetail(false);
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
            ? `Patente asignada: ${patente}`
            : "No hay patente asignada..."}
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push("/ScanProduct")}
          >
            <Text style={styles.scanButtonText}>Escanear producto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              confirmado && { backgroundColor: "#ccc" },
            ]}
            onPress={!confirmado ? handleConfirmQuadrature : undefined}
            activeOpacity={confirmado ? 1 : 0.7}
          >
            <MaterialIcons name="check" size={26} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirmar</Text>
          </TouchableOpacity>
        </View>

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

        {/* ---- MODAL MANUAL ---- */}
        <AppModalCard
          visible={manualModal}
          onRequestClose={() => setManualModal(false)}
        >
          <Text
            style={{
              fontWeight: "bold",
              fontSize: 18,
              marginBottom: 12,
              color: "#333",
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

        {/* ---- MODAL DETALLE ---- */}
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
              <Text>Código 1: {productDetail.code}</Text>
              <Text>Código 2: {productDetail.code_lpn}</Text>
              <Text>Nombre: {productDetail.name}</Text>
              <Text>Dirección: {productDetail.address}</Text>
              <Text>Cliente: {productDetail.name_client}</Text>
              <Text>Teléfono: {productDetail.phone_client}</Text>
              <Text>Estado: {productDetail.status_p}</Text>
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

        {/* ---- MODAL SELECCIÓN (ahora múltiple) ---- */}
        <AppModalCard
          visible={selectModal}
          onRequestClose={() => setSelectModal(false)}
        >
          <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 12 }}>
            Selecciona los productos
          </Text>

          {selectLoading ? (
            <ActivityIndicator size="large" color="#2196F3" />
          ) : (
            <>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <TouchableOpacity onPress={selectAll} style={styles.pickBtn}>
                  <Text style={styles.pickBtnText}>Seleccionar todos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={clearSelection}
                  style={[styles.pickBtn, { backgroundColor: "#eee" }]}
                >
                  <Text style={[styles.pickBtnText, { color: "#333" }]}>
                    Limpiar
                  </Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={selectResults}
                keyExtractor={(p) => p.id.toString()}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => {
                  const checked = selectedIds.has(item.id);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.selectItem,
                        { flexDirection: "row", alignItems: "center", gap: 8 },
                      ]}
                      onPress={() => toggleId(item.id)}
                    >
                      <MaterialIcons
                        name={checked ? "check-box" : "check-box-outline-blank"}
                        size={22}
                        color={checked ? "#2196F3" : "#9CA3AF"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "bold" }}>
                          Folio: {item.code} — {item.name}
                        </Text>
                        <Text>Patente: {item.patent || "—"}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              <TouchableOpacity
                style={[
                  styles.manualSendButton,
                  {
                    marginTop: 12,
                    backgroundColor: selectedIds.size ? "#2196F3" : "#9CA3AF",
                  },
                ]}
                disabled={!selectedIds.size}
                onPress={verifySelectedManual}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  Verificar seleccionados ({selectedIds.size})
                </Text>
              </TouchableOpacity>
            </>
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

        {/* ---- LISTA ---- */}
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

      {/* Modal */}
      <AppModal
        visible={feedback.open}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback((f) => ({ ...f, open: false }))}
        iconName={feedback.iconName}
        accentColor={feedback.accentColor}
        backgroundColor={feedback.backgroundColor}
        textColor={feedback.textColor}
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
    color: "#111827",
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

  pickBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#eaf3fa",
    borderWidth: 1,
    borderColor: "#2196F3",
  },
  pickBtnText: { color: "#2196F3", fontWeight: "bold" },

  separator: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  selectItem: { paddingVertical: 10 },
});
