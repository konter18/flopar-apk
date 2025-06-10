import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveUserSession = async (userData: any) => {
  try {
    await AsyncStorage.setItem("userData", JSON.stringify(userData));
  } catch (error) {
    console.error("Error al guardar sesión:", error);
  }
};

export const getUserSession = async () => {
  try {
    const json = await AsyncStorage.getItem("userData");
    return json != null ? JSON.parse(json) : null;
  } catch (error) {
    console.error("Error al obtener sesión:", error);
    return null;
  }
};

export const clearUserSession = async () => {
  try {
    await AsyncStorage.removeItem("userData");
  } catch (error) {
    console.error("Error al eliminar sesión:", error);
  }
};
