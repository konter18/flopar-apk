import React, { useState, useLayoutEffect  } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useNavigation } from '@react-navigation/native';
import { useRouter } from "expo-router";
import { ENDPOINTS } from "../constants/endpoints";
import { ROUTES } from "../constants/routes";

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Control flopar" });
  }, [navigation]);

  const handleLogin = async () => {
    try {
      const response = await fetch(ENDPOINTS.GET_TOKEN, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `username=${encodeURIComponent(
          username
        )}&password=${encodeURIComponent(password)}`,
      });

      if (!response.ok) {
        throw new Error("Credenciales incorrectas");
      }

      const data = await response.json();
      console.log("Token recibido:", data.access_token);
      // Aquí podrías guardar el token con AsyncStorage si quieres mantener la sesión

      router.push(ROUTES.HOME);
    } catch (error: any) {
      Alert.alert("Error al iniciar sesión", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar Sesión</Text>
      <TextInput
        style={styles.input}
        placeholder="Usuario"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Ingresar" onPress={handleLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
});
