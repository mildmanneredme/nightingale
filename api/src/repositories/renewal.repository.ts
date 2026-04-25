import { pool } from "../db";

export interface PatientIdRow {
  id: string;
}

export interface RenewalCreatedRow {
  id: string;
  status: string;
  medication_name: string;
  dosage: string | null;
  created_at: Date;
}

export interface RenewalListRow {
  id: string;
  status: string;
  medication_name: string;
  dosage: string | null;
  review_note: string | null;
  valid_until: string | null;
  reminders_enabled: boolean;
  created_at: Date;
  reviewed_at: Date | null;
  doctor_full_name: string | null;
}

export interface RenewalQueueRow {
  id: string;
  status: string;
  medication_name: string;
  dosage: string | null;
  no_adverse_effects: boolean;
  condition_unchanged: boolean;
  patient_notes: string | null;
  created_at: Date;
  valid_until: string | null;
  alert_48h_sent_at: Date | null;
  source_consultation_id: string | null;
  patient_name: string;
  patient_dob: string | null;
  patient_sex: string | null;
}

export interface DoctorForRenewalRow {
  id: string;
  ahpra_number: string;
  full_name: string;
}

export interface RenewalApprovedRow {
  id: string;
  status: string;
  patient_id: string;
  medication_name: string;
  dosage: string | null;
  valid_until: string | null;
}

export interface RenewalDeclinedRow {
  id: string;
  status: string;
  patient_id: string;
  medication_name: string;
}

export interface ExpiringRenewalRow {
  id: string;
  patient_id: string;
  medication_name: string;
}

export async function findPatientIdBySub(sub: string): Promise<PatientIdRow | undefined> {
  const { rows } = await pool.query<PatientIdRow>(
    `SELECT id FROM patients WHERE cognito_sub = $1`,
    [sub]
  );
  return rows[0];
}

export async function verifyConsultationOwnership(
  consultationId: string,
  patientId: string
): Promise<boolean> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM consultations WHERE id = $1 AND patient_id = $2`,
    [consultationId, patientId]
  );
  return !!rows[0];
}

export async function insertRenewal(
  patientId: string,
  sourceConsultationId: string | null,
  medicationName: string,
  dosage: string | null,
  noAdverseEffects: boolean,
  conditionUnchanged: boolean,
  patientNotes: string | null,
  remindersEnabled: boolean
): Promise<RenewalCreatedRow> {
  const { rows } = await pool.query<RenewalCreatedRow>(
    `INSERT INTO renewal_requests
       (patient_id, source_consultation_id, medication_name, dosage,
        no_adverse_effects, condition_unchanged, patient_notes, reminders_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, status, medication_name, dosage, created_at`,
    [patientId, sourceConsultationId, medicationName, dosage, noAdverseEffects, conditionUnchanged, patientNotes, remindersEnabled]
  );
  return rows[0];
}

export async function insertRenewalRequestedAuditLog(
  patientId: string,
  renewalId: string,
  medicationName: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
     VALUES ('renewal.requested', $1, 'patient', $2)`,
    [patientId, JSON.stringify({ renewal_id: renewalId, medication: medicationName })]
  );
}

export async function countRenewalsByPatient(patientId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM renewal_requests r WHERE r.patient_id = $1`,
    [patientId]
  );
  return parseInt(rows[0].count, 10);
}

export async function listRenewalsByPatient(
  patientId: string,
  limit: number,
  offset: number
): Promise<RenewalListRow[]> {
  const { rows } = await pool.query<RenewalListRow>(
    `SELECT r.id, r.status, r.medication_name, r.dosage, r.no_adverse_effects,
            r.condition_unchanged, r.patient_notes, r.reminders_enabled,
            r.review_note, r.valid_until, r.created_at, r.reviewed_at,
            d.full_name AS doctor_full_name
     FROM renewal_requests r
     LEFT JOIN doctors d ON d.id = r.reviewed_by
     WHERE r.patient_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [patientId, limit, offset]
  );
  return rows;
}

export async function countPendingRenewals(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM renewal_requests r WHERE r.status = 'pending'`
  );
  return parseInt(rows[0].count, 10);
}

export async function listPendingRenewals(limit: number, offset: number): Promise<RenewalQueueRow[]> {
  const { rows } = await pool.query<RenewalQueueRow>(
    `SELECT r.id, r.status, r.medication_name, r.dosage,
            r.no_adverse_effects, r.condition_unchanged, r.patient_notes,
            r.created_at, r.valid_until, r.alert_48h_sent_at,
            r.source_consultation_id,
            p.full_name AS patient_name, p.date_of_birth AS patient_dob,
            p.biological_sex AS patient_sex
     FROM renewal_requests r
     JOIN patients p ON p.id = r.patient_id
     WHERE r.status = 'pending'
     ORDER BY
       CASE WHEN r.alert_48h_sent_at IS NOT NULL THEN 0 ELSE 1 END,
       r.created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function findDoctorBySub(sub: string): Promise<DoctorForRenewalRow | undefined> {
  const { rows } = await pool.query<DoctorForRenewalRow>(
    `SELECT id, ahpra_number, full_name FROM doctors WHERE cognito_sub = $1`,
    [sub]
  );
  return rows[0];
}

export async function findDoctorBySubForDecline(sub: string): Promise<Pick<DoctorForRenewalRow, "id" | "ahpra_number"> | undefined> {
  const { rows } = await pool.query<Pick<DoctorForRenewalRow, "id" | "ahpra_number">>(
    `SELECT id, ahpra_number FROM doctors WHERE cognito_sub = $1`,
    [sub]
  );
  return rows[0];
}

export async function approveRenewal(
  renewalId: string,
  doctorId: string,
  reviewNote: string | null,
  validDays: number
): Promise<RenewalApprovedRow | undefined> {
  const { rows } = await pool.query<RenewalApprovedRow>(
    `UPDATE renewal_requests
     SET status = 'approved',
         reviewed_by = $1,
         reviewed_at = NOW(),
         review_note = $2,
         valid_until = (NOW() + ($3 || ' days')::INTERVAL)::DATE,
         updated_at = NOW()
     WHERE id = $4 AND status = 'pending'
     RETURNING id, status, patient_id, medication_name, dosage, valid_until`,
    [doctorId, reviewNote, validDays, renewalId]
  );
  return rows[0];
}

export async function insertRenewalApprovedAuditLog(
  doctorId: string,
  ahpraNumber: string,
  renewalId: string,
  medicationName: string,
  validUntil: string | null,
  patientId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, ahpra_number, metadata)
     VALUES ('renewal.approved', $1, 'doctor', $2, $3)`,
    [doctorId, ahpraNumber, JSON.stringify({ renewal_id: renewalId, medication: medicationName, valid_until: validUntil, patient_id: patientId })]
  );
}

export async function declineRenewal(
  renewalId: string,
  doctorId: string,
  reviewNote: string | null
): Promise<RenewalDeclinedRow | undefined> {
  const { rows } = await pool.query<RenewalDeclinedRow>(
    `UPDATE renewal_requests
     SET status = 'declined',
         reviewed_by = $1,
         reviewed_at = NOW(),
         review_note = $2,
         updated_at = NOW()
     WHERE id = $3 AND status = 'pending'
     RETURNING id, status, patient_id, medication_name`,
    [doctorId, reviewNote, renewalId]
  );
  return rows[0];
}

export async function insertRenewalDeclinedAuditLog(
  doctorId: string,
  ahpraNumber: string,
  renewalId: string,
  medicationName: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, ahpra_number, metadata)
     VALUES ('renewal.declined', $1, 'doctor', $2, $3)`,
    [doctorId, ahpraNumber, JSON.stringify({ renewal_id: renewalId, medication: medicationName })]
  );
}

export async function findRenewalsExpiring48h(): Promise<ExpiringRenewalRow[]> {
  const { rows } = await pool.query<ExpiringRenewalRow>(
    `SELECT id, patient_id, medication_name
     FROM renewal_requests
     WHERE status = 'approved'
       AND valid_until IS NOT NULL
       AND valid_until <= (NOW() + INTERVAL '48 hours')::DATE
       AND valid_until >= CURRENT_DATE
       AND alert_48h_sent_at IS NULL`
  );
  return rows;
}

export async function markAlert48hSent(renewalId: string): Promise<void> {
  await pool.query(
    `UPDATE renewal_requests SET alert_48h_sent_at = NOW() WHERE id = $1`,
    [renewalId]
  );
}

export async function insertExpiryAlertAuditLog(
  patientId: string,
  renewalId: string,
  medicationName: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
     VALUES ('renewal.expiry_alert_sent', $1, 'patient', $2)`,
    [patientId, JSON.stringify({ renewal_id: renewalId, medication: medicationName })]
  );
}

export async function findRenewalsExpiring7d(): Promise<ExpiringRenewalRow[]> {
  const { rows } = await pool.query<ExpiringRenewalRow>(
    `SELECT id, patient_id, medication_name
     FROM renewal_requests
     WHERE status = 'approved'
       AND valid_until IS NOT NULL
       AND valid_until <= (NOW() + INTERVAL '7 days')::DATE
       AND valid_until > (NOW() + INTERVAL '48 hours')::DATE
       AND reminder_7d_sent_at IS NULL
       AND reminders_enabled = TRUE`
  );
  return rows;
}

export async function markReminder7dSent(renewalId: string): Promise<void> {
  await pool.query(
    `UPDATE renewal_requests SET reminder_7d_sent_at = NOW() WHERE id = $1`,
    [renewalId]
  );
}

export async function insertPatientReminderAuditLog(
  patientId: string,
  renewalId: string,
  medicationName: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
     VALUES ('renewal.patient_reminder_sent', $1, 'patient', $2)`,
    [patientId, JSON.stringify({ renewal_id: renewalId, medication: medicationName })]
  );
}
