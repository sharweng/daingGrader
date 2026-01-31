import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { commonStyles, theme } from "../styles/common";
import type { Screen } from "../types";

interface DatasetScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const DatasetScreen: React.FC<DatasetScreenProps> = ({ onNavigate }) => {
  return (
    <View style={commonStyles.container}>
      <View style={commonStyles.screenHeader}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => onNavigate("home")}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={commonStyles.screenTitle}>Dataset</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={commonStyles.centerContent}>
        <View style={styles.emptyIcon}>
          <Ionicons name="folder-open-outline" size={48} color={theme.colors.primary} />
        </View>
        <Text style={styles.emptyText}>No Dataset Yet</Text>
        <Text style={styles.emptySubtext}>
          Collected training data will be managed here
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 250,
  },
});
