import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'archetypes.dart';
import 'config.dart';
import 'profile_body.dart' show travelMagnets, moneyMattersCard;
import 'profile_edit.dart';
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
            return _ErrorState(onRetry: _refresh, error: '${snap.error ?? 'No data'}');
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
    final arch = data.archetype.isNotEmpty ? archetypeFor(data.archetype) : null;
    final brings = data.isMan ? archetypeBrings[data.archetype] : null;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      children: [
        Stack(children: [
          _Hero(photos: data.photos, fallback: data.heroPhotoUrl),
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
        _Section(
          emoji: '💰',
          title: 'MONEY MATTERS',
          onEdit: () => _editMoneyMatters(context, data, onChanged),
          child: moneyMattersCard(
            income: data.annualIncome ?? data.netWorth,
            tiles: [
              if (data.wealth != null) for (final c in data.wealth!.chips) (c.emoji, c.label),
              for (final s in data.spending) (s.emoji, s.category),
            ],
            footer: data.annualIncome != null || data.netWorth != null
                ? '✓ AI verified via bank statement / financial document'
                : null,
            onUpload: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ProofUploadScreen())).then((_) => onChanged()),
          ),
        ),

        // ── AI portraits (generate from your photos) ─────────────────────
        _Section(
          icon: Icons.auto_awesome,
          title: 'AI PORTRAIT',
          subtitle: 'generated from your photos',
          child: _PortraitTile(
            url: data.personalityPortraitUrl,
            referenceUrl: data.heroPhotoUrl,
            lifestyle: false,
            onChanged: onChanged,
          ),
        ),
        _Section(
          icon: Icons.auto_awesome,
          title: 'AI LIFESTYLE PORTRAIT',
          subtitle: 'evening city vibe',
          child: _PortraitTile(
            url: data.garagePortraitUrl,
            referenceUrl: data.heroPhotoUrl,
            lifestyle: true,
            onChanged: onChanged,
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
            child: travelMagnets(data.countries),
          ),

        // ── Hard nos ─────────────────────────────────────────────────────
        if (data.gender != null)
          _Section(
            icon: Icons.block,
            title: 'HARD NOS',
            onEdit: () => editHardNos(context, data, onChanged),
            child: data.hardNos.isEmpty
                ? const Text('Tap edit to add your dealbreakers.',
                    style: TextStyle(color: Color(Config.text3)))
                : Wrap(
                    spacing: 8, runSpacing: 8,
                    children: [for (final h in data.hardNos) _Pill('✕ $h')],
                  ),
          ),

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
  final ageCtrl = TextEditingController(text: d.age?.toString() ?? '');
  final cityCtrl = TextEditingController(text: d.city ?? '');
  await _editSheet(
    context,
    title: 'Edit your details',
    fields: [
      _EditField(controller: nameCtrl, label: 'First name', textCapitalization: TextCapitalization.words),
      _EditField(controller: ageCtrl, label: 'Age', keyboardType: TextInputType.number),
      _EditField(controller: cityCtrl, label: 'City'),
    ],
    onSave: () async {
      final name = nameCtrl.text.trim();
      if (name.isEmpty) throw 'Name can’t be empty';
      await saveIdentity(
        firstName: name,
        age: int.tryParse(ageCtrl.text.trim()),
        city: cityCtrl.text.trim(),
      );
    },
    onChanged: onChanged,
  );
}

Future<void> _editMoneyMatters(BuildContext context, ProfileData d, VoidCallback onChanged) async {
  final incomeCtrl = TextEditingController(text: d.annualIncome ?? '');
  final netWorthCtrl = TextEditingController(text: d.netWorth ?? '');
  await _editSheet(
    context,
    title: 'Money Matters',
    fields: [
      _EditField(controller: incomeCtrl, label: 'Annual income (e.g. Rp 250,000,000)', textCapitalization: TextCapitalization.sentences),
      _EditField(controller: netWorthCtrl, label: 'Net worth (optional)', textCapitalization: TextCapitalization.sentences),
    ],
    onSave: () => saveMoneyMatters(
      income: incomeCtrl.text,
      netWorth: netWorthCtrl.text,
      existingGenerated: d.rawGenerated,
    ),
    onChanged: onChanged,
  );
}

Future<void> _editAbout(BuildContext context, ProfileData d, VoidCallback onChanged) async {
  final ctrl = TextEditingController(text: d.about);
  await _editSheet(
    context,
    title: 'Edit your About',
    fields: [
      _EditField(controller: ctrl, label: 'About you', maxLines: 5, textCapitalization: TextCapitalization.sentences),
    ],
    onSave: () => saveAbout(ctrl.text, d.rawGenerated),
    onChanged: onChanged,
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
      setState(() { _busy = false; _error = '$e'; });
    }
  }

  Future<void> _add(InsightChip c) async {
    setState(() { _chips.add(c); _pending.remove(c); });
    try {
      await addInsightChip(widget.category, c.label, c.emoji);
    } catch (e) {
      setState(() { _chips.remove(c); _error = '$e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final c in _chips)
            _ChipWithRemove(text: '${c.emoji} ${c.label}', editing: _edit, onRemove: () => _remove(c)),
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
        ]),
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
        Text(text, style: const TextStyle(fontSize: 13, color: Color(Config.text1), fontWeight: FontWeight.w500)),
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
      setState(() { _busy = false; _error = 'Couldn’t generate: $e'; });
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
    final tabs = <(String, SignalGroup, String)>[
      if (d.career != null) ('💼 Career', d.career!, 'linkedin'),
      if (d.lifestyle != null) ('🌍 Lifestyle', d.lifestyle!, 'lifestyle'),
      if (d.health != null) ('💪 Health', d.health!, 'discipline'),
      if (d.social != null) ('🤝 Social', d.social!, 'social_proof'),
    ];
    if (tabs.isEmpty) return const SizedBox.shrink();
    final active = _tab.clamp(0, tabs.length - 1);
    final group = tabs[active].$2;
    final category = tabs[active].$3;

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
                      color: i == active ? const Color(0x22FF3B6B) : const Color(Config.bg3),
                      borderRadius: BorderRadius.circular(999),
                      border: i == active ? Border.all(color: const Color(0x4DFF3B6B)) : null,
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
        _EditableChips(
          key: ValueKey('sig_$category'),
          category: category,
          initial: group.chips,
          aggregated: group.aggregated,
        ),
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
