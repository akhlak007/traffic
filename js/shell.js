import { enforceRole } from "./router-guard.js";
import { clearDataSession, isLiveMode, validateLiveSession } from "./api.js";

const ROLE_CONFIG = {
  admin: {
    label: "Administrator",
    user: "Mushfiq Ahmed",
    links: [
      ["Dashboard", "admin-dashboard.html", "layout-dashboard"],
      ["Cameras", "admin-cameras.html", "cctv"],
      ["Zones", "admin-zones.html", "map"],
      ["Users", "admin-users.html", "users"],
      ["DB Viewer", "database-viewer.html", "database"]
    ]
  },
  officer: { label: "Traffic Officer", user: "Indira Hossain", links: [["Dashboard", "officer-dashboard.html", "layout-dashboard"], ["Verify", "officer-verification.html", "scan-search"], ["Notices", "officer-notices.html", "file-warning"], ["Appeals", "officer-appeals.html", "scale"], ["Incidents", "officer-incidents.html", "triangle-alert"]] },
  supervisor: { label: "Supervisor", user: "Labiba Khan", links: [["Dashboard", "supervisor-dashboard.html", "layout-dashboard"], ["Appeals", "supervisor-appeals.html", "scale"]] },
  owner: { label: "Vehicle Owner", user: "Zubaer Ahmed", links: [["Dashboard", "owner-dashboard.html", "layout-dashboard"], ["Vehicles", "owner-vehicles.html", "car-front"], ["Notices", "owner-notices.html", "receipt-text"], ["Pay", "owner-payment.html", "credit-card"], ["Appeal", "owner-appeal.html", "file-pen-line"]] },
  dmp: { label: "DMP Officer", user: "Jamila Akter", links: [["Dashboard", "dmp-dashboard.html", "shield-alert"], ["Vehicle Lookup", "dmp-vehicle-lookup.html", "search"]] }
};

function pageHref(file) {
  return location.pathname.includes("/pages/") ? file : `pages/${file}`;
}

function sessionUserName() {
  try { return window.sessionStorage.getItem("trafficAiUserName"); }
  catch { return null; }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applySidebarName(root, name) {
  const nextName = String(name || "").trim();
  if (!nextName) return;
  try { window.sessionStorage.setItem("trafficAiUserName", nextName); }
  catch { /* sessionStorage can be unavailable in locked-down browsers */ }
  const el = root.querySelector(".sidebar-user strong");
  if (el) el.textContent = nextName;
}

export function mountShell(role = "admin") {
  role = enforceRole(role);
  const root = document.querySelector("[data-app-shell]");
  if (!root) return;
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.admin;
  const current = location.pathname.split("/").pop() || "index.html";
  const displayName = escapeHtml((isLiveMode() && sessionUserName()) || config.user);
  const brand = `<span class="brand"><span class="brand-mark"><i data-lucide="scan-line"></i></span><span>TRAFFIC AI<small>DHAKA CONTROL</small></span></span>`;
  const links = config.links.map(([label, file, icon]) => `<a class="nav-link" href="${pageHref(file)}" ${current === file ? 'aria-current="page"' : ""}><i data-lucide="${icon}"></i><span>${label}</span></a>`).join("");
  root.insertAdjacentHTML("afterbegin", `
    <aside class="sidebar">${brand}<button type="button" class="button sidebar-back-btn" data-back-btn aria-label="Go back" title="Go back"><i data-lucide="arrow-left"></i><span>Back</span></button><nav aria-label="Primary"><div class="nav-list">${links}</div></nav><div class="sidebar-user"><div><strong>${displayName}</strong><small>${config.label} / ${isLiveMode() ? "LIVE" : "DEMO"}</small></div><a class="sidebar-logout" data-logout href="../index.html" aria-label="Log out" title="Log out"><i data-lucide="log-out"></i><span>Log out</span></a></div></aside>
    <header class="topbar"><div class="topbar-left"><button type="button" class="button icon-button" data-back-btn aria-label="Go back" title="Go back"><i data-lucide="arrow-left"></i></button>${brand}</div><a class="button icon-button" data-logout href="../index.html" aria-label="Switch role" title="Switch role"><i data-lucide="log-out"></i></a></header>
    <nav class="bottom-nav" style="--nav-count:${config.links.length}" aria-label="Mobile primary">${links}</nav>`);
  window.lucide?.createIcons();
  root.querySelectorAll("[data-logout]").forEach((link) => link.addEventListener("click", clearDataSession));
  root.querySelectorAll("[data-back-btn]").forEach((btn) => btn.addEventListener("click", () => {
    if (window.history.length > 1 && document.referrer && document.referrer !== window.location.href) {
      window.history.back();
    } else {
      window.location.href = "../index.html";
    }
  }));
  if (isLiveMode()) {
    validateLiveSession(role).then((session) => applySidebarName(root, session?.name)).catch(() => {});
  }
}
