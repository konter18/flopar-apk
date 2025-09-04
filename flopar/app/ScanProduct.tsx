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
  patent?: string;
  status_p?: string;
  status_b?: string;
};

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

  // modales de mensaje
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTitle, setInfoTitle] = useState<string>("");
  const [infoMsg, setInfoMsg] = useState<string>("");

  // modal de éxito
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

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

  const openInfo = (title: string, message: string) => {
    setInfoTitle(title);
    setInfoMsg(message);
    setInfoOpen(true);
  };

  const verifyProduct = async (product: Product, role: Role, userId: number) => {
    const now = new Date().toISOString();
    const patchPayload =
      role === "pioneta"
        ? { status_p: "Verificado", verified_by_p: userId, verified_at_p: now }
        : { status_b: "Verificado", verified_by_b: userId, verified_at_b: now };

    await api.patch(ENDPOINTS.PATCH_PRODUCT(product.id), patchPayload);
    await api.post(ENDPOINTS.SCAN_PRODUCT(product.id), {});

    let msg = `Producto: ${product.name}\nCódigo: ${product.code}`;
    if (role === "bodega") msg += `\nPatente: ${product.patent ?? "—"}`;

    // éxito con modal
    setSuccessMsg(msg);
    setSuccessOpen(true);

    // bloqueamos el escaneo hasta cerrar
    setArmed(false);
    setPaused(true);
    setSelectVisible(false);
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
        openInfo("Producto no encontrado", `No existe producto con código: ${code}`);
        setArmed(false);
        setPaused(true);
        return;
      }

      // 1) filtro por rol (pioneta por patente)
      const byRole =
        role === "pioneta"
          ? results.filter((r) => r.patent && user.patent && r.patent === user.patent)
          : results;

      if (byRole.length === 0) {
        openInfo("Patente no autorizada", "El resultado no corresponde a tu patente.");
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
        openInfo(
          "Sin pendientes",
          `Todos (${byRole.length}) ya están verificados para ${role === "pioneta" ? "pioneta" : "bodega"}.`
        );
        setArmed(false);
        setPaused(true);
        return;
      }

      if (notVerified.length === 1) {
        await verifyProduct(notVerified[0], role, userId);
        return;
      }

      // múltiples pendientes → selección
      setSelectResults(notVerified);
      setSelectVisible(true);
      setPaused(true);
    } catch (err: any) {
      openInfo("Error", err?.response?.data?.detail || "No se pudo verificar el producto");
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

  if (hasPermission === null) return <Text>Solicitando permiso de cámara…</Text>;
  if (hasPermission === false) return <Text>No se tiene acceso a la cámara</Text>;

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

      {/* ✅ Modal selección (reutilizable) */}
      <AppModalCard
        visible={selectVisible}
        onRequestClose={() => {
          setSelectVisible(false);
          setPaused(false);
          setArmed(false);
        }}
      >
        <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}>
          Selecciona el producto
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
                    const user = JSON.parse((await AsyncStorage.getItem("userData")) || "{}");
                    await verifyProduct(item, user.role as Role, user.user_id);
                  } finally {
                    setSelectLoading(false);
                  }
                }}
              >
                <Text style={{ fontWeight: "bold" }}>
                  Código: {item.code} — {item.name}
                </Text>
                {!!item.patent && <Text>Patente: {item.patent}</Text>}
              </TouchableOpacity>
            )}
          />
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

      {/*Mensajes informativos */}
      <AppModal
        visible={infoOpen}
        title={infoTitle}
        message={infoMsg}
        onClose={() => {
          setInfoOpen(false);
          setPaused(false);
        }}
        iconName="info"
        accentColor="#2196F3"
        backgroundColor="#fff"
        textColor="#1f2937"
      />

      {/* ✅Éxito: vuelve atrás al cerrar */}
      <AppModal
        visible={successOpen}
        title="¡Producto escaneado!"
        message={successMsg}
        onClose={() => {
          setSuccessOpen(false);
          setPaused(false);
          setTimeout(() => router.back(), 150);
        }}
        iconName="check-circle"
        accentColor="#24c96b"
        backgroundColor="#fff"
        textColor="#1f2937"
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
  separator: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  selectItem: { paddingVertical: 10 },
});