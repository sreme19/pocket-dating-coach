import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'config.dart';
import 'engage_sheets.dart';

/// Full match profile, opened from a Discover card (rich public-profile endpoint).
class MatchDetailScreen extends StatefulWidget {
  final String profileId;
  final String fallbackName;
  final String? fallbackAvatar;
  const MatchDetailScreen({
    super.key,
    required this.profileId,
    required this.fallbackName,
    this.fallbackAvatar,
  });

  @override
  State<MatchDetailScreen> createState() => _MatchDetailScreenState();
}

class _MatchDetailScreenState extends State<MatchDetailScreen> {
  late Future<MatchDetail> _future;
  String? _viewerGender;

  @override
  void initState() {
    super.initState();
    _future = fetchMatchDetail(widget.profileId);
    fetchCurrentUserGender().then((g) {
      if (mounted) setState(() => _viewerGender = g);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      bottomNavigationBar: _viewerGender == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => showTipSheet(context, targetUserId: widget.profileId, viewerGender: _viewerGender!),
                      icon: const Icon(Icons.chat_bubble_outline, size: 18),
                      label: const Text('Tip'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(Config.text1),
                        side: const BorderSide(color: Color(0x33FFFFFF)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => showAdmireSheet(context, recipientId: widget.profileId, viewerGender: _viewerGender!, name: widget.fallbackName),
                      icon: Text(_viewerGender == 'woman' ? '🌹' : '👀', style: const TextStyle(fontSize: 16)),
                      label: Text(_viewerGender == 'woman' ? 'Admire' : 'Notice me'),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(Config.accent),
                        foregroundColor: const Color(0xFF052819),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
      body: FutureBuilder<MatchDetail>(
        future: _future,
        builder: (context, snap) {
          final loading = snap.connectionState == ConnectionState.waiting;
          final d = snap.data;
          final avatar = d?.avatar ?? widget.fallbackAvatar;
          return CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 420,
                pinned: true,
                backgroundColor: const Color(Config.bg1),
                iconTheme: const IconThemeData(color: Colors.white),
                flexibleSpace: FlexibleSpaceBar(
                  background: Stack(fit: StackFit.expand, children: [
                    if (avatar != null && avatar.startsWith('http'))
                      CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover,
                          errorWidget: (c, _, _) => const ColoredBox(color: Color(Config.bg3)))
                    else
                      const ColoredBox(color: Color(Config.bg3), child: Center(child: Text('📸', style: TextStyle(fontSize: 48)))),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.center, end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Color(0xDD0B1120)],
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
              if (loading)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator(color: Color(Config.accent)))),
                )
              else if (snap.hasError || d == null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: Text('Could not load profile.\n${snap.error ?? ''}',
                      textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2)))),
                )
              else
                SliverList(
                  delegate: SliverChildListDelegate([
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(
                            child: Text(d.age != null ? '${d.name}, ${d.age}' : d.name,
                                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: Color(Config.text1))),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0x2210B981),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: const Color(Config.accent)),
                            ),
                            child: Text('${d.trustScore}%',
                                style: const TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700)),
                          ),
                        ]),
                        const SizedBox(height: 6),
                        if (d.city != null)
                          Row(children: [
                            const Icon(Icons.location_on_outlined, size: 16, color: Color(Config.text2)),
                            const SizedBox(width: 4),
                            Text(d.city!, style: const TextStyle(color: Color(Config.text2))),
                          ]),
                        const SizedBox(height: 12),
                        Wrap(spacing: 8, runSpacing: 8, children: [
                          _chip('${d.archetypeEmoji} ${d.archetypeLabel}', const Color(0x33A855F7), const Color(0xFFD8B4FE)),
                          ...d.vibeWords.map((w) => _chip(w, const Color(Config.bg3), const Color(Config.text2))),
                        ]),
                      ]),
                    ),
                    if (d.hereFor != null && d.hereFor!.isNotEmpty)
                      _section('HERE FOR', Text(d.hereFor!, style: const TextStyle(color: Color(Config.text1), fontSize: 16, height: 1.4))),
                    if (d.about != null && d.about!.isNotEmpty)
                      _section('ABOUT', Text(d.about!, style: const TextStyle(color: Color(Config.text1), fontSize: 16, height: 1.5))),
                    if (d.archetypeChips.isNotEmpty)
                      _section('MY DATING STYLE', Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final g in d.archetypeChips) ...[
                            Padding(
                              padding: const EdgeInsets.only(top: 4, bottom: 6),
                              child: Text(g.label,
                                  style: const TextStyle(fontSize: 13, color: Color(Config.text2), fontWeight: FontWeight.w600)),
                            ),
                            Wrap(spacing: 8, runSpacing: 8,
                                children: g.chips.map((c) => _chip(c, const Color(Config.bg3), const Color(Config.text1))).toList()),
                            const SizedBox(height: 8),
                          ],
                        ],
                      )),
                    if (d.whatBrings.isNotEmpty)
                      _section('WHAT ${d.name.toUpperCase()} BRINGS', Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: d.whatBrings.map((b) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${b.emoji} ', style: const TextStyle(fontSize: 16)),
                            Expanded(child: Text(b.text, style: const TextStyle(color: Color(Config.text1), fontSize: 15))),
                          ]),
                        )).toList(),
                      )),
                    if (d.annualIncome != null || d.wealthInsights.isNotEmpty || d.careerLines.isNotEmpty)
                      _section('💰 MONEY MATTERS', Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (d.annualIncome != null) ...[
                            const Text('💼 Annual income', style: TextStyle(fontSize: 12, color: Color(Config.text2))),
                            const SizedBox(height: 2),
                            Text(d.annualIncome!,
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(Config.text1))),
                            const SizedBox(height: 10),
                          ],
                          if (d.wealthInsights.isNotEmpty)
                            Wrap(spacing: 8, runSpacing: 8, children: [
                              for (final c in d.wealthInsights) _chip('${c.emoji} ${c.label}', const Color(Config.bg3), const Color(Config.text1)),
                            ]),
                          if (d.careerLines.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            for (final c in d.careerLines)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 2),
                                child: Text('${c.emoji} ${c.label}', style: const TextStyle(color: Color(Config.text2), fontSize: 14)),
                              ),
                          ],
                          const SizedBox(height: 6),
                          const Text('✅ AI verified via financial documents',
                              style: TextStyle(fontSize: 12, color: Color(Config.text3))),
                        ],
                      )),
                    if (d.garagePortraitUrl != null || d.personalityPortraitUrl != null)
                      _section('✨ AI LIFESTYLE PORTRAIT', ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: CachedNetworkImage(
                          imageUrl: (d.garagePortraitUrl ?? d.personalityPortraitUrl)!,
                          fit: BoxFit.cover,
                          placeholder: (c, _) => Container(height: 160, color: const Color(Config.bg3)),
                          errorWidget: (c, _, _) => const SizedBox.shrink(),
                        ),
                      )),
                    if (d.verifiedSignals.isNotEmpty)
                      _section('🛡 VERIFIED SIGNALS', _SignalTabs(signals: d.verifiedSignals)),
                    if (d.garage.isNotEmpty)
                      _section('🏎️ GARAGE', Column(
                        children: d.garage.map((car) => Container(
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
                        )).toList(),
                      )),
                    if (d.travel.isNotEmpty)
                      _section('✈️ TRAVEL MAGNETS', Wrap(spacing: 8, runSpacing: 8,
                          children: d.travel.map((t) => _chip('📍 $t', const Color(Config.bg3), const Color(Config.text2))).toList())),
                    const SizedBox(height: 40),
                  ]),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _section(String label, Widget child) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: Color(Config.text2))),
          const SizedBox(height: 8),
          child,
        ]),
      );

  Widget _chip(String text, Color bg, Color fg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600)),
      );
}

/// Read-only tabbed verified-signals (Career / Lifestyle / Health / Social).
class _SignalTabs extends StatefulWidget {
  final List<NamedSignal> signals;
  const _SignalTabs({required this.signals});
  @override
  State<_SignalTabs> createState() => _SignalTabsState();
}

class _SignalTabsState extends State<_SignalTabs> {
  int _tab = 0;
  @override
  Widget build(BuildContext context) {
    final active = _tab.clamp(0, widget.signals.length - 1);
    final s = widget.signals[active];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
                        style: TextStyle(
                          fontSize: 13,
                          color: i == active ? const Color(Config.accent) : const Color(Config.text2),
                          fontWeight: i == active ? FontWeight.w600 : FontWeight.w500,
                        )),
                  ),
                ),
              ),
          ]),
        ),
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final c in s.group.chips)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(color: const Color(Config.bg3), borderRadius: BorderRadius.circular(999)),
              child: Text('${c.emoji} ${c.label}',
                  style: const TextStyle(fontSize: 13, color: Color(Config.text1))),
            ),
        ]),
        if (s.group.aggregated.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(s.group.aggregated,
              style: const TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: Color(Config.text2))),
        ],
      ],
    );
  }
}
