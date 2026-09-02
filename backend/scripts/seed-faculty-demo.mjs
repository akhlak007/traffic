/**
 * Faculty/demo data seed. Not started by the backend.
 * Copies backend/.faculty-demo-passwords.example.json to
 * backend/.faculty-demo-passwords.json (gitignored) and set the five
 * local-only owner passwords, then run:
 *   node scripts/seed-faculty-demo.mjs
 * Staff logins (Mushfiq, Muskan, Indira, Labiba, Jamila) are hashed onto
 * existing ADMIN / TRAFFIC_OFFICER / DMP_OFFICER USER rows.
 * Existing faculty owners can refresh notice dates without passwords:
 *   node scripts/seed-faculty-demo.mjs --dates-only
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import oracledb from "oracledb";
import dotenv from "dotenv";
import { hashPassword } from "../utils/password.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(scriptDir, "../.env") });
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const KEYS = ["tanisha", "fahim", "zubaer", "swagata", "akhlak", "rafi"];
const FACULTY_NOTICE_SCHEDULE = {
  "FACULTY-TANISHA-1": { issueDaysAgo: 27, dueDaysAgo: 6 },
  "FACULTY-TANISHA-2": { issueDaysAgo: 37, dueDaysAgo: 16 },
  "FACULTY-FAHIM-PENDING": { issueDaysAgo: 20, dueDaysAgo: -1 },
  "FACULTY-FAHIM-OPEN": { issueDaysAgo: 14, dueDaysAgo: -7 },
  "FACULTY-ZUBAER-PAID-MFS": { issueDaysAgo: 32, dueDaysAgo: 11 },
  "FACULTY-ZUBAER-PAID-BANK": { issueDaysAgo: 25, dueDaysAgo: 4 },
  "FACULTY-ZUBAER-PAID-3": { issueDaysAgo: 10, dueDaysAgo: -11 },
  "FACULTY-ZUBAER-DISMISSED": { issueDaysAgo: 12, dueDaysAgo: -9 },
  "FACULTY-ZUBAER-PENDING-APPEAL": { issueDaysAgo: 5, dueDaysAgo: -16 },
  "FACULTY-SWAGATA-1": { issueDaysAgo: 22, dueDaysAgo: 1 },
  "FACULTY-SWAGATA-2": { issueDaysAgo: 18, dueDaysAgo: -3 },
  "FACULTY-AKHLAK-APPEAL": { issueDaysAgo: 15, dueDaysAgo: -6 },
  "FACULTY-AKHLAK-OPEN": { issueDaysAgo: 8, dueDaysAgo: -13 },
  "FACULTY-AKHLAK-OVERDUE": { issueDaysAgo: 40, dueDaysAgo: 19 }
};
const ACCOUNTS = {
  tanisha: { firstName: "Tanisha", lastName: "Tahsin", email: "tanisha.owner@traffic.demo", address: "Mirpur, Dhaka" },
  fahim: { firstName: "Fahim", lastName: "Hassan", email: "fahim.owner@traffic.demo", address: "Uttara, Dhaka" },
  zubaer: { firstName: "Zubaer", lastName: "Ahmed", email: "zubaer.owner@traffic.demo", address: "Dhanmondi, Dhaka" },
  swagata: { firstName: "Swagata", lastName: "Mallick", email: "swagata.owner@traffic.demo", address: "Gulshan, Dhaka" },
  akhlak: { firstName: "Akhlak", lastName: "Ud Zaman", email: "akhlak.owner@traffic.demo", address: "Mohakhali, Dhaka" },
  rafi: { firstName: "Rafi", lastName: "Islam", email: "rafi.owner@traffic.demo", address: "Banani, Dhaka" }
};
const STAFF_ACCOUNTS = [
  { id: 1, firstName: "Mushfiq", lastName: "Ahmed", email: "mushfiq.admin@traffic.demo", password: "admin1" },
  { id: 2, firstName: "Muskan", lastName: "Rahman", email: "muskan.admin@traffic.demo", password: "admin2" },
  { id: 7, firstName: "Indira", lastName: "Hossain", email: "indira.officer@traffic.demo", password: "officer1" },
  { id: 6, firstName: "Labiba", lastName: "Khan", email: "labiba.supervisor@traffic.demo", password: "supervisor1" },
  { id: 12, firstName: "Jamila", lastName: "Akter", email: "jamila.dmp@traffic.demo", password: "dmp1" }
];

function loadPasswords() {
  const path = join(scriptDir, "../.faculty-demo-passwords.json");
  if (!existsSync(path)) {
    throw new Error("Missing backend/.faculty-demo-passwords.json. Copy the example file and set the five local passwords.");
  }
  const values = JSON.parse(readFileSync(path, "utf8"));
  for (const key of KEYS) {
    const password = String(values[key] || "");
    if (password.length < 4 || password.includes("replace-this-locally")) {
      throw new Error(`Set a real local password for ${key} in backend/.faculty-demo-passwords.json`);
    }
  }
  return values;
}

async function returningId(connection, sql, binds, name) {
  const result = await connection.execute(sql, {
    ...binds,
    [name]: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
  });
  return result.outBinds[name][0];
}

async function createOwner(connection, profile, password) {
  const existing = await connection.execute(
    `SELECT ID AS "id" FROM "USER" WHERE LOWER(Email) = :email`,
    { email: profile.email }
  );
  if (existing.rows?.length) return { userId: existing.rows[0].id, reused: true };

  const passwordHash = await hashPassword(password);
  const userId = await returningId(connection, `
    INSERT INTO "USER" (First_name, Last_name, Email, Password_hash)
    VALUES (:firstName, :lastName, :email, :passwordHash)
    RETURNING ID INTO :userId`,
  { firstName: profile.firstName, lastName: profile.lastName, email: profile.email, passwordHash }, "userId");
  await connection.execute(
    `INSERT INTO VEHICLE_OWNER (ID, Address) VALUES (:userId, :address)`,
    { userId, address: profile.address }
  );
  return { userId, reused: false };
}

async function seedStaffLogins(connection) {
  const seeded = [];
  for (const staff of STAFF_ACCOUNTS) {
    const existing = await connection.execute(
      `SELECT ID AS "id" FROM "USER" WHERE ID = :id`,
      { id: staff.id }
    );
    if (!existing.rows?.length) {
      throw new Error(`Faculty staff seed requires USER ${staff.id} from database/02_insert_demo_data.sql`);
    }
    const passwordHash = await hashPassword(staff.password);
    await connection.execute(`
      UPDATE "USER"
      SET First_name = :firstName,
          Last_name = :lastName,
          Email = :email,
          Password_hash = :passwordHash
      WHERE ID = :id`,
    {
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      passwordHash,
      id: staff.id
    });
    seeded.push({ userId: staff.id, email: staff.email });
  }
  return seeded;
}

async function createVehicle(connection, ownerId, plate, type, colour, model) {
  const existing = await connection.execute(
    `SELECT ID AS "id" FROM VEHICLE WHERE Licence_plate_no = :plate`,
    { plate }
  );
  if (existing.rows?.length) return existing.rows[0].id;
  return returningId(connection, `
    INSERT INTO VEHICLE (Licence_plate_no, Fitness_status, Type, Colour, Model, Vehicle_owner_id)
    VALUES (:plate, 'Valid', :type, :colour, :model, :ownerId)
    RETURNING ID INTO :vehicleId`,
  { plate, type, colour, model, ownerId }, "vehicleId");
}

async function loadDemoRefs(connection) {
  const cameras = await connection.execute(
    `SELECT ID AS "id" FROM CAMERA ORDER BY ID FETCH FIRST 5 ROWS ONLY`
  );
  const officers = await connection.execute(
    `SELECT ID AS "id" FROM TRAFFIC_OFFICER ORDER BY ID FETCH FIRST 1 ROW ONLY`
  );
  const cameraIds = (cameras.rows || []).map((row) => Number(row.id));
  const officerId = Number(officers.rows?.[0]?.id);
  if (cameraIds.length < 5 || !Number.isInteger(officerId) || officerId <= 0) {
    throw new Error("Faculty seed requires cameras and a traffic officer from database/02_insert_demo_data.sql");
  }
  return { cameraIds, officerId };
}

async function createNotice(connection, { vehicleId, cameraId, officerId, type, fine, remark, issueDaysAgo = 0, dueDaysAgo = -21 }) {
  const eventDaysAgo = Number(issueDaysAgo) + 1;
  const eventId = await returningId(connection, `
    INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score)
    VALUES (
      :cameraId,
      TRUNC(SYSDATE) - :eventDaysAgo,
      TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - :eventDaysAgo, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS'),
      90.00
    )
    RETURNING ID INTO :eventId`, { cameraId, eventDaysAgo }, "eventId");
  await connection.execute(`
    INSERT INTO EVIDENCE (Camera_event_id, Evidence_number, Captured_image_path, Captured_video_path)
    VALUES (:eventId, 1, :imagePath, :videoPath)`,
  {
    eventId,
    imagePath: `/uploads/evidence/event_${eventId}_plate.jpg`,
    videoPath: `/uploads/evidence/event_${eventId}_clip.mp4`
  });
  await connection.execute(`
    INSERT INTO VIOLATION_EVENT (ID, Type, Lane_number, Traffic_officer_id, Monitor_date, Action_taken, Remarks)
    VALUES (:eventId, :type, 1, :officerId, TRUNC(SYSDATE) - :eventDaysAgo, 'Confirmed', :remark)`,
  { eventId, type, officerId, eventDaysAgo, remark });
  await connection.execute(
    `INSERT INTO INVOLVED_IN (Vehicle_id, Violation_event_id) VALUES (:vehicleId, :eventId)`,
    { vehicleId, eventId }
  );
  return returningId(connection, `
    INSERT INTO NOTICE (Issue_date, Due_date, Fine_amount, Violation_event_id)
    VALUES (TRUNC(SYSDATE) - :issueDaysAgo, TRUNC(SYSDATE) - :dueDaysAgo, :fine, :eventId)
    RETURNING ID INTO :noticeId`,
  { fine, eventId, issueDaysAgo: Number(issueDaysAgo), dueDaysAgo: Number(dueDaysAgo) }, "noticeId");
}

async function createPayment(connection, { ownerId, noticeId, amount, status, method, provider, reference }) {
  const paymentId = await returningId(connection, `
    INSERT INTO PAYMENT (Payment_date, Status, Amount)
    VALUES (SYSDATE, :status, :amount)
    RETURNING ID INTO :paymentId`,
  { status, amount }, "paymentId");
  await connection.execute(
    `INSERT INTO PAYS (Payment_id, Vehicle_owner_id, Notice_id) VALUES (:paymentId, :ownerId, :noticeId)`,
    { paymentId, ownerId, noticeId }
  );
  if (method === "bank") {
    await connection.execute(
      `INSERT INTO BY_BANK (ID, Branch_name, Receipt_no) VALUES (:paymentId, :provider, :reference)`,
      { paymentId, provider, reference }
    );
  } else {
    await connection.execute(
      `INSERT INTO BY_MFS (ID, Ref_no, Name, Transaction_id) VALUES (:paymentId, :reference, :provider, :transactionId)`,
      { paymentId, reference, provider, transactionId: `MFS-${paymentId}` }
    );
  }
  return paymentId;
}

async function createAppeal(connection, { ownerId, noticeId, reason, reviewStatus = "Pending" }) {
  const appealId = await returningId(connection, `
    INSERT INTO APPEAL (Review_status, Reason, Appeal_date, Vehicle_owner_id, Notice_id)
    VALUES ('Pending', :reason, SYSDATE, :ownerId, :noticeId)
    RETURNING ID INTO :appealId`,
  { reason, ownerId, noticeId }, "appealId");
  if (reviewStatus !== "Pending") {
    await connection.execute(
      `UPDATE APPEAL
       SET Review_status = :reviewStatus,
           Decision = :reviewStatus,
           Review_date = SYSDATE,
           Remarks = :remarks
       WHERE ID = :appealId`,
      {
        reviewStatus,
        remarks: reviewStatus === "Approved"
          ? "Lane diversion was confirmed from the camera footage."
          : `Appeal ${String(reviewStatus).toLowerCase()} after review.`,
        appealId
      }
    );
  }
  return appealId;
}

function scheduleFor(remark) {
  const schedule = FACULTY_NOTICE_SCHEDULE[remark];
  if (!schedule) throw new Error(`Missing faculty notice schedule for ${remark}`);
  return schedule;
}

async function relabelPaidZubaerRemark(connection) {
  const result = await connection.execute(
    `UPDATE VIOLATION_EVENT
     SET Remarks = :newRemark
     WHERE Remarks = :oldRemark`,
    { oldRemark: "FACULTY-ZUBAER-OPEN", newRemark: "FACULTY-ZUBAER-PAID-3" }
  );
  return Number(result.rowsAffected || 0);
}

async function refreshFacultyNoticeDates(connection) {
  const updated = [];
  for (const [remark, { issueDaysAgo, dueDaysAgo }] of Object.entries(FACULTY_NOTICE_SCHEDULE)) {
    const eventDaysAgo = Number(issueDaysAgo) + 1;
    const found = await connection.execute(
      `SELECT n.ID AS "noticeId", ve.ID AS "eventId"
       FROM NOTICE n
       JOIN VIOLATION_EVENT ve ON ve.ID = n.Violation_event_id
       WHERE ve.Remarks = :remark`,
      { remark }
    );
    for (const row of found.rows || []) {
      await connection.execute(
        `UPDATE NOTICE
         SET Issue_date = TRUNC(SYSDATE) - :issueDaysAgo,
             Due_date = TRUNC(SYSDATE) - :dueDaysAgo
         WHERE ID = :noticeId`,
        { issueDaysAgo: Number(issueDaysAgo), dueDaysAgo: Number(dueDaysAgo), noticeId: row.noticeId }
      );
      await connection.execute(
        `UPDATE VIOLATION_EVENT
         SET Monitor_date = TRUNC(SYSDATE) - :eventDaysAgo
         WHERE ID = :eventId`,
        { eventDaysAgo, eventId: row.eventId }
      );
      await connection.execute(
        `UPDATE CAMERA_EVENT
         SET Event_date = TRUNC(SYSDATE) - :eventDaysAgo,
             Event_time = TO_TIMESTAMP(
               TO_CHAR(TRUNC(SYSDATE) - :eventDaysAgo, 'YYYY-MM-DD') || ' 10:00:00',
               'YYYY-MM-DD HH24:MI:SS'
             )
         WHERE ID = :eventId`,
        { eventDaysAgo, eventId: row.eventId }
      );
      updated.push({ remark, noticeId: row.noticeId, eventId: row.eventId });
    }
  }
  return updated;
}

async function ensureAkhlakOverdueNotice(connection, ownerId, refs) {
  const existing = await connection.execute(
    `SELECT n.ID AS "noticeId"
     FROM NOTICE n
     JOIN VIOLATION_EVENT ve ON ve.ID = n.Violation_event_id
     WHERE ve.Remarks = :remark`,
    { remark: "FACULTY-AKHLAK-OVERDUE" }
  );
  if (existing.rows?.length) return existing.rows[0].noticeId;
  const vehicle = await connection.execute(
    `SELECT ID AS "id" FROM VEHICLE WHERE Licence_plate_no = :plate AND Vehicle_owner_id = :ownerId`,
    { plate: "DHAKA-METRO-AK-25-2501", ownerId }
  );
  if (!vehicle.rows?.length) return null;
  const schedule = scheduleFor("FACULTY-AKHLAK-OVERDUE");
  return createNotice(connection, {
    vehicleId: vehicle.rows[0].id,
    cameraId: refs.cameraIds[1],
    officerId: refs.officerId,
    type: "Illegal Parking",
    fine: 2100,
    remark: "FACULTY-AKHLAK-OVERDUE",
    issueDaysAgo: schedule.issueDaysAgo,
    dueDaysAgo: schedule.dueDaysAgo
  });
}

async function seedOwner(connection, key, password, refs) {
  const profile = ACCOUNTS[key];
  const owner = await createOwner(connection, profile, password);
  if (owner.reused) return { key, email: profile.email, userId: owner.userId, skipped: true };

  const { cameraIds, officerId } = refs;
  const notice = (vehicleId, cameraIndex, type, fine, remark, issueDaysAgo, dueDaysAgo) => createNotice(connection, {
    vehicleId,
    cameraId: cameraIds[cameraIndex],
    officerId,
    type,
    fine,
    remark,
    issueDaysAgo,
    dueDaysAgo
  });
  const summary = { key, email: profile.email, userId: owner.userId, ownerId: owner.userId, vehicles: [], notices: [], payments: [], appeals: [] };

  if (key === "tanisha") {
    const vehicleId = await createVehicle(connection, owner.userId, "DHAKA-METRO-TA-21-2101", "Car", "White", "Toyota Axio");
    summary.vehicles.push({ vehicleId, plate: "DHAKA-METRO-TA-21-2101" });
    const paid = scheduleFor("FACULTY-TANISHA-1");
    const overdue = scheduleFor("FACULTY-TANISHA-2");
    summary.notices.push({ noticeId: await notice(vehicleId, 0, "Overspeed", 800, "FACULTY-TANISHA-1", paid.issueDaysAgo, paid.dueDaysAgo), fine: 800 });
    summary.notices.push({ noticeId: await notice(vehicleId, 1, "Wrong Lane", 900, "FACULTY-TANISHA-2", overdue.issueDaysAgo, overdue.dueDaysAgo), fine: 900 });
  }

  if (key === "fahim") {
    const vehicleId = await createVehicle(connection, owner.userId, "DHAKA-METRO-FA-22-2201", "Car", "Black", "Honda City");
    summary.vehicles.push({ vehicleId, plate: "DHAKA-METRO-FA-22-2201" });
    const pending = scheduleFor("FACULTY-FAHIM-PENDING");
    const open = scheduleFor("FACULTY-FAHIM-OPEN");
    const pendingNotice = await notice(vehicleId, 2, "Red Light Violation", 1100, "FACULTY-FAHIM-PENDING", pending.issueDaysAgo, pending.dueDaysAgo);
    const openNotice = await notice(vehicleId, 3, "Illegal Parking", 1200, "FACULTY-FAHIM-OPEN", open.issueDaysAgo, open.dueDaysAgo);
    summary.notices.push({ noticeId: pendingNotice, fine: 1100 }, { noticeId: openNotice, fine: 1200 });
    summary.payments.push({
      paymentId: await createPayment(connection, { ownerId: owner.userId, noticeId: pendingNotice, amount: 1100, status: "Pending", method: "mfs", provider: "bKash", reference: "FAHIM-PEND-01" }),
      status: "Pending"
    });
  }

  if (key === "zubaer") {
    const carId = await createVehicle(connection, owner.userId, "DHAKA-METRO-ZU-23-2301", "Car", "Blue", "Nissan Sunny");
    const bikeId = await createVehicle(connection, owner.userId, "DHAKA-METRO-ZU-23-2302", "Motorcycle", "Red", "Yamaha FZ");
    summary.vehicles.push({ vehicleId: carId, plate: "DHAKA-METRO-ZU-23-2301" }, { vehicleId: bikeId, plate: "DHAKA-METRO-ZU-23-2302" });
    const paidASchedule = scheduleFor("FACULTY-ZUBAER-PAID-MFS");
    const paidBSchedule = scheduleFor("FACULTY-ZUBAER-PAID-BANK");
    const dismissedSchedule = scheduleFor("FACULTY-ZUBAER-DISMISSED");
    const pendingSchedule = scheduleFor("FACULTY-ZUBAER-PENDING-APPEAL");
    const paidA = await notice(carId, 4, "Overspeed", 1300, "FACULTY-ZUBAER-PAID-MFS", paidASchedule.issueDaysAgo, paidASchedule.dueDaysAgo);
    const paidB = await notice(bikeId, 0, "No Helmet", 1400, "FACULTY-ZUBAER-PAID-BANK", paidBSchedule.issueDaysAgo, paidBSchedule.dueDaysAgo);
    const dismissed = await notice(carId, 1, "Wrong Lane", 1500, "FACULTY-ZUBAER-DISMISSED", dismissedSchedule.issueDaysAgo, dismissedSchedule.dueDaysAgo);
    const pendingAppeal = await notice(bikeId, 2, "No Helmet", 1000, "FACULTY-ZUBAER-PENDING-APPEAL", pendingSchedule.issueDaysAgo, pendingSchedule.dueDaysAgo);
    summary.notices.push({ noticeId: paidA, fine: 1300 }, { noticeId: paidB, fine: 1400 }, { noticeId: dismissed, fine: 1500 }, { noticeId: pendingAppeal, fine: 1000 });
    summary.payments.push({
      paymentId: await createPayment(connection, { ownerId: owner.userId, noticeId: paidA, amount: 1300, status: "Successful", method: "mfs", provider: "Nagad", reference: "ZUBAER-MFS-01" }),
      status: "Successful"
    });
    summary.payments.push({
      paymentId: await createPayment(connection, { ownerId: owner.userId, noticeId: paidB, amount: 1400, status: "Successful", method: "bank", provider: "DBBL", reference: "ZUBAER-BANK-01" }),
      status: "Successful"
    });
    summary.appeals.push({
      appealId: await createAppeal(connection, {
        ownerId: owner.userId,
        noticeId: dismissed,
        reason: "The vehicle was in a diverted lane because of road work.",
        reviewStatus: "Approved"
      }),
      status: "Approved"
    });
    summary.appeals.push({
      appealId: await createAppeal(connection, {
        ownerId: owner.userId,
        noticeId: pendingAppeal,
        reason: "The helmet was removed only at the checkpoint, not while riding."
      }),
      status: "Pending"
    });
  }

  if (key === "swagata") {
    const vehicleId = await createVehicle(connection, owner.userId, "DHAKA-METRO-SW-24-2401", "Car", "Silver", "Honda Grace");
    summary.vehicles.push({ vehicleId, plate: "DHAKA-METRO-SW-24-2401" });
    const aSchedule = scheduleFor("FACULTY-SWAGATA-1");
    const bSchedule = scheduleFor("FACULTY-SWAGATA-2");
    const a = await notice(vehicleId, 2, "Overspeed", 1600, "FACULTY-SWAGATA-1", aSchedule.issueDaysAgo, aSchedule.dueDaysAgo);
    const b = await notice(vehicleId, 3, "Illegal Parking", 1700, "FACULTY-SWAGATA-2", bSchedule.issueDaysAgo, bSchedule.dueDaysAgo);
    summary.notices.push({ noticeId: a, fine: 1600 }, { noticeId: b, fine: 1700 });
    summary.payments.push({
      paymentId: await createPayment(connection, { ownerId: owner.userId, noticeId: a, amount: 1600, status: "Successful", method: "mfs", provider: "bKash", reference: "SWAGATA-MFS-01" }),
      status: "Successful"
    });
    // Leave FACULTY-SWAGATA-2 unpaid for a live frontend payment demo.
  }

  if (key === "akhlak") {
    const vehicleId = await createVehicle(connection, owner.userId, "DHAKA-METRO-AK-25-2501", "Car", "Grey", "Toyota Premio");
    summary.vehicles.push({ vehicleId, plate: "DHAKA-METRO-AK-25-2501" });
    const appealedSchedule = scheduleFor("FACULTY-AKHLAK-APPEAL");
    const openSchedule = scheduleFor("FACULTY-AKHLAK-OPEN");
    const overdueSchedule = scheduleFor("FACULTY-AKHLAK-OVERDUE");
    const appealed = await notice(vehicleId, 4, "Red Light Violation", 1800, "FACULTY-AKHLAK-APPEAL", appealedSchedule.issueDaysAgo, appealedSchedule.dueDaysAgo);
    const open = await notice(vehicleId, 0, "Wrong Lane", 1900, "FACULTY-AKHLAK-OPEN", openSchedule.issueDaysAgo, openSchedule.dueDaysAgo);
    const overdue = await notice(vehicleId, 1, "Illegal Parking", 2100, "FACULTY-AKHLAK-OVERDUE", overdueSchedule.issueDaysAgo, overdueSchedule.dueDaysAgo);
    summary.notices.push({ noticeId: appealed, fine: 1800 }, { noticeId: open, fine: 1900 }, { noticeId: overdue, fine: 2100 });
    summary.appeals.push({
      appealId: await createAppeal(connection, { ownerId: owner.userId, noticeId: appealed, reason: "The red light was not visible from my lane." }),
      status: "Pending"
    });
  }

  if (key === "rafi") {
    const vehicleId = await createVehicle(connection, owner.userId, "DHAKA-METRO-RA-26-2601", "Car", "White", "Toyota Allion");
    summary.vehicles.push({ vehicleId, plate: "DHAKA-METRO-RA-26-2601" });
  }

  return summary;
}

const passwords = process.argv.includes("--dates-only") ? null : loadPasswords();
const connection = await oracledb.getConnection({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`
});

const report = [];
try {
  const refs = await loadDemoRefs(connection);
  if (passwords) {
    report.push({ staff: await seedStaffLogins(connection) });
    await connection.commit();
    for (const key of KEYS) {
      try {
        const row = await seedOwner(connection, key, passwords[key], refs);
        await connection.commit();
        report.push(row);
      } catch (error) {
        await connection.rollback();
        report.push({ key, error: error.message });
      }
    }
  } else {
    const akhlakUser = await connection.execute(
      `SELECT ID AS "id" FROM "USER" WHERE LOWER(Email) = :email`,
      { email: ACCOUNTS.akhlak.email }
    );
    if (akhlakUser.rows?.length) {
      report.push({ key: "akhlak", userId: akhlakUser.rows[0].id, skipped: true });
    }
  }
  const relabeledZubaer = await relabelPaidZubaerRemark(connection);
  const dateUpdates = await refreshFacultyNoticeDates(connection);
  const akhlak = report.find((row) => row.key === "akhlak" && row.userId);
  const overdueNoticeId = akhlak
    ? await ensureAkhlakOverdueNotice(connection, akhlak.userId, refs)
    : null;
  await connection.commit();
  console.log(JSON.stringify({ seeded: report, relabeledZubaer, dateUpdates, overdueNoticeId }, null, 2));
} finally {
  await connection.close();
}
