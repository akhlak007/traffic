const PAYMENT_STATE_SQL = `
    SELECT payment.Status AS "status"
    FROM PAYS p
    JOIN PAYMENT payment ON payment.ID = p.Payment_id
    WHERE p.Notice_id = :noticeId AND payment.Status IN ('Pending', 'Successful')
    ORDER BY CASE payment.Status WHEN 'Successful' THEN 1 WHEN 'Pending' THEN 2 ELSE 3 END`;

export async function paymentBlockReason(connection, noticeId) {
  const paid = await connection.execute(PAYMENT_STATE_SQL, { noticeId });
  const paymentStatus = paid.rows?.[0]?.status;
  if (paymentStatus === "Successful") return "This notice has already been paid";
  if (paymentStatus === "Pending") return "A payment is already pending for this notice";

  const appeal = await connection.execute(
    `SELECT Review_status AS "status" FROM APPEAL WHERE Notice_id = :noticeId`,
    { noticeId }
  );
  const appealStatus = appeal.rows?.[0]?.status;
  if (appealStatus === "Pending" || appealStatus === "Under Review") {
    return "Payment is unavailable while an appeal is pending";
  }
  if (appealStatus === "Approved") {
    return "Payment cannot be processed because this notice was dismissed";
  }
  return null;
}

export async function appealBlockReason(connection, noticeId) {
  const paid = await connection.execute(PAYMENT_STATE_SQL, { noticeId });
  const paymentStatus = paid.rows?.[0]?.status;
  if (paymentStatus === "Successful") return "A paid notice cannot be appealed";
  if (paymentStatus === "Pending") return "A notice with a pending payment cannot be appealed";

  const appeal = await connection.execute(
    `SELECT Review_status AS "status" FROM APPEAL WHERE Notice_id = :noticeId`,
    { noticeId }
  );
  if (appeal.rows?.length) return "An appeal already exists for this notice";
  return null;
}
