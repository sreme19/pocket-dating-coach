import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'config.dart';

// ── Inferred (cross-section) signal styling ──────────────────────────────────
// Some insights are lifted from a DIFFERENT upload than the section they appear
// in (e.g. a passport stamp seen in a Lifestyle photo → Travel). They're marked
// with a ✦ and a violet tint so viewers can tell them apart from directly-
// verified signals. `from` is the source proof category.
const _inferredColor = Color(0xFF8B6FD6);
const _fromLabels = <String, String>{
  'lifestyle': 'Lifestyle', 'hosting': 'Social', 'social_proof': 'Social',
  'discipline': 'Health', 'linkedin': 'Career', 'travel': 'Travel',
  'spending': 'Money', 'wealth': 'Money', 'assets': 'Garage',
};
String _prettyFrom(String? from) => from == null ? '' : (_fromLabels[from] ?? from);
String _inferredTip(String? from) =>
    from != null ? 'Inferred from your ${_prettyFrom(from)} upload' : 'Inferred from another upload';

/// Shared rich "Public Read" body for a [MatchDetail] — used inline on Discover
/// (and anywhere a full profile is shown). Renders everything below the photo,
/// in the same section order as the web.
List<Widget> richProfileBody(BuildContext context, MatchDetail d) {
  // Non-hero photos, woven through the sections so they reveal on scroll rather
  // than sitting in a grid (MVP "Layout in the Public Read").
  final reveal = d.photos.length > 1 ? d.photos.sublist(1) : const <({String url, bool ai})>[];
  Widget? revealAt(int i) => i < reveal.length ? photoReveal(reveal[i].url, reveal[i].ai) : null;
  return [
    Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(d.age != null ? '${d.name}, ${d.age}' : d.name,
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: Color(Config.text1))),
        const SizedBox(height: 6),
        if (d.city != null)
          Row(children: [
            const Icon(Icons.location_on_outlined, size: 16, color: Color(Config.text2)),
            const SizedBox(width: 4),
            Text(d.city!, style: const TextStyle(color: Color(Config.text2))),
          ]),
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, children: [
          pPill('${d.archetypeEmoji} ${d.archetypeLabel}', bg: const Color(0x33A855F7), fg: const Color(0xFF7C3AED)),
          for (final w in d.vibeWords) pPill(w),
        ]),
      ]),
    ),
    if (revealAt(0) != null) revealAt(0)!,
    if (d.hereFor != null && d.hereFor!.isNotEmpty)
      pSection('🧭 HERE FOR', Text(d.hereFor!, style: const TextStyle(color: Color(Config.text1), fontSize: 16, height: 1.4))),
    // Personality Reads (radar) — use server scores when available, else archetype defaults.
    pSection('🧠 PERSONALITY READS',
      PersonalityRadar(traits: d.traitScores ?? _archetypeBaseScores(d.archetypeLabel)),
      hint: 'inferred from Q&A + lifestyle'),
    if (d.about != null && d.about!.isNotEmpty)
      pSection('ABOUT', Text(d.about!, style: const TextStyle(color: Color(Config.text1), fontSize: 16, height: 1.5))),
    if (d.archetypeChips.isNotEmpty)
      pSection('MY DATING STYLE', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final g in d.archetypeChips) ...[
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 6),
            child: Text(g.label, style: const TextStyle(fontSize: 13, color: Color(Config.text2), fontWeight: FontWeight.w600)),
          ),
          Wrap(spacing: 8, runSpacing: 8, children: g.chips.map((c) => pPill(c)).toList()),
          const SizedBox(height: 8),
        ],
      ])),
    if (revealAt(1) != null) revealAt(1)!,
    if (d.whatBrings.isNotEmpty)
      pSection('WHAT ${d.name.toUpperCase()} BRINGS', Column(children: [
        for (final b in d.whatBrings)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 7),
            child: Row(children: [
              Text(b.emoji, style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 12),
              Expanded(child: Text(b.text, style: const TextStyle(fontSize: 15, color: Color(Config.text1)))),
              const Icon(Icons.check_circle, size: 18, color: Color(Config.accent)),
            ]),
          ),
      ])),
    if (d.annualIncome != null || d.netWorth != null || d.careerLines.isNotEmpty || d.wealthInsights.isNotEmpty)
      pSection('💰 MONEY MATTERS', moneyMattersCard(
        income: d.annualIncome,
        netWorth: d.netWorth,
        tiles: [
          for (final c in d.careerLines) (c.emoji, c.label, c.inferred, c.from),
          for (final c in d.wealthInsights) (c.emoji, c.label, c.inferred, c.from),
        ],
        footer: d.annualIncome != null || d.netWorth != null
            ? '✓ AI verified via bank statement / financial document'
            : null,
      )),
    if (revealAt(2) != null) revealAt(2)!,
    if (d.personalityPortraitUrl != null)
      pSection('✨ AI PORTRAIT', _portrait(d.personalityPortraitUrl!), hint: 'generated from photos'),
    if (d.garagePortraitUrl != null)
      pSection('✨ AI LIFESTYLE PORTRAIT', _portrait(d.garagePortraitUrl!), hint: 'generated from photos'),
    if (revealAt(3) != null) revealAt(3)!,
    if (d.verifiedSignals.isNotEmpty)
      pSection('🛡 VERIFIED SIGNALS', SignalTabs(signals: d.verifiedSignals)),
    if (d.garage.isNotEmpty)
      pSection('🏎️ GARAGE', Column(children: d.garage.map((car) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: const Color(Config.bg3), borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          const Text('🚗', style: TextStyle(fontSize: 24)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(car.title, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
            if (car.vehicleType != null && car.vehicleType!.isNotEmpty)
              Text(car.vehicleType!, style: const TextStyle(fontSize: 13, color: Color(Config.text2))),
            if ([car.color, car.year].any((s) => s != null && s!.isNotEmpty))
              Text([car.color, car.year].where((s) => s != null && s!.isNotEmpty).join(' · '),
                  style: const TextStyle(fontSize: 12, color: Color(Config.text3))),
            if (car.inferred)
              Text('✦ Seen in your ${_prettyFrom(car.from)} photos',
                  style: const TextStyle(fontSize: 12, color: _inferredColor))
            else
              const Text('✅ Ownership verified', style: TextStyle(fontSize: 12, color: Color(Config.accent))),
          ])),
        ]),
      )).toList())),
    if (revealAt(4) != null) revealAt(4)!,
    if (d.travel.isNotEmpty)
      pSection('✈️ TRAVEL MAGNETS', travelMagnets(d.travel), hint: 'detected from uploads'),
  ];
}

/// A profile photo woven between sections. Full-bleed rounded card; AI-enhanced
/// portraits (men) carry a "generated from verified photos" badge.
Widget photoReveal(String url, bool ai) {
  return Padding(
    padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Stack(children: [
        CachedNetworkImage(
          imageUrl: url,
          fit: BoxFit.cover,
          width: double.infinity,
          placeholder: (c, _) => Container(height: 320, color: const Color(Config.bg3)),
          errorWidget: (c, _, _) => const SizedBox.shrink(),
        ),
        if (ai)
          Positioned(
            left: 10, bottom: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0x9E1B1020),
                borderRadius: BorderRadius.circular(999),
              ),
              child: const Text('✨ Generated from verified photos',
                  style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
            ),
          ),
      ]),
    ),
  );
}

/// AI portrait image (rounded, with a caption strip).
Widget _portrait(String url) {
  return ClipRRect(
    borderRadius: BorderRadius.circular(14),
    child: Stack(children: [
      CachedNetworkImage(imageUrl: url, fit: BoxFit.cover, width: double.infinity,
          placeholder: (c, _) => Container(height: 200, color: const Color(Config.bg3)),
          errorWidget: (c, _, _) => const SizedBox.shrink()),
      const Positioned(left: 10, bottom: 8,
          child: Text('✨ Generated from verified photos', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600))),
    ]),
  );
}

/// Archetype-based trait score fallback when server doesn't return traitScores yet.
/// Must stay in sync with deriveTraitScores base map in public-profile/+server.ts.
Map<String, int> _archetypeBaseScores(String archetypeLabel) {
  const scores = <String, Map<String, int>>{
    'casual_generous_man':       {'decisiveness': 80, 'warmth': 65, 'openness': 70, 'pace': 75},
    'hopeless_romantic_man':     {'decisiveness': 62, 'warmth': 90, 'openness': 75, 'pace': 55},
    'rebound_healing_man':       {'decisiveness': 55, 'warmth': 70, 'openness': 65, 'pace': 50},
    'untouched_heart_man':       {'decisiveness': 60, 'warmth': 75, 'openness': 80, 'pace': 60},
    'forever_focused_man':       {'decisiveness': 75, 'warmth': 80, 'openness': 60, 'pace': 55},
    'traditional_matrimony_man': {'decisiveness': 80, 'warmth': 75, 'openness': 50, 'pace': 50},
    'second_chapter_man':        {'decisiveness': 78, 'warmth': 75, 'openness': 65, 'pace': 50},
    'just_friends_man':          {'decisiveness': 55, 'warmth': 70, 'openness': 80, 'pace': 65},
    'spoiled_casual_woman':          {'decisiveness': 70, 'warmth': 60, 'openness': 70, 'pace': 65},
    'hopeless_romantic_woman':       {'decisiveness': 60, 'warmth': 90, 'openness': 70, 'pace': 55},
    'rebound_healing_woman':         {'decisiveness': 55, 'warmth': 70, 'openness': 65, 'pace': 50},
    'untouched_heart_woman':         {'decisiveness': 60, 'warmth': 75, 'openness': 82, 'pace': 60},
    'forever_focused_woman':         {'decisiveness': 75, 'warmth': 82, 'openness': 58, 'pace': 52},
    'traditional_matrimony_woman':   {'decisiveness': 78, 'warmth': 78, 'openness': 48, 'pace': 48},
    'second_chapter_woman':          {'decisiveness': 78, 'warmth': 75, 'openness': 65, 'pace': 50},
    'just_friends_woman':            {'decisiveness': 55, 'warmth': 72, 'openness': 80, 'pace': 65},
  };
  return scores[archetypeLabel] ?? {'decisiveness': 65, 'warmth': 70, 'openness': 65, 'pace': 60};
}

// ── Playful shared sections ──────────────────────────────────────────────────

const _flagFor = <String, String>{
  // Americas
  'usa': '🇺🇸', 'united states': '🇺🇸', 'america': '🇺🇸',
  'california': '🇺🇸', 'new york': '🇺🇸', 'los angeles': '🇺🇸', 'miami': '🇺🇸',
  'chicago': '🇺🇸', 'las vegas': '🇺🇸', 'hawaii': '🇺🇸', 'texas': '🇺🇸', 'florida': '🇺🇸',
  'canada': '🇨🇦', 'toronto': '🇨🇦', 'vancouver': '🇨🇦',
  'mexico': '🇲🇽', 'cancun': '🇲🇽',
  'brazil': '🇧🇷', 'rio': '🇧🇷',
  'argentina': '🇦🇷', 'peru': '🇵🇪', 'colombia': '🇨🇴',
  // Europe
  'uk': '🇬🇧', 'united kingdom': '🇬🇧', 'england': '🇬🇧', 'london': '🇬🇧', 'scotland': '🇬🇧',
  'france': '🇫🇷', 'paris': '🇫🇷',
  'italy': '🇮🇹', 'rome': '🇮🇹', 'milan': '🇮🇹', 'venice': '🇮🇹', 'amalfi': '🇮🇹',
  'spain': '🇪🇸', 'madrid': '🇪🇸', 'barcelona': '🇪🇸',
  'germany': '🇩🇪', 'berlin': '🇩🇪', 'munich': '🇩🇪',
  'switzerland': '🇨🇭', 'zurich': '🇨🇭',
  'portugal': '🇵🇹', 'lisbon': '🇵🇹',
  'netherlands': '🇳🇱', 'amsterdam': '🇳🇱',
  'greece': '🇬🇷', 'athens': '🇬🇷', 'santorini': '🇬🇷', 'mykonos': '🇬🇷',
  'turkey': '🇹🇷', 'istanbul': '🇹🇷',
  'austria': '🇦🇹', 'vienna': '🇦🇹',
  'sweden': '🇸🇪', 'stockholm': '🇸🇪',
  'norway': '🇳🇴', 'oslo': '🇳🇴',
  'denmark': '🇩🇰', 'copenhagen': '🇩🇰',
  'finland': '🇫🇮', 'helsinki': '🇫🇮',
  'iceland': '🇮🇸', 'reykjavik': '🇮🇸', 'reykjavík': '🇮🇸',
  'skógafoss': '🇮🇸', 'skogafoss': '🇮🇸', 'geysir': '🇮🇸', 'jokulsarlon': '🇮🇸',
  'poland': '🇵🇱', 'warsaw': '🇵🇱',
  'czech republic': '🇨🇿', 'prague': '🇨🇿',
  'hungary': '🇭🇺', 'budapest': '🇭🇺',
  'croatia': '🇭🇷', 'dubrovnik': '🇭🇷',
  // Middle East & Africa
  'uae': '🇦🇪', 'dubai': '🇦🇪', 'abu dhabi': '🇦🇪',
  'saudi arabia': '🇸🇦',
  'egypt': '🇪🇬', 'cairo': '🇪🇬',
  'morocco': '🇲🇦', 'marrakech': '🇲🇦',
  'south africa': '🇿🇦', 'cape town': '🇿🇦',
  'kenya': '🇰🇪', 'nairobi': '🇰🇪',
  // Asia
  'japan': '🇯🇵', 'tokyo': '🇯🇵', 'osaka': '🇯🇵', 'kyoto': '🇯🇵',
  'south korea': '🇰🇷', 'korea': '🇰🇷', 'seoul': '🇰🇷',
  'china': '🇨🇳', 'beijing': '🇨🇳', 'shanghai': '🇨🇳',
  'hong kong': '🇭🇰',
  'taiwan': '🇹🇼', 'taipei': '🇹🇼',
  'singapore': '🇸🇬',
  'thailand': '🇹🇭', 'bangkok': '🇹🇭', 'phuket': '🇹🇭', 'chiang mai': '🇹🇭',
  'vietnam': '🇻🇳', 'hanoi': '🇻🇳', 'ho chi minh': '🇻🇳', 'hoi an': '🇻🇳', 'da nang': '🇻🇳',
  'cambodia': '🇰🇭', 'siem reap': '🇰🇭',
  'malaysia': '🇲🇾', 'kuala lumpur': '🇲🇾',
  'indonesia': '🇮🇩', 'bali': '🇮🇩', 'jakarta': '🇮🇩', 'lombok': '🇮🇩',
  'india': '🇮🇳', 'mumbai': '🇮🇳', 'delhi': '🇮🇳', 'goa': '🇮🇳', 'rajasthan': '🇮🇳',
  'maldives': '🇲🇻', 'sri lanka': '🇱🇰',
  'nepal': '🇳🇵', 'kathmandu': '🇳🇵',
  'philippines': '🇵🇭', 'manila': '🇵🇭', 'cebu': '🇵🇭',
  // Oceania
  'australia': '🇦🇺', 'sydney': '🇦🇺', 'melbourne': '🇦🇺',
  'new zealand': '🇳🇿', 'auckland': '🇳🇿',
};

/// Pastel "fridge magnet" palette: (bg, border, text).
// Light-theme variant: each magnet keeps its hue wash (over cream) but the text
// is darkened to a saturated tone so it reads on the light surface.
const _magnetColors = <(int, int, int)>[
  (0x33F59E0B, 0x66F59E0B, 0xFFB45309), // peach
  (0x333B82F6, 0x663B82F6, 0xFF1D4ED8), // sky
  (0x3310B981, 0x6610B981, 0xFF047857), // mint
  (0x33A855F7, 0x66A855F7, 0xFF7C3AED), // lavender
  (0x33EC4899, 0x66EC4899, 0xFFE11D54), // rose
  (0x3314B8A6, 0x6614B8A6, 0xFF0F766E), // teal
];

String _magnetEmoji(String place) {
  // Strip parentheticals like "(Likely)" or "(Probably)" added by AI confidence notes
  final cleaned = place.replaceAll(RegExp(r'\s*\([^)]*\)'), '').toLowerCase().trim();
  // Try each comma-separated part (e.g. "California, USA" → try "california" then "usa")
  for (final part in cleaned.split(',').map((p) => p.trim())) {
    if (_flagFor.containsKey(part)) return _flagFor[part]!;
  }
  // Fallback: check if any flag key appears as a substring of the cleaned place name
  for (final entry in _flagFor.entries) {
    if (cleaned.contains(entry.key)) return entry.value;
  }
  return '🌍';
}

/// Travel magnets rendered like real colorful fridge magnets (varied pastel
/// colors + slight rotations).
Widget travelMagnets(List<String> places) {
  return Wrap(
    spacing: 10, runSpacing: 12,
    children: [
      for (var i = 0; i < places.length; i++)
        Transform.rotate(
          angle: ((i * 37) % 7 - 3) * 0.018, // deterministic ~ -3°..+3°
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Color(_magnetColors[i % _magnetColors.length].$1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Color(_magnetColors[i % _magnetColors.length].$2), width: 1.5),
              boxShadow: const [BoxShadow(color: Color(0x55000000), blurRadius: 6, offset: Offset(0, 3))],
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(_magnetEmoji(places[i]), style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 7),
              Text(places[i].toUpperCase(),
                  style: TextStyle(color: Color(_magnetColors[i % _magnetColors.length].$3),
                      fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.3)),
            ]),
          ),
        ),
    ],
  );
}

String _moneyEmoji(String? val) {
  if (val == null) return '💰';
  if (val.contains('A\$') || val.contains('C\$') || val.contains('S\$')) return '💵';
  if (val.contains('€')) return '💶';
  if (val.contains('£')) return '💷';
  if (val.contains('¥')) return '💴';
  if (val.contains('₹')) return '🪙';
  return '💵'; // default USD / other $
}

/// If [val] is a plain integer/decimal string (no currency symbols or letters),
/// add comma separators so "1000000" → "1,000,000".
/// Otherwise return as-is (range strings like "₹25L – ₹50L" are already readable).
String _formatMoneyValue(String val) {
  final trimmed = val.trim();
  // Only reformat if it looks like a bare number (digits, optional decimal point/comma)
  final bareNum = RegExp(r'^[\d,\.]+$').hasMatch(trimmed);
  if (!bareNum) return trimmed;
  // Parse and reformat with commas
  final parsed = double.tryParse(trimmed.replaceAll(',', ''));
  if (parsed == null) return trimmed;
  final intPart = parsed.truncate().toInt();
  // Insert commas every 3 digits
  final s = intPart.abs().toString();
  final buf = StringBuffer();
  for (int i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  if (intPart < 0) return '-${buf.toString()}';
  return buf.toString();
}

/// Playful Money Matters card: income + net worth hero + a grid of emoji tiles + footer.
Widget moneyMattersCard({
  String? income,
  String? netWorth,
  required List<(String emoji, String label, bool inferred, String? from)> tiles,
  String? footer,
  VoidCallback? onUpload,
}) {
  final hasData = income != null || netWorth != null;
  return Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topLeft, end: Alignment.bottomRight,
        colors: [Color(Config.accentTint), Color(Config.bg2)],
      ),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(Config.accent).withValues(alpha: 0.15)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (hasData) ...[
        if (income != null) ...[
          Text('ANNUAL INCOME', style: TextStyle(color: const Color(Config.accent).withValues(alpha: 0.8), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
          const SizedBox(height: 6),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(_moneyEmoji(income), style: const TextStyle(fontSize: 26)),
            const SizedBox(width: 8),
            Expanded(child: Text(_formatMoneyValue(income), style: const TextStyle(color: Color(Config.text1), fontSize: 22, fontWeight: FontWeight.w800))),
          ]),
          const SizedBox(height: 2),
          const Text('SELF DECLARED', style: TextStyle(color: Color(Config.text3), fontSize: 10, letterSpacing: 0.5)),
          if (netWorth != null) const SizedBox(height: 14),
        ],
        if (netWorth != null) ...[
          Text('NET WORTH', style: TextStyle(color: const Color(Config.accent).withValues(alpha: 0.8), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
          const SizedBox(height: 6),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(_moneyEmoji(netWorth), style: const TextStyle(fontSize: 26)),
            const SizedBox(width: 8),
            Expanded(child: Text(_formatMoneyValue(netWorth), style: const TextStyle(color: Color(Config.text1), fontSize: 22, fontWeight: FontWeight.w800))),
          ]),
          const SizedBox(height: 2),
          const Text('SELF DECLARED', style: TextStyle(color: Color(Config.text3), fontSize: 10, letterSpacing: 0.5)),
        ],
        const SizedBox(height: 16),
      ] else if (onUpload != null) ...[
        const Text('Tap ✏️ to add your income and financial info.',
            style: TextStyle(color: Color(Config.text3), fontSize: 14, height: 1.4)),
        const SizedBox(height: 12),
      ],
      if (tiles.isNotEmpty)
        Wrap(spacing: 10, runSpacing: 10, children: [
          for (final t in tiles) _moneyTile(t.$1, t.$2, inferred: t.$3, from: t.$4),
        ]),
      if (footer != null) ...[
        const SizedBox(height: 14),
        Text(footer, style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
      ],
      if (onUpload != null) ...[
        const SizedBox(height: 12),
        const Divider(color: Color(0x141B1020), height: 1),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: onUpload,
          child: const Row(children: [
            Text('🧾  ', style: TextStyle(fontSize: 14)),
            Expanded(child: Text('Upload receipts to show spending patterns →',
                style: TextStyle(color: Color(0xFFF59E0B), fontSize: 13, fontWeight: FontWeight.w600))),
          ]),
        ),
      ],
    ]),
  );
}

Widget _moneyTile(String emoji, String label, {bool inferred = false, String? from}) {
  final tile = SizedBox(
    width: 96,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        color: inferred ? _inferredColor.withValues(alpha: 0.08) : const Color(Config.bg3),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: inferred ? _inferredColor.withValues(alpha: 0.45) : const Color(Config.accent), width: 0.4),
      ),
      child: Column(children: [
        Text(emoji, style: const TextStyle(fontSize: 22)),
        const SizedBox(height: 6),
        Text(label, textAlign: TextAlign.center, maxLines: 3, overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Color(Config.text1), fontSize: 11, height: 1.2, fontWeight: FontWeight.w600)),
        if (inferred) ...[
          const SizedBox(height: 3),
          const Text('✦', style: TextStyle(fontSize: 10, color: _inferredColor)),
        ],
      ]),
    ),
  );
  return inferred ? Tooltip(message: _inferredTip(from), triggerMode: TooltipTriggerMode.tap, child: tile) : tile;
}

Widget pSection(String label, Widget child, {String? hint}) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: Color(Config.text2))),
          if (hint != null) ...[
            const SizedBox(width: 8),
            Expanded(child: Text(hint, style: const TextStyle(fontSize: 11, color: Color(Config.text3)))),
          ],
        ]),
        const SizedBox(height: 10),
        child,
      ]),
    );

Widget pPill(String text, {Color? bg, Color? fg}) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(color: bg ?? const Color(Config.bg3), borderRadius: BorderRadius.circular(999)),
      child: Text(text, style: TextStyle(color: fg ?? const Color(Config.text1), fontSize: 13)),
    );

/// Read-only tabbed verified-signals (Career / Lifestyle / Health / Social).
class SignalTabs extends StatefulWidget {
  final List<NamedSignal> signals;
  const SignalTabs({super.key, required this.signals});
  @override
  State<SignalTabs> createState() => _SignalTabsState();
}

class _SignalTabsState extends State<SignalTabs> {
  int _tab = 0;
  @override
  Widget build(BuildContext context) {
    final active = _tab.clamp(0, widget.signals.length - 1);
    final s = widget.signals[active];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Category tabs
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          for (var i = 0; i < widget.signals.length; i++)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() => _tab = i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  decoration: BoxDecoration(
                    color: i == active ? const Color(Config.accent) : const Color(Config.bg2),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: i == active ? const Color(Config.accent) : const Color(0x1A1B1020),
                      width: 1.5,
                    ),
                    boxShadow: i == active ? [
                      BoxShadow(color: const Color(Config.accent).withOpacity(0.25), blurRadius: 8, offset: const Offset(0, 3)),
                    ] : null,
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(widget.signals[i].emoji, style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: 5),
                    Text(widget.signals[i].label,
                        style: TextStyle(
                          fontSize: 13,
                          color: i == active ? Colors.white : const Color(Config.text2),
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.1,
                        )),
                  ]),
                ),
              ),
            ),
        ]),
      ),
      const SizedBox(height: 14),
      // Content card
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x0F1B1020)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Verified badge row
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0x1500C853),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.verified, size: 11, color: Color(0xFF00C853)),
                const SizedBox(width: 4),
                Text('Verified ${s.label}', style: const TextStyle(fontSize: 11, color: Color(0xFF00C853), fontWeight: FontWeight.w600)),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          // Chips
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final c in s.group.chips)
              Tooltip(
                message: c.inferred ? _inferredTip(c.from) : '',
                triggerMode: c.inferred ? TooltipTriggerMode.tap : TooltipTriggerMode.manual,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: c.inferred ? _inferredColor.withValues(alpha: 0.10) : const Color(Config.bg3),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: c.inferred ? _inferredColor.withValues(alpha: 0.40) : const Color(0x0F1B1020)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text('${c.emoji}  ${c.label}',
                        style: const TextStyle(fontSize: 13, color: Color(Config.text1), fontWeight: FontWeight.w500)),
                    if (c.inferred) ...[
                      const SizedBox(width: 4),
                      const Text('✦', style: TextStyle(fontSize: 11, color: _inferredColor)),
                    ],
                  ]),
                ),
              ),
          ]),
          if (s.group.aggregated.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0x08FF3B6B),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('✨', style: TextStyle(fontSize: 13)),
                const SizedBox(width: 8),
                Expanded(child: Text(s.group.aggregated,
                    style: const TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: Color(Config.text2), height: 1.5))),
              ]),
            ),
          ],
        ]),
      ),
    ]);
  }
}

/// The "Personality Reads" radar — 4-axis constellation from per-user AI scores.
class PersonalityRadar extends StatelessWidget {
  final Map<String, int> traits;
  const PersonalityRadar({super.key, required this.traits});

  List<(String, int)> get _traitList => [
    ('Decisiveness', traits['decisiveness'] ?? 60),
    ('Warmth',       traits['warmth']       ?? 60),
    ('Openness',     traits['openness']      ?? 60),
    ('Pace',         traits['pace']          ?? 60),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 230,
      child: CustomPaint(size: Size.infinite, painter: _RadarPainter(_traitList)),
    );
  }
}

class _RadarPainter extends CustomPainter {
  final List<(String, int)> traits;
  _RadarPainter(this.traits);

  @override
  void paint(Canvas canvas, Size size) {
    final n = traits.length;
    final center = Offset(size.width / 2, size.height / 2 + 4);
    final radius = math.min(size.width, size.height) / 2 - 34;
    double ang(int i) => (math.pi * 2 * i) / n - math.pi / 2;
    Offset pt(int i, double r) => Offset(center.dx + r * math.cos(ang(i)), center.dy + r * math.sin(ang(i)));

    final grid = Paint()..style = PaintingStyle.stroke..color = const Color(0x221B1020)..strokeWidth = 1;
    for (final ring in [0.25, 0.5, 0.75, 1.0]) {
      final path = Path();
      for (var i = 0; i < n; i++) {
        final p = pt(i, radius * ring);
        i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
      }
      path.close();
      canvas.drawPath(path, grid);
    }
    for (var i = 0; i < n; i++) {
      canvas.drawLine(center, pt(i, radius), grid);
    }

    // Data polygon
    final dataPath = Path();
    for (var i = 0; i < n; i++) {
      final p = pt(i, radius * (traits[i].$2 / 100));
      i == 0 ? dataPath.moveTo(p.dx, p.dy) : dataPath.lineTo(p.dx, p.dy);
    }
    dataPath.close();
    canvas.drawPath(dataPath, Paint()..style = PaintingStyle.fill..color = const Color(0x33FF3B6B));
    canvas.drawPath(dataPath, Paint()..style = PaintingStyle.stroke..color = const Color(Config.accent)..strokeWidth = 2);
    for (var i = 0; i < n; i++) {
      final p = pt(i, radius * (traits[i].$2 / 100));
      canvas.drawCircle(p, 3, Paint()..color = const Color(Config.accent));
    }

    // Labels + values
    for (var i = 0; i < n; i++) {
      final lp = pt(i, radius + 4);
      final a = ang(i) * 180 / math.pi;
      final align = (a > -85 && a < 85) ? TextAlign.left : (a > 95 || a < -95) ? TextAlign.right : TextAlign.center;
      _label(canvas, traits[i].$1, '${traits[i].$2}', lp, align);
    }
  }

  void _label(Canvas canvas, String name, String value, Offset at, TextAlign align) {
    final tp = TextPainter(
      textAlign: align,
      textDirection: TextDirection.ltr,
      text: TextSpan(children: [
        TextSpan(text: '$name\n', style: const TextStyle(color: Color(0xD91B1020), fontSize: 11, fontWeight: FontWeight.w600)),
        TextSpan(text: value, style: const TextStyle(color: Color(Config.accent), fontSize: 10)),
      ]),
    )..layout(maxWidth: 90);
    var dx = at.dx;
    if (align == TextAlign.center) dx -= tp.width / 2;
    if (align == TextAlign.right) dx -= tp.width;
    tp.paint(canvas, Offset(dx, at.dy - tp.height / 2));
  }

  @override
  bool shouldRepaint(covariant _RadarPainter old) => false;
}
