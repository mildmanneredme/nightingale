function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
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
  },

  cognito: {
    userPoolId: optional("COGNITO_USER_POOL_ID", ""),
    clientId: optional("COGNITO_CLIENT_ID", ""),
    region: optional("AWS_REGION", "ap-southeast-2"),
  },
} as const;
