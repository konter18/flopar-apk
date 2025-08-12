import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { saveUserSession, getUserSession } from "../utils/session";
import { ENDPOINTS } from "../constants/endpoints";
import { ROUTES } from "../constants/routes";
import api from "../utils/api";

export const navigationOptions = {
  headerShown: false,
};

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await api.post(
        ENDPOINTS.GET_TOKEN,
        `username=${encodeURIComponent(username)}&password=${encodeURIComponent(
          password
        )}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const data = response.data;

      if (data.is_active === false) {
        Alert.alert(
          "Usuario deshabilitado",
          "No tienes permisos para acceder."
        );
        setLoading(false);
        return;
      }

      await saveUserSession(data);

      const session = await getUserSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("No se pudo guardar el token de sesión.");
      }

      switch (data.role) {
        case "bodega":
          router.replace(ROUTES.BODEGA);
          break;
        case "pioneta":
          router.replace(ROUTES.PIONETA);
          break;
        default:
          Alert.alert("Rol no reconocido", "Tu cuenta no tiene acceso asignado.");
          break;
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        Alert.alert(
          "Credenciales inválidas",
          "El usuario o la contraseña ingresados son incorrectos."
        );
      } else {
        Alert.alert(
          "Error al iniciar sesión",
          error.message || "Ocurrió un error inesperado."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar Sesión</Text>
      <TextInput
        style={styles.input}
        placeholder="Usuario"
        placeholderTextColor="#111827"
        value={username}
        onChangeText={setUsername}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor="#111827"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      <Button
        title={loading ? "Ingresando..." : "Ingresar"}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { color: "#111827", fontSize: 24, marginBottom: 20, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    color: "#111827",
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
});
