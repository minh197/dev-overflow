import axios from "axios";

const baseURL = "http://localhost:3001";
console.log("BASE URL:", baseURL);

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
});
