import axios from "axios";
import type { HistoryEntry, AnalyticsSummary } from "../types";

const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, "");

// Retry helper for network requests
const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
): Promise<T> => {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Only retry on network errors, not on server errors
      if (
        error.code === "ERR_NETWORK" ||
        error.code === "ECONNABORTED" ||
        error.message?.includes("Network Error") ||
        error.message?.includes("timeout")
      ) {
        if (i < retries - 1) {
          console.log(`Retry ${i + 1}/${retries} after ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
  throw lastError;
};

export const analyzeFish = async (
  imageUri: string,
  serverUrl: string,
  autoSaveDataset: boolean = false,
): Promise<string> => {
  const formData = new FormData();
  // @ts-ignore: React Native FormData requires these specific fields
  formData.append("file", {
    uri: imageUri,
    name: "fish.jpg",
    type: "image/jpeg",
  });

  // Add auto_save_dataset flag to request
  const urlWithParams = autoSaveDataset
    ? `${serverUrl}?auto_save_dataset=true`
    : serverUrl;

  try {
    const response = await withRetry(
      () =>
        axios.post(urlWithParams, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          responseType: "blob",
          timeout: 30000, // 30 seconds timeout (increased from 10)
        }),
      3, // 3 retries
      1000, // 1 second delay between retries
    );

    // Convert Blob to Viewable Image
    return new Promise((resolve, reject) => {
      const fileReaderInstance = new FileReader();
      fileReaderInstance.readAsDataURL(response.data);
      fileReaderInstance.onload = () => {
        if (typeof fileReaderInstance.result === "string") {
          resolve(fileReaderInstance.result);
        } else {
          reject(new Error("Failed to convert image"));
        }
      };
      fileReaderInstance.onerror = () =>
        reject(new Error("Failed to read image"));
    });
  } catch (error: any) {
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      throw new Error(
        "Request timed out. Please check your server IP address and try again.",
      );
    } else if (
      error.code === "ERR_NETWORK" ||
      error.message?.includes("Network Error")
    ) {
      throw new Error(
        "Cannot connect to server. Please verify the IP address is correct.",
      );
    } else {
      throw new Error(error.message || "Failed to analyze image");
    }
  }
};

export const fetchHistory = async (
  historyUrl: string,
): Promise<HistoryEntry[]> => {
  try {
    const response = await axios.get(normalizeUrl(historyUrl), {
      timeout: 10000, // 10 seconds timeout
    });
    const entries = response.data?.entries;
    if (Array.isArray(entries)) {
      return entries as HistoryEntry[];
    }
    return [];
  } catch (error: any) {
    // Silently return empty array - don't trigger Expo error overlay
    return [];
  }
};

export const deleteHistoryEntry = async (
  historyUrl: string,
  entryId: string,
): Promise<void> => {
  const base = normalizeUrl(historyUrl);
  const encodedId = encodeURIComponent(entryId);
  await axios.delete(`${base}/${encodedId}`, {
    timeout: 10000, // 10 seconds timeout
  });
};

export const fetchAnalytics = async (
  analyticsUrl: string,
): Promise<AnalyticsSummary> => {
  try {
    const response = await axios.get<AnalyticsSummary>(
      normalizeUrl(analyticsUrl),
      {
        timeout: 10000,
      },
    );
    return response.data;
  } catch (error: any) {
    // Return empty analytics on error
    return {
      status: "error",
      total_scans: 0,
      daing_scans: 0,
      non_daing_scans: 0,
      fish_type_distribution: {},
      average_confidence: {},
      daily_scans: {},
    };
  }
};

export const fetchAutoDataset = async (
  autoDatasetUrl: string,
): Promise<HistoryEntry[]> => {
  try {
    const response = await axios.get(normalizeUrl(autoDatasetUrl), {
      timeout: 10000,
    });
    const entries = response.data?.entries;
    if (Array.isArray(entries)) {
      return entries as HistoryEntry[];
    }
    return [];
  } catch (error: any) {
    return [];
  }
};

export const deleteAutoDatasetEntry = async (
  autoDatasetUrl: string,
  entryId: string,
): Promise<void> => {
  const base = normalizeUrl(autoDatasetUrl);
  const encodedId = encodeURIComponent(entryId);
  await axios.delete(`${base}/${encodedId}`, {
    timeout: 10000,
  });
};
