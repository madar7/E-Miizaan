// Shared helpers: session storage, API requests, formatting, messages.
const API_BASE = (window.API_BASE_URL || "http://localhost:5000") + "/api";

function getToken() { return localStorage.getItem("emiizaan_token"); }
function setToken(token) { localStorage.setItem("emiizaan_token", token); }
function setUser(user) { localStorage.setItem("emiizaan_user", JSON.stringify(user)); }
function getUser() {
  const raw = localStorage.getItem("emiizaan_user");
  try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
}
function clearSession() {
  localStorage.removeItem("emiizaan_token");
  localStorage.removeItem("emiizaan_user");
}

async function apiRequest(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
  }

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (_) { /* no JSON body */ }

  if (!res.ok) {
    const error = new Error((data && data.message) || "Request failed");
    error.status = res.status;
    throw error;
  }
  return data;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function money(n) {
  const value = Number(n || 0);
  const text = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (value < 0 ? "-$" : "$") + text;
}

// The user's own calendar date as YYYY-MM-DD (not UTC).
function localDateStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Stored dates are UTC midnight of the chosen day, so display them in UTC.
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function showMsg(el, text, kind = "error") {
  el.textContent = text;
  el.className = "msg " + kind;
  el.hidden = false;
}
function hideMsg(el) { el.hidden = true; }
