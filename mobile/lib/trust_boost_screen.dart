import 'package:flutter/material.dart';
import 'api.dart';
import 'app_logger.dart';
import 'archetypes.dart';
import 'category_proof_screen.dart';
import 'config.dart';
import 'profile_body.dart' show isKnownTravelPlace;
import 'verification_screen.dart';

/// A boostable proof category shown on the Trust & Boost page.
class _Cat {
  final String id, emoji, title, subtitle, time;
  final int pts;
  const _Cat(this.id, this.emoji, this.title, this.subtitle, this.pts, {this.time = ''});
}

// Matches the web "Prove It" section exactly (4 tiles, same labels/desc/pts)
const _showOff = <_Cat>[
  _Cat('lifestyle',    '📸', 'Lifestyle Photos', 'Travel, dining, events',       8, time: '2 min'),
  _Cat('discipline',   '💪', 'Discipline',       'Gym, sleep, reading routines', 4, time: '1 min'),
  _Cat('social_proof', '🤝', 'Social Proof',     'Friends & communities',        4, time: '2 min'),
];

// Temporarily hidden from the Trust & Boost UI (kept for easy restore).
// ignore: unused_element
const _socials = <_Cat>[
  _Cat('linkedin',  '', 'LinkedIn',  '', 5),
  _Cat('instagram', '', 'Instagram', '', 3),
  _Cat('twitter',   '', 'X',         '', 2),
];

class TrustBoostScreen extends StatefulWidget {
  final bool scrollToShowOff;
  const TrustBoostScreen({super.key, this.scrollToShowOff = false});
  @override
  State<TrustBoostScreen> createState() => _TrustBoostScreenState();
}

class _TrustBoostScreenState extends State<TrustBoostScreen> {
  late Future<TrustData> _future;
  TrustData? _cachedData;
  final _showOffKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('trust_boost');
    _future = fetchTrust();
    _future.then((d) {
      _cachedData = d;
      if (widget.scrollToShowOff) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final ctx = _showOffKey.currentContext;
          if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 400), curve: Curves.easeOut);
        });
      }
    }).catchError((_) {});
  }

  Future<void> _refresh() async {
    setState(() { _future = fetchTrust(); });
    await _future.then((d) => _cachedData = d).catchError((_) {});
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
            final e = snap.error?.toString() ?? '';
            final msg = (e.contains('timeout') || e.contains('SocketException') || e.contains('DioException'))
                ? 'No internet connection. Please check your network.'
                : (e.contains('401') || e.contains('Unauthorized'))
                    ? 'Session expired. Please sign out and back in.'
                    : 'Could not load. Please try again.';
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.cloud_off, size: 44, color: Color(Config.text3)),
                  const SizedBox(height: 12),
                  Text(msg, textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2))),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _refresh, child: const Text('Retry')),
                ]),
              ),
            );
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
                SizedBox(key: _showOffKey, height: 0),
                _label("➕  SHOW-OFF", hint: "prove, don't claim"),
                const SizedBox(height: 10),
                for (final c in _showOff) _proofCard(d, c),
                const SizedBox(height: 20),
                _moneyMatters(d),
                const SizedBox(height: 20),
                _garageSection(d),
                const SizedBox(height: 20),
                _travelMagnetsSection(d),
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

  Widget _vline() => Container(width: 1, height: 40, color: const Color(0x141B1020), margin: const EdgeInsets.symmetric(horizontal: 12));

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

  // ── Safety Check — 3 categories matching website layout ───────────────────

  Future<void> _goToStep(int step, {Set<int> skipSteps = const {}}) async {
    AppLogger.instance.action('trust_boost', 'start_boost');
    final archetype = _cachedData?.archetype;
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => VerificationScreen(
        initialStep: step,
        skipSteps: skipSteps,
        archetypeId: archetype,
        onDone: () { Navigator.of(context).pop(); _refresh(); },
      ),
    ));
    _refresh();
  }

  void _goToIdentity() {
    final d = _cachedData;
    // Always skip photos (step 3) — photos belong to Lifestyle.
    // Skip Q&A (steps 1 & 2) only if already answered.
    final skip = <int>{3};
    if ((d?.qaScore ?? 0) > 0) skip.addAll({1, 2});
    _goToStep(0, skipSteps: skip);
  }

  void _goToIntent() {
    // Intent = Q&A steps only (1 & 2). Always skip selfie (step 0) and photos
    // (step 3) — those belong to Identity and Lifestyle respectively.
    _goToStep(1, skipSteps: const {0, 3});
  }

  void _goToLifestyle() {
    final d = _cachedData;
    final skip = <int>{0, 1, 2}; // always skip to photos directly
    _goToStep(3, skipSteps: skip);
  }

  Future<void> _goVerify() async => _goToIdentity();

  Widget _safetyCheck(TrustData d) {
    // Identity = liveness step score. The verification flow saves 'liveness'
    // (not 'id') when the user completes the identity check, so use livenessScore.
    final identityScore = d.livenessScore;
    // Lifestyle = photos step score
    final lifestyleScore = d.photoScore;
    // Intent = spending_or_qa step score
    final intentScore = d.qaScore;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x181B1020)),
      ),
      child: Column(children: [
        _safetyItem(
          label: 'Identity',
          score: identityScore,
          lowText:  'Verify your identity — required to appear in search',
          midText:  'Complete face match to maximise identity score',
          lowPts:   '+10 pts →',
          onTap:    _goToIdentity,
        ),
        const SizedBox(height: 16),
        _safetyItem(
          label: 'Intent',
          score: intentScore,
          lowText:  'Answer Q&A questions — reveals your real intentions',
          midText:  'Add more answers to complete your intent signal',
          lowPts:   '+10 pts →',
          onTap:    _goToIntent,
        ),
        const SizedBox(height: 16),
        _safetyItem(
          label: 'Lifestyle',
          score: lifestyleScore,
          lowText:  'Upload photos to verify your lifestyle and stand out',
          midText:  'Add more photos to complete your lifestyle score',
          lowPts:   '+15 pts →',
          onTap:    _goToLifestyle,
        ),
      ]),
    );
  }

  Widget _safetyItem({
    required String label,
    required int score,
    required String lowText,
    required String midText,
    required String lowPts,
    VoidCallback? onTap,
  }) {
    const barColor   = Color(Config.accent);
    const scoreColor = Color(Config.accent);

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text(label, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
        const Spacer(),
        Text('$score/100', style: const TextStyle(color: scoreColor, fontWeight: FontWeight.w700, fontSize: 13)),
      ]),
      const SizedBox(height: 6),
      ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: LinearProgressIndicator(
          value: score / 100,
          minHeight: 5,
          backgroundColor: const Color(0x22FF3B6B),
          valueColor: const AlwaysStoppedAnimation(barColor),
        ),
      ),
      const SizedBox(height: 6),
      if (score >= 75)
        Text('✓ $label verified',
            style: const TextStyle(color: Color(Config.accent), fontSize: 12, fontWeight: FontWeight.w600))
      else if (onTap != null)
        GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: const Color(0x1AFF3B6B),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0x33FF3B6B)),
            ),
            child: Row(children: [
              Expanded(child: Text(
                score < 50 ? lowText : midText,
                style: const TextStyle(color: Color(Config.accent), fontSize: 13),
              )),
              const SizedBox(width: 8),
              Text(
                score < 50 ? lowPts : 'boost →',
                style: const TextStyle(
                  color: Color(Config.accent),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ]),
          ),
        ),
    ]);
  }

  Widget _proofCard(TrustData d, _Cat c) {
    final p = d.proofFor(c.id);
    final verified = p != null;
    return GestureDetector(
      onTap: () {
        AppLogger.instance.action('trust_boost', 'start_boost');
        Navigator.of(context)
            .push(MaterialPageRoute(
                builder: (_) => CategoryProofScreen(categoryId: c.id, existingProof: p)))
            .then((_) => _refresh());
      },
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
            const SizedBox(height: 4),
            if (verified)
              Text('✓ Verified${p.photoCount > 0 ? ' · ${p.photoCount} photo${p.photoCount == 1 ? '' : 's'}' : ''}',
                  style: const TextStyle(color: Color(Config.accent), fontSize: 12, fontWeight: FontWeight.w600))
            else if (c.time.isNotEmpty)
              Text(c.time, style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
          ])),
          const SizedBox(width: 10),
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

  // ignore: unused_element
  Widget _socialTile(TrustData d, _Cat c) {
    final p = d.proofFor(c.id);
    final verified = p != null;
    return GestureDetector(
      onTap: () {
        AppLogger.instance.action('trust_boost', 'start_boost');
        Navigator.of(context)
            .push(MaterialPageRoute(
                builder: (_) => CategoryProofScreen(categoryId: c.id, existingProof: p)))
            .then((_) => _refresh());
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: verified ? const Color(0x4DFF3B6B) : const Color(0x181B1020)),
        ),
        child: Column(children: [
          _brandIcon(c.id),
          const SizedBox(height: 8),
          if (verified)
            const Icon(Icons.check, size: 16, color: Color(Config.accent))
          else
            Text('+${c.pts}', style: const TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700, fontSize: 13)),
        ]),
      ),
    );
  }

  /// Monochrome brand icon — white background with black icon, matching web style.
  // ignore: unused_element
  Widget _brandIcon(String platform) {
    const double s = 36;
    const iconColor = Color(0xFF111111);
    return Container(
      width: s, height: s,
      decoration: BoxDecoration(color: const Color(0xFFFFFFFF), borderRadius: BorderRadius.circular(8)),
      child: switch (platform) {
        'linkedin' => const Center(
            child: Text('in',
                style: TextStyle(color: iconColor, fontWeight: FontWeight.w800, fontSize: 16, height: 1))),
        'instagram' => CustomPaint(
            size: const Size(s, s),
            painter: _InstagramPainter(iconColor)),
        'twitter' => const Center(
            child: Text('𝕏',
                style: TextStyle(color: iconColor, fontWeight: FontWeight.w700, fontSize: 18, height: 1.15))),
        _ => const SizedBox.shrink(),
      },
    );
  }

  Widget _moneyMatters(TrustData d) {
    final wealthProof = d.proofFor('wealth');
    final hasIncome   = d.annualIncome != null;
    final hasNetWorth = d.netWorth != null;
    final hasWealth   = wealthProof != null && wealthProof.aggregated.isNotEmpty;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label('💰  MONEY MATTERS'),
      const SizedBox(height: 10),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x181B1020)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Income row
          if (hasIncome) _moneyRow('🧳', 'Income', d.annualIncome!),
          // Net Worth row
          if (hasNetWorth) _moneyRow('📈', 'Net Worth', d.netWorth!),
          // Wealth insights
          if (hasWealth) ...[
            if (hasIncome || hasNetWorth) const SizedBox(height: 10),
            Text(wealthProof.aggregated,
                style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4)),
            const SizedBox(height: 6),
            const Row(children: [
              Icon(Icons.check, size: 11, color: Color(Config.text3)),
              SizedBox(width: 4),
              Expanded(child: Text('AI verified via bank statement / financial document',
                  style: TextStyle(color: Color(Config.text3), fontSize: 11))),
            ]),
          ],
          if (hasIncome || hasNetWorth || hasWealth) const SizedBox(height: 14),
          // Edit button — always shown
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _editMoneyMatters(d),
              icon: const Icon(Icons.edit_outlined, size: 14, color: Color(0xFFF59E0B)),
              label: const Text('Edit income & net worth',
                  style: TextStyle(color: Color(0xFFF59E0B), fontWeight: FontWeight.w600, fontSize: 13)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0x80F59E0B)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Spending proof upload card
          _miniProofCard(
            d: d, categoryId: 'spending',
            icon: '🧾', title: 'Upload Receipts',
            subtitle: 'Restaurant, travel & event spend',
            pts: 10,
          ),
          const SizedBox(height: 8),
          // Wealth proof upload card
          _miniProofCard(
            d: d, categoryId: 'wealth',
            icon: '🏦', title: 'Upload Bank / Investment Doc',
            subtitle: 'Verify your financial standing',
            pts: 12,
          ),
        ]),
      ),
    ]);
  }

  Widget _miniProofCard({
    required TrustData d,
    required String categoryId,
    required String icon,
    required String title,
    required String subtitle,
    required int pts,
  }) {
    final verified = d.proofFor(categoryId) != null;
    return GestureDetector(
      onTap: () => Navigator.of(context)
          .push(MaterialPageRoute(
              builder: (_) => CategoryProofScreen(categoryId: categoryId)))
          .then((_) => _refresh()),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(Config.bg3),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: verified ? const Color(0x4DFF3B6B) : const Color(0x181B1020),
          ),
        ),
        child: Row(children: [
          Text(icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: const TextStyle(
                    color: Color(Config.text1), fontWeight: FontWeight.w600, fontSize: 13)),
            Text(subtitle,
                style: const TextStyle(color: Color(Config.text3), fontSize: 11)),
          ])),
          if (verified)
            const Icon(Icons.check_circle, size: 18, color: Color(Config.accent))
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0x22FF3B6B),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('+$pts',
                  style: const TextStyle(
                      color: Color(Config.accent), fontWeight: FontWeight.w700, fontSize: 12)),
            ),
        ]),
      ),
    );
  }

  Widget _garageSection(TrustData d) {
    final assetsProof = d.proofFor('assets');
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label('🚗  GARAGE'),
      const SizedBox(height: 10),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x181B1020)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (assetsProof != null && assetsProof.aggregated.isNotEmpty) ...[
            Text(assetsProof.aggregated,
                style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4)),
            const SizedBox(height: 6),
            const Row(children: [
              Icon(Icons.check, size: 11, color: Color(Config.text3)),
              SizedBox(width: 4),
              Expanded(child: Text('AI verified via registration / ownership document',
                  style: TextStyle(color: Color(Config.text3), fontSize: 11))),
            ]),
            const SizedBox(height: 14),
          ],
          _miniProofCard(
            d: d, categoryId: 'assets',
            icon: '📄', title: 'Upload Registration / Docs',
            subtitle: 'Car, property or company documents',
            pts: 15,
          ),
        ]),
      ),
    ]);
  }

  Widget _moneyRow(String emoji, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          Text('$emoji  $label', style: const TextStyle(color: Color(Config.text2), fontSize: 14)),
          const Spacer(),
          Text(value,
              style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 14)),
        ]),
      );

  // ── Currency + range constants ─────────────────────────────────────────────

  static List<String> _incomeRanges(String c) => c == '₹' ? [
    'Under ₹25L', '₹25L – ₹50L', '₹50L – ₹1Cr',
    '₹1Cr – ₹3Cr', '₹3Cr – ₹10Cr', '₹10Cr+',
  ] : [
    'Under ${c}30K', '${c}30K – ${c}60K', '${c}60K – ${c}100K',
    '${c}100K – ${c}150K', '${c}150K – ${c}250K', '${c}250K – ${c}500K', '${c}500K+',
  ];

  static List<String> _netWorthRanges(String c) => c == '₹' ? [
    'Under ₹25L', '₹25L – ₹50L', '₹50L – ₹1Cr',
    '₹1Cr – ₹5Cr', '₹5Cr – ₹25Cr', '₹25Cr – ₹100Cr', '₹100Cr+',
  ] : [
    'Under ${c}250K', '${c}250K – ${c}500K', '${c}500K – ${c}1M',
    '${c}1M – ${c}5M', '${c}5M – ${c}10M', '${c}10M+',
  ];

  static String _detectCurrency(String? income, String? netWorth) => '₹';

  Future<void> _editMoneyMatters(TrustData d) async {
    String currency   = _detectCurrency(d.annualIncome, d.netWorth);
    String? selIncome = d.annualIncome;
    String? selNW     = d.netWorth;
    bool saving       = false;
    String? errorMsg;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(Config.bg2),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) {
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


              // Income pills
              const Text('💼  Annual Income',
                  style: TextStyle(color: Color(Config.text2), fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              _rangePills(
                ranges: _incomeRanges(currency),
                selected: selIncome,
                onSelect: (v) => setS(() => selIncome = (selIncome == v) ? null : v),
              ),
              const SizedBox(height: 20),

              // Net worth pills
              const Text('📈  Net Worth',
                  style: TextStyle(color: Color(Config.text2), fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              _rangePills(
                ranges: _netWorthRanges(currency),
                selected: selNW,
                onSelect: (v) => setS(() => selNW = (selNW == v) ? null : v),
              ),
              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: saving ? null : () async {
                    setS(() { saving = true; errorMsg = null; });
                    try {
                      await saveMoneyMattersDirect(
                        income: selIncome,
                        netWorth: selNW,
                      );
                      if (ctx.mounted) Navigator.of(ctx).pop();
                      _refresh();
                    } catch (e) {
                      AppLogger.instance.error(e, screen: 'trust_boost', action: 'save_social_proof');
                      setS(() { saving = false; errorMsg = e.toString(); });
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
              if (errorMsg != null) ...[
                const SizedBox(height: 10),
                Text(errorMsg!,
                    style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)),
              ],
            ]),
          );
        },
      ),
    );
  }

  Widget _rangePills({
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


  Future<void> _editCountries(TrustData d) async {
    final countries = List<String>.from(d.countries);
    if (countries.isEmpty) return;
    String? deletingCountry;
    var changed = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(Config.bg2),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.fromLTRB(20, 24, 20, MediaQuery.of(ctx).viewInsets.bottom + 28),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Travel Magnets', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 4),
            const Text('Detected from your travel uploads. Tap × to remove.', style: TextStyle(color: Color(Config.text3), fontSize: 12)),
            const SizedBox(height: 16),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final c in countries)
                Container(
                  padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
                  decoration: BoxDecoration(color: const Color(Config.bg3), borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text('✈️  $c', style: const TextStyle(color: Color(Config.text1), fontSize: 13)),
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: deletingCountry != null ? null : () async {
                        setS(() { deletingCountry = c; countries.remove(c); });
                        try {
                          await saveCountries(List<String>.from(countries));
                          changed = true;
                        } catch (_) {
                          AppLogger.instance.error('save_countries failed', screen: 'trust_boost', action: 'save_countries');
                          setS(() => countries.insert(0, c));
                        } finally {
                          if (ctx.mounted) setS(() => deletingCountry = null);
                        }
                      },
                      child: deletingCountry == c
                          ? const SizedBox(width: 14, height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)))
                          : const Icon(Icons.close, size: 14, color: Color(Config.text3)),
                    ),
                  ]),
                ),
            ]),
            const SizedBox(height: 20),
          ]),
        ),
      ),
    );

    if (changed) _refresh();
  }

  Widget _travelMagnetsSection(TrustData d) {
    final travelProof = d.proofFor('travel');
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label('✈️  TRAVEL MAGNETS'),
      const SizedBox(height: 10),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x181B1020)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (travelProof != null && travelProof.aggregated.isNotEmpty) ...[
            Text(travelProof.aggregated,
                style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4)),
            const SizedBox(height: 6),
            const Row(children: [
              Icon(Icons.check, size: 11, color: Color(Config.text3)),
              SizedBox(width: 4),
              Expanded(child: Text('Countries auto-detected from your travel documents',
                  style: TextStyle(color: Color(Config.text3), fontSize: 11))),
            ]),
            const SizedBox(height: 14),
          ],
          _miniProofCard(
            d: d, categoryId: 'travel',
            icon: '🛂', title: 'Upload Passport / Boarding Pass',
            subtitle: 'AI detects countries automatically',
            pts: 8,
          ),
          if (d.countries.where(isKnownTravelPlace).isNotEmpty) ...[
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () => _editCountries(d),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0x14FFFFFF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0x22FFFFFF)),
                ),
                child: Row(children: [
                  const Icon(Icons.edit_outlined, size: 14, color: Color(Config.text2)),
                  const SizedBox(width: 8),
                  Expanded(child: Text(
                    d.countries.where(isKnownTravelPlace).join(' · '),
                    style: const TextStyle(color: Color(Config.text2), fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  )),
                  const Icon(Icons.chevron_right, size: 16, color: Color(Config.text3)),
                ]),
              ),
            ),
          ],
        ]),
      ),
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

// ── Instagram logo CustomPainter ───────────────────────────────────────────

class _InstagramPainter extends CustomPainter {
  final Color color;
  const _InstagramPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.085
      ..strokeCap = StrokeCap.round;

    // Outer rounded square
    canvas.drawRRect(
      RRect.fromLTRBR(
        size.width * 0.10, size.height * 0.10,
        size.width * 0.90, size.height * 0.90,
        Radius.circular(size.width * 0.22),
      ),
      stroke,
    );

    // Inner circle
    canvas.drawCircle(
      Offset(size.width / 2, size.height / 2),
      size.width * 0.21,
      stroke,
    );

    // Corner dot (top-right)
    canvas.drawCircle(
      Offset(size.width * 0.71, size.height * 0.29),
      size.width * 0.06,
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(covariant _InstagramPainter old) => old.color != color;
}
