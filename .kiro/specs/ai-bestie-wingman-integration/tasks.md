# Implementation Plan: AI Bestie & AI Wingman Integration

## Overview

This implementation plan breaks down the AI Bestie and AI Wingman integration into 9 phases:
1. **Foundation & Infrastructure** - Database setup, migrations, RLS policies
2. **Core Services** - Backend logic for profile management, AI orchestration, loop prevention
3. **API Endpoints** - RESTful endpoints for all assistant operations
4. **UI Components** - Frontend components for activation, indicators, response options
5. **Chat Integration** - Message routing, session state, visual indicators
6. **Configuration Pages** - User management, profile editing, version history
7. **Auto-Update & Insights** - Profile auto-updates, hourly summaries
8. **Testing & Validation** - Unit tests, integration tests, property-based tests
9. **Deployment & Monitoring** - Environment setup, migrations, production deployment

Each task builds incrementally on previous tasks. Property-based tests validate correctness properties defined in the design document.

---

## Phase 1: Foundation & Infrastructure

- [x] 1. Set up Supabase tables and migrations
  - Create `ai_assistant_profiles` table with version history tracking
  - Create `ai_assistant_conversations` table for storing conversation history
  - Create `ai_assistant_summaries` table for hourly summaries
  - Create `ai_assistant_configs` table for storing assistant settings
  - Add appropriate indexes for query performance
  - _Requirements: 1.1, 1.2, 8.1, 12.1_

- [x] 2. Configure Row-Level Security (RLS) policies
  - Enable RLS on all new tables
  - Create policy: users can only access their own profiles
  - Create policy: users can only access their own conversations
  - Create policy: users can only access their own summaries
  - Test policies with multiple user accounts
  - _Requirements: 15.1, 15.4_

- [x] 3. Create database indexes for performance
  - Index on `ai_assistant_profiles(user_id, profile_type)`
  - Index on `ai_assistant_conversations(user_id, is_active)`
  - Index on `ai_assistant_summaries(user_id, created_at DESC)`
  - Index on `ai_assistant_configs(user_id, assistant_type)`
  - Verify indexes are used in query plans
  - _Requirements: 12.1_

- [x] 4. Set up environment variables
  - Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` to `.env.local`
  - Add `ANTHROPIC_API_KEY` (already exists)
  - Add `VOYAGE_API_KEY` (already exists)
  - Document all required environment variables in `.env.example`
  - _Requirements: 1.1, 1.2_

---

## Phase 2: Core Services

- [x] 5. Implement Profile Service
  - Create `src/lib/server/profile-service.ts`
  - Implement `loadPreferences(userId)` - load from Supabase with caching
  - Implement `loadPersonality(userId)` - load from Supabase with caching
  - Implement `updatePreferences(userId, updates, reason)` - with version history
  - Implement `updatePersonality(userId, updates, reason)` - with version history
  - Implement `getPreferencesHistory(userId)` - retrieve version history
  - Implement `getPersonalityHistory(userId)` - retrieve version history
  - Implement `restoreProfileVersion(userId, versionId)` - restore previous version
  - _Requirements: 3.2, 4.2, 8.1, 12.1, 12.2_

- [x] 6. Implement AI Assistant Service
  - Create `src/lib/server/ai-assistant-service.ts`
  - Implement `generateResponse()` - call Claude with system prompt
  - Implement `generateResponseOptions()` - generate 2-3 response options
  - Implement `analyzeMatchCompatibility()` - assess green/yellow/red flags
  - Implement `autoUpdateProfile()` - extract insights from conversation
  - Handle citations extraction from Claude responses
  - _Requirements: 3.1, 3.2, 4.1, 4.2, 5.1, 5.2_

- [x] 7. Implement AI Assistant Manager
  - Create `src/lib/server/ai-assistant-manager.ts`
  - Implement `activateAssistant()` - initialize session, load context
  - Implement `deactivateAssistant()` - cleanup session
  - Implement `isAssistantActive()` - check active status
  - Implement `getAssistantConfig()` - retrieve configuration
  - Implement `updateAssistantConfig()` - update settings
  - Coordinate with Profile Service and Loop Prevention
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 20.1_

- [x] 8. Implement AI Loop Prevention Module
  - Create `src/lib/server/ai-loop-prevention.ts`
  - Implement `canContinue()` - check if conversation can continue
  - Implement `recordExchange()` - increment exchange counter
  - Implement `getExchangeCount()` - retrieve current counts
  - Implement `resetExchangeCounter()` - reset when user takes over
  - Implement `areBothAssistantsActive()` - check both active
  - Enforce max 10 exchanges per side when both active
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 9. Extend system prompt builders
  - Update `src/lib/prompts.ts` with `buildAIBestieSystemPrompt()`
  - Update `src/lib/prompts.ts` with `buildAIWingmanSystemPrompt()`
  - Include preferences.md/personality.md context in prompts
  - Include matched user profile context
  - Include book context from vector store
  - _Requirements: 17.1, 17.2, 18.1, 18.2_

---

## Phase 3: API Endpoints

- [x] 10. Create AI Bestie activation endpoint
  - Create `POST /api/ai-bestie/activate`
  - Load female user's preferences.md
  - Load matched user's profile
  - Initialize conversation session
  - Return confirmation message
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 11. Create AI Bestie message endpoint
  - Create `POST /api/ai-bestie/send-message`
  - Accept user message and conversation history
  - Call AI Assistant Service to generate response
  - Save message and response to Supabase
  - Return response with citations
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 12. Create AI Bestie compatibility analysis endpoint
  - Create `POST /api/ai-bestie/analyze-match`
  - Accept match message and conversation context
  - Call AI Assistant Service to analyze compatibility
  - Return green/yellow/red flags with reasoning
  - Save analysis to conversation history
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 13. Create AI Bestie summary endpoint
  - Create `POST /api/ai-bestie/get-summary`
  - Retrieve hourly summaries for all matches
  - Return key insights, flags, recommended next moves
  - Include conversation momentum indicator
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 14. Create AI Bestie deactivation endpoint
  - Create `POST /api/ai-bestie/deactivate`
  - Deactivate assistant for match
  - Clear cached profile data
  - Return confirmation message
  - _Requirements: 20.1, 20.2, 20.3_

- [x] 15. Create AI Wingman activation endpoint
  - Create `POST /api/ai-wingman/activate`
  - Load male user's personality.md
  - Load matched user's profile
  - Initialize conversation session
  - Return confirmation message
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 16. Create AI Wingman message endpoint
  - Create `POST /api/ai-wingman/send-message`
  - Accept user message and conversation history
  - Call AI Assistant Service to generate response
  - Save message and response to Supabase
  - Return response with citations
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 17. Create AI Wingman impersonation endpoint
  - Create `POST /api/ai-wingman/enable-impersonation`
  - Check if 20+ messages from match
  - Enable impersonation mode in config
  - Return confirmation message
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 18. Create AI Wingman deactivation endpoint
  - Create `POST /api/ai-wingman/deactivate`
  - Deactivate assistant for match
  - Clear cached profile data
  - Return confirmation message
  - _Requirements: 20.1, 20.2, 20.3_

- [x] 19. Create preferences management endpoints
  - Create `GET /api/preferences` - retrieve user's preferences.md
  - Create `POST /api/preferences` - update preferences with version history
  - Include reason for update
  - Return updated version number
  - _Requirements: 8.1, 12.1_

- [x] 20. Create personality management endpoints
  - Create `GET /api/personality` - retrieve user's personality.md
  - Create `POST /api/personality` - update personality with version history
  - Include reason for update
  - Return updated version number
  - _Requirements: 8.1, 12.1_

- [x] 21. Create loop prevention check endpoint
  - Create `POST /api/ai-loop-prevention/check`
  - Check if conversation can continue
  - Return exchange counts and warnings
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 22. Add error handling and validation to all endpoints
  - Validate request parameters
  - Handle missing profile data gracefully
  - Return appropriate HTTP status codes
  - Log errors for debugging
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

---

## Phase 4: UI Components

- [x] 23. Create AI Assistant Controls component
  - Create `src/lib/components/AIAssistantControls.svelte`
  - Display "Activate AI Bestie" / "Activate AI Wingman" toggle
  - Show active status with badge
  - Include configuration button
  - Include deactivate option in dropdown
  - Responsive layout (mobile: stacked, desktop: inline)
  - _Requirements: 1.1, 2.1, 9.1, 9.2, 9.3, 9.4, 14.1, 14.2_

- [x] 24. Create Assistant Badge component
  - Create `src/lib/components/AssistantBadge.svelte`
  - Display "AI Bestie" or "AI Wingman" label
  - Color coding (pink for Bestie, blue for Wingman)
  - Include icon (heart for Bestie, shield for Wingman)
  - Show tooltip with status and exchange count
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 25. Update Chat Message component
  - Update `src/lib/components/ChatMessage.svelte`
  - Add support for `assistantType` field
  - Distinguish AI messages from user messages
  - Show assistant type badge on AI messages
  - Different styling for Bestie vs Wingman
  - Show citations inline or expandable
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 26. Create Response Options component
  - Create `src/lib/components/ResponseOptions.svelte`
  - Display 2-3 response options as cards
  - Show tone, message, and reasoning
  - Include "Copy to clipboard" button
  - Allow user to edit before sending
  - Mobile: scrollable horizontal list
  - Desktop: grid layout
  - _Requirements: 3.7, 4.7, 6.2, 6.3, 6.4_

- [x] 27. Create Compatibility Flags component
  - Create `src/lib/components/CompatibilityFlags.svelte`
  - Display green/yellow/red flags with icons
  - Show reasoning for each flag
  - Color coding (green, yellow, red)
  - Expandable details
  - Show citations for each flag
  - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [x] 28. Create Summary Bubble component
  - Create `src/lib/components/SummaryBubble.svelte`
  - Display hourly summaries of all matches
  - Show key insights for each match
  - Show green/yellow/red flags summary
  - Show recommended next moves
  - Show conversation momentum indicator
  - Mobile: compact card layout
  - Desktop: expandable panel
  - _Requirements: 7.1, 7.2, 7.3, 14.1, 14.2_

---

## Phase 5: Chat Integration

- [x] 29. Update chat page to show activation buttons
  - Update `src/routes/chat/+page.svelte`
  - Add AI Assistant Controls component
  - Show appropriate button based on user gender
  - Display active status indicator
  - _Requirements: 1.1, 2.1, 13.1, 13.2, 13.3, 13.4_

- [x] 30. Implement message router logic
  - Create `src/lib/server/message-router.ts`
  - Determine if message is user message or AI activation
  - Route to appropriate handler (AI Bestie, AI Wingman, or regular chat)
  - Manage session state
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [x] 31. Integrate with existing chat infrastructure
  - Update `src/routes/api/chat/+server.ts` to support AI assistants
  - Use same ChatMessage type with `assistantType` field
  - Use same Claude API client
  - Use same Supabase client
  - Follow same error handling patterns
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 32. Handle session state management
  - Track active assistant per match
  - Load conversation history on page load
  - Persist session state across page refreshes
  - Handle switching between assistants
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 33. Add visual indicators for active assistants
  - Show badge in chat header when assistant active
  - Update message styling based on assistant type
  - Show exchange count in indicator
  - Update indicators when assistant activated/deactivated
  - _Requirements: 1.7, 2.7, 9.1, 9.2, 9.3, 9.4, 9.5_

---

## Phase 6: Configuration Pages

- [x] 34. Create AI Assistant Configuration page
  - Create `src/routes/ai-assistant-config/+page.svelte`
  - Display enable/disable toggles for Bestie and Wingman
  - Show current configuration settings
  - _Requirements: 1.1, 2.1, 13.1, 13.2_

- [x] 35. Create Preferences Editor component
  - Create `src/lib/components/PreferencesEditor.svelte`
  - Display and edit preferences.md fields
  - Show emotional signals, lifestyle signals, boundaries, dealbreakers
  - Include save button with version tracking
  - Show last updated timestamp
  - _Requirements: 8.1, 12.1, 12.2_

- [x] 36. Create Personality Editor component
  - Create `src/lib/components/PersonalityEditor.svelte`
  - Display and edit personality.md fields
  - Show communication style, personality vibe, values, patterns
  - Include save button with version tracking
  - Show last updated timestamp
  - _Requirements: 8.1, 12.1, 12.2_

- [x] 37. Create Version History component
  - Create `src/lib/components/VersionHistory.svelte`
  - Display version history for preferences.md and personality.md
  - Show version number, timestamp, and reason for update
  - Include restore button for each version
  - Confirm before restoring
  - _Requirements: 8.1, 12.1, 12.2_

- [x] 38. Create Privacy Settings component
  - Create `src/lib/components/PrivacySettings.svelte`
  - Display privacy notice on first activation
  - Show data usage explanation
  - Include option to delete conversation history
  - Include option to delete all AI assistant data
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 39. Create Setup Wizard for new users
  - Create `src/lib/components/AIAssistantSetupWizard.svelte`
  - Step 1: Privacy notice and consent
  - Step 2: Profile data import or creation
  - Step 3: Preferences/Personality setup
  - Step 4: Confirmation and activation
  - _Requirements: 1.1, 2.1, 15.1, 15.2_

---

## Phase 7: Auto-Update & Insights

- [x] 40. Implement profile auto-update mechanism
  - Create `src/lib/server/profile-auto-updater.ts`
  - Extract insights from user messages
  - Extract insights from match messages
  - Update preferences.md or personality.md with new insights
  - Track reason for update (e.g., "Extracted from conversation")
  - _Requirements: 3.1, 4.1, 7.1, 7.2_

- [x] 41. Implement insight extraction from conversations
  - Analyze user messages for personality signals
  - Analyze match messages for compatibility signals
  - Extract emotional signals, lifestyle signals, values
  - Extract red flags and dealbreakers
  - Use Claude to generate insights
  - _Requirements: 3.1, 4.1, 5.1, 5.2_

- [x] 42. Implement hourly summary generation
  - Create scheduled job to run every hour
  - Aggregate insights from all active conversations
  - Generate match summaries with key insights
  - Generate recommended next moves
  - Store summaries in Supabase
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 43. Implement version history tracking
  - Track all profile updates with version numbers
  - Store reason for each update
  - Store timestamp for each update
  - Allow restoration to previous versions
  - _Requirements: 8.1, 12.1, 12.2_

---

## Phase 8: Testing & Validation

- [x] 44. Write unit tests for Profile Service
  - Test `loadPreferences()` returns correct data
  - Test `loadPersonality()` returns correct data
  - Test `updatePreferences()` creates new version
  - Test `updatePersonality()` creates new version
  - Test `getPreferencesHistory()` returns all versions
  - Test `getPersonalityHistory()` returns all versions
  - Test `restoreProfileVersion()` restores correct version
  - _Requirements: 8.1, 12.1, 12.2_

- [x] 45. Write unit tests for AI Assistant Service
  - Test `generateResponse()` returns valid response
  - Test `generateResponseOptions()` returns 2-3 options
  - Test `analyzeMatchCompatibility()` identifies flags
  - Test `autoUpdateProfile()` extracts insights
  - Test citation extraction from Claude responses
  - _Requirements: 3.1, 3.2, 4.1, 4.2, 5.1, 5.2_

- [x] 46. Write unit tests for AI Loop Prevention
  - Test `canContinue()` returns true when under limit
  - Test `canContinue()` returns false when at limit
  - Test `recordExchange()` increments counter
  - Test `resetExchangeCounter()` resets to zero
  - Test `areBothAssistantsActive()` detects both active
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 47. Write integration tests for API endpoints
  - Test AI Bestie activation flow
  - Test AI Wingman activation flow
  - Test message sending and response generation
  - Test compatibility analysis
  - Test profile updates
  - Test error handling
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 48. Write property-based tests for correctness properties
  - **Property 1: Session Idempotence** - Creating session twice returns same ID
  - **Property 2: Round-trip Consistency** - Save message → retrieve → verify content matches
  - **Property 3: Flag Consistency** - Analyzing same match response produces same flags
  - **Property 4: History Ordering** - Version history is in correct chronological order
  - **Property 5: Exchange Counter Invariant** - Exchange count never exceeds limit
  - **Property 6: Profile Version Uniqueness** - Each version has unique version number
  - **Property 7: Citation Presence** - All responses include citations
  - **Property 8: Message Ordering** - Messages retrieved in same order as saved
  - **Property 9: Preference Immutability** - Previous versions never change
  - **Property 10: Deactivation Cleanup** - Deactivation clears all session data
  - _Requirements: 3.1, 4.1, 5.1, 8.1, 11.1_

- [x] 49. Test error handling and edge cases
  - Test Claude API failure handling
  - Test Supabase database failure handling
  - Test missing profile data handling
  - Test rate limiting behavior
  - Test mobile responsiveness
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 50. Test mobile responsiveness
  - Test activation controls on mobile
  - Test response options display on mobile
  - Test compatibility flags on mobile
  - Test summary bubble on mobile
  - Test message scrolling on mobile
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

---

## Phase 9: Deployment & Monitoring

- [x] 51. Set up environment variables for production
  - Configure `SUPABASE_URL` for production
  - Configure `SUPABASE_SERVICE_KEY` for production
  - Configure `ANTHROPIC_API_KEY` for production
  - Verify all required variables are set
  - _Requirements: 1.1, 1.2_

- [x] 52. Run database migrations
  - Execute Supabase migration for new tables
  - Verify all tables created successfully
  - Verify all indexes created successfully
  - Verify RLS policies applied correctly
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 53. Deploy to staging environment
  - Deploy code to staging
  - Run smoke tests
  - Verify all endpoints working
  - Verify database connectivity
  - _Requirements: 1.1, 1.2_

- [x] 54. Test in staging environment
  - Test AI Bestie activation and messaging
  - Test AI Wingman activation and messaging
  - Test profile updates and version history
  - Test error handling
  - Test rate limiting
  - _Requirements: 1.1, 1.2, 3.1, 4.1, 5.1_

- [x] 55. Deploy to production
  - Deploy code to production
  - Run smoke tests
  - Verify all endpoints working
  - Monitor error rates
  - _Requirements: 1.1, 1.2_

- [x] 56. Set up monitoring and logging
  - Configure error logging for Claude API calls
  - Configure error logging for Supabase operations
  - Set up alerts for high error rates
  - Monitor API response times
  - Monitor database query performance
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 57. Checkpoint - Ensure all tests pass
  - Run full test suite
  - Verify all unit tests pass
  - Verify all integration tests pass
  - Verify all property-based tests pass
  - Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property-based tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All components must be mobile-responsive
- Reuse existing Claude API client, Supabase connection, and ChatMessage type
- Follow existing code patterns and conventions
- All new code should include TypeScript types
- All API endpoints should include error handling and validation

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["5.1", "6.1", "7.1", "8.1", "9.1"] },
    { "id": 2, "tasks": ["10.1", "11.1", "12.1", "13.1", "14.1", "15.1", "16.1", "17.1", "18.1", "19.1", "20.1", "21.1", "22.1"] },
    { "id": 3, "tasks": ["23.1", "24.1", "25.1", "26.1", "27.1", "28.1"] },
    { "id": 4, "tasks": ["29.1", "30.1", "31.1", "32.1", "33.1"] },
    { "id": 5, "tasks": ["34.1", "35.1", "36.1", "37.1", "38.1", "39.1"] },
    { "id": 6, "tasks": ["40.1", "41.1", "42.1", "43.1"] },
    { "id": 7, "tasks": ["44.1", "45.1", "46.1", "47.1", "48.1", "49.1", "50.1"] },
    { "id": 8, "tasks": ["51.1", "52.1", "53.1", "54.1", "55.1", "56.1"] }
  ]
}
```
