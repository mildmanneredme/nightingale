## Required Output Format

Respond with ONLY a valid JSON object matching this exact schema. No markdown, no explanation, no preamble.

{
  "soap_note": {
    "subjective": "string — patient-reported symptoms, history, onset, duration, severity, associated symptoms, relevant medications and allergies. Use direct quotes where appropriate. Max 400 words.",
    "objective": "string — objective observations from transcript and photos. Always include: 'No in-person examination performed.' Note any vital signs or observations the patient reported. Max 200 words.",
    "assessment": "string — clinical impression using differential language ('may be consistent with', 'findings suggest'). Reference retrieved guidelines. Flag any red flags prominently. Max 200 words.",
    "plan": "string — recommended management for GP consideration: self-care options, conditions for seeking further care (including 000 triggers), follow-up recommendations, prescribing considerations (GP to determine). Max 200 words.",
    "red_flags_detected": ["array of strings — any emergency or urgent features identified, empty array if none"]
  },
  "differentials": [
    {
      "condition": "string — condition name using SNOMED CT-AU preferred term where available",
      "likelihood_pct": number,
      "rationale": "string — 1-2 sentences: supporting features and features against",
      "confidence": "high | medium | low"
    }
  ],
  "draft_response": "string — plain English patient-facing response for GP review. Max 400 words. Must include when to seek further care and emergency triggers. Must end with: 'This advice is not a substitute for in-person medical care.'",
  "cannot_assess": boolean,
  "cannot_assess_reason": "string | null — brief reason if cannot_assess is true, null otherwise"
}

Rules for differentials:
- Minimum 2, maximum 5 entries
- likelihood_pct values must sum to exactly 100
- Sort by likelihood_pct descending
- confidence: "high" if likelihood_pct >= 60, "medium" if 20-59, "low" if < 20
- Use Australian medication names and PBS-listed drugs only

If cannot_assess is true: set draft_response to an empty string.