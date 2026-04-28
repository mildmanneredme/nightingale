-- Backfill presenting_complaint from the first patient turn in stored transcripts.
-- The new-consultation flow was changed to collect the complaint during the voice/text
-- session rather than upfront. Existing rows that completed before the runtime backfill
-- was deployed have NULL presenting_complaint but a non-empty transcript JSON array.
UPDATE consultations
SET presenting_complaint = (
  SELECT elem->>'text'
  FROM   jsonb_array_elements(transcript) AS elem
  WHERE  elem->>'speaker' = 'patient'
  ORDER BY (elem->>'timestamp_ms')::bigint
  LIMIT  1
)
WHERE presenting_complaint IS NULL
  AND  transcript IS NOT NULL
  AND  jsonb_typeof(transcript) = 'array'
  AND  jsonb_array_length(transcript) > 0;
