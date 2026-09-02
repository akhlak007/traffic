export const NOTICE_STATUS_LABELS = {
  pending: "Unpaid",
  overdue: "Overdue",
  paid: "Paid",
  "payment-pending": "Payment Pending",
  appealed: "Appeal Pending",
  dismissed: "Appeal Approved",
  "appeal-rejected": "Appeal Rejected"
};

export function flagOn(value) {
  return value === true || value === 1 || value === "1";
}

export function resolveNoticeStatus(notice) {
  if (String(notice?.paymentStatus || "").toLowerCase() === "successful") return "paid";
  const status = String(notice?.status || "").toLowerCase();
  if (
    String(notice?.paymentStatus || "").toLowerCase() === "pending"
    && ["", "pending", "overdue", "appeal-rejected", "payment-pending"].includes(status)
  ) {
    return "payment-pending";
  }
  return status;
}

export function noticeStatusLabel(noticeOrStatus) {
  const status = typeof noticeOrStatus === "object" && noticeOrStatus !== null
    ? resolveNoticeStatus(noticeOrStatus)
    : String(noticeOrStatus || "").toLowerCase();
  return NOTICE_STATUS_LABELS[status] || status || "Unknown";
}

export function noticeCanPay(notice) {
  const status = resolveNoticeStatus(notice);
  if (["paid", "payment-pending", "appealed", "dismissed"].includes(status)) return false;
  if (notice && Object.hasOwn(notice, "canPay")) return flagOn(notice.canPay);
  return ["pending", "overdue", "appeal-rejected"].includes(status);
}

export function noticeCanAppeal(notice) {
  const status = resolveNoticeStatus(notice);
  if (["paid", "payment-pending", "appealed", "dismissed", "appeal-rejected"].includes(status)) return false;
  if (notice && Object.hasOwn(notice, "canAppeal")) return flagOn(notice.canAppeal);
  return ["pending", "overdue"].includes(status);
}

export function presentNoticeRow(row) {
  const status = resolveNoticeStatus(row);
  const presented = {
    ...row,
    status,
    paymentStatus: row.paymentStatus || null
  };
  return {
    ...presented,
    displayStatus: NOTICE_STATUS_LABELS[status] || status,
    canPay: noticeCanPay(presented),
    canAppeal: noticeCanAppeal(presented)
  };
}
