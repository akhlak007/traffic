const localStaticPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  && window.location.port !== "5000";
const DEFAULT_API_BASE_URL = localStaticPreview
  ? "http://localhost:5000/api"
  : `${window.location.origin}/api`;
const MOCK_BASE_URL = new URL("../mock-data/", import.meta.url);

const API_ENDPOINTS = Object.freeze({
  health: "health",
  vehicles: "vehicles",
  vehicleStatus: "vehicle-status",
  notices: "notices",
  appeals: "appeals",
  payments: "payments",
  databaseTables: "database/tables",
  cameras: "cameras",
  zones: "zones",
  roadSegments: "roadSegments",
  users: "users",
  cameraEvents: "cameraEvents",
  violationEvents: "violationEvents",
  evidence: "evidence",
  alertEvents: "alertEvents",
  roadDefectEvents: "roadDefectEvents",
  suspiciousVehicleEvents: "suspiciousVehicleEvents",
  riskAnalysis: "riskAnalysis",
  vehicleJourney: "vehicleJourney",
  congestionEvents: "congestion-events",
  cameraAverageReport: "reports/cameras-above-average",
  vehicleViolationsReport: "reports/vehicle-violations",
  vehicleProfileReport: "reports/vehicle-profile",
  vehicleLookupReport: "reports/vehicle-lookup",
  vehicleFitnessReport: "reports/vehicle-fitness",
  totalFineReport: "reports/total-fine",
  pendingAppealSummary: "reports/pending-appeal-summary",
  pendingAppealsReport: "reports/pending-appeals",
  violationVerification: "violations",
  authLogin: "auth/login"
});

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function sessionValue(key) {
  try { return window.sessionStorage.getItem(key); }
  catch { return null; }
}

export function isLiveMode() {
  return sessionValue("trafficAiDataMode") === "api";
}

export function configureDataSession({ mode = "mock", token = "", name, apiBaseUrl = DEFAULT_API_BASE_URL } = {}) {
  window.sessionStorage.setItem("trafficAiDataMode", mode === "api" ? "api" : "mock");
  window.sessionStorage.setItem("trafficAiApiBaseUrl", apiBaseUrl.replace(/\/+$/, ""));
  if (token) window.sessionStorage.setItem("trafficAiApiToken", token);
  else window.sessionStorage.removeItem("trafficAiApiToken");
  if (name !== undefined) {
    const displayName = String(name || "").trim();
    if (displayName) window.sessionStorage.setItem("trafficAiUserName", displayName);
    else window.sessionStorage.removeItem("trafficAiUserName");
  }
}

export function clearDataSession() {
  window.sessionStorage.removeItem("trafficAiDataMode");
  window.sessionStorage.removeItem("trafficAiApiBaseUrl");
  window.sessionStorage.removeItem("trafficAiApiToken");
  window.sessionStorage.removeItem("trafficAiUserName");
}

function apiUrl(resource, suffix = "") {
  const endpoint = API_ENDPOINTS[resource];
  if (!endpoint) throw new ApiError(`Live API resource is not implemented: ${resource}`);
  const base = sessionValue("trafficAiApiBaseUrl") || DEFAULT_API_BASE_URL;
  return `${base}/${endpoint}${suffix}`;
}

async function request(url, options = {}) {
  const token = sessionValue("trafficAiApiToken");
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(url, { cache: "no-store", ...options, headers });
  } catch (error) {
    throw new ApiError(`Network error reaching the live API: ${error.message}`, 0);
  }

  let body = null;
  try { body = await response.json(); }
  catch { body = null; }
  if (!response.ok) throw new ApiError(body?.error || `API request failed (HTTP ${response.status})`, response.status);
  return body;
}

export async function loginLive(username, password) {
  return request(apiUrl("authLogin"), {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export async function validateLiveSession(expectedRole) {
  const result = await request(apiUrl("health"));
  if (expectedRole && result.role !== expectedRole) {
    throw new ApiError(`This session belongs to the ${result.role} role, not ${expectedRole}.`, 403);
  }
  return result;
}

export async function list(resource) {
  const [baseResource, query = ""] = resource.split("?");
  if (isLiveMode()) {
    return request(apiUrl(baseResource, query ? `?${query}` : ""));
  }
  if (baseResource === "databaseTables") {
    throw new ApiError("The database viewer is available only in authenticated live mode.", 400);
  }
  const response = await fetch(new URL(`${baseResource}.json`, MOCK_BASE_URL));
  if (!response.ok) throw new ApiError(`Unable to load demo resource ${baseResource} (HTTP ${response.status})`, response.status);
  return response.json();
}

export async function get(resource, id) {
  if (isLiveMode()) {
    return request(apiUrl(resource, `/${encodeURIComponent(id)}`)).catch((error) => {
      if (error.status === 404) return null;
      throw error;
    });
  }
  const records = await list(resource);
  return records.find((record) => Object.entries(record).some(([key, value]) => /Id$/.test(key) && String(value) === String(id))) || null;
}

export async function mutate(resource, payload, { method = "POST", suffix = "" } = {}) {
  if (!isLiveMode()) {
    return new Promise((resolve) => setTimeout(() => resolve({ ok: true, demo: true, data: payload }), 250));
  }
  return request(apiUrl(resource, suffix), { method, body: JSON.stringify(payload) });
}
