import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ROUTES } from "../constants/routes";
import { MaterialIcons } from '@expo/vector-icons';
import CustomHeader from './components/CustomHeader';

export default function AdministrativoScreen() {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    setShowMenu(false); // Cierra menú
    await AsyncStorage.clear();
    router.replace(ROUTES.LOGIN);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* HEADER */}
      <CustomHeader title="Administrativo" onAvatarPress={() => setShowMenu(true)} />

      {/* MENU DESPLEGABLE */}
      {showMenu && (
        <TouchableOpacity
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
          activeOpacity={1}
        >
          <View style={styles.dropdownMenu}>
            <TouchableOpacity onPress={handleLogout} style={styles.menuItem}>
              <MaterialIcons name="logout" size={20} color="#333" />
              <Text style={styles.menuText}>Salir</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* CUERPO */}
      <View style={styles.body}>
        <Text style={styles.title}>VISTA ADMINISTRADOR{"\n"}¡Bienvenido, MATIAS!</Text>
        <TouchableOpacity style={styles.customButton}>
          <Text style={styles.buttonText}>Escanear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.customButton}>
          <Text style={styles.buttonText}>Revisar Grilla</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 22, marginBottom: 36, textAlign: 'center' },
  customButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 10,
    width: '70%',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // === Nuevos estilos del menú ===
  menuOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
    zIndex: 999,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 55, // debajo del header
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    minWidth: 120,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 8,
    color: '#333',
  },
});
