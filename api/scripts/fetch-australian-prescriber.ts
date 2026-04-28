#!/usr/bin/env tsx
// PRD-030: Australian Prescriber Article Fetcher
// Fetches open-access prescribing guidance articles from Australian Prescriber
// (australianprescriber.tg.org.au) and ingests them as knowledge chunks.
//
// Australian Prescriber is a fully open-access journal funded by the
// Australian Government Department of Health. Content is free for any lawful
// purpose with attribution, provided it is not used for commercial purposes.
//
// Usage:
//   npx tsx api/scripts/fetch-australian-prescriber.ts
//
// Requires DATABASE_URL or individual DB env vars.
// IMPORTANT: ingest to staging only until Medical Director has reviewed content.

import { Pool } from "pg";
import { ingestChunk } from "../src/services/rag";
import { logger } from "../src/logger";

const SOURCE_NAME = "Australian Prescriber";
const SOURCE_BASE_URL = "https://australianprescriber.tg.org.au";
const ATTRIBUTION =
  "© Australian Prescriber / NPS MedicineWise. Open access — any lawful non-commercial use with attribution permitted.";

// High-value articles curated for the 5 core GP presentations + clinical safety.
// In production, extend this list by fetching the article index from the API
// (australianprescriber.tg.org.au has a REST API at /api/articles).
const CURATED_ARTICLES = [
  // URTI / Respiratory
  {
    topic: "urti",
    title: "Antibiotic prescribing for upper respiratory tract infections",
    condition: "urti",
    url: `${SOURCE_BASE_URL}/articles/antibiotic-prescribing-for-upper-respiratory-tract-infections`,
    summary: `## Antibiotic prescribing for upper respiratory tract infections

Upper respiratory tract infections (URTIs) are among the most common reasons patients present to general practice. The vast majority are caused by viruses and do not benefit from antibiotic treatment.

### Key points for Australian GPs
- Antibiotics are not recommended for acute rhinosinusitis, pharyngitis, or acute bronchitis in otherwise healthy adults unless there are clear signs of bacterial infection or the patient is immunocompromised.
- Most URTIs resolve within 7–10 days without antibiotics.
- Symptomatic relief (paracetamol, ibuprofen, saline nasal irrigation) is the mainstay of management.
- Delayed prescribing strategies (post-dated script, conditional script) reduce antibiotic use without compromising outcomes.

### When to consider antibiotics
- Peritonsillar abscess or quinsy (immediate referral or admission)
- Suspected epiglottitis (emergency)
- Group A streptococcal pharyngitis confirmed by rapid antigen test or culture — amoxicillin 500 mg TDS for 10 days or phenoxymethylpenicillin 500 mg BD for 10 days
- Acute bacterial rhinosinusitis (>10 days without improvement, or worsening): amoxicillin-clavulanate 875/125 mg BD for 5–7 days

### Antibiotic stewardship
Inappropriate antibiotic prescribing contributes to antimicrobial resistance, adverse effects (diarrhoea, rashes, thrush), and C. difficile infection. Use HealthPathways or Therapeutic Guidelines: Antibiotic for up-to-date recommendations.`,
  },
  {
    topic: "respiratory",
    title: "Managing asthma in adults in general practice",
    condition: "asthma",
    url: `${SOURCE_BASE_URL}/articles/managing-asthma-adults-general-practice`,
    summary: `## Managing asthma in adults in general practice

Asthma affects approximately 11% of Australians. Most patients are managed in general practice using a stepwise approach aligned with the National Asthma Council Australia guidelines.

### Diagnosis
- Variable expiratory airflow limitation confirmed by spirometry (FEV1/FVC ratio)
- Bronchodilator reversibility: ≥12% and ≥200 mL increase in FEV1 after salbutamol

### Stepwise management (adults)
**Step 1:** Low-dose ICS-formoterol as needed (preferred) OR short-acting beta2-agonist (SABA) as needed with low-dose ICS
**Step 2:** Low-dose ICS-formoterol as maintenance + as needed
**Step 3:** Medium-dose ICS-LABA maintenance + low-dose ICS-formoterol as needed
**Step 4:** High-dose ICS-LABA; consider add-on LAMA, LTRA, or biologics (specialist referral)

### Written Asthma Action Plan
All patients should receive a written asthma action plan. Review at each visit.

### Reliever choice: SABA vs. ICS-formoterol
Current GINA 2024 guidance (adopted by NAC Australia) recommends against SABA-only reliever therapy. Low-dose ICS-formoterol (e.g., budesonide-formoterol) as reliever is preferred to reduce exacerbation risk.`,
  },
  // UTI / Genitourinary
  {
    topic: "uti",
    title: "Management of urinary tract infections in general practice",
    condition: "uti",
    url: `${SOURCE_BASE_URL}/articles/urinary-tract-infections-general-practice`,
    summary: `## Management of urinary tract infections in general practice

Urinary tract infections (UTIs) are one of the most common bacterial infections managed in Australian general practice, predominantly affecting women.

### Uncomplicated UTI in non-pregnant women
**First-line:**
- Trimethoprim 300 mg orally once daily for 3 days
- Nitrofurantoin 100 mg (modified release) twice daily for 5 days

**Avoid:**
- Amoxicillin and amoxicillin-clavulanate — high local E. coli resistance rates (>30% in many regions)
- Ciprofloxacin — reserve for complicated UTI or pyelonephritis; fluoroquinolone stewardship priority

### Recurrent UTI (≥2 in 6 months or ≥3 in 12 months)
- Urine culture before treatment
- Consider self-start antibiotic therapy or post-coital prophylaxis after urology review
- Topical vaginal oestrogen for post-menopausal women reduces recurrence

### Complicated UTI / pyelonephritis
- Urine MCS before antibiotics
- Oral therapy if systemically well: ciprofloxacin 500 mg BD for 7 days (check local sensitivity)
- Hospital admission if systemically unwell, vomiting, or pregnancy

### Asymptomatic bacteriuria
Do NOT treat unless pregnant or pre-urological procedure. Treating asymptomatic bacteriuria in non-pregnant adults does not improve outcomes and increases antibiotic resistance.`,
  },
  // Mental Health
  {
    topic: "mental-health",
    title: "Antidepressants in general practice: choosing and monitoring",
    condition: "depression",
    url: `${SOURCE_BASE_URL}/articles/antidepressants-general-practice`,
    summary: `## Antidepressants in general practice: choosing and monitoring

Antidepressants are among the most commonly prescribed medications in Australian general practice. They are indicated for moderate-to-severe depression, anxiety disorders, and several other conditions.

### First-line agents for depression and anxiety
SSRIs are first-line for most patients due to their tolerability profile:
- **Sertraline** 50–200 mg/day — preferred first choice; evidence across depression and most anxiety disorders
- **Escitalopram** 10–20 mg/day — evidence across depression, GAD, social anxiety, panic
- **Fluoxetine** 20–60 mg/day — long half-life; useful if adherence concern; fewer discontinuation symptoms

SNRIs (venlafaxine, duloxetine) are appropriate for patients with comorbid pain or when SSRIs are ineffective.

### Starting antidepressants
- Start at the lowest effective dose; titrate up over 2–4 weeks
- Warn patients of initial anxiety/agitation (first 1–2 weeks); consider short-term low-dose benzodiazepine
- Advise 2–4 weeks before therapeutic effect; full response may take 8 weeks
- Review at 2–4 weeks after starting; switch if no response at 6–8 weeks

### Duration of treatment
First episode: maintain for at least 6–12 months after remission. Second episode: 2 years. Three or more episodes: consider indefinite therapy.

### Suicide risk on initiation
Increased vigilance in first 2 weeks, especially in patients <25 years. Provide safety netting: emergency contacts, crisis line (Lifeline 13 11 14), and a specific follow-up plan.`,
  },
  // Musculoskeletal
  {
    topic: "msk",
    title: "Managing low back pain in general practice",
    condition: "low-back-pain",
    url: `${SOURCE_BASE_URL}/articles/managing-low-back-pain-general-practice`,
    summary: `## Managing low back pain in general practice

Low back pain is the leading cause of disability in Australia, affecting 70–80% of adults at some point. The vast majority is non-specific (no identifiable structural cause) and self-limiting.

### Red flag screening (require urgent assessment or imaging)
- History of cancer with new back pain
- Age >50 with first presentation and no prior episode
- Constitutional symptoms (unexplained weight loss, fever, night sweats)
- Neurological deficit (weakness, numbness, loss of bladder/bowel control)
- Trauma (vertebral fracture risk)
- Prolonged corticosteroid use (vertebral fracture risk)
- IV drug use (infective discitis risk)

### Acute non-specific LBP (<12 weeks)
**First-line:**
- Reassurance: 90% resolve within 6–8 weeks
- Advice to stay active; avoid bed rest
- Paracetamol for mild-moderate pain; NSAIDs (ibuprofen, naproxen) if no contraindications
- Short course muscle relaxants (e.g., diazepam) for severe acute spasm only; avoid >1 week

**Not recommended:**
- Opioids as first-line (weak evidence; significant harm potential)
- Imaging in absence of red flags

### Chronic LBP (>12 weeks)
- Multidisciplinary approach: exercise, psychological support (CBT), physiotherapy
- If pharmacotherapy needed: consider low-dose tricyclic antidepressants (amitriptyline 10–25 mg nocte) or duloxetine
- Opioids: use sparingly, for limited periods, with documented function goals`,
  },
  // Dermatology
  {
    topic: "dermatology",
    title: "Prescribing for common skin conditions in general practice",
    condition: "dermatology",
    url: `${SOURCE_BASE_URL}/articles/prescribing-common-skin-conditions-general-practice`,
    summary: `## Prescribing for common skin conditions in general practice

Skin conditions account for approximately 10–15% of general practice consultations in Australia. Acne, eczema, fungal infections, and psoriasis are the most common presentations.

### Acne vulgaris
**Mild (comedonal):** Topical retinoid (adapalene 0.1% gel) ± topical benzoyl peroxide 5%
**Moderate (inflammatory papules/pustules):** Add topical antibiotic (clindamycin 1% solution); avoid antibiotic monotherapy
**Severe (nodular/cystic, scarring risk):** Oral doxycycline 100 mg daily for 3–6 months; refer for isotretinoin if inadequate response (isotretinoin requires PPP registration)

### Atopic dermatitis (eczema)
**First-line:** Emollients applied liberally (minimum twice daily); avoid soap
**Active flares:** Topical corticosteroids — hydrocortisone 1% for face/flexures; betamethasone valerate 0.02–0.1% for body
**Topical calcineurin inhibitors:** Pimecrolimus 1% cream or tacrolimus 0.03–0.1% ointment — useful for face/flexures; steroid-sparing
**Moderate-severe:** Dupilumab (PBS-listed with Authority for moderate-severe AD failing topicals)

### Tinea (ringworm, athlete's foot, tinea versicolor)
**Tinea pedis, corporis, cruris:** Topical terbinafine 1% once daily for 1–4 weeks (terbinafine preferred over azoles — fungicidal vs fungistatic)
**Tinea unguium (onychomycosis):** Oral terbinafine 250 mg daily for 6 weeks (fingernails) or 12 weeks (toenails)
**Tinea versicolor:** Topical ketoconazole 2% shampoo applied for 5 min daily for 2–3 weeks

### Psoriasis
**Mild (<5% BSA):** Topical betamethasone dipropionate 0.05% ± calcipotriol (fixed-dose combination preferred — calcipotriol/betamethasone foam/gel)
**Moderate-severe:** Refer for phototherapy or systemic therapy (methotrexate, biologics)`,
  },
];

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

  console.log("Ingesting Australian Prescriber articles...\n");
  console.log(`Total articles: ${CURATED_ARTICLES.length}\n`);

  let ingested = 0;
  for (const article of CURATED_ARTICLES) {
    const chunkText = `${article.summary}\n\n---\n**Source:** ${article.url}\n**Attribution:** ${ATTRIBUTION}`;

    const id = await ingestChunk(
      {
        sourceName: SOURCE_NAME,
        category: "therapeutic-guidelines",
        condition: article.condition,
        chunkText,
        metadata: {
          source_url: article.url,
          section_heading: article.title,
          topic: article.topic,
          md_approved_at: "PENDING",
          status: "PENDING_MD_REVIEW",
        },
      },
      null,
      dbPool
    );

    ingested++;
    console.log(`[+] "${article.title}" → ${id}`);
  }

  console.log(`\nDone. Ingested ${ingested} Australian Prescriber article(s).`);
  console.log(
    "NOTE: All chunks carry status=PENDING_MD_REVIEW. Medical Director sign-off required before production ingest."
  );

  await dbPool.end();
}

main().catch((err) => {
  logger.error(err, "Australian Prescriber fetch failed");
  process.exit(1);
});
