import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  widthPct?: number;
};

export default function AppModal({
  visible,
  title = "Aviso",
  message = "",
  onClose,
  iconName = "check-circle",
  accentColor = "#2196F3",
  backgroundColor = "#fff",
  textColor = "#1f2937",
  widthPct = 90,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor, width: `${widthPct}%` }]}>
          <View style={styles.header}>
            <MaterialIcons name={iconName} size={26} color={accentColor} />
            <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          </View>

          <Text style={[styles.message, { color: textColor }]}>{message}</Text>

          <TouchableOpacity style={[styles.button, { backgroundColor: accentColor }]} onPress={onClose}>
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  card: {
    borderRadius: 12,
    padding: 18,
    elevation: 8,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  title: { fontSize: 18, fontWeight: "700" },
  message: { fontSize: 16, lineHeight: 22, marginTop: 6, marginBottom: 14 },
  button: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
