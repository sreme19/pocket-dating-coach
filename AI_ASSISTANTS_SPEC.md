# AI Assistants Feature Spec (PDC-28 & PDC-29)

## Overview
Implement two AI assistant features:
- **AI Bestie** (PDC-28): Chat assistant for female profiles in verified-vibe matching
- **AI Wingman** (PDC-29): Chat assistant for male profiles in verified-vibe matching

These assistants provide real-time dating advice and conversation guidance during active matches.

## Requirements

### PDC-28: AI Bestie (Female Profile Assistant)
- Appears in female user's chat interface during verified-vibe matches
- Provides real-time advice on:
  - How to respond to messages from matched males
  - Conversation strategy and tone
  - Safety and boundary-setting guidance
  - Confidence-building insights
- Accessible via a sidebar or modal in the chat interface
- Uses the existing book context and female-specific prompts
- Maintains conversation history for context

### PDC-29: AI Wingman (Male Profile Assistant)
- Appears in male user's chat interface during verified-vibe matches
- Provides real-time advice on:
  - How to respond to messages from matched females
  - Conversation strategy and tone
  - Authenticity and genuine connection guidance
  - Confidence-building insights
- Accessible via a sidebar or modal in the chat interface
- Uses the existing book context and male-specific prompts
- Maintains conversation history for context

## Technical Implementation

### Database Schema
Add to Supabase:
```sql
-- AI Assistant conversations table
CREATE TABLE ai_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  match_conversation_id UUID NOT NULL,
  assistant_type TEXT NOT NULL CHECK (assistant_type IN ('bestie', 'wingman')),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_assistant_conversations_user_id ON ai_assistant_conversations(user_id);
CREATE INDEX idx_ai_assistant_conversations_match_conversation_id ON ai_assistant_conversations(match_conversation_id);
```

### API Endpoints

#### POST /api/ai-assistant/chat
Request:
```json
{
  "conversationId": "uuid",
  "assistantType": "bestie" | "wingman",
  "messages": [
    { "role": "user" | "assistant", "content": "..." }
  ],
  "matchContext": {
    "matchedUserProfile": { ... },
    "recentMessages": [ ... ]
  }
}
```

Response:
```json
{
  "reply": "...",
  "citations": ["Based on: ..."],
  "suggestions": ["..."]
}
```

#### GET /api/ai-assistant/conversations/:conversationId
Returns the AI assistant conversation history for a given match.

#### POST /api/ai-assistant/conversations
Creates a new AI assistant conversation linked to a match conversation.

### Frontend Components

#### AIAssistantPanel.svelte
- Sidebar or modal component
- Shows assistant name (AI Bestie / AI Wingman)
- Displays conversation history
- Input field for user questions
- Loading states and error handling
- Responsive design for mobile

#### AIAssistantToggle.svelte
- Button to open/close assistant panel
- Badge showing unread suggestions
- Accessible keyboard shortcuts

### Prompts

#### AI Bestie System Prompt
- Warm, supportive tone
- Female-specific dating advice
- Emphasis on safety, boundaries, and authenticity
- References book principles adapted for women
- Conversational and encouraging

#### AI Wingman System Prompt
- Confident, practical tone
- Male-specific dating advice
- Emphasis on authenticity and genuine connection
- References book principles directly
- Conversational and motivating

### Integration Points

1. **Verified-Vibe Chat Interface**
   - Add AI assistant toggle button
   - Integrate panel into chat layout
   - Share match context with assistant

2. **Message Context**
   - Pass recent match messages to assistant
   - Include matched user profile info
   - Maintain conversation history

3. **User Profile**
   - Use existing user profile data
   - Leverage gender and relationship goal info
   - Reference user's communication style

## Implementation Phases

### Phase 1: Backend Infrastructure
- [ ] Create database schema
- [ ] Implement API endpoints
- [ ] Add authentication/authorization
- [ ] Create system prompts

### Phase 2: Frontend Components
- [ ] Build AIAssistantPanel component
- [ ] Build AIAssistantToggle component
- [ ] Integrate into chat interface
- [ ] Add styling and responsive design

### Phase 3: Integration
- [ ] Connect to verified-vibe chat
- [ ] Pass context between components
- [ ] Test with real conversations
- [ ] Add error handling

### Phase 4: Polish & Testing
- [ ] User testing
- [ ] Performance optimization
- [ ] Accessibility review
- [ ] Documentation

## Success Criteria
- AI assistants appear in verified-vibe chat for both genders
- Users can ask questions and receive contextual advice
- Advice is grounded in book principles
- Conversation history is maintained
- Mobile-responsive design
- No performance degradation in main chat
