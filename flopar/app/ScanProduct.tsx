import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Button,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ENDPOINTS } from "../constants/endpoints";

export default function ScanProductScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

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

      // Obtener datos de usuario
      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) throw new Error("No hay usuario autenticado");
      const userData = JSON.parse(userDataString);
      const userId = userData.user_id;

      // Obtener fecha/hora actual en formato ISO
      const now = new Date().toISOString();

      // Obtener el batch_id
      const batchRes = await axios.get(ENDPOINTS.LAST_BATCH);
      const batchId = batchRes.data?.id || batchRes.data || batchRes;

      // Buscar el producto
      const searchUrl = ENDPOINTS.GET_PRODUCTS_FILTERED(code, batchId);
      const res = await axios.get(searchUrl);

      if (!res.data || res.data.length === 0) {
        Alert.alert(
          "Producto no encontrado",
          `No existe producto con código: ${code} \nbatch_id: ${batchId}`
        );
        setLoading(false);
        return;
      }

      const product = res.data[0];

      // --- DEPURACIÓN: Muestra el objeto que vas a enviar ---
      const patchPayload = {
        status: "Verificado",
        verified_by: userId,
        verified_at: now,
      };

      // --- AQUÍ SE ENVÍA EL PATCH ---
      await axios.patch(ENDPOINTS.PATCH_PRODUCT(product.id), patchPayload);

      Alert.alert(
        "¡Producto verificado!",
        `Producto: ${product.name}\nCódigo: ${product.code}`
      )
      //temporizador para volver a la pantalla anterior
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
      {scanned && !loading && (
        <Button
          title="Escanear otro código"
          onPress={() => setScanned(false)}
        />
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
});
