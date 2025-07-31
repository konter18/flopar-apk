import React, { ReactNode } from "react";
import { RefreshControl, ScrollView } from "react-native";

interface PullToRefreshProps {
  children: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  refreshing,
  onRefresh,
}) => {
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {children}
    </ScrollView>
  );
};

export default PullToRefresh;
