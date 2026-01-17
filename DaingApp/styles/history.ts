import { StyleSheet } from "react-native";

export const historyStyles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  columnWrapper: {
    gap: 16,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: "#111836",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2a44",
  },
  thumbnail: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#0f172a",
  },
  timestamp: {
    color: "#94a3b8",
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    color: "white",
    fontWeight: "600",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 10,
  },
});
