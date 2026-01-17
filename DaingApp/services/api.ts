import axios from "axios";
import type { FishType, Condition, HistoryEntry } from "../types";

export const analyzeFish = async (
  imageUri: string,
  serverUrl: string
): Promise<string> => {
  const formData = new FormData();
  // @ts-ignore: React Native FormData requires these specific fields
  formData.append("file", {
    uri: imageUri,
    name: "fish.jpg",
    type: "image/jpeg",
  });

  const response = await axios.post(serverUrl, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    responseType: "blob",
  });

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
};

export const uploadDataset = async (
  imageUri: string,
  fishType: FishType,
  condition: Condition,
  uploadUrl: string
): Promise<{ success: boolean; message: string; error?: string }> => {
  const formData = new FormData();
  // @ts-ignore: React Native FormData requires these specific fields
  formData.append("file", {
    uri: imageUri,
    name: `${fishType}_${condition}_${Date.now()}.jpg`,
    type: "image/jpeg",
  });
  formData.append("fish_type", fishType);
  formData.append("condition", condition);

  try {
    const response = await axios.post(uploadUrl, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // Check if backend returned success status
    if (response.data.status === "success") {
      return {
        success: true,
        message: "Image uploaded to Cloudinary successfully!",
      };
    } else if (response.data.status === "error") {
      return {
        success: false,
        message: "Upload failed",
        error: response.data.message || "Unknown error occurred",
      };
    } else {
      return {
        success: false,
        message: "Upload failed",
        error: "Unexpected response from server",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: "Network error",
      error: error.message || "Failed to connect to server",
    };
  }
};

export const fetchHistory = async (
  historyUrl: string
): Promise<HistoryEntry[]> => {
  try {
    const response = await axios.get(historyUrl);
    const entries = response.data?.entries;
    if (Array.isArray(entries)) {
      return entries as HistoryEntry[];
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch history", error);
    throw new Error("Unable to load history");
  }
};
