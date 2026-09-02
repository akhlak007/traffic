-- SMART TRAFFIC MANAGEMENT SYSTEM
-- DEMO DATA INSERT SCRIPT
-- Run against a freshly created SMART_TRAFFIC schema in FREEPDB1.

-- USER: generated IDs 1-5 admins, 6-11 traffic officers,
-- 12-16 DMP officers, and 17-21 vehicle owners.
-- Faculty demo logins (Password_hash set by backend/scripts/seed-faculty-demo.mjs):
--   1 Mushfiq admin, 2 Muskan admin, 6 Labiba supervisor, 7 Indira officer, 12 Jamila DMP.
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Mushfiq', 'Ahmed', 'mushfiq.admin@traffic.demo');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Muskan', 'Rahman', 'muskan.admin@traffic.demo');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Maliha', 'Akter', 'maliha.admin3@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Tanvir', 'Hasan', 'tanvir.admin4@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Sadia', 'Karim', 'sadia.admin5@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Labiba', 'Khan', 'labiba.supervisor@traffic.demo');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Indira', 'Hossain', 'indira.officer@traffic.demo');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Shakil', 'Khan', 'shakil.to3@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Nusrat', 'Jahan', 'nusrat.to4@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Arafat', 'Kabir', 'arafat.to5@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Mehedi', 'Alam', 'mehedi.to6@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Jamila', 'Akter', 'jamila.dmp@traffic.demo');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Samira', 'Sultana', 'samira.dmp2@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Fahim', 'Chowdhury', 'fahim.dmp3@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Tania', 'Noor', 'tania.dmp4@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Rashed', 'Miah', 'rashed.dmp5@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Arif', 'Mahmud', 'arif.owner1@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Lamia', 'Haque', 'lamia.owner2@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Sabbir', 'Rahman', 'sabbir.owner3@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Priya', 'Das', 'priya.owner4@example.com');
INSERT INTO "USER" (First_name, Last_name, Email) VALUES ('Jubayer', 'Ali', 'jubayer.owner5@example.com');

INSERT INTO PHONE (User_id, Phone_number) VALUES (1, '01711000001');
INSERT INTO PHONE (User_id, Phone_number) VALUES (6, '01711000006');
INSERT INTO PHONE (User_id, Phone_number) VALUES (12, '01711000012');
INSERT INTO PHONE (User_id, Phone_number) VALUES (17, '01711000017');
INSERT INTO PHONE (User_id, Phone_number) VALUES (18, '01711000018');

INSERT INTO ADMIN (ID, Designation) VALUES (1, 'System Administrator');
INSERT INTO ADMIN (ID, Designation) VALUES (2, 'Database Administrator');
INSERT INTO ADMIN (ID, Designation) VALUES (3, 'Operations Administrator');
INSERT INTO ADMIN (ID, Designation) VALUES (4, 'Security Administrator');
INSERT INTO ADMIN (ID, Designation) VALUES (5, 'Support Administrator');

INSERT INTO DMP_OFFICER (ID) VALUES (12);
INSERT INTO DMP_OFFICER (ID) VALUES (13);
INSERT INTO DMP_OFFICER (ID) VALUES (14);
INSERT INTO DMP_OFFICER (ID) VALUES (15);
INSERT INTO DMP_OFFICER (ID) VALUES (16);

INSERT INTO VEHICLE_OWNER (ID, Address) VALUES (17, 'Mirpur-10, Dhaka');
INSERT INTO VEHICLE_OWNER (ID, Address) VALUES (18, 'Uttara-7, Dhaka');
INSERT INTO VEHICLE_OWNER (ID, Address) VALUES (19, 'Dhanmondi-27, Dhaka');
INSERT INTO VEHICLE_OWNER (ID, Address) VALUES (20, 'Gulshan-2, Dhaka');
INSERT INTO VEHICLE_OWNER (ID, Address) VALUES (21, 'Mohakhali, Dhaka');

-- ZONE: generated IDs 1-5.
INSERT INTO ZONE (Name, Area) VALUES ('Mirpur Traffic Zone', 'Mirpur');
INSERT INTO ZONE (Name, Area) VALUES ('Uttara Traffic Zone', 'Uttara');
INSERT INTO ZONE (Name, Area) VALUES ('Dhanmondi Traffic Zone', 'Dhanmondi');
INSERT INTO ZONE (Name, Area) VALUES ('Gulshan Traffic Zone', 'Gulshan');
INSERT INTO ZONE (Name, Area) VALUES ('Mohakhali Traffic Zone', 'Mohakhali');

-- RHD: generated IDs 1-5.
INSERT INTO RHD (Department_name, Office_location) VALUES ('Road Maintenance Division', 'Mirpur Office');
INSERT INTO RHD (Department_name, Office_location) VALUES ('Signal Maintenance Division', 'Uttara Office');
INSERT INTO RHD (Department_name, Office_location) VALUES ('Drainage and Manhole Division', 'Dhanmondi Office');
INSERT INTO RHD (Department_name, Office_location) VALUES ('Road Infrastructure Division', 'Gulshan Office');
INSERT INTO RHD (Department_name, Office_location) VALUES ('Emergency Clearance Division', 'Mohakhali Office');

-- Officer 6 (Labiba) is the senior officer supervising officers 7-11.
INSERT INTO TRAFFIC_OFFICER (ID, Rank, Assigned_zone, Supervised_by) VALUES (6, 'Senior Sergeant', 1, NULL);
INSERT INTO TRAFFIC_OFFICER (ID, Rank, Assigned_zone, Supervised_by) VALUES (7, 'Sergeant', 1, 6);
INSERT INTO TRAFFIC_OFFICER (ID, Rank, Assigned_zone, Supervised_by) VALUES (8, 'Sergeant', 2, 6);
INSERT INTO TRAFFIC_OFFICER (ID, Rank, Assigned_zone, Supervised_by) VALUES (9, 'Constable', 3, 6);
INSERT INTO TRAFFIC_OFFICER (ID, Rank, Assigned_zone, Supervised_by) VALUES (10, 'Constable', 4, 6);
INSERT INTO TRAFFIC_OFFICER (ID, Rank, Assigned_zone, Supervised_by) VALUES (11, 'Constable', 5, 6);

-- ROAD_SEGMENT: generated IDs 1-5.
INSERT INTO ROAD_SEGMENT (Name, Start_point, End_point, Speed_limit, Lane, Zone_id) VALUES ('Rokeya Sarani', 'Mirpur-10', 'Kazipara', 40, 4, 1);
INSERT INTO ROAD_SEGMENT (Name, Start_point, End_point, Speed_limit, Lane, Zone_id) VALUES ('Airport Road', 'Uttara House Building', 'Airport', 60, 6, 2);
INSERT INTO ROAD_SEGMENT (Name, Start_point, End_point, Speed_limit, Lane, Zone_id) VALUES ('Satmasjid Road', 'Dhanmondi-27', 'Jigatola', 40, 4, 3);
INSERT INTO ROAD_SEGMENT (Name, Start_point, End_point, Speed_limit, Lane, Zone_id) VALUES ('Gulshan Avenue', 'Gulshan-1', 'Gulshan-2', 50, 4, 4);
INSERT INTO ROAD_SEGMENT (Name, Start_point, End_point, Speed_limit, Lane, Zone_id) VALUES ('Mohakhali Flyover Road', 'Mohakhali', 'Banani', 60, 6, 5);

-- CAMERA: generated IDs 1-5.
INSERT INTO CAMERA (Status, Road_segment_id) VALUES ('Active', 1);
INSERT INTO CAMERA (Status, Road_segment_id) VALUES ('Active', 2);
INSERT INTO CAMERA (Status, Road_segment_id) VALUES ('Under Maintenance', 3);
INSERT INTO CAMERA (Status, Road_segment_id) VALUES ('Active', 4);
INSERT INTO CAMERA (Status, Road_segment_id) VALUES ('Inactive', 5);

-- VEHICLE: generated IDs 1-5.
INSERT INTO VEHICLE (Licence_plate_no, Fitness_status, Type, Colour, Model, Vehicle_owner_id) VALUES ('DHAKA-METRO-GA-11-1001', 'Valid', 'Car', 'White', 'Toyota Axio', 17);
INSERT INTO VEHICLE (Licence_plate_no, Fitness_status, Type, Colour, Model, Vehicle_owner_id) VALUES ('DHAKA-METRO-KHA-12-2002', 'Valid', 'Motorcycle', 'Black', 'Yamaha FZ', 18);
INSERT INTO VEHICLE (Licence_plate_no, Fitness_status, Type, Colour, Model, Vehicle_owner_id) VALUES ('DHAKA-METRO-CHA-13-3003', 'Expired', 'Bus', 'Blue', 'Tata Starbus', 19);
INSERT INTO VEHICLE (Licence_plate_no, Fitness_status, Type, Colour, Model, Vehicle_owner_id) VALUES ('DHAKA-METRO-GHA-14-4004', 'Valid', 'Truck', 'Red', 'Ashok Leyland', 20);
INSERT INTO VEHICLE (Licence_plate_no, Fitness_status, Type, Colour, Model, Vehicle_owner_id) VALUES ('DHAKA-METRO-LA-15-5005', 'Valid', 'Car', 'Silver', 'Honda Grace', 21);

INSERT INTO VEHICLE_STATUS (Vehicle_id, Dmp_officer_id, Status_type, Effective_date, Expiry_date) VALUES (1, 12, 'Normal', DATE '2026-01-01', NULL);
INSERT INTO VEHICLE_STATUS (Vehicle_id, Dmp_officer_id, Status_type, Effective_date, Expiry_date) VALUES (2, 13, 'Wanted', DATE '2026-02-15', DATE '2026-12-31');
INSERT INTO VEHICLE_STATUS (Vehicle_id, Dmp_officer_id, Status_type, Effective_date, Expiry_date) VALUES (3, 14, 'Unfit', DATE '2026-03-10', DATE '2026-09-10');
INSERT INTO VEHICLE_STATUS (Vehicle_id, Dmp_officer_id, Status_type, Effective_date, Expiry_date) VALUES (4, 15, 'Blacklisted', DATE '2026-04-05', NULL);
INSERT INTO VEHICLE_STATUS (Vehicle_id, Dmp_officer_id, Status_type, Effective_date, Expiry_date) VALUES (5, 16, 'Recovered', DATE '2026-05-20', NULL);

-- CAMERA_EVENT: generated IDs 1-25, ordered by subtype in groups of five.
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (1, DATE '2026-07-01', TIMESTAMP '2026-07-01 08:10:00', 94.50);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (2, DATE '2026-07-02', TIMESTAMP '2026-07-02 09:20:00', 88.00);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (3, DATE '2026-07-03', TIMESTAMP '2026-07-03 10:30:00', 76.25);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (4, DATE '2026-07-04', TIMESTAMP '2026-07-04 11:40:00', 91.75);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (5, DATE '2026-07-05', TIMESTAMP '2026-07-05 12:50:00', 82.40);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (1, DATE '2026-07-06', TIMESTAMP '2026-07-06 13:10:00', 96.20);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (2, DATE '2026-07-07', TIMESTAMP '2026-07-07 14:20:00', 85.60);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (3, DATE '2026-07-08', TIMESTAMP '2026-07-08 15:30:00', 79.30);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (4, DATE '2026-07-09', TIMESTAMP '2026-07-09 16:40:00', 93.10);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (5, DATE '2026-07-10', TIMESTAMP '2026-07-10 17:50:00', 72.80);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (1, DATE '2026-07-11', TIMESTAMP '2026-07-11 08:15:00', 90.00);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (2, DATE '2026-07-12', TIMESTAMP '2026-07-12 09:25:00', 87.50);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (3, DATE '2026-07-13', TIMESTAMP '2026-07-13 10:35:00', 84.00);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (4, DATE '2026-07-14', TIMESTAMP '2026-07-14 11:45:00', 92.30);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (5, DATE '2026-07-15', TIMESTAMP '2026-07-15 12:55:00', 81.90);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (1, DATE '2026-07-16', TIMESTAMP '2026-07-16 13:15:00', 95.00);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (2, DATE '2026-07-17', TIMESTAMP '2026-07-17 14:25:00', 89.40);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (3, DATE '2026-07-18', TIMESTAMP '2026-07-18 15:35:00', 78.70);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (4, DATE '2026-07-19', TIMESTAMP '2026-07-19 16:45:00', 91.20);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (5, DATE '2026-07-20', TIMESTAMP '2026-07-20 17:55:00', 83.60);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (1, DATE '2026-07-21', TIMESTAMP '2026-07-21 08:20:00', 93.80);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (2, DATE '2026-07-22', TIMESTAMP '2026-07-22 09:30:00', 86.10);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (3, DATE '2026-07-23', TIMESTAMP '2026-07-23 10:40:00', 77.60);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (4, DATE '2026-07-24', TIMESTAMP '2026-07-24 11:50:00', 90.90);
INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score) VALUES (5, DATE '2026-07-25', TIMESTAMP '2026-07-25 13:00:00', 80.50);

INSERT INTO VIOLATION_EVENT (ID, Type, Lane_number, Traffic_officer_id, Monitor_date, Action_taken, Remarks) VALUES (1, 'Overspeed', 2, 6, DATE '2026-07-01', 'Notice generation approved', 'High-confidence overspeed event');
INSERT INTO VIOLATION_EVENT (ID, Type, Lane_number, Traffic_officer_id, Monitor_date, Action_taken, Remarks) VALUES (2, 'No Helmet', 1, 7, DATE '2026-07-02', 'Manual evidence checked', 'No helmet detected');
INSERT INTO VIOLATION_EVENT (ID, Type, Lane_number, Traffic_officer_id, Monitor_date, Action_taken, Remarks) VALUES (3, 'Wrong Lane', 3, 8, DATE '2026-07-03', 'Lane evidence reviewed', 'Wrong-lane event confirmed');
INSERT INTO VIOLATION_EVENT (ID, Type, Lane_number, Traffic_officer_id, Monitor_date, Action_taken, Remarks) VALUES (4, 'Red Light Violation', 2, 9, DATE '2026-07-04', 'Signal footage checked', 'Red-light event confirmed');
INSERT INTO VIOLATION_EVENT (ID, Type, Lane_number, Traffic_officer_id, Monitor_date, Action_taken, Remarks) VALUES (5, 'Illegal Parking', 1, 10, DATE '2026-07-05', 'Parking evidence reviewed', 'Illegal parking event confirmed');

INSERT INTO SUSPICIOUS_VEHICLE_EVENT (ID, Type) VALUES (6, 'Stolen Vehicle Match');
INSERT INTO SUSPICIOUS_VEHICLE_EVENT (ID, Type) VALUES (7, 'Wanted Vehicle Match');
INSERT INTO SUSPICIOUS_VEHICLE_EVENT (ID, Type) VALUES (8, 'Unfit Vehicle');
INSERT INTO SUSPICIOUS_VEHICLE_EVENT (ID, Type) VALUES (9, 'Plate Mismatch');
INSERT INTO SUSPICIOUS_VEHICLE_EVENT (ID, Type) VALUES (10, 'Repeated Suspicious Appearance');

INSERT INTO CONGESTION_EVENT (ID, Time, Severity, Vehicle_count, Traffic_officer_id, Monitor_date, Action_taken, Remarks) VALUES (11, INTERVAL '0 01:30:00' DAY TO SECOND, 'High', 145, 6, DATE '2026-07-11', 'Opened alternative lane', 'High congestion at Mirpur');
INSERT INTO CONGESTION_EVENT (ID, Time, Severity, Vehicle_count, Traffic_officer_id, Monitor_date, Action_taken, Remarks) VALUES (12, INTERVAL '0 00:45:00' DAY TO SECOND, 'Medium', 95, 7, DATE '2026-07-12', 'Adjusted signal timing', 'Medium congestion at Uttara');
INSERT INTO CONGESTION_EVENT (ID, Time, Severity, Vehicle_count, Traffic_officer_id, Monitor_date, Action_taken, Remarks) VALUES (13, INTERVAL '0 02:15:00' DAY TO SECOND, 'Severe', 210, 8, DATE '2026-07-13', 'Deployed additional officers', 'Severe congestion at Dhanmondi');
INSERT INTO CONGESTION_EVENT (ID, Time, Severity, Vehicle_count, Traffic_officer_id, Monitor_date, Action_taken, Remarks) VALUES (14, INTERVAL '0 00:30:00' DAY TO SECOND, 'Low', 60, 9, DATE '2026-07-14', 'Continued observation', 'Low congestion at Gulshan');
INSERT INTO CONGESTION_EVENT (ID, Time, Severity, Vehicle_count, Traffic_officer_id, Monitor_date, Action_taken, Remarks) VALUES (15, INTERVAL '0 01:10:00' DAY TO SECOND, 'High', 135, 10, DATE '2026-07-15', 'Created diversion route', 'High congestion at Mohakhali');

INSERT INTO ALERT_EVENT (ID, Type, Dmp_officer_id, Monitor_date, Action_taken, Remarks) VALUES (16, 'Accident', 12, DATE '2026-07-16', 'Emergency unit dispatched', 'Accident alert confirmed');
INSERT INTO ALERT_EVENT (ID, Type, Dmp_officer_id, Monitor_date, Action_taken, Remarks) VALUES (17, 'Fire', 13, DATE '2026-07-17', 'Fire service informed', 'Fire alert escalated');
INSERT INTO ALERT_EVENT (ID, Type, Dmp_officer_id, Monitor_date, Action_taken, Remarks) VALUES (18, 'Vehicle Breakdown', 14, DATE '2026-07-18', 'Recovery vehicle requested', 'Broken-down vehicle obstructing lane');
INSERT INTO ALERT_EVENT (ID, Type, Dmp_officer_id, Monitor_date, Action_taken, Remarks) VALUES (19, 'Road Blockage', 15, DATE '2026-07-19', 'Road clearance team informed', 'Road blockage confirmed');
INSERT INTO ALERT_EVENT (ID, Type, Dmp_officer_id, Monitor_date, Action_taken, Remarks) VALUES (20, 'Flooding', 16, DATE '2026-07-20', 'Flood response team informed', 'Waterlogging alert monitored');

INSERT INTO ROAD_DEFECT_EVENT (ID, Type, RHD_id, Review_date, Decision, Remarks) VALUES (21, 'Pothole', 1, DATE '2026-07-21', 'Approved', 'Pothole repair approved');
INSERT INTO ROAD_DEFECT_EVENT (ID, Type, RHD_id, Review_date, Decision, Remarks) VALUES (22, 'Damaged Signal', 2, DATE '2026-07-22', 'Approved', 'Signal maintenance scheduled');
INSERT INTO ROAD_DEFECT_EVENT (ID, Type, RHD_id, Review_date, Decision, Remarks) VALUES (23, 'Open Manhole', 3, DATE '2026-07-23', 'Pending', 'Site inspection required');
INSERT INTO ROAD_DEFECT_EVENT (ID, Type, RHD_id, Review_date, Decision, Remarks) VALUES (24, 'Broken Divider', 4, DATE '2026-07-24', 'Approved', 'Divider reconstruction approved');
INSERT INTO ROAD_DEFECT_EVENT (ID, Type, RHD_id, Review_date, Decision, Remarks) VALUES (25, 'Fallen Tree', 5, DATE '2026-07-25', 'Approved', 'Tree removal team assigned');

INSERT INTO EVIDENCE (Camera_event_id, Evidence_number, Captured_image_path, Captured_video_path)
SELECT
    ID,
    1,
    '/uploads/evidence/event_' || ID || '_plate.jpg',
    '/uploads/evidence/event_' || ID || '_clip.mp4'
FROM CAMERA_EVENT;

-- NOTICE: generated IDs 1-5.
INSERT INTO NOTICE (Issue_date, Due_date, Fine_amount, Violation_event_id) VALUES (DATE '2026-07-01', DATE '2026-07-15', 3000, 1);
INSERT INTO NOTICE (Issue_date, Due_date, Fine_amount, Violation_event_id) VALUES (DATE '2026-07-02', DATE '2026-07-16', 1000, 2);
INSERT INTO NOTICE (Issue_date, Due_date, Fine_amount, Violation_event_id) VALUES (DATE '2026-07-03', DATE '2026-07-17', 2000, 3);
INSERT INTO NOTICE (Issue_date, Due_date, Fine_amount, Violation_event_id) VALUES (DATE '2026-07-04', DATE '2026-07-18', 2500, 4);
INSERT INTO NOTICE (Issue_date, Due_date, Fine_amount, Violation_event_id) VALUES (DATE '2026-07-05', DATE '2026-07-19', 1500, 5);

-- PAYMENT: generated IDs 1-10.
INSERT INTO PAYMENT (Payment_date, Status, Amount) VALUES (DATE '2026-07-06', 'Successful', 3000);
INSERT INTO PAYMENT (Payment_date, Status, Amount) VALUES (DATE '2026-07-07', 'Successful', 1000);
INSERT INTO PAYMENT (Payment_date, Status, Amount) VALUES (DATE '2026-07-08', 'Pending', 2000);
INSERT INTO PAYMENT (Payment_date, Status, Amount) VALUES (DATE '2026-07-09', 'Failed', 2500);
INSERT INTO PAYMENT (Payment_date, Status, Amount) VALUES (DATE '2026-07-10', 'Successful', 1500);
INSERT INTO PAYMENT (Payment_date, Status, Amount) VALUES (DATE '2026-07-11', 'Successful', 3000);
INSERT INTO PAYMENT (Payment_date, Status, Amount) VALUES (DATE '2026-07-12', 'Pending', 1000);
INSERT INTO PAYMENT (Payment_date, Status, Amount) VALUES (DATE '2026-07-13', 'Successful', 2000);
INSERT INTO PAYMENT (Payment_date, Status, Amount) VALUES (DATE '2026-07-14', 'Refunded', 2500);
INSERT INTO PAYMENT (Payment_date, Status, Amount) VALUES (DATE '2026-07-15', 'Successful', 1500);

INSERT INTO BY_BANK (ID, Branch_name, Receipt_no) VALUES (1, 'Bangladesh Bank Motijheel Branch', 'BB-REC-001');
INSERT INTO BY_BANK (ID, Branch_name, Receipt_no) VALUES (2, 'Sonali Bank Mirpur Branch', 'SB-REC-002');
INSERT INTO BY_BANK (ID, Branch_name, Receipt_no) VALUES (3, 'Janata Bank Uttara Branch', 'JB-REC-003');
INSERT INTO BY_BANK (ID, Branch_name, Receipt_no) VALUES (4, 'Agrani Bank Dhanmondi Branch', 'AB-REC-004');
INSERT INTO BY_BANK (ID, Branch_name, Receipt_no) VALUES (5, 'Rupali Bank Gulshan Branch', 'RB-REC-005');

INSERT INTO BY_MFS (ID, Ref_no, Name, Transaction_id) VALUES (6, 'REF-BK-006', 'bKash', 'TXN-BK-006');
INSERT INTO BY_MFS (ID, Ref_no, Name, Transaction_id) VALUES (7, 'REF-NG-007', 'Nagad', 'TXN-NG-007');
INSERT INTO BY_MFS (ID, Ref_no, Name, Transaction_id) VALUES (8, 'REF-RK-008', 'Rocket', 'TXN-RK-008');
INSERT INTO BY_MFS (ID, Ref_no, Name, Transaction_id) VALUES (9, 'REF-UP-009', 'Upay', 'TXN-UP-009');
INSERT INTO BY_MFS (ID, Ref_no, Name, Transaction_id) VALUES (10, 'REF-BK-010', 'bKash', 'TXN-BK-010');

-- APPEAL: generated IDs 1-5; former review relationship data is inline.
INSERT INTO APPEAL (Review_status, Reason, Appeal_date, Vehicle_owner_id, Notice_id, Reviewer_officer_id, Review_date, Decision, Remarks) VALUES ('Pending', 'Vehicle was not exceeding the speed limit', DATE '2026-07-08', 17, 1, 6, DATE '2026-07-13', 'Pending', 'Speed evidence requested');
INSERT INTO APPEAL (Review_status, Reason, Appeal_date, Vehicle_owner_id, Notice_id, Reviewer_officer_id, Review_date, Decision, Remarks) VALUES ('Under Review', 'Helmet was temporarily removed at checkpoint', DATE '2026-07-09', 17, 2, 7, DATE '2026-07-14', 'Pending', 'Helmet video under review');
INSERT INTO APPEAL (Review_status, Reason, Appeal_date, Vehicle_owner_id, Notice_id, Reviewer_officer_id, Review_date, Decision, Remarks) VALUES ('Approved', 'Incorrect lane detection due to road diversion', DATE '2026-07-10', 17, 3, 8, DATE '2026-07-15', 'Approved', 'Road diversion verified');
INSERT INTO APPEAL (Review_status, Reason, Appeal_date, Vehicle_owner_id, Notice_id, Reviewer_officer_id, Review_date, Decision, Remarks) VALUES ('Rejected', 'Signal evidence clearly shows violation', DATE '2026-07-11', 18, 4, 9, DATE '2026-07-16', 'Rejected', 'Violation confirmed from signal footage');
INSERT INTO APPEAL (Review_status, Reason, Appeal_date, Vehicle_owner_id, Notice_id, Reviewer_officer_id, Review_date, Decision, Remarks) VALUES ('Pending', 'Vehicle was parked because of breakdown', DATE '2026-07-12', 19, 5, 10, DATE '2026-07-17', 'Pending', 'Breakdown evidence requested');

INSERT INTO RISK_ANALYSIS (Analysis_date, Period_start, Period_end, Road_segment_id, Risk_level) VALUES (DATE '2026-08-01', DATE '2026-07-01', DATE '2026-07-31', 1, 'warning');
INSERT INTO RISK_ANALYSIS (Analysis_date, Period_start, Period_end, Road_segment_id, Risk_level) VALUES (DATE '2026-08-01', DATE '2026-07-01', DATE '2026-07-31', 2, 'safe');
INSERT INTO RISK_ANALYSIS (Analysis_date, Period_start, Period_end, Road_segment_id, Risk_level) VALUES (DATE '2026-08-01', DATE '2026-07-01', DATE '2026-07-31', 3, 'danger');
INSERT INTO RISK_ANALYSIS (Analysis_date, Period_start, Period_end, Road_segment_id, Risk_level) VALUES (DATE '2026-08-01', DATE '2026-07-01', DATE '2026-07-31', 4, 'safe');
INSERT INTO RISK_ANALYSIS (Analysis_date, Period_start, Period_end, Road_segment_id, Risk_level) VALUES (DATE '2026-08-01', DATE '2026-07-01', DATE '2026-07-31', 5, 'critical');

INSERT INTO VEHICLE_JOURNEY (Start_time_per_interval, End_time_per_interval, Distance_travelled, Interval_location, Interval_number, Vehicle_id, Camera_id) VALUES (TIMESTAMP '2026-07-01 08:00:00', TIMESTAMP '2026-07-01 08:20:00', 12.50, 'Rokeya Sarani', 1, 1, 1);
INSERT INTO VEHICLE_JOURNEY (Start_time_per_interval, End_time_per_interval, Distance_travelled, Interval_location, Interval_number, Vehicle_id, Camera_id) VALUES (TIMESTAMP '2026-07-02 09:00:00', TIMESTAMP '2026-07-02 09:30:00', 18.00, 'Airport Road', 2, 2, 2);
INSERT INTO VEHICLE_JOURNEY (Start_time_per_interval, End_time_per_interval, Distance_travelled, Interval_location, Interval_number, Vehicle_id, Camera_id) VALUES (TIMESTAMP '2026-07-03 10:00:00', TIMESTAMP '2026-07-03 10:45:00', 20.00, 'Satmasjid Road', 3, 3, 3);
INSERT INTO VEHICLE_JOURNEY (Start_time_per_interval, End_time_per_interval, Distance_travelled, Interval_location, Interval_number, Vehicle_id, Camera_id) VALUES (TIMESTAMP '2026-07-04 11:00:00', TIMESTAMP '2026-07-04 11:25:00', 15.75, 'Gulshan Avenue', 4, 4, 4);
INSERT INTO VEHICLE_JOURNEY (Start_time_per_interval, End_time_per_interval, Distance_travelled, Interval_location, Interval_number, Vehicle_id, Camera_id) VALUES (TIMESTAMP '2026-07-05 12:00:00', TIMESTAMP '2026-07-05 12:40:00', 22.00, 'Mohakhali Flyover Road', 5, 5, 5);

INSERT INTO INVOLVED_IN (Vehicle_id, Violation_event_id) VALUES (1, 1);
INSERT INTO INVOLVED_IN (Vehicle_id, Violation_event_id) VALUES (1, 2);
INSERT INTO INVOLVED_IN (Vehicle_id, Violation_event_id) VALUES (1, 3);
INSERT INTO INVOLVED_IN (Vehicle_id, Violation_event_id) VALUES (2, 4);
INSERT INTO INVOLVED_IN (Vehicle_id, Violation_event_id) VALUES (3, 5);

INSERT INTO IDENTIFIED_IN (Vehicle_id, Suspicious_event_id) VALUES (1, 6);
INSERT INTO IDENTIFIED_IN (Vehicle_id, Suspicious_event_id) VALUES (2, 7);
INSERT INTO IDENTIFIED_IN (Vehicle_id, Suspicious_event_id) VALUES (3, 8);
INSERT INTO IDENTIFIED_IN (Vehicle_id, Suspicious_event_id) VALUES (4, 9);
INSERT INTO IDENTIFIED_IN (Vehicle_id, Suspicious_event_id) VALUES (5, 10);

-- One vehicle owner can pay multiple different notices using separate payments.
INSERT INTO PAYS (Payment_id, Vehicle_owner_id, Notice_id) VALUES (1, 17, 1);
INSERT INTO PAYS (Payment_id, Vehicle_owner_id, Notice_id) VALUES (2, 17, 2);
INSERT INTO PAYS (Payment_id, Vehicle_owner_id, Notice_id) VALUES (3, 17, 3);
INSERT INTO PAYS (Payment_id, Vehicle_owner_id, Notice_id) VALUES (4, 18, 4);
INSERT INTO PAYS (Payment_id, Vehicle_owner_id, Notice_id) VALUES (5, 19, 5);

-- CASE_RECORD: generated IDs 1-5; former monitoring relationship data is inline.
INSERT INTO CASE_RECORD (Case_date, Case_type, Case_status, Vehicle_id, Dmp_officer_id, Monitor_date, Remarks) VALUES (DATE '2026-07-06', 'Stolen Vehicle', 'Open', 1, 12, DATE '2026-07-06', 'Stolen vehicle case under monitoring');
INSERT INTO CASE_RECORD (Case_date, Case_type, Case_status, Vehicle_id, Dmp_officer_id, Monitor_date, Remarks) VALUES (DATE '2026-07-07', 'Wanted Vehicle', 'Under Investigation', 2, 13, DATE '2026-07-07', 'Wanted vehicle case under investigation');
INSERT INTO CASE_RECORD (Case_date, Case_type, Case_status, Vehicle_id, Dmp_officer_id, Monitor_date, Remarks) VALUES (DATE '2026-07-08', 'Unfit Vehicle', 'Open', 3, 14, DATE '2026-07-08', 'Unfit vehicle case being monitored');
INSERT INTO CASE_RECORD (Case_date, Case_type, Case_status, Vehicle_id, Dmp_officer_id, Monitor_date, Remarks) VALUES (DATE '2026-07-09', 'Plate Mismatch', 'Resolved', 4, 15, DATE '2026-07-09', 'Plate mismatch case reviewed');
INSERT INTO CASE_RECORD (Case_date, Case_type, Case_status, Vehicle_id, Dmp_officer_id, Monitor_date, Remarks) VALUES (DATE '2026-07-10', 'Repeated Suspicious Appearance', 'Pending', 5, 16, DATE '2026-07-10', 'Repeated suspicious appearance being monitored');

COMMIT;
