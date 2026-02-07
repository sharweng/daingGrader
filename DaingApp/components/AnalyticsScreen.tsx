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
            <Text style={styles.chartTitle}>
              🦠 Mold Contamination Analysis
            </Text>

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
              Spatial Distribution (Most Affected Areas)
            </Text>
            <View style={styles.spatialDistributionContainer}>
              <View style={styles.fishDiagramContainer}>
                {/* Fish body outline representation */}
                <View style={styles.fishDiagram}>
                  {/* Head zone */}
                  <View
                    style={[
                      styles.fishZone,
                      styles.fishZoneHead,
                      {
                        backgroundColor: getZoneHeatColor(
                          analytics.mold_analysis.spatial_zones.head
                            ?.fish_affected || 0,
                          analytics.total_scans,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.fishZoneLabel}>Head</Text>
                    <Text style={styles.fishZoneValue}>
                      {analytics.mold_analysis.spatial_zones.head
                        ?.fish_affected || 0}
                    </Text>
                  </View>
                  {/* Body upper zone */}
                  <View
                    style={[
                      styles.fishZone,
                      styles.fishZoneBodyUpper,
                      {
                        backgroundColor: getZoneHeatColor(
                          analytics.mold_analysis.spatial_zones.body_upper
                            ?.fish_affected || 0,
                          analytics.total_scans,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.fishZoneLabel}>Body</Text>
                    <Text style={styles.fishZoneValue}>
                      {analytics.mold_analysis.spatial_zones.body_upper
                        ?.fish_affected || 0}
                    </Text>
                  </View>
                  {/* Belly zone */}
                  <View
                    style={[
                      styles.fishZone,
                      styles.fishZoneBelly,
                      {
                        backgroundColor: getZoneHeatColor(
                          analytics.mold_analysis.spatial_zones.belly
                            ?.fish_affected || 0,
                          analytics.total_scans,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.fishZoneLabel}>Belly</Text>
                    <Text style={styles.fishZoneValue}>
                      {analytics.mold_analysis.spatial_zones.belly
                        ?.fish_affected || 0}
                    </Text>
                  </View>
                  {/* Tail zone */}
                  <View
                    style={[
                      styles.fishZone,
                      styles.fishZoneTail,
                      {
                        backgroundColor: getZoneHeatColor(
                          analytics.mold_analysis.spatial_zones.tail
                            ?.fish_affected || 0,
                          analytics.total_scans,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.fishZoneLabel}>Tail</Text>
                    <Text style={styles.fishZoneValue}>
                      {analytics.mold_analysis.spatial_zones.tail
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

        {/* Daily Scans - Line Graph */}
        {Object.keys(analytics.daily_scans).length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>
              Daily Scans Trend (Last 7 Days)
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
});
