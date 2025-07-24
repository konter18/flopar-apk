import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Button,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import api from "../utils/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ENDPOINTS } from "../constants/endpoints";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ScanProductScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const handleBarCodeScanned = async (barcode: any) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);

    try {
      const code = (barcode.data || barcode.rawValue).trim();
      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) throw new Error("No hay usuario autenticado");

      const userData = JSON.parse(userDataString);
      const { user_id, role, access_token } = userData;
      const now = new Date().toISOString();

      const batchRes = await api.get(ENDPOINTS.LAST_BATCH);
      const batchId = batchRes.data?.id || batchRes.data || batchRes;

      const searchUrl = ENDPOINTS.GET_PRODUCTS_FILTERED(code, batchId);
      const res = await api.get(searchUrl);

      if (!res.data || res.data.length === 0) {
        Alert.alert(
          "Producto no encontrado",
          `No existe producto con código: ${code}`
        );
        setLoading(false);
        return;
      }

      const product = res.data[0];

      let patchPayload: any = {};
      if (role === "pioneta") {
        patchPayload = {
          status_p: "Verificado",
          verified_by_p: user_id,
          verified_at_p: now,
        };
      } else if (role === "bodega") {
        patchPayload = {
          status_b: "Verificado",
          verified_by_b: user_id,
          verified_at_b: now,
        };
      } else {
        throw new Error("Rol no autorizado para escaneo");
      }

      await api.patch(ENDPOINTS.PATCH_PRODUCT(product.id), patchPayload);
      let mensaje = `Producto: ${product.name}\nCódigo: ${product.code}`;
      if (role === "bodega") {
        mensaje += `\nPatente: ${product.patent}`;
      }
      Alert.alert("¡Producto escaneado!", mensaje);
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.detail || "No se pudo verificar el producto"
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null)
    return <Text>Solicitando permiso de cámara...</Text>;
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
            "qr",
            "pdf417",
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      )}
      {/* Botón flotante, transparente, respetando safe area */}
      {scanned && !loading && (
        <View
          style={[
            styles.buttonContainer,
            { paddingBottom: insets.bottom + 20 }, // un poco más de margen
          ]}
        >
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setScanned(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.fabText}>ESCANEAR OTRO CÓDIGO</Text>
          </TouchableOpacity>
        </View>
      )}
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
    backgroundColor: "transparent", // Fondo transparente
    alignItems: "center",
    justifyContent: "flex-end",
  },
  fab: {
    backgroundColor: "#2196F3",
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 30,
    marginBottom: 0,
    alignItems: "center",
    minWidth: "90%",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fabText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    textAlign: "center",
  },
});
