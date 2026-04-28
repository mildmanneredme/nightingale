# PRD-029 — Voice Agent Auto-Disconnect & Real-Time Session Notes

**Status:** Shipped 2026-04-28  
**Sprint:** 10  
**Priority:** P1 — clinical UX quality; reduces abandoned sessions and gives patients visibility of captured information

---

## Problem

1. **Call never ends automatically.** The Gemini Live voice agent gathered all clinical information but stayed on the line indefinitely, relying on the patient to click "End Call." Patients were confused about when the interview was complete, leading to awkward silences, repeated information, or premature hang-ups.

2. **No visibility into what was captured.** Patients had no feedback on what the AI had noted during the session. The transcript bubbles showed raw conversation but gave no sense of what clinical information the system had recorded.

---

## Solution

### F-029-A: AI-Driven Auto-Disconnect

The voice agent system prompt now instructs the AI to say a specific completion phrase verbatim once all key clinical areas have been covered (typically 5–8 patient turns):

> *"I now have all the information needed to prepare your case for the doctor's review. Thank you for sharing that with me. Your doctor will be in touch soon."*

The server monitors the AI's output transcription for the trigger substring `"I now have all the information needed"`. When detected, it schedules `doEnd()` after a 3.5-second grace period (enough for the audio to finish playing on the client), then sends the standard `ended` message and redirects the patient to the photo upload step.

Key clinical areas the AI must cover before concluding:
- Presenting complaint
- Symptom duration
- Severity (1–10 scale)
- Associated symptoms
- Relevant medical history
- Current medications
- Allergies

### F-029-B: Real-Time Session Notes Panel

After each finalized patient utterance, the server runs lightweight pattern extraction to identify:

| Field | Detection method |
|-------|-----------------|
| Symptoms | Keyword match against 32 common GP-presentation terms |
| Duration | Regex: "for X days/weeks/months", "since yesterday", "X ago" |
| Severity | Regex: "X/10", "X out of 10", severity adjective (severe/moderate/mild/etc.) |
| Medications | Regex: "I take/am on/am taking/use X" |
| Allergies | Regex: "allergic to/allergy to/reaction to/can't take X" |
| Conditions | Regex: "I have/had/suffer from/was diagnosed with X" |

Extracted notes are sent to the browser via a new `session_notes` WebSocket message type. The voice page renders a collapsible "Notes captured" panel (navy background, teal accents) that:
- Appears automatically on first note captured
- Shows each category with a Material Symbol icon and colour-coded chips
- Can be collapsed/expanded by the patient

---

## Technical Changes

### `api/src/types/ws-messages.ts`
- Added `SessionNotes` interface export
- Added `{ type: "session_notes"; notes: SessionNotes }` to `WsServerMessage` union

### `web/src/types/ws-messages.ts`
- Mirrored above (both files kept in sync — not a shared package)

### `api/src/services/geminiLive.ts`
- Added `COMPLETION_TRIGGER` constant and system prompt completion instructions
- Added `extractNotesFromTurn()` pure function (regex-based, no LLM cost)
- Added `sessionNotes` instance field (accumulated across patient turns)
- `addTranscriptTurn()` now: (a) runs note extraction on patient turns and emits `session_notes`, (b) checks AI turns for the completion trigger and schedules auto-disconnect

### `web/src/lib/consultation-ws.ts`
- Added `onSessionNotes` callback to `ConsultationSocketCallbacks`
- Re-exports `SessionNotes` type for use in pages
- Handles `session_notes` case in the `onmessage` switch

### `web/src/app/(patient)/consultation/[id]/voice/page.tsx`
- Added `sessionNotes` and `notesExpanded` state
- Wires `onSessionNotes` callback — auto-expands panel on first note
- Renders collapsible `NoteRow` panel with icons and chips per category

---

## Acceptance Criteria

- [x] AI ends the call autonomously after gathering sufficient information (typically 5–8 exchanges)
- [x] 3.5s grace period ensures audio finishes before disconnect
- [x] Patient is redirected to the photo upload step on auto-disconnect (same path as manual end)
- [x] Session notes panel appears dynamically during the call as information is mentioned
- [x] Notes panel is collapsible and does not obstruct the transcript
- [x] Red flag escalation is unaffected — still fires immediately, bypassing completion trigger
- [x] TypeScript strict mode — both API and web pass `npm run typecheck`

---

## Known Constraints

- Note extraction is heuristic regex, not LLM-based. It may miss unusual phrasing. False positives (e.g., "I have a headache" matching "conditions") are possible but low-risk — the doctor always reviews.
- The completion trigger requires the AI to say the exact phrase. If Gemini paraphrases, auto-disconnect will not fire and the session will continue (patient can still end manually). No clinical safety risk.
- Session notes are not persisted to the database — they are UI-only feedback during the call. The full transcript is what the clinical AI engine processes.
