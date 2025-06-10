import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Health check function
export const healthCheck = async () => {
  const response = await api.get("/health");
  return response.data;
};
    