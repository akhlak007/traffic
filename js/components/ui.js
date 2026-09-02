export function statusColor(status = "") {
  const value = String(status);
  if (/\b(online|active|paid|completed|clear|valid|safe|resolved|confirmed|dismissed)\b/i.test(value)) return "var(--color-success)";
  if (/\b(offline|overdue|danger|critical|stolen|wanted|expired|rejected)\b/i.test(value)) return "var(--color-danger)";
  return "var(--color-warning)";
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

export function badge(status) {
  return `<span class="status-badge"><span class="status-square" style="--status-color:${statusColor(status)}"></span>${escapeHtml(String(status ?? "unknown").replaceAll("-", " "))}</span>`;
}

export function money(amount) {
  const value = Number(amount);
  return Number.isFinite(value) ? `BDT ${value.toLocaleString("en-BD")}` : "—";
}
export function date(value) { return value ? new Intl.DateTimeFormat("en-BD", { dateStyle: "medium" }).format(new Date(value)) : "Not set"; }

export function showToast(message, tone = "success") {
  document.querySelector(".toast")?.remove();
  const color = tone === "danger" ? "var(--color-danger)" : tone === "warning" ? "var(--color-warning)" : "var(--color-success)";
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.style.background = color;
  toast.textContent = String(message);
  document.body.append(toast);
  setTimeout(() => document.querySelector(".toast")?.remove(), 3000);
}

export function handleBack() {
  if (window.history.length > 1 && document.referrer && document.referrer !== window.location.href) {
    window.history.back();
  } else {
    const isPagesSubdir = window.location.pathname.includes("/pages/");
    window.location.href = isPagesSubdir ? "../index.html" : "index.html";
  }
}

export function wireCommonInteractions() {
  document.querySelectorAll("[data-back-btn], [data-back]").forEach((button) => {
    button.removeEventListener("click", handleBack);
    button.addEventListener("click", handleBack);
  });
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    const group = button.closest("[data-filter-group]") || document;
    group.querySelectorAll("[data-filter]").forEach((item) => item.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", "true");
    filterRecords();
  }));
  document.querySelector("[data-search]")?.addEventListener("input", filterRecords);
  document.querySelectorAll("[data-tab]").forEach((tab) => tab.addEventListener("click", () => {
    const tabs = tab.closest("[role=tablist]");
    tabs.querySelectorAll("[data-tab]").forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
    document.querySelectorAll("[data-panel]").forEach((panel) => setPanelState(panel, panel.dataset.panel === tab.dataset.tab));
  }));
  document.querySelectorAll("[data-panel]").forEach((panel) => setPanelState(panel, !panel.hidden));
  document.querySelectorAll("[data-open-modal]").forEach((button) => button.addEventListener("click", () => document.querySelector(button.dataset.openModal)?.showModal()));
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  document.querySelectorAll("[data-mock-action]").forEach((button) => button.addEventListener("click", () => showToast(button.dataset.message || "Mock action completed")));
  document.querySelectorAll("form[data-mock-form]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); showToast(form.dataset.message || "Saved successfully"); form.querySelector("button[type=submit]")?.blur(); }));
  window.lucide?.createIcons();
}

function setPanelState(panel, active) {
  panel.hidden = !active;
  panel.querySelectorAll("input, select, textarea, button").forEach((control) => { control.disabled = !active; });
}

function filterRecords() {
  const query = document.querySelector("[data-search]")?.value.toLowerCase().trim() || "";
  const active = document.querySelector('[data-filter][aria-pressed="true"]')?.dataset.filter || "all";
  let shown = 0;
  document.querySelectorAll("[data-record]").forEach((record) => {
    const matchesText = record.textContent.toLowerCase().includes(query);
    const statusKey = String(record.dataset.statusKey || "").toLowerCase();
    const matchesFilter = active === "all" || (
      statusKey
        ? statusKey === active.toLowerCase()
        : record.dataset.tags?.toLowerCase().includes(active.toLowerCase())
    );
    record.hidden = !(matchesText && matchesFilter);
    if (!record.hidden) shown++;
  });
  const empty = document.querySelector("[data-empty]");
  if (empty) empty.hidden = shown !== 0;
}
