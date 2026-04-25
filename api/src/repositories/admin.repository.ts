import { pool } from "../db";

export interface DoctorExistsRow {
  id: string;
}

export interface ConsultationAssignmentRow {
  id: string;
  assigned_doctor_id: string | null;
}

export interface ConsultationReassignedRow {
  id: string;
  assignedDoctorId: string;
}

export interface AdminQueueRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  presenting_complaint: string | null;
  assigned_doctor_id: string | null;
  doctor_name: string | null;
  created_at: string;
  queued_at: string;
}

export interface DoctorListRow {
  id: string;
  first_name: string;
  last_name: string;
}

export interface AdminStatsRow {
  total_patients: string;
  total_consultations: string;
  pending_consultations: string;
  approved_consultations: string;
  amended_consultations: string;
  rejected_consultations: string;
  emergency_escalated: string;
  cannot_assess: string;
  resolved_consultations: string;
  followup_concern: string;
}

export interface ReviewTimeRow {
  avg_minutes: string | null;
}

export interface FollowUpStatsRow {
  sent: string;
  responded: string;
  better: string;
  same: string;
  worse: string;
}

export async function findDoctorById(doctorId: string): Promise<DoctorExistsRow | undefined> {
  const { rows } = await pool.query<DoctorExistsRow>(
    `SELECT id FROM doctors WHERE id = $1`,
    [doctorId]
  );
  return rows[0];
}

export async function findConsultationAssignment(consultationId: string): Promise<ConsultationAssignmentRow | undefined> {
  const { rows } = await pool.query<ConsultationAssignmentRow>(
    `SELECT id, assigned_doctor_id FROM consultations WHERE id = $1`,
    [consultationId]
  );
  return rows[0];
}

export async function reassignConsultation(
  consultationId: string,
  doctorId: string
): Promise<ConsultationReassignedRow | undefined> {
  const { rows } = await pool.query<ConsultationReassignedRow>(
    `UPDATE consultations
     SET assigned_doctor_id = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, assigned_doctor_id AS "assignedDoctorId"`,
    [doctorId, consultationId]
  );
  return rows[0];
}

export async function insertReassignAuditLog(
  adminUuid: string,
  consultationId: string,
  doctorId: string,
  previousDoctorId: string | null,
  adminSub: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('consultation.reassigned', $1, 'admin', $2, $3)`,
    [adminUuid, consultationId, JSON.stringify({ doctorId, previousDoctorId, adminSub })]
  );
}

export async function findQueuedConsultations(): Promise<AdminQueueRow[]> {
  const { rows } = await pool.query<AdminQueueRow>(
    `SELECT
       c.id,
       p.first_name,
       p.last_name,
       c.presenting_complaint,
       c.assigned_doctor_id,
       COALESCE(d.first_name || ' ' || d.last_name, NULL) AS doctor_name,
       c.created_at,
       c.updated_at AS queued_at
     FROM consultations c
     LEFT JOIN patients p ON p.id = c.patient_id
     LEFT JOIN doctors d ON d.id = c.assigned_doctor_id
     WHERE c.status = 'queued_for_review'
     ORDER BY c.updated_at ASC`
  );
  return rows;
}

export async function findAllDoctors(): Promise<DoctorListRow[]> {
  const { rows } = await pool.query<DoctorListRow>(
    `SELECT id, first_name, last_name FROM doctors ORDER BY last_name, first_name`
  );
  return rows;
}

export async function findAdminStats(): Promise<AdminStatsRow> {
  const { rows } = await pool.query<AdminStatsRow>(
    `SELECT
       (SELECT COUNT(*) FROM patients)                                                AS total_patients,
       (SELECT COUNT(*) FROM consultations)                                           AS total_consultations,
       (SELECT COUNT(*) FROM consultations WHERE status = 'queued_for_review')        AS pending_consultations,
       (SELECT COUNT(*) FROM consultations WHERE status = 'approved')                 AS approved_consultations,
       (SELECT COUNT(*) FROM consultations WHERE status = 'amended')                  AS amended_consultations,
       (SELECT COUNT(*) FROM consultations WHERE status = 'rejected')                 AS rejected_consultations,
       (SELECT COUNT(*) FROM consultations WHERE status = 'emergency_escalated')      AS emergency_escalated,
       (SELECT COUNT(*) FROM consultations WHERE status = 'cannot_assess')            AS cannot_assess,
       (SELECT COUNT(*) FROM consultations WHERE status IN ('resolved','unchanged'))  AS resolved_consultations,
       (SELECT COUNT(*) FROM consultations WHERE status = 'followup_concern')         AS followup_concern`
  );
  return rows[0];
}

export async function findAvgReviewTime(): Promise<ReviewTimeRow> {
  const { rows } = await pool.query<ReviewTimeRow>(
    `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 60))::text AS avg_minutes
     FROM consultations
     WHERE reviewed_at IS NOT NULL`
  );
  return rows[0];
}

export async function findFollowUpStats(): Promise<FollowUpStatsRow> {
  const { rows } = await pool.query<FollowUpStatsRow>(
    `SELECT
       COUNT(*) FILTER (WHERE followup_sent_at IS NOT NULL)           AS sent,
       COUNT(*) FILTER (WHERE followup_response IS NOT NULL)          AS responded,
       COUNT(*) FILTER (WHERE followup_response = 'better')           AS better,
       COUNT(*) FILTER (WHERE followup_response = 'same')             AS same,
       COUNT(*) FILTER (WHERE followup_response = 'worse')            AS worse
     FROM consultations`
  );
  return rows[0];
}
