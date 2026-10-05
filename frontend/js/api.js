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

  // Standard backend envelope: { success, message, data }. Unwrap `data` and
  // fold `message` alongside it, so existing call sites (which read fields
  // like `result.token` or `result.transactions`) keep working unchanged.
  if (data && typeof data === "object" && "success" in data) {
    const payload = data.data && typeof data.data === "object" ? data.data : {};
    return { ...payload, message: data.message };
  }
  return data;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Symbol/prefix per currency. SOS and ETB have no widely-used symbol, so they
// use their ISO code as a prefix instead (still unambiguous, which matters
// more than brevity for a financial app).
const CURRENCY_SYMBOLS = { USD: "$", EUR: "€", GBP: "£", KES: "KES ", SOS: "SOS ", ETB: "ETB " };

function currentCurrency() {
  const user = (typeof getUser === "function" && getUser()) || null;
  return (user && user.currency) || "USD";
}

function money(n, currency) {
  const value = Number(n || 0);
  const text = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = CURRENCY_SYMBOLS[currency || currentCurrency()] || "$";
  return (value < 0 ? "-" : "") + symbol + text;
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
  toast(text, kind);
}
function hideMsg(el) { el.hidden = true; }

// ---------- Toast notifications (slide in, auto-dismiss) ----------
function toastRegion() {
  let region = document.getElementById("toastRegion");
  if (!region) {
    region = document.createElement("div");
    region.id = "toastRegion";
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    document.body.appendChild(region);
  }
  return region;
}

function toast(text, kind = "success") {
  const region = toastRegion();
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = text;
  region.appendChild(el);

  const remove = () => {
    el.classList.add("toast-out");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // fallback if transitionend doesn't fire
  };
  const timer = setTimeout(remove, kind === "error" ? 5000 : 3500);
  el.addEventListener("click", () => { clearTimeout(timer); remove(); });
}

// ---------- Skeleton loaders (shown while a request is in flight) ----------
function skeletonTiles(container, count = 4) {
  container.innerHTML = Array.from({ length: count })
    .map(() => `
      <div class="tile skeleton-tile" aria-hidden="true">
        <div class="tile-body">
          <div class="skeleton-line" style="width:70%;height:1.6em;"></div>
          <div class="skeleton-line" style="width:45%;margin-top:8px;"></div>
        </div>
      </div>`)
    .join("");
}

function skeletonRows(tbody, cols, rows = 4) {
  tbody.innerHTML = Array.from({ length: rows })
    .map(() => `<tr aria-hidden="true">${Array.from({ length: cols }).map(() => `<td><div class="skeleton-line"></div></td>`).join("")}</tr>`)
    .join("");
}
