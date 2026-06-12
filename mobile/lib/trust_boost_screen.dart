import 'package:flutter/material.dart';
import 'api.dart';
import 'archetypes.dart';
import 'config.dart';
import 'proof_upload_screen.dart';

/// A boostable proof category shown on the Trust & Boost page.
class _Cat {
  final String id, emoji, title, subtitle;
  final int pts;
  const _Cat(this.id, this.emoji, this.title, this.subtitle, this.pts);
}

const _showOff = <_Cat>[
  _Cat('lifestyle', '🌍', 'Lifestyle', 'Travel & experiences', 8),
  _Cat('hosting', '🍽️', 'Hosting', 'Dinners, celebrations', 6),
  _Cat('discipline', '💪', 'Discipline', 'Fitness & routine', 4),
  _Cat('social_proof', '🤝', 'Social Proof', 'Your social side', 4),
  _Cat('wealth', '💎', 'Wealth', 'Financial standing', 12),
  _Cat('assets', '🚗', 'Assets', 'Car, home', 10),
];

const _socials = <_Cat>[
  _Cat('linkedin', '💼', 'LinkedIn', '', 5),
  _Cat('instagram', '📸', 'Instagram', '', 3),
  _Cat('twitter', '𝕏', 'X', '', 2),
];

class TrustBoostScreen extends StatefulWidget {
  const TrustBoostScreen({super.key});
  @override
  State<TrustBoostScreen> createState() => _TrustBoostScreenState();
}

class _TrustBoostScreenState extends State<TrustBoostScreen> {
  late Future<TrustData> _future;

  @override
  void initState() {
    super.initState();
    _future = fetchTrust();
  }

  Future<void> _refresh() async {
    setState(() { _future = fetchTrust(); });
    await _future;
  }

  Future<void> _upload() async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProofUploadScreen()));
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('Trust & Boost', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
      ),
      body: FutureBuilder<TrustData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(Config.accent)));
          }
          if (snap.hasError || !snap.hasData) {
            return Center(child: Text('Could not load trust.\n${snap.error ?? ''}',
                textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2))));
          }
          final d = snap.data!;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
              children: [
                _statsHeader(d),
                const SizedBox(height: 16),
                _privacyBanner(),
                const SizedBox(height: 20),
                _label('🛡  YOUR TRUST SCORE'),
                const SizedBox(height: 10),
                _scoreCard(d),
                const SizedBox(height: 20),
                _label('🛟  SAFETY CHECK'),
                const SizedBox(height: 10),
                _safetyCheck(d),
                const SizedBox(height: 20),
                _label("➕  SHOW-OFF", hint: "prove, don't claim"),
                const SizedBox(height: 10),
                for (final c in _showOff) _proofCard(d, c),
                const SizedBox(height: 16),
                _label('🔗  SOCIALS', hint: 'connect to verify'),
                const SizedBox(height: 10),
                Row(children: [
                  for (final c in _socials) Expanded(child: Padding(
                    padding: EdgeInsets.only(right: c == _socials.last ? 0 : 10),
                    child: _socialTile(d, c),
                  )),
                ]),
                const SizedBox(height: 20),
                _backgroundCheck(),
                const SizedBox(height: 20),
                _verifiedInsights(d),
              ],
            ),
          );
        },
      ),
    );
  }

  // ── Sections ───────────────────────────────────────────────────────────────

  Widget _statsHeader(TrustData d) => Row(children: [
        _stat('TRUST', d.trustScore > 0 ? '${d.trustScore}' : '—', trustLabel(d.trustScore), const Color(Config.accent)),
        _vline(),
        _stat('PROFILE', '✓', 'complete', const Color(0xFFF59E0B)),
        _vline(),
        _stat('VERIFIED', '${d.proofs.length}', 'proofs', const Color(Config.accent)),
      ]);

  Widget _stat(String label, String value, String sub, Color c) => Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: Color(Config.text3))),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c)),
          const SizedBox(height: 2),
          Text(sub, style: const TextStyle(fontSize: 12, color: Color(Config.text2))),
        ]),
      );

  Widget _vline() => Container(width: 1, height: 40, color: const Color(0x141B1020));

  Widget _privacyBanner() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0x1A6366F1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0x336366F1)),
        ),
        child: const Row(children: [
          Text('🔒', style: TextStyle(fontSize: 16)),
          SizedBox(width: 10),
          Expanded(child: Text(
            'Everything here stays private. We only verify that your profile reflects real life. This improves your Trust Score and who you match with.',
            style: TextStyle(color: Color(0xFF4338CA), fontSize: 13, height: 1.4),
          )),
        ]),
      );

  Widget _scoreCard(TrustData d) {
    final arch = d.archetype.isNotEmpty ? archetypeFor(d.archetype) : null;
    final alignment = arch != null
        ? '${d.trustScore >= 75 ? 'Strong ' : ''}${arch.name} Alignment'
        : trustLabel(d.trustScore);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x181B1020)),
      ),
      child: Column(children: [
        SizedBox(
          width: 150, height: 150,
          child: Stack(alignment: Alignment.center, children: [
            SizedBox(width: 150, height: 150, child: CircularProgressIndicator(
              value: d.trustScore.clamp(0, 100) / 100, strokeWidth: 10,
              backgroundColor: const Color(0x221B1020),
              valueColor: const AlwaysStoppedAnimation(Color(Config.accent)), strokeCap: StrokeCap.round,
            )),
            Column(mainAxisSize: MainAxisSize.min, children: [
              Text('${d.trustScore}', style: const TextStyle(color: Color(Config.text1), fontSize: 44, fontWeight: FontWeight.w800, height: 1)),
              const Text('/ 100', style: TextStyle(color: Color(Config.text3), fontSize: 12)),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(color: const Color(0x22FF3B6B), borderRadius: BorderRadius.circular(999)),
          child: Text('● $alignment', style: const TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w600, fontSize: 13)),
        ),
        const SizedBox(height: 18),
        _scoreProgress(d),
      ]),
    );
  }

  Widget _scoreProgress(TrustData d) {
    final s = d.trustScore.clamp(0, 100);
    final toElite = (90 - s).clamp(0, 100);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Text('SCORE PROGRESS', style: TextStyle(color: Color(Config.text2), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
        const Spacer(),
        Text(toElite > 0 ? '+$toElite → Elite' : 'Elite', style: const TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w600)),
      ]),
      const SizedBox(height: 8),
      ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: Stack(children: [
          Row(children: [
            Expanded(flex: 40, child: Container(height: 6, color: const Color(0x55F87171))),
            Expanded(flex: 35, child: Container(height: 6, color: const Color(0x55F59E0B))),
            Expanded(flex: 25, child: Container(height: 6, color: const Color(0x5510B981))),
          ]),
          FractionallySizedBox(
            widthFactor: s / 100,
            child: Container(height: 6, color: const Color(Config.accent)),
          ),
        ]),
      ),
      const SizedBox(height: 10),
      Row(children: [
        _tier('Featured Visible', s >= 50),
        const SizedBox(width: 16),
        _tier('Priority', s >= 70),
        const SizedBox(width: 16),
        _tier('Elite', s >= 90),
      ]),
    ]);
  }

  Widget _tier(String label, bool on) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(on ? Icons.check_circle : Icons.circle_outlined, size: 14, color: on ? const Color(Config.accent) : const Color(Config.text3)),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 12, color: on ? const Color(Config.text1) : const Color(Config.text3))),
      ]);

  Widget _safetyCheck(TrustData d) {
    final identity = d.identityVerified ? 100 : 50;
    final hasIntro = d.proofFor('intro') != null;
    final emotional = (45 + d.proofs.length * 5 + (hasIntro ? 25 : 0)).clamp(0, 100);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(Config.bg2), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x181B1020))),
      child: Column(children: [
        _meter('Identity', identity, d.identityVerified ? 'ID verified · Face matched' : 'Verify your ID to boost'),
        const SizedBox(height: 14),
        _meter('Emotional Safety', emotional, null),
        if (!hasIntro) ...[
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _upload,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: const Color(Config.bg3), borderRadius: BorderRadius.circular(10)),
              child: Row(children: [
                const Expanded(child: Text('Add a video intro to complete your safety signal',
                    style: TextStyle(color: Color(Config.text2), fontSize: 13))),
                const Text('boost →', style: TextStyle(color: Color(0xFFF59E0B), fontWeight: FontWeight.w700, fontSize: 13)),
              ]),
            ),
          ),
        ],
      ]),
    );
  }

  Widget _meter(String label, int value, String? sub) {
    final c = value >= 80 ? const Color(Config.accent) : const Color(0xFFF59E0B);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text(label, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
        const Spacer(),
        Text('$value/100', style: TextStyle(color: c, fontWeight: FontWeight.w700, fontSize: 13)),
      ]),
      const SizedBox(height: 6),
      ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: LinearProgressIndicator(value: value / 100, minHeight: 5,
            backgroundColor: const Color(0x221B1020), valueColor: AlwaysStoppedAnimation(c)),
      ),
      if (sub != null) ...[
        const SizedBox(height: 4),
        Text(sub, style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
      ],
    ]);
  }

  Widget _proofCard(TrustData d, _Cat c) {
    final p = d.proofFor(c.id);
    final verified = p != null;
    return GestureDetector(
      onTap: _upload,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: verified ? const Color(0x4DFF3B6B) : const Color(0x181B1020)),
        ),
        child: Row(children: [
          Text(c.emoji, style: const TextStyle(fontSize: 26)),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(c.title, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 2),
            Text(verified && p.insightLabel.isNotEmpty ? p.insightLabel : c.subtitle,
                style: const TextStyle(color: Color(Config.text2), fontSize: 13)),
            const SizedBox(height: 3),
            if (verified)
              Text('✓ Verified${p.photoCount > 0 ? ' · ${p.photoCount} photo${p.photoCount == 1 ? '' : 's'}' : ''}',
                  style: const TextStyle(color: Color(Config.accent), fontSize: 12, fontWeight: FontWeight.w600))
            else
              const Text('Tap to add', style: TextStyle(color: Color(Config.text3), fontSize: 12)),
          ])),
          if (verified)
            const CircleAvatar(radius: 16, backgroundColor: Color(Config.accent), child: Icon(Icons.check, size: 18, color: Color(0xFFFFFFFF)))
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(color: const Color(0x22FF3B6B), borderRadius: BorderRadius.circular(999)),
              child: Text('+${c.pts}', style: const TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700)),
            ),
        ]),
      ),
    );
  }

  Widget _socialTile(TrustData d, _Cat c) {
    final verified = d.proofFor(c.id) != null;
    return GestureDetector(
      onTap: _upload,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: verified ? const Color(0x4DFF3B6B) : const Color(0x181B1020)),
        ),
        child: Column(children: [
          Text(c.emoji, style: const TextStyle(fontSize: 24)),
          const SizedBox(height: 8),
          if (verified)
            const Icon(Icons.check, size: 16, color: Color(Config.accent))
          else
            Text('+${c.pts}', style: const TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700, fontSize: 13)),
        ]),
      ),
    );
  }

  Widget _backgroundCheck() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _label('🔎  BACKGROUND VERIFICATION', hint: 'optional'),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: const Color(0x1A6366F1), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0x336366F1))),
          child: Row(children: [
            const CircleAvatar(radius: 20, backgroundColor: Color(0x336366F1), child: Icon(Icons.verified_user_outlined, color: Color(0xFF4338CA))),
            const SizedBox(width: 12),
            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Run a background check', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
              SizedBox(height: 2),
              Text('Criminal, identity & address verification — report stays private, only a badge shows on your profile.',
                  style: TextStyle(color: Color(Config.text2), fontSize: 12, height: 1.3)),
            ])),
            const Icon(Icons.chevron_right, color: Color(Config.text3)),
          ]),
        ),
      ]);

  Widget _verifiedInsights(TrustData d) {
    final labels = <String>[];
    for (final p in d.proofs) {
      if (p.insightLabel.isNotEmpty) labels.add(p.insightLabel);
    }
    if (labels.isEmpty) return const SizedBox.shrink();
    final shown = labels.take(2).join(', ');
    final more = labels.length - 2;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label('🗂  VERIFIED INSIGHTS'),
      const SizedBox(height: 8),
      RichText(text: TextSpan(
        style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4),
        children: [
          TextSpan(text: shown),
          if (more > 0) TextSpan(text: '  +$more more', style: const TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700)),
        ],
      )),
    ]);
  }

  Widget _label(String t, {String? hint}) => Row(children: [
        Text(t, style: const TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
        if (hint != null) ...[
          const SizedBox(width: 8),
          Text(hint, style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
        ],
      ]);
}
