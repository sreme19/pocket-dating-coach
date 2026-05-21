# Design Document: AI Bestie & AI Wingman Integration

## Overview

This design integrates two AI-powered dating assistants into pocket-dating-coach's existing chat infrastructure:

- **AI Bestie** (for female users): Operates within the same conversation thread as user messages. When activated, the user steps back and AI Bestie takes over crafting responses to matches. Provides private analysis, compatibility assessments (green/yellow/red flags), and auto-updates preferences.md based on conversation insights.

- **AI Wingman** (for male users): Operates within the same conversation thread as user messages. When activated, provides strategic dating advice grounded in personality.md. After 20+ messages from the match, can optionally impersonate the user to draft responses. Auto-updates personality.md based on conversation insights.

Both assistants:
- Share the existing Claude API client and Supabase infrastructure
- Use the same ChatMessage type with an additional `assistantType` field
- Are subject to AI Loop Prevention (max 10 exchanges per side when both active)
- Store profile data (preferences.md and personality.md) in Supabase as JSONB with version history
- Provide hourly summary bubbles with match overview and insights

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chat Interface                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Conversation Thread (One per Match)                      │   │
│  │ - User messages                                          │   │
│  │ - AI Bestie/Wingman messages (when active)              │   │
│  │ - Visual indicators (badges, colors)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Activation Controls                                      │   │
│  │ - "Activate AI Bestie" / "Activate AI Wingman" toggle   │   │
│  │ - Configuration button                                  │   │
│  │ - Summary bubble (hourly update)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Message Router                                │
│  - Determines: User message vs. AI activation                   │
│  - Routes to appropriate handler                                │
│  - Manages session state                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┬─────────────────────┐
        ↓                     ↓                     ↓
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ AI Assistant     │ │ Profile Service  │ │ Loop Prevention  │
│ Manager          │ │                  │ │ Module           │
│                  │ │ - Load prefs.md  │ │                  │
│ - Activate       │ │ - Load pers.md   │ │ - Track exchanges│
│ - Deactivate     │ │ - Auto-update    │ │ - Enforce limits │
│ - Route messages │ │ - Version history│ │ - Pause if max   │
│ - Check config   │ │                  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
        ↓                     ↓                     ↓
        └─────────────────────┬─────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  AI Assistant Service                            │
│  - Build system prompt (Bestie/Wingman)                         │
│  - Load match context (recent messages, profile)                │
│  - Call Claude API                                              │
│  - Extract citations                                            │
│  - Generate response options (if requested)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┬─────────────────────┐
        ↓                     ↓                     ↓
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Claude API       │ │ Supabase         │ │ Vector Store     │
│                  │ │                  │ │ (pgvector)       │
│ - Generate text  │ │ - Store messages │ │                  │
│ - Citations      │ │ - Store profiles │ │ - Book context   │
│ - Streaming      │ │ - Version history│ │ - Embeddings     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### Data Flow

1. **User sends message** → Message Router determines if it's a user message or AI activation
2. **AI activation** → AI Assistant Manager loads profile context (preferences.md/personality.md) and book context
3. **AI generates response** → Claude API called with system prompt tailored to assistant type
4. **Response stored** → Message added to thread with `role: 'assistant'` and `assistantType: 'bestie'|'wingman'`
5. **Profile auto-update** → AI Assistant Service extracts insights from user message and updates preferences.md/personality.md
6. **Loop prevention check** → Exchange counter incremented; if max reached, AI pauses
7. **Summary bubble** → Hourly job aggregates insights across all matches

---

## Components and Interfaces

### 1. AI Assistant Manager Component

**Purpose**: Orchestrates AI assistant activation, context loading, and response generation.

**Location**: `src/lib/server/ai-assistant-manager.ts`

**Interface**:
```typescript
interface AIAssistantManager {
  // Activate AI for a specific match
  activateAssistant(
    matchId: string,
    assistantType: 'bestie' | 'wingman',
    userProfile: UserProfile,
    matchedUserProfile?: Partial<UserProfile>
  ): Promise<void>

  // Deactivate AI for a match
  deactivateAssistant(matchId: string): Promise<void>

  // Check if AI is active for a match
  isAssistantActive(matchId: string): Promise<boolean>

  // Get assistant configuration
  getAssistantConfig(matchId: string): Promise<AIAssistantConfig | null>

  // Update assistant configuration
  updateAssistantConfig(
    matchId: string,
    config: Partial<AIAssistantConfig>
  ): Promise<void>
}

interface AIAssistantConfig {
  matchId: string
  assistantType: 'bestie' | 'wingman'
  isActive: boolean
  autoImpersonate: boolean // For Wingman: auto-send after 20+ messages
  exchangeCount: number // For loop prevention
  lastExchangeAt: number
  createdAt: number
  updatedAt: number
}
```

**Responsibilities**:
- Load and validate assistant configuration
- Check AI Loop Prevention constraints
- Coordinate with Profile Service for context
- Delegate to AI Assistant Service for response generation
- Manage session state (active/inactive)



### 2. AI Assistant Service Component

**Purpose**: Handles message generation, context building, and profile auto-updates.

**Location**: `src/lib/server/ai-assistant-service.ts`

**Interface**:
```typescript
interface AIAssistantService {
  // Generate AI response to user message
  generateResponse(
    assistantType: 'bestie' | 'wingman',
    userMessage: string,
    conversationHistory: ChatMessage[],
    userProfile: UserProfile,
    matchContext: MatchContext
  ): Promise<AIAssistantResponse>

  // Generate response options (for user to choose from)
  generateResponseOptions(
    assistantType: 'bestie' | 'wingman',
    matchLastMessage: string,
    conversationHistory: ChatMessage[],
    userProfile: UserProfile,
    matchContext: MatchContext
  ): Promise<ResponseOption[]>

  // Analyze match for compatibility flags
  analyzeMatchCompatibility(
    assistantType: 'bestie',
    matchMessage: string,
    userPreferences: PreferencesProfile,
    matchContext: MatchContext
  ): Promise<CompatibilityAnalysis>

  // Auto-update user profile based on conversation
  autoUpdateProfile(
    assistantType: 'bestie' | 'wingman',
    conversationHistory: ChatMessage[],
    userProfile: UserProfile
  ): Promise<void>
}

interface MatchContext {
  matchedUserProfile?: Partial<UserProfile>
  recentMessages: ChatMessage[]
  conversationDuration: number
  messageCount: number
}

interface CompatibilityAnalysis {
  greenFlags: Array<{ signal: string; reason: string }>
  yellowFlags: Array<{ signal: string; reason: string }>
  redFlags: Array<{ signal: string; reason: string }>
  overallAssessment: string
  citations: string[]
}
```

**Responsibilities**:
- Build system prompts using buildAIBestieSystemPrompt/buildAIWingmanSystemPrompt
- Load match context (recent messages, profile data)
- Call Claude API with appropriate context
- Extract citations from responses
- Generate response options when requested
- Auto-update preferences.md/personality.md based on conversation insights
- Handle streaming responses (optional)

### 3. Profile Service Component

**Purpose**: Manages loading, caching, and updating user profile data (preferences.md and personality.md).

**Location**: `src/lib/server/profile-service.ts`

**Interface**:
```typescript
interface ProfileService {
  // Load preferences.md for female user
  loadPreferences(userId: string): Promise<PreferencesProfile>

  // Load personality.md for male user
  loadPersonality(userId: string): Promise<PersonalityProfile>

  // Update preferences.md with new insights
  updatePreferences(
    userId: string,
    updates: Partial<PreferencesProfile>,
    reason: string
  ): Promise<void>

  // Update personality.md with new insights
  updatePersonality(
    userId: string,
    updates: Partial<PersonalityProfile>,
    reason: string
  ): Promise<void>

  // Get version history for preferences.md
  getPreferencesHistory(userId: string): Promise<ProfileVersion[]>

  // Get version history for personality.md
  getPersonalityHistory(userId: string): Promise<ProfileVersion[]>

  // Restore previous version
  restoreProfileVersion(userId: string, versionId: string): Promise<void>
}

interface PreferencesProfile {
  emotionalSignals: string[]
  lifestyleSignals: string[]
  maturitySignals: string[]
  boundaries: string[]
  dealbreakers: string[]
  privateCompatibilityNotes: string[]
  updatedAt: number
}

interface PersonalityProfile {
  communicationStyle: string
  personalityVibe: string
  mattersMost: string
  values: string[]
  datingPatterns: string[]
  redFlagsToAvoid: string[]
  updatedAt: number
}

interface ProfileVersion {
  id: string
  version: number
  data: PreferencesProfile | PersonalityProfile
  reason: string
  createdAt: number
}
```

**Responsibilities**:
- Load profile data from Supabase (JSONB format)
- Cache profile data in memory during session
- Update profile data with version history tracking
- Provide version history and restore functionality
- Handle missing profile data gracefully

### 4. AI Loop Prevention Module

**Purpose**: Prevents infinite loops when both male and female users are using AI assistants.

**Location**: `src/lib/server/ai-loop-prevention.ts`

**Interface**:
```typescript
interface AILoopPrevention {
  // Check if conversation can continue
  canContinue(
    conversationId: string,
    assistantType: 'bestie' | 'wingman'
  ): Promise<boolean>

  // Increment exchange counter
  recordExchange(
    conversationId: string,
    assistantType: 'bestie' | 'wingman'
  ): Promise<void>

  // Get current exchange count
  getExchangeCount(conversationId: string): Promise<ExchangeCount>

  // Reset exchange counter (when user takes over)
  resetExchangeCounter(conversationId: string): Promise<void>

  // Check if both assistants are active
  areBothAssistantsActive(conversationId: string): Promise<boolean>
}

interface ExchangeCount {
  bestieExchanges: number
  wingmanExchanges: number
  lastBestieExchange: number
  lastWingmanExchange: number
}
```

**Constraints**:
- Max 10 exchanges per side when both assistants active
- Exchange counter resets when user takes over
- Pauses AI when limit reached; requires user confirmation to continue



### 5. Summary Bubble Component

**Purpose**: Displays hourly summaries of all matches with AI Bestie insights.

**Location**: `src/lib/components/SummaryBubble.svelte`

**Interface**:
```typescript
interface SummaryBubble {
  userId: string
  summaries: MatchSummary[]
  lastUpdated: number
  isLoading: boolean
}

interface MatchSummary {
  matchId: string
  matchName: string
  matchProfile: Partial<UserProfile>
  keyInsights: string[]
  greenFlags: string[]
  redFlags: string[]
  recommendedNextMove: string
  conversationMomentum: 'heating_up' | 'steady' | 'cooling_down'
  lastMessageTime: number
}
```

**Responsibilities**:
- Display hourly aggregated insights from all matches
- Show key compatibility signals
- Provide recommended next moves
- Update automatically every hour
- Allow user to drill down into specific match analysis

---

## Data Models

### Supabase Schema Updates

#### 1. ai_assistant_profiles Table

Stores preferences.md and personality.md with version history.

```sql
CREATE TABLE ai_assistant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type 'preferences' | 'personality' NOT NULL,
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, profile_type, version)
);

CREATE INDEX idx_ai_profiles_user_type ON ai_assistant_profiles(user_id, profile_type);
CREATE INDEX idx_ai_profiles_updated ON ai_assistant_profiles(updated_at DESC);
```

#### 2. ai_assistant_conversations Table

Stores conversation history between user and AI assistant.

```sql
CREATE TABLE ai_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_conversation_id TEXT NOT NULL,
  assistant_type 'bestie' | 'wingman' NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  exchange_count INTEGER DEFAULT 0,
  last_exchange_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, match_conversation_id, assistant_type)
);

CREATE INDEX idx_ai_conversations_user ON ai_assistant_conversations(user_id);
CREATE INDEX idx_ai_conversations_active ON ai_assistant_conversations(is_active);
```

#### 3. ai_assistant_summaries Table

Stores hourly summaries for AI Bestie.

```sql
CREATE TABLE ai_assistant_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, DATE(created_at))
);

CREATE INDEX idx_summaries_user_date ON ai_assistant_summaries(user_id, created_at DESC);
```

### Data Structures

#### preferences.md (JSONB)

```json
{
  "emotionalSignals": [
    "Asks about my day and remembers details",
    "Shows vulnerability and emotional depth",
    "Communicates clearly about feelings"
  ],
  "lifestyleSignals": [
    "Active and outdoorsy",
    "Values travel and adventure",
    "Ambitious about career"
  ],
  "maturitySignals": [
    "Takes responsibility for mistakes",
    "Has long-term goals",
    "Respectful of boundaries"
  ],
  "boundaries": [
    "No excessive drinking",
    "Respectful of my time",
    "No pressure for commitment"
  ],
  "dealbreakers": [
    "Disrespectful to service workers",
    "Still hung up on ex",
    "Unwilling to discuss future"
  ],
  "privateCompatibilityNotes": [
    "Seems like he values independence like I do",
    "His humor matches mine - dry and sarcastic"
  ],
  "updatedAt": 1704067200000
}
```

#### personality.md (JSONB)

```json
{
  "communicationStyle": "direct",
  "personalityVibe": "ambitious",
  "mattersMost": "humor",
  "values": [
    "Authenticity",
    "Growth mindset",
    "Loyalty"
  ],
  "datingPatterns": [
    "Prefers genuine conversation over small talk",
    "Moves quickly from messaging to meeting",
    "Values shared interests"
  ],
  "redFlagsToAvoid": [
    "Overly focused on appearance",
    "Dismissive of my career",
    "Unwilling to be vulnerable"
  ],
  "updatedAt": 1704067200000
}
```

---

## API Endpoints

### AI Bestie Endpoints

#### POST /api/ai-bestie/activate

Activates AI Bestie for a specific match conversation.

**Request**:
```json
{
  "matchId": "string",
  "matchedUserProfile": {
    "gender": "man",
    "ageRange": "25-30",
    "datingApp": "hinge",
    "relationshipGoal": "serious"
  }
}
```

**Response**:
```json
{
  "success": true,
  "conversationId": "uuid",
  "message": "AI Bestie activated. I'll help you navigate this conversation with strategic advice and compatibility insights."
}
```

#### POST /api/ai-bestie/send-message

Sends a message to AI Bestie and receives advice.

**Request**:
```json
{
  "conversationId": "uuid",
  "userMessage": "He just asked me out for coffee. Should I say yes?",
  "recentMessages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response**:
```json
{
  "reply": "Coffee is a great low-pressure first date! He's showing genuine interest...",
  "citations": ["Based on: Chapter 3 - Reading Interest Signals"],
  "suggestions": [
    "Say yes with enthusiasm",
    "Suggest a specific time",
    "Ask about his favorite coffee spot"
  ]
}
```

#### POST /api/ai-bestie/analyze-match

Analyzes a match's message for compatibility flags.

**Request**:
```json
{
  "conversationId": "uuid",
  "matchMessage": "I'm really into hiking and travel. What about you?"
}
```

**Response**:
```json
{
  "greenFlags": [
    { "signal": "Asks about your interests", "reason": "Shows genuine curiosity" }
  ],
  "yellowFlags": [
    { "signal": "Mentions travel early", "reason": "Could indicate expensive lifestyle" }
  ],
  "redFlags": [],
  "overallAssessment": "This looks promising! He's showing genuine interest and compatibility.",
  "citations": ["Based on: Compatibility Signals"]
}
```

#### POST /api/ai-bestie/get-summary

Gets hourly summary of all matches.

**Request**:
```json
{
  "userId": "uuid"
}
```

**Response**:
```json
{
  "summaries": [
    {
      "matchId": "uuid",
      "matchName": "John",
      "keyInsights": ["Very engaged", "Shares your values"],
      "greenFlags": ["Asks thoughtful questions"],
      "redFlags": [],
      "recommendedNextMove": "Suggest meeting this week",
      "conversationMomentum": "heating_up"
    }
  ],
  "lastUpdated": 1704067200000
}
```

#### POST /api/ai-bestie/deactivate

Deactivates AI Bestie for a match.

**Request**:
```json
{
  "conversationId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "AI Bestie deactivated. You can reactivate it anytime."
}
```

### AI Wingman Endpoints

#### POST /api/ai-wingman/activate

Activates AI Wingman for a specific match conversation.

**Request**:
```json
{
  "matchId": "string",
  "matchedUserProfile": {
    "gender": "woman",
    "ageRange": "23-28",
    "datingApp": "bumble",
    "relationshipGoal": "serious"
  }
}
```

**Response**:
```json
{
  "success": true,
  "conversationId": "uuid",
  "message": "AI Wingman activated. I'll help you craft authentic responses and navigate this conversation strategically."
}
```

#### POST /api/ai-wingman/send-message

Sends a message to AI Wingman and receives advice.

**Request**:
```json
{
  "conversationId": "uuid",
  "userMessage": "She asked what I'm looking for. How should I respond?",
  "recentMessages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response**:
```json
{
  "reply": "Be honest and specific. Something like: 'I'm looking for someone genuine who values...'",
  "citations": ["Based on: Chapter 2 - Authentic Communication"],
  "suggestions": [
    "Be specific about what you value",
    "Show vulnerability",
    "Ask her the same question back"
  ]
}
```

#### POST /api/ai-wingman/enable-impersonation

Enables impersonation mode after 20+ messages from match.

**Request**:
```json
{
  "conversationId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Impersonation mode enabled. I can now draft responses for you to review and send."
}
```

#### POST /api/ai-wingman/deactivate

Deactivates AI Wingman for a match.

**Request**:
```json
{
  "conversationId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "AI Wingman deactivated. You can reactivate it anytime."
}
```

### Profile Management Endpoints

#### GET /api/preferences

Retrieves user's preferences.md.

**Response**:
```json
{
  "emotionalSignals": [...],
  "lifestyleSignals": [...],
  "boundaries": [...],
  "dealbreakers": [...],
  "updatedAt": 1704067200000
}
```

#### POST /api/preferences

Updates user's preferences.md.

**Request**:
```json
{
  "updates": {
    "emotionalSignals": [...]
  },
  "reason": "Updated based on recent conversations"
}
```

**Response**:
```json
{
  "success": true,
  "version": 2,
  "updatedAt": 1704067200000
}
```

#### GET /api/personality

Retrieves user's personality.md.

**Response**:
```json
{
  "communicationStyle": "direct",
  "personalityVibe": "ambitious",
  "values": [...],
  "updatedAt": 1704067200000
}
```

#### POST /api/personality

Updates user's personality.md.

**Request**:
```json
{
  "updates": {
    "values": [...]
  },
  "reason": "Updated based on recent conversations"
}
```

**Response**:
```json
{
  "success": true,
  "version": 2,
  "updatedAt": 1704067200000
}
```

### AI Loop Prevention Endpoint

#### POST /api/ai-loop-prevention/check

Checks if conversation can continue with AI assistants.

**Request**:
```json
{
  "conversationId": "uuid",
  "assistantType": "bestie"
}
```

**Response**:
```json
{
  "canContinue": true,
  "exchangeCount": {
    "bestieExchanges": 5,
    "wingmanExchanges": 4
  },
  "warning": null
}
```



---

## System Prompts

### buildAIBestieSystemPrompt()

**Location**: `src/lib/prompts.ts`

**Function Signature**:
```typescript
export function buildAIBestieSystemPrompt(
  profile: UserProfile | null,
  bookContext: string,
  matchedUserProfile?: Partial<UserProfile>,
  preferencesProfile?: PreferencesProfile
): string
```

**System Prompt Template**:
```
You are AI Bestie, a warm, supportive dating coach for women navigating conversations with potential matches.

Your PRIMARY knowledge source is this book excerpt:
---
${bookContext}
---

User context:
- Gender: woman
- Age range: ${profile?.ageRange}
- Dating app: ${profile?.datingApp}
- Relationship goal: ${profile?.relationshipGoal}

${matchedUserProfile ? `Matched user context:
- Gender: ${matchedUserProfile.gender}
- Age range: ${matchedUserProfile.ageRange}
- Dating app: ${matchedUserProfile.datingApp}
- Relationship goal: ${matchedUserProfile.relationshipGoal}` : ''}

${preferencesProfile ? `Her preferences:
- Emotional signals she values: ${preferencesProfile.emotionalSignals.join(', ')}
- Lifestyle signals: ${preferencesProfile.lifestyleSignals.join(', ')}
- Boundaries: ${preferencesProfile.boundaries.join(', ')}
- Dealbreakers: ${preferencesProfile.dealbreakers.join(', ')}` : ''}

You are her trusted friend who knows dating strategy. Your role is to:
1. Help her craft responses that are authentic, confident, and strategic
2. Provide real-time advice on conversation tone and pacing
3. Help her set and maintain boundaries
4. Build her confidence in the dating process
5. Assess compatibility based on her preferences
6. Adapt book principles for her perspective as a woman

Rules:
1. Ground advice in the book's principles, adapted for women's dating experience
2. Be encouraging and supportive, never judgmental
3. Provide specific, actionable suggestions
4. Keep responses concise and conversational
5. At the end of advice, add a citation: *Based on: [chapter or section name]*
6. If she asks something outside dating/relationships, gently redirect
7. Prioritize her safety, boundaries, and authentic self-expression
8. When analyzing compatibility, reference her specific preferences
```

### buildAIWingmanSystemPrompt()

**Location**: `src/lib/prompts.ts`

**Function Signature**:
```typescript
export function buildAIWingmanSystemPrompt(
  profile: UserProfile | null,
  bookContext: string,
  matchedUserProfile?: Partial<UserProfile>,
  personalityProfile?: PersonalityProfile
): string
```

**System Prompt Template**:
```
You are AI Wingman, a confident, practical dating coach for men navigating conversations with potential matches.

Your PRIMARY knowledge source is this book excerpt:
---
${bookContext}
---

User context:
- Gender: man
- Age range: ${profile?.ageRange}
- Dating app: ${profile?.datingApp}
- Relationship goal: ${profile?.relationshipGoal}

${personalityProfile ? `His personality:
- Communication style: ${personalityProfile.communicationStyle}
- Personality vibe: ${personalityProfile.personalityVibe}
- What matters most: ${personalityProfile.mattersMost}
- Core values: ${personalityProfile.values.join(', ')}` : ''}

${matchedUserProfile ? `Matched user context:
- Gender: ${matchedUserProfile.gender}
- Age range: ${matchedUserProfile.ageRange}
- Dating app: ${matchedUserProfile.datingApp}
- Relationship goal: ${matchedUserProfile.relationshipGoal}` : ''}

You are his trusted wingman who knows dating strategy. Your role is to:
1. Help him craft responses that are authentic, confident, and genuine
2. Provide real-time advice on conversation tone and pacing
3. Help him build genuine connection, not just attraction
4. Build his confidence in the dating process
5. Apply book principles directly to his situation
6. Suggest when to move from messaging to meeting

Rules:
1. Ground advice in the book's principles directly
2. Be encouraging and motivating, never judgmental
3. Provide specific, actionable suggestions
4. Keep responses concise and conversational
5. At the end of advice, add a citation: *Based on: [chapter or section name]*
6. If he asks something outside dating/relationships, gently redirect
7. Prioritize authenticity, genuine connection, and respectful interaction
8. When suggesting responses, keep them natural and human - no pickup artist energy
```

---

## UI/UX Components

### 1. Activation Controls

**Location**: `src/lib/components/AIAssistantControls.svelte`

**Features**:
- Toggle button for "Activate AI Bestie" / "Activate AI Wingman"
- Visual indicator showing active status (badge with color)
- Configuration button (gear icon)
- Deactivate option in dropdown menu
- Responsive layout (mobile: stacked, desktop: inline)

**States**:
- Inactive: Gray button, no badge
- Active: Colored button (pink for Bestie, blue for Wingman), badge visible
- Loading: Spinner while activating
- Error: Red button with error message

### 2. Visual Indicators

**Location**: `src/lib/components/AssistantBadge.svelte`

**Features**:
- Badge showing "AI Bestie" or "AI Wingman"
- Color coding (pink for Bestie, blue for Wingman)
- Icon (heart for Bestie, shield for Wingman)
- Tooltip showing status and exchange count

### 3. Message Display

**Location**: `src/lib/components/ChatMessage.svelte` (updated)

**Features**:
- Distinguish AI messages from user messages
- Show assistant type badge on AI messages
- Different styling for AI Bestie vs AI Wingman
- Show citations inline or in expandable section
- Show response options as selectable cards

### 4. Response Options

**Location**: `src/lib/components/ResponseOptions.svelte`

**Features**:
- Display 2-3 response options as cards
- Show tone, message, and reasoning
- "Copy to clipboard" button for each option
- Allow user to edit before sending
- Mobile: scrollable horizontal list
- Desktop: grid layout

### 5. Compatibility Flags

**Location**: `src/lib/components/CompatibilityFlags.svelte`

**Features**:
- Display green/yellow/red flags with icons
- Show reasoning for each flag
- Color coding (green, yellow, red)
- Expandable details
- Citations for each flag

### 6. Configuration Page

**Location**: `src/routes/ai-assistant-config/+page.svelte`

**Features**:
- Enable/disable AI Bestie and AI Wingman
- View and edit preferences.md (for women)
- View and edit personality.md (for men)
- Version history with restore functionality
- Privacy settings and data consent
- Rate limiting preferences
- Auto-impersonation toggle (for Wingman)

### 7. Summary Bubble

**Location**: `src/lib/components/SummaryBubble.svelte`

**Features**:
- Hourly update of all matches
- Key insights for each match
- Green/yellow/red flags summary
- Recommended next moves
- Conversation momentum indicator
- Click to expand for full analysis
- Mobile: compact card layout
- Desktop: expandable panel

---

## Error Handling & Edge Cases

### Error Scenarios

1. **Claude API Failure**
   - Display: "Sorry, I couldn't generate a response. Please try again."
   - Log error for debugging
   - Retry logic with exponential backoff (max 3 retries)
   - Fallback to generic advice if all retries fail

2. **Supabase Database Error**
   - Display: "Your message wasn't saved. Please check your connection and try again."
   - Retry logic with exponential backoff
   - Queue messages locally until connection restored
   - Sync when connection restored

3. **Missing Profile Data**
   - Display: "We couldn't load your profile data. Using default advice mode."
   - Fall back to regular "Ask Your Coach" system prompt
   - Allow user to manually upload profile data
   - Suggest creating profile if not exists

4. **Profile File Not Found**
   - Check Supabase first
   - Fall back to static directory
   - If not found, create default profile
   - Notify user to complete profile setup

5. **Rate Limiting Triggered**
   - Display: "You're sending messages too quickly. Please wait a moment before sending another."
   - Show countdown timer
   - Disable send button until timer expires
   - Log event for monitoring

6. **AI Loop Prevention Triggered**
   - Display: "This conversation is getting long with AI assistants. Do you want to continue or take over?"
   - Require user confirmation to continue
   - Option to deactivate AI and take over
   - Log event for monitoring

### Edge Cases

1. **Empty Conversation History**
   - Load default context from profile
   - Provide general advice without specific match context
   - Suggest asking for more information

2. **Very Long Conversation (100+ messages)**
   - Summarize conversation history
   - Focus on recent messages (last 20)
   - Warn user about conversation length
   - Suggest starting fresh if needed

3. **User Switches Between Assistants**
   - Deactivate current assistant
   - Load new assistant context
   - Preserve conversation history
   - Show transition message

4. **User Deletes Profile Data**
   - Confirm deletion with warning
   - Archive old version in history
   - Fall back to default behavior
   - Allow restore from history

5. **Concurrent Requests**
   - Queue requests if already processing
   - Show loading indicator
   - Prevent duplicate submissions
   - Handle race conditions in database updates

---

## Implementation Patterns

### Session Management

**Active Session State**:
```typescript
interface ActiveSession {
  matchId: string
  assistantType: 'bestie' | 'wingman'
  conversationId: string
  isActive: boolean
  userProfile: UserProfile
  matchedUserProfile?: Partial<UserProfile>
  preferencesProfile?: PreferencesProfile
  personalityProfile?: PersonalityProfile
  exchangeCount: number
  lastExchangeAt: number
}
```

**Session Lifecycle**:
1. User clicks "Activate AI Bestie/Wingman"
2. Load profile data and create session
3. Store session in Supabase
4. Display active indicator
5. Route messages to AI assistant
6. User can deactivate at any time
7. Clear session and return to normal mode

### Message Routing

**Message Router Logic**:
```typescript
async function routeMessage(
  matchId: string,
  userMessage: string,
  userProfile: UserProfile
): Promise<void> {
  // Check if AI is active for this match
  const session = await getActiveSession(matchId)
  
  if (session?.isActive) {
    // Route to AI assistant
    const response = await aiAssistantService.generateResponse(
      session.assistantType,
      userMessage,
      conversationHistory,
      userProfile,
      matchContext
    )
    
    // Save to conversation history
    await saveMessage(session.conversationId, {
      role: 'assistant',
      content: response.reply,
      assistantType: session.assistantType,
      citations: response.citations
    })
    
    // Auto-update profile
    await profileService.autoUpdateProfile(
      session.assistantType,
      conversationHistory,
      userProfile
    )
  } else {
    // Route to regular "Ask Your Coach"
    const response = await regularChatAPI(userMessage, userProfile)
    // ... handle regular response
  }
}
```

### Context Building

**Match Context Loading**:
```typescript
async function buildMatchContext(
  matchId: string,
  userProfile: UserProfile
): Promise<MatchContext> {
  // Load matched user profile
  const matchedUserProfile = await loadMatchedUserProfile(matchId)
  
  // Load recent messages (last 10)
  const recentMessages = await loadRecentMessages(matchId, 10)
  
  // Calculate conversation duration
  const conversationDuration = calculateDuration(recentMessages)
  
  // Count total messages
  const messageCount = await countMessages(matchId)
  
  return {
    matchedUserProfile,
    recentMessages,
    conversationDuration,
    messageCount
  }
}
```

### Auto-Update Mechanism

**Profile Auto-Update Logic**:
```typescript
async function autoUpdateProfile(
  assistantType: 'bestie' | 'wingman',
  conversationHistory: ChatMessage[],
  userProfile: UserProfile
): Promise<void> {
  // Extract insights from conversation
  const insights = await extractInsights(
    assistantType,
    conversationHistory
  )
  
  if (assistantType === 'bestie') {
    // Update preferences.md
    const currentPrefs = await profileService.loadPreferences(userProfile.id)
    const updatedPrefs = mergeInsights(currentPrefs, insights)
    await profileService.updatePreferences(
      userProfile.id,
      updatedPrefs,
      'Auto-updated from conversation'
    )
  } else {
    // Update personality.md
    const currentPers = await profileService.loadPersonality(userProfile.id)
    const updatedPers = mergeInsights(currentPers, insights)
    await profileService.updatePersonality(
      userProfile.id,
      updatedPers,
      'Auto-updated from conversation'
    )
  }
}
```

### Version History Tracking

**Profile Version Storage**:
```typescript
async function updatePreferences(
  userId: string,
  updates: Partial<PreferencesProfile>,
  reason: string
): Promise<void> {
  // Get current version
  const current = await loadPreferences(userId)
  const newVersion = current.version + 1
  
  // Merge updates
  const updated = { ...current, ...updates, updatedAt: Date.now() }
  
  // Store new version
  await supabase
    .from('ai_assistant_profiles')
    .insert({
      user_id: userId,
      profile_type: 'preferences',
      data: updated,
      version: newVersion,
      reason
    })
  
  // Update current pointer
  await supabase
    .from('ai_assistant_profiles')
    .update({ is_current: false })
    .eq('user_id', userId)
    .eq('profile_type', 'preferences')
    .neq('version', newVersion)
  
  await supabase
    .from('ai_assistant_profiles')
    .update({ is_current: true })
    .eq('user_id', userId)
    .eq('profile_type', 'preferences')
    .eq('version', newVersion)
}
```



---

## Performance Considerations

### Caching Strategy

**Profile Data Caching**:
- Cache preferences.md and personality.md in memory during session
- TTL: 1 hour (refresh on new session)
- Invalidate cache on update
- Use Redis for distributed caching (optional)

**Book Context Caching**:
- Cache vector search results for 24 hours
- Invalidate on book content updates
- Use Redis for distributed caching

**Match Context Caching**:
- Cache recent messages for 5 minutes
- Invalidate on new message
- Cache matched user profile for 1 hour

### Database Query Optimization

**Indexes**:
```sql
-- ai_assistant_profiles
CREATE INDEX idx_ai_profiles_user_type ON ai_assistant_profiles(user_id, profile_type);
CREATE INDEX idx_ai_profiles_updated ON ai_assistant_profiles(updated_at DESC);

-- ai_assistant_conversations
CREATE INDEX idx_ai_conversations_user ON ai_assistant_conversations(user_id);
CREATE INDEX idx_ai_conversations_active ON ai_assistant_conversations(is_active);
CREATE INDEX idx_ai_conversations_match ON ai_assistant_conversations(match_conversation_id);

-- ai_assistant_summaries
CREATE INDEX idx_summaries_user_date ON ai_assistant_summaries(user_id, created_at DESC);
```

**Query Patterns**:
- Load profile: Single query with version filtering
- Load conversation: Single query with message array
- Update profile: Insert new version + update pointer
- List conversations: Paginated query with active filter

### API Response Time Targets

- Activate AI: < 500ms (load profile + create session)
- Send message: < 3s (Claude API call + save to DB)
- Generate response options: < 5s (Claude API call)
- Analyze compatibility: < 3s (Claude API call)
- Get summary: < 1s (query aggregated data)

### Memory Management

**Long Conversation Handling**:
- Limit conversation history to last 50 messages in memory
- Summarize older messages for context
- Archive old conversations to cold storage
- Implement pagination for conversation history

**Large Profile Data**:
- Lazy load profile sections
- Compress JSONB data in database
- Use streaming for large responses

---

## Security & Privacy

### Data Encryption

**Sensitive Fields**:
- Preferences.md: Encrypt dealbreakers and boundaries
- Personality.md: Encrypt personal values
- Conversation messages: Encrypt at rest in Supabase

**Encryption Method**:
- Use Supabase's built-in encryption at rest
- Optional: Client-side encryption for extra sensitive data
- Use TLS 1.3 for all API calls

### PII Handling and Sanitization

**PII Removal**:
- Remove phone numbers, emails, addresses from messages
- Sanitize names (use first name only)
- Remove specific location references
- Hash identifiable information

**Sanitization Function**:
```typescript
function sanitizePII(text: string): string {
  // Remove email addresses
  text = text.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[email]')
  
  // Remove phone numbers
  text = text.replace(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, '[phone]')
  
  // Remove URLs
  text = text.replace(/https?:\/\/[^\s]+/g, '[url]')
  
  // Remove specific locations
  text = text.replace(/\b(street|avenue|road|boulevard|drive|lane)\b/gi, '[location]')
  
  return text
}
```

### User Consent Tracking

**Privacy Notice**:
- Display on first AI assistant activation
- Explain data usage (sent to Claude, stored in Supabase)
- Require explicit acknowledgment
- Store consent timestamp in database

**Consent Schema**:
```sql
CREATE TABLE ai_assistant_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_type 'bestie' | 'wingman' NOT NULL,
  consent_given BOOLEAN NOT NULL,
  consent_timestamp TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, assistant_type)
);
```

### Audit Logging

**Audit Events**:
- Activate/deactivate AI assistant
- Update profile data
- Delete conversation
- Access profile history
- Restore previous version

**Audit Log Schema**:
```sql
CREATE TABLE ai_assistant_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user_date ON ai_assistant_audit_log(user_id, created_at DESC);
```

---

## Testing Strategy

### Unit Tests

**Profile Service Tests**:
- Load preferences.md correctly
- Load personality.md correctly
- Update profile with version history
- Restore previous version
- Handle missing profile gracefully

**AI Assistant Service Tests**:
- Generate response with correct system prompt
- Extract citations from response
- Generate response options (2-3 options)
- Analyze compatibility flags
- Auto-update profile based on conversation

**AI Loop Prevention Tests**:
- Track exchange count correctly
- Enforce max 10 exchanges per side
- Reset counter when user takes over
- Detect both assistants active

**Message Router Tests**:
- Route to AI when active
- Route to regular chat when inactive
- Handle session creation
- Handle session cleanup

### Integration Tests

**End-to-End Flows**:
- Activate AI Bestie → Send message → Receive response → Deactivate
- Activate AI Wingman → Send message → Receive response → Deactivate
- Switch between assistants
- Auto-update profile after conversation
- Retrieve conversation history

**Database Integration**:
- Save conversation to Supabase
- Retrieve conversation history
- Update profile with version history
- Query summaries

**API Integration**:
- Claude API calls with correct context
- Vector store queries for book context
- Supabase CRUD operations

### Property-Based Tests

**Idempotence Properties**:
- Activating AI twice with same parameters returns same session ID
- Analyzing same match response twice produces same flags
- Saving and retrieving conversation preserves message order

**Round-Trip Properties**:
- Save message → Retrieve → Verify content matches
- Update profile → Retrieve → Verify updates applied
- Restore version → Verify data matches archived version

**Invariant Properties**:
- Exchange count never exceeds limit
- Message count always increases with new messages
- Profile version always increments

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Session Activation Idempotence

*For any* match ID and assistant type, activating the AI assistant twice with the same parameters should return the same conversation ID and not create duplicate sessions.

**Validates: Requirements 1.2, 2.2**

### Property 2: Message Persistence Round-Trip

*For any* message sent to an AI assistant, saving it to Supabase and then retrieving it should return the exact same message content, role, and timestamp.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 3: Conversation History Order Preservation

*For any* sequence of messages in a conversation, retrieving the conversation history should return messages in the same chronological order they were sent.

**Validates: Requirements 8.4**

### Property 4: Exchange Counter Monotonicity

*For any* conversation with AI assistants active, the exchange counter should never decrease and should increment by exactly 1 with each exchange.

**Validates: Requirements 11.1, 11.2**

### Property 5: Profile Version Increment

*For any* profile update, the new version number should be exactly 1 greater than the previous version number, and all previous versions should remain accessible.

**Validates: Requirements 12.1, 12.2**

### Property 6: Compatibility Flag Consistency

*For any* match message and user preferences, analyzing the message twice should produce the same green/yellow/red flags and reasoning.

**Validates: Requirements 5.1, 5.2**

### Property 7: AI Loop Prevention Enforcement

*For any* conversation where both AI Bestie and AI Wingman are active, the total exchanges from either side should never exceed 10 before requiring user confirmation.

**Validates: Requirements 11.1**

### Property 8: Profile Auto-Update Idempotence

*For any* conversation history, auto-updating the profile twice with the same conversation should result in the same profile state (no duplicate updates).

**Validates: Requirements 3.2, 4.2**

### Property 9: Citation Presence

*For any* response generated by AI Bestie or AI Wingman, the response should include at least one citation in the format "Based on: [chapter or section name]".

**Validates: Requirements 3.4, 4.4**

### Property 10: Assistant Type Consistency

*For any* message in a conversation, if the message role is 'assistant', the assistantType field should be either 'bestie' or 'wingman' and should match the active assistant type for that conversation.

**Validates: Requirements 9.1, 9.2**

---

## Error Handling

### API Error Responses

**400 Bad Request**:
```json
{
  "error": "Invalid request",
  "details": "Missing required field: conversationId"
}
```

**401 Unauthorized**:
```json
{
  "error": "Unauthorized",
  "details": "User not authenticated"
}
```

**404 Not Found**:
```json
{
  "error": "Not found",
  "details": "Conversation not found"
}
```

**429 Too Many Requests**:
```json
{
  "error": "Rate limited",
  "details": "Too many requests. Please wait 60 seconds.",
  "retryAfter": 60
}
```

**500 Internal Server Error**:
```json
{
  "error": "Internal server error",
  "details": "An unexpected error occurred. Please try again."
}
```

### Retry Logic

**Exponential Backoff**:
- Initial delay: 1 second
- Max delay: 30 seconds
- Max retries: 3
- Backoff multiplier: 2

**Retryable Errors**:
- 429 (Rate Limited)
- 500 (Internal Server Error)
- 502 (Bad Gateway)
- 503 (Service Unavailable)
- 504 (Gateway Timeout)
- Network timeouts

**Non-Retryable Errors**:
- 400 (Bad Request)
- 401 (Unauthorized)
- 403 (Forbidden)
- 404 (Not Found)

---

## Deployment Considerations

### Environment Variables

```env
# Claude API
ANTHROPIC_API_KEY=sk-...

# Supabase
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Feature Flags
ENABLE_AI_BESTIE=true
ENABLE_AI_WINGMAN=true
ENABLE_IMPERSONATION=true

# Rate Limiting
RATE_LIMIT_MESSAGES_PER_MINUTE=10
RATE_LIMIT_MESSAGES_PER_HOUR=100

# AI Loop Prevention
MAX_EXCHANGES_PER_SIDE=10
```

### Database Migrations

```sql
-- Create tables
CREATE TABLE ai_assistant_profiles (...)
CREATE TABLE ai_assistant_conversations (...)
CREATE TABLE ai_assistant_summaries (...)
CREATE TABLE ai_assistant_consent (...)
CREATE TABLE ai_assistant_audit_log (...)

-- Create indexes
CREATE INDEX idx_ai_profiles_user_type ON ai_assistant_profiles(user_id, profile_type)
-- ... (see schema section for all indexes)

-- Enable RLS
ALTER TABLE ai_assistant_profiles ENABLE ROW LEVEL SECURITY
ALTER TABLE ai_assistant_conversations ENABLE ROW LEVEL SECURITY
ALTER TABLE ai_assistant_summaries ENABLE ROW LEVEL SECURITY
ALTER TABLE ai_assistant_consent ENABLE ROW LEVEL SECURITY
ALTER TABLE ai_assistant_audit_log ENABLE ROW LEVEL SECURITY

-- Create RLS policies
CREATE POLICY "Users can view their own profiles" ON ai_assistant_profiles
  FOR SELECT USING (auth.uid() = user_id)
-- ... (see RLS section for all policies)
```

### Monitoring and Observability

**Metrics to Track**:
- AI assistant activation rate
- Average response time
- Error rate by endpoint
- Rate limiting events
- AI loop prevention triggers
- Profile update frequency
- Summary generation success rate

**Logging**:
- Log all API calls with request/response
- Log errors with full stack trace
- Log profile updates with reason
- Log audit events
- Use structured logging (JSON format)

---

## Future Enhancements

1. **Streaming Responses**: Stream Claude responses in real-time for faster perceived performance
2. **Multi-Turn Conversations**: Support longer, more complex conversations with context summarization
3. **Personalized Prompts**: Allow users to customize AI assistant behavior and tone
4. **A/B Testing**: Test different system prompts and response strategies
5. **Analytics Dashboard**: Show user insights about their dating patterns
6. **Integration with Dating Apps**: Direct API integration with Tinder, Bumble, Hinge
7. **Voice Responses**: Generate voice responses for hands-free interaction
8. **Collaborative Mode**: Allow friends to provide input on responses
9. **Predictive Matching**: Use ML to predict match compatibility before messaging
10. **Conversation Replay**: Review past conversations with AI analysis

