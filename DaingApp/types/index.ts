export type Screen = "home" | "scan" | "analytics" | "history" | "autoDataset";

export interface HistoryEntry {
  id: string;
  url: string;
  timestamp: string;
  folder?: string;
}

export interface AnalyticsSummary {
  status: string;
  total_scans: number;
  daing_scans: number;
  non_daing_scans: number;
  fish_type_distribution: Record<string, number>;
  average_confidence: Record<string, number>;
  daily_scans: Record<string, number>;
}
