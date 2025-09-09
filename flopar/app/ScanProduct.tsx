import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { CameraView, Camera } from "expo-camera";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import api from "../utils/api";
import { ENDPOINTS } from "../constants/endpoints";

import AppModal from "./components/AppModal";
import AppModalCard from "./components/AppModalCard";

/** ---- Antifalsos positivos: solo números y longitudes típicas */
const ALLOWED_LENGTHS = new Set<number>([12, 13, 14, 15, 18]);
const isLikelyCode = (raw: string) => {
  const s = (raw || "").trim();
  return /^\d+$/.test(s) && ALLOWED_LENGTHS.has(s.length);
};

type Role = "pioneta" | "bodega";
type Product = {
  id: number;
  name: string;
  code: string;
  code_lpn:string;
  patent?: string;
  status_p?: string;
  status_b?: string;
};

type AppModalIconName =
  | "check-circle"
  | "alert-circle"
  | "close-circle"
  | "information";
type FeedbackType = "success" | "warning" | "error" | "info";

export default function ScanProductScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // escaneo / estado
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);

  // selección múltiple
  const [selectVisible, setSelectVisible] = useState(false);
  const [selectResults, setSelectResults] = useState<Product[]>([]);
  const [selectLoading, setSelectLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ✅ feedback unificado (mismo que Bodega)
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

  const lastScanTs = useRef(0);
  const MIN_INTERVAL = 800;
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

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
    setFeedback((f) => ({
      ...f,
      open: true,
      type,
      title,
      message,
      iconName: map[type].iconName,
      accentColor: map[type].accentColor,
    }));
  };

  /** Verifica un producto (silencioso opcional para lotes) */
  const verifyOne = async (
    product: Product,
    role: Role,
    userId: number,
    silent = false
  ) => {
    const now = new Date().toISOString();
    const patchPayload =
      role === "pioneta"
        ? { status_p: "Verificado", verified_by_p: userId, verified_at_p: now }
        : { status_b: "Verificado", verified_by_b: userId, verified_at_b: now };

    await api.patch(ENDPOINTS.PATCH_PRODUCT(product.id), patchPayload);
    await api.post(ENDPOINTS.SCAN_PRODUCT(product.id), {});

    if (!silent) {
      let msg = `Producto: ${product.name}\nCódigo 1: ${product.code} \nCódigo 2: ${product.code_lpn}`;
      if (role === "bodega") msg += `\nPatente: ${product.patent ?? "—"}`;
      showFeedback("success", "¡Producto Escaneado!", msg);
      setArmed(false);
      setPaused(true);
      setSelectVisible(false);
    }
  };

  const processCode = async (code: string) => {
    setLoading(true);
    try {
      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) throw new Error("No hay usuario autenticado");
      const user = JSON.parse(userDataString);
      const role: Role = user.role;
      const userId: number = user.user_id;

      const { data: batchId } = await api.get(ENDPOINTS.LAST_BATCH);
      const res = await api.get(ENDPOINTS.GET_PRODUCTS_FILTERED(code, batchId));
      const results: Product[] = res.data ?? [];

      if (results.length === 0) {
        showFeedback(
          "error",
          "Producto no encontrado",
          `No existe producto con código: ${code}`
        );
        setArmed(false);
        setPaused(true);
        return;
      }

      // 1) filtro por rol (pioneta por patente)
      const byRole =
        role === "pioneta"
          ? results.filter(
              (r) => r.patent && user.patent && r.patent === user.patent
            )
          : results;

      if (byRole.length === 0) {
        showFeedback(
          "warning",
          "Patente no autorizada",
          "El resultado no corresponde a tu patente."
        );
        setArmed(false);
        setPaused(true);
        return;
      }

      // 2) excluir ya verificados según el rol
      const notVerified =
        role === "pioneta"
          ? byRole.filter((r: any) => r.status_p !== "Verificado")
          : byRole.filter((r: any) => r.status_b !== "Verificado");

      if (notVerified.length === 0) {
        showFeedback(
          "warning",
          "Sin pendientes",
          `El/los ${byRole.length} productos ya fueron escaneados por ${
            role === "pioneta" ? "pioneta" : "bodega"
          }.`
        );
        setArmed(false);
        setPaused(true);
        return;
      }

      if (notVerified.length === 1) {
        await verifyOne(notVerified[0], role, userId, false);
        return;
      }

      // múltiples → selección múltiple
      setSelectResults(notVerified);
      setSelectedIds(new Set()); // limpiar
      setSelectVisible(true);
      setPaused(true);
    } catch (err: any) {
      showFeedback(
        "error",
        "Error",
        err?.response?.data?.detail || "No se pudo verificar el producto"
      );
      setArmed(false);
      setPaused(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = async (barcode: any) => {
    if (!armed || paused || loading) return;

    const now = Date.now();
    if (now - lastScanTs.current < MIN_INTERVAL) return;
    lastScanTs.current = now;

    const raw = (barcode?.data || barcode?.rawValue || "").trim();
    if (!isLikelyCode(raw)) return;

    setPaused(true);
    await processCode(raw);
  };

  // --- selección múltiple helpers ---
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

  const verifySelected = async () => {
    if (selectedIds.size === 0) {
      showFeedback("warning", "Nada seleccionado", "Selecciona al menos un producto.");
      return;
    }
    setSelectLoading(true);
    try {
      const user = JSON.parse((await AsyncStorage.getItem("userData")) || "{}");
      const role: Role = user.role;
      const userId: number = user.user_id;

      let ok = 0;
      let fails: { code: string; reason: string }[] = [];

      // procesa en serie para no saturar
      for (const p of selectResults) {
        if (!selectedIds.has(p.id)) continue;
        try {
          await verifyOne(p, role, userId, true);
          ok++;
        } catch (e: any) {
          fails.push({
            code: p.code,
            reason:
              e?.response?.data?.detail ||
              e?.message ||
              "Error desconocido",
          });
        }
      }

      setSelectVisible(false);
      setSelectedIds(new Set());
      setPaused(false);
      setArmed(false);

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
    } finally {
      setSelectLoading(false);
    }
  };

  if (hasPermission === null)
    return <Text>Solicitando permiso de cámara…</Text>;
  if (hasPermission === false)
    return <Text>No se tiene acceso a la cámara</Text>;

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "code128", "code39", "code93", "upc_a", "upc_e"],
        }}
        onBarcodeScanned={armed && !paused && !loading ? handleBarCodeScanned : undefined}
      />

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      )}

      {/* FAB: armar / cancelar */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: armed && !paused ? "#ef4444" : "#2196F3" }]}
          onPress={() => {
            if (selectVisible) return;
            setPaused(false);
            setArmed((v) => !v);
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.fabText}>{armed && !paused ? "CANCELAR" : "ESCANEAR"}</Text>
        </TouchableOpacity>
      </View>

      {/* ✅ Modal selección múltiple */}
      <AppModalCard
        visible={selectVisible}
        onRequestClose={() => {
          setSelectVisible(false);
          setPaused(false);
          setArmed(false);
        }}
      >
        <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}>
          Selecciona los productos
        </Text>

        {selectLoading ? (
          <ActivityIndicator size="large" color="#2196F3" />
        ) : (
          <>
            {/* acciones de selección */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <TouchableOpacity onPress={selectAll} style={styles.pickBtn}>
                <Text style={styles.pickBtnText}>Seleccionar todos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearSelection} style={[styles.pickBtn, { backgroundColor: "#eee" }]}>
                <Text style={[styles.pickBtnText, { color: "#333" }]}>Limpiar</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectResults}
              keyExtractor={(p) => p.id.toString()}
              ItemSeparatorComponent={() => <View className="separator" style={styles.separator} />}
              renderItem={({ item }) => {
                const checked = selectedIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.selectItem, { flexDirection: "row", alignItems: "center", gap: 8 }]}
                    onPress={() => toggleId(item.id)}
                  >
                    <MaterialIcons
                      name={checked ? "check-box" : "check-box-outline-blank"}
                      size={22}
                      color={checked ? "#2196F3" : "#9CA3AF"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "bold" }}>
                        Código: {item.code} — {item.name}
                      </Text>
                      {!!item.patent && <Text>Patente: {item.patent}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              style={[styles.fabSmall, { backgroundColor: selectedIds.size ? "#2196F3" : "#9CA3AF", marginTop: 12 }]}
              disabled={!selectedIds.size}
              onPress={verifySelected}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                Verificar seleccionados ({selectedIds.size})
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[styles.fabSmall, { backgroundColor: "#ddd", marginTop: 12 }]}
          onPress={() => {
            setSelectVisible(false);
            setPaused(false);
            setArmed(false);
          }}
        >
          <Text style={{ color: "#333", fontWeight: "bold" }}>Cancelar</Text>
        </TouchableOpacity>
      </AppModalCard>

      {/* Mensajes informativos / resultado */}
      <AppModal
        visible={feedback.open}
        title={feedback.title}
        message={feedback.message}
        onClose={() => {
          const wasSuccess = feedback.type === "success";
          setFeedback((f) => ({ ...f, open: false }));
          setPaused(false);
          if (wasSuccess) setTimeout(() => router.back(), 150);
        }}
        iconName={feedback.iconName}
        accentColor={feedback.accentColor}
        backgroundColor={feedback.backgroundColor}
        textColor={feedback.textColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    position: "absolute",
    top: "45%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  buttonContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  fab: {
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 30,
    minWidth: "90%",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fabText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  fabSmall: {
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 22,
    alignItems: "center",
    alignSelf: "center",
    minWidth: "55%",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
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
