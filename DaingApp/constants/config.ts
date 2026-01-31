// Default server base URL (can be customized in settings)
export const DEFAULT_SERVER_BASE_URL = "http://192.168.1.109:8000";

const normalizeBaseUrl = (baseUrl: string) =>
  baseUrl.trim().replace(/\/+$/, "");

// Generate API URLs from base URL
export const getServerUrls = (baseUrl: string) => {
  const normalized = normalizeBaseUrl(baseUrl || DEFAULT_SERVER_BASE_URL);
  return {
    analyze: `${normalized}/analyze`,
    history: `${normalized}/history`,
    analytics: `${normalized}/analytics/summary`,
    autoDataset: `${normalized}/auto-dataset`,
  } as const;
};
