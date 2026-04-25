import fs from "fs";
import path from "path";

// Resolve the templates directory at load time.
// In development (ts-node): __dirname === api/src/email-templates  → files are here.
// In production (tsc):      __dirname === api/dist/email-templates → files must be copied
//   alongside the JS, OR override with EMAIL_TEMPLATES_DIR env var.
const TEMPLATES_DIR =
  process.env.EMAIL_TEMPLATES_DIR ?? path.join(__dirname);

const cache = new Map<string, string>();

const REQUIRED_TEMPLATES = [
  "response-ready",
  "rejection",
  "renewal-approved",
  "renewal-declined",
  "renewal-reminder",
  "follow-up",
  "follow-up-concern",
];

// F-078: Templates loaded and cached at startup.
// F-079: If a template file is missing at startup, process exits with code 1.
export function loadTemplates(): void {
  for (const name of REQUIRED_TEMPLATES) {
    const filePath = path.join(TEMPLATES_DIR, `${name}.html`);
    if (!fs.existsSync(filePath)) {
      console.error(`FATAL: Email template missing: ${filePath}`);
      process.exit(1);
    }
    cache.set(name, fs.readFileSync(filePath, "utf8"));
  }
}

export function renderTemplate(name: string, vars: Record<string, string>): string {
  const template = cache.get(name);
  if (!template) throw new Error(`Email template not loaded: ${name}`);
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}
