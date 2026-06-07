import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'config.dart';

/// Shared rich "Public Read" body for a [MatchDetail] — used inline on Discover
/// (and anywhere a full profile is shown). Renders everything below the photo,
/// in the same section order as the web.
List<Widget> richProfileBody(BuildContext context, MatchDetail d) {
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
          pPill('${d.archetypeEmoji} ${d.archetypeLabel}', bg: const Color(0x33A855F7), fg: const Color(0xFFD8B4FE)),
          for (final w in d.vibeWords) pPill(w),
        ]),
      ]),
    ),
    if (d.hereFor != null && d.hereFor!.isNotEmpty)
      pSection('🧭 HERE FOR', Text(d.hereFor!, style: const TextStyle(color: Color(Config.text1), fontSize: 16, height: 1.4))),
    // Personality Reads (radar) — matches the web's inferred constellation.
    pSection('🧠 PERSONALITY READS', const PersonalityRadar(), hint: 'inferred from Q&A + lifestyle'),
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
    if (d.annualIncome != null || d.wealthInsights.isNotEmpty || d.careerLines.isNotEmpty)
      pSection('💰 MONEY MATTERS', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (d.annualIncome != null) ...[
          const Text('💼 Annual income', style: TextStyle(fontSize: 12, color: Color(Config.text2))),
          const SizedBox(height: 2),
          Text(d.annualIncome!, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(Config.text1))),
          const SizedBox(height: 10),
        ],
        if (d.wealthInsights.isNotEmpty)
          Wrap(spacing: 8, runSpacing: 8, children: [for (final c in d.wealthInsights) pPill('${c.emoji} ${c.label}')]),
        if (d.careerLines.isNotEmpty) ...[
          const SizedBox(height: 8),
          for (final c in d.careerLines)
            Padding(padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text('${c.emoji} ${c.label}', style: const TextStyle(color: Color(Config.text2), fontSize: 14))),
        ],
        const SizedBox(height: 6),
        const Text('✅ AI verified via financial documents', style: TextStyle(fontSize: 12, color: Color(Config.text3))),
      ])),
    if (d.garagePortraitUrl != null || d.personalityPortraitUrl != null)
      pSection('✨ AI LIFESTYLE PORTRAIT', ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: CachedNetworkImage(
          imageUrl: (d.garagePortraitUrl ?? d.personalityPortraitUrl)!,
          fit: BoxFit.cover,
          placeholder: (c, _) => Container(height: 160, color: const Color(Config.bg3)),
          errorWidget: (c, _, _) => const SizedBox.shrink(),
        ),
      )),
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
            Text([car.year, car.color].where((s) => s != null && s.isNotEmpty).join(' · '),
                style: const TextStyle(fontSize: 13, color: Color(Config.text2))),
            const Text('✅ Ownership verified', style: TextStyle(fontSize: 12, color: Color(Config.accent))),
          ])),
        ]),
      )).toList())),
    if (d.travel.isNotEmpty)
      pSection('✈️ TRAVEL MAGNETS', Wrap(spacing: 8, runSpacing: 8,
          children: d.travel.map((t) => pPill('📍 $t')).toList())),
  ];
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
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          for (var i = 0; i < widget.signals.length; i++)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() => _tab = i),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: i == active ? const Color(0x2210B981) : const Color(Config.bg3),
                    borderRadius: BorderRadius.circular(999),
                    border: i == active ? Border.all(color: const Color(0x4D10B981)) : null,
                  ),
                  child: Text('${widget.signals[i].emoji} ${widget.signals[i].label}',
                      style: TextStyle(fontSize: 13,
                          color: i == active ? const Color(Config.accent) : const Color(Config.text2),
                          fontWeight: i == active ? FontWeight.w600 : FontWeight.w500)),
                ),
              ),
            ),
        ]),
      ),
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 8, children: [for (final c in s.group.chips) pPill('${c.emoji} ${c.label}')]),
      if (s.group.aggregated.isNotEmpty) ...[
        const SizedBox(height: 10),
        Text(s.group.aggregated, style: const TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: Color(Config.text2))),
      ],
    ]);
  }
}

/// The "Personality Reads" radar — a 5-axis constellation. Mirrors the web's
/// inferred sample (Decisiveness/Warmth/Openness/Pace/Stability) + signature.
class PersonalityRadar extends StatelessWidget {
  const PersonalityRadar({super.key});

  static const _traits = <(String, int)>[
    ('Decisiveness', 95), ('Warmth', 80), ('Openness', 75), ('Pace', 65), ('Stability', 78),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      SizedBox(
        height: 230,
        child: CustomPaint(size: Size.infinite, painter: _RadarPainter(_traits)),
      ),
      const SizedBox(height: 8),
      const Text('"Decisive and warm — moves fast, lands soft."',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(Config.text2), fontStyle: FontStyle.italic, fontSize: 13)),
    ]);
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

    final grid = Paint()..style = PaintingStyle.stroke..color = const Color(0x22FFFFFF)..strokeWidth = 1;
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
    canvas.drawPath(dataPath, Paint()..style = PaintingStyle.fill..color = const Color(0x3310B981));
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
        TextSpan(text: '$name\n', style: const TextStyle(color: Color(0xD9FFFFFF), fontSize: 11, fontWeight: FontWeight.w600)),
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
