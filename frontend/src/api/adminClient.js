// adminClient.js
// A separate API client for the Admin Portal, kept deliberately distinct
// from the public site's api/client.js. Uses its own localStorage keys
// (adminPortalToken / adminPortalUser) so an admin session never mixes
// with a candidate/recruiter session in the same browser.

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export function getAdminToken() {
  return localStorage.getItem("adminPortalToken");
}

export function getAdminUser() {
  const raw = localStorage.getItem("adminPortalUser");
  return raw ? JSON.parse(raw) : null;
}

export function setAdminSession(token, admin) {
  localStorage.setItem("adminPortalToken", token);
  localStorage.setItem("adminPortalUser", JSON.stringify(admin));
}

export function clearAdminSession() {
  localStorage.removeItem("adminPortalToken");
  localStorage.removeItem("adminPortalUser");
}

export async function adminApiRequest(endpoint, method = "GET", body = null) {
  const token = getAdminToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    clearAdminSession();
    window.location.href = "/admin-portal/login";
    throw new Error("Session expired -- please log in again");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }
  return data;
}
