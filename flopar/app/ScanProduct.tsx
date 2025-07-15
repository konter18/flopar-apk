import React, { useState, useEffect, useRef } from "react";
import { View, Text, Button, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { Camera, CameraType, CameraView } from "expo-camera";
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
      const code = barcode.data || barcode.rawValue;
      // ... lógica de producto
      Alert.alert("Código escaneado", `Código: ${code}`);
    } catch (err) {
      Alert.alert("Error", "No se pudo verificar el producto");
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null) return <Text>Solicitando permiso de cámara...</Text>;
  if (hasPermission === false) return <Text>No se tiene acceso a la cámara</Text>;

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13", "ean8", "code128", "code39", "code93", "upc_a", "upc_e", "qr", "pdf417"
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
        <Button title="Escanear otro código" onPress={() => setScanned(false)} />
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
