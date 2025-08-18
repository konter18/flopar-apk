import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../utils/api";
import { ENDPOINTS } from "../constants/endpoints";

/** ---- Antifalsos positivos: solo números y longitudes típicas que nos pasaste */
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

  /** Estado de escaneo bajo demanda */
  const [armed, setArmed] = useState(false); // true => escuchar lecturas
  const [loading, setLoading] = useState(false); // true => haciendo requests
  const [paused, setPaused] = useState(false); // true => modal abierto / bloqueado por UI

  /** Modal de selección cuando hay múltiples */
  const [selectVisible, setSelectVisible] = useState(false);
  const [selectResults, setSelectResults] = useState<Product[]>([]);
  const [selectLoading, setSelectLoading] = useState(false);

  const lastScanTs = useRef(0);
  const MIN_INTERVAL = 800; // ms entre lecturas
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const verifyProduct = async (
    product: Product,
    role: Role,
    userId: number
  ) => {
    const now = new Date().toISOString();
    const patchPayload =
      role === "pioneta"
        ? { status_p: "Verificado", verified_by_p: userId, verified_at_p: now }
        : { status_b: "Verificado", verified_by_b: userId, verified_at_b: now };

    await api.patch(ENDPOINTS.PATCH_PRODUCT(product.id), patchPayload);
    await api.post(ENDPOINTS.SCAN_PRODUCT(product.id), {});

    let msg = `Producto: ${product.name}\nCódigo: ${product.code}`;
    if (role === "bodega") msg += `\nPatente: ${product.patent ?? "—"}`;
    Alert.alert("¡Producto escaneado!", msg);

    // cerrar flujo y volver
    setArmed(false);
    setPaused(false);
    setSelectVisible(false);
    setTimeout(() => router.back(), 1000);
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
        Alert.alert(
          "Producto no encontrado",
          `No existe producto con código: ${code}`
        );
        setArmed(false);
        setPaused(false);
        return;
      }

      // 1) Filtro por ROL (pioneta: por patente; bodega: ven todo)
      const byRole =
        role === "pioneta"
          ? results.filter(
              (r) => r.patent && user.patent && r.patent === user.patent
            )
          : results;

      if (byRole.length === 0) {
        Alert.alert(
          "Patente no autorizada",
          "El resultado no corresponde a tu patente."
        );
        setArmed(false);
        setPaused(false);
        return;
      }

      // 2) Excluir ya verificados según el ROL
      const notVerified =
        role === "pioneta"
          ? byRole.filter((r: any) => r.status_p !== "Verificado")
          : byRole.filter((r: any) => r.status_b !== "Verificado");

      if (notVerified.length === 0) {
        Alert.alert(
          "Sin pendientes",
          `Todos (${byRole.length}) ya están verificados para ${
            role === "pioneta" ? "pioneta" : "bodega"
          }.`
        );
        setArmed(false);
        setPaused(false);
        return;
      }

      if (notVerified.length === 1) {
        await verifyProduct(notVerified[0], role, userId);
        return;
      }

      // 3) Múltiples pendientes → abrir modal con SOLO los pendientes
      setSelectResults(notVerified);
      setSelectVisible(true);
      setPaused(true);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.detail || "No se pudo verificar el producto"
      );
      console.error(err);
      setArmed(false);
      setPaused(false);
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
    if (!isLikelyCode(raw)) return; // filtramos falsos positivos por longitud/números

    setPaused(true); // bloqueamos nuevas lecturas mientras procesamos
    await processCode(raw);
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
          barcodeTypes: [
            "ean13",
            "ean8",
            "code128",
            "code39",
            "code93",
            "upc_a",
            "upc_e",
          ],
        }}
        // Solo escuchamos cuando el usuario armó el escaneo y no está en pausa
        onBarcodeScanned={
          armed && !paused && !loading ? handleBarCodeScanned : undefined
        }
      />

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      )}

      {/* Botón fijo: arma/desarma el escaneo */}
      <View
        style={[styles.buttonContainer, { paddingBottom: insets.bottom + 20 }]}
      >
        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: armed && !paused ? "#ef4444" : "#2196F3" },
          ]}
          onPress={() => {
            // Si hay modal abierto, no cambiamos nada
            if (selectVisible) return;
            // ‘Armar’ reinicia pausa/estado
            setPaused(false);
            setArmed((v) => !v);
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.fabText}>
            {armed && !paused ? "CANCELAR" : "ESCANEAR"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal de selección cuando hay múltiples coincidencias */}
      <Modal
        visible={selectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSelectVisible(false);
          setPaused(false);
          setArmed(false); // que el usuario vuelva a presionar ESCANEAR
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text
              style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}
            >
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
                        const user = JSON.parse(
                          (await AsyncStorage.getItem("userData")) || "{}"
                        );
                        await verifyProduct(
                          item,
                          user.role as Role,
                          user.user_id
                        );
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
              style={[
                styles.fabSmall,
                { backgroundColor: "#ddd", marginTop: 12 },
              ]}
              onPress={() => {
                setSelectVisible(false);
                setPaused(false);
                setArmed(false); // que el usuario decida cuándo volver a armar
              }}
            >
              <Text style={{ color: "#333", fontWeight: "bold" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
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
  modalContent: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 12,
    width: "100%",
    maxHeight: "70%",
    elevation: 8,
  },
  separator: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  selectItem: { paddingVertical: 10 },
});
