function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) throw new Error(`Env var ${name} must be an integer, got: "${raw}"`);
  return parsed;
}

export const config = {
  port: parseInt(optional("PORT", "8080"), 10),
  env: optional("APP_ENV", "development"),

  db: {
    host: required("DB_HOST"),
    port: parseInt(optional("DB_PORT", "5432"), 10),
    name: optional("DB_NAME", "nightingale"),
    user: optional("DB_USER", "nightingale_admin"),
    password: required("DB_PASSWORD"),
    ssl: optional("APP_ENV", "development") !== "development",
    poolMax: optionalInt("DB_POOL_MAX", 20),
  },

  cognito: {
    userPoolId: optional("COGNITO_USER_POOL_ID", ""),
    clientId: optional("COGNITO_CLIENT_ID", ""),
    region: optional("AWS_REGION", "ap-southeast-2"),
  },

  gemini: {
    // Required for Gemini Live API. Set in ECS task definition (not committed).
    // For local dev, export GEMINI_API_KEY=<your key>
    apiKey: optional("GEMINI_API_KEY", ""),
    // Target australia-southeast1 in production for APP 8 compliance.
    // Use us-central1 for local dev until AU region availability is confirmed.
    region: optional("GEMINI_REGION", "us-central1"),
    model: optional("GEMINI_LIVE_MODEL", "gemini-3.1-flash-live-preview"),
    // Text-chat fallback (PRD-009). gemini-2.0-flash was retired by Google
    // 2026-04 — keep this overridable so future model retirements only need
    // an env var change.
    chatModel: optional("GEMINI_CHAT_MODEL", "gemini-2.5-flash"),
    sessionTimeoutMs: optionalInt("GEMINI_SESSION_TIMEOUT_MS", 900_000),
  },

  anthropic: {
    // Direct Anthropic API — used for local dev and testing.
    // Set ANTHROPIC_API_KEY to use direct API. Leave blank to use Bedrock.
    apiKey: optional("ANTHROPIC_API_KEY", ""),

    // AWS Bedrock — used in production (ap-southeast-2) for APP 8 compliance.
    // Set USE_BEDROCK=true and AWS credentials/role must be available via IAM.
    useBedrock: optional("USE_BEDROCK", "false") === "true",
    bedrockRegion: optional("BEDROCK_REGION", "ap-southeast-2"),
    // Model ID on Bedrock: https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html
    bedrockModelId: optional(
      "BEDROCK_MODEL_ID",
      "anthropic.claude-sonnet-4-6-20251001-v1:0"
    ),
    // Model ID for direct API
    directModelId: optional("ANTHROPIC_MODEL_ID", "claude-sonnet-4-6"),

    maxTokens: 8192,
  },

  s3: {
    region: optional("AWS_REGION", "ap-southeast-2"),
    photosBucket: optional("S3_PHOTOS_BUCKET", "nightingale-photos-dev"),
    // KMS key ARN or alias for SSE-KMS. Falls back to aws/s3 managed key in dev.
    kmsKeyId: optional("S3_PHOTOS_KMS_KEY_ID", ""),
    // Pre-signed URL expiry in seconds (15 minutes)
    presignedUrlExpiry: 900,
  },

  sendgrid: {
    // SendGrid API key — set in ECS task definition (not committed).
    // Leave blank in test environments; emailService will skip actual sending.
    apiKey: optional("SENDGRID_API_KEY", ""),
    fromEmail: optional("SENDGRID_FROM_EMAIL", "noreply@nightingale.com.au"),
    fromName: optional("SENDGRID_FROM_NAME", "Nightingale Health"),
    // Destination for internal admin notifications (demo requests, new doctor applications).
    adminNotificationEmail: optional("ADMIN_NOTIFICATION_EMAIL", "admin@nightingale.com.au"),
  },
} as const;
