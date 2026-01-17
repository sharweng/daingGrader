import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { commonStyles } from "../styles/common";
import { historyStyles } from "../styles/history";
import type { Screen, HistoryEntry } from "../types";
import { fetchHistory } from "../services/api";

interface HistoryScreenProps {
  onNavigate: (screen: Screen) => void;
  historyUrl: string;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  onNavigate,
  historyUrl,
}) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHistory(historyUrl);
      setEntries(data);
    } catch (error) {
      Alert.alert(
        "History",
        "Unable to load history from the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [historyUrl]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const renderItem = ({ item }: { item: HistoryEntry }) => (
    <View style={historyStyles.card}>
      <Image source={{ uri: item.url }} style={historyStyles.thumbnail} />
      <Text style={historyStyles.timestamp}>
        {new Date(item.timestamp).toLocaleString()}
      </Text>
    </View>
  );

  const showEmpty = !loading && entries.length === 0;

  return (
    <View style={commonStyles.container}>
      <View style={commonStyles.screenHeader}>
        <TouchableOpacity onPress={() => onNavigate("home")}>
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={commonStyles.screenTitle}>History</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading && entries.length === 0 ? (
        <ActivityIndicator
          size="large"
          color="#3b82f6"
          style={{ marginTop: 40 }}
        />
      ) : showEmpty ? (
        <View style={historyStyles.emptyState}>
          <Ionicons name="time-outline" size={72} color="#334155" />
          <Text style={historyStyles.emptyTitle}>No scans yet</Text>
          <Text style={historyStyles.emptySubtitle}>
            Scan fish to see your previous analyses here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={renderItem}
          contentContainerStyle={historyStyles.listContent}
          columnWrapperStyle={historyStyles.columnWrapper}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadHistory} />
          }
        />
      )}
    </View>
  );
};
