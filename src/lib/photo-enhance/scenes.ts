import type { PhotoRole } from './types';

export interface Scene {
  role: PhotoRole;
  label: string;
  prompt: string;
}

// Scenes are ordered by photo story role priority
const CASUAL_MAN_SCENES: Scene[] = [
  {
    role: 'lead',
    label: 'Lead photo',
    prompt: 'confident man, casual smart outfit, natural window light, shallow depth of field, clean background, genuine relaxed expression, portrait style'
  },
  {
    role: 'warmth',
    label: 'Coffee shop',
    prompt: 'man in a cozy coffee shop, warm morning light, casual outfit, genuine smile, looking at camera, soft bokeh background'
  },
  {
    role: 'lifestyle',
    label: 'Outdoors',
    prompt: 'man outdoors on a weekend, natural daylight, relaxed and confident, park or city street, candid feel'
  },
  {
    role: 'conversation',
    label: 'Evening social',
    prompt: 'man at a casual dinner or bar setting, soft warm evening lighting, relaxed expression, social atmosphere'
  },
  {
    role: 'social',
    label: 'Rooftop',
    prompt: 'man on a rooftop or outdoor terrace, golden hour lighting, city skyline background, confident and relaxed'
  }
];

const MARRIAGE_MINDED_MAN_SCENES: Scene[] = [
  {
    role: 'lead',
    label: 'Lead photo',
    prompt: 'polished man, smart casual outfit, natural window light, warm tones, genuine confident expression, portrait style'
  },
  {
    role: 'warmth',
    label: 'Home setting',
    prompt: 'man in a warm home environment, natural light, relaxed and comfortable, genuine smile, inviting atmosphere'
  },
  {
    role: 'lifestyle',
    label: 'Active outdoors',
    prompt: 'man outdoors on a weekend hike or park, natural daylight, healthy and energetic, candid feel'
  },
  {
    role: 'conversation',
    label: 'Upscale dining',
    prompt: 'man at an upscale restaurant, refined setting, warm candlelight, engaged and present expression'
  },
  {
    role: 'social',
    label: 'Travel',
    prompt: 'man at a scenic travel destination, natural light, confident and curious expression, beautiful background'
  }
];

export const SCENES_BY_ARCHETYPE: Record<string, Scene[]> = {
  casual_man: CASUAL_MAN_SCENES,
  marriage_minded_man: MARRIAGE_MINDED_MAN_SCENES,
  // Fall back to casual for unknown archetypes
  spoilt_woman: CASUAL_MAN_SCENES,
  safety_first_woman: MARRIAGE_MINDED_MAN_SCENES
};

export function getScenesForArchetype(archetype: string, count = 5): Scene[] {
  const scenes = SCENES_BY_ARCHETYPE[archetype] ?? CASUAL_MAN_SCENES;
  return scenes.slice(0, Math.min(count, scenes.length));
}
