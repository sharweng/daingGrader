import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { commonStyles, theme } from "../styles/common";
import { fetchAnalytics } from "../services/api";
import type { Screen, AnalyticsSummary } from "../types";

const screenWidth = Dimensions.get("window").width;

interface AnalyticsScreenProps {
  onNavigate: (screen: Screen) => void;
  analyticsUrl: string;
}

// Fish type colors for charts
const FISH_COLORS: Record<string, string> = {
  DalagangBukid: "#FF6B6B",
  Tunsoy: "#4ECDC4",
  Galunggong: "#45B7D1",
  Espada: "#96CEB4",
  Pusit: "#FFEAA7",
  Danggit: "#DDA0DD",
  Bangus: "#98D8C8",
  default: "#A0AEC0",
};

const getColor = (fishType: string): string => {
  return FISH_COLORS[fishType] || FISH_COLORS.default;
};

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({
  onNavigate,
  analyticsUrl,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await fetchAnalytics(analyticsUrl);
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [analyticsUrl]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  // Calculate percentages for pie chart
  const getDaingPercentage = () => {
    if (!analytics || analytics.total_scans === 0) return 0;
    return Math.round((analytics.daing_scans / analytics.total_scans) * 100);
  };

  const getNonDaingPercentage = () => {
    if (!analytics || analytics.total_scans === 0) return 0;
    return Math.round(
      (analytics.non_daing_scans / analytics.total_scans) * 100,
    );
  };

  // Get max count for bar chart scaling
  const getMaxFishCount = () => {
    if (
      !analytics ||
      Object.keys(analytics.fish_type_distribution).length === 0
    )
      return 1;
    return Math.max(...Object.values(analytics.fish_type_distribution));
  };

  if (loading) {
    return (
      <View style={commonStyles.container}>
        <View style={commonStyles.screenHeader}>
          <TouchableOpacity style={styles.headerButton} onPress={() => onNavigate("home")}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.screenTitle}>Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading Analytics...</Text>
        </View>
      </View>
    );
  }

  if (!analytics || analytics.total_scans === 0) {
    return (
      <View style={commonStyles.container}>
        <View style={commonStyles.screenHeader}>
          <TouchableOpacity style={styles.headerButton} onPress={() => onNavigate("home")}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.screenTitle}>Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bar-chart-outline" size={48} color={theme.colors.textMuted} />
          </View>
          <Text style={styles.emptyText}>No Scan Data Yet</Text>
          <Text style={styles.emptySubtext}>
            Start scanning fish to see analytics here
          </Text>
          <TouchableOpacity
            style={commonStyles.refreshButton}
            onPress={loadAnalytics}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color={theme.colors.text} />
            <Text style={commonStyles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const daingPercentage = getDaingPercentage();
  const nonDaingPercentage = getNonDaingPercentage();
  const maxFishCount = getMaxFishCount();

  return (
    <View style={commonStyles.container}>
      <View style={commonStyles.screenHeader}>
        <TouchableOpacity style={styles.headerButton} onPress={() => onNavigate("home")}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.screenTitle}>Analytics</Text>
        <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, styles.totalCard]}>
            <Ionicons name="scan-outline" size={24} color="rgba(255,255,255,0.7)" style={styles.summaryIcon} />
            <Text style={styles.summaryNumber}>{analytics.total_scans}</Text>
            <Text style={styles.summaryLabel}>Total Scans</Text>
          </View>
          <View style={[styles.summaryCard, styles.successCard]}>
            <Ionicons name="fish-outline" size={24} color="rgba(255,255,255,0.7)" style={styles.summaryIcon} />
            <Text style={styles.summaryNumber}>{analytics.daing_scans}</Text>
            <Text style={styles.summaryLabel}>Daing</Text>
          </View>
          <View style={[styles.summaryCard, styles.errorCard]}>
            <Ionicons name="close-circle-outline" size={24} color="rgba(255,255,255,0.7)" style={styles.summaryIcon} />
            <Text style={styles.summaryNumber}>
              {analytics.non_daing_scans}
            </Text>
            <Text style={styles.summaryLabel}>Non-Daing</Text>
          </View>
        </View>

        {/* Daing vs Non-Daing Pie Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Detection Overview</Text>
          <View style={styles.pieChartContainer}>
            {/* Simple visual pie representation */}
            <View style={styles.pieChart}>
              <View
                style={[
                  styles.pieSlice,
                  {
                    backgroundColor: "#4CAF50",
                    width: `${daingPercentage}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.pieSlice,
                  {
                    backgroundColor: "#F44336",
                    width: `${nonDaingPercentage}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendColor, { backgroundColor: "#4CAF50" }]}
                />
                <Text style={styles.legendText}>
                  Daing: {daingPercentage}% ({analytics.daing_scans})
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendColor, { backgroundColor: "#F44336" }]}
                />
                <Text style={styles.legendText}>
                  Non-Daing: {nonDaingPercentage}% ({analytics.non_daing_scans})
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fish Type Distribution Bar Chart */}
        {Object.keys(analytics.fish_type_distribution).length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Fish Type Distribution</Text>
            <View style={styles.barChartContainer}>
              {Object.entries(analytics.fish_type_distribution)
                .sort(([, a], [, b]) => b - a)
                .map(([fishType, count]) => (
                  <View key={fishType} style={styles.barRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {fishType}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${(count / maxFishCount) * 100}%`,
                            backgroundColor: getColor(fishType),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{count}</Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Average Confidence by Type */}
        {Object.keys(analytics.average_confidence).length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Average Confidence by Type</Text>
            <View style={styles.confidenceContainer}>
              {Object.entries(analytics.average_confidence)
                .sort(([, a], [, b]) => b - a)
                .map(([fishType, confidence]) => (
                  <View key={fishType} style={styles.confidenceRow}>
                    <Text style={styles.confidenceType} numberOfLines={1}>
                      {fishType}
                    </Text>
                    <View style={styles.confidenceBarContainer}>
                      <View
                        style={[
                          styles.confidenceBar,
                          {
                            width: `${confidence * 100}%`,
                            backgroundColor:
                              confidence >= 0.9
                                ? "#4CAF50"
                                : confidence >= 0.8
                                  ? "#8BC34A"
                                  : "#FFC107",
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.confidenceValue}>
                      {(confidence * 100).toFixed(1)}%
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Daily Scans */}
        {Object.keys(analytics.daily_scans).length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Daily Scans (Last 7 Days)</Text>
            <View style={styles.dailyScansContainer}>
              {Object.entries(analytics.daily_scans).map(([date, count]) => {
                const maxDaily = Math.max(
                  ...Object.values(analytics.daily_scans),
                );
                const height = maxDaily > 0 ? (count / maxDaily) * 100 : 0;
                const formattedDate = new Date(date).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <View key={date} style={styles.dailyBar}>
                    <Text style={styles.dailyCount}>{count}</Text>
                    <View style={styles.dailyBarTrack}>
                      <View
                        style={[styles.dailyBarFill, { height: `${height}%` }]}
                      />
                    </View>
                    <Text style={styles.dailyLabel}>{formattedDate}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  summaryContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  summaryIcon: {
    marginBottom: 8,
  },
  totalCard: {
    backgroundColor: theme.colors.primary + "30",
    borderWidth: 1,
    borderColor: theme.colors.primary + "50",
  },
  successCard: {
    backgroundColor: theme.colors.success + "30",
    borderWidth: 1,
    borderColor: theme.colors.success + "50",
  },
  errorCard: {
    backgroundColor: theme.colors.error + "30",
    borderWidth: 1,
    borderColor: theme.colors.error + "50",
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chartContainer: {
    backgroundColor: theme.colors.backgroundLight,
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 16,
  },
  pieChartContainer: {
    alignItems: "center",
  },
  pieChart: {
    width: "100%",
    height: 24,
    flexDirection: "row",
    borderRadius: 12,
    overflow: "hidden",
  },
  pieSlice: {
    height: "100%",
  },
  legendContainer: {
    marginTop: 16,
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    color: "#CCC",
    fontSize: 14,
  },
  barChartContainer: {
    gap: 12,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barLabel: {
    width: 100,
    fontSize: 12,
    color: "#CCC",
  },
  barTrack: {
    flex: 1,
    height: 24,
    backgroundColor: "#2A2A4A",
    borderRadius: 12,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 12,
  },
  barValue: {
    width: 40,
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    textAlign: "right",
  },
  confidenceContainer: {
    gap: 12,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confidenceType: {
    width: 100,
    fontSize: 12,
    color: "#CCC",
  },
  confidenceBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: "#2A2A4A",
    borderRadius: 10,
    overflow: "hidden",
  },
  confidenceBar: {
    height: "100%",
    borderRadius: 10,
  },
  confidenceValue: {
    width: 50,
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    textAlign: "right",
  },
  dailyScansContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 150,
    gap: 8,
  },
  dailyBar: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  dailyCount: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 4,
  },
  dailyBarTrack: {
    width: "100%",
    height: 100,
    backgroundColor: "#2A2A4A",
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  dailyBarFill: {
    width: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 8,
  },
  dailyLabel: {
    fontSize: 10,
    color: "#888",
    marginTop: 4,
    textAlign: "center",
  },
});
