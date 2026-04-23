---
source: AHPRA Guidelines for Advertising Regulated Health Services
source_url: https://www.ahpra.gov.au/Publications/Advertising-resources/Advertising-guidelines.aspx
version: 2023
category: regulatory
md_approved_at: PENDING — awaiting Medical Director and AHPRA advertising compliance reviewer sign-off
status: PLACEHOLDER — must be reviewed by legal/compliance team before production use
---

# AHPRA Advertising Guidelines — Summary for AI System Compliance

## Background

The Health Practitioner Regulation National Law (National Law) prohibits certain types of advertising of regulated health services in Australia. AHPRA administers these requirements on behalf of National Boards. Non-compliance can result in fines and regulatory action against the practitioner and/or the business.

## Key prohibitions (section 133 of the National Law)

Advertising of a regulated health service must NOT:

1. **Be false, misleading, or deceptive** — including by omission
2. **Offer a gift, discount, or other inducement** without stating the terms and conditions
3. **Use testimonials or reviews** — patient testimonials about clinical care are prohibited
4. **Create unreasonable expectations** of beneficial treatment
5. **Directly or indirectly discourage** the use of other health services

## Prohibited language patterns

The following language patterns are prohibited in patient-facing AI outputs:

- Claiming diagnostic certainty ("You have [condition]")
- Promising specific outcomes ("This treatment will cure...")
- Using comparative language implying superiority ("better than your GP")
- Claiming to replace in-person medical care
- Using fear-based language to pressure care-seeking decisions
- Any language that could be construed as a testimonial

## Required language standards for Nightingale AI outputs

All patient-facing AI outputs must:

- Use hedged clinical language: "may be consistent with", "may indicate", "your GP will assess"
- Include standard disclaimer: "This advice is not a substitute for in-person medical care"
- Reference emergency services using Australian standard: "Call 000 or go to your nearest emergency department"
- Attribute all clinical information to its source (RACGP, NPS MedicineWise, etc.)
- Not make claims about the AI system's diagnostic capability

## Consent and transparency

Patients must be informed that:
- They are interacting with an AI-assisted service
- All clinical outputs are reviewed and approved by a registered GP before being provided to the patient
- The GP is the responsible clinician, not the AI system

## Implementation in Nightingale

The AHPRA constraints documented in `system-prompts/base-constraints.md` are derived from these guidelines and are included in every system prompt. These constraints must NOT be removed or overridden by condition-specific prompts.

---
*PLACEHOLDER — This document is a summary interpretation pending review by a qualified healthcare regulatory compliance advisor and the Medical Director. It does not constitute legal advice.*
