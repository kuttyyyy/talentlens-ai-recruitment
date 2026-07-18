// client.js
// A small helper for talking to our FastAPI backend.
// Keeping this in one place means if the backend URL ever changes,
// we only update it here instead of in every single page.

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function apiRequest(endpoint, method = "GET", body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await response.json();

  // If the backend responded with an error (like 400, 401, 500),
  // throw it so the page that called this can catch it and show a message.
  if (!response.ok) {
    throw new Error(data.detail || "Something went wrong");
  }

  return data;
}