import { Pool } from "pg";

let _pool: Pool | null = null;

export function getTestPool(): Pool {
  if (!_pool) {
    const url = process.env.TEST_DB_URL;
    if (!url) throw new Error("TEST_DB_URL not set");
    _pool = new Pool({ connectionString: url });
  }
  return _pool;
}

// Truncates all patient-related tables between tests.
// Preserves the schema; only clears data.
export async function resetTestDb(): Promise<void> {
  const pool = getTestPool();
  await pool.query(`
    TRUNCATE
      audit_log,
      notifications,
      renewal_requests,
      consultation_photos,
      knowledge_chunks,
      snomed_terms,
      consultations,
      patient_conditions,
      patient_medications,
      patient_allergies,
      patients,
      doctor_date_overrides,
      doctor_availability,
      doctors
    RESTART IDENTITY CASCADE
  `);
}

export async function closeTestPool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
