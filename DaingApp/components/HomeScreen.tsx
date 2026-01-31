import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { homeStyles } from "../styles/home";
import type { Screen } from "../types";

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
  onOpenSettings: () => void;
  autoSaveDataset: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenSettings,
  autoSaveDataset,
}) => {
  return (
    <View style={homeStyles.homeContainer}>
      {/* HEADER */}
      <View style={homeStyles.header}>
        <View style={{ width: 44 }} />
        <Text style={homeStyles.appTitle}>DaingGrader</Text>
        <TouchableOpacity
          style={homeStyles.settingsButton}
          onPress={onOpenSettings}
        >
          <Ionicons name="settings-outline" size={24} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* HERO SECTION */}
      <View style={homeStyles.heroSection}>
        <TouchableOpacity
          style={homeStyles.heroButton}
          onPress={() => onNavigate("scan")}
          activeOpacity={0.85}
        >
          <View style={homeStyles.heroButtonInner}>
            <Ionicons name="scan" size={64} color="#fff" />
            <Text style={homeStyles.heroButtonText}>SCAN</Text>
            <Text style={homeStyles.heroButtonSubtext}>Analyze Dried Fish</Text>
          </View>
        </TouchableOpacity>
        <Text style={homeStyles.tagline}>
          AI-powered dried fish quality detection
        </Text>
      </View>

      {/* NAVIGATION GRID */}
      <View style={homeStyles.buttonGrid}>
        <View style={homeStyles.buttonRow}>
          <TouchableOpacity
            style={homeStyles.gridButton}
            onPress={() => onNavigate("history")}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={22} color="#94A3B8" />
            <Text style={homeStyles.gridButtonText}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={homeStyles.gridButton}
            onPress={() => onNavigate("analytics")}
            activeOpacity={0.7}
          >
            <Ionicons name="stats-chart-outline" size={22} color="#94A3B8" />
            <Text style={homeStyles.gridButtonText}>Analytics</Text>
          </TouchableOpacity>
        </View>

        {autoSaveDataset && (
          <View style={homeStyles.buttonRow}>
            <TouchableOpacity
              style={[homeStyles.gridButton, homeStyles.datasetButton]}
              onPress={() => onNavigate("autoDataset")}
              activeOpacity={0.7}
            >
              <Ionicons name="folder-outline" size={22} color="#10B981" />
              <Text
                style={[
                  homeStyles.gridButtonText,
                  homeStyles.datasetButtonText,
                ]}
              >
                Auto Dataset
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};
