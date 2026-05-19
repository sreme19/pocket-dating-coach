import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export const POST: RequestHandler = async ({ request }) => {
  const { intake, photoLabels, archetype, trustScore } = await request.json();

  const archetypeLabel =
    archetype === 'marriage_minded_man' ? 'marriage-minded man' : 'casual man';

  const prompt = `You are writing a dating profile for a real person. Keep it authentic, specific, and a little bit interesting — not generic.

User details:
- Name: ${intake.firstName}, Age: ${intake.age}, City: ${intake.city}
- Archetype: ${archetypeLabel}
- Their own words about themselves: "${intake.about}"
- Looking for: ${intake.lookingFor}
- Personality tags they chose: ${intake.personalityTags.join(', ')}
- Interests: ${intake.interests.length > 0 ? intake.interests.join(', ') : 'not specified'}
- Photo story roles uploaded: ${photoLabels.length > 0 ? photoLabels.join(', ') : 'none yet'}
- Trust score: ${trustScore}/100

Write a JSON response (no markdown fences) with exactly these fields:
{
  "about": "2-3 sentence bio. First person, present tense. Grounded and specific — reference something concrete from their description. Not cliché. Max 180 chars.",
  "personalityDescriptors": ["3 single adjectives that feel earned, not generic"],
  "intentStatement": "One sentence on what kind of connection he's after. Honest and specific.",
  "lifestyleTags": ["4-5 short lifestyle chips, max 3 words each, things a match would actually care about"]
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    // Strip markdown fences if present (Claude 4.x wraps JSON in ```json blocks)
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const generated = JSON.parse(cleaned);

    return json(generated);
  } catch (err) {
    console.error('generate-profile error:', err);
    // Return a safe fallback so the profile page still works
    return json({
      about: intake.about,
      personalityDescriptors: intake.personalityTags.slice(0, 3),
      intentStatement: intake.lookingFor,
      lifestyleTags: intake.interests.slice(0, 5)
    });
  }
};
