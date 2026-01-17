import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { commonStyles } from "../styles/common";
import { historyStyles } from "../styles/history";
import type { Screen, HistoryEntry } from "../types";
import { fetchHistory, deleteHistoryEntry } from "../services/api";

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
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const photoSize = useMemo(() => {
    const screenWidth = Dimensions.get("window").width;
    const horizontalPadding = 40; // scroll padding left + right
    const gapTotal = 20; // gaps between three columns
    return (screenWidth - horizontalPadding - gapTotal) / 3;
  }, []);

  const chunkEntries = useCallback(
    (items: HistoryEntry[], chunkSize: number) => {
      const chunks: HistoryEntry[][] = [];
      for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
      }
      return chunks;
    },
    []
  );

  const sections = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    entries.forEach((entry) => {
      const date = new Date(entry.timestamp);
      const key = date.toISOString().split("T")[0];
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(entry);
    });

    return Array.from(map.entries())
      .sort((a, b) => (a[0] > b[0] ? -1 : 1))
      .map(([isoDate, list]) => ({
        isoDate,
        formattedDate: new Date(isoDate).toLocaleDateString(undefined, {
          weekday: "short",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        rows: chunkEntries(list, 3),
      }));
  }, [entries, chunkEntries]);

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

  const handleDeleteEntry = useCallback(
    async (entry: HistoryEntry) => {
      if (isDeleting) return;
      setIsDeleting(true);
      try {
        await deleteHistoryEntry(historyUrl, entry.id);
        setEntries((prev) => prev.filter((item) => item.id !== entry.id));
        setSelectedEntry(null);
      } catch (error) {
        Alert.alert(
          "Delete Failed",
          "We couldn't delete this photo. Please try again."
        );
      } finally {
        setIsDeleting(false);
      }
    },
    [historyUrl, isDeleting]
  );

  const confirmDelete = useCallback(
    (entry: HistoryEntry) => {
      Alert.alert("Delete Photo", "Remove this scan from history?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteEntry(entry),
        },
      ]);
    },
    [handleDeleteEntry]
  );

  const showEmpty = !loading && entries.length === 0;

  // If viewing a specific entry, show full-screen view instead of grid
  if (selectedEntry) {
    const formattedTimestamp = new Date(
      selectedEntry.timestamp
    ).toLocaleString();

    return (
      <View style={commonStyles.container}>
        <View style={commonStyles.screenHeader}>
          <TouchableOpacity onPress={() => setSelectedEntry(null)}>
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={commonStyles.screenTitle}>{formattedTimestamp}</Text>
          <TouchableOpacity onPress={() => confirmDelete(selectedEntry)}>
            <Ionicons name="trash" size={24} color="#f87171" />
          </TouchableOpacity>
        </View>

        <View style={commonStyles.previewContainer}>
          <Image
            source={{ uri: selectedEntry.url }}
            style={commonStyles.previewImage}
          />
        </View>

        <View style={commonStyles.bottomButtonBar}>
          <TouchableOpacity
            style={[commonStyles.bottomButton, { backgroundColor: "#1f2a44" }]}
            onPress={() => setSelectedEntry(null)}
          >
            <Text style={commonStyles.bottomButtonText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[commonStyles.bottomButton, { backgroundColor: "#dc2626" }]}
            onPress={() => confirmDelete(selectedEntry)}
            disabled={isDeleting}
          >
            <Text style={commonStyles.bottomButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <View style={commonStyles.screenHeader}>
        <TouchableOpacity onPress={() => onNavigate("home")}>
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={commonStyles.screenTitle}>History</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={historyStyles.contentWrapper}>
        {loading && entries.length === 0 ? (
          <ActivityIndicator
            size="large"
            color="#3b82f6"
            style={{ marginTop: 40 }}
          />
        ) : showEmpty ? (
          <View style={historyStyles.emptyStateWrapper}>
            <Ionicons name="time-outline" size={72} color="#334155" />
            <Text style={historyStyles.emptyTitle}>No scans yet</Text>
            <Text style={historyStyles.emptySubtitle}>
              Scan fish to see your previous analyses here.
            </Text>
          </View>
        ) : (
          <ScrollView
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadHistory} />
            }
            contentContainerStyle={historyStyles.scrollContent}
          >
            {sections.map((section) => (
              <View key={section.isoDate} style={historyStyles.dateSection}>
                <Text style={historyStyles.dateHeader}>
                  {section.formattedDate}
                </Text>
                {section.rows.map((row, rowIndex) => (
                  <View
                    key={`${section.isoDate}-row-${rowIndex}`}
                    style={historyStyles.gridRow}
                  >
                    {row.map((entry, index) => (
                      <TouchableOpacity
                        key={entry.id}
                        style={[
                          historyStyles.square,
                          { width: photoSize, height: photoSize },
                        ]}
                        onPress={() => setSelectedEntry(entry)}
                        onLongPress={() => confirmDelete(entry)}
                        delayLongPress={300}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: entry.url }}
                          style={historyStyles.squareImage}
                        />
                      </TouchableOpacity>
                    ))}
                    {row.length < 3 &&
                      Array.from({ length: 3 - row.length }).map((_, idx) => (
                        <View
                          key={`spacer-${idx}`}
                          style={[
                            historyStyles.square,
                            historyStyles.squareSpacer,
                            { width: photoSize, height: photoSize },
                          ]}
                        />
                      ))}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};
