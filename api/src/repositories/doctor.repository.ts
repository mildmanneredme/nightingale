import { pool } from "../db";

export interface DoctorRow {
  id: string;
  cognito_sub: string;
  full_name: string;
  ahpra_number: string;
  email: string;
  status: string;
  mobile: string | null;
  specialty: string | null;
  primary_state: string | null;
  hours_per_week: string | null;
  applied_at: Date;
  approved_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  application_ip: string | null;
}

export interface DoctorStatusRow {
  status: string;
  rejection_reason: string | null;
  applied_at: Date;
  approved_at: Date | null;
}

export interface ConsultationQueueRow {
  id: string;
  status: string;
  consultationType: string;
  presentingComplaint: string | null;
  priorityFlags: string[];
  createdAt: Date;
  patientDob: string | null;
  patientSex: string | null;
  clinicalContextWarnings: string[]; // PRD-023 F-024
}

export interface ConsultationDetailRow {
  id: string;
  status: string;
  consultationType: string;
  presentingComplaint: string | null;
  transcript: unknown;
  redFlags: unknown;
  soapNote: unknown;
  differentialDiagnoses: unknown;
  aiDraft: string | null;
  priorityFlags: string[];
  createdAt: Date;
  patientName: string | null;
  patientDob: string | null;
  patientSex: string | null;
  allergies: unknown;
  medications: unknown;
  conditions: unknown;
  clinicalContextWarnings: string[]; // PRD-023 F-025
}

export interface ConsultationUpdateRow {
  id: string;
  status: string;
}

export interface AiFetchRow {
  ai_draft: string | null;
}

export async function findDoctorBySub(sub: string): Promise<DoctorRow | null> {
  const { rows } = await pool.query<DoctorRow>(
    `SELECT id, cognito_sub, full_name, ahpra_number, email, status,
            mobile, specialty, primary_state, hours_per_week,
            applied_at, approved_at, rejected_at, rejection_reason, application_ip
     FROM doctors WHERE cognito_sub = $1`,
    [sub]
  );
  return rows[0] ?? null;
}

export async function findDoctorStatusBySub(sub: string): Promise<DoctorStatusRow | null> {
  const { rows } = await pool.query<DoctorStatusRow>(
    `SELECT status, rejection_reason, applied_at, approved_at
     FROM doctors WHERE cognito_sub = $1`,
    [sub]
  );
  return rows[0] ?? null;
}

export async function createDoctorApplication(params: {
  cognitoSub: string;
  fullName: string;
  ahpraNumber: string;
  email: string;
  mobile: string;
  specialty: string;
  primaryState: string;
  hoursPerWeek: string | null;
  applicationIp: string;
}): Promise<DoctorRow> {
  const { rows } = await pool.query<DoctorRow>(
    `INSERT INTO doctors
       (cognito_sub, full_name, ahpra_number, email, mobile, specialty,
        primary_state, hours_per_week, application_ip, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
     ON CONFLICT (cognito_sub) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           ahpra_number = EXCLUDED.ahpra_number,
           mobile = EXCLUDED.mobile,
           specialty = EXCLUDED.specialty,
           primary_state = EXCLUDED.primary_state,
           hours_per_week = EXCLUDED.hours_per_week,
           application_ip = EXCLUDED.application_ip
     RETURNING id, cognito_sub, full_name, ahpra_number, email, status,
               mobile, specialty, primary_state, hours_per_week,
               applied_at, approved_at, rejected_at, rejection_reason, application_ip`,
    [
      params.cognitoSub, params.fullName, params.ahpraNumber, params.email,
      params.mobile, params.specialty, params.primaryState,
      params.hoursPerWeek ?? null, params.applicationIp,
    ]
  );
  return rows[0];
}

export async function listPendingDoctorApplications(): Promise<DoctorRow[]> {
  const { rows } = await pool.query<DoctorRow>(
    `SELECT id, cognito_sub, full_name, ahpra_number, email, status,
            mobile, specialty, primary_state, hours_per_week,
            applied_at, approved_at, rejected_at, rejection_reason, application_ip
     FROM doctors
     WHERE status = 'pending'
     ORDER BY applied_at ASC`
  );
  return rows;
}

export async function findDoctorApplicationById(id: string): Promise<DoctorRow | null> {
  const { rows } = await pool.query<DoctorRow>(
    `SELECT id, cognito_sub, full_name, ahpra_number, email, status,
            mobile, specialty, primary_state, hours_per_week,
            applied_at, approved_at, rejected_at, rejection_reason, application_ip
     FROM doctors WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function approveDoctorApplication(
  doctorId: string,
  adminSub: string
): Promise<void> {
  await pool.query(
    `UPDATE doctors
     SET status = 'approved', approved_at = NOW(), approved_by_admin_sub = $1
     WHERE id = $2`,
    [adminSub, doctorId]
  );
}

export async function rejectDoctorApplication(
  doctorId: string,
  adminSub: string,
  reason: string
): Promise<void> {
  await pool.query(
    `UPDATE doctors
     SET status = 'rejected', rejected_at = NOW(),
         rejected_by_admin_sub = $1, rejection_reason = $2
     WHERE id = $3`,
    [adminSub, reason, doctorId]
  );
}

export async function countPlatformQueueStats(): Promise<{
  waiting: number;
  reviewedToday: number;
}> {
  const { rows } = await pool.query<{ waiting: string; reviewed_today: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'queued_for_review')        AS waiting,
       COUNT(*) FILTER (WHERE status IN ('approved','amended','rejected')
                          AND reviewed_at >= CURRENT_DATE)         AS reviewed_today
     FROM consultations`
  );
  return {
    waiting: parseInt(rows[0].waiting, 10),
    reviewedToday: parseInt(rows[0].reviewed_today, 10),
  };
}

export async function insertAuditLog(params: {
  eventType: string;
  actorId: string;
  ahpraNumber: string;
  consultationId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, ahpra_number, consultation_id, metadata)
     VALUES ($1, $2, 'doctor', $3, $4, $5)`,
    [
      params.eventType,
      params.actorId,
      params.ahpraNumber,
      params.consultationId ?? null,
      JSON.stringify(params.metadata ?? {}),
    ]
  );
}

export async function countQueuedConsultationsForDoctor(doctorId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM consultations c
     WHERE c.assigned_doctor_id = $1
       AND c.status = 'queued_for_review'`,
    [doctorId]
  );
  return parseInt(rows[0].count, 10);
}

// PRD-023 F-024/F-025: server-side derivation of clinicalContextWarnings.
// Lists each baseline-incomplete category as a human-readable string. Cheap
// because the joins all hit small per-patient tables already indexed on
// patient_id.
const CLINICAL_WARNINGS_SQL = `
  ARRAY_REMOVE(ARRAY[
    CASE WHEN p.allergies_none_declared = FALSE
              AND NOT EXISTS (SELECT 1 FROM patient_allergies a    WHERE a.patient_id   = p.id)
         THEN 'No allergies on file' END,
    CASE WHEN p.medications_none_declared = FALSE
              AND NOT EXISTS (SELECT 1 FROM patient_medications m  WHERE m.patient_id   = p.id)
         THEN 'No current medications listed' END,
    CASE WHEN p.conditions_none_declared = FALSE
              AND NOT EXISTS (SELECT 1 FROM patient_conditions con WHERE con.patient_id = p.id)
         THEN 'No known conditions listed' END,
    CASE WHEN p.date_of_birth  IS NULL THEN 'Date of birth missing'  END,
    CASE WHEN p.biological_sex IS NULL THEN 'Biological sex missing' END
  ], NULL)
`;

export async function listQueuedConsultationsForDoctor(
  doctorId: string,
  limit: number,
  offset: number
): Promise<ConsultationQueueRow[]> {
  const { rows } = await pool.query<ConsultationQueueRow>(
    `SELECT
       c.id,
       c.status,
       c.consultation_type   AS "consultationType",
       c.presenting_complaint AS "presentingComplaint",
       c.priority_flags      AS "priorityFlags",
       c.created_at          AS "createdAt",
       p.date_of_birth       AS "patientDob",
       p.biological_sex      AS "patientSex",
       ${CLINICAL_WARNINGS_SQL} AS "clinicalContextWarnings"
     FROM consultations c
     JOIN patients p ON p.id = c.patient_id
     WHERE c.assigned_doctor_id = $1
       AND c.status = 'queued_for_review'
     ORDER BY
       CASE WHEN 'LOW_CONFIDENCE' = ANY(c.priority_flags) OR 'CANNOT_ASSESS' = ANY(c.priority_flags)
            THEN 0 ELSE 1 END ASC,
       c.created_at ASC
     LIMIT $2 OFFSET $3`,
    [doctorId, limit, offset]
  );
  return rows;
}

export async function findConsultationDetailForDoctor(
  consultationId: string,
  doctorId: string
): Promise<ConsultationDetailRow | undefined> {
  const { rows } = await pool.query<ConsultationDetailRow>(
    `SELECT
       c.id,
       c.status,
       c.consultation_type    AS "consultationType",
       c.presenting_complaint AS "presentingComplaint",
       c.transcript,
       c.red_flags            AS "redFlags",
       c.soap_note            AS "soapNote",
       c.differential_diagnoses AS "differentialDiagnoses",
       c.ai_draft             AS "aiDraft",
       c.priority_flags       AS "priorityFlags",
       c.created_at           AS "createdAt",
       p.full_name            AS "patientName",
       p.date_of_birth        AS "patientDob",
       p.biological_sex       AS "patientSex",
       (SELECT json_agg(json_build_object('allergen', a.name, 'severity', a.severity))
        FROM patient_allergies a WHERE a.patient_id = p.id) AS allergies,
       (SELECT json_agg(json_build_object('name', m.name, 'dose', m.dose))
        FROM patient_medications m WHERE m.patient_id = p.id) AS medications,
       (SELECT json_agg(json_build_object('name', con.name))
        FROM patient_conditions con WHERE con.patient_id = p.id) AS conditions,
       ${CLINICAL_WARNINGS_SQL} AS "clinicalContextWarnings"
     FROM consultations c
     JOIN patients p ON p.id = c.patient_id
     WHERE c.id = $1 AND c.assigned_doctor_id = $2`,
    [consultationId, doctorId]
  );
  return rows[0];
}

export async function approveConsultation(
  consultationId: string,
  doctorId: string
): Promise<ConsultationUpdateRow | undefined> {
  const { rows } = await pool.query<ConsultationUpdateRow>(
    `UPDATE consultations
     SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND assigned_doctor_id = $1
     RETURNING id, status`,
    [doctorId, consultationId]
  );
  return rows[0];
}

export async function findAiDraftForConsultation(
  consultationId: string,
  doctorId: string
): Promise<AiFetchRow | undefined> {
  const { rows } = await pool.query<AiFetchRow>(
    `SELECT ai_draft FROM consultations WHERE id = $1 AND assigned_doctor_id = $2`,
    [consultationId, doctorId]
  );
  return rows[0];
}

export async function amendConsultation(
  consultationId: string,
  doctorId: string,
  doctorDraft: string,
  diff: string
): Promise<ConsultationUpdateRow | undefined> {
  const { rows } = await pool.query<ConsultationUpdateRow>(
    `UPDATE consultations
     SET status = 'amended',
         doctor_draft = $1,
         amendment_diff = $2,
         reviewed_by = $3,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $4 AND assigned_doctor_id = $3
     RETURNING id, status`,
    [doctorDraft, diff, doctorId, consultationId]
  );
  return rows[0];
}

export async function rejectConsultation(
  consultationId: string,
  doctorId: string,
  reasonCode: string,
  message: string | null
): Promise<ConsultationUpdateRow | undefined> {
  const { rows } = await pool.query<ConsultationUpdateRow>(
    `UPDATE consultations
     SET status = 'rejected',
         rejection_reason_code = $1,
         rejection_message = $2,
         reviewed_by = $3,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $4 AND assigned_doctor_id = $3
     RETURNING id, status`,
    [reasonCode, message ?? null, doctorId, consultationId]
  );
  return rows[0];
}
