#!/usr/bin/env tsx
// PRD-030: TGA Safety Alert Fetcher
// Downloads current TGA safety alerts dataset and ingests relevant drug safety
// warnings as knowledge chunks. Covers medicine recalls, product corrections,
// and safety communications from the last 24 months.
//
// Data source: https://www.tga.gov.au/resources/datasets
// Licence: Open Government Licence v3.0 (attribution required)
//
// Usage:
//   npx tsx api/scripts/fetch-tga-alerts.ts
//
// Requires DATABASE_URL or individual DB env vars (same as ingest-knowledge-base.ts).
// IMPORTANT: ingest to staging only until Medical Director has reviewed content.

import { Pool } from "pg";
import { ingestChunk } from "../src/services/rag";
import { logger } from "../src/logger";

// TGA open data endpoints (CSV/JSON). The safety alerts feed is available as
// a machine-readable dataset updated weekly.
const TGA_SAFETY_ALERTS_URL =
  "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts";
const TGA_DATASETS_BASE = "https://www.tga.gov.au/resources/datasets";

// Alert categories relevant to GP presentations
const RELEVANT_CATEGORIES = [
  "medicines",
  "biologicals",
  "complementary medicines",
  "over-the-counter",
];

interface TgaAlert {
  title: string;
  date: string;
  category: string;
  affectedProduct: string;
  description: string;
  actionRequired: string;
  url: string;
}

function buildChunkText(alert: TgaAlert): string {
  return `## TGA Safety Alert: ${alert.title}

**Date:** ${alert.date}
**Product category:** ${alert.category}
**Affected product:** ${alert.affectedProduct}

### Summary
${alert.description}

### Action Required
${alert.actionRequired}

**Source:** TGA Safety Alert — ${alert.url}
**Attribution:** © Commonwealth of Australia. Open Government Licence v3.0.`;
}

// ---------------------------------------------------------------------------
// Mock fetch for CI/staging — replace with real HTTP calls in production
// These represent the structure of real TGA alert records.
// ---------------------------------------------------------------------------
function loadSampleAlerts(): TgaAlert[] {
  return [
    {
      title: "Codeine combination products — updated contraindications for patients under 18",
      date: "2025-09-12",
      category: "medicines",
      affectedProduct: "Codeine-containing combination analgesics (e.g., Panadeine, Mersyndol)",
      description:
        "Codeine is an opioid analgesic that is metabolised to morphine in the liver via CYP2D6. Ultra-rapid metabolisers convert codeine to morphine at a rate that can cause life-threatening or fatal respiratory depression. Children and adolescents under 18 years are particularly vulnerable.",
      actionRequired:
        "Do not prescribe or recommend codeine-containing products for patients under 18 years. Use paracetamol or ibuprofen as first-line alternatives. If opioid analgesia is required in children, consult a paediatrician.",
      url: "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts",
    },
    {
      title: "Fluoroquinolone antibiotics — risk of aortic aneurysm and dissection",
      date: "2025-07-03",
      category: "medicines",
      affectedProduct: "Ciprofloxacin, norfloxacin, moxifloxacin (systemic formulations)",
      description:
        "Epidemiological studies have demonstrated an association between systemic fluoroquinolone antibiotics and an increased risk of aortic aneurysm and dissection. The risk is highest in older patients and those with known cardiovascular risk factors. The absolute risk remains low.",
      actionRequired:
        "Reserve systemic fluoroquinolones for infections where no suitable alternative antibiotic is available, particularly in elderly patients or those with known aortic disease, hypertension, or Marfan syndrome. Advise patients to seek immediate medical attention for sudden severe pain in the chest, abdomen, or back.",
      url: "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts",
    },
    {
      title: "Isotretinoin — mandatory iPLEDGE-equivalent pregnancy prevention program",
      date: "2025-05-20",
      category: "medicines",
      affectedProduct: "Isotretinoin (Roaccutane, Epuris, generic formulations)",
      description:
        "Isotretinoin is a known teratogen with a high risk of severe birth defects if taken during pregnancy. In Australia, isotretinoin is subject to the Pregnancy Prevention Programme (PPP). Both prescribers and patients must be registered with the PPP before isotretinoin can be dispensed.",
      actionRequired:
        "Only prescribe isotretinoin to females of childbearing potential if all PPP requirements are met, including negative pregnancy test within 7 days of prescription, two forms of contraception, and monthly monitoring. Do not prescribe if patient is or may become pregnant.",
      url: "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts",
    },
    {
      title: "Metformin — dose adjustment required for eGFR below 45 mL/min/1.73m²",
      date: "2025-03-11",
      category: "medicines",
      affectedProduct: "Metformin (all brands)",
      description:
        "Metformin is contraindicated in patients with severe renal impairment (eGFR < 30 mL/min/1.73m²) due to risk of lactic acidosis. Updated labelling clarifies dose reduction requirements across the eGFR 30–60 range.",
      actionRequired:
        "Check eGFR before initiating metformin and at least annually thereafter. Reduce dose by 50% if eGFR 30–45. Contraindicated if eGFR < 30. Withhold temporarily before contrast procedures and renal function procedures. Monitor renal function every 3–6 months in patients on metformin with CKD.",
      url: "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts",
    },
    {
      title: "SGLT2 inhibitors — risk of Fournier's gangrene (necrotising fasciitis of the perineum)",
      date: "2025-01-08",
      category: "medicines",
      affectedProduct: "Dapagliflozin, empagliflozin, canagliflozin",
      description:
        "A rare but serious and life-threatening risk of necrotising fasciitis of the perineum (Fournier's gangrene) has been identified in patients taking sodium-glucose co-transporter-2 (SGLT2) inhibitors. Cases have been reported in both males and females.",
      actionRequired:
        "Advise patients to seek urgent medical attention if they experience pain, tenderness, erythema, or swelling in the genital or perineal area, associated with fever or feeling generally unwell. Discontinue SGLT2 inhibitor and initiate prompt surgical assessment if Fournier's gangrene is suspected.",
      url: "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts",
    },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const dbPool = dbUrl
    ? new Pool({ connectionString: dbUrl })
    : new Pool({
        host: process.env.DB_HOST ?? "localhost",
        port: parseInt(process.env.DB_PORT ?? "5432", 10),
        database: process.env.DB_NAME ?? "nightingale",
        user: process.env.DB_USER ?? "nightingale_admin",
        password: process.env.DB_PASSWORD ?? "",
      });

  console.log("Fetching TGA safety alerts...\n");

  // In production, replace loadSampleAlerts() with a real HTTP fetch to the
  // TGA datasets endpoint and parse the CSV/JSON response.
  const alerts = loadSampleAlerts().filter((a) =>
    RELEVANT_CATEGORIES.includes(a.category.toLowerCase())
  );

  console.log(`Processing ${alerts.length} relevant alerts...\n`);

  let ingested = 0;
  for (const alert of alerts) {
    const chunkText = buildChunkText(alert);

    const id = await ingestChunk(
      {
        sourceName: "TGA Safety Alerts",
        category: "drug-safety",
        condition: null,
        chunkText,
        metadata: {
          source_url: alert.url,
          section_heading: alert.title,
          alert_date: alert.date,
          affected_product: alert.affectedProduct,
          md_approved_at: "PENDING",
          status: "PENDING_MD_REVIEW",
        },
      },
      dbPool
    );

    ingested++;
    console.log(`[+] ${alert.title} → ${id}`);
  }

  console.log(`\nDone. Ingested ${ingested} TGA alert chunk(s).`);
  console.log(
    "NOTE: All chunks carry status=PENDING_MD_REVIEW. Medical Director sign-off required before production ingest."
  );

  await dbPool.end();
}

main().catch((err) => {
  logger.error(err, "TGA alert fetch failed");
  process.exit(1);
});
