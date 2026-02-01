export type Screen = "home" | "scan" | "analytics" | "history" | "autoDataset";

export interface HistoryEntry {
  id: string;
  url: string;
  timestamp: string;
  folder?: string;
}

export interface ColorConsistencyStats {
  average_score: number;
  grade_distribution: {
    Export: number;
    Local: number;
    Reject: number;
  };
  by_fish_type: Record<string, { avg_score: number; count: number }>;
}

export interface AnalysisScanResult {
  status: string;
  is_daing_detected: boolean;
  result_image: string;
  detections: Array<{ fish_type: string; confidence: number }>;
  color_analysis: {
    consistency_score: number;
    quality_grade: string;
    avg_std_deviation: number;
  } | null;
}

export interface AnalyticsSummary {
  status: string;
  total_scans: number;
  daing_scans: number;
  non_daing_scans: number;
  fish_type_distribution: Record<string, number>;
  average_confidence: Record<string, number>;
  daily_scans: Record<string, number>;
  color_consistency?: ColorConsistencyStats;
}
