import { StyleSheet } from "react-native";

const theme = {
  colors: {
    primary: '#3B82F6',
    background: '#0F172A',
    backgroundLight: '#1E293B',
    text: '#FFFFFF',
    textSecondary: '#94A3B8',
    border: '#334155',
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
};

export const dataGatheringStyles = StyleSheet.create({
  selectionPanel: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    paddingHorizontal: 20,
    paddingVertical: 16,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  
  statusLabel: {
    position: "absolute",
    top: 10,
    left: 20,
    right: 20,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    zIndex: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  statusText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  
  pickerGroup: {
    marginBottom: 12,
  },
  
  pickerLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  
  selectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  
  selectorButton: {
    backgroundColor: theme.colors.backgroundLight,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  selectorButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  
  selectorButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  
  selectorButtonTextActive: {
    color: theme.colors.text,
  },
  
  previewCenteredBar: {
    position: "absolute",
    top: 10,
    left: 20,
    right: 20,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    zIndex: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  previewCenteredText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  
  previewSelectionPanel: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    paddingHorizontal: 20,
    paddingVertical: 16,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  
  previewValueText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  
  previewInfoBar: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.md,
    marginBottom: 15,
    position: "absolute",
    top: 10,
    zIndex: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  previewInfoText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});
