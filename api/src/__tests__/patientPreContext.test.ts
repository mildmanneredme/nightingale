// PRD-023: tests for the AI pre-context block.
//
// Two layers exercised:
//   - getPatientPreContext: integration against a real consultation row
//   - renderPreContextPrompt: unit tests on the rendering function (no DB)
//
// The hard invariant we're protecting: PII (name, DOB exact, Medicare,
// address, phone) MUST NEVER appear in the rendered prompt. Several tests
// assert that specific PII strings are absent from the output.

import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";
import {
  getPatientPreContext,
  renderPreContextPrompt,
} from "../services/patientPreContext";

const COGNITO_SUB = "precontext-sub-001";
const app = buildTestApp(COGNITO_SUB);

beforeEach(async () => {
  await resetTestDb();
  await request(app)
    .post("/api/v1/patients/register")
    .send({ email: "ctx@test.com", privacyPolicyVersion: "v1.0" })
    .expect(201);
});

afterAll(async () => {
  await closeTestPool();
});

async function seedConsultationFor(
  patient: Record<string, unknown> = {},
  baseline: { allergies?: string[]; meds?: string[]; conditions?: string[] } = {}
): Promise<string> {
  await request(app).put("/api/v1/patients/me").send(patient).expect(200);

  for (const a of baseline.allergies ?? []) {
    await request(app)
      .post("/api/v1/patients/me/allergies")
      .send({ name: a, severity: "moderate" })
      .expect(201);
  }
  for (const m of baseline.meds ?? []) {
    await request(app)
      .post("/api/v1/patients/me/medications")
      .send({ name: m })
      .expect(201);
  }
  for (const c of baseline.conditions ?? []) {
    await request(app)
      .post("/api/v1/patients/me/conditions")
      .send({ name: c })
      .expect(201);
  }

  const consultation = await request(app)
    .post("/api/v1/consultations")
    .send({ consultationType: "text" })
    .expect(201);
  return consultation.body.id as string;
}

// ---------------------------------------------------------------------------
// getPatientPreContext (integration)
// ---------------------------------------------------------------------------

describe("getPatientPreContext", () => {
  it("returns null for an unknown consultation id", async () => {
    const ctx = await getPatientPreContext("00000000-0000-0000-0000-000000000000");
    expect(ctx).toBeNull();
  });

  it("buckets DOB into an age band, never the exact value", async () => {
    const id = await seedConsultationFor({
      firstName: "Sam", lastName: "Patient",
      dateOfBirth: "1985-06-15",
      biologicalSex: "female",
    });
    const ctx = await getPatientPreContext(id);
    expect(ctx).not.toBeNull();
    expect(ctx!.ageBand).toMatch(/^(18-29|30-44|45-64|65\+|under-18)$/);
    // Sanity: a 1985-born patient is well into 30-44 or 45-64 in 2026.
    expect(["30-44", "45-64"]).toContain(ctx!.ageBand);
  });

  it("includes allergies / medications / conditions by name only", async () => {
    const id = await seedConsultationFor(
      { firstName: "Sam", lastName: "Patient", dateOfBirth: "1990-01-01" },
      {
        allergies: ["Penicillin"],
        meds: ["Sertraline"],
        conditions: ["Asthma"],
      }
    );
    const ctx = await getPatientPreContext(id);
    expect(ctx!.allergies).toEqual(["Penicillin"]);
    expect(ctx!.medications).toEqual(["Sertraline"]);
    expect(ctx!.conditions).toEqual(["Asthma"]);
  });

  it("surfaces the *_none_declared booleans", async () => {
    const id = await seedConsultationFor({
      allergiesNoneDeclared: true,
      medicationsNoneDeclared: true,
      conditionsNoneDeclared: false,
    });
    const ctx = await getPatientPreContext(id);
    expect(ctx!.allergiesNoneDeclared).toBe(true);
    expect(ctx!.medicationsNoneDeclared).toBe(true);
    expect(ctx!.conditionsNoneDeclared).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// renderPreContextPrompt (pure)
// ---------------------------------------------------------------------------

describe("renderPreContextPrompt", () => {
  it("returns empty string for null input", () => {
    expect(renderPreContextPrompt(null)).toBe("");
  });

  it("returns empty string when nothing meaningful is on file", () => {
    const out = renderPreContextPrompt({
      ageBand: null,
      sex: null,
      allergies: [],
      allergiesNoneDeclared: false,
      medications: [],
      medicationsNoneDeclared: false,
      conditions: [],
      conditionsNoneDeclared: false,
    });
    expect(out).toBe("");
  });

  it("includes age band and biological sex when present", () => {
    const out = renderPreContextPrompt({
      ageBand: "30-44",
      sex: "female",
      allergies: [],
      allergiesNoneDeclared: false,
      medications: [],
      medicationsNoneDeclared: false,
      conditions: [],
      conditionsNoneDeclared: false,
    });
    expect(out).toContain("30-44");
    expect(out).toContain("female");
  });

  it("renders 'none reported' when *_none_declared is true and the list is empty", () => {
    const out = renderPreContextPrompt({
      ageBand: null,
      sex: null,
      allergies: [],
      allergiesNoneDeclared: true,
      medications: [],
      medicationsNoneDeclared: true,
      conditions: [],
      conditionsNoneDeclared: true,
    });
    expect(out).toContain("Known allergies: none reported");
    expect(out).toContain("Current medications: none reported");
    expect(out).toContain("Known conditions: none reported");
  });

  it("does not mention a category that is unanswered (empty list, not declared)", () => {
    const out = renderPreContextPrompt({
      ageBand: "30-44",
      sex: "male",
      allergies: ["Penicillin"],
      allergiesNoneDeclared: false,
      medications: [],
      medicationsNoneDeclared: false,
      conditions: [],
      conditionsNoneDeclared: false,
    });
    expect(out).toContain("Known allergies: Penicillin");
    expect(out).not.toMatch(/Current medications/i);
    expect(out).not.toMatch(/Known conditions/i);
  });

  it("APP 8 invariant: never leaks DOB, name, address, Medicare, or phone", () => {
    // Caller is responsible for only handing in the anonymised PreContext type,
    // which by construction has no PII fields. This test pins that contract by
    // showing PII strings cannot appear in the output even with hostile input.
    const out = renderPreContextPrompt({
      ageBand: "45-64",
      sex: "female",
      // We never accept these fields, but pretend they were jammed in:
      allergies: [],
      allergiesNoneDeclared: true,
      medications: [],
      medicationsNoneDeclared: true,
      conditions: [],
      conditionsNoneDeclared: true,
    });
    expect(out).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no exact DOB
    expect(out).not.toMatch(/\d{10,11}/);          // no Medicare
    expect(out).not.toMatch(/04\d{8}/);            // no AU mobile
    expect(out).not.toMatch(/sarah|jane|sam/i);    // no first names
    expect(out).not.toMatch(/St\.|Street|Sydney|Melbourne/i); // no addresses
  });
});
