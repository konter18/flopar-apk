import React, { PropsWithChildren } from "react";
import { Modal, View, StyleSheet } from "react-native";

type Props = PropsWithChildren<{
  visible: boolean;
  onRequestClose: () => void;
  widthPct?: number;
  backgroundColor?: string;
}>;

export default function AppModalCard({
  visible,
  onRequestClose,
  children,
  widthPct = 90,
  backgroundColor = "#fff",
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor, width: `${widthPct}%` }]}>{children}</View>
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
    padding: 22,
    elevation: 8,
  },
});
