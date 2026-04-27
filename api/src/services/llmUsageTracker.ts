// Records token usage and cost for every LLM call (Claude, Gemini chat,
// Gemini Live). Pricing is sourced from the llm_pricing table so DBAs can
// update list rates without a code redeploy.
//
// All recordUsage calls are fire-and-forget: a tracking failure must never
// take down a clinical workflow. Errors are logged and swallowed.

import { Pool } from "pg";
import { pool as defaultPool } from "../db";
import { logger } from "../logger";

export type LlmProvider = "anthropic" | "bedrock" | "google";
export type LlmOperation =
  | "soap_generation"
  | "live_session"
  | "text_chat";

export interface RecordUsageInput {
  consultationId: string | null;
  operation: LlmOperation;
  provider: LlmProvider;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
}

interface PricingRow {
  input_per_mtok_usd: string;
  output_per_mtok_usd: string;
  cache_read_per_mtok_usd: string | null;
  cache_write_per_mtok_usd: string | null;
}

const PRICING_CACHE_MS = 5 * 60 * 1000;
const pricingCache = new Map<string, { row: PricingRow | null; loadedAt: number }>();

function cacheKey(provider: LlmProvider, modelId: string): string {
  return `${provider}::${modelId}`;
}

async function loadPricing(
  provider: LlmProvider,
  modelId: string,
  dbPool: Pool
): Promise<PricingRow | null> {
  const key = cacheKey(provider, modelId);
  const cached = pricingCache.get(key);
  if (cached && Date.now() - cached.loadedAt < PRICING_CACHE_MS) {
    return cached.row;
  }

  const { rows } = await dbPool.query<PricingRow>(
    `SELECT input_per_mtok_usd, output_per_mtok_usd,
            cache_read_per_mtok_usd, cache_write_per_mtok_usd
     FROM llm_pricing
     WHERE provider = $1 AND model_id = $2 AND effective_from <= NOW()
     ORDER BY effective_from DESC
     LIMIT 1`,
    [provider, modelId]
  );
  const row = rows[0] ?? null;
  pricingCache.set(key, { row, loadedAt: Date.now() });
  return row;
}

export function clearPricingCache(): void {
  pricingCache.clear();
}

export function computeCostUsdMicros(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number,
  pricing: PricingRow
): number {
  // 1 micro-USD = 1/1,000,000 USD.
  // rate is USD per 1,000,000 tokens, so cost_micros = tokens * rate.
  const inputRate = parseFloat(pricing.input_per_mtok_usd);
  const outputRate = parseFloat(pricing.output_per_mtok_usd);
  const cacheReadRate = pricing.cache_read_per_mtok_usd
    ? parseFloat(pricing.cache_read_per_mtok_usd)
    : 0;
  const cacheWriteRate = pricing.cache_write_per_mtok_usd
    ? parseFloat(pricing.cache_write_per_mtok_usd)
    : 0;

  const micros =
    inputTokens * inputRate +
    outputTokens * outputRate +
    cacheReadTokens * cacheReadRate +
    cacheWriteTokens * cacheWriteRate;

  return Math.round(micros);
}

export async function recordUsage(
  input: RecordUsageInput,
  dbPool: Pool = defaultPool
): Promise<void> {
  try {
    const cacheRead = input.cacheReadTokens ?? 0;
    const cacheWrite = input.cacheWriteTokens ?? 0;

    const pricing = await loadPricing(input.provider, input.modelId, dbPool);
    let costMicros = 0;
    if (!pricing) {
      logger.warn(
        { provider: input.provider, modelId: input.modelId },
        "llmUsageTracker: no pricing row found — recording with cost=0"
      );
    } else {
      costMicros = computeCostUsdMicros(
        input.inputTokens,
        input.outputTokens,
        cacheRead,
        cacheWrite,
        pricing
      );
    }

    await dbPool.query(
      `INSERT INTO llm_usage
        (consultation_id, operation, provider, model_id,
         input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
         cost_usd_micros, correlation_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        input.consultationId,
        input.operation,
        input.provider,
        input.modelId,
        input.inputTokens,
        input.outputTokens,
        cacheRead,
        cacheWrite,
        costMicros,
        input.correlationId ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );

    logger.debug(
      {
        consultationId: input.consultationId,
        operation: input.operation,
        modelId: input.modelId,
        costMicros,
      },
      "llmUsageTracker: recorded"
    );
  } catch (err) {
    logger.error(
      { err, consultationId: input.consultationId, operation: input.operation },
      "llmUsageTracker: failed to record usage"
    );
  }
}
