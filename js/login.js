import { ApiError, clearDataSession, configureDataSession, loginLive, validateLiveSession } from "./api.js";

const destinations = {
  admin: "pages/admin-dashboard.html",
  officer: "pages/officer-dashboard.html",
  supervisor: "pages/supervisor-dashboard.html",
  owner: "pages/owner-dashboard.html",
  dmp: "pages/dmp-dashboard.html"
};

const ROLE_LABELS = {
  admin: "Administrator",
  officer: "Traffic Officer",
  supervisor: "Supervisor",
  owner: "Vehicle Owner",
  dmp: "DMP Officer"
};

const form = document.querySelector("#role-form");
const modeSelect = document.querySelector("#data-mode");
const credentialsGroup = document.querySelector("#credentials-group");
const roleGroup = document.querySelector("#role-group");
const usernameInput = document.querySelector("#login-username");
const passwordInput = document.querySelector("#login-password");

function syncModeFields() {
  const live = modeSelect?.value === "api";
  if (credentialsGroup) credentialsGroup.hidden = !live;
  if (roleGroup) {
    roleGroup.hidden = false;
    roleGroup.style.display = "";
  }
  if (usernameInput) {
    usernameInput.required = live;
    usernameInput.disabled = !live;
  }
  if (passwordInput) {
    passwordInput.required = live;
    passwordInput.disabled = !live;
  }
}

function showLoginError(text) {
  document.querySelector("[data-login-error]")?.remove();
  const message = document.createElement("p");
  message.dataset.loginError = "";
  message.className = "muted";
  message.style.color = "var(--color-danger)";
  message.textContent = text;
  form.querySelector("button[type=submit]")?.before(message);
}

if (window.location.hostname.endsWith("github.io") && modeSelect) {
  modeSelect.value = "mock";
}
modeSelect?.addEventListener("change", syncModeFields);
syncModeFields();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  const mode = values.get("dataMode");
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  document.querySelector("[data-login-error]")?.remove();
  try {
    let role = values.get("role");
    if (!destinations[role]) throw new Error("Select a workspace role.");
    if (mode === "api") {
      if (window.location.hostname.endsWith("github.io")) {
        throw new ApiError("Live Oracle API is not available on GitHub Pages static hosting. Please switch Data Source to 'Offline demo data'.", 405);
      }
      const result = await loginLive(values.get("username"), values.get("password"));
      if (result.role !== role) {
        throw new ApiError(`This account belongs to the ${ROLE_LABELS[result.role] || result.role} workspace. Select ${ROLE_LABELS[result.role] || result.role} to continue.`, 403);
      }
      configureDataSession({ mode: "api", token: result.token, name: result.name || "" });
      const session = await validateLiveSession(result.role);
      if (session?.name) {
        configureDataSession({ mode: "api", token: result.token, name: session.name });
      }
      role = result.role;
    } else {
      configureDataSession({ mode: "mock", name: "" });
    }
    if (!destinations[role]) throw new Error("Unknown workspace.");
    location.href = `${destinations[role]}?role=${role}`;
  } catch (error) {
    clearDataSession();
    let msg = error.message || "Sign-in failed";
    if (error.status === 405 || msg.includes("405")) {
      msg = "Live Oracle API requires running the local backend (npm start). On GitHub Pages, please switch Data Source to 'Offline demo data'.";
    }
    showLoginError(msg);
    button.disabled = false;
  }
});

document.querySelectorAll("[data-back-btn]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (window.history.length > 1 && document.referrer && document.referrer !== window.location.href) {
      window.history.back();
    } else {
      window.location.reload();
    }
  });
});

window.lucide?.createIcons();
document.body.dataset.loginReady = "true";
