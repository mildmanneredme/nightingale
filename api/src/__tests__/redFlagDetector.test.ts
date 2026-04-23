import { detectRedFlag } from "../services/redFlagDetector";

describe("detectRedFlag", () => {
  // --- should trigger ---

  it("triggers on chest pain combined with shortness of breath", () => {
    const result = detectRedFlag("I have chest pain and I can't breathe properly");
    expect(result.triggered).toBe(true);
  });

  it("triggers on chest pain combined with difficulty breathing", () => {
    const result = detectRedFlag("severe chest pain, difficulty breathing for 10 mins");
    expect(result.triggered).toBe(true);
    if (result.triggered) expect(result.phrase).toMatch(/chest pain/i);
  });

  it("triggers on thunderclap headache", () => {
    const result = detectRedFlag("sudden thunderclap headache, worst of my life");
    expect(result.triggered).toBe(true);
  });

  it("triggers on sudden severe headache", () => {
    const result = detectRedFlag("I got the worst headache of my life suddenly");
    expect(result.triggered).toBe(true);
  });

  it("triggers on stroke symptom: face drooping", () => {
    const result = detectRedFlag("my face is drooping and my arm feels weak");
    expect(result.triggered).toBe(true);
  });

  it("triggers on stroke symptom: arm weakness with slurred speech", () => {
    const result = detectRedFlag("arm weakness and slurred speech started 20 minutes ago");
    expect(result.triggered).toBe(true);
  });

  it("triggers on anaphylaxis: throat swelling", () => {
    const result = detectRedFlag("my throat is swelling up after eating peanuts");
    expect(result.triggered).toBe(true);
  });

  it("triggers on uncontrolled bleeding", () => {
    const result = detectRedFlag("I have uncontrolled bleeding from a deep cut");
    expect(result.triggered).toBe(true);
  });

  it("triggers on loss of consciousness", () => {
    const result = detectRedFlag("they lost consciousness for about a minute");
    expect(result.triggered).toBe(true);
  });

  it("triggers on passed out", () => {
    const result = detectRedFlag("I passed out earlier today");
    expect(result.triggered).toBe(true);
  });

  it("triggers on suicidal ideation: want to kill myself", () => {
    const result = detectRedFlag("I want to kill myself");
    expect(result.triggered).toBe(true);
  });

  it("triggers on suicidal ideation: end my life", () => {
    const result = detectRedFlag("I've been thinking about ending my life");
    expect(result.triggered).toBe(true);
  });

  it("triggers on suicidal ideation: don't want to live", () => {
    const result = detectRedFlag("I don't want to live anymore");
    expect(result.triggered).toBe(true);
  });

  it("is case-insensitive", () => {
    const result = detectRedFlag("CHEST PAIN AND SHORTNESS OF BREATH");
    expect(result.triggered).toBe(true);
  });

  // --- should NOT trigger ---

  it("does not trigger on mild chest tightness without breathing issue", () => {
    const result = detectRedFlag("I have a bit of chest tightness after exercise");
    expect(result.triggered).toBe(false);
  });

  it("does not trigger on normal headache", () => {
    const result = detectRedFlag("I have a headache that started this morning");
    expect(result.triggered).toBe(false);
  });

  it("does not trigger on mild back pain", () => {
    const result = detectRedFlag("lower back pain for the past 3 days");
    expect(result.triggered).toBe(false);
  });

  it("does not trigger on routine symptom description", () => {
    const result = detectRedFlag("sore throat, runny nose, mild fever since yesterday");
    expect(result.triggered).toBe(false);
  });

  it("returns triggered:false with no phrase on safe input", () => {
    const result = detectRedFlag("feeling a bit tired lately");
    expect(result).toEqual({ triggered: false });
  });
});
