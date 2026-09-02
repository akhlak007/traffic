import { list, get, isLiveMode, mutate } from "./api.js";
import { badge, date, escapeHtml, money, showToast, statusColor, wireCommonInteractions } from "./components/ui.js";
import { noticeCanAppeal, noticeCanPay, noticeStatusLabel, resolveNoticeStatus } from "./noticeState.js";

const root = document.querySelector("[data-page-root]");
const page = document.body.dataset.page;
const role = document.body.dataset.role;

function ownerNoticeActions(notice) {
  const noticeParam = encodeURIComponent(notice.noticeId);
  const buttons = [];
  if (noticeCanPay(notice)) buttons.push(`<a class="button button--primary" href="owner-payment.html?notice=${noticeParam}">Pay</a>`);
  if (noticeCanAppeal(notice)) buttons.push(`<a class="button" href="owner-appeal.html?notice=${noticeParam}">Appeal</a>`);
  if (buttons.length) return buttons.join("");
  return `<span class="mono-chip">${safe(noticeStatusLabel(notice))}</span>`;
}

const headings = {
  "admin-dashboard": ["Network control", "Cameras, zones, users, and current camera events."],
  "admin-cameras": ["Camera registry", "Registered devices and their road assignments."],
  "admin-zones": ["Zones & road segments", "Operational boundaries and posted speed limits."],
  "admin-users": ["User administration", "Manage accounts, roles, and zone permissions."],
  "officer-dashboard": ["Alert desk", "Prioritized operational events from across assigned zones."],
  "officer-verification": ["Verification queue", "Review detections with camera confidence below 50% before a notice is issued."],
  "officer-notices": ["Violation notices", "Issue and track notices for confirmed violations."],
  "officer-incidents": ["Incident desk", "Record emergencies and road defects for dispatch."],
  "officer-appeals": ["Appeal monitor", "Read-only view of owner appeals awaiting or completing review."],
  "supervisor-dashboard": ["Supervision overview", "Appeals workload and officer performance."],
  "supervisor-appeals": ["Appeal review", "Evaluate owner evidence and record a legal decision."],
  "owner-dashboard": ["My road account", "Vehicles, notices, fines, and recent activity."],
  "owner-notices": ["Notices & fines", "Review deadlines and take action on outstanding notices."],
  "owner-payment": ["Pay a fine", "Submit a completed MFS or bank payment for an eligible notice."],
  "owner-appeal": ["Submit an appeal", "Challenge a notice and attach supporting evidence."],
  "owner-vehicles": ["My vehicles", "Registration, fitness, and legal status."],
  "dmp-dashboard": ["DMP intelligence", "Escalated cases, watchlist hits, and road risk."],
  "dmp-vehicle-lookup": ["Vehicle intelligence lookup", "Search a plate and trace its camera journey."],
  "database-viewer": ["Database Viewer", "Read-only live inspection of Oracle tables."]
};

const safe = escapeHtml;
const head = (title, copy, action = "") => `<header class="page-heading"><div class="page-heading__main"><button type="button" class="button button--back" data-back-btn aria-label="Go back to previous page" title="Go back"><i data-lucide="arrow-left"></i><span>Back</span></button><div class="page-heading__text"><p class="eyebrow">${safe(roleLabel(role))} workspace / ${isLiveMode() ? "live Oracle data" : "demo data"}</p><h1>${safe(title)}</h1><p class="muted">${safe(copy)}</p></div></div>${action}</header>`;
const loader = () => `<div class="skeleton" aria-label="Loading data"></div>`;
const toolbar = (filters = []) => `<div class="toolbar" data-filter-group><label class="search-field"><span class="sr-only">Search records</span><i data-lucide="search"></i><input data-search type="search" placeholder="Search records..."></label>${["all", ...filters].map((f, i) => `<button class="chip" data-filter="${safe(f)}" aria-pressed="${i === 0}">${safe(f.replaceAll("-", " "))}</button>`).join("")}</div>`;
const empty = () => `<div class="empty-state" data-empty hidden><i data-lucide="search-x"></i><h2>No matching records</h2><p>Adjust the search or selected filter.</p></div>`;
function mergeCursorAppeals(cursorRows, appeals) {
  const byId = Object.fromEntries((appeals || []).map((row) => [String(row.appealId), row]));
  return (cursorRows || []).map((row) => {
    const extra = byId[String(row.appealId)] || {};
    return {
      ...extra,
      appealId: row.appealId,
      appealDate: row.appealDate,
      applicationDate: row.appealDate || extra.applicationDate,
      reviewStatus: String(row.reviewStatus || extra.reviewStatus || "").toLowerCase()
    };
  });
}
const emptyState = (title, copy) => `<div class="empty-state"><i data-lucide="inbox"></i><h2>${safe(title)}</h2><p>${safe(copy)}</p></div>`;
const roleLabel = (value) => ({ admin: "Administrator", officer: "Traffic Officer", supervisor: "Supervisor", owner: "Vehicle Owner", dmp: "DMP Officer" }[value] || "Traffic AI");
const record = (title, subtitle, status, fields, actions = "", tags = "", statusKey = "") => `<article class="neo-card record-card" data-record data-status-key="${safe(statusKey)}" data-tags="${safe(tags)} ${safe(status)}" style="--status-color:${statusColor(status)}"><div class="record-card__head"><div><h3>${safe(title)}</h3><span class="mono-chip">${safe(subtitle)}</span></div>${badge(status)}</div><dl>${fields.map(([key,value]) => `<div><dt>${safe(key)}</dt><dd>${safe(value)}</dd></div>`).join("")}</dl>${actions ? `<div class="record-card__actions">${actions}</div>` : ""}</article>`;

function noticeViolationType(notice) {
  return String(notice?.violationType || "").trim() || "—";
}

function noticeViolationId(notice) {
  const id = notice?.violationEventId;
  return id == null || id === "" ? "—" : String(id);
}

function noticeViolationLabel(notice) {
  const type = String(notice?.violationType || "").trim();
  const id = noticeViolationId(notice);
  if (type && id !== "—") return `${type} (#${id})`;
  if (type) return type;
  return id;
}

async function adminDashboard() {
  const [cameras,zones,users,events,report]=await Promise.all([list("cameras"),list("zones"),list("users"),list("cameraEvents"),isLiveMode()?list("cameraAverageReport"):Promise.resolve([])]);
  root.innerHTML=head(...headings[page],`<a class="button button--primary" href="admin-cameras.html">View cameras</a>`)+`<section class="kpi-grid"><article class="neo-card kpi-card"><span class="kpi-card__label">Cameras online</span><strong class="kpi-card__value">${cameras.filter(c=>c.status==="online").length}</strong><span class="kpi-card__meta">${cameras.length} TOTAL</span></article><article class="neo-card kpi-card"><span class="kpi-card__label">Managed zones</span><strong class="kpi-card__value">${zones.length}</strong></article><article class="neo-card kpi-card"><span class="kpi-card__label">Registered users</span><strong class="kpi-card__value">${users.length}</strong></article><article class="neo-card kpi-card"><span class="kpi-card__label">Camera events</span><strong class="kpi-card__value">${events.length}</strong></article></section><section class="neo-card panel"><h2>Cameras above average event volume</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Camera</th><th>Events</th><th>Average</th></tr></thead><tbody>${report.map(r=>`<tr><td>${safe(r.cameraId)}</td><td>${safe(r.eventCount)}</td><td>${safe(r.averageEventCount)}</td></tr>`).join("")||`<tr><td colspan="3">No camera currently exceeds the average.</td></tr>`}</tbody></table></div></section>`;
}

async function camerasPage() {
  const [cameras, zones, segments] = await Promise.all([list("cameras"), list("zones"), list("roadSegments")]);
  const zoneName = id => zones.find(z => String(z.zoneId) === String(id))?.name || id;
  const segmentName = id => segments.find(s => String(s.roadSegmentId) === String(id))?.name || id;
  const cards = cameras.map(c => {
    const id = String(c.cameraId).replace(/[^A-Za-z0-9_-]/g, "");
    return record(`Camera ${c.cameraId}`, zoneName(c.zoneId), c.status, [["Zone", zoneName(c.zoneId)], ["Road", segmentName(c.roadSegmentId)], ["Status", c.status]], `<button class="button" data-open-modal="#camera-${id}">View</button>`, `${c.status} ${zoneName(c.zoneId)}`) + `<dialog class="modal" id="camera-${id}"><div class="modal__head"><h2>Camera ${safe(c.cameraId)}</h2><button class="button icon-button" data-close-modal aria-label="Close"><i data-lucide="x"></i></button></div><div class="modal__body"><p><strong>Status:</strong> ${safe(c.status)}</p><p><strong>Zone:</strong> ${safe(zoneName(c.zoneId))}</p><p><strong>Road segment:</strong> ${safe(segmentName(c.roadSegmentId))}</p></div></dialog>`;
  }).join("") || emptyState("No cameras registered", "No CAMERA rows are currently available.");
  root.innerHTML = head(...headings[page]) + toolbar(["online", "degraded", "offline"]) + `<div class="directory-layout"><aside class="neo-card filter-rail"><div class="filter-group"><h3>Operational summary</h3><p><strong>${cameras.filter(c=>c.status==="online").length}</strong> online</p><p><strong>${cameras.filter(c=>c.status!=="online").length}</strong> need attention</p></div><div class="filter-group"><h3>Dhaka zones</h3>${zones.map(z=>`<p>${safe(z.name)}</p>`).join("") || "<p>No zones.</p>"}</div></aside><section class="record-grid">${cards}</section></div>${empty()}`;
}

async function zonesPage() {
  const [zones, segments] = await Promise.all([list("zones"), list("roadSegments")]);
  const cards = zones.map(z => {
    const zoneSegments = segments.filter(s => String(s.zoneId) === String(z.zoneId));
    const id = String(z.zoneId).replace(/[^A-Za-z0-9_-]/g, "");
    return record(z.name, `Zone ${z.zoneId}`, "active", [["Area", z.area], ["Segments", zoneSegments.length], ["Speed limits", zoneSegments.map(s => `${s.speedLimit} km/h`).join(", ") || "None"]], `<button class="button" data-open-modal="#zone-${id}">View</button>`, `${z.area} ${z.name}`) + `<dialog class="modal" id="zone-${id}"><div class="modal__head"><h2>${safe(z.name)}</h2><button class="button icon-button" data-close-modal aria-label="Close"><i data-lucide="x"></i></button></div><div class="modal__body"><p><strong>Area:</strong> ${safe(z.area)}</p><p><strong>Road segments:</strong> ${safe(zoneSegments.length)}</p></div></dialog>`;
  }).join("") || emptyState("No zones configured", "No ZONE rows are currently available.");
  root.innerHTML = head(...headings[page]) + toolbar() + `<section class="record-grid">${cards}</section>${empty()}<section class="neo-card panel"><h2>Road segment registry</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Name</th><th>Zone</th><th>Start</th><th>End</th><th>Limit</th></tr></thead><tbody>${segments.map(s=>`<tr data-record><td>${safe(s.roadSegmentId)}</td><td>${safe(s.name)}</td><td>${safe(s.zoneId)}</td><td>${safe(s.startPoint)}</td><td>${safe(s.endPoint)}</td><td>${safe(s.speedLimit)}</td></tr>`).join("") || `<tr><td colspan="6">No road segments are currently registered.</td></tr>`}</tbody></table></div></section>`;
}

async function usersPage() {
  const users = await list("users");
  root.innerHTML = head(...headings[page]) + toolbar(["admin","traffic officer","dmp officer","vehicle owner"]) + `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Role</th><th>Designation</th><th>Zone</th><th>Status</th></tr></thead><tbody>${users.map(u=>`<tr data-record data-tags="${safe(u.role)} ${safe(u.status)}"><td><strong>${safe(u.firstName)} ${safe(u.lastName)}</strong><br><span class="mono-chip">${safe(u.userId)}</span></td><td>${safe(u.role)}</td><td>${safe(u.designation||"-")}</td><td>${safe(u.zoneId||"All")}</td><td>${badge(u.status)}</td></tr>`).join("")||`<tr><td colspan="5">No users are currently registered.</td></tr>`}</tbody></table></div>${empty()}`;
}

async function officerDashboard() {
  const alerts = await list("alertEvents");
  const openCount = alerts.filter(a=>a.status!=="resolved").length;
  root.innerHTML = head(...headings[page]) + `<div class="alert-banner" style="--banner-color:${openCount?"var(--color-warning)":"var(--color-success)"}"><i data-lucide="${openCount?"triangle-alert":"circle-check"}"></i><div><strong>${openCount?`${openCount} detections require attention`:"No open detections require attention"}</strong><p>${openCount?"Prioritize danger and warning events.":"All current alert events already have Action_taken."}</p></div></div>` + toolbar(["danger","warning"]) + `<section class="neo-card panel"><div class="panel-heading"><h2>Unified alert feed</h2>${badge(isLiveMode()?"live":"demo")}</div>${alerts.length?`<ul class="activity-list">${alerts.map(a=>`<li class="activity-item" data-record data-tags="${safe(a.severity)} ${safe(a.type)}"><span class="status-square" style="--status-color:${statusColor(a.severity)}"></span><div><strong>${safe(a.name)}</strong><p class="muted">${safe(a.type)} / ${safe(a.roadSegmentId)} / ${safe(a.status)}</p><time>${safe(a.time?new Date(a.time).toLocaleString("en-BD"):"Not set")}</time></div></li>`).join("")}</ul>`:emptyState("No alert events", "No ALERT_EVENT rows currently require officer attention.")}</section>${empty()}`;
}

async function officerAppealsMonitor() {
  const appeals = await list("appeals");
  const rows = appeals.map((a) => `<tr>
    <td>${safe(a.appealId)}</td>
    <td>${safe(a.noticeId)}</td>
    <td>${safe(a.licensePlate || "—")}</td>
    <td>${safe(a.ownerName || a.ownerId || "—")}</td>
    <td>${safe(a.reason)}</td>
    <td>${safe(date(a.applicationDate))}</td>
    <td>${safe(a.reviewStatus || a.status)}</td>
  </tr>`).join("");
  root.innerHTML = head(...headings[page]) + `<section class="neo-card panel"><p class="eyebrow">Read-only monitor</p><h2>Owner appeals</h2><p class="muted">Traffic officers can view appeal status. Decisions are recorded only by a supervisor.</p><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Appeal</th><th>Notice</th><th>Plate</th><th>Owner</th><th>Reason</th><th>Submitted</th><th>Status</th></tr></thead><tbody>${rows || `<tr><td colspan="7">No appeal records are currently available.</td></tr>`}</tbody></table></div></section>`;
}

async function verificationPage() {
  const [violations, events, evidence, vehicles] = await Promise.all([list("violationEvents"),list("cameraEvents"),list("evidence"),list("vehicles")]);
  const queue = violations.filter(v=>{
    const ev=events.find(e=>String(e.cameraEventId)===String(v.cameraEventId));
    const confidence=Number(v.confidenceScore ?? ev?.confidenceScore);
    return v.status==="pending-review" && Number.isFinite(confidence) && confidence<50;
  });
  root.innerHTML = head(...headings[page]) + toolbar(["pending-review","speeding","signal breach"]) + `<section class="record-grid">${queue.map(v=>{const ev=events.find(e=>String(e.cameraEventId)===String(v.cameraEventId));const veh=vehicles.find(x=>String(x.vehicleId)===String(v.vehicleId)||String(x.licensePlate)===String(v.vehicleId));const evd=evidence.find(x=>String(x.cameraEventId)===String(v.cameraEventId));if(!ev||!veh)return "";const id=String(v.violationEventId).replace(/[^A-Za-z0-9_-]/g,"");return record(veh.licensePlate,v.violationEventId,v.status,[["Type",v.type],["Confidence",`${ev.confidenceScore}%`],["Camera",ev.cameraId],["Captured",new Date(ev.capturedAt).toLocaleString("en-BD")]],`<button class="button" data-open-modal="#evidence-${id}">Evidence</button><button class="button button--primary" data-open-modal="#verify-${id}">Verify</button>`,v.type)+`<dialog class="modal" id="evidence-${id}"><div class="modal__head"><h2>${safe(evd?.evidenceName||"Detection evidence")}</h2><button class="button icon-button" data-close-modal aria-label="Close"><i data-lucide="x"></i></button></div><div class="modal__body"><p><strong>Image:</strong> ${safe(evd?.capturedImagePath||"No image")}</p><p><strong>Video:</strong> ${safe(evd?.capturedVideoPath||"No video")}</p><p><strong>Camera:</strong> ${safe(ev.cameraId)}</p></div></dialog><dialog class="modal" id="verify-${id}"><div class="modal__head"><h2>Verify ${safe(v.violationEventId)}</h2><button class="button icon-button" data-close-modal aria-label="Close"><i data-lucide="x"></i></button></div><form class="modal__body form-grid" data-verification-form data-event-id="${safe(v.violationEventId)}"><div class="field-group"><label>Decision</label><select name="decision" required><option value="confirmed">Confirm</option><option value="rejected">Reject</option></select></div><div class="field-group"><label>Remarks</label><textarea name="remarks" minlength="5" maxlength="300" required></textarea></div><button class="button button--primary">Save verification</button></form></dialog>`}).join("")||emptyState("No low-confidence detections waiting","Only unverified camera events with confidence below 50% appear here.")}</section>${empty()}`;
  document.querySelectorAll("[data-verification-form]").forEach(form=>form.addEventListener("submit",async event=>{event.preventDefault();const values=new FormData(form);try{await mutate("violationVerification",{decision:values.get("decision"),remarks:values.get("remarks")},{method:"PATCH",suffix:`/${encodeURIComponent(form.dataset.eventId)}/verification`});showToast("Verification saved");form.closest("dialog")?.close();await verificationPage();wireCommonInteractions();}catch(error){showToast(error.message,"danger");}}));
}

async function noticesPage(ownerMode = false) {
  const [notices, vehicles, violations] = await Promise.all([list("notices"),list("vehicles"),ownerMode?Promise.resolve([]):list("violationEvents")]);
  const rows = ownerMode && !isLiveMode() ? notices.filter(n=>n.ownerId==="OWN-001") : notices;
  const eligibleViolations = violations.filter(v=>v.status==="confirmed"&&!notices.some(n=>String(n.violationEventId)===String(v.violationEventId)));
  const issueAction = ownerMode ? "" : (eligibleViolations.length
    ? `<button class="button button--primary" data-open-modal="#notice-modal"><i data-lucide="plus"></i>Issue notice</button>`
    : `<span class="muted">No confirmed violations are currently waiting for a notice.</span>`);
  const cards = rows.map(n=>{const v=vehicles.find(x=>String(x.vehicleId)===String(n.vehicleId)||String(x.licensePlate)===String(n.licensePlate||n.vehicleId));const status=resolveNoticeStatus(n);const label=noticeStatusLabel(n);const actions=ownerMode?ownerNoticeActions(n):`<button class="button" data-open-modal="#notice-${safe(n.noticeId)}">View</button>`;return record(`Notice ${n.noticeId}`,v?.licensePlate||n.licensePlate||n.vehicleId,label,[["Fine",money(n.fineAmount)],["Issued",date(n.issueDate)],["Due",date(n.dueDate)],["Violation",noticeViolationType(n)],["ID",noticeViolationId(n)]],actions,`${status} ${v?.type||n.vehicleType||""}`,status)+`<dialog class="modal" id="notice-${safe(n.noticeId)}"><div class="modal__head"><h2>Notice ${safe(n.noticeId)}</h2><button class="button icon-button" data-close-modal aria-label="Close"><i data-lucide="x"></i></button></div><div class="modal__body"><p><strong>Status:</strong> ${safe(label)}</p><p><strong>Fine:</strong> ${safe(money(n.fineAmount))}</p><p><strong>Violation:</strong> ${safe(noticeViolationLabel(n))}</p></div></dialog>`;}).join("") || emptyState(ownerMode?"You're all clear":"No notices issued", ownerMode?"There are no traffic notices on this account right now.":"No notices are waiting in this queue.");
  const issueModal = ownerMode || !eligibleViolations.length ? "" : `<dialog class="modal" id="notice-modal"><div class="modal__head"><h2>Issue notice</h2><button class="button icon-button" data-close-modal aria-label="Close"><i data-lucide="x"></i></button></div><form class="modal__body form-grid" id="notice-form"><div class="field-group"><label>Confirmed violation</label><select name="violationEventId">${eligibleViolations.map(v=>`<option value="${safe(v.violationEventId)}">${safe(v.violationEventId)} / ${safe(v.vehicleId)} / ${safe(v.type)}</option>`).join("")}</select></div><div class="field-group"><label>Due date</label><input class="field" name="dueDate" type="date" required></div><div class="field-group"><label>Fine amount</label><input class="field" name="fineAmount" type="number" min="1" required></div><button class="button button--primary">Issue notice</button></form></dialog>`;
  root.innerHTML = head(...headings[page], issueAction) + toolbar(["paid","appealed","overdue","dismissed","payment-pending","appeal-rejected"]) + `<section class="record-grid">${cards}</section>${empty()}${issueModal}`;
  document.querySelector("#notice-form")?.addEventListener("submit",async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));try{await mutate("notices",values);showToast("Notice issued");await noticesPage(false);wireCommonInteractions();}catch(error){showToast(error.message,"danger");}});
}

async function incidentsPage() {
  const [defects,segments,alerts,congestion] = await Promise.all([list("roadDefectEvents"),list("roadSegments"),list("alertEvents"),list("congestionEvents")]);
  const alertCards = alerts.map(a=>record(a.name,a.alertEventId,a.status,[["Road",a.roadSegmentId],["Severity",a.severity],["Time",date(a.time)]])).join("") || emptyState("No emergency alerts","No ALERT_EVENT rows are currently open.");
  const defectCards = defects.map(d=>record(d.type,d.roadDefectEventId,d.status,[["Road",segments.find(s=>String(s.roadSegmentId)===String(d.roadSegmentId))?.name||d.roadSegmentId],["Reported",date(d.reportedAt)],["Severity",d.severity]])).join("") || emptyState("No road defects","No ROAD_DEFECT_EVENT rows are currently recorded.");
  const congestionCards = congestion.map(c=>record(`Congestion ${c.congestionEventId}`,c.cameraId,c.severity,[["Road",c.roadSegmentId],["Vehicles",c.vehicleCount],["Captured",date(c.capturedAt)]])).join("") || emptyState("No congestion events","No CONGESTION_EVENT rows are currently recorded.");
  root.innerHTML=head(...headings[page])+`<div class="segmented" role="tablist"><button class="segment" data-tab="alerts" aria-selected="true">Emergency alerts</button><button class="segment" data-tab="defects" aria-selected="false">Road defects</button><button class="segment" data-tab="congestion" aria-selected="false">Congestion</button></div><section data-panel="alerts" class="record-grid">${alertCards}</section><section data-panel="defects" hidden class="record-grid">${defectCards}</section><section data-panel="congestion" hidden class="record-grid">${congestionCards}</section>`;
}

async function supervisorDashboard() {
  const [appeals, violations, summary, cursorReport] = await Promise.all([
    list("appeals"),
    list("violationEvents"),
    isLiveMode() ? list("pendingAppealSummary") : Promise.resolve(null),
    isLiveMode() ? list("pendingAppealsReport") : Promise.resolve(null)
  ]);
  const normalized = appeals.map(a=>({...a,reviewStatus:String(a.reviewStatus||a.status||"unknown").toLowerCase()}));
  const queue = isLiveMode() ? mergeCursorAppeals(cursorReport?.appeals, appeals) : normalized.filter(a=>["pending","under review"].includes(a.reviewStatus));
  const pendingCount = isLiveMode() && cursorReport ? cursorReport.pendingCount : queue.length;
  const finesCard = summary ? `<article class="neo-card kpi-card"><span class="kpi-card__label">Fines in Review</span><strong class="kpi-card__value">${safe(money(summary.pendingAppealFineTotal))}</strong></article>` : "";
  root.innerHTML = head(...headings[page]) + `<section class="kpi-grid"><article class="neo-card kpi-card" style="--status-color:var(--color-warning)"><span class="kpi-card__label">Pending Appeals</span><strong class="kpi-card__value">${safe(pendingCount)}</strong><span class="kpi-card__meta">REQUIRES DECISION</span></article>${finesCard}<article class="neo-card kpi-card" style="--status-color:var(--color-success)"><span class="kpi-card__label">Reviewed appeals</span><strong class="kpi-card__value">${normalized.filter(a=>["approved","rejected","dismissed"].includes(a.reviewStatus)).length}</strong><span class="kpi-card__meta">CURRENT DATA SET</span></article><article class="neo-card kpi-card" style="--status-color:var(--color-accent-blue)"><span class="kpi-card__label">Confirmed violations</span><strong class="kpi-card__value">${violations.filter(v=>v.status==="confirmed").length}</strong><span class="kpi-card__meta">CURRENT DATA SET</span></article></section><section class="dashboard-grid"><article><div class="panel-heading"><h2>Appeal queue</h2><a class="button" href="supervisor-appeals.html">Review next</a></div>${queue.map(a=>record(`Appeal ${a.appealId}`,a.noticeId,a.reviewStatus,[["Reason",a.reason],["Applied",date(a.applicationDate||a.appealDate)]],["pending","under review"].includes(a.reviewStatus)?`<a class="button" href="supervisor-appeals.html?appeal=${encodeURIComponent(a.appealId)}">Review</a>`:"")).join("")||emptyState("No appeals","No pending appeals were returned by the cursor.")}</article><aside class="neo-card panel"><h2>Review policy</h2><p>Decisions must be evidence-based, include remarks, and are written to the audit record in live mode.</p></aside></section>`;
}

async function appealsReviewPage() {
  const [appeals, notices, evidence, cursorReport] = await Promise.all([
    list("appeals"),
    list("notices"),
    list("evidence"),
    isLiveMode() ? list("pendingAppealsReport") : Promise.resolve(null)
  ]);
  const normalized = appeals.map(a => ({ ...a, reviewStatus: String(a.reviewStatus || a.status || "unknown").toLowerCase() }));
  const queue = isLiveMode()
    ? mergeCursorAppeals(cursorReport?.appeals, appeals)
    : normalized.filter(a => ["pending", "under review"].includes(a.reviewStatus));
  const requested = new URLSearchParams(location.search).get("appeal");
  const appeal = queue.find(a => String(a.appealId) === String(requested)) || queue[0];
  if (!queue.length) {
    root.innerHTML = head(...headings[page]) + emptyState("No appeals awaiting review", "There are currently no pending or under-review appeals.");
    return;
  }
  const notice = notices.find(n => String(n.noticeId) === String(appeal.noticeId));
  const queueCards = queue.map(a => record(
    `Appeal ${a.appealId}`,
    a.noticeId,
    a.reviewStatus,
    [["Reason", a.reason], ["Plate", a.licensePlate || ""], ["Applied", date(a.applicationDate || a.appealDate)]],
    String(a.appealId) === String(appeal.appealId)
      ? `<span class="mono-chip">Selected</span>`
      : `<a class="button" href="supervisor-appeals.html?appeal=${encodeURIComponent(a.appealId)}">Review</a>`,
    a.reviewStatus
  )).join("");
  const reviewed = normalized.filter(a => ["approved", "rejected"].includes(a.reviewStatus));
  root.innerHTML = head(...headings[page]) + `<section class="record-grid">${queueCards}</section><div class="split-view"><article class="neo-card panel"><p class="eyebrow">Pending appeal ${safe(appeal.appealId)}</p><h2>${safe(appeal.reason)}</h2><dl><dt>Notice</dt><dd>${safe(appeal.noticeId)}</dd><dt>Plate</dt><dd>${safe(appeal.licensePlate || notice?.licensePlate || "—")}</dd><dt>Applied</dt><dd>${safe(date(appeal.appealDate || appeal.applicationDate))}</dd><dt>Fine</dt><dd>${safe(notice ? money(notice.fineAmount) : money(appeal.fineAmount))}</dd><dt>Evidence records</dt><dd>${safe(evidence.filter(e => String(e.cameraEventId) === String(notice?.violationEventId)).length)}</dd></dl></article><form class="neo-card panel form-grid" id="review-form"><div><p class="eyebrow">Legal review</p><h2>Record decision</h2></div><div class="field-group"><label for="review-decision">Decision</label><select id="review-decision" name="decision" required><option value="">Select decision</option><option value="uphold">Uphold notice</option><option value="dismiss">Dismiss notice</option></select></div><div class="field-group"><label for="review-remarks">Review remarks</label><textarea id="review-remarks" name="remarks" required minlength="5" maxlength="300" placeholder="State the evidence and policy basis..."></textarea></div><label class="check-row"><input type="checkbox" required>I confirm this decision is based on the evidence shown.</label><button class="button button--primary" type="submit">Submit decision</button></form></div><section class="neo-card panel"><h2>Review history</h2>${reviewed.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Appeal</th><th>Notice</th><th>Status</th><th>Decision</th></tr></thead><tbody>${reviewed.map(a => `<tr><td>${safe(a.appealId)}</td><td>${safe(a.noticeId)}</td><td>${safe(a.reviewStatus)}</td><td>${safe(a.reviewDecision || "—")}</td></tr>`).join("")}</tbody></table></div>` : `<p>${safe(appeals.length)} total appeal records remain available through the existing API.</p>`}</section>`;
  document.querySelector("#review-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const values = new FormData(event.currentTarget);
      await mutate("appeals", { decision: values.get("decision"), remarks: values.get("remarks") }, { method: "PATCH", suffix: `/${encodeURIComponent(appeal.appealId)}/review` });
      showToast(isLiveMode() ? "Appeal decision saved" : "Demo decision recorded");
      if (isLiveMode()) setTimeout(() => location.reload(), 700);
    } catch (error) {
      showToast(error.message, "danger");
      button.disabled = false;
    }
  });
}

async function ownerDashboard() {
  let vehicles, notices, fineReport=null;
  try {
    [vehicles, notices, fineReport] = await Promise.all([list("vehicles"), list("notices"), isLiveMode()?list("totalFineReport"):Promise.resolve(null)]);
  } catch (err) {
    root.innerHTML = head(...headings[page]) + `<div class="alert-banner" style="--banner-color:var(--color-danger)"><i data-lucide="circle-alert"></i><div><strong>Data load error</strong><p>Could not load dashboard data: ${safe(err.message)}</p></div></div>`;
    return;
  }
  const mine = isLiveMode() ? vehicles : vehicles.filter(v => v.ownerId === "OWN-001");
  const myNotices = isLiveMode() ? notices : notices.filter(n => n.ownerId === "OWN-001");
  const totalFineCard = fineReport ? `<section class="kpi-grid"><article class="neo-card kpi-card"><span class="kpi-card__label">Total Fine</span><strong class="kpi-card__value">${safe(money(fineReport.totalFine))}</strong>${fineReport.exceptionHandled==="TOO_MANY_ROWS"?`<span class="kpi-card__meta">More than one notice; total includes all of them.</span>`:fineReport.exceptionHandled==="NO_DATA_FOUND"?`<span class="kpi-card__meta">No fines to add up.</span>`:""}</article></section>` : "";
  root.innerHTML = head(...headings[page]) + totalFineCard + `<div class="segmented" role="tablist"><button class="segment" role="tab" data-tab="vehicles" aria-selected="true">My Vehicles</button><button class="segment" role="tab" data-tab="notices" aria-selected="false">Notices & Fines</button></div><section class="tab-panel" data-panel="vehicles"><div class="record-grid" style="margin-top:18px">${mine.map(v=>record(v.licensePlate,v.model,v.fitnessStatus,[["Type",v.type],["Color",v.colour||v.color],["Vehicle ID",v.vehicleId]],`<a class="button" href="owner-vehicles.html">View vehicle</a>`,v.type)).join("")||emptyState("No vehicles yet","Add a vehicle to this account to see it here.")}</div></section><section class="tab-panel" data-panel="notices" hidden><div class="record-grid" style="margin-top:18px">${myNotices.map(n=>record(n.noticeId,n.violationEventId,noticeStatusLabel(n),[["Fine",money(n.fineAmount)],["Due",date(n.dueDate)]],`<a class="button" href="owner-notices.html">View notice</a>`,resolveNoticeStatus(n))).join("")||emptyState("You're all clear","There are no traffic notices on this account right now.")}</div></section>`;
}

async function ownerVehicles() {
  const [vehicles,statuses]=await Promise.all([list("vehicles"),list("vehicleStatus")]);
  const mine=isLiveMode()?vehicles:vehicles.filter(v=>v.ownerId==="OWN-001");
  const checks={};
  if(isLiveMode()){
    const results=await Promise.all(mine.map(v=>get("vehicleFitnessReport",v.licensePlate)));
    mine.forEach((v,i)=>{checks[v.licensePlate]=results[i];});
  }
  const addForm = isLiveMode() ? `<form class="neo-card panel form-grid" id="vehicle-form" style="margin-bottom:18px"><div><p class="eyebrow">Register vehicle</p><h2>Add a vehicle to this account</h2></div><div class="field-group"><label for="vehicle-plate">Licence plate</label><input class="field" id="vehicle-plate" name="licensePlate" required minlength="6" maxlength="30" pattern="[A-Za-z0-9-]+" placeholder="DHAKA-METRO-..."></div><div class="field-group"><label for="vehicle-type">Type</label><input class="field" id="vehicle-type" name="type" required minlength="2" maxlength="30" placeholder="Car"></div><div class="field-group"><label for="vehicle-colour">Colour</label><input class="field" id="vehicle-colour" name="colour" required minlength="2" maxlength="30"></div><div class="field-group"><label for="vehicle-model">Model</label><input class="field" id="vehicle-model" name="model" required minlength="2" maxlength="50"></div><div class="field-group"><label for="vehicle-fitness">Fitness status</label><select class="field" id="vehicle-fitness" name="fitnessStatus"><option value="Valid">Valid</option><option value="Expired">Expired</option></select></div><button class="button button--primary" type="submit">Register vehicle</button></form>` : "";
  root.innerHTML=head(...headings[page])+addForm+toolbar(["car","motorcycle","valid","expires-soon"])+`<section class="record-grid">${mine.map(v=>{const s=statuses.find(x=>String(x.vehicleId)===String(v.vehicleId)||String(x.licensePlate)===String(v.licensePlate));return record(v.licensePlate,v.vehicleId,v.fitnessStatus,[["Model",v.model],["Type",v.type],["Color",v.colour||v.color],["Legal status",s?.statusType||s?.status||"clear"],["Fitness check",checks[v.licensePlate]?.message||"Live mode required"]],"",`${v.type} ${v.fitnessStatus}`)}).join("")||emptyState("No vehicles yet","Add a vehicle to this account to see it here.")}</section>${empty()}`;
  document.querySelector("#vehicle-form")?.addEventListener("submit",async(event)=>{event.preventDefault();const button=event.currentTarget.querySelector("button[type=submit]");button.disabled=true;try{const values=Object.fromEntries(new FormData(event.currentTarget));await mutate("vehicles",values);showToast("Vehicle registered");if(isLiveMode())setTimeout(()=>location.reload(),700);}catch(error){showToast(error.message,"danger");button.disabled=false;}});
}

async function paymentPage() {
  const noticeId = new URLSearchParams(window.location.search).get("notice");
  if (!noticeId) {
    const [notices,payments] = await Promise.all([list("notices"),list("payments")]);
    const eligible = notices.filter(noticeCanPay);
    root.innerHTML = head(...headings[page]) + `<section class="neo-card panel"><h2>Select an eligible notice</h2><div class="record-grid">${eligible.map(n=>record(n.noticeId,n.licensePlate||n.vehicleId,noticeStatusLabel(n),[["Fine",money(n.fineAmount)],["Due",date(n.dueDate)]],`<a class="button button--primary" href="?notice=${encodeURIComponent(n.noticeId)}">Pay this notice</a>`,resolveNoticeStatus(n))).join("")||emptyState("Nothing to pay right now","Paid, pending, and appealed notices stay out of this list.")}</div></section><section class="neo-card panel"><h2>Payment history</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Notice</th><th>Status</th><th>Amount</th></tr></thead><tbody>${payments.map(p=>`<tr><td>${safe(p.paymentId)}</td><td>${safe(p.noticeId)}</td><td>${safe(p.status)}</td><td>${safe(money(p.amount))}</td></tr>`).join("")||`<tr><td colspan="4">No payment records yet.</td></tr>`}</tbody></table></div></section>`;
    return;
  }
  let notice;
  try {
    notice = await get("notices", noticeId);
  } catch (err) {
    root.innerHTML = head(...headings[page]) + `<div class="alert-banner" style="--banner-color:var(--color-danger)"><i data-lucide="circle-alert"></i><div><strong>Data load error</strong><p>${safe(err.message)}</p></div></div>`;
    return;
  }
  if (!notice) {
    root.innerHTML = head(...headings[page]) + `<div class="alert-banner" style="--banner-color:var(--color-danger)"><i data-lucide="circle-alert"></i><div><strong>Notice not found.</strong><p>The requested notice ID (${safe(noticeId)}) could not be found.</p></div></div>`;
    return;
  }
  const eligible = noticeCanPay(notice);
  const isPaid = resolveNoticeStatus(notice) === "paid";
  const disabledAttr = eligible ? "" : "disabled";

  root.innerHTML = head(...headings[page]) + `<div class="split-view"><form class="neo-card panel form-grid" id="payment-form"><div><p class="eyebrow">Payment method</p><h2>${isLiveMode()?"Record a completed payment":"Simulate payment"}</h2></div><div class="segmented" role="tablist"><button class="segment" data-tab="mfs" aria-selected="true" type="button">By MFS</button><button class="segment" data-tab="bank" aria-selected="false" type="button">By Bank</button></div><div data-panel="mfs"><div class="field-group"><label for="mfs-provider">Provider</label><select id="mfs-provider" name="provider" ${disabledAttr}><option>bKash</option><option>Nagad</option></select></div><div class="field-group"><label for="mfs-reference">Transaction reference</label><input class="field" id="mfs-reference" name="reference" required minlength="6" maxlength="50" pattern="[A-Za-z0-9-]+" placeholder="MFS-REFERENCE" ${disabledAttr}></div></div><div data-panel="bank" hidden><div class="field-group"><label for="bank-provider">Bank</label><select id="bank-provider" name="provider" ${disabledAttr}><option>DBBL</option><option>BRAC Bank</option><option>City Bank</option></select></div><div class="field-group"><label for="bank-reference">Reference number</label><input class="field" id="bank-reference" name="reference" required minlength="6" maxlength="50" pattern="[A-Za-z0-9-]+" ${disabledAttr}></div></div><div class="field-group"><label for="payment-notice">Notice ID</label><input class="field" id="payment-notice" value="${safe(notice.noticeId)}" readonly></div><div class="field-group"><label for="payment-amount">Amount</label><input class="field" id="payment-amount" value="${safe(notice.fineAmount)}" readonly></div><button class="button button--primary" type="submit" ${disabledAttr}><i data-lucide="lock-keyhole"></i>${eligible ? "Submit payment request" : isPaid ? "Already Paid" : "Payment unavailable"}</button></form><aside class="neo-card panel"><div class="panel-heading"><p class="eyebrow">Payment summary</p>${badge(noticeStatusLabel(notice))}</div><h2>${safe(notice.noticeId)}</h2><p class="mono-chip">${safe(notice.licensePlate || notice.vehicleId)}</p>${isPaid ? `<div class="alert-banner" style="--banner-color:var(--color-success);margin:12px 0"><i data-lucide="check-circle"></i><div><strong>Paid</strong><p>This notice fine has been fully settled.</p></div></div>` : eligible ? "" : `<div class="alert-banner" style="--banner-color:var(--color-warning);margin:12px 0"><i data-lucide="triangle-alert"></i><div><strong>Payment unavailable</strong><p>This notice is pending payment, under appeal, or already resolved.</p></div></div>`}<hr><p><strong>Fine:</strong> ${safe(money(notice.fineAmount))}</p><p><strong>Due date:</strong> ${safe(date(notice.dueDate))}</p><p><strong>Service charge:</strong> BDT 0</p><p class="muted">Live mode records a successful simulated payment in Oracle. No external bank or MFS charge is initiated.</p><h2>Total ${safe(money(notice.fineAmount))}</h2></aside></div>`;
  const history=await list("payments");root.insertAdjacentHTML("beforeend",`<section class="neo-card panel"><h2>Payment history</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Notice</th><th>Method</th><th>Status</th><th>Amount</th></tr></thead><tbody>${history.map(p=>`<tr><td>${safe(p.paymentId)}</td><td>${safe(p.noticeId)}</td><td>${safe(p.method||p.paymentMethod)}</td><td>${safe(p.status)}</td><td>${safe(money(p.amount))}</td></tr>`).join("")}</tbody></table></div></section>`);
  if(eligible) document.querySelector("#payment-form")?.addEventListener("submit",async(event)=>{event.preventDefault();const button=event.currentTarget.querySelector("button[type=submit]");button.disabled=true;const values=new FormData(event.currentTarget);const method=document.querySelector('[data-tab][aria-selected="true"]')?.dataset.tab||"mfs";try{const result=await mutate("payments",{noticeId:notice.noticeId,method,provider:values.get("provider"),reference:values.get("reference")});showToast(result.demo?"Demo payment simulated; no data was saved":"Payment recorded as successful");if(isLiveMode()&&!result.demo)setTimeout(()=>location.href="owner-notices.html",700);}catch(error){showToast(error.message,"danger");button.disabled=false;}});
}

async function ownerAppeal() {
  const noticeId = new URLSearchParams(window.location.search).get("notice");
  if (!noticeId) {
    const notices=await list("notices");const eligible=notices.filter(noticeCanAppeal);
    root.innerHTML = head(...headings[page]) + `<section class="neo-card panel"><h2>Select an eligible notice</h2><div class="record-grid">${eligible.map(n=>record(n.noticeId,n.licensePlate||n.vehicleId,noticeStatusLabel(n),[["Fine",money(n.fineAmount)],["Due",date(n.dueDate)]],`<a class="button" href="?notice=${encodeURIComponent(n.noticeId)}">Appeal this notice</a>`,resolveNoticeStatus(n))).join("")||emptyState("No notices are currently eligible for appeal.","Current notices already have an appeal or are not in a payable pending state.")}</div></section>`;
    return;
  }

  let notice, appeals;
  try {
    [notice, appeals] = await Promise.all([
      get("notices", noticeId),
      list("appeals")
    ]);
  } catch (err) {
    root.innerHTML = head(...headings[page]) + `<div class="alert-banner" style="--banner-color:var(--color-danger)"><i data-lucide="circle-alert"></i><div><strong>Data load error</strong><p>${safe(err.message)}</p></div></div>`;
    return;
  }

  if (!notice) {
    root.innerHTML = head(...headings[page]) + `<div class="alert-banner" style="--banner-color:var(--color-danger)"><i data-lucide="circle-alert"></i><div><strong>Notice not found.</strong><p>The requested notice ID (${safe(noticeId)}) could not be found.</p></div></div>`;
    return;
  }

  const ownerAppeals = isLiveMode() ? appeals : appeals.filter(a=>a.ownerId==="OWN-001");
  const existingAppeal = ownerAppeals.find(a => String(a.noticeId) === String(noticeId));

  let formHtml = "";
  if (existingAppeal) {
    formHtml = `
      <div class="alert-banner" style="--banner-color:var(--color-warning);margin-bottom:20px;">
        <i data-lucide="triangle-alert"></i>
        <div>
          <strong>An appeal has already been submitted for this notice.</strong>
          <p>You cannot submit multiple appeals for the same notice.</p>
        </div>
      </div>
      <form class="neo-card panel form-grid">
        <div class="field-group"><label>Appeal ID</label><input class="field" value="${safe(existingAppeal.appealId)}" disabled></div>
        <div class="field-group"><label>Status</label><input class="field" value="${safe(existingAppeal.reviewStatus||existingAppeal.status)}" disabled></div>
        <div class="field-group"><label>Application Date</label><input class="field" value="${safe(date(existingAppeal.applicationDate))}" disabled></div>
        <div class="field-group"><label>Reason</label><textarea class="field" disabled>${safe(existingAppeal.reason)}</textarea></div>
        <div class="field-group"><label>Review Decision</label><input class="field" value="${safe(existingAppeal.reviewDecision || 'Pending')}" disabled></div>
        <div class="field-group"><label>Review Date</label><input class="field" value="${safe(existingAppeal.reviewDate ? date(existingAppeal.reviewDate) : 'N/A')}" disabled></div>
        <div class="field-group"><label>Remarks</label><textarea class="field" disabled>${safe(existingAppeal.remarks || '')}</textarea></div>
        <button class="button button--primary" type="button" disabled>Appeal Already Submitted</button>
      </form>
    `;
  } else if (!noticeCanAppeal(notice)) {
    formHtml = `<div class="alert-banner" style="--banner-color:var(--color-warning)"><i data-lucide="triangle-alert"></i><div><strong>Appeal unavailable</strong><p>This notice is paid, payment-pending, or otherwise not eligible for a new appeal.</p></div></div>`;
  } else {
    formHtml = `
      <form class="neo-card panel form-grid" id="appeal-form">
        <div class="field-group"><label for="appeal-notice">Notice ID</label><input class="field" id="appeal-notice" value="${safe(notice.noticeId)}" readonly></div>
        <div class="field-group"><label for="appeal-reason">Reason</label><textarea class="field" id="appeal-reason" name="reason" required minlength="10" maxlength="300" placeholder="Explain why the notice should be reviewed..."></textarea><small>Provide detailed reasons for your appeal.</small></div>
        <label class="check-row"><input type="checkbox" required>I declare that this information is accurate.</label>
        <button class="button button--primary" type="submit">Submit appeal</button>
      </form>
    `;
  }

  root.innerHTML = head(...headings[page]) + `
    <div class="split-view">
      <div>${formHtml}</div>
      <aside class="neo-card panel">
        <div class="panel-heading"><p class="eyebrow">Notice details</p>${badge(noticeStatusLabel(notice))}</div>
        <h2>${safe(notice.noticeId)}</h2>
        <p class="mono-chip">${safe(notice.licensePlate)}</p>
        <hr>
        <p><strong>Fine amount:</strong> ${safe(money(notice.fineAmount))}</p>
        <p><strong>Due date:</strong> ${safe(date(notice.dueDate))}</p>
      </aside>
    </div>
  `;
  document.querySelector("#appeal-form")?.addEventListener("submit",async(event)=>{event.preventDefault();const button=event.currentTarget.querySelector("button[type=submit]");button.disabled=true;try{const values=new FormData(event.currentTarget);const result=await mutate("appeals",{noticeId:notice.noticeId,reason:values.get("reason")});showToast(result.demo?"Demo appeal submitted":"Appeal submitted successfully");if(isLiveMode()&&!result.demo)setTimeout(()=>location.href="owner-notices.html",700);}catch(error){showToast(error.message,"danger");button.disabled=false;}});
}

async function dmpDashboard() { const [watch,statuses,vehicles,risks,segments]=await Promise.all([list("suspiciousVehicleEvents"),list("vehicleStatus"),list("vehicles"),list("riskAnalysis"),list("roadSegments")]);const watchStatuses=statuses.map(s=>({...s,status:String(s.status||s.statusType||"").toLowerCase()})).filter(s=>["wanted","stolen"].includes(s.status));root.innerHTML=head(...headings[page])+`<div class="alert-banner" style="--banner-color:var(--color-danger)"><i data-lucide="shield-alert"></i><div><strong>${watch.length} active watchlist detections</strong><p>Coordinate interception through the assigned DMP unit.</p></div></div><section class="dashboard-grid"><article><div class="panel-heading"><h2>Stolen & wanted watchlist</h2>${badge("danger")}</div><div class="record-grid">${watchStatuses.map(s=>{const v=vehicles.find(x=>String(x.vehicleId)===String(s.vehicleId));if(!v)return"";return record(v.licensePlate,s.statusId,s.status,[["Vehicle",`${v.color||v.colour} ${v.model}`],["Reason",s.reason||s.justification],["Effective",date(s.effectiveDate)]],`<a class="button" href="dmp-vehicle-lookup.html?plate=${encodeURIComponent(v.licensePlate)}">Trace journey</a>`,v.type)}).join("")}</div></article><aside class="neo-card panel"><p class="eyebrow">Accident blackspots</p><h2>Road risk index</h2><div class="metric-bars">${risks.map(r=>{const segment=segments.find(x=>String(x.roadSegmentId)===String(r.roadSegmentId));const width=Math.min(100,Number(r.violationCount||0)/2);return `<div class="metric-bar"><span>${safe(segment?.name||r.roadSegmentId)}</span><div class="metric-bar__track"><div class="metric-bar__fill" style="width:${width}%;--bar-color:${statusColor(r.riskLevel)}"></div></div><strong>${safe(r.accidentCount)}</strong></div>`}).join("")}</div><div class="evidence-placeholder" style="min-height:180px;margin-top:18px"><div><i data-lucide="map-pinned"></i><strong>Dhaka blackspot map</strong><p>Risk overlay placeholder</p></div></div></aside></section>`; }

async function vehicleLookup() { const [vehicles,journeys,statuses]=await Promise.all([list("vehicles"),list("vehicleJourney"),list("vehicleStatus")]);const requested=new URLSearchParams(location.search).get("plate")?.trim();const vehicle=requested?vehicles.find(v=>[v.licensePlate,v.vehicleId].some(value=>String(value).toLowerCase()===requested.toLowerCase())):vehicles[0];root.innerHTML=head(...headings[page])+`<form class="toolbar" method="get"><label class="search-field"><i data-lucide="search"></i><input name="plate" value="${safe(requested||vehicle?.licensePlate||"")}" aria-label="License plate" required></label><button class="button button--primary" type="submit">Search</button></form>`;if(!vehicle){root.innerHTML+=`<div class="empty-state"><h2>Vehicle not found</h2><p>No exact plate match was found.</p></div>`;return;}const history=journeys.filter(j=>String(j.vehicleId)===String(vehicle.vehicleId)||String(j.vehicleId)===String(vehicle.licensePlate));const status=statuses.find(s=>String(s.vehicleId)===String(vehicle.vehicleId)||String(s.vehicleId)===String(vehicle.licensePlate));root.innerHTML+=`<div class="split-view"><article class="neo-card panel"><p class="eyebrow">Vehicle record</p><h2>${safe(vehicle.licensePlate)}</h2>${badge(status?.status||status?.statusType||"clear")}<dl><dt>Vehicle</dt><dd>${safe(vehicle.color||vehicle.colour)} ${safe(vehicle.model)}</dd><dt>Type</dt><dd>${safe(vehicle.type)}</dd><dt>Fitness</dt><dd>${safe(vehicle.fitnessStatus)}</dd><dt>Watch remarks</dt><dd>${safe(status?.remarks||status?.justification||"None")}</dd></dl></article><article class="neo-card panel"><p class="eyebrow">Camera history</p><h2>Journey timeline</h2><div class="timeline">${history.map(j=>`<div class="timeline-item"><strong>${safe(j.intervalLocation||"Unknown location")}</strong><p>${safe(j.cameraId)} / avg ${safe(j.averageSpeed??"N/A")} km/h</p><span class="mono-chip">${safe(new Date(j.startTime).toLocaleString("en-BD"))}</span></div>`).join("")||"<p>No journey records found.</p>"}</div></article></div>`; }

async function dmpDashboardEnhanced() {
  const [watch,statuses,vehicles,risks,segments]=await Promise.all([list("suspiciousVehicleEvents"),list("vehicleStatus"),list("vehicles"),list("riskAnalysis"),list("roadSegments")]);
  const wanted = statuses.filter(s => ["wanted", "stolen"].includes(String(s.status || s.statusType || "").toLowerCase()));
  root.innerHTML=head(...headings[page])+`<div class="alert-banner" style="--banner-color:var(--color-danger)"><i data-lucide="shield-alert"></i><div><strong>${watch.length} suspicious detections</strong><p>Live subtype records and vehicle-status intelligence.</p></div></div><section class="dashboard-grid"><article><h2>Suspicious vehicle events</h2><div class="record-grid">${watch.map(w=>record(w.vehicleId||"Unknown plate",w.suspiciousVehicleEventId,w.severity||"danger",[["Type",w.type],["Camera",w.cameraId],["Detected",date(w.detectedAt)]],w.vehicleId?`<a class="button" href="dmp-vehicle-lookup.html?plate=${encodeURIComponent(w.vehicleId)}">Trace journey</a>`:"",w.type)).join("")||emptyState("No suspicious vehicle events","No SUSPICIOUS_VEHICLE_EVENT rows are currently recorded.")}</div></article><aside class="neo-card panel"><h2>Road risk index</h2>${risks.map(r=>`<p><strong>${safe(segments.find(s=>String(s.roadSegmentId)===String(r.roadSegmentId))?.name||r.roadSegmentId)}</strong>: ${safe(r.riskLevel)} / ${safe(date(r.analysisDate))}</p>`).join("")||"<p>No risk analysis rows are currently available.</p>"}<p>${safe(wanted.length)} active status alerts across ${safe(vehicles.length)} vehicles.</p></aside></section>`;
}

async function vehicleLookupEnhanced() {
  const requested=new URLSearchParams(location.search).get("plate")?.trim();
  root.innerHTML=head(...headings[page])+`<form class="toolbar" method="get"><label class="search-field"><i data-lucide="search"></i><input name="plate" value="${safe(requested||"")}" aria-label="License plate" required placeholder="DHAKA-METRO-..."></label><button class="button button--primary">Search</button></form>`;
  if(!requested){root.innerHTML+=`<div class="empty-state"><h2>Search vehicle records</h2><p>Enter an exact licence plate to retrieve Oracle reports.</p></div>`;return;}
  if(isLiveMode()){
    let lookup;
    try {
      lookup=await get("vehicleLookupReport",requested.toUpperCase());
    } catch (err) {
      root.innerHTML+=`<div class="empty-state"><h2>${safe(err.message)}</h2></div>`;
      return;
    }
    if(!lookup?.found){
      root.innerHTML+=`<div class="empty-state"><h2>${safe(lookup?.message)}</h2></div>`;
      return;
    }
  }
  const [vehicles,journeys,statuses]=await Promise.all([list("vehicles"),list("vehicleJourney"),list("vehicleStatus")]);
  const vehicle=vehicles.find(v=>String(v.licensePlate).toLowerCase()===requested.toLowerCase())||null;
  if(!isLiveMode() && !vehicle){root.innerHTML+=`<div class="empty-state"><h2>Vehicle not found</h2></div>`;return;}
  if(!vehicle){root.innerHTML+=`<div class="empty-state"><h2>${safe(requested)}</h2></div>`;return;}
  let profile=null,violations=[];
  if(isLiveMode()){
    const [profileResult,violationsResult]=await Promise.allSettled([get("vehicleProfileReport",vehicle.licensePlate),get("vehicleViolationsReport",vehicle.licensePlate)]);
    if(profileResult.status==="fulfilled") profile=profileResult.value;
    if(violationsResult.status==="fulfilled") violations=violationsResult.value||[];
  }
  const history=journeys.filter(j=>String(j.vehicleId)===String(vehicle.licensePlate));const status=statuses.find(s=>String(s.vehicleId)===String(vehicle.licensePlate));
  root.innerHTML+=`<div class="split-view"><article class="neo-card panel"><p class="eyebrow">VEHICLE_REPORT_TYPE</p><h2>${safe(vehicle.licensePlate)}</h2>${badge(profile?.legalStatus||status?.status||"clear")}<dl><dt>Owner</dt><dd>${safe(profile?.ownerName||"Demo owner")}</dd><dt>Fitness</dt><dd>${safe(profile?.fitnessStatus||vehicle.fitnessStatus)}</dd><dt>Total violations</dt><dd>${safe(profile?.violationCount??"Live mode required")}</dd></dl></article><article class="neo-card panel"><h2>Journey timeline</h2>${history.map(j=>`<p><strong>${safe(j.intervalLocation)}</strong> / ${safe(j.cameraId)} / ${safe(date(j.startTime))}</p>`).join("")||"<p>No journey records.</p>"}</article></div><section class="neo-card panel"><p class="eyebrow">VEHICLE_VIOLATION_VIEW</p><h2>Violation summary</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Event</th><th>Type</th><th>Notice</th><th>Status</th><th>Fine</th></tr></thead><tbody>${(violations||[]).map(v=>`<tr><td>${safe(v.violationEventId)}</td><td>${safe(v.violationType)}</td><td>${safe(v.noticeId||"Not issued")}</td><td>${safe(v.noticeStatus)}</td><td>${safe(v.fineAmount?money(v.fineAmount):"-")}</td></tr>`).join("")||`<tr><td colspan="5">No violation rows.</td></tr>`}</tbody></table></div></section>`;
}

function formatViewerCell(value) {
  if (value == null || value === "") return "";
  const text = String(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (!iso) return text;
  const [, year, month, day, hours, minutes, seconds] = iso;
  if (hours === "00" && minutes === "00" && seconds === "00") return `${day}-${month}-${year}`;
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

async function databaseViewer() {
  const selectedTable = new URLSearchParams(window.location.search).get("table");
  let tables;
  try {
    tables = await list("databaseTables");
  } catch (err) {
    root.innerHTML = head(...headings[page]) + `<div class="alert-banner" style="--banner-color:var(--color-warning)"><i data-lucide="circle-alert"></i><div><strong>Live admin access required</strong><p>${safe(err.message)}</p></div></div>`;
    return;
  }

  let dataHtml = `<div class="evidence-placeholder"><div><i data-lucide="database"></i><strong>No table selected</strong><p>Select a table from the list to view its contents.</p></div></div>`;
  
  if (selectedTable) {
    try {
      const data = await get("databaseTables", selectedTable);
      if (!data) throw new Error("Table not found or access denied.");
      if (data.rows.length === 0) {
        dataHtml = `<div class="alert-banner" style="--banner-color:var(--color-warning);margin-bottom:12px"><i data-lucide="triangle-alert"></i><div><strong>Empty Table</strong><p>The table ${safe(data.tableName)} contains no rows.</p></div></div>`;
        if (data.columns && data.columns.length > 0) {
           dataHtml += `<div class="data-table-wrap"><table class="data-table"><thead><tr>${data.columns.map(c=>`<th>${safe(c)}</th>`).join("")}</tr></thead><tbody></tbody></table></div>`;
        }
      } else {
        dataHtml = `
          <div style="margin-bottom: 12px; display:flex; justify-content: space-between; align-items:center;">
             <strong>${safe(data.tableName)}</strong>
             <span class="badge" style="--badge-color:var(--color-success)">${data.rows.length} rows (preview)</span>
          </div>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead><tr>${data.columns.map(c=>`<th>${safe(c)}</th>`).join("")}</tr></thead>
              <tbody>
                ${data.rows.map(r => `<tr>${data.columns.map(c => `<td>${safe(formatViewerCell(r[c]))}</td>`).join("")}</tr>`).join("")}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (err) {
      dataHtml = `<div class="alert-banner" style="--banner-color:var(--color-danger)"><i data-lucide="circle-alert"></i><div><strong>Table load error</strong><p>${safe(err.message)}</p></div></div>`;
    }
  }

  root.innerHTML = head(...headings[page]) + `
    <div class="split-view">
      <aside class="neo-card panel" style="flex: 0 0 250px;">
        <div class="panel-heading"><p class="eyebrow">Oracle Schema</p></div>
        <div style="display:flex; flex-direction:column; gap:4px; max-height: 60vh; overflow-y: auto;">
          ${tables.map(t => `<a class="button ${t === selectedTable ? 'button--primary' : ''}" href="?table=${encodeURIComponent(t)}" style="justify-content: flex-start; padding: 8px 12px;">${safe(t)}</a>`).join("")}
        </div>
      </aside>
      <section class="neo-card panel" style="flex: 1; overflow: hidden;">
         ${dataHtml}
      </section>
    </div>
  `;
}

const renderers = { "admin-dashboard":adminDashboard,"admin-cameras":camerasPage,"admin-zones":zonesPage,"admin-users":usersPage,"officer-dashboard":officerDashboard,"officer-verification":verificationPage,"officer-notices":()=>noticesPage(false),"officer-incidents":incidentsPage,"officer-appeals":officerAppealsMonitor,"supervisor-dashboard":supervisorDashboard,"supervisor-appeals":appealsReviewPage,"owner-dashboard":ownerDashboard,"owner-notices":()=>noticesPage(true),"owner-payment":paymentPage,"owner-appeal":ownerAppeal,"owner-vehicles":ownerVehicles,"dmp-dashboard":dmpDashboardEnhanced,"dmp-vehicle-lookup":vehicleLookupEnhanced, "database-viewer": databaseViewer };

function wirePageActions() {}

async function init() {
  root.innerHTML = loader();
  try { await renderers[page](); wirePageActions(); wireCommonInteractions(); }
  catch (error) { console.error(error); root.innerHTML = `<div class="alert-banner" style="--banner-color:var(--color-danger)"><i data-lucide="circle-alert"></i><div><strong>Data could not be loaded</strong><p>${safe(error.message)}</p></div></div>`; window.lucide?.createIcons(); }
}

init();
window.addEventListener("pageshow", (event) => {
  if (event.persisted && isLiveMode()) init();
});
