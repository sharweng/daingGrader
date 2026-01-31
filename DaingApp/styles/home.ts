import { StyleSheet } from "react-native";

const theme = {
  colors: {
    primary: "#3B82F6",
    primaryDark: "#2563EB",
    accent: "#8B5CF6",
    success: "#10B981",
    background: "#0F172A",
    backgroundLight: "#1E293B",
    surface: "#1E293B",
    text: "#FFFFFF",
    textSecondary: "#94A3B8",
    border: "#334155",
  },
};

export const homeStyles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },

  appTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    letterSpacing: 0.5,
  },

  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
  },

  // Hero section with scan button
  heroSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  heroButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 12,
  },

  heroButtonInner: {
    alignItems: "center",
  },

  heroButtonText: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 12,
    letterSpacing: 2,
  },

  heroButtonSubtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },

  // Tagline under hero
  tagline: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: 32,
    textAlign: "center",
  },

  // Button grid at bottom
  buttonGrid: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },

  // Modern card-style navigation buttons
  gridButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },

  gridButtonIcon: {
    marginRight: 4,
  },

  gridButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.text,
  },

  // Dataset button (green accent)
  datasetButton: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },

  datasetButtonText: {
    color: "#10B981",
  },
});
