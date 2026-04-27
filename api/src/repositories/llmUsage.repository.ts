import { pool } from "../db";

export interface UsageSummaryRow {
  total_calls: string;
  total_input_tokens: string;
  total_output_tokens: string;
  total_cache_read_tokens: string;
  total_cache_write_tokens: string;
  total_cost_micros: string;
}

export interface UsageByModelRow {
  provider: string;
  model_id: string;
  call_count: string;
  input_tokens: string;
  output_tokens: string;
  cache_read_tokens: string;
  cost_micros: string;
}

export interface UsageByOperationRow {
  operation: string;
  call_count: string;
  cost_micros: string;
}

export interface UsageByConsultationRow {
  consultation_id: string | null;
  call_count: string;
  cost_micros: string;
  input_tokens: string;
  output_tokens: string;
  first_call_at: string;
  last_call_at: string;
  presenting_complaint: string | null;
  consultation_type: string | null;
  status: string | null;
}

export interface UsageDailyRow {
  day: string;
  cost_micros: string;
  call_count: string;
}

export interface UsageDetailRow {
  id: string;
  operation: string;
  provider: string;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd_micros: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface DateRange {
  from?: string;
  to?: string;
}

function rangeClause(params: unknown[], range: DateRange): string {
  const clauses: string[] = [];
  if (range.from) {
    params.push(range.from);
    clauses.push(`created_at >= $${params.length}`);
  }
  if (range.to) {
    params.push(range.to);
    clauses.push(`created_at < $${params.length}`);
  }
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

export async function getUsageSummary(range: DateRange): Promise<UsageSummaryRow> {
  const params: unknown[] = [];
  const where = rangeClause(params, range);
  const { rows } = await pool.query<UsageSummaryRow>(
    `SELECT
       COUNT(*)::text                              AS total_calls,
       COALESCE(SUM(input_tokens), 0)::text        AS total_input_tokens,
       COALESCE(SUM(output_tokens), 0)::text       AS total_output_tokens,
       COALESCE(SUM(cache_read_tokens), 0)::text   AS total_cache_read_tokens,
       COALESCE(SUM(cache_write_tokens), 0)::text  AS total_cache_write_tokens,
       COALESCE(SUM(cost_usd_micros), 0)::text     AS total_cost_micros
     FROM llm_usage
     ${where}`,
    params
  );
  return rows[0];
}

export async function getUsageByModel(range: DateRange): Promise<UsageByModelRow[]> {
  const params: unknown[] = [];
  const where = rangeClause(params, range);
  const { rows } = await pool.query<UsageByModelRow>(
    `SELECT
       provider,
       model_id,
       COUNT(*)::text                            AS call_count,
       COALESCE(SUM(input_tokens), 0)::text      AS input_tokens,
       COALESCE(SUM(output_tokens), 0)::text     AS output_tokens,
       COALESCE(SUM(cache_read_tokens), 0)::text AS cache_read_tokens,
       COALESCE(SUM(cost_usd_micros), 0)::text   AS cost_micros
     FROM llm_usage
     ${where}
     GROUP BY provider, model_id
     ORDER BY SUM(cost_usd_micros) DESC`,
    params
  );
  return rows;
}

export async function getUsageByOperation(range: DateRange): Promise<UsageByOperationRow[]> {
  const params: unknown[] = [];
  const where = rangeClause(params, range);
  const { rows } = await pool.query<UsageByOperationRow>(
    `SELECT
       operation,
       COUNT(*)::text                          AS call_count,
       COALESCE(SUM(cost_usd_micros), 0)::text AS cost_micros
     FROM llm_usage
     ${where}
     GROUP BY operation
     ORDER BY SUM(cost_usd_micros) DESC`,
    params
  );
  return rows;
}

export async function getUsageByConsultation(
  range: DateRange,
  limit: number,
  offset: number
): Promise<UsageByConsultationRow[]> {
  const params: unknown[] = [];
  const where = rangeClause(params, range);
  params.push(limit, offset);
  const { rows } = await pool.query<UsageByConsultationRow>(
    `SELECT
       u.consultation_id,
       COUNT(*)::text                            AS call_count,
       COALESCE(SUM(u.cost_usd_micros), 0)::text AS cost_micros,
       COALESCE(SUM(u.input_tokens), 0)::text    AS input_tokens,
       COALESCE(SUM(u.output_tokens), 0)::text   AS output_tokens,
       MIN(u.created_at)                         AS first_call_at,
       MAX(u.created_at)                         AS last_call_at,
       c.presenting_complaint,
       c.consultation_type,
       c.status
     FROM llm_usage u
     LEFT JOIN consultations c ON c.id = u.consultation_id
     ${where}
     GROUP BY u.consultation_id, c.presenting_complaint, c.consultation_type, c.status
     ORDER BY SUM(u.cost_usd_micros) DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

export async function countConsultationsWithUsage(range: DateRange): Promise<number> {
  const params: unknown[] = [];
  const where = rangeClause(params, range);
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(DISTINCT consultation_id)::text AS count
     FROM llm_usage
     ${where}`,
    params
  );
  return parseInt(rows[0].count, 10);
}

export async function getUsageDaily(range: DateRange): Promise<UsageDailyRow[]> {
  const params: unknown[] = [];
  const where = rangeClause(params, range);
  const { rows } = await pool.query<UsageDailyRow>(
    `SELECT
       to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
       COALESCE(SUM(cost_usd_micros), 0)::text              AS cost_micros,
       COUNT(*)::text                                       AS call_count
     FROM llm_usage
     ${where}
     GROUP BY date_trunc('day', created_at)
     ORDER BY date_trunc('day', created_at) ASC`,
    params
  );
  return rows;
}

export async function getUsageForConsultation(consultationId: string): Promise<UsageDetailRow[]> {
  const { rows } = await pool.query<UsageDetailRow>(
    `SELECT id, operation, provider, model_id,
            input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
            cost_usd_micros::text AS cost_usd_micros, created_at, metadata
     FROM llm_usage
     WHERE consultation_id = $1
     ORDER BY created_at ASC`,
    [consultationId]
  );
  return rows;
}
