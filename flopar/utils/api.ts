import axios from "axios";
import { getUserSession, clearUserSession } from "./session";
import { Alert } from "react-native";
import { router } from "expo-router";
import { ROUTES } from "../constants/routes";

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

api.interceptors.request.use(
  async (config) => {
    const session = await getUserSession();
    const token = session?.access_token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.warn("Token expirado o no autorizado");

      await clearUserSession();
      Alert.alert("Sesión expirada", "Por favor, inicia sesión nuevamente.");
      router.replace(ROUTES.LOGIN);
    }

    return Promise.reject(error);
  }
);

export default api;
