-- Drop the old restrictive constraint
ALTER TABLE verified_vibe_verification
DROP CONSTRAINT IF EXISTS verified_vibe_verification_step_check;

-- Replace with a constraint that allows proof_* values
ALTER TABLE verified_vibe_verification
ADD CONSTRAINT verified_vibe_verification_step_check
CHECK (step IN ('id', 'liveness', 'photos', 'spending_or_qa')
       OR step LIKE 'proof_%');;
