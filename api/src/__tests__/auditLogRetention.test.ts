// PRD-023 S-09: audit_log is append-only at the database layer.
// Verifies the trigger installed by migration 015_audit_log_retention.sql blocks
// UPDATE and DELETE for the application role while allowing superusers through
// for legal-hold scenarios.

import { getTestPool, closeTestPool } from "./helpers/db";

const SKIP = !process.env.TEST_DB_URL;

(SKIP ? describe.skip : describe)("PRD-023 S-09: audit_log append-only enforcement", () => {
  afterAll(async () => {
    await closeTestPool();
  });

  async function insertAuditRow(): Promise<string> {
    const pool = getTestPool();
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO audit_log (event_type, actor_id, actor_role)
       VALUES ('TEST_S09_EVENT', gen_random_uuid(), 'system')
       RETURNING id`
    );
    return rows[0].id;
  }

  it("blocks UPDATE on audit_log when running as the application role", async () => {
    const pool = getTestPool();
    const id = await insertAuditRow();

    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_role");
      await expect(
        client.query(
          "UPDATE audit_log SET event_type = 'TAMPERED' WHERE id = $1",
          [id]
        )
      ).rejects.toThrow(/audit_log is append-only/);
    } finally {
      await client.query("RESET ROLE");
      client.release();
    }
  });

  it("blocks DELETE on audit_log when running as the application role", async () => {
    const pool = getTestPool();
    const id = await insertAuditRow();

    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_role");
      await expect(
        client.query("DELETE FROM audit_log WHERE id = $1", [id])
      ).rejects.toThrow(/audit_log is append-only/);
    } finally {
      await client.query("RESET ROLE");
      client.release();
    }
  });

  it("allows DELETE when running as a superuser (legal-hold bypass)", async () => {
    const pool = getTestPool();
    const id = await insertAuditRow();

    // The default test connection runs as the local Postgres superuser
    // (see helpers/setupEnv.ts). Deletion must still succeed for DBA-driven
    // legal holds and court-ordered data removal.
    const result = await pool.query("DELETE FROM audit_log WHERE id = $1", [id]);
    expect(result.rowCount).toBe(1);
  });

  it("allows UPDATE when running as a superuser (legal-hold bypass)", async () => {
    const pool = getTestPool();
    const id = await insertAuditRow();

    const result = await pool.query(
      "UPDATE audit_log SET event_type = 'LEGAL_HOLD_AMEND' WHERE id = $1",
      [id]
    );
    expect(result.rowCount).toBe(1);

    // Cleanup so the row doesn't leak into subsequent test runs.
    await pool.query("DELETE FROM audit_log WHERE id = $1", [id]);
  });
});
