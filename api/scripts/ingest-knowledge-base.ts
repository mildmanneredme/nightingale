#!/usr/bin/env tsx
// PRD-011: Knowledge Base Ingestion Script
// Reads markdown files from clinical-knowledge/, chunks by section (## headings),
// and ingests each chunk into the knowledge_chunks table.
//
// Usage:
//   npx tsx api/scripts/ingest-knowledge-base.ts
//
// Requires DB env vars to be set (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
// or set DATABASE_URL for a single connection string override.

import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import { ingestChunk } from "../src/services/rag";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse YAML-style frontmatter from a markdown file */
function parseFrontmatter(content: string): {
  meta: Record<string, string>;
  body: string;
} {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    return { meta: {}, body: content };
  }

  const meta: Record<string, string> = {};
  for (const line of fmMatch[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      meta[key] = value;
    }
  }

  return { meta, body: fmMatch[2] };
}

/** Split markdown body into sections by ## headings */
function splitIntoSections(body: string): Array<{ heading: string; text: string }> {
  const sections: Array<{ heading: string; text: string }> = [];
  const parts = body.split(/^(##\s+.+)$/m);

  // parts[0] is any content before first ## heading
  if (parts[0].trim()) {
    sections.push({ heading: "Introduction", text: parts[0].trim() });
  }

  // Remaining parts come in pairs: heading, content
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].replace(/^##\s+/, "").trim();
    const text = (parts[i + 1] ?? "").trim();
    if (text) {
      sections.push({ heading, text: `## ${heading}\n\n${text}` });
    }
  }

  return sections;
}

/** Determine category from file path */
function categoryFromPath(filePath: string): string {
  const parts = filePath.split(path.sep);
  // clinical-knowledge/<category>/...
  const clinicalIdx = parts.findIndex((p) => p === "clinical-knowledge");
  if (clinicalIdx >= 0 && parts[clinicalIdx + 1]) {
    const dir = parts[clinicalIdx + 1];
    // Map directory names to category values
    const map: Record<string, string> = {
      "therapeutic-guidelines": "therapeutic-guidelines",
      "medications": "medications",
      "regulatory": "regulatory",
      "escalation": "escalation",
      "question-trees": "question-trees",
      "terminology": "terminology",
      "system-prompts": "terminology", // system-prompts are meta, skip
      // PRD-030: external open-source sources — sub-categorised by frontmatter
      "external-sources": "therapeutic-guidelines",
    };
    return map[dir] ?? dir;
  }
  return "general";
}

/** Determine condition from file path (e.g. clinical-knowledge/therapeutic-guidelines/urti/...) */
function conditionFromPath(filePath: string): string | null {
  const parts = filePath.split(path.sep);
  const clinicalIdx = parts.findIndex((p) => p === "clinical-knowledge");
  if (clinicalIdx >= 0 && parts.length > clinicalIdx + 3) {
    return parts[clinicalIdx + 2]; // e.g. 'urti', 'uti', etc.
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  let dbPool: Pool;

  if (dbUrl) {
    dbPool = new Pool({ connectionString: dbUrl });
  } else {
    dbPool = new Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: parseInt(process.env.DB_PORT ?? "5432", 10),
      database: process.env.DB_NAME ?? "nightingale",
      user: process.env.DB_USER ?? "nightingale_admin",
      password: process.env.DB_PASSWORD ?? "",
    });
  }

  const rootDir = path.resolve(__dirname, "../../clinical-knowledge");

  if (!fs.existsSync(rootDir)) {
    console.error(`ERROR: clinical-knowledge directory not found at ${rootDir}`);
    process.exit(1);
  }

  // Collect all .md files recursively, excluding system-prompts (meta, not knowledge)
  const mdFiles: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip system-prompts — they are templates, not knowledge chunks
        if (entry.name !== "system-prompts") {
          walk(fullPath);
        }
      } else if (entry.name.endsWith(".md")) {
        mdFiles.push(fullPath);
      }
    }
  }

  walk(rootDir);

  if (mdFiles.length === 0) {
    console.log("No markdown files found in clinical-knowledge/");
    process.exit(0);
  }

  console.log(`Found ${mdFiles.length} markdown file(s) to process...\n`);

  let totalChunks = 0;
  const categoryCounts: Record<string, number> = {};

  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const { meta, body } = parseFrontmatter(content);

    const sourceName = meta["source"] ?? path.basename(filePath, ".md");
    const sourceUrl = meta["source_url"] ?? null;
    const category = meta["category"] ?? categoryFromPath(filePath);
    const condition = meta["condition"] ?? conditionFromPath(filePath);

    // Skip system-prompts category
    if (category === "terminology" && filePath.includes("system-prompts")) {
      console.log(`  SKIP (system-prompt template): ${path.relative(rootDir, filePath)}`);
      continue;
    }

    const sections = splitIntoSections(body);

    console.log(`Processing: ${path.relative(rootDir, filePath)}`);
    console.log(`  Source: ${sourceName}`);
    console.log(`  Category: ${category}${condition ? `, Condition: ${condition}` : ""}`);
    console.log(`  Sections: ${sections.length}`);

    for (const section of sections) {
      // Skip very short sections (likely footers/disclaimers without substantive content)
      if (section.text.length < 50) continue;

      const id = await ingestChunk(
        {
          sourceName,
          category,
          condition: condition ?? null,
          chunkText: section.text,
          metadata: {
            source_url: sourceUrl,
            section_heading: section.heading,
            md_approved_at: meta["md_approved_at"] ?? "PENDING",
            status: meta["status"] ?? "PLACEHOLDER",
            version: meta["version"] ?? null,
          },
        },
        dbPool
      );

      totalChunks++;
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
      console.log(`    [+] Ingested section "${section.heading}" → ${id}`);
    }

    console.log();
  }

  console.log("=".repeat(60));
  console.log(`Ingestion complete: ${totalChunks} chunk(s) inserted`);
  console.log("\nCategories indexed:");
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  ${cat}: ${count} chunk(s)`);
  }

  await dbPool.end();
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
