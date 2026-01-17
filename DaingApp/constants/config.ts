// =========================================================
// 🛑 IMPORTANT: REPLACE THIS WITH YOUR COMPUTER'S IP
// Example: 'http://192.168.1.5:8000/analyze'
// =========================================================
export const SERVER_URL = "http://192.168.1.108:8000/analyze";
export const DATA_GATHERING_URL = "http://192.168.1.108:8000/upload-dataset";

// Fish types available in the app
export const FISH_TYPES = ["danggit", "tunsoy", "dilis"] as const;

// Condition options for data gathering
export const CONDITIONS = [
  { label: "Local", value: "local_quality" },
  { label: "Export", value: "export_quality" },
  { label: "Moldy", value: "moldy" },
  { label: "Fresh", value: "fresh" },
] as const;
