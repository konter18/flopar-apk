import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export type AppModalIconName =
  | "check-circle"
  | "alert-circle"
  | "close-circle"
  | "information";

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;

  // estilo / branding
  iconName?: AppModalIconName;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
};

export default function AppModal({
  visible,
  title,
  message,
  onClose,
  iconName = "information",
  accentColor = "#3B82F6",
  backgroundColor = "#fff",
  textColor = "#1f2937",
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor }]}>
          <View style={styles.header}>
            <MaterialCommunityIcons
              name={iconName}
              size={28}
              color={accentColor}
            />
            {title ? (
              <Text style={[styles.title, { color: textColor }]}>{title}</Text>
            ) : null}
          </View>

          {message ? (
            <Text style={[styles.message, { color: textColor }]}>
              {message}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: accentColor }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 12,
    padding: 16,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "bold" },
  message: { fontSize: 15, lineHeight: 21, marginBottom: 12 },
  button: {
    alignSelf: "flex-end",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
});
