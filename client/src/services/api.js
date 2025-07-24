import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // You can add auth tokens here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Server responded with error
      const message =
        error.response.data?.error ||
        error.response.data?.message ||
        "An error occurred";
      throw new Error(message);
    } else if (error.request) {
      // Request made but no response
      throw new Error("No response from server. Please check your connection.");
    } else {
      // Something else happened
      throw new Error("An unexpected error occurred");
    }
  }
);

export const downloaderAPI = {
  // Get video information
  getVideoInfo: async (url) => {
    const response = await api.post("/download/info", { url });
    return response.data;
  },

  // Get download URL
  getDownloadURL: (url, itag, type) => {
    const params = new URLSearchParams({ url, itag, type });
    return `${API_URL}/download/video?${params}`;
  },

  // Get progress tracking URL (for Server-Sent Events)
  getProgressURL: (url, itag, type) => {
    const params = new URLSearchParams({ url, itag, type });
    return `${API_URL}/download/progress?${params}`;
  },

  // Check server health
  checkHealth: async () => {
    const response = await api.get("/download/health");
    return response.data;
  },

  // List available formats (for debugging)
  listFormats: async (url) => {
    const response = await api.get("/download/formats", {
      params: { url },
    });
    return response.data;
  },

  // Download with progress using fetch (alternative to SSE)
  downloadWithProgress: async (url, itag, type, onProgress) => {
    const downloadUrl = downloaderAPI.getDownloadURL(url, itag, type);

    try {
      const response = await fetch(downloadUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Download failed: ${response.status}`
        );
      }

      const reader = response.body.getReader();
      const contentLength = +response.headers.get("Content-Length");

      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        // Calculate and report progress
        if (contentLength && onProgress) {
          const progress = (receivedLength / contentLength) * 100;
          onProgress({
            progress,
            receivedBytes: receivedLength,
            totalBytes: contentLength,
            receivedFormatted: formatBytes(receivedLength),
            totalFormatted: formatBytes(contentLength),
          });
        }
      }

      // Combine chunks into single Uint8Array
      const chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      return new Blob([chunksAll]);
    } catch (error) {
      console.error("Download error:", error);
      throw error;
    }
  },

  // Create EventSource for progress tracking
  createProgressEventSource: (url, itag, type, handlers) => {
    const progressUrl = downloaderAPI.getProgressURL(url, itag, type);
    const eventSource = new EventSource(progressUrl);

    // Set up event handlers
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "connected":
            handlers.onConnected?.(data);
            break;
          case "info":
            handlers.onInfo?.(data);
            break;
          case "progress":
            handlers.onProgress?.(data);
            break;
          case "complete":
            handlers.onComplete?.(data);
            eventSource.close();
            break;
          case "error":
            handlers.onError?.(data);
            eventSource.close();
            break;
          default:
            console.log("Unknown event type:", data.type);
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
        handlers.onError?.({ message: "Failed to parse server response" });
      }
    };

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      handlers.onError?.({ message: "Connection lost. Please try again." });
      eventSource.close();
    };

    return eventSource;
  },

  // Helper function to download blob as file
  downloadBlob: (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default api;
