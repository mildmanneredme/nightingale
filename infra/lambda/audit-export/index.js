/**
 * Audit Export Lambda — PRD-005 F-005
 *
 * Runs hourly via EventBridge. Reads audit_log rows created in the last hour
 * and writes them as a NDJSON file to the S3 audit bucket (WORM-locked).
 *
 * Failure does not block consultation flow — Lambda retries are handled by
 * EventBridge with a dead-letter queue.
 */

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Client } = require("pg");

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async () => {
  const dbPassword = await getSecret(process.env.DB_SECRET_ARN);

  const db = new Client({
    host:     process.env.DB_HOST,
    port:     5432,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: dbPassword,
    ssl:      { rejectUnauthorized: false },
  });

  await db.connect();

  try {
    const windowEnd   = new Date();
    const windowStart = new Date(windowEnd.getTime() - 60 * 60 * 1000); // 1 hour back

    const result = await db.query(
      `SELECT * FROM audit_log
       WHERE created_at >= $1 AND created_at < $2
       ORDER BY created_at ASC`,
      [windowStart.toISOString(), windowEnd.toISOString()]
    );

    if (result.rows.length === 0) {
      console.log("No audit records in window — skipping export");
      return;
    }

    const ndjson = result.rows.map((r) => JSON.stringify(r)).join("\n");
    const key = buildS3Key(windowStart);

    await s3Client.send(new PutObjectCommand({
      Bucket:               process.env.AUDIT_BUCKET,
      Key:                  key,
      Body:                 ndjson,
      ContentType:          "application/x-ndjson",
      ServerSideEncryption: "aws:kms",
    }));

    console.log(`Exported ${result.rows.length} records to s3://${process.env.AUDIT_BUCKET}/${key}`);
  } finally {
    await db.end();
  }
};

async function getSecret(arn) {
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: arn })
  );
  return response.SecretString;
}

function buildS3Key(windowStart) {
  const d = windowStart;
  const year  = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day   = String(d.getUTCDate()).padStart(2, "0");
  const hour  = String(d.getUTCHours()).padStart(2, "0");
  return `audit-export/${year}/${month}/${day}/${hour}00.ndjson`;
}
