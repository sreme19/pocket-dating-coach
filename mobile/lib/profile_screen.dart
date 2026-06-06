import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'archetypes.dart';
import 'config.dart';
import 'settings_screen.dart';
import 'trust_boost_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Future<ProfileData> _future;

  @override
  void initState() {
    super.initState();
    _future = fetchProfile();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = fetchProfile();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('My Profile',
            style: TextStyle(fontWeight: FontWeight.w600, color: Color(Config.text1))),
        centerTitle: true,
        actions: [
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.settings_outlined, color: Color(Config.text2)),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
        ],
      ),
      body: FutureBuilder<ProfileData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const _Loading();
          }
          if (snap.hasError || !snap.hasData) {
            return _ErrorState(onRetry: _refresh, error: '${snap.error ?? 'No data'}');
          }
          // Data is ready — the entire populated UI is built in one pass and
          // painted in a single frame. No empty-then-mutate, so nothing to
          // "switch screens to fix" like the WebView.
          return RefreshIndicator(
            onRefresh: _refresh,
            child: _ProfileBody(data: snap.data!),
          );
        },
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();
  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: Color(Config.accent)),
          SizedBox(height: 16),
          Text('Loading your profile…', style: TextStyle(color: Color(Config.text2))),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  final String error;
  const _ErrorState({required this.onRetry, required this.error});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, color: Color(Config.text3), size: 48),
            const SizedBox(height: 12),
            Text(error, textAlign: TextAlign.center,
                style: const TextStyle(color: Color(Config.text2))),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _ProfileBody extends StatelessWidget {
  final ProfileData data;
  const _ProfileBody({required this.data});

  @override
  Widget build(BuildContext context) {
    final arch = data.archetype.isNotEmpty ? archetypeFor(data.archetype) : null;
    final brings = data.isMan ? archetypeBrings[data.archetype] : null;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      children: [
        _Hero(photos: data.photos, fallback: data.heroPhotoUrl),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                data.age != null ? '${data.name}, ${data.age}' : data.name,
                style: const TextStyle(
                  fontSize: 30, fontWeight: FontWeight.w700,
                  fontStyle: FontStyle.italic, color: Color(Config.text1),
                ),
              ),
              const SizedBox(height: 8),
              Row(children: [
                if (arch != null) ...[
                  Text(arch.emoji, style: const TextStyle(fontSize: 16)),
                  const SizedBox(width: 6),
                  Text(arch.name,
                      style: const TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w600)),
                ],
                if (data.city != null) ...[
                  if (arch != null)
                    const Text('  ·  ', style: TextStyle(color: Color(Config.text3))),
                  const Icon(Icons.location_on_outlined, size: 15, color: Color(Config.text2)),
                  const SizedBox(width: 3),
                  Text(data.city!, style: const TextStyle(color: Color(Config.text2))),
                ],
              ]),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Row(
            children: [
              _Stat(label: 'TRUST', value: data.trustScore > 0 ? '${data.trustScore}' : '—',
                  sub: data.trustScore > 0 ? 'score' : 'not yet'),
              _divider(),
              _Stat(label: 'PROFILE', value: data.profileComplete ? '✓' : '—',
                  sub: data.profileComplete ? 'complete' : 'incomplete',
                  valueColor: const Color(0xFFF59E0B)),
              _divider(),
              _Stat(label: 'VERIFIED', value: '${data.proofsCount}',
                  sub: 'proofs', valueColor: const Color(Config.accent)),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
          child: SizedBox(
            width: double.infinity, height: 50,
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const TrustBoostScreen()),
              ),
              icon: const Icon(Icons.bolt),
              label: const Text('Trust & Boost', style: TextStyle(fontWeight: FontWeight.w700)),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0x2210B981),
                foregroundColor: const Color(Config.accent),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ),

        // ── The vibe in three words ──────────────────────────────────────
        if (data.isMan && data.vibeWords.isNotEmpty)
          _Section(
            icon: Icons.shield_outlined,
            title: 'THE VIBE IN THREE WORDS',
            child: Wrap(
              spacing: 8, runSpacing: 8,
              children: [
                for (var i = 0; i < data.vibeWords.length; i++)
                  _Pill(data.vibeWords[i], highlight: i == 0),
              ],
            ),
          ),

        // ── About ────────────────────────────────────────────────────────
        _Section(
          icon: Icons.auto_awesome,
          title: 'ABOUT',
          child: Text(
            data.about.isNotEmpty ? data.about : 'Your story goes here.',
            style: const TextStyle(fontSize: 16, height: 1.5, color: Color(Config.text1)),
          ),
        ),

        // ── What he brings ───────────────────────────────────────────────
        if (brings != null && brings.isNotEmpty)
          _Section(
            icon: Icons.favorite_border,
            title: 'WHAT HE BRINGS',
            child: Column(
              children: [
                for (final b in brings) _BringsRow(b),
              ],
            ),
          ),

        // ── Money matters ────────────────────────────────────────────────
        if (data.isMan && (data.wealth != null || data.annualIncome != null ||
            data.netWorth != null || data.spending.isNotEmpty))
          _Section(
            emoji: '💰',
            title: 'MONEY MATTERS',
            child: _MoneyMatters(data: data),
          ),

        // ── AI lifestyle portrait ────────────────────────────────────────
        if (data.garagePortraitUrl != null || data.personalityPortraitUrl != null)
          _Section(
            icon: Icons.star_border,
            title: 'AI LIFESTYLE PORTRAIT',
            subtitle: 'generated from your photos',
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: CachedNetworkImage(
                imageUrl: (data.garagePortraitUrl ?? data.personalityPortraitUrl)!,
                fit: BoxFit.cover,
                placeholder: (c, _) => Container(
                  height: 180, color: const Color(Config.bg3),
                  child: const Center(child: CircularProgressIndicator(color: Color(Config.accent))),
                ),
                errorWidget: (c, _, _) => const SizedBox.shrink(),
              ),
            ),
          ),

        // ── Verified signals ─────────────────────────────────────────────
        if (data.career != null || data.lifestyle != null ||
            data.health != null || data.social != null)
          _Section(
            icon: Icons.verified_outlined,
            title: 'VERIFIED SIGNALS',
            subtitle: 'AI-read from uploads',
            child: _VerifiedSignals(data: data),
          ),

        // ── Garage ───────────────────────────────────────────────────────
        if (data.garage.isNotEmpty)
          _Section(
            emoji: '🏎️',
            title: 'WHAT MY GARAGE LOOKS LIKE',
            child: Column(children: [for (final c in data.garage) _GarageCard(c)]),
          ),

        // ── Travel magnets ───────────────────────────────────────────────
        if (data.countries.isNotEmpty)
          _Section(
            emoji: '✈️',
            title: 'TRAVEL MAGNETS',
            subtitle: 'detected from uploads',
            child: Wrap(
              spacing: 8, runSpacing: 8,
              children: [for (final c in data.countries) _Pill('📍 $c')],
            ),
          ),

        const SizedBox(height: 48),
      ],
    );
  }

  Widget _divider() => Container(width: 1, height: 36, color: const Color(0x14FFFFFF));
}

/// A titled profile section with a divider above it.
class _Section extends StatelessWidget {
  final IconData? icon;
  final String? emoji;
  final String title;
  final String? subtitle;
  final Widget child;
  const _Section({this.icon, this.emoji, required this.title, this.subtitle, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(color: Color(0x14FFFFFF), height: 36),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                if (emoji != null)
                  Text(emoji!, style: const TextStyle(fontSize: 15))
                else if (icon != null)
                  Icon(icon, size: 16, color: const Color(Config.text2)),
                const SizedBox(width: 6),
                Text(title,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                        letterSpacing: 0.5, color: Color(Config.text2))),
                if (subtitle != null) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(subtitle!,
                        style: const TextStyle(fontSize: 11, color: Color(Config.text3))),
                  ),
                ],
              ]),
              const SizedBox(height: 12),
              child,
            ],
          ),
        ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  final String text;
  final bool highlight;
  const _Pill(this.text, {this.highlight = false});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: highlight ? const Color(0x2210B981) : const Color(Config.bg3),
        borderRadius: BorderRadius.circular(999),
        border: highlight ? Border.all(color: const Color(0x4D10B981)) : null,
      ),
      child: Text(text,
          style: TextStyle(
            fontSize: 13,
            color: highlight ? const Color(Config.accent) : const Color(Config.text1),
            fontWeight: highlight ? FontWeight.w600 : FontWeight.w500,
          )),
    );
  }
}

class _BringsRow extends StatelessWidget {
  final BringsItem item;
  const _BringsRow(this.item);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(children: [
        Text(item.emoji, style: const TextStyle(fontSize: 18)),
        const SizedBox(width: 12),
        Expanded(
          child: Text(item.text,
              style: const TextStyle(fontSize: 15, color: Color(Config.text1))),
        ),
        const Icon(Icons.check_circle, size: 18, color: Color(Config.accent)),
      ]),
    );
  }
}

class _MoneyMatters extends StatelessWidget {
  final ProfileData data;
  const _MoneyMatters({required this.data});
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (data.annualIncome != null || data.netWorth != null)
          Row(children: [
            if (data.annualIncome != null)
              Expanded(child: _MoneyStat('💼 Annual Income', data.annualIncome!)),
            if (data.netWorth != null)
              Expanded(child: _MoneyStat('📈 Net Worth', data.netWorth!)),
          ]),
        if (data.wealth != null) ...[
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final c in data.wealth!.chips) _Pill('${c.emoji} ${c.label}'),
          ]),
        ],
        if (data.spending.isNotEmpty) ...[
          const SizedBox(height: 14),
          for (final s in data.spending)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                Text(s.emoji, style: const TextStyle(fontSize: 15)),
                const SizedBox(width: 8),
                Expanded(child: Text(s.category,
                    style: const TextStyle(color: Color(Config.text1)))),
                Text(s.amountLabel,
                    style: const TextStyle(color: Color(Config.text2), fontWeight: FontWeight.w600)),
              ]),
            ),
        ],
        if (data.wealth?.aggregated.isNotEmpty == true) ...[
          const SizedBox(height: 10),
          Text(data.wealth!.aggregated,
              style: const TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: Color(Config.text2))),
        ],
        const SizedBox(height: 8),
        const Text('✅ AI verified via financial documents',
            style: TextStyle(fontSize: 12, color: Color(Config.text3))),
      ],
    );
  }
}

class _MoneyStat extends StatelessWidget {
  final String label, value;
  const _MoneyStat(this.label, this.value);
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Color(Config.text2))),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(Config.text1))),
      ],
    );
  }
}

/// Tabbed verified-signals (Career / Lifestyle / Health / Social).
class _VerifiedSignals extends StatefulWidget {
  final ProfileData data;
  const _VerifiedSignals({required this.data});
  @override
  State<_VerifiedSignals> createState() => _VerifiedSignalsState();
}

class _VerifiedSignalsState extends State<_VerifiedSignals> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final d = widget.data;
    final tabs = <(String, SignalGroup)>[
      if (d.career != null) ('💼 Career', d.career!),
      if (d.lifestyle != null) ('🌍 Lifestyle', d.lifestyle!),
      if (d.health != null) ('💪 Health', d.health!),
      if (d.social != null) ('🤝 Social', d.social!),
    ];
    if (tabs.isEmpty) return const SizedBox.shrink();
    final active = _tab.clamp(0, tabs.length - 1);
    final group = tabs[active].$2;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (var i = 0; i < tabs.length; i++)
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
                    child: Text(tabs[i].$1,
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
          for (final c in group.chips) _Pill('${c.emoji} ${c.label}'),
        ]),
        if (group.aggregated.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(group.aggregated,
              style: const TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: Color(Config.text2))),
        ],
      ],
    );
  }
}

class _GarageCard extends StatelessWidget {
  final GarageCar car;
  const _GarageCard(this.car);
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(Config.bg3),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        const Text('🚗', style: TextStyle(fontSize: 26)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(car.title,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(Config.text1))),
              const SizedBox(height: 2),
              Text([car.year, car.color].where((s) => s != null && s.isNotEmpty).join(' · '),
                  style: const TextStyle(fontSize: 13, color: Color(Config.text2))),
              const SizedBox(height: 4),
              const Text('✅ Ownership verified',
                  style: TextStyle(fontSize: 12, color: Color(Config.accent))),
            ],
          ),
        ),
      ]),
    );
  }
}

/// Swipeable hero photo gallery (PageView + dots), with placeholder fallback.
class _Hero extends StatefulWidget {
  final List<String> photos;
  final String? fallback;
  const _Hero({required this.photos, required this.fallback});
  @override
  State<_Hero> createState() => _HeroState();
}

class _HeroState extends State<_Hero> {
  final _ctrl = PageController();
  int _i = 0;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    var urls = widget.photos.where((u) => u.startsWith('http')).toList();
    if (urls.isEmpty && widget.fallback != null && widget.fallback!.startsWith('http')) {
      urls = [widget.fallback!];
    }
    if (urls.isEmpty) {
      return const AspectRatio(aspectRatio: 4 / 5, child: _PhotoPlaceholder());
    }
    return AspectRatio(
      aspectRatio: 4 / 5,
      child: Stack(
        children: [
          PageView.builder(
            controller: _ctrl,
            itemCount: urls.length,
            onPageChanged: (i) => setState(() => _i = i),
            itemBuilder: (c, i) => CachedNetworkImage(
              imageUrl: urls[i],
              fit: BoxFit.cover,
              placeholder: (c, _) => const ColoredBox(
                color: Color(Config.bg2),
                child: Center(child: CircularProgressIndicator(color: Color(Config.accent))),
              ),
              errorWidget: (c, _, _) => const _PhotoPlaceholder(),
            ),
          ),
          if (urls.length > 1)
            Positioned(
              bottom: 12, left: 0, right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < urls.length; i++)
                    Container(
                      width: 7, height: 7,
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i == _i ? const Color(Config.accent) : const Color(0x80FFFFFF),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _PhotoPlaceholder extends StatelessWidget {
  const _PhotoPlaceholder();
  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(Config.bg2),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('📸', style: TextStyle(fontSize: 40)),
            SizedBox(height: 8),
            Text('Add photos to boost\nyour profile',
                textAlign: TextAlign.center, style: TextStyle(color: Color(Config.text3))),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label, value, sub;
  final Color? valueColor;
  const _Stat({required this.label, required this.value, required this.sub, this.valueColor});
  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
              letterSpacing: 0.5, color: Color(Config.text3))),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700,
              color: valueColor ?? const Color(Config.text1))),
          const SizedBox(height: 2),
          Text(sub, style: const TextStyle(fontSize: 12, color: Color(Config.text2))),
        ],
      ),
    );
  }
}
