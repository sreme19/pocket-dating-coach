import 'dart:convert' show base64Decode;
import 'dart:math' show pi, cos, sin, min;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';
import 'api.dart';
import 'app_logger.dart';
import 'archetype_detail_sheet.dart';
import 'archetypes.dart';
import 'config.dart';
import 'profile_body.dart' show travelMagnets, moneyMattersCard;
import 'profile_edit.dart';
import 'category_proof_screen.dart';
import 'proof_upload_screen.dart';
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
            final e = snap.error?.toString() ?? '';
            final msg = (e.contains('timeout') || e.contains('SocketException') || e.contains('DioException'))
                ? 'No internet connection. Please check your network.'
                : (e.contains('401') || e.contains('Unauthorized'))
                    ? 'Session expired. Please sign out and back in.'
                    : 'Could not load profile. Please try again.';
            return _ErrorState(onRetry: _refresh, error: msg);
          }
          // Data is ready — the entire populated UI is built in one pass and
          // painted in a single frame. No empty-then-mutate, so nothing to
          // "switch screens to fix" like the WebView.
          return RefreshIndicator(
            onRefresh: _refresh,
            child: _ProfileBody(data: snap.data!, onChanged: _refresh),
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
  final VoidCallback onChanged;
  const _ProfileBody({required this.data, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    // Prefer user-edited brings saved in rawGenerated; fall back to archetype defaults.
    List<BringsItem>? brings;
    {
      final raw = data.rawGenerated['brings'];
      if (raw is List && raw.isNotEmpty) {
        brings = raw.whereType<Map>().map<BringsItem>((b) => BringsItem(
          (b['emoji'] ?? '•').toString(),
          (b['text'] ?? '').toString(),
        )).toList();
      }
      brings ??= archetypeBrings[data.archetype] ??
          archetypeFor(data.archetype)?.brings
              .map((t) => BringsItem('•', t))
              .toList();
    }
    final bringsTitle = data.isMan ? 'WHAT HE BRINGS' : 'WHAT SHE BRINGS';

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      children: [
        Stack(children: [
          _Hero(photos: data.photos, fallback: data.heroPhotoUrl, aiEnhanced: data.isMan),
          // Bottom gradient overlay
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: const [0.0, 0.45, 1.0],
                  colors: [Colors.transparent, Colors.transparent, const Color(0xE5000000)],
                ),
              ),
            ),
          ),
          // Bottom overlay: name (with inline trust badge) + city + edit
          Positioned(
            bottom: 20, left: 20, right: 56,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              RichText(
                text: TextSpan(
                  style: const TextStyle(
                    fontSize: 32, fontWeight: FontWeight.w800,
                    fontStyle: FontStyle.italic, color: Colors.white,
                    shadows: [Shadow(color: Color(0x66000000), blurRadius: 8)],
                  ),
                  children: [
                    TextSpan(text: data.age != null ? '${data.name}, ${data.age}' : data.name),
                    const WidgetSpan(child: SizedBox(width: 8)),
                    WidgetSpan(
                      alignment: PlaceholderAlignment.middle,
                      child: GestureDetector(
                        onTap: () => Navigator.of(context)
                            .push(MaterialPageRoute(builder: (_) => const TrustBoostScreen()))
                            .then((_) => onChanged()),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: const Color(0xAAFF3B6B),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.shield_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 4),
                            Text(
                              data.trustScore > 0 ? '${data.trustScore}' : '—',
                              style: const TextStyle(
                                color: Colors.white, fontWeight: FontWeight.w700,
                                fontSize: 13, fontStyle: FontStyle.normal,
                              ),
                            ),
                          ]),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (data.city != null) ...[
                const SizedBox(height: 6),
                Row(children: [
                  const Icon(Icons.location_on_outlined, size: 15, color: Color(0xCCFFFFFF)),
                  const SizedBox(width: 4),
                  Text(data.city!, style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 14)),
                ]),
              ],
            ]),
          ),
          // Edit button (bottom-right)
          Positioned(
            bottom: 20, right: 14,
            child: GestureDetector(
              onTap: () => _editIdentity(context, data, onChanged),
              child: Container(
                width: 34, height: 34,
                decoration: BoxDecoration(
                  color: const Color(0xCC1B1020),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Icon(Icons.edit_outlined, size: 17, color: Colors.white),
              ),
            ),
          ),
          // Manage photos button (top-right)
          Positioned(
            right: 12, top: 12,
            child: Material(
              color: const Color(0xCC1B1020),
              shape: const CircleBorder(),
              child: IconButton(
                tooltip: 'Manage photos',
                icon: const Icon(Icons.add_a_photo_outlined, size: 20, color: Color(0xFFFFFFFF)),
                onPressed: () => openPhotoManager(context, data, onChanged),
              ),
            ),
          ),
        ]),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Stat(label: 'TRUST',
                    value: data.trustScore > 0 ? '${data.trustScore}' : '—',
                    sub: _trustLabel(data.trustScore),
                    valueColor: const Color(Config.accent)),
                _divider(),
                _Stat(label: 'PROFILE',
                    value: data.profileComplete ? '✓' : null,
                    sub: 'complete',
                    valueColor: const Color(0xFFF59E0B)),
                _divider(),
                _Stat(label: 'VERIFIED',
                    value: '${data.proofsCount}',
                    sub: 'proofs',
                    valueColor: const Color(Config.accent)),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
          child: SizedBox(
            width: double.infinity, height: 50,
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const TrustBoostScreen()))
                  .then((_) => onChanged()),
              icon: const Icon(Icons.bolt),
              label: const Text('Trust & Boost', style: TextStyle(fontWeight: FontWeight.w700)),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0x22FF3B6B),
                foregroundColor: const Color(Config.accent),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ),

        // ── The vibe in three words ──────────────────────────────────────
        Builder(builder: (context) {
          const defaultTags = <String, List<String>>{
            'casual_man':               ['Laid-back', 'Genuine', 'Present'],
            'casual_generous_man':      ['Generous', 'Sophisticated', 'Discreet'],
            'forever_focused_man':      ['Intentional', 'Loyal', 'Grounded'],
            'marriage_minded_man':      ['Committed', 'Family-first', 'Stable'],
            'hopeless_romantic_man':    ['Romantic', 'Emotionally available', 'All-in'],
            'traditional_matrimony_man':['Traditional', 'Respectful', 'Family-led'],
            'second_chapter_man':       ['Mature', 'Clear-headed', 'Experienced'],
            'spiritual_connector_man':  ['Spiritual', 'Thoughtful', 'Grounded'],
            'adventure_seeker_man':     ['Adventurous', 'Spontaneous', 'Free-spirited'],
            'spoilt_woman':             ['Selective', 'High-standard', 'Worth it'],
            'safety_first_woman':       ['Careful', 'Values-led', 'Intentional'],
          };
          final tags = data.vibeWords.isNotEmpty
              ? data.vibeWords
              : (defaultTags[data.archetype] ?? []);
          if (tags.isEmpty) return const SizedBox.shrink();
          return _Section(
            icon: Icons.pentagon_outlined,
            title: 'THE VIBE IN THREE WORDS (OR FIVE)',
            child: Wrap(
              spacing: 8, runSpacing: 8,
              children: [
                for (var i = 0; i < tags.length; i++)
                  _Pill(tags[i], highlight: i == 0),
              ],
            ),
          );
        }),

        // ── About ────────────────────────────────────────────────────────
        _Section(
          icon: Icons.auto_awesome,
          title: 'ABOUT',
          onEdit: () => _editAbout(context, data, onChanged),
          child: Text(
            data.about.isNotEmpty ? data.about : 'Your story goes here.',
            style: const TextStyle(fontSize: 16, height: 1.5, color: Color(Config.text1), fontWeight: FontWeight.w400),
          ),
        ),

        // ── Here for ─────────────────────────────────────────────────────
        _Section(
          emoji: '🧭',
          title: 'HERE FOR',
          onEdit: () => _editHereFor(context, data, onChanged),
          child: ((data.hereForTitle == null || data.hereForTitle!.isEmpty) &&
                  (data.hereForDesc == null || data.hereForDesc!.isEmpty))
              ? const Text('What you’re looking for — tap edit to add.',
                  style: TextStyle(fontSize: 15, color: Color(Config.text3)))
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (data.hereForTitle != null && data.hereForTitle!.isNotEmpty)
                    Text(data.hereForTitle!,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Config.text1))),
                  if (data.hereForDesc != null && data.hereForDesc!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(data.hereForDesc!,
                        style: const TextStyle(fontSize: 15, height: 1.45, color: Color(Config.text2))),
                  ],
                ]),
        ),

        // ── Money matters ────────────────────────────────────────────────
        _Section(
          emoji: '💰',
          title: 'MONEY MATTERS',
          onEdit: () => _editMoneyMatters(context, data, onChanged),
          child: moneyMattersCard(
            income: data.annualIncome,
            netWorth: data.netWorth,
            tiles: [
              if (data.wealth != null) for (final c in data.wealth!.chips) (c.emoji, c.label, false, null),
              for (final s in data.spending) (s.emoji, s.category, false, null),
            ],
            footer: data.annualIncome != null || data.netWorth != null
                ? '✓ AI verified via bank statement / financial document'
                : null,
            onUpload: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CategoryProofScreen(categoryId: 'spending'))).then((_) => onChanged()),
          ),
        ),

        // ── What he brings ───────────────────────────────────────────────
        if (brings != null && brings.isNotEmpty)
          _Section(
            icon: Icons.favorite_border,
            title: bringsTitle,
            child: Column(
              children: [
                for (final b in brings) _BringsRow(b),
              ],
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
        _Section(
          emoji: '🏎️',
          title: 'WHAT MY GARAGE LOOKS LIKE',
          child: data.garage.isEmpty
              ? const Text('No garage yet. Upload asset photos to verify.',
                  style: TextStyle(color: Color(Config.text3)))
              : Column(children: [for (final c in data.garage) _GarageCard(c)]),
        ),

        // ── Travel magnets ───────────────────────────────────────────────
        _Section(
          emoji: '✈️',
          title: 'TRAVEL MAGNETS',
          subtitle: 'countries you\'ve visited',
          onEdit: data.countries.isEmpty ? null : () => _editCountries(context, data, onChanged),
          child: data.countries.isEmpty
              ? GestureDetector(
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const CategoryProofScreen(categoryId: 'travel'))),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
                    decoration: BoxDecoration(
                      color: const Color(Config.bg2),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0x33FF3B6B), width: 1.5),
                    ),
                    child: const Row(children: [
                      Text('🗺️', style: TextStyle(fontSize: 28)),
                      SizedBox(width: 14),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('No destinations yet',
                            style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600, fontSize: 14)),
                        SizedBox(height: 3),
                        Text('Upload passport or travel photos to detect countries automatically',
                            style: TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.4)),
                      ])),
                      SizedBox(width: 8),
                      Icon(Icons.chevron_right, color: Color(Config.text3), size: 20),
                    ]),
                  ),
                )
              : travelMagnets(data.countries),
        ),

        // ── What I'm about (My lane + Hard nos tabs) ─────────────────────
        _WhatImAboutSection(data: data, onChanged: onChanged),

        // ── Personality Reads radar ───────────────────────────────────────
        _PersonalityReadsSection(data: data),

        // ── Photo Story ──────────────────────────────────────────────────────
        _PhotoStorySection(data: data, onChanged: onChanged),

        const SizedBox(height: 48),
      ],
    );
  }

  Widget _divider() => const VerticalDivider(width: 1, thickness: 1, color: Color(0x25FFFFFF));

  static String _trustLabel(int score) {
    if (score == 0)   return 'not yet';
    if (score < 25)   return 'Minimal Trust';
    if (score < 50)   return 'Low Trust';
    if (score < 75)   return 'Medium Trust';
    if (score < 100)  return 'High Trust';
    return 'Fully Verified';
  }
}

// ── Edit sheets ──────────────────────────────────────────────────────────────

Future<void> _editIdentity(BuildContext context, ProfileData d, VoidCallback onChanged) async {
  final nameCtrl = TextEditingController(text: d.name == 'You' ? '' : d.name);
  final ageCtrl  = TextEditingController(text: d.age?.toString() ?? '');
  final cityCtrl = TextEditingController(text: d.city ?? '');

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) {
      var saving = false;
      var detecting = false;
      String? error;
      return StatefulBuilder(builder: (ctx, setS) {
        Future<void> detectCity() async {
          LocationPermission perm = await Geolocator.checkPermission();
          if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
          if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
            if (ctx.mounted) {
              showDialog(
                context: ctx,
                builder: (_) => AlertDialog(
                  title: const Text('Location access needed'),
                  content: const Text('Enable location in Settings so we can detect your city.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                    TextButton(
                      onPressed: () { Navigator.pop(ctx); Geolocator.openAppSettings(); },
                      child: const Text('Open Settings'),
                    ),
                  ],
                ),
              );
            }
            return;
          }
          setS(() => detecting = true);
          try {
            final pos = await Geolocator.getCurrentPosition(
              locationSettings: const LocationSettings(accuracy: LocationAccuracy.low),
            ).timeout(const Duration(seconds: 10));
            final resp = await Dio().get(
              'https://nominatim.openstreetmap.org/reverse',
              queryParameters: {'lat': pos.latitude, 'lon': pos.longitude, 'format': 'json'},
              options: Options(headers: {'User-Agent': 'riteangle-app/1.0'}),
            );
            final addr = resp.data['address'] as Map? ?? {};
            final city = (addr['city'] ?? addr['town'] ?? addr['village'] ?? addr['county'] ?? '').toString();
            if (city.isNotEmpty && ctx.mounted) setS(() => cityCtrl.text = city);
          } catch (_) {
            AppLogger.instance.error('geocode_location failed', screen: 'profile', action: 'geocode_location');
          } finally {
            if (ctx.mounted) setS(() => detecting = false);
          }
        }

        return Padding(
          padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Edit your details',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(Config.text1))),
              const SizedBox(height: 16),
              // First name
              TextField(
                controller: nameCtrl,
                textCapitalization: TextCapitalization.words,
                style: const TextStyle(color: Color(Config.text1)),
                decoration: InputDecoration(
                  labelText: 'First name',
                  labelStyle: const TextStyle(color: Color(Config.text2)),
                  filled: true, fillColor: const Color(Config.bg3),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 12),
              // Age
              TextField(
                controller: ageCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Color(Config.text1)),
                decoration: InputDecoration(
                  labelText: 'Age',
                  labelStyle: const TextStyle(color: Color(Config.text2)),
                  filled: true, fillColor: const Color(Config.bg3),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 12),
              // City + detect button
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: cityCtrl,
                      style: const TextStyle(color: Color(Config.text1)),
                      decoration: InputDecoration(
                        labelText: 'City',
                        labelStyle: const TextStyle(color: Color(Config.text2)),
                        filled: true, fillColor: const Color(Config.bg3),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 56,
                    child: FilledButton(
                      onPressed: detecting ? null : detectCity,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(Config.bg3),
                        foregroundColor: const Color(Config.accent),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                      child: detecting
                          ? const SizedBox(width: 18, height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)))
                          : const Icon(Icons.my_location_rounded, size: 20),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (error != null) ...[
                Text(error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
                const SizedBox(height: 8),
              ],
              SizedBox(
                width: double.infinity, height: 50,
                child: FilledButton(
                  onPressed: saving ? null : () async {
                    final name = nameCtrl.text.trim();
                    if (name.isEmpty) { setS(() => error = 'Name can\'t be empty'); return; }
                    setS(() { saving = true; error = null; });
                    try {
                      await saveIdentity(
                        firstName: name,
                        age: int.tryParse(ageCtrl.text.trim()),
                        city: cityCtrl.text.trim(),
                      );
                      if (ctx.mounted) Navigator.of(ctx).pop();
                      onChanged();
                    } catch (e) {
                      AppLogger.instance.error(e, screen: 'profile', action: 'save_identity');
                      setS(() { saving = false; error = '$e'; });
                    }
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(Config.accent),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: saving
                      ? const SizedBox(width: 18, height: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        );
      });
    },
  );
}

Future<void> _editMoneyMatters(BuildContext context, ProfileData d, VoidCallback onChanged) async {
  String currency   = _detectMoneyCurrency(d.annualIncome, d.netWorth);
  String? selIncome = d.annualIncome;
  String? selNW     = d.netWorth;
  bool saving       = false;
  String? saveError;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setS) {
        void onCurrencyChange(String sym) {
          setS(() {
            currency = sym;
            if (selIncome != null && !selIncome!.contains(sym)) selIncome = null;
            if (selNW     != null && !selNW!.contains(sym))     selNW     = null;
          });
        }
        return SingleChildScrollView(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 28,
          ),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Money Matters',
                style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 4),
            const Text('Self-declared — shown on your public profile.',
                style: TextStyle(color: Color(Config.text3), fontSize: 12)),
            const SizedBox(height: 20),
            const Text('Currency',
                style: TextStyle(color: Color(Config.text2), fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final (sym, code) in _moneyCurrencies)
                GestureDetector(
                  onTap: () => onCurrencyChange(sym),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: currency == sym ? const Color(Config.accent) : const Color(0x14FFFFFF),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: currency == sym ? const Color(Config.accent) : const Color(0x22FFFFFF),
                      ),
                    ),
                    child: Text('$sym $code',
                        style: TextStyle(
                          color: currency == sym ? const Color(0xFFFFFFFF) : const Color(Config.text2),
                          fontSize: 12, fontWeight: FontWeight.w600,
                        )),
                  ),
                ),
            ]),
            const SizedBox(height: 20),
            const Text('💼  Annual Income',
                style: TextStyle(color: Color(Config.text2), fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _moneyRangePills(
              ranges: _incomeRangesFor(currency),
              selected: selIncome,
              onSelect: (v) => setS(() => selIncome = (selIncome == v) ? null : v),
            ),
            const SizedBox(height: 20),
            const Text('📈  Net Worth',
                style: TextStyle(color: Color(Config.text2), fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _moneyRangePills(
              ranges: _netWorthRangesFor(currency),
              selected: selNW,
              onSelect: (v) => setS(() => selNW = (selNW == v) ? null : v),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: saving ? null : () async {
                  setS(() { saving = true; saveError = null; });
                  try {
                    await saveMoneyMattersDirect(
                      income: selIncome,
                      netWorth: selNW,
                    );
                    if (ctx.mounted) Navigator.of(ctx).pop();
                    onChanged();
                  } catch (e) {
                    AppLogger.instance.error(e, screen: 'profile', action: 'save_money_matters');
                    setS(() { saving = false; saveError = 'Failed to save. Please try again.'; });
                  }
                },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(Config.accent),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: saving
                    ? const SizedBox(width: 18, height: 18,
                        child: CircularProgressIndicator(color: Color(0xFFFFFFFF), strokeWidth: 2))
                    : const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
            if (saveError != null) ...[
              const SizedBox(height: 8),
              Text(saveError!, style: const TextStyle(color: Colors.red, fontSize: 12)),
            ],
          ]),
        );
      },
    ),
  );
}

const _moneyCurrencies = <(String, String)>[
  (r'$', 'USD'), ('£', 'GBP'), ('€', 'EUR'),
  (r'A$', 'AUD'), (r'C$', 'CAD'), (r'S$', 'SGD'),
  ('¥', 'JPY'), ('₹', 'INR'),
];

List<String> _incomeRangesFor(String c) => c == '₹' ? [
  'Under ₹25L', '₹25L – ₹50L', '₹50L – ₹1Cr',
  '₹1Cr – ₹3Cr', '₹3Cr – ₹10Cr', '₹10Cr+',
] : [
  'Under ${c}30K', '${c}30K – ${c}60K', '${c}60K – ${c}100K',
  '${c}100K – ${c}150K', '${c}150K – ${c}250K', '${c}250K – ${c}500K', '${c}500K+',
];

List<String> _netWorthRangesFor(String c) => c == '₹' ? [
  'Under ₹25L', '₹25L – ₹50L', '₹50L – ₹1Cr',
  '₹1Cr – ₹5Cr', '₹5Cr – ₹25Cr', '₹25Cr – ₹100Cr', '₹100Cr+',
] : [
  'Under ${c}250K', '${c}250K – ${c}500K', '${c}500K – ${c}1M',
  '${c}1M – ${c}5M', '${c}5M – ${c}10M', '${c}10M+',
];

String _detectMoneyCurrency(String? income, String? netWorth) {
  final val = income ?? netWorth ?? '';
  // Check longer symbols first so 'A$' / 'C$' / 'S$' are not matched by plain '$'.
  const ordered = [r'A$', r'C$', r'S$', '£', '€', '¥', '₹', r'$'];
  for (final sym in ordered) {
    if (val.contains(sym)) return sym;
  }
  return r'$';
}

Widget _moneyRangePills({
  required List<String> ranges,
  required String? selected,
  required void Function(String) onSelect,
}) =>
    Wrap(spacing: 8, runSpacing: 8, children: [
      for (final r in ranges)
        GestureDetector(
          onTap: () => onSelect(r),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: selected == r ? const Color(Config.accent) : const Color(0x14FFFFFF),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: selected == r ? const Color(Config.accent) : const Color(0x22FFFFFF),
              ),
            ),
            child: Text(r,
                style: TextStyle(
                  color: selected == r ? const Color(0xFFFFFFFF) : const Color(Config.text2),
                  fontSize: 12, fontWeight: FontWeight.w600,
                )),
          ),
        ),
    ]);

Future<void> _editHereFor(BuildContext context, ProfileData d, VoidCallback onChanged) async {
  final titleCtrl = TextEditingController(text: d.hereForTitle ?? '');
  final descCtrl = TextEditingController(text: d.hereForDesc ?? '');

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) {
      var saving = false;
      String? error;
      return StatefulBuilder(builder: (ctx, setS) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('What you’re here for',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(Config.text1))),
              const SizedBox(height: 4),
              const Text('A short headline, plus a line on what you’re looking for.',
                  style: TextStyle(fontSize: 13, color: Color(Config.text2))),
              const SizedBox(height: 16),
              TextField(
                controller: titleCtrl,
                maxLength: 60,
                textCapitalization: TextCapitalization.sentences,
                style: const TextStyle(color: Color(Config.text1)),
                decoration: InputDecoration(
                  labelText: 'Headline (e.g. “Something real, no rush”)',
                  labelStyle: const TextStyle(color: Color(Config.text2)),
                  filled: true, fillColor: const Color(Config.bg3),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: descCtrl,
                maxLines: 3,
                maxLength: 240,
                textCapitalization: TextCapitalization.sentences,
                style: const TextStyle(color: Color(Config.text1)),
                decoration: InputDecoration(
                  labelText: 'A little more (optional)',
                  alignLabelWithHint: true,
                  labelStyle: const TextStyle(color: Color(Config.text2)),
                  filled: true, fillColor: const Color(Config.bg3),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              if (error != null) ...[
                Text(error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
                const SizedBox(height: 8),
              ],
              SizedBox(
                width: double.infinity, height: 50,
                child: FilledButton(
                  onPressed: saving ? null : () async {
                    setS(() { saving = true; error = null; });
                    try {
                      await saveHereFor(titleCtrl.text, descCtrl.text);
                      if (ctx.mounted) Navigator.of(ctx).pop();
                      onChanged();
                    } catch (e) {
                      AppLogger.instance.error(e, screen: 'profile', action: 'save_here_for');
                      setS(() { saving = false; error = '$e'; });
                    }
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(Config.accent),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: saving
                      ? const SizedBox(width: 18, height: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        );
      });
    },
  );
}

Future<void> _editAbout(BuildContext context, ProfileData d, VoidCallback onChanged) async {
  final ctrl = TextEditingController(text: d.about);

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) {
      var saving = false;
      var generating = false;
      String? error;
      return StatefulBuilder(builder: (ctx, setS) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Edit your About',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(Config.text1))),
              const SizedBox(height: 16),
              TextField(
                controller: ctrl,
                maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                style: const TextStyle(color: Color(Config.text1)),
                decoration: InputDecoration(
                  labelText: 'About you',
                  alignLabelWithHint: true,
                  labelStyle: const TextStyle(color: Color(Config.text2)),
                  filled: true, fillColor: const Color(Config.bg3),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 10),
              // AI generate button
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: (generating || saving) ? null : () async {
                    setS(() { generating = true; error = null; });
                    try {
                      final text = await generateAboutText(d);
                      if (ctx.mounted) setS(() { ctrl.text = text; generating = false; });
                    } catch (e) {
                      AppLogger.instance.error(e, screen: 'profile', action: 'generate_about');
                      if (ctx.mounted) setS(() { error = '$e'; generating = false; });
                    }
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(Config.accentBright),
                    side: const BorderSide(color: Color(Config.accentBright)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: generating
                      ? const SizedBox(width: 16, height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accentBright)))
                      : const Text('✨', style: TextStyle(fontSize: 16)),
                  label: Text(
                    generating ? 'Generating…' : 'Generate with AI',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              if (error != null) ...[
                Text(error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
                const SizedBox(height: 8),
              ],
              SizedBox(
                width: double.infinity, height: 50,
                child: FilledButton(
                  onPressed: saving ? null : () async {
                    setS(() { saving = true; error = null; });
                    try {
                      await saveAbout(ctrl.text, d.rawGenerated);
                      if (ctx.mounted) Navigator.of(ctx).pop();
                      onChanged();
                    } catch (e) {
                      AppLogger.instance.error(e, screen: 'profile', action: 'save_about');
                      setS(() { saving = false; error = '$e'; });
                    }
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(Config.accent),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: saving
                      ? const SizedBox(width: 18, height: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        );
      });
    },
  );
}

Future<void> _editBrings(BuildContext context, ProfileData d, List<BringsItem> current, VoidCallback onChanged) async {
  // Options come from the archetype's predefined brings list.
  final options = archetypeBrings[d.archetype] ?? current;
  // Pre-select whichever options are already saved.
  final selected = <BringsItem>{...current};

  bool saving = false;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setS) => SingleChildScrollView(
        padding: EdgeInsets.only(
          left: 20, right: 20, top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 28,
        ),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('What He Brings',
              style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 18)),
          const SizedBox(height: 4),
          const Text('Pick the ones that best describe you.',
              style: TextStyle(color: Color(Config.text3), fontSize: 12)),
          const SizedBox(height: 20),
          Wrap(spacing: 10, runSpacing: 10, children: [
            for (final opt in options)
              GestureDetector(
                onTap: () => setS(() {
                  if (selected.any((s) => s.text == opt.text)) {
                    selected.removeWhere((s) => s.text == opt.text);
                  } else {
                    selected.add(opt);
                  }
                }),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: selected.any((s) => s.text == opt.text)
                        ? const Color(Config.accent)
                        : const Color(0x14FFFFFF),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: selected.any((s) => s.text == opt.text)
                          ? const Color(Config.accent)
                          : const Color(0x22FFFFFF),
                    ),
                  ),
                  child: Text('${opt.emoji}  ${opt.text}',
                      style: TextStyle(
                        color: selected.any((s) => s.text == opt.text)
                            ? const Color(0xFFFFFFFF)
                            : const Color(Config.text2),
                        fontSize: 13, fontWeight: FontWeight.w600,
                      )),
                ),
              ),
          ]),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: saving ? null : () async {
                setS(() => saving = true);
                try {
                  final updated = selected
                      .map((b) => {'emoji': b.emoji, 'text': b.text})
                      .toList();
                  await saveBrings(updated, d.rawGenerated);
                  if (ctx.mounted) Navigator.of(ctx).pop();
                  onChanged();
                } catch (_) {
                  AppLogger.instance.error('save_brings failed', screen: 'profile', action: 'save_brings');
                  setS(() => saving = false);
                }
              },
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accent),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: saving
                  ? const SizedBox(width: 18, height: 18,
                      child: CircularProgressIndicator(color: Color(0xFFFFFFFF), strokeWidth: 2))
                  : const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ]),
      ),
    ),
  );
}

class _EditField {
  final TextEditingController controller;
  final String label;
  final int maxLines;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  _EditField({
    required this.controller,
    required this.label,
    this.maxLines = 1,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
  });
}

Future<void> _editSheet(
  BuildContext context, {
  required String title,
  required List<_EditField> fields,
  required Future<void> Function() onSave,
  required VoidCallback onChanged,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) {
      var saving = false;
      String? error;
      return StatefulBuilder(builder: (ctx, setSheet) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(Config.text1))),
              const SizedBox(height: 16),
              for (final f in fields) ...[
                TextField(
                  controller: f.controller,
                  maxLines: f.maxLines,
                  keyboardType: f.keyboardType,
                  textCapitalization: f.textCapitalization,
                  style: const TextStyle(color: Color(Config.text1)),
                  decoration: InputDecoration(
                    labelText: f.label,
                    labelStyle: const TextStyle(color: Color(Config.text2)),
                    filled: true,
                    fillColor: const Color(Config.bg3),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (error != null) ...[
                Text(error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
                const SizedBox(height: 8),
              ],
              SizedBox(
                width: double.infinity, height: 50,
                child: FilledButton(
                  onPressed: saving
                      ? null
                      : () async {
                          setSheet(() { saving = true; error = null; });
                          try {
                            await onSave();
                            if (ctx.mounted) Navigator.of(ctx).pop();
                            onChanged();
                          } catch (e) {
                            AppLogger.instance.error(e, screen: 'profile', action: 'save_proof');
                            setSheet(() { saving = false; error = '$e'; });
                          }
                        },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(Config.accent),
                    foregroundColor: const Color(0xFFFFFFFF),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: saving
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFFFFFF)))
                      : const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        );
      });
    },
  );
}

/// A titled profile section with a divider above it.
class _Section extends StatelessWidget {
  final IconData? icon;
  final String? emoji;
  final String title;
  final String? subtitle;
  final Widget child;
  final VoidCallback? onEdit;
  const _Section({this.icon, this.emoji, required this.title, this.subtitle, this.onEdit, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(color: Color(0x141B1020), height: 36),
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
                ] else
                  const Spacer(),
                if (onEdit != null)
                  GestureDetector(
                    onTap: onEdit,
                    child: const Icon(Icons.edit_outlined, size: 18, color: Color(Config.text2)),
                  ),
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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      decoration: BoxDecoration(
        color: highlight ? const Color(Config.accent) : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        border: highlight ? null : Border.all(color: const Color(0x40FFFFFF)),
      ),
      child: Text(text,
          style: TextStyle(
            fontSize: 14,
            color: highlight ? Colors.white : const Color(Config.text1),
            fontWeight: highlight ? FontWeight.w700 : FontWeight.w500,
          )),
    );
  }
}

/// A chip group that can be edited in place: remove chips (× in edit mode) and
/// AI-suggest more, persisting each change to the server (verifiedProofs) on its
/// own so the surrounding profile doesn't need a full reload.
class _EditableChips extends StatefulWidget {
  final String category;
  final List<InsightChip> initial;
  final String aggregated;
  const _EditableChips({super.key, required this.category, required this.initial, required this.aggregated});
  @override
  State<_EditableChips> createState() => _EditableChipsState();
}

class _EditableChipsState extends State<_EditableChips> {
  late final List<InsightChip> _chips = List.of(widget.initial);
  final List<InsightChip> _pending = [];
  bool _edit = false;
  bool _busy = false;
  String? _error;

  Future<void> _remove(InsightChip c) async {
    setState(() => _chips.remove(c));
    try {
      await removeInsightChip(widget.category, c.label);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile', action: 'remove_insight_chip');
      setState(() { _chips.add(c); _error = '$e'; });
    }
  }

  Future<void> _suggest() async {
    setState(() { _busy = true; _error = null; });
    try {
      final s = await suggestInsights(
        widget.category, _chips.map((c) => c.label).toList(), widget.aggregated);
      setState(() { _pending..clear()..addAll(s); _busy = false; });
      if (s.isEmpty && mounted) {
        setState(() => _error = 'No new suggestions right now.');
      }
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile', action: 'suggest_insights');
      setState(() { _busy = false; _error = '$e'; });
    }
  }

  Future<void> _add(InsightChip c) async {
    setState(() { _chips.add(c); _pending.remove(c); });
    try {
      await addInsightChip(widget.category, c.label, c.emoji);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile', action: 'add_insight_chip');
      setState(() { _chips.remove(c); _error = '$e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(builder: (context, constraints) {
          return Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in _chips)
                // Size to content (Hinge/Tinder style); cap at the row width so a
                // rare long label wraps to a second line instead of overflowing —
                // either way the full text is shown, never truncated.
                ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: constraints.maxWidth),
                  child: _ChipWithRemove(text: '${c.emoji} ${c.label}', editing: _edit, onRemove: () => _remove(c)),
                ),
              GestureDetector(
                onTap: () => setState(() { _edit = !_edit; _pending.clear(); }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(0x331B1020)),
                  ),
                  child: Icon(_edit ? Icons.check : Icons.edit_outlined, size: 14, color: const Color(Config.text2)),
                ),
              ),
            ],
          );
        }),
        if (_edit) ...[
          const SizedBox(height: 10),
          if (_pending.isNotEmpty)
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final c in _pending)
                GestureDetector(
                  onTap: () => _add(c),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: const Color(0x22FF3B6B),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: const Color(0x4DFF3B6B)),
                    ),
                    child: Text('+ ${c.emoji} ${c.label}',
                        style: const TextStyle(fontSize: 13, color: Color(Config.accent))),
                  ),
                ),
            ]),
          if (_pending.isNotEmpty) const SizedBox(height: 8),
          TextButton.icon(
            onPressed: _busy ? null : _suggest,
            icon: _busy
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)))
                : const Icon(Icons.auto_awesome, size: 16, color: Color(Config.accent)),
            label: const Text('Suggest 3 more', style: TextStyle(color: Color(Config.accent))),
            style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4)),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 4),
          Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFF87171))),
        ],
      ],
    );
  }
}

class _ChipWithRemove extends StatelessWidget {
  final String text;
  final bool editing;
  final VoidCallback onRemove;
  const _ChipWithRemove({required this.text, required this.editing, required this.onRemove});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(12, 7, editing ? 6 : 12, 7),
      decoration: BoxDecoration(color: const Color(Config.bg3), borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        // Wrap the full label (no ellipsis) — chips are content-sized and only
        // wrap to a 2nd line if a label exceeds the available row width.
        Flexible(child: Text(text, style: const TextStyle(fontSize: 13, color: Color(Config.text1), fontWeight: FontWeight.w500), softWrap: true)),
        if (editing) ...[
          const SizedBox(width: 6),
          GestureDetector(
            onTap: onRemove,
            child: const Icon(Icons.close, size: 15, color: Color(Config.text2)),
          ),
        ],
      ]),
    );
  }
}

Future<void> _editCountries(BuildContext context, ProfileData d, VoidCallback onChanged) async {
  final countries = List<String>.from(d.countries);
  bool saving = false;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setS) => Padding(
        padding: EdgeInsets.fromLTRB(20, 24, 20, MediaQuery.of(ctx).viewInsets.bottom + 28),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Travel Magnets',
              style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 18)),
          const SizedBox(height: 4),
          const Text('Detected from your travel uploads in Trust & Boost. Tap × to remove.',
              style: TextStyle(color: Color(Config.text3), fontSize: 12)),
          const SizedBox(height: 16),
          if (countries.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final c in countries)
                Container(
                  padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
                  decoration: BoxDecoration(
                    color: const Color(Config.bg3),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text('✈️  $c', style: const TextStyle(color: Color(Config.text1), fontSize: 13)),
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: () => setS(() => countries.remove(c)),
                      child: const Icon(Icons.close, size: 14, color: Color(Config.text3)),
                    ),
                  ]),
                ),
            ]),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: saving ? null : () async {
                setS(() => saving = true);
                try {
                  await saveCountries(countries);
                  if (ctx.mounted) Navigator.of(ctx).pop();
                  onChanged();
                } catch (_) {
                  AppLogger.instance.error('save_countries failed', screen: 'profile', action: 'save_countries');
                  setS(() => saving = false);
                }
              },
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accent),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: saving
                  ? const SizedBox(width: 18, height: 18,
                      child: CircularProgressIndicator(color: Color(0xFFFFFFFF), strokeWidth: 2))
                  : const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ]),
      ),
    ),
  );
}

// ── What I'm About (My lane + Hard nos tabs) ─────────────────────────────────

class _WhatImAboutSection extends StatefulWidget {
  final ProfileData data;
  final VoidCallback onChanged;
  const _WhatImAboutSection({required this.data, required this.onChanged});
  @override
  State<_WhatImAboutSection> createState() => _WhatImAboutSectionState();
}

class _WhatImAboutSectionState extends State<_WhatImAboutSection> {
  int _tab = 0; // 0 = My lane, 1 = Hard nos

  void _onEdit() {
    if (_tab == 0) {
      _showLanePickerSheet(context, widget.data, () {
        widget.onChanged();
      });
    } else {
      editHardNos(context, widget.data, widget.onChanged);
    }
  }

  @override
  Widget build(BuildContext context) {
    final arch = archetypeFor(widget.data.archetype);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(color: Color(0x141B1020), height: 36),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row
              Row(children: [
                const Icon(Icons.person_outline, size: 16, color: Color(Config.text2)),
                const SizedBox(width: 6),
                const Text('WHAT I\'M ABOUT',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                        letterSpacing: 0.5, color: Color(Config.text2))),
                const Spacer(),
                GestureDetector(
                  onTap: _onEdit,
                  child: const Icon(Icons.edit_outlined, size: 18, color: Color(Config.text2)),
                ),
              ]),
              const SizedBox(height: 12),
              // Tab pills
              Row(children: [
                _TabPill(label: 'My lane', selected: _tab == 0, onTap: () => setState(() => _tab = 0)),
                const SizedBox(width: 8),
                _TabPill(label: 'Hard nos', selected: _tab == 1, onTap: () => setState(() => _tab = 1)),
              ]),
              const SizedBox(height: 14),
              // Content
              if (_tab == 0) _MyLaneContent(arch: arch, archId: widget.data.archetype)
              else _HardNosContent(hardNos: widget.data.hardNos, onChanged: widget.onChanged),
            ],
          ),
        ),
      ],
    );
  }
}

class _TabPill extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _TabPill({required this.label, required this.selected, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? const Color(0x22FF3B6B) : const Color(Config.bg2),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? const Color(0x4DFF3B6B) : const Color(0x181B1020),
          ),
        ),
        child: Text(label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
              color: selected ? const Color(Config.accent) : const Color(Config.text2),
            )),
      ),
    );
  }
}

class _MyLaneContent extends StatelessWidget {
  final Archetype? arch;
  final String archId;
  const _MyLaneContent({required this.arch, required this.archId});
  @override
  Widget build(BuildContext context) {
    if (arch == null) {
      return const Text('No lane selected yet. Tap edit to pick one.',
          style: TextStyle(color: Color(Config.text3)));
    }
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x4DFF3B6B)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(color: const Color(Config.bg3), borderRadius: BorderRadius.circular(12)),
            child: Center(child: Text(arch!.emoji, style: const TextStyle(fontSize: 24))),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text("YOU'RE A", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                letterSpacing: 1.0, color: Color(Config.text3))),
            const SizedBox(height: 2),
            Text(arch!.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700,
                color: Color(Config.text1))),
          ])),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: const Color(0x22FF3B6B), borderRadius: BorderRadius.circular(999)),
            child: const Text('● Active', style: TextStyle(fontSize: 11, color: Color(Config.accent), fontWeight: FontWeight.w600)),
          ),
        ]),
        if (arch!.longTag.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(arch!.longTag, style: const TextStyle(fontSize: 13, color: Color(Config.text2), height: 1.4)),
        ],
        if (arch!.brings.isNotEmpty) ...[
          const SizedBox(height: 12),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final b in arch!.brings.take(3))
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: const Color(Config.bg3), borderRadius: BorderRadius.circular(999)),
                child: Text(b, style: const TextStyle(fontSize: 12, color: Color(Config.text1))),
              ),
          ]),
        ],
      ]),
    );
  }
}

class _HardNosContent extends StatefulWidget {
  final List<String> hardNos;
  final VoidCallback onChanged;
  const _HardNosContent({required this.hardNos, required this.onChanged});
  @override
  State<_HardNosContent> createState() => _HardNosContentState();
}

class _HardNosContentState extends State<_HardNosContent> {
  late List<String> _items = List.of(widget.hardNos);

  @override
  void didUpdateWidget(_HardNosContent old) {
    super.didUpdateWidget(old);
    // Sync if the parent re-fetched a different list (e.g. after an edit elsewhere).
    if (old.hardNos.join(' ') != widget.hardNos.join(' ')) {
      _items = List.of(widget.hardNos);
    }
  }

  Future<void> _remove(String item) async {
    final prev = List.of(_items);
    setState(() => _items = _items.where((h) => h != item).toList());
    try {
      await saveHardNos(_items); // persists + refreshes the matchmaker pool
      widget.onChanged();
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile', action: 'remove_hard_no');
      if (mounted) setState(() => _items = prev); // revert on failure
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty) {
      return const Text('Tap edit to add your dealbreakers.',
          style: TextStyle(color: Color(Config.text3)));
    }
    return Wrap(
      spacing: 8, runSpacing: 8,
      children: [
        for (final h in _items) _HardNoPill(label: h, onRemove: () => _remove(h)),
      ],
    );
  }
}

/// A removable dealbreaker pill: an accent-tinted chip with a tappable ×.
class _HardNoPill extends StatelessWidget {
  final String label;
  final VoidCallback onRemove;
  const _HardNoPill({required this.label, required this.onRemove});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
      decoration: BoxDecoration(
        color: const Color(0x22FF3B6B),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x4DFF3B6B)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 14, color: Color(Config.text1), fontWeight: FontWeight.w500)),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: onRemove,
            behavior: HitTestBehavior.opaque,
            child: const Padding(
              padding: EdgeInsets.all(2),
              child: Icon(Icons.close, size: 16, color: Color(Config.text2)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet: lane picker (like onboarding). Saves archetype and calls [onChanged].
Future<void> _showLanePickerSheet(BuildContext context, ProfileData data, VoidCallback onChanged) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg1),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => _LanePickerSheet(data: data, onChanged: onChanged),
  );
}

class _LanePickerSheet extends StatefulWidget {
  final ProfileData data;
  final VoidCallback onChanged;
  const _LanePickerSheet({required this.data, required this.onChanged});
  @override
  State<_LanePickerSheet> createState() => _LanePickerSheetState();
}

class _LanePickerSheetState extends State<_LanePickerSheet> {
  String? _expandedSection;
  bool _saving = false;

  Future<void> _pick(BuildContext ctx, Archetype a) async {
    if (_saving) return;
    // Picking the current lane is a no-op — just close.
    if (a.id == widget.data.archetype) {
      Navigator.of(ctx).pop();
      return;
    }
    // Warn before confirming: a lane change cascades through matches, profile
    // and AI advisors, and re-asks the new lane's intent Q&A.
    final confirmed = await showDialog<bool>(
      context: ctx,
      builder: (dctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        title: Text('Switch to ${a.name}?',
            style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
        content: const Text(
          'Your lane shapes everything. Switching will:\n\n'
          '•  Refresh who you see and your match scores\n'
          '•  Swap your "what you bring" set and dating-style baselines\n'
          '•  Update your AI advisor to the new lane\n'
          '•  Re-ask your intent Q&A for the new lane\n\n'
          'Your existing matches stay. Change lanes thoughtfully.',
          style: TextStyle(color: Color(Config.text2), height: 1.45, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dctx).pop(false),
            child: const Text('Cancel', style: TextStyle(color: Color(Config.text2))),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dctx).pop(true),
            style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accent), foregroundColor: Colors.white),
            child: const Text('Switch lane'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _saving = true);
    try {
      await saveArchetype(a.id);
      // Reset Q&A so user re-fills with new archetype's questions
      await resetQAVerification();
      if (ctx.mounted) {
        Navigator.of(ctx).pop();
        ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
          content: Text('Lane updated! Please re-fill your Intent Q&A in Trust & Boost.'),
          duration: Duration(seconds: 4),
        ));
      }
      widget.onChanged();
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile', action: 'generate_avatar');
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
          content: Text('Could not update lane: $e'),
          backgroundColor: Colors.red,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sections = laneSectionsFor(widget.data.gender ?? 'man');
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (ctx, scrollCtrl) => Column(children: [
        // Handle
        Container(
          margin: const EdgeInsets.only(top: 12, bottom: 8),
          width: 40, height: 4,
          decoration: BoxDecoration(color: const Color(0x331B1020), borderRadius: BorderRadius.circular(2)),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text('Pick your lane', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(Config.text1))),
          ),
        ),
        Expanded(
          child: ListView(
            controller: scrollCtrl,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
            children: [
              const Text('Switch anytime.', style: TextStyle(fontSize: 13, color: Color(Config.text3))),
              const SizedBox(height: 16),
              for (final s in sections) _buildSection(ctx, s),
            ],
          ),
        ),
        if (_saving)
          const Padding(
            padding: EdgeInsets.all(16),
            child: CircularProgressIndicator(color: Color(Config.accent)),
          ),
      ]),
    );
  }

  Widget _buildSection(BuildContext ctx, LaneSection section) {
    final isSerious = section.label == 'Serious Connection';
    final isOpen = _expandedSection == section.label;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x181B1020)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        GestureDetector(
          onTap: () => setState(() => _expandedSection = isOpen ? null : section.label),
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: isSerious ? const Color(0x1FE11D54) : const Color(0x1FA78BFA),
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  '${isSerious ? '❤️' : '✌️'}  ${section.label.toUpperCase()}',
                  style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5,
                    color: isSerious ? const Color(Config.accentBright) : const Color(0xFFA78BFA),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text('${section.archetypes.length} options',
                  style: const TextStyle(fontSize: 12, color: Color(Config.text3)))),
              AnimatedRotation(
                turns: isOpen ? 0.25 : -0.25,
                duration: const Duration(milliseconds: 220),
                child: const Icon(Icons.chevron_right, color: Color(Config.text3), size: 22),
              ),
            ]),
          ),
        ),
        if (isOpen) ...[
          const Divider(height: 1, thickness: 1, color: Color(0x181B1020)),
          for (final a in section.archetypes) _archetypeRow(ctx, a, isLast: a == section.archetypes.last),
        ],
      ]),
    );
  }

  Widget _archetypeRow(BuildContext ctx, Archetype a, {bool isLast = false}) {
    final isCurrent = a.id == widget.data.archetype;
    return Column(children: [
      InkWell(
        onTap: () => showArchetypeDetailSheet(ctx, a, onLockIn: () => _pick(ctx, a)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(children: [
            Text(a.emoji, style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(a.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(Config.text1))),
              const SizedBox(height: 2),
              Text(a.tag, style: const TextStyle(fontSize: 12, color: Color(Config.text3), height: 1.3)),
            ])),
            if (isCurrent)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0x22FF3B6B), borderRadius: BorderRadius.circular(999)),
                child: const Text('Current', style: TextStyle(fontSize: 11, color: Color(Config.accent), fontWeight: FontWeight.w600)),
              )
            else
              const Icon(Icons.chevron_right, color: Color(Config.text3), size: 18),
          ]),
        ),
      ),
      if (!isLast) const Divider(height: 1, thickness: 1, indent: 16, color: Color(0x181B1020)),
    ]);
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

/// An AI portrait slot — shows the image + Regenerate when present, or a
/// Generate button when absent. Generates from the user's lead photo, persists
/// the URL, then refreshes the profile.
class _PortraitTile extends StatefulWidget {
  final String? url;
  final String? referenceUrl;
  final bool lifestyle;
  final VoidCallback onChanged;
  const _PortraitTile({required this.url, required this.referenceUrl, required this.lifestyle, required this.onChanged});
  @override
  State<_PortraitTile> createState() => _PortraitTileState();
}

class _PortraitTileState extends State<_PortraitTile> {
  bool _busy = false;
  String? _error;

  Future<void> _generate() async {
    final ref = widget.referenceUrl;
    if (ref == null || !ref.startsWith('http')) {
      setState(() => _error = 'Add a profile photo first.');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      await generatePortrait(referenceImageUrl: ref, lifestyle: widget.lifestyle);
      widget.onChanged();
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile', action: 'generate_portrait');
      setState(() { _busy = false; _error = 'Couldn\'t generate: $e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_busy) {
      return Container(
        height: 200,
        decoration: BoxDecoration(color: const Color(Config.bg3), borderRadius: BorderRadius.circular(14)),
        child: const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          CircularProgressIndicator(color: Color(Config.accent)),
          SizedBox(height: 12),
          Text('Generating your portrait…\nthis takes 20–30 seconds', textAlign: TextAlign.center, style: TextStyle(color: Color(Config.text2), fontSize: 13)),
        ])),
      );
    }
    if (widget.url != null) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Stack(children: [
            CachedNetworkImage(imageUrl: widget.url!, fit: BoxFit.cover, width: double.infinity,
                placeholder: (c, _) => Container(height: 200, color: const Color(Config.bg3)),
                errorWidget: (c, _, _) => const SizedBox.shrink()),
            const Positioned(left: 10, bottom: 8,
                child: Text('✨ Generated from your verified photos', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600))),
          ]),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: _generate,
            icon: const Icon(Icons.refresh, size: 16, color: Color(Config.accent)),
            label: const Text('Regenerate', style: TextStyle(color: Color(Config.accent))),
          ),
        ),
      ]);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(
        width: double.infinity, height: 48,
        child: FilledButton.icon(
          onPressed: _generate,
          icon: const Icon(Icons.auto_awesome, size: 18),
          label: Text('Generate ${widget.lifestyle ? 'lifestyle portrait' : 'AI portrait'}', style: const TextStyle(fontWeight: FontWeight.w700)),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0x22FF3B6B),
            foregroundColor: const Color(Config.accent),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
      if (_error != null) ...[
        const SizedBox(height: 6),
        Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)),
      ],
    ]);
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
    final tabs = <(String, String, SignalGroup, String)>[
      if (d.career != null)    ('💼', 'Career',    d.career!,    'linkedin'),
      if (d.lifestyle != null) ('🌍', 'Lifestyle', d.lifestyle!, 'lifestyle'),
      if (d.health != null)    ('💪', 'Health',    d.health!,    'discipline'),
      if (d.social != null)    ('🤝', 'Social',    d.social!,    'social_proof'),
    ];
    if (tabs.isEmpty) return const SizedBox.shrink();
    final active = _tab.clamp(0, tabs.length - 1);
    final tab = tabs[active];

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // ── Category tabs ──
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          for (var i = 0; i < tabs.length; i++)
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
                    Text(tabs[i].$1, style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: 5),
                    Text(tabs[i].$2,
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
      // ── Content card ──
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
          // Verified badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: const Color(0x1500C853),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.verified, size: 11, color: Color(0xFF00C853)),
              const SizedBox(width: 4),
              Text('Verified ${tab.$2}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF00C853), fontWeight: FontWeight.w600)),
            ]),
          ),
          const SizedBox(height: 12),
          // Editable chips
          _EditableChips(
            key: ValueKey('sig_${tab.$4}'),
            category: tab.$4,
            initial: tab.$3.chips,
            aggregated: tab.$3.aggregated,
          ),
          // AI summary
          if (tab.$3.aggregated.isNotEmpty) ...[
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
                Expanded(child: Text(tab.$3.aggregated,
                    style: const TextStyle(fontSize: 13, fontStyle: FontStyle.italic,
                        color: Color(Config.text2), height: 1.5))),
              ]),
            ),
          ],
        ]),
      ),
    ]);
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
  // When the displayed photos are AI-enhanced (men), the spec requires the hero
  // to be clearly labeled as generated from verified photos, so a viewer is
  // never misled into thinking it's a literal, untouched snapshot.
  final bool aiEnhanced;
  const _Hero({required this.photos, required this.fallback, this.aiEnhanced = false});
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
    // Accept both https:// URLs (Supabase Storage) and data: base64 URIs (local uploads).
    var urls = widget.photos.where((u) => u.startsWith('http') || u.startsWith('data:')).toList();
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
          // PageView with NeverScrollableScrollPhysics — navigation is handled
          // by tap zones below so there is zero gesture conflict with the parent
          // ListView (tap-to-advance is the Tinder/Instagram/Hinge pattern).
          PageView.builder(
            controller: _ctrl,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: urls.length,
            onPageChanged: (i) => setState(() => _i = i),
            itemBuilder: (c, i) {
              final url = urls[i];
              if (url.startsWith('data:')) {
                try {
                  final comma = url.indexOf(',');
                  final bytes = base64Decode(url.substring(comma + 1));
                  return Image.memory(bytes, fit: BoxFit.cover,
                      errorBuilder: (c, _, _) => const _PhotoPlaceholder());
                } catch (_) {
                  AppLogger.instance.error('decode_photo failed', screen: 'profile', action: 'decode_photo');
                  return const _PhotoPlaceholder();
                }
              }
              return CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                placeholder: (c, _) => const ColoredBox(
                  color: Color(Config.bg2),
                  child: Center(child: CircularProgressIndicator(color: Color(Config.accent))),
                ),
                errorWidget: (c, _, _) => const _PhotoPlaceholder(),
              );
            },
          ),
          // Tap zones: left half = previous, right half = next.
          // Transparent and above the PageView so they consume taps without
          // interfering with vertical ListView scrolling.
          if (urls.length > 1)
            Positioned.fill(
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onTap: () {
                        if (_i > 0) _ctrl.previousPage(
                          duration: const Duration(milliseconds: 250),
                          curve: Curves.easeOut,
                        );
                      },
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onTap: () {
                        if (_i < urls.length - 1) _ctrl.nextPage(
                          duration: const Duration(milliseconds: 250),
                          curve: Curves.easeOut,
                        );
                      },
                    ),
                  ),
                ],
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
          // AI-enhanced label — only over a real photo (never the placeholder),
          // so viewers know the men's hero is generated from verified photos.
          if (widget.aiEnhanced)
            Positioned(
              top: 12, left: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xCC1B1020),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Text('✨', style: TextStyle(fontSize: 11)),
                  SizedBox(width: 5),
                  Text('Generated from verified photos',
                      style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Archetype base scores (mirrors profile_body.dart) ─────────────────────────
Map<String, int> _archetypeBaseScores(String archetype) {
  final a = archetype.toLowerCase();
  if (a.contains('forever') || a.contains('matrimony') || a.contains('marriage'))
    return {'decisiveness': 70, 'warmth': 80, 'openness': 60, 'pace': 55};
  if (a.contains('casual') && a.contains('generous'))
    return {'decisiveness': 80, 'warmth': 65, 'openness': 70, 'pace': 72};
  if (a.contains('romantic') || a.contains('hopeless'))
    return {'decisiveness': 62, 'warmth': 88, 'openness': 75, 'pace': 58};
  if (a.contains('second chapter'))
    return {'decisiveness': 78, 'warmth': 75, 'openness': 65, 'pace': 50};
  if (a.contains('safety'))
    return {'decisiveness': 60, 'warmth': 75, 'openness': 55, 'pace': 45};
  if (a.contains('spoilt'))
    return {'decisiveness': 65, 'warmth': 65, 'openness': 65, 'pace': 60};
  return {'decisiveness': 75, 'warmth': 60, 'openness': 70, 'pace': 70};
}

// ── Personality Reads ─────────────────────────────────────────────────────────

class _PersonalityReadsSection extends StatelessWidget {
  final ProfileData data;
  const _PersonalityReadsSection({required this.data});

  static const _defaults = [
    (name: 'Decisiveness', pct: 95),
    (name: 'Warmth',       pct: 80),
    (name: 'Openness',     pct: 75),
    (name: 'Pace',         pct: 65),
    (name: 'Stability',    pct: 78),
  ];

  List<({String name, int pct})> get _reads {
    // 1. Try rawGenerated personalityReads first
    final raw = data.rawGenerated['personalityReads'];
    if (raw is List && raw.isNotEmpty) {
      final result = <({String name, int pct})>[];
      for (final item in raw) {
        if (item is Map) {
          result.add((
            name: (item['name'] ?? '').toString(),
            pct: item['percentage'] is num
                ? (item['percentage'] as num).toInt()
                : 0,
          ));
        }
      }
      if (result.isNotEmpty) return result;
    }
    // 2. Try rawGenerated traitScores (same data Discovery uses)
    final ts = data.rawGenerated['traitScores'];
    if (ts is Map && ts.isNotEmpty) {
      const order = ['decisiveness', 'warmth', 'openness', 'pace', 'stability'];
      final result = <({String name, int pct})>[];
      for (final key in order) {
        if (ts.containsKey(key)) {
          final val = ts[key];
          result.add((
            name: key[0].toUpperCase() + key.substring(1),
            pct: val is num ? val.toInt() : 0,
          ));
        }
      }
      if (result.isNotEmpty) return result;
    }
    // 3. Fallback: derive from archetype (same as Discovery does)
    const order = ['decisiveness', 'warmth', 'openness', 'pace', 'stability'];
    final archScores = _archetypeBaseScores(data.archetype);
    if (archScores.isNotEmpty) {
      return [
        for (final key in order)
          if (archScores.containsKey(key))
            (name: key[0].toUpperCase() + key.substring(1), pct: archScores[key]!),
      ];
    }
    return _defaults;
  }

  @override
  Widget build(BuildContext context) {
    final reads = _reads;
    return _Section(
      icon: Icons.radar,
      title: 'PERSONALITY READS',
      subtitle: 'inferred from Q&A + lifestyle',
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        padding: const EdgeInsets.all(16),
        child: AspectRatio(
          aspectRatio: 1.0,
          child: CustomPaint(painter: _RadarPainter(reads)),
        ),
      ),
    );
  }
}

class _RadarPainter extends CustomPainter {
  final List<({String name, int pct})> reads;
  const _RadarPainter(this.reads);

  // Start at top (-π/2) and go clockwise
  double _angle(int i) => -pi / 2 + 2 * pi * i / reads.length;

  @override
  void paint(Canvas canvas, Size size) {
    if (reads.isEmpty) return;
    final n = reads.length;

    // Reserve margin for axis labels
    const margin = 52.0;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final maxR = min(size.width, size.height) / 2 - margin;

    // ── Grid ──
    final gridPaint = Paint()
      ..color = const Color(0x22FF3B6B)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8;
    for (int level = 1; level <= 4; level++) {
      _polygon(canvas, cx, cy, maxR * level / 4, n, gridPaint);
    }

    // ── Axis lines ──
    final axisPaint = Paint()
      ..color = const Color(0x22FF3B6B)
      ..strokeWidth = 0.8;
    for (int i = 0; i < n; i++) {
      final a = _angle(i);
      canvas.drawLine(Offset(cx, cy),
          Offset(cx + maxR * cos(a), cy + maxR * sin(a)), axisPaint);
    }

    // ── Data polygon ──
    final path = Path();
    for (int i = 0; i < n; i++) {
      final a = _angle(i);
      final r = maxR * reads[i].pct.clamp(0, 100) / 100;
      final pt = Offset(cx + r * cos(a), cy + r * sin(a));
      i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
    }
    path.close();
    canvas.drawPath(path,
        Paint()..color = const Color(0x1AFF3B6B)..style = PaintingStyle.fill);
    canvas.drawPath(path,
        Paint()..color = const Color(0xFFFF3B6B)..style = PaintingStyle.stroke..strokeWidth = 2);

    // ── Dots ──
    for (int i = 0; i < n; i++) {
      final a = _angle(i);
      final r = maxR * reads[i].pct.clamp(0, 100) / 100;
      final pt = Offset(cx + r * cos(a), cy + r * sin(a));
      canvas.drawCircle(pt, 5,
          Paint()..color = Colors.white..style = PaintingStyle.fill);
      canvas.drawCircle(pt, 3.5,
          Paint()..color = const Color(0xFFFF3B6B)..style = PaintingStyle.fill);
    }

    // ── Labels ──
    for (int i = 0; i < n; i++) {
      final a = _angle(i);
      final lx = cx + (maxR + 16) * cos(a);
      final ly = cy + (maxR + 16) * sin(a);
      _drawLabel(canvas, reads[i].name, reads[i].pct, lx, ly, cos(a), sin(a));
    }
  }

  void _polygon(Canvas canvas, double cx, double cy, double r, int n, Paint paint) {
    final path = Path();
    for (int i = 0; i < n; i++) {
      final a = _angle(i);
      final pt = Offset(cx + r * cos(a), cy + r * sin(a));
      i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
    }
    path.close();
    canvas.drawPath(path, paint);
  }

  void _drawLabel(Canvas canvas, String name, int pct,
      double x, double y, double cosA, double sinA) {
    final namePainter = TextPainter(
      text: TextSpan(
        text: name,
        style: const TextStyle(
          color: Color(0xFF1B1020),
          fontSize: 11,
          fontWeight: FontWeight.w600,
          height: 1.2,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: 90);

    final pctPainter = TextPainter(
      text: TextSpan(
        text: '$pct',
        style: const TextStyle(
          color: Color(0xFFFF3B6B),
          fontSize: 10,
          fontWeight: FontWeight.w700,
          height: 1.2,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    // Horizontal positioning based on which side of centre
    final double nx, px;
    if (cosA > 0.3) {
      // Right side: left-align text at x
      nx = x + 4;
      px = x + 4;
    } else if (cosA < -0.3) {
      // Left side: right-align text at x
      nx = x - namePainter.width - 4;
      px = x - pctPainter.width - 4;
    } else {
      // Top / bottom: center
      nx = x - namePainter.width / 2;
      px = x - pctPainter.width / 2;
    }

    // Vertical: name then pct; anchor point shifts for top/bottom
    final double ny, py;
    if (sinA < -0.3) {
      // Top: stack upward from anchor
      ny = y - namePainter.height - pctPainter.height - 2;
      py = ny + namePainter.height + 2;
    } else if (sinA > 0.3) {
      // Bottom: stack downward
      ny = y + 4;
      py = ny + namePainter.height + 2;
    } else {
      // Left / right: vertically centred
      final totalH = namePainter.height + 2 + pctPainter.height;
      ny = y - totalH / 2;
      py = ny + namePainter.height + 2;
    }

    namePainter.paint(canvas, Offset(nx, ny));
    pctPainter.paint(canvas, Offset(px, py));
  }

  @override
  bool shouldRepaint(_RadarPainter old) => old.reads != reads;
}

// ── Photo Story ───────────────────────────────────────────────────────────────

/// Shows the 3-slot photo grid (lead / warmth / lifestyle) with AI-enhance CTA.
/// Manages its own enhancement loading state so the rest of the profile stays
/// interactive while the ~30s generation runs.
class _PhotoStorySection extends StatefulWidget {
  final ProfileData data;
  final VoidCallback onChanged;
  const _PhotoStorySection({required this.data, required this.onChanged});

  @override
  State<_PhotoStorySection> createState() => _PhotoStorySectionState();
}

class _PhotoStorySectionState extends State<_PhotoStorySection> {
  bool _enhancing = false;
  String? _enhanceError;
  late List<AiPhotoItem> _aiPhotos;
  bool _autoEnhanceAttempted = false;

  static const _slots = ['lead', 'warmth', 'lifestyle'];

  @override
  void initState() {
    super.initState();
    _aiPhotos = List.of(widget.data.aiPhotoItems);
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeAutoEnhance());
  }

  @override
  void didUpdateWidget(_PhotoStorySection old) {
    super.didUpdateWidget(old);
    if (old.data != widget.data) {
      _aiPhotos = List.of(widget.data.aiPhotoItems);
      _maybeAutoEnhance();
    }
  }

  /// A man's raw photo must never reach viewers, so once he has real photos but
  /// no AI portraits yet, generate them automatically (once per screen instance).
  void _maybeAutoEnhance() {
    if (_autoEnhanceAttempted || _enhancing) return;
    if (!widget.data.isMan) return;
    if (widget.data.uploadedPhotos.isEmpty || _aiPhotos.isNotEmpty) return;
    _autoEnhanceAttempted = true;
    _handleEnhance();
  }

  /// Resolve slot: AI photo by role → uploaded photo by label/index → null.
  String? _resolve(String slot) {
    for (final ai in _aiPhotos) {
      if (ai.role == slot) return ai.url;
    }
    final uploaded = widget.data.uploadedPhotos;
    for (final up in uploaded) {
      if (up.label == slot) return up.url;
    }
    // Index-based fallback: lead=0, warmth=1, lifestyle=2
    final idx = _slots.indexOf(slot);
    if (idx >= 0 && idx < uploaded.length) return uploaded[idx].url;
    return null;
  }

  Future<void> _handleEnhance() async {
    final uploaded = widget.data.uploadedPhotos;
    if (uploaded.isEmpty) return;
    setState(() { _enhancing = true; _enhanceError = null; });
    try {
      final items = await enhancePhotos(uploaded.first.url, archetype: widget.data.archetype);
      await saveAiPhotos(items);
      setState(() { _aiPhotos = items; _enhancing = false; });
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile', action: 'enhance_photos');
      setState(() { _enhancing = false; _enhanceError = 'Couldn\'t enhance: $e'; });
    }
  }

  /// Women: up to 6 real photos as tiles, plus one "add" tile while under cap.
  List<Widget> _womenTiles(ProfileData data) {
    final ups = data.uploadedPhotos;
    void open() => openPhotoManager(context, data, widget.onChanged);
    final tiles = <Widget>[
      for (var i = 0; i < ups.length && i < 6; i++)
        _PhotoSlot(
          url: ups[i].url,
          isAi: false,
          label: i == 0 ? 'lead' : 'photo',
          isMan: false,
          onTap: open,
        ),
    ];
    if (ups.length < 6) {
      tiles.add(_PhotoSlot(url: null, isAi: false, label: 'photo', isMan: false, onTap: open));
    }
    return tiles;
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final isMan = data.isMan;
    final hasAiPhotos = _aiPhotos.isNotEmpty;
    final hasRealPhotos = data.uploadedPhotos.isNotEmpty;
    final filled = _slots.where((s) => _resolve(s) != null).length;
    final realCount = data.uploadedPhotos.length.clamp(0, 6);
    final subtitle = isMan
        ? (hasAiPhotos ? '$filled/3  ✨ AI-enhanced' : '$filled/3')
        : '$realCount/6  · real photos';

    return _Section(
      icon: Icons.photo_library_outlined,
      title: 'PHOTO STORY',
      subtitle: subtitle,
      onEdit: () => openPhotoManager(context, data, widget.onChanged),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_enhancing)
            Container(
              height: 72,
              decoration: BoxDecoration(
                  color: const Color(Config.bg3), borderRadius: BorderRadius.circular(12)),
              child: const Center(
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  SizedBox(
                    width: 16, height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)),
                  ),
                  SizedBox(width: 10),
                  Text('Generating AI photos… (~30s)',
                      style: TextStyle(color: Color(Config.text2), fontSize: 13)),
                ]),
              ),
            )
          else
            GridView.count(
              crossAxisCount: 3,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: isMan
                  ? [
                      for (final slot in _slots)
                        _PhotoSlot(
                          url: _resolve(slot),
                          isAi: _aiPhotos.any((a) => a.role == slot),
                          label: slot,
                          isMan: true,
                          onTap: () => openPhotoManager(context, data, widget.onChanged),
                        ),
                    ]
                  : _womenTiles(data),
            ),
          if (_enhanceError != null) ...[
            const SizedBox(height: 6),
            Text(_enhanceError!,
                style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)),
          ],
          const SizedBox(height: 10),
          Text(
            isMan
                ? 'Viewers only ever see your AI-enhanced photos — your raw photo is never shown, before or after a match.'
                : 'Shown exactly as you upload them — real photos, no AI filters.',
            style: const TextStyle(fontSize: 12, color: Color(Config.text3), height: 1.35),
          ),
          const SizedBox(height: 12),
          // Enhance with AI — shown for men only; greyed out until photos exist
          if (isMan)
            SizedBox(
              width: double.infinity, height: 50,
              child: FilledButton(
                onPressed: (_enhancing || !hasRealPhotos) ? null : _handleEnhance,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(Config.accent),
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0x44FF3B6B),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _enhancing
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Row(mainAxisSize: MainAxisSize.min, children: [
                        const Text('✨', style: TextStyle(fontSize: 16)),
                        const SizedBox(width: 8),
                        Text(
                          hasAiPhotos ? 'Regenerate AI Photos' : 'Enhance with AI',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                      ]),
              ),
            )
          else
            SizedBox(
              width: double.infinity, height: 46,
              child: OutlinedButton.icon(
                onPressed: () => openPhotoManager(context, data, widget.onChanged),
                icon: const Icon(Icons.add_a_photo_outlined, size: 18),
                label: Text(hasRealPhotos ? 'Manage Photos' : 'Add Photos',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(Config.accent)),
                  foregroundColor: const Color(Config.accent),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PhotoSlot extends StatelessWidget {
  final String? url;
  final bool isAi;
  final String label;
  final bool isMan;
  final VoidCallback onTap;
  const _PhotoSlot({
    required this.url,
    required this.isAi,
    required this.label,
    required this.isMan,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (url != null) {
      return GestureDetector(
        onTap: onTap,
        child: Stack(fit: StackFit.expand, children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: CachedNetworkImage(
              imageUrl: url!,
              fit: BoxFit.cover,
              placeholder: (c, _) => const ColoredBox(
                color: Color(Config.bg3),
                child: Center(
                  child: SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)),
                  ),
                ),
              ),
              errorWidget: (c, _, _) => const ColoredBox(
                color: Color(Config.bg3),
                child: Center(
                  child: Icon(Icons.broken_image_outlined, color: Color(Config.text3), size: 22),
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 4, left: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xCC000000),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(label,
                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
            ),
          ),
          if (isAi)
            const Positioned(top: 4, right: 4, child: Text('✨', style: TextStyle(fontSize: 14))),
        ]),
      );
    }
    return GestureDetector(
      onTap: onTap,
      child: CustomPaint(
        painter: _DashedSlotBorder(color: const Color(0x99FF3B6B), radius: 10),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0x0AFF3B6B),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.add_photo_alternate_outlined, color: Color(Config.accent), size: 28),
            const SizedBox(height: 5),
            const Text('Add photo', style: TextStyle(fontSize: 11, color: Color(Config.text2), fontWeight: FontWeight.w500)),
            if (isMan)
              const Text('AI will enhance',
                  style: TextStyle(fontSize: 10, color: Color(Config.accent), fontStyle: FontStyle.italic)),
          ]),
        ),
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

class _DashedSlotBorder extends CustomPainter {
  final Color color;
  final double radius;
  const _DashedSlotBorder({required this.color, this.radius = 10});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.6
      ..style = PaintingStyle.stroke;
    const dash = 5.0, gap = 4.0;
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(1, 1, size.width - 2, size.height - 2),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    final metric = path.computeMetrics().first;
    double dist = 0;
    while (dist < metric.length) {
      canvas.drawPath(metric.extractPath(dist, dist + dash), paint);
      dist += dash + gap;
    }
  }

  @override
  bool shouldRepaint(_DashedSlotBorder old) => old.color != color || old.radius != radius;
}

class _Stat extends StatelessWidget {
  final String label, sub;
  final String? value; // null = show amber bar (PROFILE when about is empty)
  final Color? valueColor;
  const _Stat({required this.label, this.value, required this.sub, this.valueColor});
  @override
  Widget build(BuildContext context) {
    final color = valueColor ?? const Color(Config.text1);
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Top: label + value
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                  letterSpacing: 0.5, color: Color(Config.text3))),
              const SizedBox(height: 8),
              if (value == null)
                Container(width: 42, height: 4, decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B),
                  borderRadius: BorderRadius.circular(2),
                ))
              else
                Text(value!, style: TextStyle(
                  fontSize: 40, fontWeight: FontWeight.w700,
                  fontStyle: FontStyle.italic, color: color,
                  height: 1.1,
                )),
            ]),
            // Bottom: always at same level
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(sub, style: const TextStyle(fontSize: 12, color: Color(Config.text2))),
            ),
          ],
        ),
      ),
    );
  }
}
