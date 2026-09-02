import "dotenv/config";
import oracledb from "oracledb";
import { readFile } from "node:fs/promises";

const connectString = `${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "1521"}/${process.env.DB_SERVICE || "FREEPDB1"}`;
const connection = await oracledb.getConnection({ user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectString });
try {
  const source = await readFile(new URL("../../database/05_upgrade_evaluation_objects.sql", import.meta.url), "utf8");
  const clean = source.split(/\r?\n/).filter((line) => !/^\s*(?:SET|--)/.test(line)).join("\n");
  for (const statement of clean.split(/^\s*\/\s*$/m).map((value) => value.trim()).filter(Boolean)) {
    const executable = /^(?:BEGIN|CREATE OR REPLACE (?:FUNCTION|PROCEDURE))/i.test(statement)
      ? statement
      : statement.replace(/;\s*$/, "");
    try {
      await connection.execute(executable);
    } catch (error) {
      if (![1, 942, 955].includes(error.errorNum)) throw error;
    }
  }

  const errors = await connection.execute(`SELECT name, type, line, position, text FROM user_errors
    WHERE name IN ('FN_VIOLATION_COUNT','VEHICLE_VIOLATION_VIEW','VEHICLE_REPORT_TYPE','PR_GET_PENDING_APPEALS','PR_VERIFY_VIOLATION')
    ORDER BY name, sequence`);
  if (errors.rows.length) throw new Error(`Oracle compilation errors: ${JSON.stringify(errors.rows)}`);

  const plateResult = await connection.execute(`SELECT Licence_plate_no FROM VEHICLE WHERE ROWNUM=1`);
  const plate = plateResult.rows[0][0];
  const functionResult = await connection.execute(`SELECT FN_VIOLATION_COUNT(:plate) FROM DUAL`, { plate });
  const viewResult = await connection.execute(`SELECT COUNT(*) FROM VEHICLE_VIOLATION_VIEW WHERE Licence_plate_no=:plate`, { plate });
  const adtResult = await connection.execute(`SELECT r.Report.Owner_name FROM VEHICLE_REPORT r WHERE r.Report.Licence_plate_no=:plate`, { plate });
  const subqueryResult = await connection.execute(`WITH camera_counts AS (SELECT c.Camera_id, COUNT(ce.Event_id) n FROM CAMERA c LEFT JOIN CAMERA_EVENT ce ON ce.Camera_id=c.Camera_id GROUP BY c.Camera_id) SELECT COUNT(*) FROM camera_counts WHERE n>(SELECT AVG(n) FROM camera_counts)`);

  const monitored = await connection.execute(`SELECT Violation_event_id, Traffic_officer_id, Action_taken, Remarks FROM MONITORS_VIOLATION WHERE ROWNUM=1`);
  if (monitored.rows.length) {
    const [eventId, officerId] = monitored.rows[0];
    await connection.execute(`SAVEPOINT evaluation_test`);
    await connection.execute(`DELETE FROM MONITORS_VIOLATION WHERE Violation_event_id=:eventId`, { eventId });
    await connection.execute(`BEGIN PR_VERIFY_VIOLATION(:eventId,:officerId,'Confirmed','Non-destructive validation'); END;`, { eventId, officerId });
    await connection.execute(`ROLLBACK TO evaluation_test`);
  }
  await connection.rollback();
  console.log(JSON.stringify({ status: "passed", plate, violationCount: functionResult.rows[0][0], viewRows: viewResult.rows[0][0], adtOwner: adtResult.rows[0][0], aboveAverageCameras: subqueryResult.rows[0][0] }));
} finally {
  await connection.close();
}
