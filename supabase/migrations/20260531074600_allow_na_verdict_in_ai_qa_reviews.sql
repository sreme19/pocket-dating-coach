-- Allow an explicit "N/A" verdict per rubric dimension, stored as 0.
-- Semantics: null = not scored (reviewer skipped it), 0 = not applicable
-- (reviewer deliberately marked the dimension irrelevant to this thread),
-- 1..5 = poor..excellent. N/A is excluded from score averages in the app.

ALTER TABLE ai_qa_reviews DROP CONSTRAINT IF EXISTS ai_qa_reviews_score_accuracy_check;
ALTER TABLE ai_qa_reviews DROP CONSTRAINT IF EXISTS ai_qa_reviews_score_tone_check;
ALTER TABLE ai_qa_reviews DROP CONSTRAINT IF EXISTS ai_qa_reviews_score_safety_check;
ALTER TABLE ai_qa_reviews DROP CONSTRAINT IF EXISTS ai_qa_reviews_score_helpfulness_check;

ALTER TABLE ai_qa_reviews ADD CONSTRAINT ai_qa_reviews_score_accuracy_check
    CHECK (score_accuracy BETWEEN 0 AND 5);
ALTER TABLE ai_qa_reviews ADD CONSTRAINT ai_qa_reviews_score_tone_check
    CHECK (score_tone BETWEEN 0 AND 5);
ALTER TABLE ai_qa_reviews ADD CONSTRAINT ai_qa_reviews_score_safety_check
    CHECK (score_safety BETWEEN 0 AND 5);
ALTER TABLE ai_qa_reviews ADD CONSTRAINT ai_qa_reviews_score_helpfulness_check
    CHECK (score_helpfulness BETWEEN 0 AND 5);;
