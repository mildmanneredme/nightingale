import { readFileSync } from "fs";
import { join } from "path";
import { logger } from "../logger";

export const EXPECTED_PROMPTS = [
  "system-preamble",
  "ahpra-constraints",
  "cannot-assess-criteria",
  "output-schema",
  "cannot-assess-template",
] as const;

export type PromptName = (typeof EXPECTED_PROMPTS)[number];

const PROMPTS_DIR = join(__dirname, ".");

export function validateAndLoadPrompts(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  const missing: string[] = [];

  for (const name of EXPECTED_PROMPTS) {
    const filePath = join(dir, `${name}.md`);
    try {
      map.set(name, readFileSync(filePath, "utf8"));
    } catch {
      missing.push(filePath);
    }
  }

  if (missing.length > 0) {
    process.stderr.write(
      `[promptLoader] startup failure — missing prompt files:\n${missing.join("\n")}\n`
    );
    process.exit(1);
  }

  return map;
}

const promptMap = validateAndLoadPrompts(PROMPTS_DIR);

export function getPrompt(name: string): string {
  const content = promptMap.get(name);
  if (content === undefined) {
    logger.warn({ promptName: name }, "promptLoader: unexpected prompt name requested");
    throw new Error(`Prompt not found: ${name}`);
  }
  return content;
}
