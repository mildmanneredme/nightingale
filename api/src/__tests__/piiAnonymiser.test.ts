// PRD-012: PII Anonymiser unit tests
// These run without a database or API — pure unit tests on regex logic.
// The isPiiClean() automated assertion is the key safety gate per PRD F-004.

import {
  anonymiseText,
  anonymiseTranscript,
  isPiiClean,
  buildAnonymisedPatientContext,
} from "../services/piiAnonymiser";

describe("anonymiseText", () => {
  it("strips a 10-digit Medicare number", () => {
    const result = anonymiseText("My Medicare number is 2123456701.");
    expect(result).not.toMatch(/2123456701/);
    expect(result).toContain("[MEDICARE]");
  });

  it("strips a Medicare number with spaces", () => {
    const result = anonymiseText("Medicare: 2123 45670 1");
    expect(result).not.toMatch(/2123/);
    expect(result).toContain("[MEDICARE]");
  });

  it("strips an Australian mobile phone number", () => {
    const result = anonymiseText("Call me on 0412 345 678 anytime.");
    expect(result).not.toMatch(/0412/);
    expect(result).toContain("[PHONE]");
  });

  it("strips an email address", () => {
    const result = anonymiseText("Email me at patient@example.com for results.");
    expect(result).not.toMatch(/patient@example\.com/);
    expect(result).toContain("[EMAIL]");
  });

  it("strips a date of birth in DD/MM/YYYY format", () => {
    const result = anonymiseText("DOB: 15/03/1985");
    expect(result).not.toMatch(/15\/03\/1985/);
    expect(result).toContain("[DOB]");
  });

  it("strips a salutation-prefixed name", () => {
    const result = anonymiseText("Mr John Smith presented today.");
    expect(result).not.toMatch(/John Smith/);
    expect(result).toContain("[PATIENT_NAME]");
  });

  it("leaves non-PII clinical text untouched", () => {
    const text = "Patient reports sore throat for 3 days with mild fever.";
    expect(anonymiseText(text)).toBe(text);
  });

  it("handles empty string gracefully", () => {
    expect(anonymiseText("")).toBe("");
  });
});

describe("anonymiseTranscript", () => {
  it("anonymises PII across multiple turns", async () => {
    const turns = [
      { speaker: "ai" as const, text: "What is your date of birth?" },
      { speaker: "patient" as const, text: "I was born on 15/03/1985 and my Medicare is 2123456701." },
      { speaker: "ai" as const, text: "Thank you. Any allergies?" },
    ];
    const result = await anonymiseTranscript(turns);
    expect(result).not.toMatch(/15\/03\/1985/);
    expect(result).not.toMatch(/2123456701/);
    expect(result).toContain("[DOB]");
    expect(result).toContain("[MEDICARE]");
  });

  it("preserves clinical content", async () => {
    const turns = [
      { speaker: "patient" as const, text: "I have a rash on my left arm for 2 days." },
    ];
    const result = await anonymiseTranscript(turns);
    expect(result).toContain("rash on my left arm");
  });
});

describe("isPiiClean", () => {
  it("returns clean for text with no PII", () => {
    const { clean, violations } = isPiiClean("Patient reports sore throat, no fever.");
    expect(clean).toBe(true);
    expect(violations).toHaveLength(0);
  });

  it("detects Medicare number as a violation", () => {
    const { clean, violations } = isPiiClean("Medicare 2123456701 was provided.");
    expect(clean).toBe(false);
    expect(violations.length).toBeGreaterThan(0);
  });

  it("detects email as a violation", () => {
    const { clean } = isPiiClean("Contact: patient@example.com");
    expect(clean).toBe(false);
  });

  it("detects phone number as a violation", () => {
    const { clean } = isPiiClean("Call 0412 345 678");
    expect(clean).toBe(false);
  });

  it("passes on already-anonymised transcript text", () => {
    const anonymised = anonymiseText(
      "My Medicare is 2123456701, email me at test@test.com, phone 0412345678."
    );
    const { clean } = isPiiClean(anonymised);
    expect(clean).toBe(true);
  });
});

describe("buildAnonymisedPatientContext", () => {
  it("converts exact DOB to an age range", () => {
    const context = buildAnonymisedPatientContext({ dateOfBirth: "1985-03-15" });
    expect(context).not.toMatch(/1985/);
    expect(context).toMatch(/Age range: \d+–\d+ years/);
  });

  it("includes biological sex without PII", () => {
    const context = buildAnonymisedPatientContext({ biologicalSex: "female" });
    expect(context).toContain("Biological sex: female");
  });

  it("lists allergies with severity", () => {
    const context = buildAnonymisedPatientContext({
      allergies: [{ name: "penicillin", severity: "severe" }],
    });
    expect(context).toContain("penicillin (severe)");
  });

  it("reports 'none recorded' for empty medication list", () => {
    const context = buildAnonymisedPatientContext({ medications: [] });
    expect(context).toContain("none recorded");
  });

  it("never includes a raw date of birth in output", () => {
    const context = buildAnonymisedPatientContext({ dateOfBirth: "1990-07-22" });
    expect(context).not.toMatch(/1990-07-22/);
    expect(context).not.toMatch(/22\/07\/1990/);
  });
});
