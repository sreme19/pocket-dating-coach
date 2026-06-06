/// Archetype catalog (mirrors src/lib/verified-vibe/constants.ts) — id, emoji,
/// name, tag — grouped into the two lanes shown at selection, per gender.
class Archetype {
  final String id;
  final String emoji;
  final String name;
  final String tag;
  const Archetype(this.id, this.emoji, this.name, this.tag);
}

class LaneSection {
  final String label;
  final List<Archetype> archetypes;
  const LaneSection(this.label, this.archetypes);
}

const _man = <String, Archetype>{
  'casual_generous_man': Archetype('casual_generous_man', '💸', 'Casual-Generous', 'Confident, generous, experiences over labels'),
  'rebound_healing_man': Archetype('rebound_healing_man', '🌱', 'Rebound-Healing', 'Recovering, honest, not rushing'),
  'untouched_heart_man': Archetype('untouched_heart_man', '🕊️', 'Untouched-Heart', 'Inexperienced, sincere, going slow'),
  'just_friends_man': Archetype('just_friends_man', '🤝', 'Just-Friends', 'Not looking to date — looking to connect'),
  'traditional_matrimony_man': Archetype('traditional_matrimony_man', '🏛️', 'Traditional-Matrimony', 'Hard set on matrimony, family values'),
  'forever_focused_man': Archetype('forever_focused_man', '🎯', 'Forever-Focused', 'Marriage-minded, intentional, done with games'),
  'hopeless_romantic_man': Archetype('hopeless_romantic_man', '💞', 'Hopeless-Romantic', 'Emotionally intense, chasing the deep thing'),
  'second_chapter_man': Archetype('second_chapter_man', '🔄', 'Second-Chapter', 'Loved or married before, ready to do it right'),
};

const _woman = <String, Archetype>{
  'spoiled_casual_woman': Archetype('spoiled_casual_woman', '✨', 'Spoiled-Casual', 'Luxury vibes, treated well, no pressure'),
  'rebound_healing_woman': Archetype('rebound_healing_woman', '🌿', 'Rebound-Healing', 'Recovering, honest, finding her footing'),
  'untouched_heart_woman': Archetype('untouched_heart_woman', '🌸', 'Untouched-Heart', 'First steps, sincere, no games in her'),
  'just_friends_woman': Archetype('just_friends_woman', '🫂', 'Just-Friends', 'Not looking to date — looking to connect'),
  'traditional_matrimony_woman': Archetype('traditional_matrimony_woman', '🏛️', 'Traditional-Matrimony', 'Family fit, cultural match, matrimony is the goal'),
  'forever_focused_woman': Archetype('forever_focused_woman', '💍', 'Forever-Focused', 'Marriage-minded, knows what she wants'),
  'hopeless_romantic_woman': Archetype('hopeless_romantic_woman', '🌹', 'Hopeless-Romantic', 'Emotionally intense, chasing the deep thing'),
  'second_chapter_woman': Archetype('second_chapter_woman', '🌺', 'Second-Chapter', 'Loved or married before, starting over right'),
};

List<LaneSection> laneSectionsFor(String gender) {
  final m = gender == 'woman' ? _woman : _man;
  final suffix = gender == 'woman' ? '_woman' : '_man';
  return [
    LaneSection('Serious Connection', [
      m['traditional_matrimony$suffix']!,
      m['forever_focused$suffix']!,
      m['hopeless_romantic$suffix']!,
      m['second_chapter$suffix']!,
    ]),
    LaneSection('Low-Pressure', [
      m[(gender == 'woman' ? 'spoiled_casual' : 'casual_generous') + suffix]!,
      m['rebound_healing$suffix']!,
      m['untouched_heart$suffix']!,
      m['just_friends$suffix']!,
    ]),
  ];
}
