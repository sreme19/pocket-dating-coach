# AI Assistants Integration Guide

## Overview
This document describes how to integrate the AI Bestie and AI Wingman assistants into the verified-vibe chat interface.

## Components Created

### Backend
1. **API Endpoints**
   - `POST /api/ai-assistant/chat` - Send message to AI assistant
   - `POST /api/ai-assistant/conversations` - Create new AI assistant conversation
   - `GET /api/ai-assistant/conversations` - List user's AI assistant conversations
   - `GET /api/ai-assistant/conversations/[conversationId]` - Get specific conversation
   - `PATCH /api/ai-assistant/conversations/[conversationId]` - Update conversation messages
   - `DELETE /api/ai-assistant/conversations/[conversationId]` - Delete conversation

2. **Database Schema**
   - `ai_assistant_conversations` table with RLS policies
   - Indexes for performance optimization

3. **Prompts**
   - `buildAIBestieSystemPrompt()` - Female-specific assistant prompt
   - `buildAIWingmanSystemPrompt()` - Male-specific assistant prompt
   - `buildAIAssistantContextPrompt()` - Context-aware prompt builder

### Frontend Components
1. **AIAssistantPanel.svelte**
   - Main chat interface for AI assistant
   - Message history display
   - Input field with send button
   - Loading states and error handling
   - Responsive design

2. **AIAssistantToggle.svelte**
   - Button to open/close assistant panel
   - Shows assistant name and emoji
   - Unread badge support
   - Mobile-optimized

## Integration Steps

### Step 1: Update Chat Page Layout
Modify `/src/routes/verified-vibe/chat/[conversationId]/+page.svelte`:

```svelte
<script lang="ts">
  import AIAssistantPanel from '$lib/verified-vibe/components/AIAssistantPanel.svelte';
  import AIAssistantToggle from '$lib/verified-vibe/components/AIAssistantToggle.svelte';
  
  let aiAssistantOpen = $state(false);
  let assistantType = $state<'bestie' | 'wingman'>('bestie'); // Determine based on user gender
  
  // In onMount, determine assistant type based on user profile
  onMount(async () => {
    // ... existing code ...
    
    // Determine assistant type based on user gender
    if ($user?.gender === 'woman') {
      assistantType = 'bestie';
    } else if ($user?.gender === 'man') {
      assistantType = 'wingman';
    }
  });
</script>

<!-- Add to chat interface layout -->
<div class="chat-interface-screen">
  <!-- Existing header, messages, input -->
  
  <!-- AI Assistant Panel (sidebar on desktop, modal on mobile) -->
  <AIAssistantPanel
    {assistantType}
    matchConversationId={conversationId}
    recentMessages={$messages}
    matchedUserProfile={$currentMatch}
    isOpen={aiAssistantOpen}
    onClose={() => aiAssistantOpen = false}
  />
</div>

<!-- Add toggle button to header or toolbar -->
<AIAssistantToggle
  {assistantType}
  isOpen={aiAssistantOpen}
  onToggle={() => aiAssistantOpen = !aiAssistantOpen}
/>
```

### Step 2: Update Chat Layout CSS
Add responsive layout for AI assistant panel:

```css
.chat-interface-screen {
  display: grid;
  grid-template-columns: 1fr;
  height: 100%;
}

@media (min-width: 1024px) {
  .chat-interface-screen {
    grid-template-columns: 1fr 350px;
  }
  
  .ai-assistant-panel {
    border-left: 1px solid var(--border-1);
  }
}

@media (max-width: 768px) {
  .ai-assistant-panel {
    position: fixed;
    bottom: 0;
    right: 0;
    width: 100%;
    height: 50vh;
    z-index: 40;
  }
}
```

### Step 3: Determine Assistant Type
The assistant type should be determined based on the current user's gender:
- Female users → AI Bestie
- Male users → AI Wingman

This information should come from the user's profile in the verified-vibe system.

### Step 4: Pass Context to Assistant
The AI assistant needs:
- Recent match messages (for context)
- Matched user profile (gender, age, goals)
- Current user profile (for personalization)

This is automatically handled by the AIAssistantPanel component.

## Database Setup

Run the migration script in Supabase:
```sql
-- Run scripts/create-ai-assistant-schema.sql in Supabase SQL editor
```

## Environment Variables
No additional environment variables needed. Uses existing:
- `PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Testing

### Manual Testing
1. Open a verified-vibe chat conversation
2. Click the AI assistant toggle button
3. Ask a question about the conversation
4. Verify the assistant provides contextual advice
5. Check that messages are saved to database

### Test Cases
- [ ] AI Bestie appears for female users
- [ ] AI Wingman appears for male users
- [ ] Messages are saved to database
- [ ] Conversation history is maintained
- [ ] Citations are properly formatted
- [ ] Mobile layout works correctly
- [ ] Error handling works properly

## Performance Considerations

1. **Message Pagination**: For long conversations, implement pagination to avoid loading all messages
2. **Debouncing**: Input debouncing is handled by the component
3. **Caching**: Consider caching AI assistant conversations in local storage
4. **Rate Limiting**: Implement rate limiting on the API endpoint

## Future Enhancements

1. **Suggestions**: Show AI-generated suggestions without user input
2. **Quick Actions**: Pre-built prompts for common questions
3. **Analytics**: Track which questions users ask most
4. **Personalization**: Learn user preferences over time
5. **Multi-language**: Support for multiple languages
6. **Voice Input**: Allow voice messages to the assistant

## Troubleshooting

### Assistant not appearing
- Check that user profile has gender set
- Verify database schema is created
- Check browser console for errors

### Messages not saving
- Verify RLS policies are correct
- Check Supabase connection
- Verify user is authenticated

### Slow responses
- Check Claude API rate limits
- Verify book chunks are being retrieved
- Check database query performance

## Files Modified/Created

### Created
- `/src/routes/api/ai-assistant/chat/+server.ts`
- `/src/routes/api/ai-assistant/conversations/+server.ts`
- `/src/routes/api/ai-assistant/conversations/[conversationId]/+server.ts`
- `/src/lib/verified-vibe/components/AIAssistantPanel.svelte`
- `/src/lib/verified-vibe/components/AIAssistantToggle.svelte`
- `/scripts/create-ai-assistant-schema.sql`

### Modified
- `/src/lib/types.ts` - Added AI assistant types
- `/src/lib/prompts.ts` - Added AI assistant prompts
- `/src/routes/verified-vibe/chat/[conversationId]/+page.svelte` - Integration (TODO)

## Next Steps

1. Run database migration
2. Integrate components into chat page
3. Test with real conversations
4. Gather user feedback
5. Iterate on prompts and UX
