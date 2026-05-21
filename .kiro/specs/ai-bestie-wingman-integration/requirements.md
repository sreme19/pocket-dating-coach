# Requirements Document: AI Bestie & AI Wingman Integration

## Introduction

This document specifies the integration of two specialized AI dating assistants into the Pocket Dating Coach application:

- **AI Bestie**: An AI assistant that impersonates female users in real-time conversations with male matches, providing compatibility assessments and strategic advice grounded in the female user's preferences. This AI Bestie will also have another role, wherever in it summarizes the important parts of the all the matches recieved by a female. 
- **AI Wingman**: An AI assistant that provides strategic dating advice to male users, grounded in their personality profile and the "Art of Dating for Indian Men" book content. There can be one more mode where this AI assistant can also impersonate male user. BUT this feature will only be given to a male user, after they have spent sufficient time speaking to the female match. 

Both assistants extend the existing "Ask Your Coach" feature by providing context-aware, real-time guidance during active dating conversations. They integrate with the existing Claude API client, Supabase database, and chat message infrastructure.

---

## Glossary

- **AI Bestie**: An AI assistant for female users that impersonates them in conversations with matches, providing real-time advice and compatibility signals. Also provides summarized insights across all matches.
- **AI Wingman**: An AI assistant for male users that provides strategic dating advice during conversations with matches. Can also impersonate the male user after 20+ messages from the match.
- **Assistant Type**: The classification of an AI assistant (either "bestie" or "wingman").
- **Conversation Session**: A unique chat session between a user and an AI assistant, tied to a specific match conversation. One thread per match only.
- **Compatibility Signal**: A visual indicator (✅ green flag, ⚠️ yellow flag, 🚩 red flag) that assesses match compatibility based on their responses.
- **Match Context**: Information about the matched user (profile, recent messages, relationship goal).
- **Preferences.md**: A markdown file containing a female user's dating preferences, boundaries, and compatibility criteria. Created during onboarding or imported from Dating Assistant repo. Updated automatically based on user messages.
- **Personality.md**: A markdown file containing a male user's psychographic profile, values, and dating patterns. Created during onboarding or imported from Dating Assistant repo. Updated automatically based on user messages.
- **System Prompt**: The Claude API system message that defines the assistant's role, knowledge base, and behavior rules.
- **Turn Limit**: The maximum number of consecutive turns an AI assistant can take in a conversation before requiring user confirmation.
- **Citation**: A reference to the "Art of Dating for Indian Men" book chapter or section that informed a piece of advice.
- **User Profile**: The stored profile data for a user (gender, age range, dating app, relationship goal, communication style, etc.).
- **Supabase**: The PostgreSQL database and backend service used for storing chat history and user data.
- **Claude API**: The Anthropic API used for generating AI responses.
- **AI Loop Prevention**: A safeguard that stops conversations when both male and female users are using AI assistants to prevent infinite loops (max 10 exchanges per side).

---

## Requirements

### Requirement 1: AI Bestie Activation and Session Initialization

**User Story:** As a female user, I want to activate AI Bestie during a conversation with a match, so that I can get real-time advice and have the assistant help me craft responses.

#### Acceptance Criteria

1. WHEN a female user is viewing a conversation with a match on the chat page, THE Chat_Interface SHALL display an "Activate AI Bestie" button or toggle in the message section.
2. WHEN the female user clicks "Activate AI Bestie", THE System SHALL create a new AI assistant conversation session in Supabase with assistant_type = "bestie". Correction - doesn't need to be new conversation session, rather the AI assistant becomes part of the existing conversation and female user will sit back. The female user can be brough back in later by AI Bestie or the user brings themselves back in by toggling the AI off 
3. WHEN a conversation session is created, THE System SHALL load the female user's preferences.md file from `/static/female_profiles/{profile_id}/preferences.md`.
4. WHEN a conversation session is created, THE System SHALL load the matched user's profile data (gender, age range, dating app, relationship goal) from the user profile stored in localStorage or Supabase.
5. WHEN a conversation session is created, THE System SHALL initialize the conversation with an empty messages array in Supabase.
6. WHEN a conversation session is created, THE System SHALL display a confirmation message to the user: "AI Bestie activated. I'll help you navigate this conversation with strategic advice and compatibility insights."
7. WHEN AI Bestie is activated, THE Chat_Interface SHALL display a visual indicator (e.g., a badge or header change) showing that AI Bestie is active for this conversation.

---

### Requirement 2: AI Wingman Activation and Session Initialization

**User Story:** As a male user, I want to activate AI Wingman during a conversation with a match, so that I can get strategic dating advice grounded in my personality and the book's principles.

#### Acceptance Criteria

1. WHEN a male user is viewing a conversation with a match on the chat page, THE Chat_Interface SHALL display an "Activate AI Wingman" button or toggle in the message section.
2. WHEN the male user clicks "Activate AI Wingman", THE System SHALL create a new AI assistant conversation session in Supabase with assistant_type = "wingman".
3. WHEN a conversation session is created, THE System SHALL load the male user's personality.md file from `/static/male_profiles/{profile_id}/personality.md`.
4. WHEN a conversation session is created, THE System SHALL load the matched user's profile data (gender, age range, dating app, relationship goal) from the user profile stored in localStorage or Supabase.
5. WHEN a conversation session is created, THE System SHALL initialize the conversation with an empty messages array in Supabase.
6. WHEN a conversation session is created, THE System SHALL display a confirmation message to the user: "AI Wingman activated. I'll help you craft authentic responses and navigate this conversation strategically."
7. WHEN AI Wingman is activated, THE Chat_Interface SHALL display a visual indicator (e.g., a badge or header change) showing that AI Wingman is active for this conversation.

---

### Requirement 3: AI Bestie Real-Time Advice and Message Crafting

**User Story:** As a female user with AI Bestie active, I want to ask for advice on how to respond to a match's message, so that I can craft responses that are authentic, strategic, and aligned with my preferences.

#### Acceptance Criteria

1. WHEN AI Bestie is active and the user sends a message to the assistant, THE System SHALL include the user's message in the conversation history.
2. WHEN the user sends a message to AI Bestie, THE System SHALL pass the following context to Claude:
   - The female user's preferences.md content
   - The matched user's profile data (gender, age range, dating app, relationship goal)
   - The recent messages from the match (last 5-10 messages)
   - The user's message/question
3. WHEN Claude generates a response, THE System SHALL use the buildAIBestieSystemPrompt function to generate the system prompt.
4. WHEN Claude generates a response, THE Response SHALL include:
   - Specific, actionable advice on how to respond
   - Reasoning grounded in the user's preferences and the book's principles
   - A citation in the format: *Based on: [chapter or section name]*
5. WHEN the user receives advice, THE Chat_Interface SHALL display the assistant's response in the conversation thread.
6. WHEN the user receives advice, THE System SHALL save the user's message and the assistant's response to the Supabase ai_assistant_conversations table.
7. WHEN the user receives advice, THE Chat_Interface SHALL provide a "Copy Response" button so the user can easily copy the suggested message to send to the match.

---

### Requirement 4: AI Wingman Real-Time Advice and Message Crafting

**User Story:** As a male user with AI Wingman active, I want to ask for advice on how to respond to a match's message, so that I can craft authentic responses grounded in my personality and the book's principles.

#### Acceptance Criteria

1. WHEN AI Wingman is active and the user sends a message to the assistant, THE System SHALL include the user's message in the conversation history.
2. WHEN the user sends a message to AI Wingman, THE System SHALL pass the following context to Claude:
   - The male user's personality.md content
   - The matched user's profile data (gender, age range, dating app, relationship goal)
   - The recent messages from the match (last 5-10 messages)
   - The user's message/question
3. WHEN Claude generates a response, THE System SHALL use the buildAIWingmanSystemPrompt function to generate the system prompt.
4. WHEN Claude generates a response, THE Response SHALL include:
   - Specific, actionable advice on how to respond
   - Reasoning grounded in the user's personality and the book's principles
   - A citation in the format: *Based on: [chapter or section name]*
5. WHEN the user receives advice, THE Chat_Interface SHALL display the assistant's response in the conversation thread.
6. WHEN the user receives advice, THE System SHALL save the user's message and the assistant's response to the Supabase ai_assistant_conversations table.
7. WHEN the user receives advice, THE Chat_Interface SHALL provide a "Copy Response" button so the user can easily copy the suggested message to send to the match.

---

### Requirement 5: AI Bestie Compatibility Assessment and Flag System

**User Story:** As a female user with AI Bestie active, I want to see compatibility signals (green/yellow/red flags) based on the match's responses, so that I can quickly assess whether this person aligns with my preferences.

#### Acceptance Criteria

1. WHEN the user asks AI Bestie to analyze a match's message or behavior, THE System SHALL evaluate the match's response against the user's preferences.md criteria.
2. WHEN AI Bestie evaluates a match, THE Response SHALL include:
   - ✅ Green flags: Behaviors or statements that align with the user's non-negotiables and strong preferences
   - ⚠️ Yellow flags: Behaviors or statements that are neutral or require further clarification
   - 🚩 Red flags: Behaviors or statements that conflict with the user's boundaries or dealbreakers
3. WHEN AI Bestie identifies flags, THE Response SHALL explain each flag with specific reasoning tied to the user's preferences.
4. WHEN AI Bestie identifies flags, THE Response SHALL include a citation: *Based on: [preference category from preferences.md]*
5. WHEN the user receives flag analysis, THE Chat_Interface SHALL display the flags with visual indicators (✅, ⚠️, 🚩) and color coding (green, yellow, red).
6. WHEN the user receives flag analysis, THE System SHALL save the flag assessment to the Supabase ai_assistant_conversations table as part of the message history.

---

### Requirement 6: AI Bestie Impersonation Mode (Optional Feature)

**User Story:** As a female user with AI Bestie active, I want the option to have AI Bestie draft a response message that I can review and send, so that I can maintain authenticity while getting strategic guidance.

#### Acceptance Criteria

1. WHERE the user requests "Draft a response" or similar, THE AI_Bestie SHALL generate 2-3 response options in JSON format with:
   - The suggested message text
   - The tone (playful, warm, direct, flirty, etc.)
   - Why this response works strategically
   - A citation to the book or the user's preferences
2. WHEN AI Bestie generates response options, THE Chat_Interface SHALL display them as selectable cards or buttons.
3. WHEN the user selects a response option, THE System SHALL copy the message text to the user's input field.
4. WHEN the user selects a response option, THE System SHALL allow the user to edit the message before sending it to the match.
5. WHEN the user sends a message (whether drafted by AI Bestie or edited), THE System SHALL NOT automatically send it to the match; the user must manually send it through the dating app.

---

### Requirement 7: AI Wingman Strategic Advice and Personality Grounding

**User Story:** As a male user with AI Wingman active, I want advice that is grounded in my personality profile and the book's principles, so that my responses feel authentic and strategic.

#### Acceptance Criteria

1. WHEN the user asks AI Wingman for advice, THE System SHALL reference the user's personality.md profile to understand his communication style, values, and dating patterns.
2. WHEN AI Wingman generates advice, THE Response SHALL:
   - Be grounded in the user's personality (not generic advice)
   - Reference specific sections of the "Art of Dating for Indian Men" book
   - Provide actionable next steps
   - Include a citation: *Based on: [book chapter or section]*
3. WHEN the user receives advice, THE Chat_Interface SHALL display the response in the conversation thread.
4. WHEN the user receives advice, THE System SHALL save the user's message and the assistant's response to Supabase.
5. WHEN the user asks for response options, THE AI_Wingman SHALL generate 2-3 response options with:
   - The suggested message text
   - The tone (playful, warm, direct, etc.)
   - Why this response works given his personality
   - A citation to the book or his personality profile

---

### Requirement 8: Chat History Persistence and Retrieval

**User Story:** As a user with an active AI assistant session, I want my conversation history to be saved and retrievable, so that I can continue conversations across sessions and review past advice.

#### Acceptance Criteria

1. WHEN a user sends a message to AI Bestie or AI Wingman, THE System SHALL save the message to the Supabase ai_assistant_conversations table with:
   - conversation_id (unique identifier for this session)
   - user_id (the authenticated user's ID)
   - assistant_type ("bestie" or "wingman")
   - messages array (containing all messages in the conversation)
   - created_at (timestamp of session creation)
   - updated_at (timestamp of last update)
2. WHEN a user sends a message to an AI assistant, THE System SHALL append the new message to the existing messages array in Supabase.
3. WHEN a user returns to a conversation with an active AI assistant session, THE System SHALL retrieve the conversation history from Supabase and display it in the chat interface.
4. WHEN a user retrieves a conversation, THE Chat_Interface SHALL display all previous messages in chronological order.
5. WHEN a user retrieves a conversation, THE System SHALL load the user's profile data and preferences/personality files to provide context for new messages.

---

### Requirement 9: Visual Differentiation of AI Assistants

**User Story:** As a user, I want to visually distinguish between messages from AI Bestie, AI Wingman, and the regular "Ask Your Coach" assistant, so that I understand which assistant is providing advice.

#### Acceptance Criteria

1. WHEN AI Bestie is active and sends a message, THE Chat_Interface SHALL display the message with a distinct visual indicator (e.g., a "Bestie" badge, a specific color, or an icon).
2. WHEN AI Wingman is active and sends a message, THE Chat_Interface SHALL display the message with a distinct visual indicator (e.g., a "Wingman" badge, a specific color, or an icon).
3. WHEN the regular "Ask Your Coach" assistant sends a message, THE Chat_Interface SHALL display the message with its existing visual indicator.
4. WHEN a user is viewing a conversation, THE Chat_Interface SHALL clearly indicate which assistant is active (if any) in the header or a prominent location.
5. WHEN a user switches between assistants or deactivates an assistant, THE Chat_Interface SHALL update the visual indicators accordingly.

---

### Requirement 10: Error Handling and Fallback Behavior

**User Story:** As a user, I want the system to handle errors gracefully and provide fallback behavior, so that I can continue using the application even if an API call fails.

#### Acceptance Criteria

1. IF the Claude API returns an error, THE System SHALL display a user-friendly error message: "Sorry, I couldn't generate a response. Please try again."
2. IF the Claude API returns an error, THE System SHALL log the error to the console for debugging.
3. IF the Supabase database returns an error when saving a conversation, THE System SHALL display a warning message: "Your message wasn't saved. Please check your connection and try again."
4. IF the Supabase database returns an error when retrieving a conversation, THE System SHALL display an error message: "We couldn't load your conversation history. Please refresh the page."
5. IF the user's preferences.md or personality.md file cannot be loaded, THE System SHALL display a warning: "We couldn't load your profile data. Using default advice mode."
6. IF the user's preferences.md or personality.md file cannot be loaded, THE System SHALL fall back to the regular "Ask Your Coach" system prompt.
7. WHEN an error occurs, THE System SHALL NOT crash or become unresponsive; the user SHALL be able to continue using the application.

---

### Requirement 11: Rate Limiting and Turn Limits

**User Story:** As a system administrator, I want to implement rate limiting and turn limits, so that I can prevent abuse and manage API costs.

#### Acceptance Criteria

1. WHEN a user sends more than 10 messages to an AI assistant within 1 minute, THE System SHALL rate-limit the user and display: "You're sending messages too quickly. Please wait a moment before sending another."
2. WHEN a user has sent more than 50 messages to an AI assistant in a single conversation session, THE System SHALL display a warning: "You've had a long conversation with this assistant. Consider taking a break or starting a new session."
3. WHEN a user reaches 100 messages in a single conversation session, THE System SHALL require the user to confirm before sending the next message: "This conversation is getting long. Do you want to continue or start a new session?"
4. WHEN rate limiting is triggered, THE System SHALL log the event for monitoring and analysis.
5. WHEN rate limiting is triggered, THE System SHALL NOT prevent the user from using other features of the application.

---

### Requirement 12: Profile Data Loading and Caching

**User Story:** As a developer, I want the system to efficiently load and cache profile data (preferences.md and personality.md), so that the application performs well and reduces file I/O.

#### Acceptance Criteria

1. WHEN a user activates an AI assistant, THE System SHALL load the user's preferences.md or personality.md file from the static directory.
2. WHEN a profile file is loaded, THE System SHALL cache it in memory (or localStorage for client-side caching) for the duration of the session.
3. WHEN a user deactivates an AI assistant, THE System SHALL clear the cached profile data.
4. WHEN a user switches between different conversations, THE System SHALL load the appropriate profile data for each conversation.
5. IF a profile file is not found, THE System SHALL log an error and fall back to default behavior.

---

### Requirement 13: User Type Detection and Assistant Availability

**User Story:** As a user, I want the system to automatically determine my user type (male/female) and show me the appropriate AI assistant, so that I don't see irrelevant options.

#### Acceptance Criteria

1. WHEN a user loads the chat page, THE System SHALL retrieve the user's gender from the stored user profile (localStorage or Supabase).
2. IF the user's gender is "woman", THE Chat_Interface SHALL display the "Activate AI Bestie" button and hide the "Activate AI Wingman" button.
3. IF the user's gender is "man", THE Chat_Interface SHALL display the "Activate AI Wingman" button and hide the "Activate AI Bestie" button.
4. IF the user's gender is "prefer_not_to_say", THE Chat_Interface SHALL display both buttons and allow the user to choose.
5. WHEN a user selects an assistant, THE System SHALL validate that the selected assistant matches the user's gender (or allow override if gender is "prefer_not_to_say").

---

### Requirement 14: Mobile and Desktop Responsiveness

**User Story:** As a user on mobile or desktop, I want the AI assistant interface to be responsive and easy to use, so that I can access the assistants on any device.

#### Acceptance Criteria

1. WHEN a user accesses the chat page on a mobile device, THE Chat_Interface SHALL display the AI assistant buttons in a mobile-friendly layout (e.g., stacked vertically or in a compact menu).
2. WHEN a user accesses the chat page on a desktop device, THE Chat_Interface SHALL display the AI assistant buttons in a desktop-friendly layout (e.g., in a sidebar or header).
3. WHEN a user sends a message on mobile, THE Chat_Interface SHALL automatically scroll to the latest message.
4. WHEN a user sends a message on desktop, THE Chat_Interface SHALL automatically scroll to the latest message.
5. WHEN a user views response options on mobile, THE Chat_Interface SHALL display them in a scrollable list or carousel.
6. WHEN a user views response options on desktop, THE Chat_Interface SHALL display them as cards or buttons in a grid layout.

---

### Requirement 15: Data Privacy and User Consent

**User Story:** As a user, I want to understand how my data is being used by the AI assistants, so that I can make informed decisions about using these features.

#### Acceptance Criteria

1. WHEN a user activates an AI assistant for the first time, THE System SHALL display a privacy notice explaining:
   - What data is being sent to Claude (preferences/personality, match context, conversation history)
   - How the data is stored (Supabase database)
   - That the user can delete their conversation history at any time
2. WHEN a user activates an AI assistant, THE System SHALL require the user to acknowledge the privacy notice before proceeding.
3. WHEN a user deletes a conversation, THE System SHALL remove all messages from the Supabase ai_assistant_conversations table.
4. WHEN a user deletes their account, THE System SHALL delete all associated AI assistant conversations from Supabase.
5. WHEN a user's data is sent to Claude, THE System SHALL NOT include any personally identifiable information (PII) beyond what is necessary for the assistant to function (e.g., age range, dating app, relationship goal).

---

### Requirement 16: Integration with Existing Chat Infrastructure

**User Story:** As a developer, I want the AI assistants to integrate seamlessly with the existing chat infrastructure, so that I can minimize code duplication and maintain consistency.

#### Acceptance Criteria

1. WHEN an AI assistant sends a message, THE System SHALL use the same ChatMessage type as the existing "Ask Your Coach" feature.
2. WHEN an AI assistant sends a message, THE System SHALL use the same Claude API client (getClaudeClient) as the existing features.
3. WHEN an AI assistant sends a message, THE System SHALL use the same Supabase client as the existing features.
4. WHEN an AI assistant sends a message, THE System SHALL follow the same error handling patterns as the existing features.
5. WHEN an AI assistant sends a message, THE System SHALL follow the same citation format as the existing features (*Based on: [source]*).
6. WHEN an AI assistant is active, THE System SHALL NOT interfere with the existing "Ask Your Coach" feature; both can be used independently.

---

### Requirement 17: System Prompt Generation for AI Bestie

**User Story:** As a developer, I want the system to generate accurate system prompts for AI Bestie, so that the assistant behaves consistently and provides high-quality advice.

#### Acceptance Criteria

1. WHEN AI Bestie is activated, THE System SHALL call the buildAIBestieSystemPrompt function with:
   - The female user's profile (gender, age range, dating app, relationship goal)
   - The book context (relevant chapters from "Art of Dating for Indian Men")
   - The matched user's profile (optional: gender, age range, dating app, relationship goal)
2. WHEN buildAIBestieSystemPrompt is called, THE Function SHALL return a system prompt that:
   - Defines AI Bestie's role as a warm, supportive dating coach for women
   - Includes the book context
   - Includes the user's profile context
   - Includes the matched user's profile context (if provided)
   - Specifies the rules for behavior (grounding in book, citations, warmth, support, etc.)
3. WHEN the system prompt is generated, THE System SHALL use it for all Claude API calls in the AI Bestie conversation.

---

### Requirement 18: System Prompt Generation for AI Wingman

**User Story:** As a developer, I want the system to generate accurate system prompts for AI Wingman, so that the assistant behaves consistently and provides high-quality advice.

#### Acceptance Criteria

1. WHEN AI Wingman is activated, THE System SHALL call the buildAIWingmanSystemPrompt function with:
   - The male user's profile (gender, age range, dating app, relationship goal)
   - The book context (relevant chapters from "Art of Dating for Indian Men")
   - The matched user's profile (optional: gender, age range, dating app, relationship goal)
2. WHEN buildAIWingmanSystemPrompt is called, THE Function SHALL return a system prompt that:
   - Defines AI Wingman's role as a confident, practical dating coach for men
   - Includes the book context
   - Includes the user's profile context
   - Includes the matched user's profile context (if provided)
   - Specifies the rules for behavior (grounding in book, citations, confidence, practicality, etc.)
3. WHEN the system prompt is generated, THE System SHALL use it for all Claude API calls in the AI Wingman conversation.

---

### Requirement 19: Match Context Loading and Formatting

**User Story:** As a developer, I want the system to efficiently load and format match context (recent messages, profile data), so that the AI assistants have the information they need to provide relevant advice.

#### Acceptance Criteria

1. WHEN an AI assistant is activated, THE System SHALL load the matched user's profile data from localStorage or Supabase.
2. WHEN an AI assistant is activated, THE System SHALL load the recent messages from the match (last 5-10 messages) from the dating app or local storage.
3. WHEN match context is loaded, THE System SHALL format it as a readable string for inclusion in the Claude API request.
4. WHEN match context is formatted, THE System SHALL include:
   - The matched user's profile information (age, gender, dating app, relationship goal)
   - The recent messages in chronological order
   - Any relevant metadata (e.g., conversation duration, number of messages)
5. IF match context cannot be loaded, THE System SHALL proceed with the AI assistant conversation without it and log a warning.

---

### Requirement 20: Conversation Deactivation and Session Cleanup

**User Story:** As a user, I want to deactivate an AI assistant and return to the regular "Ask Your Coach" mode, so that I can switch between assistants or stop using them.

#### Acceptance Criteria

1. WHEN a user clicks "Deactivate AI Bestie" or "Deactivate AI Wingman", THE System SHALL:
   - Stop sending messages to the AI assistant
   - Clear the cached profile data
   - Update the visual indicator to show that the assistant is no longer active
   - Return to the regular "Ask Your Coach" mode
2. WHEN an AI assistant is deactivated, THE System SHALL NOT delete the conversation history from Supabase; the user can reactivate the assistant and continue the conversation.
3. WHEN an AI assistant is deactivated, THE Chat_Interface SHALL display a confirmation message: "AI Bestie/Wingman deactivated. You can reactivate it anytime."
4. WHEN an AI assistant is deactivated, THE System SHALL allow the user to activate a different assistant if desired.

---

## Acceptance Criteria Testing Strategy

### Property-Based Testing Approach

For this feature, the following acceptance criteria are suitable for property-based testing:

1. **Requirement 1-2 (Session Initialization)**: Test that session creation is idempotent — creating a session twice with the same parameters should return the same session ID (idempotence property).

2. **Requirement 3-4 (Message Crafting)**: Test that messages are correctly appended to conversation history and retrieved in the same order (round-trip property: save → retrieve → verify order).

3. **Requirement 5 (Compatibility Flags)**: Test that flag assessments are consistent — analyzing the same match response multiple times should produce the same flags (idempotence property).

4. **Requirement 8 (Chat History Persistence)**: Test that conversation history is correctly persisted and retrieved (round-trip property: save messages → retrieve → verify content matches).

5. **Requirement 11 (Rate Limiting)**: Test that rate limiting correctly counts messages and enforces limits (invariant property: message count should never exceed the limit).

### Integration Testing Approach

For this feature, the following acceptance criteria require integration tests:

1. **Requirement 10 (Error Handling)**: Test that errors from Claude API and Supabase are handled gracefully (use 2-3 representative error scenarios).

2. **Requirement 12 (Profile Data Loading)**: Test that profile files are correctly loaded from the static directory (use representative profile files).

3. **Requirement 13 (User Type Detection)**: Test that the correct assistant is shown based on user gender (use representative user profiles).

4. **Requirement 15 (Data Privacy)**: Test that privacy notices are displayed and user consent is required (use representative user flows).

5. **Requirement 16 (Integration with Existing Chat)**: Test that AI assistants work alongside existing features without interference (use representative chat scenarios).

---

## Notes for Implementation

1. **Preferences.md and Personality.md Loading**: These files are currently stored in the static directory. Consider whether to load them at build time or runtime. For performance, consider pre-loading them into Supabase or a cache.

2. **Match Context**: The current implementation doesn't have a dedicated "match conversation" table. Consider how to retrieve recent messages from the dating app or local storage.

3. **User Authentication**: The AI assistant endpoints require user authentication via `locals.auth.getSession()`. Ensure that the user is authenticated before allowing access to AI assistants.

4. **Supabase Schema**: The `ai_assistant_conversations` table already exists. Verify that it has the correct schema:
   - `id` (UUID, primary key)
   - `user_id` (UUID, foreign key to auth.users)
   - `match_conversation_id` (string or UUID)
   - `assistant_type` (enum: "bestie" or "wingman")
   - `messages` (JSONB array)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

5. **Claude API Costs**: AI Bestie and AI Wingman will increase Claude API usage. Consider implementing rate limiting and monitoring to manage costs.

6. **Book Context**: The book context is currently retrieved via vector search. Ensure that the vector store is populated with content from "Art of Dating for Indian Men" for both male and female users.

7. **Visual Differentiation**: Consider using distinct colors, icons, or badges to differentiate AI Bestie, AI Wingman, and "Ask Your Coach" in the UI.

8. **Mobile Responsiveness**: Ensure that the AI assistant interface is responsive on mobile devices, with appropriate button placement and message formatting.

