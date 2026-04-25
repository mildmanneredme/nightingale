// PRD-014: Patient Notifications
//
// Sends transactional emails via SendGrid and records delivery status.
// All patient-facing content is attributed to the reviewing doctor — AI authorship
// is never disclosed in patient communications (PRD F-009).
//
// If SENDGRID_API_KEY is not set (test/dev), sends are skipped and a warning is logged.

import sgMail from "@sendgrid/mail";
import he from "he";
import { Pool } from "pg";
import { config } from "../config";
import { logger } from "../logger";
import { renderTemplate } from "../email-templates/loader";

if (config.sendgrid.apiKey) {
  sgMail.setApiKey(config.sendgrid.apiKey);
}

export interface NotificationRecord {
  id: string;
  sendgridMessageId: string | null;
}

// ---------------------------------------------------------------------------
// Shared footer snippets (injected as template variables)
// ---------------------------------------------------------------------------

const EMAIL_FOOTER_HTML = `
  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;" />
  <p style="font-size:12px;color:#6b7280;">
    This advice is not a substitute for in-person medical care.<br />
    If your condition worsens or you are unsure, seek urgent medical care or call <strong>000</strong>.<br />
    For general health advice: <a href="https://www.healthdirect.gov.au">HealthDirect 1800 022 222</a>
  </p>
  <p style="font-size:11px;color:#9ca3af;">
    Nightingale Health Pty Ltd &middot;
    <a href="https://nightingale.com.au/privacy">Privacy Policy</a> &middot;
    <a href="https://nightingale.com.au/unsubscribe">Unsubscribe</a>
  </p>`;

const EMAIL_FOOTER_PLAIN = `
---
This advice is not a substitute for in-person medical care.
If your condition worsens, seek urgent medical care or call 000.
HealthDirect: 1800 022 222 | healthdirect.gov.au

Nightingale Health Pty Ltd
Privacy Policy: https://nightingale.com.au/privacy
Unsubscribe: https://nightingale.com.au/unsubscribe`;

// ---------------------------------------------------------------------------
// sendResponseReadyEmail
// Triggered after a doctor approves or amends a consultation.
// Uses ai_draft (approved) or doctor_draft (amended) as the patient-facing text.
// ---------------------------------------------------------------------------
export async function sendResponseReadyEmail(
  consultationId: string,
  dbPool: Pool
): Promise<NotificationRecord> {
  const { rows } = await dbPool.query<{
    patient_email: string;
    patient_name: string | null;
    is_anonymous: boolean;
    doctor_first_name: string;
    doctor_last_name: string;
    response_text: string;
    soap_note: { assessment?: string; plan?: string } | null;
    status: string;
    reviewed_at: Date | null;
    patient_id: string;
  }>(
    `SELECT
       p.email          AS patient_email,
       p.full_name      AS patient_name,
       COALESCE(p.full_name IS NULL, FALSE) AS is_anonymous,
       d.first_name     AS doctor_first_name,
       d.last_name      AS doctor_last_name,
       COALESCE(c.doctor_draft, c.ai_draft, '') AS response_text,
       c.soap_note,
       c.status,
       c.reviewed_at,
       p.id             AS patient_id
     FROM consultations c
     JOIN patients p ON p.id = c.patient_id
     JOIN doctors d  ON d.id = c.reviewed_by
     WHERE c.id = $1`,
    [consultationId]
  );

  if (!rows[0]) throw new Error(`Consultation ${consultationId} not found`);
  const row = rows[0];

  const greeting = row.patient_name ? `Hi ${row.patient_name.split(" ")[0]}` : "Hi there";
  const doctorName = `Dr ${row.doctor_last_name}`;
  const date = row.reviewed_at
    ? row.reviewed_at.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  // Extract red flags from SOAP note if present
  const soapNote = row.soap_note as Record<string, unknown> | null;
  const redFlags: string[] = [];
  if (soapNote && typeof soapNote === "object") {
    const plan = soapNote.plan as string | undefined;
    if (plan && /red flag|urgent|emergency|seek.*care/i.test(plan)) {
      redFlags.push(he.escape(plan));
    }
  }

  const redFlagHtml =
    redFlags.length > 0
      ? `<div style="background:#fef3c7;border-left:4px solid #d97706;padding:12px 16px;margin:24px 0;">
           <strong>Things to watch for:</strong>
           <p style="margin:8px 0 0;">${redFlags.join("<br />")}</p>
         </div>`
      : "";

  const responseHtml = row.response_text
    .split("\n")
    .map((line) => `<p style="margin:0 0 12px;">${he.escape(line)}</p>`)
    .join("");

  const html = renderTemplate("response-ready", {
    greeting,
    doctorName,
    date,
    responseHtml,
    redFlagHtml,
    footerHtml: EMAIL_FOOTER_HTML,
  });

  const redFlagSection =
    redFlags.length > 0 ? `\nThings to watch for:\n${redFlags.join("\n")}\n` : "";

  const plainText = `${greeting},

${doctorName} has reviewed your consultation and prepared a response for you.

--- Response from ${doctorName} (${date}) ---

${row.response_text}

---
${redFlagSection}
${EMAIL_FOOTER_PLAIN}`;

  let messageId: string | null = null;
  try {
    messageId = await dispatchEmail({
      to: row.patient_email,
      subject: `Your consultation response from ${doctorName}`,
      html,
      text: plainText,
    });
  } catch (emailErr) {
    // F-032: write EMAIL_SEND_FAILED to audit_log so no send is silently lost
    const reason = emailErr instanceof Error ? emailErr.message : String(emailErr);
    logger.error({ emailErr, consultationId }, "sendResponseReadyEmail: SendGrid dispatch failed");
    try {
      await dbPool.query(
        `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
         VALUES ('notification.email_send_failed', $1, 'system', $2, $3)`,
        [
          "00000000-0000-0000-0000-000000000000",
          consultationId,
          JSON.stringify({ event: "EMAIL_SEND_FAILED", consultationId, reason }),
        ]
      );
    } catch (auditErr) {
      logger.error({ auditErr, consultationId }, "sendResponseReadyEmail: failed to write EMAIL_SEND_FAILED to audit_log");
    }
    throw emailErr;
  }

  const notifId = await insertNotification(dbPool, {
    consultationId,
    patientId: row.patient_id,
    type: "response_ready",
    messageId,
  });

  await dbPool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('notification.sent', $1, 'patient', $2, $3)`,
    [row.patient_id, consultationId, JSON.stringify({ notification_type: "response_ready", message_id: messageId })]
  );

  return { id: notifId, sendgridMessageId: messageId };
}

// ---------------------------------------------------------------------------
// sendRejectionEmail
// Triggered after a doctor rejects a consultation.
// ---------------------------------------------------------------------------
export async function sendRejectionEmail(
  consultationId: string,
  dbPool: Pool
): Promise<NotificationRecord> {
  const { rows } = await dbPool.query<{
    patient_email: string;
    patient_name: string | null;
    rejection_message: string | null;
    patient_id: string;
  }>(
    `SELECT
       p.email            AS patient_email,
       p.full_name        AS patient_name,
       c.rejection_message,
       p.id               AS patient_id
     FROM consultations c
     JOIN patients p ON p.id = c.patient_id
     WHERE c.id = $1`,
    [consultationId]
  );

  if (!rows[0]) throw new Error(`Consultation ${consultationId} not found`);
  const row = rows[0];

  const greeting = row.patient_name ? `Hi ${row.patient_name.split(" ")[0]}` : "Hi there";

  const customMessageHtml = row.rejection_message
    ? `<p>${he.escape(row.rejection_message)}</p>`
    : "";

  const html = renderTemplate("rejection", {
    greeting,
    customMessageHtml,
    footerHtml: EMAIL_FOOTER_HTML,
  });

  const customLine = row.rejection_message ? `\n${row.rejection_message}\n` : "";
  const plainText = `${greeting},

We're sorry — the doctor reviewing your consultation was unable to complete a remote assessment for this case.
${customLine}
We recommend booking an appointment with a GP in person.

A full refund has been initiated. You should see the funds returned within 3–5 business days.
${EMAIL_FOOTER_PLAIN}`;

  const messageId = await dispatchEmail({
    to: row.patient_email,
    subject: "Update on your Nightingale Health consultation",
    html,
    text: plainText,
  });

  const notifId = await insertNotification(dbPool, {
    consultationId,
    patientId: row.patient_id,
    type: "rejected",
    messageId,
  });

  await dbPool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('notification.sent', $1, 'patient', $2, $3)`,
    [row.patient_id, consultationId, JSON.stringify({ notification_type: "rejected", message_id: messageId })]
  );

  return { id: notifId, sendgridMessageId: messageId };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function dispatchEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<string | null> {
  if (!config.sendgrid.apiKey) {
    logger.warn({ to: msg.to, subject: msg.subject }, "SendGrid API key not set — email skipped");
    return null;
  }

  const [response] = await sgMail.send({
    to: msg.to,
    from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });

  // X-Message-Id is the SendGrid-assigned message ID used in webhook events
  const messageId = (response.headers["x-message-id"] as string) ?? null;
  return messageId;
}

async function insertNotification(
  dbPool: Pool,
  opts: {
    consultationId: string | null;
    patientId: string;
    type: string;
    messageId: string | null;
  }
): Promise<string> {
  const { rows } = await dbPool.query<{ id: string }>(
    `INSERT INTO notifications (consultation_id, patient_id, notification_type, sendgrid_message_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [opts.consultationId, opts.patientId, opts.type, opts.messageId]
  );
  return rows[0].id;
}

// ---------------------------------------------------------------------------
// Script Renewal email functions (PRD-018)
// ---------------------------------------------------------------------------

export async function sendRenewalApprovedEmail(
  renewalId: string,
  dbPool: Pool
): Promise<NotificationRecord> {
  const { rows } = await dbPool.query<{
    patient_email: string;
    patient_name: string | null;
    medication_name: string;
    dosage: string | null;
    review_note: string | null;
    valid_until: Date | null;
    doctor_last_name: string;
    patient_id: string;
  }>(
    `SELECT p.email AS patient_email, p.full_name AS patient_name,
            r.medication_name, r.dosage, r.review_note, r.valid_until,
            d.last_name AS doctor_last_name, p.id AS patient_id
     FROM renewal_requests r
     JOIN patients p ON p.id = r.patient_id
     JOIN doctors d  ON d.id = r.reviewed_by
     WHERE r.id = $1`,
    [renewalId]
  );
  if (!rows[0]) throw new Error(`Renewal ${renewalId} not found`);
  const row = rows[0];

  const greeting = row.patient_name ? `Hi ${row.patient_name.split(" ")[0]}` : "Hi there";
  const validUntilStr = row.valid_until
    ? row.valid_until.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : "28 days";
  const medicationName = `${row.medication_name}${row.dosage ? ` ${row.dosage}` : ""}`;

  const reviewNoteHtml = row.review_note
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0;">${he.escape(row.review_note)}</p></div>`
    : "";

  const html = renderTemplate("renewal-approved", {
    greeting,
    doctorLastName: row.doctor_last_name,
    medicationName,
    validUntil: validUntilStr,
    reviewNoteHtml,
    footerHtml: EMAIL_FOOTER_HTML,
  });

  const text = `${greeting},\n\nDr ${row.doctor_last_name} has approved your renewal for ${medicationName}. Valid until ${validUntilStr}.\n\n${row.review_note ?? ""}\n${EMAIL_FOOTER_PLAIN}`;

  const messageId = await dispatchEmail({
    to: row.patient_email,
    subject: `Your script renewal for ${row.medication_name} has been approved`,
    html,
    text,
  });

  const notifId = await insertNotification(dbPool, {
    consultationId: null as any,
    patientId: row.patient_id,
    type: "response_ready",
    messageId,
  });

  await dbPool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
     VALUES ('notification.sent', $1, 'patient', $2)`,
    [row.patient_id, JSON.stringify({ notification_type: "renewal_approved", renewal_id: renewalId, message_id: messageId })]
  );

  return { id: notifId, sendgridMessageId: messageId };
}

export async function sendRenewalDeclinedEmail(
  renewalId: string,
  dbPool: Pool
): Promise<NotificationRecord> {
  const { rows } = await dbPool.query<{
    patient_email: string;
    patient_name: string | null;
    medication_name: string;
    review_note: string | null;
    doctor_last_name: string;
    patient_id: string;
  }>(
    `SELECT p.email AS patient_email, p.full_name AS patient_name,
            r.medication_name, r.review_note,
            d.last_name AS doctor_last_name, p.id AS patient_id
     FROM renewal_requests r
     JOIN patients p ON p.id = r.patient_id
     JOIN doctors d  ON d.id = r.reviewed_by
     WHERE r.id = $1`,
    [renewalId]
  );
  if (!rows[0]) throw new Error(`Renewal ${renewalId} not found`);
  const row = rows[0];

  const greeting = row.patient_name ? `Hi ${row.patient_name.split(" ")[0]}` : "Hi there";
  const reasonText = he.escape(
    row.review_note ?? "A new full consultation is required before this medication can be renewed."
  );

  const html = renderTemplate("renewal-declined", {
    greeting,
    doctorLastName: row.doctor_last_name,
    medicationName: row.medication_name,
    reasonText,
    footerHtml: EMAIL_FOOTER_HTML,
  });

  const text = `${greeting},\n\nDr ${row.doctor_last_name} was unable to approve your renewal for ${row.medication_name}.\n\n${row.review_note ?? "A new full consultation is required before this medication can be renewed."}\n\nPlease start a new consultation.\n${EMAIL_FOOTER_PLAIN}`;

  const messageId = await dispatchEmail({
    to: row.patient_email,
    subject: `Update on your script renewal for ${row.medication_name}`,
    html,
    text,
  });

  const notifId = await insertNotification(dbPool, {
    consultationId: null as any,
    patientId: row.patient_id,
    type: "rejected",
    messageId,
  });

  await dbPool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
     VALUES ('notification.sent', $1, 'patient', $2)`,
    [row.patient_id, JSON.stringify({ notification_type: "renewal_declined", renewal_id: renewalId, message_id: messageId })]
  );

  return { id: notifId, sendgridMessageId: messageId };
}

export async function sendRenewalReminderEmail(
  renewalId: string,
  dbPool: Pool
): Promise<NotificationRecord> {
  const { rows } = await dbPool.query<{
    patient_email: string;
    patient_name: string | null;
    medication_name: string;
    valid_until: Date | null;
    patient_id: string;
  }>(
    `SELECT p.email AS patient_email, p.full_name AS patient_name,
            r.medication_name, r.valid_until, p.id AS patient_id
     FROM renewal_requests r
     JOIN patients p ON p.id = r.patient_id
     WHERE r.id = $1`,
    [renewalId]
  );
  if (!rows[0]) throw new Error(`Renewal ${renewalId} not found`);
  const row = rows[0];

  const greeting = row.patient_name ? `Hi ${row.patient_name.split(" ")[0]}` : "Hi there";
  const validUntilStr = row.valid_until
    ? row.valid_until.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : "soon";

  const html = renderTemplate("renewal-reminder", {
    greeting,
    medicationName: row.medication_name,
    validUntil: validUntilStr,
    footerHtml: EMAIL_FOOTER_HTML,
  });

  const text = `${greeting},\n\nYour prescription for ${row.medication_name} expires on ${validUntilStr}.\n\nLog in to Nightingale to request a renewal.\n${EMAIL_FOOTER_PLAIN}`;

  const messageId = await dispatchEmail({
    to: row.patient_email,
    subject: `Your prescription for ${row.medication_name} is due for renewal`,
    html,
    text,
  });

  const notifId = await insertNotification(dbPool, {
    consultationId: null as any,
    patientId: row.patient_id,
    type: "response_ready",
    messageId,
  });

  await dbPool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
     VALUES ('notification.sent', $1, 'patient', $2)`,
    [row.patient_id, JSON.stringify({ notification_type: "renewal_reminder", renewal_id: renewalId, message_id: messageId })]
  );

  return { id: notifId, sendgridMessageId: messageId };
}

// ---------------------------------------------------------------------------
// Follow-up email functions (PRD-015)
// ---------------------------------------------------------------------------

export async function sendFollowUpEmail(
  consultationId: string,
  opts: {
    patientEmail: string;
    patientName: string | null;
    presentingComplaint: string;
    reviewedAt: Date | null;
    trackingBaseUrl: string;
  },
  dbPool: Pool
): Promise<void> {
  const greeting = opts.patientName ? `Hi ${opts.patientName.split(" ")[0]}` : "Hi there";
  const reviewDate = opts.reviewedAt
    ? opts.reviewedAt.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : "recently";

  const betterUrl = `${opts.trackingBaseUrl}?response=better`;
  const sameUrl   = `${opts.trackingBaseUrl}?response=same`;
  const worseUrl  = `${opts.trackingBaseUrl}?response=worse`;

  const html = renderTemplate("follow-up", {
    greeting,
    presentingComplaint: he.escape(opts.presentingComplaint),
    reviewDate,
    betterUrl,
    sameUrl,
    worseUrl,
    footerHtml: EMAIL_FOOTER_HTML,
  });

  const text = `${greeting},

It's been a day or two since your Nightingale consultation on "${opts.presentingComplaint}" (reviewed ${reviewDate}). How are you feeling?

Feeling better: ${betterUrl}
About the same: ${sameUrl}
Feeling worse:  ${worseUrl}

If your condition has significantly worsened or you are experiencing new severe symptoms, please seek urgent care or call 000.
${EMAIL_FOOTER_PLAIN}`;

  const messageId = await dispatchEmail({
    to: opts.patientEmail,
    subject: "How are you feeling? — Nightingale follow-up",
    html,
    text,
  });

  logger.info({ consultationId, messageId }, "Follow-up email dispatched");
}

export async function sendFollowUpConcernAcknowledgementEmail(
  patientId: string,
  dbPool: Pool
): Promise<void> {
  const { rows } = await dbPool.query<{
    patient_email: string;
    patient_name: string | null;
  }>(
    `SELECT email AS patient_email, full_name AS patient_name FROM patients WHERE id = $1`,
    [patientId]
  );
  if (!rows[0]) throw new Error(`Patient ${patientId} not found`);
  const row = rows[0];

  const greeting = row.patient_name ? `Hi ${row.patient_name.split(" ")[0]}` : "Hi there";

  const html = renderTemplate("follow-up-concern", {
    greeting,
    footerHtml: EMAIL_FOOTER_HTML,
  });

  const text = `${greeting},

Thank you for letting us know. We have flagged your consultation for a doctor to review and you will hear back from us shortly.

If you have worsening symptoms, please seek urgent in-person care or call your GP.
For emergencies: 000 | HealthDirect: 1800 022 222
${EMAIL_FOOTER_PLAIN}`;

  await dispatchEmail({
    to: row.patient_email,
    subject: "We've received your follow-up — Nightingale Health",
    html,
    text,
  });

  logger.info({ patientId }, "Follow-up concern acknowledgement email dispatched");
}
