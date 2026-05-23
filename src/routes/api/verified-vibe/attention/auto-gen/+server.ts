/**
 * POST /api/verified-vibe/attention/auto-gen
 *
 * Generates an AI-written attention message (≤500 chars) using:
 *   - Sender's personality profile
 *   - Recipient's preferences profile
 *
 * Body: { senderId, recipientId, messageType }
 * Response: { text: string }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { loadPersonality, loadPreferences } from '$lib/server/profile-service';
import { getSupabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as {
      senderId?: string;
      recipientId?: string;
      messageType?: string;
      tone?: string;
    };

    const senderId    = body.senderId?.trim();
    const recipientId = body.recipientId?.trim();
    const messageType = body.messageType?.trim();
    const tone        = (body.tone?.trim() ?? 'flirty') as 'flirty' | 'professional' | 'practical' | 'bold';

    if (!senderId || !recipientId || !messageType) {
      return json({ error: 'senderId, recipientId and messageType are required' }, { status: 400 });
    }

    // Load sender personality
    let senderCtx = '';
    try {
      const p = await loadPersonality(senderId);
      const parts: string[] = [];
      if (p.communicationStyle) parts.push(`Communication style: ${p.communicationStyle}`);
      if (p.personalityVibe)    parts.push(`Vibe: ${p.personalityVibe}`);
      if (p.mattersMost)        parts.push(`What matters most to them: ${p.mattersMost}`);
      if (p.values?.length)     parts.push(`Values: ${p.values.join(', ')}`);
      if (parts.length) senderCtx = `Sender's personality:\n${parts.join('\n')}`;
    } catch { /* skip */ }

    // Load recipient preferences
    let recipientCtx = '';
    try {
      const prefs = await loadPreferences(recipientId);
      const parts: string[] = [];
      if (prefs.emotionalSignals?.length) parts.push(`Values: ${prefs.emotionalSignals.slice(0, 3).join(', ')}`);
      if (prefs.dealbreakers?.length)     parts.push(`Turn-offs: ${prefs.dealbreakers.slice(0, 2).join(', ')}`);
      if (prefs.maturitySignals?.length)  parts.push(`Attracted to: ${prefs.maturitySignals.slice(0, 2).join(', ')}`);
      if (parts.length) recipientCtx = `What appeals to the recipient:\n${parts.join('\n')}`;
    } catch { /* skip */ }

    // Also load recipient's basic profile for context
    const supabase = getSupabase();
    const { data: recipientProfile } = await supabase
      .from('verified_vibe_users')
      .select('first_name, about, archetype')
      .eq('id', recipientId)
      .single();

    const recipientName = recipientProfile?.first_name ?? 'them';
    const recipientAbout = recipientProfile?.about ? `Their bio: "${recipientProfile.about.slice(0, 120)}"` : '';

    const isSecretAdmirer = messageType === 'secret_admirer';

    const TONE_GUIDES: Record<string, string> = {
      flirty:       'Playful and flirty — light romantic energy, tasteful use of 1-2 emojis, a hint of chemistry without being over the top.',
      professional: 'Polished and composed — confident, no emojis, articulate. Like a message from someone who knows their worth.',
      practical:    'Direct and grounded — clear intent, conversational, no fluff. Gets straight to the point without being blunt.',
      bold:         'Confident and memorable — makes a real impression, stands out from every generic opener, unapologetically self-assured.',
    };

    const toneGuide = TONE_GUIDES[tone] ?? TONE_GUIDES.flirty;

    const systemPrompt = isSecretAdmirer
      ? `You are writing a "Secret Admirer" message for a woman who wants to express interest in a man she saw on a dating app.
Tone: ${toneGuide}
Also ensure the message is:
- Personal (reference his personality or bio without being creepy)
- Under 500 characters — ideally 2-3 sentences
- Natural and authentic, not AI-sounding
- No generic compliments like "you're so handsome"
Output ONLY the message text. No quotes, no intro, no explanation.`
      : `You are writing a "Craving Attention" message for a man who wants to get noticed by a woman he saw on a dating app.
Tone: ${toneGuide}
Also ensure the message is:
- Personal (reference her personality or bio without being pushy)
- Under 500 characters — ideally 2-3 sentences
- Conversation-starting, not just a compliment
- No generic openers like "hey" or "you're beautiful"
Output ONLY the message text. No quotes, no intro, no explanation.`;

    const userPrompt = [
      senderCtx,
      recipientCtx,
      recipientAbout,
      `Recipient's name: ${recipientName}`,
    ].filter(Boolean).join('\n\n');

    const client = getClaudeClient();
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt || `Write a message to ${recipientName}.` }]
    });

    const block = response.content[0];
    let text = block.type === 'text' ? block.text.trim() : '';

    // Enforce 500 char limit (Claude should already comply, but safety net)
    if (text.length > 500) text = text.slice(0, 497) + '…';

    return json({ text });
  } catch (err) {
    console.error('[Attention auto-gen]', err);
    return json({ error: 'Failed to generate message' }, { status: 500 });
  }
};
