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

  // Check server health
  checkHealth: async () => {
    const response = await api.get("/download/health");
    return response.data;
  },
};

export default api;
