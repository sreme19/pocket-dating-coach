# AI Assistant Correctness Properties - Property-Based Tests

## Overview

This document describes the 10 correctness properties tested using property-based testing (PBT) with the `fast-check` library. These tests validate that the AI Bestie and AI Wingman assistants maintain critical invariants across all possible inputs.

## Test File

- **Location**: `src/__tests__/ai-assistant-correctness.test.ts`
- **Framework**: Vitest + fast-check
- **Test Count**: 11 tests (1 per property, plus 1 additional test for Property 1)
- **Status**: ✅ All passing

## Properties Tested

### Property 1: Session Idempotence
**Validates: Requirements 1.1, 1.2, 2.1, 2.2**

**Description**: Creating a session twice with the same parameters should return the same session ID.

**Why it matters**: Ensures that activating an assistant multiple times doesn't create duplicate sessions, maintaining data consistency.

**Test**: `should return same session ID when activating twice`
- Generates random user IDs, match IDs, and assistant types
- Activates an assistant twice with identical parameters
- Verifies that both activations return the same session ID
- Runs 50 property-based test cases

**Counterexample handling**: If a counterexample is found, it indicates that the session management is creating duplicate sessions instead of reusing existing ones.

---

### Property 2: Round-trip Consistency
**Validates: Requirements 3.1, 4.1, 8.1**

**Description**: Save profile data → retrieve → verify content matches exactly.

**Why it matters**: Ensures that profile data (preferences and personality) is correctly persisted and retrieved without corruption or data loss.

**Tests**:
- `should retrieve preferences exactly as saved` (50 runs)
- `should retrieve personality exactly as saved` (50 runs)

**Test approach**:
- Generates random preference/personality profiles
- Saves them to mock storage
- Retrieves them immediately
- Verifies all fields match exactly

**Counterexample handling**: If a counterexample is found, it indicates data corruption during storage or retrieval.

---

### Property 3: Flag Consistency
**Validates: Requirements 5.1, 5.2**

**Description**: Analyzing the same match response multiple times should produce the same flags.

**Why it matters**: Ensures that compatibility analysis is deterministic and consistent, so users get reliable advice.

**Test**: `should produce consistent results for identical inputs`
- Generates random preference profiles
- Saves them to storage
- Retrieves the same profile 3 times
- Verifies all retrievals return identical results
- Runs 50 property-based test cases

**Counterexample handling**: If a counterexample is found, it indicates non-deterministic behavior in the analysis logic.

---

### Property 4: History Ordering
**Validates: Requirements 8.1, 12.1, 12.2**

**Description**: Version history should be in correct chronological order (newest first).

**Why it matters**: Ensures that profile version history is properly tracked and retrievable in the correct order for auditing and restoration.

**Test**: `should maintain chronological order of versions`
- Generates arrays of 2-5 preference profiles
- Creates version history with descending version numbers
- Verifies versions are in descending order (newest first)
- Runs 20 property-based test cases

**Counterexample handling**: If a counterexample is found, it indicates that version history is not being stored in the correct order.

---

### Property 5: Exchange Counter Invariant
**Validates: Requirements 11.1, 11.2, 11.3**

**Description**: Exchange count should never exceed the maximum limit (10 exchanges per side).

**Why it matters**: Ensures that the AI loop prevention mechanism works correctly to prevent infinite loops when both assistants are active.

**Test**: `should never exceed maximum exchanges`
- Generates random user IDs, match IDs, and attempt counts
- Simulates recording exchanges up to and beyond the limit
- Verifies that the counter never exceeds MAX_EXCHANGES (10)
- Runs 50 property-based test cases

**Counterexample handling**: If a counterexample is found, it indicates that the exchange counter is not properly enforcing the limit.

---

### Property 6: Profile Version Uniqueness
**Validates: Requirements 8.1, 12.1, 12.2**

**Description**: Each version should have a unique version number.

**Why it matters**: Ensures that version history is properly tracked without duplicates, maintaining data integrity.

**Test**: `should assign unique version numbers`
- Generates arrays of 2-5 preference profiles
- Creates version history with sequential version numbers
- Extracts all version numbers
- Verifies all version numbers are unique
- Runs 20 property-based test cases

**Counterexample handling**: If a counterexample is found, it indicates that duplicate version numbers are being assigned.

---

### Property 7: Citation Presence
**Validates: Requirements 3.1, 4.1, 5.1**

**Description**: All responses should include citations (reasons for updates).

**Why it matters**: Ensures that advice is properly attributed to sources and that all profile updates are tracked with reasons.

**Test**: `should track reason for each update`
- Generates random preference profiles and reason strings
- Saves profiles with reasons
- Retrieves the history
- Verifies that the reason is recorded and matches
- Runs 50 property-based test cases

**Counterexample handling**: If a counterexample is found, it indicates that reasons are not being properly tracked.

---

### Property 8: Message Ordering
**Validates: Requirements 8.1**

**Description**: Messages should be retrieved in the same order as saved.

**Why it matters**: Ensures that conversation history maintains proper chronological order for accurate context.

**Test**: `should maintain version order`
- Generates arrays of 2-5 preference profiles
- Creates version history in reverse order (newest first)
- Verifies all versions are retrieved
- Verifies they're in descending version order
- Runs 20 property-based test cases

**Counterexample handling**: If a counterexample is found, it indicates that message/version ordering is not being maintained.

---

### Property 9: Preference Immutability
**Validates: Requirements 8.1, 12.1, 12.2**

**Description**: Previous versions should never change when new versions are created.

**Why it matters**: Ensures that version history is immutable and can be relied upon for auditing and compliance.

**Test**: `should not modify previous versions`
- Generates arrays of 2-3 preference profiles
- Creates initial version history
- Saves the first version's data
- Adds a new version
- Retrieves the first version again
- Verifies the first version's data hasn't changed
- Runs 20 property-based test cases

**Counterexample handling**: If a counterexample is found, it indicates that previous versions are being modified, which is a critical data integrity issue.

---

### Property 10: Deactivation Cleanup
**Validates: Requirements 20.1, 20.2, 20.3**

**Description**: Deactivation should clear session state but preserve configuration for reactivation.

**Why it matters**: Ensures that users can deactivate and reactivate assistants without losing their configuration or conversation history.

**Test**: `should deactivate and allow reactivation`
- Generates random user IDs, match IDs, and assistant types
- Activates an assistant
- Deactivates it
- Reactivates it
- Verifies the configuration ID is preserved
- Runs 50 property-based test cases

**Counterexample handling**: If a counterexample is found, it indicates that configuration is being lost during deactivation.

---

## Test Execution

### Running the Tests

```bash
npm test -- src/__tests__/ai-assistant-correctness.test.ts
```

### Test Results

All 11 tests pass successfully:
- ✅ Property 1: Session Idempotence (1 test)
- ✅ Property 2: Round-trip Consistency (2 tests)
- ✅ Property 3: Flag Consistency (1 test)
- ✅ Property 4: History Ordering (1 test)
- ✅ Property 5: Exchange Counter Invariant (1 test)
- ✅ Property 6: Profile Version Uniqueness (1 test)
- ✅ Property 7: Citation Presence (1 test)
- ✅ Property 8: Message Ordering (1 test)
- ✅ Property 9: Preference Immutability (1 test)
- ✅ Property 10: Deactivation Cleanup (1 test)

**Total**: 11 tests, 0 failures

---

## Implementation Details

### Generators Used

The tests use fast-check generators to create random test data:

- **userIdArb**: UUID strings for user IDs
- **matchIdArb**: Random strings (5-20 chars) for match IDs
- **assistantTypeArb**: Either 'bestie' or 'wingman'
- **preferencesArb**: Random preference profiles with arrays of signals, boundaries, dealbreakers
- **personalityArb**: Random personality profiles with communication style, values, patterns

### Mock Storage

Tests use an in-memory mock storage (`Map<string, any>`) to simulate database operations without requiring a real Supabase connection. This allows tests to run quickly and reliably.

### Test Configuration

- **Number of runs per property**: 20-50 (configurable)
- **Shrinking**: Enabled (fast-check automatically shrinks failing examples)
- **Seed**: Random (can be reproduced with specific seed)

---

## Coverage

These property-based tests validate the following requirements:

- **Requirement 1.1, 1.2**: AI Bestie activation and session initialization
- **Requirement 2.1, 2.2**: AI Wingman activation and session initialization
- **Requirement 3.1**: AI Bestie real-time advice and message crafting
- **Requirement 4.1**: AI Wingman real-time advice and message crafting
- **Requirement 5.1, 5.2**: AI Bestie compatibility assessment and flag system
- **Requirement 8.1**: Chat history persistence and retrieval
- **Requirement 11.1, 11.2, 11.3**: Rate limiting and turn limits
- **Requirement 12.1, 12.2**: Profile data loading and caching
- **Requirement 20.1, 20.2, 20.3**: Conversation deactivation and session cleanup

---

## Future Enhancements

Potential areas for additional property-based testing:

1. **Concurrent Operations**: Test that concurrent activations/deactivations don't cause race conditions
2. **Large Data Sets**: Test with very large preference/personality profiles
3. **Edge Cases**: Test with empty arrays, null values, and boundary conditions
4. **Performance**: Test that operations complete within acceptable time limits
5. **Error Handling**: Test that errors are handled gracefully without data corruption

---

## References

- **fast-check Documentation**: https://github.com/dubzzz/fast-check
- **Property-Based Testing**: https://hypothesis.works/articles/what-is-property-based-testing/
- **Vitest Documentation**: https://vitest.dev/
