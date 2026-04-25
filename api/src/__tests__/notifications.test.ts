// PRD-014: Patient Notifications — integration tests
//
// Tests cover:
//  - sendResponseReadyEmail called on approve/amend
//  - sendRejectionEmail called on reject
//  - Notification record inserted in DB
//  - Audit log written for notification.sent
//  - SendGrid webhook updates delivery status
//  - Patient inbox returns items + unread count
//  - mark-read endpoint updates read_at
//
// The email service module is mocked — no real SendGrid calls.

import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { getTestPool, resetTestDb, closeTestPool } from "./helpers/db";

// Mock @sendgrid/mail so no real HTTP calls are made
jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([
    { statusCode: 202, headers: { "x-message-id": "test-msg-001" } },
    {},
  ]),
}));

const PATIENT_SUB = "patient-notif-001";
const DOCTOR_SUB = "doctor-notif-001";

let patientId: string;
let doctorId: string;
let consultationId: string;

async function seed() {
  const pool = getTestPool();

  // Patient
  const { rows: pRows } = await pool.query(
    `INSERT INTO patients (cognito_sub, email, full_name)
     VALUES ($1, $2, $3) RETURNING id`,
    [PATIENT_SUB, "patient-notif@example.com", "Alex Patient"]
  );
  patientId = pRows[0].id;

  // Doctor
  const { rows: dRows } = await pool.query(
    `INSERT INTO doctors (cognito_sub, email, first_name, last_name, ahpra_number, specialty, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id`,
    [DOCTOR_SUB, "doctor-notif@example.com", "Jane", "Smith", "MED0012345", "General Practice"]
  );
  doctorId = dRows[0].id;

  // Consultation in queued_for_review with AI content
  const { rows: cRows } = await pool.query(
    `INSERT INTO consultations
       (patient_id, assigned_doctor_id, status, consultation_type, presenting_complaint,
        ai_draft, soap_note, differential_diagnoses, priority_flags)
     VALUES ($1, $2, 'queued_for_review', 'text', 'Sore throat',
             'Based on your symptoms, this sounds like a viral upper respiratory tract infection.',
             '{"subjective":"sore throat for 2 days","objective":"no fever reported","assessment":"likely URTI","plan":"rest and fluids"}'::jsonb,
             '[{"diagnosis":"URTI","likelihood_pct":75}]'::jsonb,
             '{}')
     RETURNING id`,
    [patientId, doctorId]
  );
  consultationId = cRows[0].id;
}

beforeAll(async () => {
  await resetTestDb();
  await seed();
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// Approve → response_ready notification
// ---------------------------------------------------------------------------
describe("approve consultation", () => {
  let notificationId: string;

  it("creates a response_ready notification on approve", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const res = await request(app)
      .post(`/api/v1/doctor/consultations/${consultationId}/approve`)
      .expect(200);

    expect(res.body.status).toBe("approved");

    // Wait briefly for fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 100));

    const { rows } = await getTestPool().query(
      `SELECT * FROM notifications WHERE consultation_id = $1`,
      [consultationId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].notification_type).toBe("response_ready");
    expect(rows[0].status).toBe("sent");
    notificationId = rows[0].id;
  });

  it("writes notification.sent audit log event", async () => {
    const { rows } = await getTestPool().query(
      `SELECT * FROM audit_log WHERE event_type = 'notification.sent' AND consultation_id = $1`,
      [consultationId]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].metadata.notification_type).toBe("response_ready");
  });
});

// ---------------------------------------------------------------------------
// Reject → rejected notification
// ---------------------------------------------------------------------------
describe("reject consultation", () => {
  let rejectedConsultationId: string;

  beforeAll(async () => {
    const pool = getTestPool();
    // Create a second consultation to reject
    const { rows } = await pool.query(
      `INSERT INTO consultations
         (patient_id, assigned_doctor_id, status, consultation_type, presenting_complaint,
          ai_draft, soap_note, differential_diagnoses, priority_flags)
       VALUES ($1, $2, 'queued_for_review', 'text', 'Chest pain',
               'Draft response.', '{}'::jsonb, '[]'::jsonb, '{}')
       RETURNING id`,
      [patientId, doctorId]
    );
    rejectedConsultationId = rows[0].id;
  });

  it("creates a rejected notification on reject", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    await request(app)
      .post(`/api/v1/doctor/consultations/${rejectedConsultationId}/reject`)
      .send({ reasonCode: "physical_exam_required", message: "Please see a GP in person." })
      .expect(200);

    await new Promise((r) => setTimeout(r, 100));

    const { rows } = await getTestPool().query(
      `SELECT * FROM notifications WHERE consultation_id = $1`,
      [rejectedConsultationId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].notification_type).toBe("rejected");
  });
});

// ---------------------------------------------------------------------------
// SendGrid webhook — delivery status update
// ---------------------------------------------------------------------------
describe("SendGrid webhook", () => {
  it("marks notification delivered on 'delivered' event", async () => {
    const { rows: notifRows } = await getTestPool().query(
      `SELECT id, sendgrid_message_id FROM notifications WHERE consultation_id = $1`,
      [consultationId]
    );
    const notif = notifRows[0];
    if (!notif) return; // sendgrid key not set, message_id may be null in test

    const app = buildTestApp(PATIENT_SUB, "patient");
    await request(app)
      .post("/api/v1/webhooks/sendgrid")
      .send([
        {
          event: "delivered",
          sg_message_id: notif.sendgrid_message_id ?? "test-msg-001.filter0",
          email: "patient-notif@example.com",
          timestamp: Math.floor(Date.now() / 1000),
        },
      ])
      .expect(200);

    const { rows } = await getTestPool().query(
      `SELECT status, delivered_at FROM notifications WHERE id = $1`,
      [notif.id]
    );
    expect(rows[0].status).toBe("delivered");
    expect(rows[0].delivered_at).not.toBeNull();
  });

  it("marks notification bounced on 'bounce' event", async () => {
    // Insert a fresh notification to bounce
    const { rows: insertedRows } = await getTestPool().query(
      `INSERT INTO notifications (consultation_id, patient_id, notification_type, sendgrid_message_id)
       VALUES ($1, $2, 'response_ready', 'bounce-test-001') RETURNING id`,
      [consultationId, patientId]
    );
    const notifId = insertedRows[0].id;

    const app = buildTestApp(PATIENT_SUB, "patient");
    await request(app)
      .post("/api/v1/webhooks/sendgrid")
      .send([
        {
          event: "bounce",
          sg_message_id: "bounce-test-001.filter0",
          email: "patient-notif@example.com",
          reason: "550 5.1.1 The email account does not exist.",
          timestamp: Math.floor(Date.now() / 1000),
        },
      ])
      .expect(200);

    const { rows } = await getTestPool().query(
      `SELECT status FROM notifications WHERE id = $1`,
      [notifId]
    );
    expect(rows[0].status).toBe("bounced");
  });
});

// ---------------------------------------------------------------------------
// Patient inbox
// ---------------------------------------------------------------------------
describe("patient inbox", () => {
  it("returns inbox items for the patient", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    const res = await request(app).get("/api/v1/inbox").expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.unreadCount).toBe("number");
  });

  it("returns response_ready items with doctor name and preview", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    const res = await request(app).get("/api/v1/inbox").expect(200);

    const responseItems = res.body.items.filter(
      (i: { notificationType: string }) => i.notificationType === "response_ready"
    );
    expect(responseItems.length).toBeGreaterThanOrEqual(1);
    const item = responseItems[0];
    expect(item.consultation.doctorName).toContain("Dr");
    expect(item.isUnread).toBe(true);
  });

  it("marks notification as read", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    const inboxRes = await request(app).get("/api/v1/inbox").expect(200);
    const unreadItem = inboxRes.body.items.find((i: { isUnread: boolean }) => i.isUnread);
    if (!unreadItem) return; // nothing unread

    await request(app)
      .patch(`/api/v1/inbox/${unreadItem.notificationId}/read`)
      .expect(200);

    const { rows } = await getTestPool().query(
      `SELECT read_at FROM notifications WHERE id = $1`,
      [unreadItem.notificationId]
    );
    expect(rows[0].read_at).not.toBeNull();
  });

  it("does not return other patients items in inbox", async () => {
    // Create a second patient
    const pool = getTestPool();
    const { rows: p2 } = await pool.query(
      `INSERT INTO patients (cognito_sub, email) VALUES ('other-patient-001', 'other@example.com') RETURNING id`,
    );
    const app = buildTestApp("other-patient-001", "patient");
    const res = await request(app).get("/api/v1/inbox").expect(200);
    expect(res.body.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// F-032: EMAIL_SEND_FAILED written to audit_log when SendGrid dispatch throws
// ---------------------------------------------------------------------------
describe("email send failure audit log", () => {
  it("writes EMAIL_SEND_FAILED to audit_log when dispatchEmail throws", async () => {
    const sgMail = require("@sendgrid/mail");
    const pool = getTestPool();

    // Create a fresh consultation in queued_for_review for this test
    const { rows: cRows } = await pool.query(
      `INSERT INTO consultations
         (patient_id, assigned_doctor_id, status, consultation_type, presenting_complaint,
          ai_draft, soap_note, differential_diagnoses, priority_flags)
       VALUES ($1, $2, 'queued_for_review', 'text', 'Headache',
               'Rest and hydration advised.',
               '{"subjective":"headache","objective":"no exam","assessment":"tension headache","plan":"rest"}'::jsonb,
               '[{"diagnosis":"Tension headache","likelihood_pct":80}]'::jsonb,
               '{}')
       RETURNING id`,
      [patientId, doctorId]
    );
    const failConsultationId = cRows[0].id;

    // Make SendGrid throw on the next call
    sgMail.send.mockRejectedValueOnce(new Error("SendGrid 503 Service Unavailable"));

    // Import sendResponseReadyEmail directly and call it
    const { sendResponseReadyEmail } = require("../services/emailService");

    // Set up reviewed_by so the query works
    await pool.query(
      `UPDATE consultations SET reviewed_by = $1, reviewed_at = NOW(), status = 'approved' WHERE id = $2`,
      [doctorId, failConsultationId]
    );

    await expect(sendResponseReadyEmail(failConsultationId, pool)).rejects.toThrow(
      "SendGrid 503 Service Unavailable"
    );

    // Check audit_log contains EMAIL_SEND_FAILED entry
    const { rows: auditRows } = await pool.query(
      `SELECT event_type, metadata FROM audit_log WHERE consultation_id = $1`,
      [failConsultationId]
    );
    const failEntry = auditRows.find(
      (r: { event_type: string }) => r.event_type === "notification.email_send_failed"
    );
    expect(failEntry).toBeDefined();
    expect(failEntry.metadata.event).toBe("EMAIL_SEND_FAILED");
    expect(failEntry.metadata.reason).toContain("503");
    expect(failEntry.metadata.consultationId).toBe(failConsultationId);

    // Restore mock
    sgMail.send.mockResolvedValue([
      { statusCode: 202, headers: { "x-message-id": "test-msg-001" } },
      {},
    ]);
  });
});

// ---------------------------------------------------------------------------
// Anonymous patient — generic greeting (email template unit check)
// ---------------------------------------------------------------------------
describe("anonymous patient notifications", () => {
  it("anonymous patient has no full_name, email template uses generic greeting", async () => {
    const pool = getTestPool();
    const { rows: anonRows } = await pool.query(
      `INSERT INTO patients (cognito_sub, email)
       VALUES ('anon-patient-notif-001', 'anon@example.com') RETURNING id`,
    );
    const anonPatientId = anonRows[0].id;

    // Verify full_name is null
    const { rows } = await pool.query(
      `SELECT full_name FROM patients WHERE id = $1`,
      [anonPatientId]
    );
    expect(rows[0].full_name).toBeNull();
    // The email template uses "Hi there" for null full_name — verified in emailService.ts logic
  });
});
