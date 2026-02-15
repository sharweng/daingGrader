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
import Svg, {
  Circle,
  G,
  Path,
  Line,
  Text as SvgText,
  Polyline,
} from "react-native-svg";
import { commonStyles, theme } from "../styles/common";
import { fetchAnalytics, fetchAllAnalytics } from "../services/api";
import type { Screen, AnalyticsSummary, User } from "../types";

const screenWidth = Dimensions.get("window").width;

type AnalyticsTab = "my" | "all";

interface AnalyticsScreenProps {
  onNavigate: (screen: Screen) => void;
  analyticsUrl: string;
  serverBaseUrl: string;
  user?: User | null;
}

// Fish type colors for charts - distinct colors for each type
const FISH_COLORS: Record<string, string> = {
  DalagangBukid: "#FF6B6B", // Red
  Tunsoy: "#4ECDC4", // Teal
  Galunggong: "#3498DB", // Blue
  Espada: "#2ECC71", // Green
  Pusit: "#9B59B6", // Purple
  Danggit: "#E67E22", // Orange
  Bangus: "#1ABC9C", // Turquoise
  Bisugo: "#F1C40F", // Yellow
  FlyingFish: "#E91E63", // Pink
  "Flying Fish": "#E91E63", // Pink (alternative name)
  Tilapia: "#00BCD4", // Cyan
  Dilis: "#8BC34A", // Light Green
  Tamban: "#FF5722", // Deep Orange
  Alumahan: "#673AB7", // Deep Purple
  Salay: "#795548", // Brown
  Matambaka: "#607D8B", // Blue Grey
  default: "#A0AEC0", // Grey
};

const getColor = (fishType: string): string => {
  return FISH_COLORS[fishType] || FISH_COLORS.default;
};

// Helper function to get heat map color based on contamination rate
const getZoneHeatColor = (affected: number, total: number): string => {
  if (total === 0 || affected === 0) return "rgba(76, 175, 80, 0.2)"; // Green - no contamination
  const rate = (affected / total) * 100;
  if (rate > 30) return "rgba(244, 67, 54, 0.6)"; // Red - high
  if (rate > 15) return "rgba(255, 152, 0, 0.5)"; // Orange - moderate
  if (rate > 5) return "rgba(255, 193, 7, 0.4)"; // Yellow - low
  return "rgba(76, 175, 80, 0.3)"; // Green - minimal
};

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({
  onNavigate,
  analyticsUrl,
  serverBaseUrl,
  user,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("my");
  const [selectedDays, setSelectedDays] = useState<number>(7);

  const isLoggedIn = !!user;
  const isAdmin = user?.role === "admin";

  const timeRangeOptions = [
    { value: 7, label: "7 Days" },
    { value: 30, label: "30 Days" },
    { value: 90, label: "90 Days" },
    { value: 365, label: "1 Year" },
  ];

  const loadAnalytics = useCallback(async () => {
    try {
      let data: AnalyticsSummary;
      // Non-logged-in users always see overall analytics
      if (!isLoggedIn) {
        data = await fetchAllAnalytics(serverBaseUrl, selectedDays);
      } else if (activeTab === "all") {
        // Logged-in users viewing "Overall" tab
        data = await fetchAllAnalytics(serverBaseUrl, selectedDays);
      } else {
        // Logged-in users viewing "My Analytics" tab
        data = await fetchAnalytics(analyticsUrl, selectedDays);
      }
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [analyticsUrl, serverBaseUrl, activeTab, isLoggedIn, selectedDays]);

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
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => onNavigate("home")}
          >
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
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => onNavigate("home")}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.screenTitle}>Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="bar-chart-outline"
              size={48}
              color={theme.colors.textMuted}
            />
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
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => onNavigate("home")}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.screenTitle}>Analytics</Text>
        <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar for Logged-in Users */}
      {isLoggedIn && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "my" && styles.activeTab]}
            onPress={() => setActiveTab("my")}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={
                activeTab === "my"
                  ? theme.colors.primary
                  : theme.colors.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "my" && styles.activeTabText,
              ]}
            >
              My Analytics
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "all" && styles.activeTab]}
            onPress={() => setActiveTab("all")}
          >
            <Ionicons
              name="globe-outline"
              size={18}
              color={
                activeTab === "all"
                  ? theme.colors.primary
                  : theme.colors.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "all" && styles.activeTabText,
              ]}
            >
              Overall Analytics
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        <Text style={styles.timeRangeLabel}>Time Range:</Text>
        <View style={styles.timeRangeButtons}>
          {timeRangeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.timeRangeButton,
                selectedDays === option.value && styles.timeRangeButtonActive,
              ]}
              onPress={() => {
                setSelectedDays(option.value);
                setLoading(true);
              }}
            >
              <Text
                style={[
                  styles.timeRangeButtonText,
                  selectedDays === option.value &&
                    styles.timeRangeButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
            <Ionicons
              name="scan-outline"
              size={24}
              color="rgba(255,255,255,0.7)"
              style={styles.summaryIcon}
            />
            <Text style={styles.summaryNumber}>{analytics.total_scans}</Text>
            <Text style={styles.summaryLabel}>Total Scans</Text>
          </View>
          <View style={[styles.summaryCard, styles.successCard]}>
            <Ionicons
              name="fish-outline"
              size={24}
              color="rgba(255,255,255,0.7)"
              style={styles.summaryIcon}
            />
            <Text style={styles.summaryNumber}>{analytics.daing_scans}</Text>
            <Text style={styles.summaryLabel}>Daing</Text>
          </View>
          <View style={[styles.summaryCard, styles.errorCard]}>
            <Ionicons
              name="close-circle-outline"
              size={24}
              color="rgba(255,255,255,0.7)"
              style={styles.summaryIcon}
            />
            <Text style={styles.summaryNumber}>
              {analytics.non_daing_scans}
            </Text>
            <Text style={styles.summaryLabel}>Non-Daing</Text>
          </View>
        </View>

        {/* Daing vs Non-Daing Pie Chart - Circular */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Detection Overview</Text>
          <View style={styles.pieChartContainer}>
            {/* Circular Pie Chart using SVG */}
            <View style={styles.circularPieContainer}>
              <Svg width={160} height={160} viewBox="0 0 100 100">
                <G transform="rotate(-90 50 50)">
                  {/* Background circle */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#2A2A4A"
                    strokeWidth="20"
                  />
                  {/* Daing slice (green) */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#4CAF50"
                    strokeWidth="20"
                    strokeDasharray={`${(daingPercentage / 100) * 251.2} 251.2`}
                    strokeLinecap="butt"
                  />
                  {/* Non-Daing slice (red) - offset by daing percentage */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#F44336"
                    strokeWidth="20"
                    strokeDasharray={`${(nonDaingPercentage / 100) * 251.2} 251.2`}
                    strokeDashoffset={-((daingPercentage / 100) * 251.2)}
                    strokeLinecap="butt"
                  />
                </G>
                {/* Center text */}
                <SvgText
                  x="50"
                  y="46"
                  textAnchor="middle"
                  fontSize="16"
                  fontWeight="bold"
                  fill="#FFFFFF"
                >
                  {analytics.total_scans}
                </SvgText>
                <SvgText
                  x="50"
                  y="60"
                  textAnchor="middle"
                  fontSize="8"
                  fill="#888888"
                >
                  Total Scans
                </SvgText>
              </Svg>
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

        {/* Color Consistency Analysis */}
        {analytics.color_consistency &&
          analytics.color_consistency.average_score > 0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Color Consistency Analysis</Text>

              {/* Average Score Display */}
              <View style={styles.colorScoreContainer}>
                <View style={styles.colorScoreCircle}>
                  <Text style={styles.colorScoreValue}>
                    {analytics.color_consistency.average_score.toFixed(0)}%
                  </Text>
                  <Text style={styles.colorScoreLabel}>Avg Score</Text>
                </View>
                <View style={styles.colorScoreInfo}>
                  <Text style={styles.colorInfoText}>
                    Higher scores indicate more uniform color distribution,
                    which correlates with better processing quality.
                  </Text>
                </View>
              </View>

              {/* Quality Grade Distribution */}
              <Text style={styles.chartSubtitle}>
                Quality Grade Distribution
              </Text>
              <View style={styles.gradeContainer}>
                {Object.entries(
                  analytics.color_consistency.grade_distribution,
                ).map(([grade, count]) => {
                  const total = Object.values(
                    analytics.color_consistency!.grade_distribution,
                  ).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  const gradeColor =
                    grade === "Export"
                      ? "#4CAF50"
                      : grade === "Local"
                        ? "#FFC107"
                        : "#F44336";
                  return (
                    <View key={grade} style={styles.gradeRow}>
                      <View style={styles.gradeLabelContainer}>
                        <View
                          style={[
                            styles.gradeDot,
                            { backgroundColor: gradeColor },
                          ]}
                        />
                        <Text style={styles.gradeLabel}>{grade}</Text>
                      </View>
                      <View style={styles.gradeBarTrack}>
                        <View
                          style={[
                            styles.gradeBarFill,
                            {
                              width: `${percentage}%`,
                              backgroundColor: gradeColor,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.gradeValue}>
                        {count} ({percentage.toFixed(0)}%)
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Color Consistency by Fish Type */}
              {Object.keys(analytics.color_consistency.by_fish_type).length >
                0 && (
                <>
                  <Text style={styles.chartSubtitle}>By Fish Type</Text>
                  <View style={styles.colorByTypeContainer}>
                    {Object.entries(analytics.color_consistency.by_fish_type)
                      .sort(([, a], [, b]) => b.avg_score - a.avg_score)
                      .map(([fishType, data]) => (
                        <View key={fishType} style={styles.colorTypeRow}>
                          <Text style={styles.colorTypeLabel} numberOfLines={1}>
                            {fishType}
                          </Text>
                          <View style={styles.colorTypeBarContainer}>
                            <View
                              style={[
                                styles.colorTypeBar,
                                {
                                  width: `${data.avg_score}%`,
                                  backgroundColor:
                                    data.avg_score >= 75
                                      ? "#4CAF50"
                                      : data.avg_score >= 50
                                        ? "#FFC107"
                                        : "#F44336",
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.colorTypeValue}>
                            {data.avg_score.toFixed(0)}%
                          </Text>
                        </View>
                      ))}
                  </View>
                </>
              )}
            </View>
          )}

        {/* Mold Analysis Section */}
        {analytics.mold_analysis && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Mold Contamination Analysis</Text>

            {/* Mold Summary Stats */}
            <View style={styles.moldSummaryContainer}>
              <View style={styles.moldSummaryCard}>
                <Text style={styles.moldSummaryValue}>
                  {analytics.mold_analysis.average_coverage.toFixed(1)}%
                </Text>
                <Text style={styles.moldSummaryLabel}>Avg Coverage</Text>
              </View>
              <View style={styles.moldSummaryCard}>
                <Text style={styles.moldSummaryValue}>
                  {Object.values(
                    analytics.mold_analysis.severity_distribution,
                  ).reduce((a, b) => a + b, 0) -
                    (analytics.mold_analysis.severity_distribution.None || 0)}
                </Text>
                <Text style={styles.moldSummaryLabel}>Contaminated</Text>
              </View>
            </View>

            {/* Severity Distribution */}
            <Text style={styles.chartSubtitle}>Severity Distribution</Text>
            <View style={styles.moldSeverityContainer}>
              {Object.entries(analytics.mold_analysis.severity_distribution)
                .filter(([severity]) => severity !== "None")
                .map(([severity, count]) => {
                  const totalWithMold = Object.entries(
                    analytics.mold_analysis!.severity_distribution,
                  )
                    .filter(([s]) => s !== "None")
                    .reduce((sum, [, c]) => sum + c, 0);
                  const percentage =
                    totalWithMold > 0 ? (count / totalWithMold) * 100 : 0;
                  const severityColor =
                    severity === "Severe"
                      ? "#F44336"
                      : severity === "Moderate"
                        ? "#FF9800"
                        : "#FFC107";

                  return (
                    <View key={severity} style={styles.moldSeverityRow}>
                      <View style={styles.moldSeverityLabel}>
                        <View
                          style={[
                            styles.moldSeverityDot,
                            { backgroundColor: severityColor },
                          ]}
                        />
                        <Text style={styles.moldSeverityText}>{severity}</Text>
                      </View>
                      <View style={styles.moldSeverityBarTrack}>
                        <View
                          style={[
                            styles.moldSeverityBarFill,
                            {
                              width: `${percentage}%`,
                              backgroundColor: severityColor,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.moldSeverityCount}>{count}</Text>
                    </View>
                  );
                })}
            </View>

            {/* Spatial Distribution - Heat Map Style */}
            <Text style={styles.chartSubtitle}>
              Spatial Distribution (Split Fish)
            </Text>
            <View style={styles.spatialDistributionContainer}>
              <View style={styles.fishDiagramContainer}>
                {/* Split fish representation - Top and Bottom */}
                <View style={styles.splitFishDiagram}>
                  {/* Top zone */}
                  <View
                    style={[
                      styles.splitFishZone,
                      styles.splitFishZoneTop,
                      {
                        backgroundColor: getZoneHeatColor(
                          analytics.mold_analysis.spatial_zones.top
                            ?.fish_affected || 0,
                          analytics.total_scans,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.fishZoneLabel}>Top Half</Text>
                    <Text style={styles.fishZoneValue}>
                      {analytics.mold_analysis.spatial_zones.top
                        ?.fish_affected || 0}
                    </Text>
                  </View>
                  {/* Bottom zone */}
                  <View
                    style={[
                      styles.splitFishZone,
                      styles.splitFishZoneBottom,
                      {
                        backgroundColor: getZoneHeatColor(
                          analytics.mold_analysis.spatial_zones.bottom
                            ?.fish_affected || 0,
                          analytics.total_scans,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.fishZoneLabel}>Bottom Half</Text>
                    <Text style={styles.fishZoneValue}>
                      {analytics.mold_analysis.spatial_zones.bottom
                        ?.fish_affected || 0}
                    </Text>
                  </View>
                </View>
                {/* Heat map legend */}
                <View style={styles.heatMapLegend}>
                  <Text style={styles.heatMapLegendText}>Low</Text>
                  <View style={styles.heatMapGradient}>
                    <View
                      style={[
                        styles.heatMapGradientStep,
                        { backgroundColor: "rgba(76, 175, 80, 0.3)" },
                      ]}
                    />
                    <View
                      style={[
                        styles.heatMapGradientStep,
                        { backgroundColor: "rgba(255, 193, 7, 0.5)" },
                      ]}
                    />
                    <View
                      style={[
                        styles.heatMapGradientStep,
                        { backgroundColor: "rgba(255, 152, 0, 0.6)" },
                      ]}
                    />
                    <View
                      style={[
                        styles.heatMapGradientStep,
                        { backgroundColor: "rgba(244, 67, 54, 0.7)" },
                      ]}
                    />
                  </View>
                  <Text style={styles.heatMapLegendText}>High</Text>
                </View>
              </View>
            </View>

            {/* Mold Susceptibility by Fish Type */}
            {Object.keys(analytics.mold_analysis.by_fish_type).length > 0 && (
              <>
                <Text style={styles.chartSubtitle}>
                  Contamination Rate by Fish Type
                </Text>
                <View style={styles.moldByTypeContainer}>
                  {Object.entries(analytics.mold_analysis.by_fish_type)
                    .sort(
                      ([, a], [, b]) =>
                        b.contamination_rate - a.contamination_rate,
                    )
                    .map(([fishType, data]) => (
                      <View key={fishType} style={styles.moldTypeRow}>
                        <Text style={styles.moldTypeLabel} numberOfLines={1}>
                          {fishType}
                        </Text>
                        <View style={styles.moldTypeBarContainer}>
                          <View
                            style={[
                              styles.moldTypeBar,
                              {
                                width: `${Math.min(data.contamination_rate, 100)}%`,
                                backgroundColor:
                                  data.contamination_rate > 30
                                    ? "#F44336"
                                    : data.contamination_rate > 15
                                      ? "#FF9800"
                                      : data.contamination_rate > 5
                                        ? "#FFC107"
                                        : "#4CAF50",
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.moldTypeValue}>
                          {data.contamination_rate.toFixed(1)}%
                        </Text>
                      </View>
                    ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Defect Pattern Analysis Section */}
        {analytics.defect_patterns && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Defect Pattern Analysis</Text>

            {/* Defect Frequency */}
            <Text style={styles.chartSubtitle}>Defect Frequency</Text>
            <View style={styles.defectFrequencyContainer}>
              {Object.entries(analytics.defect_patterns.frequency).map(
                ([defect, count]) => {
                  const totalAffected = Object.values(
                    analytics.defect_patterns!.frequency,
                  ).reduce((a, b) => a + b, 0);
                  const percentage =
                    totalAffected > 0
                      ? (count / analytics.daing_scans) * 100
                      : 0;
                  const defectLabels: Record<string, string> = {
                    poor_color_uniformity: "Poor Color Uniformity",
                    color_discoloration: "Color Discoloration",
                    acceptable_quality: "Acceptable (Local Grade)",
                  };
                  const defectColors: Record<string, string> = {
                    poor_color_uniformity: "#FF9800",
                    color_discoloration: "#F44336",
                    acceptable_quality: "#FFC107",
                  };

                  return (
                    <View key={defect} style={styles.defectRow}>
                      <View style={styles.defectLabelContainer}>
                        <View
                          style={[
                            styles.defectDot,
                            { backgroundColor: defectColors[defect] || "#888" },
                          ]}
                        />
                        <Text style={styles.defectLabel}>
                          {defectLabels[defect] || defect}
                        </Text>
                      </View>
                      <View style={styles.defectBarTrack}>
                        <View
                          style={[
                            styles.defectBarFill,
                            {
                              width: `${Math.min(percentage, 100)}%`,
                              backgroundColor: defectColors[defect] || "#888",
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.defectValue}>
                        {count} ({percentage.toFixed(1)}%)
                      </Text>
                    </View>
                  );
                },
              )}
            </View>

            {/* Most Common Defect */}
            {analytics.defect_patterns.most_common_defect && (
              <View style={styles.mostCommonDefect}>
                <Ionicons name="warning-outline" size={18} color="#FF9800" />
                <Text style={styles.mostCommonDefectText}>
                  Most Common Issue:{" "}
                  <Text style={styles.mostCommonDefectHighlight}>
                    {analytics.defect_patterns.most_common_defect
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                </Text>
              </View>
            )}

            {/* Species Susceptibility */}
            {Object.keys(analytics.defect_patterns.species_susceptibility)
              .length > 0 && (
              <>
                <Text style={styles.chartSubtitle}>
                  Species Most Susceptible to Defects
                </Text>
                <View style={styles.speciesSusceptibilityContainer}>
                  {Object.entries(
                    analytics.defect_patterns.species_susceptibility,
                  )
                    .sort(([, a], [, b]) => b.defect_rate - a.defect_rate)
                    .slice(0, 5)
                    .map(([fishType, data]) => (
                      <View key={fishType} style={styles.susceptibilityRow}>
                        <View style={styles.susceptibilityInfo}>
                          <Text style={styles.susceptibilityFishType}>
                            {fishType}
                          </Text>
                          <Text style={styles.susceptibilityStats}>
                            {data.reject_count} reject, {data.local_count} local
                          </Text>
                        </View>
                        <View style={styles.susceptibilityBarContainer}>
                          <View
                            style={[
                              styles.susceptibilityBar,
                              {
                                width: `${Math.min(data.defect_rate, 100)}%`,
                                backgroundColor:
                                  data.defect_rate > 50
                                    ? "#F44336"
                                    : data.defect_rate > 25
                                      ? "#FF9800"
                                      : "#FFC107",
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.susceptibilityRate}>
                          {data.defect_rate.toFixed(1)}%
                        </Text>
                      </View>
                    ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Quality Grade Classification */}
        {analytics.quality_classification && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Quality Grade Classification</Text>

            {/* Quality Summary Cards */}
            <View style={styles.qualitySummaryContainer}>
              <View
                style={[
                  styles.qualitySummaryCard,
                  { backgroundColor: "rgba(76, 175, 80, 0.15)" },
                ]}
              >
                <Text
                  style={[styles.qualitySummaryValue, { color: "#4CAF50" }]}
                >
                  {analytics.quality_classification.summary.export_rate.toFixed(
                    1,
                  )}
                  %
                </Text>
                <Text style={styles.qualitySummaryLabel}>Export Grade</Text>
              </View>
              <View
                style={[
                  styles.qualitySummaryCard,
                  { backgroundColor: "rgba(255, 193, 7, 0.15)" },
                ]}
              >
                <Text
                  style={[styles.qualitySummaryValue, { color: "#FFC107" }]}
                >
                  {analytics.quality_classification.summary.local_rate.toFixed(
                    1,
                  )}
                  %
                </Text>
                <Text style={styles.qualitySummaryLabel}>Local Grade</Text>
              </View>
              <View
                style={[
                  styles.qualitySummaryCard,
                  { backgroundColor: "rgba(244, 67, 54, 0.15)" },
                ]}
              >
                <Text
                  style={[styles.qualitySummaryValue, { color: "#F44336" }]}
                >
                  {analytics.quality_classification.summary.reject_rate.toFixed(
                    1,
                  )}
                  %
                </Text>
                <Text style={styles.qualitySummaryLabel}>Reject</Text>
              </View>
            </View>

            {/* Quality by Species */}
            {Object.keys(analytics.quality_classification.by_species).length >
              0 && (
              <>
                <Text style={styles.chartSubtitle}>
                  Quality by Fish Species
                </Text>
                <View style={styles.qualityBySpeciesContainer}>
                  {Object.entries(
                    analytics.quality_classification.by_species,
                  ).map(([fishType, grades]) => {
                    const total =
                      grades.Export.count +
                      grades.Local.count +
                      grades.Reject.count;
                    if (total === 0) return null;

                    return (
                      <View key={fishType} style={styles.qualitySpeciesRow}>
                        <Text style={styles.qualitySpeciesName}>
                          {fishType}
                        </Text>
                        <View style={styles.qualityStackedBar}>
                          {grades.Export.count > 0 && (
                            <View
                              style={[
                                styles.qualityStackedSegment,
                                {
                                  width: `${(grades.Export.count / total) * 100}%`,
                                  backgroundColor: "#4CAF50",
                                },
                              ]}
                            />
                          )}
                          {grades.Local.count > 0 && (
                            <View
                              style={[
                                styles.qualityStackedSegment,
                                {
                                  width: `${(grades.Local.count / total) * 100}%`,
                                  backgroundColor: "#FFC107",
                                },
                              ]}
                            />
                          )}
                          {grades.Reject.count > 0 && (
                            <View
                              style={[
                                styles.qualityStackedSegment,
                                {
                                  width: `${(grades.Reject.count / total) * 100}%`,
                                  backgroundColor: "#F44336",
                                },
                              ]}
                            />
                          )}
                        </View>
                        <Text style={styles.qualitySpeciesCount}>{total}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Stacked bar legend */}
                <View style={styles.qualityLegend}>
                  <View style={styles.qualityLegendItem}>
                    <View
                      style={[
                        styles.qualityLegendDot,
                        { backgroundColor: "#4CAF50" },
                      ]}
                    />
                    <Text style={styles.qualityLegendText}>Export</Text>
                  </View>
                  <View style={styles.qualityLegendItem}>
                    <View
                      style={[
                        styles.qualityLegendDot,
                        { backgroundColor: "#FFC107" },
                      ]}
                    />
                    <Text style={styles.qualityLegendText}>Local</Text>
                  </View>
                  <View style={styles.qualityLegendItem}>
                    <View
                      style={[
                        styles.qualityLegendDot,
                        { backgroundColor: "#F44336" },
                      ]}
                    />
                    <Text style={styles.qualityLegendText}>Reject</Text>
                  </View>
                </View>
              </>
            )}

            {/* Quality by Date Chart */}
            {Object.keys(analytics.quality_classification.by_date).length >
              0 && (
              <>
                <Text style={styles.chartSubtitle}>
                  Quality Trend (
                  {timeRangeOptions.find((o) => o.value === selectedDays)
                    ?.label || "7 Days"}
                  )
                </Text>
                <View style={styles.qualityTrendContainer}>
                  {Object.entries(analytics.quality_classification.by_date)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, grades]) => {
                      const total =
                        grades.Export + grades.Local + grades.Reject;
                      const formattedDate = new Date(date).toLocaleDateString(
                        "en",
                        { month: "short", day: "numeric" },
                      );

                      return (
                        <View key={date} style={styles.qualityTrendDay}>
                          <View style={styles.qualityTrendBars}>
                            <View
                              style={[
                                styles.qualityTrendBar,
                                {
                                  height: `${(grades.Export / Math.max(total, 1)) * 100}%`,
                                  backgroundColor: "#4CAF50",
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.qualityTrendBar,
                                {
                                  height: `${(grades.Local / Math.max(total, 1)) * 100}%`,
                                  backgroundColor: "#FFC107",
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.qualityTrendBar,
                                {
                                  height: `${(grades.Reject / Math.max(total, 1)) * 100}%`,
                                  backgroundColor: "#F44336",
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.qualityTrendDate}>
                            {formattedDate}
                          </Text>
                        </View>
                      );
                    })}
                </View>
              </>
            )}
          </View>
        )}

        {/* Confidence vs Color Score Scatter Plot */}
        {analytics.quality_classification &&
          Object.keys(analytics.quality_classification.by_species).length >
            0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>
                Confidence vs Color Score Distribution
              </Text>
              {(() => {
                const chartWidth = screenWidth - 80;
                const chartHeight = 200;
                const padding = { left: 35, right: 15, top: 15, bottom: 30 };
                const graphWidth = chartWidth - padding.left - padding.right;
                const graphHeight = chartHeight - padding.top - padding.bottom;

                // Collect data points - one per fish type per grade (Export/Local/Reject)
                const dataPoints: Array<{
                  fishType: string;
                  confidence: number;
                  colorScore: number;
                  grade: string;
                }> = [];

                // Get unique fish types for legend
                const fishTypes = new Set<string>();

                Object.entries(
                  analytics.quality_classification.by_species,
                ).forEach(([fishType, grades]) => {
                  fishTypes.add(fishType);
                  // Add Export grade point
                  if (
                    grades.Export.count > 0 &&
                    grades.Export.avg_confidence > 0
                  ) {
                    dataPoints.push({
                      fishType,
                      confidence: grades.Export.avg_confidence,
                      colorScore: grades.Export.avg_color_score,
                      grade: "Export",
                    });
                  }
                  // Add Local grade point
                  if (
                    grades.Local.count > 0 &&
                    grades.Local.avg_confidence > 0
                  ) {
                    dataPoints.push({
                      fishType,
                      confidence: grades.Local.avg_confidence,
                      colorScore: grades.Local.avg_color_score,
                      grade: "Local",
                    });
                  }
                  // Add Reject grade point
                  if (
                    grades.Reject.count > 0 &&
                    grades.Reject.avg_confidence > 0
                  ) {
                    dataPoints.push({
                      fishType,
                      confidence: grades.Reject.avg_confidence,
                      colorScore: grades.Reject.avg_color_score,
                      grade: "Reject",
                    });
                  }
                });

                if (dataPoints.length === 0) return null;

                return (
                  <View style={styles.scatterPlotContainer}>
                    <Svg width={chartWidth} height={chartHeight}>
                      {/* Grid lines - horizontal */}
                      {[0, 25, 50, 75, 100].map((yVal) => {
                        const y =
                          padding.top +
                          graphHeight -
                          (yVal / 100) * graphHeight;
                        return (
                          <G key={`h-grid-${yVal}`}>
                            <Line
                              x1={padding.left}
                              y1={y}
                              x2={chartWidth - padding.right}
                              y2={y}
                              stroke="#2A2A4A"
                              strokeWidth="1"
                            />
                            <SvgText
                              x={padding.left - 5}
                              y={y + 3}
                              textAnchor="end"
                              fontSize="9"
                              fill="#888888"
                            >
                              {yVal}
                            </SvgText>
                          </G>
                        );
                      })}

                      {/* Grid lines - vertical */}
                      {[0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((xVal) => {
                        const x =
                          padding.left + ((xVal - 0.5) / 0.5) * graphWidth;
                        return (
                          <G key={`v-grid-${xVal}`}>
                            <Line
                              x1={x}
                              y1={padding.top}
                              x2={x}
                              y2={padding.top + graphHeight}
                              stroke="#2A2A4A"
                              strokeWidth="1"
                            />
                            <SvgText
                              x={x}
                              y={chartHeight - 5}
                              textAnchor="middle"
                              fontSize="9"
                              fill="#888888"
                            >
                              {(xVal * 100).toFixed(0)}%
                            </SvgText>
                          </G>
                        );
                      })}

                      {/* Axis labels */}
                      <SvgText
                        x={chartWidth / 2}
                        y={chartHeight - 1}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#AAAAAA"
                      >
                        Detection Confidence
                      </SvgText>

                      {/* Data points - fixed size, colored by fish type */}
                      {dataPoints.map((point, index) => {
                        const x =
                          padding.left +
                          ((point.confidence - 0.5) / 0.5) * graphWidth;
                        const y =
                          padding.top +
                          graphHeight -
                          (point.colorScore / 100) * graphHeight;
                        const color = getColor(point.fishType);

                        return (
                          <G key={`point-${index}`}>
                            <Circle
                              cx={Math.max(
                                padding.left,
                                Math.min(x, chartWidth - padding.right),
                              )}
                              cy={Math.max(
                                padding.top,
                                Math.min(y, padding.top + graphHeight),
                              )}
                              r={6}
                              fill={color}
                              opacity={0.85}
                              stroke="#FFFFFF"
                              strokeWidth={1}
                            />
                          </G>
                        );
                      })}
                    </Svg>

                    {/* Y-axis label */}
                    <Text style={styles.scatterYLabel}>Color Score</Text>

                    {/* Legend - fish types */}
                    <View style={styles.scatterLegend}>
                      {Array.from(
                        new Set(dataPoints.map((p) => p.fishType)),
                      ).map((fishType) => (
                        <View key={fishType} style={styles.scatterLegendItem}>
                          <View
                            style={[
                              styles.scatterLegendDot,
                              { backgroundColor: getColor(fishType) },
                            ]}
                          />
                          <Text style={styles.scatterLegendText}>
                            {fishType}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

        {/* Daily Scans - Line Graph */}
        {Object.keys(analytics.daily_scans).length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>
              Daily Scans Trend (
              {timeRangeOptions.find((o) => o.value === selectedDays)?.label ||
                "7 Days"}
              )
            </Text>
            {(() => {
              const dailyEntries = Object.entries(analytics.daily_scans).sort(
                ([a], [b]) => a.localeCompare(b),
              );
              const maxDaily = Math.max(
                ...Object.values(analytics.daily_scans),
                1,
              );
              const chartWidth = screenWidth - 80;
              const chartHeight = 120;
              const padding = { left: 30, right: 10, top: 10, bottom: 30 };
              const graphWidth = chartWidth - padding.left - padding.right;
              const graphHeight = chartHeight - padding.top - padding.bottom;

              // Generate line path points
              const points = dailyEntries
                .map(([, count], index) => {
                  const x =
                    padding.left +
                    (index / (dailyEntries.length - 1 || 1)) * graphWidth;
                  const y =
                    padding.top +
                    graphHeight -
                    (count / maxDaily) * graphHeight;
                  return `${x},${y}`;
                })
                .join(" ");

              return (
                <View style={styles.lineChartContainer}>
                  <Svg width={chartWidth} height={chartHeight}>
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                      <Line
                        key={`grid-${i}`}
                        x1={padding.left}
                        y1={padding.top + graphHeight * (1 - ratio)}
                        x2={chartWidth - padding.right}
                        y2={padding.top + graphHeight * (1 - ratio)}
                        stroke="#2A2A4A"
                        strokeWidth="1"
                      />
                    ))}

                    {/* Y-axis labels */}
                    <SvgText
                      x="5"
                      y={padding.top + 4}
                      fontSize="10"
                      fill="#888888"
                    >
                      {maxDaily}
                    </SvgText>
                    <SvgText
                      x="5"
                      y={padding.top + graphHeight / 2 + 4}
                      fontSize="10"
                      fill="#888888"
                    >
                      {Math.round(maxDaily / 2)}
                    </SvgText>
                    <SvgText
                      x="5"
                      y={padding.top + graphHeight + 4}
                      fontSize="10"
                      fill="#888888"
                    >
                      0
                    </SvgText>

                    {/* Area under the line */}
                    <Path
                      d={`M ${padding.left},${padding.top + graphHeight} ${dailyEntries
                        .map(([, count], index) => {
                          const x =
                            padding.left +
                            (index / (dailyEntries.length - 1 || 1)) *
                              graphWidth;
                          const y =
                            padding.top +
                            graphHeight -
                            (count / maxDaily) * graphHeight;
                          return `L ${x},${y}`;
                        })
                        .join(
                          " ",
                        )} L ${chartWidth - padding.right},${padding.top + graphHeight} Z`}
                      fill="rgba(76, 175, 80, 0.2)"
                    />

                    {/* Line */}
                    <Polyline
                      points={points}
                      fill="none"
                      stroke="#4CAF50"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Data points */}
                    {dailyEntries.map(([, count], index) => {
                      const x =
                        padding.left +
                        (index / (dailyEntries.length - 1 || 1)) * graphWidth;
                      const y =
                        padding.top +
                        graphHeight -
                        (count / maxDaily) * graphHeight;
                      return (
                        <G key={index}>
                          <Circle
                            cx={x}
                            cy={y}
                            r="6"
                            fill={theme.colors.backgroundLight}
                          />
                          <Circle cx={x} cy={y} r="4" fill="#4CAF50" />
                        </G>
                      );
                    })}

                    {/* X-axis labels */}
                    {dailyEntries.map(([date], index) => {
                      const x =
                        padding.left +
                        (index / (dailyEntries.length - 1 || 1)) * graphWidth;
                      const formattedDate = new Date(date).toLocaleDateString(
                        "en",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      );
                      return (
                        <SvgText
                          key={`label-${index}`}
                          x={x}
                          y={chartHeight - 5}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#888888"
                        >
                          {formattedDate}
                        </SvgText>
                      );
                    })}
                  </Svg>

                  {/* Values above points */}
                  <View style={styles.lineChartValuesContainer}>
                    {dailyEntries.map(([date, count], index) => (
                      <View
                        key={date}
                        style={[
                          styles.lineChartValue,
                          {
                            left:
                              padding.left +
                              (index / (dailyEntries.length - 1 || 1)) *
                                graphWidth -
                              15,
                            top:
                              padding.top +
                              graphHeight -
                              (count / maxDaily) * graphHeight -
                              25,
                          },
                        ]}
                      >
                        <Text style={styles.lineChartValueText}>{count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* Fish Type Distribution Pie Chart */}
        {Object.keys(analytics.fish_type_distribution).length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Fish Type Distribution</Text>
            {(() => {
              const fishEntries = Object.entries(
                analytics.fish_type_distribution,
              ).sort(([, a], [, b]) => b - a);
              const totalFish = fishEntries.reduce(
                (sum, [, count]) => sum + count,
                0,
              );
              let currentAngle = -90; // Start from top

              // Generate pie slices
              const slices = fishEntries.map(([fishType, count]) => {
                const percentage = (count / totalFish) * 100;
                const angle = (percentage / 100) * 360;
                const startAngle = currentAngle;
                currentAngle += angle;

                // Calculate arc path
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = ((startAngle + angle) * Math.PI) / 180;
                const x1 = 50 + 40 * Math.cos(startRad);
                const y1 = 50 + 40 * Math.sin(startRad);
                const x2 = 50 + 40 * Math.cos(endRad);
                const y2 = 50 + 40 * Math.sin(endRad);
                const largeArc = angle > 180 ? 1 : 0;

                return {
                  fishType,
                  count,
                  percentage,
                  color: getColor(fishType),
                  path:
                    angle >= 360
                      ? `M 50 10 A 40 40 0 1 1 49.99 10 Z` // Full circle
                      : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`,
                };
              });

              return (
                <View style={styles.fishPieContainer}>
                  <Svg width={160} height={160} viewBox="0 0 100 100">
                    {slices.map(({ fishType, path, color }) => (
                      <Path key={fishType} d={path} fill={color} />
                    ))}
                    {/* Center hole for donut effect */}
                    <Circle
                      cx="50"
                      cy="50"
                      r="25"
                      fill={theme.colors.backgroundLight}
                    />
                    <SvgText
                      x="50"
                      y="48"
                      textAnchor="middle"
                      fontSize="14"
                      fontWeight="bold"
                      fill="#FFFFFF"
                    >
                      {totalFish}
                    </SvgText>
                    <SvgText
                      x="50"
                      y="58"
                      textAnchor="middle"
                      fontSize="7"
                      fill="#888888"
                    >
                      Fish
                    </SvgText>
                  </Svg>
                  <View style={styles.fishPieLegend}>
                    {slices.map(({ fishType, count, percentage, color }) => (
                      <View key={fishType} style={styles.fishPieLegendItem}>
                        <View
                          style={[
                            styles.fishPieLegendDot,
                            { backgroundColor: color },
                          ]}
                        />
                        <Text
                          style={styles.fishPieLegendText}
                          numberOfLines={1}
                        >
                          {fishType}: {count} ({percentage.toFixed(0)}%)
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}
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
  // Time Range Selector Styles
  timeRangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  timeRangeLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  timeRangeButtons: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  timeRangeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.backgroundLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timeRangeButtonActive: {
    backgroundColor: `${theme.colors.primary}20`,
    borderColor: theme.colors.primary,
  },
  timeRangeButtonText: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.textMuted,
  },
  timeRangeButtonTextActive: {
    color: theme.colors.primary,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.backgroundLight,
    gap: 6,
  },
  activeTab: {
    backgroundColor: `${theme.colors.primary}20`,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.textMuted,
  },
  activeTabText: {
    color: theme.colors.primary,
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
  // Color Consistency Styles
  chartSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.textSecondary,
    marginTop: 20,
    marginBottom: 12,
  },
  colorScoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 8,
  },
  colorScoreCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.colors.primary + "30",
    borderWidth: 3,
    borderColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  colorScoreValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  colorScoreLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  colorScoreInfo: {
    flex: 1,
  },
  colorInfoText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  gradeContainer: {
    gap: 10,
  },
  gradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gradeLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 70,
    gap: 6,
  },
  gradeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gradeLabel: {
    fontSize: 12,
    color: "#CCC",
  },
  gradeBarTrack: {
    flex: 1,
    height: 16,
    backgroundColor: "#2A2A4A",
    borderRadius: 8,
    overflow: "hidden",
  },
  gradeBarFill: {
    height: "100%",
    borderRadius: 8,
  },
  gradeValue: {
    width: 70,
    fontSize: 12,
    color: "#fff",
    textAlign: "right",
  },
  colorByTypeContainer: {
    gap: 10,
  },
  colorTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorTypeLabel: {
    width: 100,
    fontSize: 12,
    color: "#CCC",
  },
  colorTypeBarContainer: {
    flex: 1,
    height: 18,
    backgroundColor: "#2A2A4A",
    borderRadius: 9,
    overflow: "hidden",
  },
  colorTypeBar: {
    height: "100%",
    borderRadius: 9,
  },
  colorTypeValue: {
    width: 40,
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    textAlign: "right",
  },
  // Circular Pie Chart Styles
  circularPieContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  // Scatter Plot Styles
  scatterPlotContainer: {
    position: "relative",
    marginTop: 10,
  },
  scatterYLabel: {
    position: "absolute",
    left: 0,
    top: "40%",
    fontSize: 10,
    color: "#AAAAAA",
    transform: [{ rotate: "-90deg" }],
    width: 80,
    textAlign: "center",
  },
  scatterLegend: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    flexWrap: "wrap",
  },
  scatterLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scatterLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scatterLegendText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  // Line Chart Styles
  lineChartContainer: {
    position: "relative",
    marginTop: 10,
  },
  lineChartValuesContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  lineChartValue: {
    position: "absolute",
    width: 30,
    alignItems: "center",
  },
  lineChartValueText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#4CAF50",
  },
  // Fish Type Pie Chart Styles
  fishPieContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fishPieLegend: {
    flex: 1,
    marginLeft: 16,
    gap: 6,
  },
  fishPieLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fishPieLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fishPieLegendText: {
    fontSize: 11,
    color: "#CCC",
    flex: 1,
  },
  // Mold Analysis Styles
  moldSummaryContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  moldSummaryCard: {
    flex: 1,
    backgroundColor: "rgba(244, 67, 54, 0.1)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(244, 67, 54, 0.3)",
  },
  moldSummaryValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#F44336",
  },
  moldSummaryLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  moldSeverityContainer: {
    gap: 10,
    marginBottom: 8,
  },
  moldSeverityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  moldSeverityLabel: {
    flexDirection: "row",
    alignItems: "center",
    width: 90,
    gap: 8,
  },
  moldSeverityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  moldSeverityText: {
    fontSize: 13,
    color: theme.colors.text,
  },
  moldSeverityBarTrack: {
    flex: 1,
    height: 16,
    backgroundColor: "#2A2A4A",
    borderRadius: 8,
    overflow: "hidden",
  },
  moldSeverityBarFill: {
    height: "100%",
    borderRadius: 8,
  },
  moldSeverityCount: {
    width: 30,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    textAlign: "right",
  },
  spatialDistributionContainer: {
    marginBottom: 8,
  },
  fishDiagramContainer: {
    alignItems: "center",
  },
  // Split fish diagram for daing na hati sa gitna
  splitFishDiagram: {
    flexDirection: "column",
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  splitFishZone: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.2)",
  },
  splitFishZoneTop: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  splitFishZoneBottom: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomWidth: 0,
  },
  // Legacy horizontal fish diagram (kept for reference)
  fishDiagram: {
    flexDirection: "row",
    width: "100%",
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  fishZone: {
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.1)",
  },
  fishZoneHead: {
    flex: 1,
    borderTopLeftRadius: 50,
    borderBottomLeftRadius: 30,
  },
  fishZoneBodyUpper: {
    flex: 1.5,
  },
  fishZoneBelly: {
    flex: 1.5,
  },
  fishZoneTail: {
    flex: 1,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 40,
    borderRightWidth: 0,
  },
  fishZoneLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.text,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  fishZoneValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.text,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heatMapLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heatMapLegendText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  heatMapGradient: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
  },
  heatMapGradientStep: {
    width: 30,
    height: "100%",
  },
  moldByTypeContainer: {
    gap: 10,
  },
  moldTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  moldTypeLabel: {
    width: 100,
    fontSize: 12,
    color: "#CCC",
  },
  moldTypeBarContainer: {
    flex: 1,
    height: 18,
    backgroundColor: "#2A2A4A",
    borderRadius: 9,
    overflow: "hidden",
  },
  moldTypeBar: {
    height: "100%",
    borderRadius: 9,
  },
  moldTypeValue: {
    width: 50,
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    textAlign: "right",
  },
  // Defect Pattern Analysis Styles
  defectFrequencyContainer: {
    gap: 10,
    marginBottom: 16,
  },
  defectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  defectLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 140,
    gap: 8,
  },
  defectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  defectLabel: {
    fontSize: 12,
    color: "#CCC",
    flex: 1,
  },
  defectBarTrack: {
    flex: 1,
    height: 16,
    backgroundColor: "#2A2A4A",
    borderRadius: 8,
    overflow: "hidden",
  },
  defectBarFill: {
    height: "100%",
    borderRadius: 8,
  },
  defectValue: {
    width: 80,
    fontSize: 12,
    color: "#fff",
    textAlign: "right",
  },
  mostCommonDefect: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 152, 0, 0.3)",
  },
  mostCommonDefectText: {
    fontSize: 13,
    color: theme.colors.text,
    flex: 1,
  },
  mostCommonDefectHighlight: {
    fontWeight: "600",
    color: "#FF9800",
  },
  speciesSusceptibilityContainer: {
    gap: 10,
  },
  susceptibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  susceptibilityInfo: {
    width: 110,
  },
  susceptibilityFishType: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: "600",
  },
  susceptibilityStats: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  susceptibilityBarContainer: {
    flex: 1,
    height: 16,
    backgroundColor: "#2A2A4A",
    borderRadius: 8,
    overflow: "hidden",
  },
  susceptibilityBar: {
    height: "100%",
    borderRadius: 8,
  },
  susceptibilityRate: {
    width: 45,
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    textAlign: "right",
  },
  // Quality Grade Classification Styles
  qualitySummaryContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  qualitySummaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  qualitySummaryValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  qualitySummaryLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  qualityBySpeciesContainer: {
    gap: 10,
    marginBottom: 12,
  },
  qualitySpeciesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qualitySpeciesName: {
    width: 100,
    fontSize: 12,
    color: theme.colors.text,
  },
  qualityStackedBar: {
    flex: 1,
    height: 18,
    flexDirection: "row",
    backgroundColor: "#2A2A4A",
    borderRadius: 9,
    overflow: "hidden",
  },
  qualityStackedSegment: {
    height: "100%",
  },
  qualitySpeciesCount: {
    width: 30,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: "right",
  },
  qualityLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 16,
  },
  qualityLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qualityLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  qualityLegendText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  qualityTrendContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 100,
    alignItems: "flex-end",
    gap: 4,
  },
  qualityTrendDay: {
    flex: 1,
    alignItems: "center",
  },
  qualityTrendBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 70,
    gap: 2,
  },
  qualityTrendBar: {
    width: 8,
    borderRadius: 4,
    minHeight: 2,
  },
  qualityTrendDate: {
    fontSize: 9,
    color: theme.colors.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },
});
