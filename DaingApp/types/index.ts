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

// Mold Analysis Types
export interface MoldSpatialZone {
  patch_count: number;
  coverage_pixels: number;
  fish_pixels: number;
  coverage_percent: number;
}

export interface MoldFishResult {
  region_index: number;
  mold_detected: boolean;
  mold_coverage_percent: number;
  severity: "None" | "Low" | "Moderate" | "Severe";
  patch_count: number;
  spatial_distribution: {
    zones: Record<string, MoldSpatialZone>;
    center_coords: [number, number] | null;
    total_patches: number;
  };
  characteristics: {
    dominant_color: string | null;
    color_variance: number;
    avg_darkness: number;
  };
}

export interface MoldAnalysisResult {
  overall_severity: "None" | "Low" | "Moderate" | "Severe";
  avg_coverage_percent: number;
  fish_analyzed: number;
  fish_with_mold: number;
  total_patches: number;
  fish_results: MoldFishResult[];
  spatial_summary: {
    zones: Record<
      string,
      { total_patches: number; total_coverage: number; fish_affected: number }
    >;
    total_fish_analyzed: number;
    most_affected_zone: string | null;
  };
  characteristics: {
    most_common_color: string | null;
    avg_darkness: number;
    color_distribution: Record<string, number>;
  };
  analysis_method: string;
}

export interface MoldAnalyticsStats {
  severity_distribution: {
    None: number;
    Low: number;
    Moderate: number;
    Severe: number;
  };
  average_coverage: number;
  spatial_zones: Record<
    string,
    { fish_affected: number; total_patches: number }
  >;
  by_fish_type: Record<
    string,
    {
      total_scans: number;
      contaminated_scans: number;
      contamination_rate: number;
      avg_coverage: number;
    }
  >;
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
  mold_analysis: MoldAnalysisResult | null;
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
  mold_analysis?: MoldAnalyticsStats;
}
