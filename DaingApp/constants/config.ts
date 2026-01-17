// Default server base URL (can be customized in settings)
export const DEFAULT_SERVER_BASE_URL = "http://192.168.1.108:8000";

// Generate API URLs from base URL
export const getServerUrls = (baseUrl: string) => ({
  analyze: `${baseUrl}/analyze`,
  uploadDataset: `${baseUrl}/upload-dataset`,
  history: `${baseUrl}/history`,
});

// Fish types available in the app
export const FISH_TYPES = [
  "danggit",
  "galunggong",
  "espada",
  "bangus",
  "pusit",
] as const;

// Condition options for data gathering
export const CONDITIONS = [
  { label: "Local", value: "local_quality" },
  { label: "Export", value: "export_quality" },
  { label: "Moldy", value: "moldy" },
  { label: "Fresh", value: "fresh" },
] as const;
