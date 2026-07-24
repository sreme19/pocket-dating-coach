import 'package:flutter/material.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'preference_weighting_screen.dart';
import 'category_proof_screen.dart';
import 'trust_boost_screen.dart';
import 'season.dart';

/// Profile Strength surface (Scoring & Matching redesign §8, Phase 2). Shows the
/// user's pool standing as a BAND + momentum + verification-upside actions —
/// never a raw worth rank or a bare verdict number (§8/§17). Framed as earned and
/// movable: "your profile's pull in this pool right now."
///
/// Reachable from Settings → Matching. Kept in lockstep with the web page
/// /verified-vibe/settings/profile-strength.
class ProfileStrengthScreen extends StatefulWidget {
  const ProfileStrengthScreen({super.key});
  @override
  State<ProfileStrengthScreen> createState() => _ProfileStrengthScreenState();
}

class _ProfileStrengthScreenState extends State<ProfileStrengthScreen> {
  bool _loading = true;
  String? _error;
  ProfileStrength? _ps;

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('profile_strength');
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final ps = await fetchProfileStrength();
      if (!mounted) return;
      setState(() { _ps = ps; _loading = false; });
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile_strength', action: 'load');
      if (mounted) setState(() { _error = 'Could not load: $e'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('Profile strength',
            style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: Brand.accent))
          : _error != null
              ? _errorView()
              : (_ps?.hasVectors == true ? _content(_ps!) : _notReady()),
    );
  }

  String get _friendlyError {
    final e = _error ?? '';
    if (e.contains('429')) return 'Too many requests — please wait a moment and try again.';
    if (e.contains('401') || e.contains('Unauthorized')) return 'Session expired. Please sign out and back in.';
    if (e.contains('timeout') || e.contains('SocketException') || e.contains('DioException')) return 'No internet connection. Please check your network.';
    return 'Could not load profile strength. Please try again.';
  }

  Widget _errorView() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('😕', style: TextStyle(fontSize: 36)),
            const SizedBox(height: 12),
            Text(_friendlyError, textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2), fontSize: 14, height: 1.5)),
            const SizedBox(height: 16),
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ]),
        ),
      );

  Widget _notReady() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: const [
            Text('🌱', style: TextStyle(fontSize: 40)),
            SizedBox(height: 12),
            Text('Your profile strength is still warming up',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(Config.text1), fontSize: 17, fontWeight: FontWeight.w600)),
            SizedBox(height: 8),
            Text('Add a few proofs and complete your profile — then come back to see your standing and how to climb.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(Config.text2), fontSize: 14, height: 1.5)),
          ]),
        ),
      );

  Widget _content(ProfileStrength ps) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        // Band hero — momentum, not a verdict.
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: LinearGradient(
              colors: [Brand.accentTint, Color(Config.bg2)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            border: Border.all(color: Brand.accentAlpha(0x22)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('YOUR PULL IN THIS POOL RIGHT NOW',
                style: TextStyle(color: Color(Config.text2), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
            const SizedBox(height: 8),
            Text(ps.band,
                style: TextStyle(color: Brand.accentBright, fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
            const SizedBox(height: 14),
            // Progress to next band (momentum).
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: ps.nextBand == null ? 1 : ps.progressInBand.clamp(0.04, 1),
                minHeight: 8,
                backgroundColor: Brand.accentAlpha(0x33),
                color: Brand.accent,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              ps.nextBand == null
                  ? "You're at the top tier — keep your proofs fresh to hold it."
                  : '${ps.pointsToNextBand} to go to “${ps.nextBand}.” It’s earned and movable.',
              style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4),
            ),
          ]),
        ),
        const SizedBox(height: 18),

        // Verification upside — "claim what you've already earned on paper."
        if (ps.deltaVerify > 0) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(Config.bg2),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0x181B1020)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('🔓 Locked standing',
                  style: TextStyle(color: Color(Config.text1), fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                'Based on what you’ve told us, verifying your current claims would lift your standing'
                '${ps.verifiedBand.isNotEmpty && ps.verifiedBand != ps.band ? ' to “${ps.verifiedBand}.”' : '.'} '
                'You’ve earned it on paper — go claim it.',
                style: const TextStyle(color: Color(Config.text2), fontSize: 13.5, height: 1.5),
              ),
            ]),
          ),
          const SizedBox(height: 18),
        ],

        // Ranked next actions.
        if (ps.actions.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.fromLTRB(4, 0, 4, 10),
            child: Text('HIGHEST-LEVERAGE NEXT MOVES',
                style: TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
          ),
          for (final a in ps.actions) _actionRow(a),
        ],

        const SizedBox(height: 20),
        // Cross-link to the weighting step.
        TextButton(
          onPressed: () {
            AppLogger.instance.action('profile_strength', 'tap_tip');
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const PreferenceWeightingScreen()),
            );
          },
          child: Text('Adjust what you value →', style: TextStyle(color: Brand.accentBright)),
        ),
      ],
    );
  }

  String? _dimensionToCategoryId(String dimension) {
    switch (dimension) {
      case 'financial':       return 'spending';
      case 'lifestyle':       return 'lifestyle';
      case 'presentation':    return 'lifestyle';
      case 'ambition':        return 'discipline';
      case 'social_legitimacy': return 'social_proof';
      default:                return null; // warmth, intellect, humor, family → Trust & Boost
    }
  }

  Widget _actionRow(PsAction a) {
    return GestureDetector(
      onTap: () {
        AppLogger.instance.action('profile_strength', 'tap_action', meta: {'dimension': a.dimension});
        final categoryId = _dimensionToCategoryId(a.dimension);
        if (categoryId != null) {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => CategoryProofScreen(categoryId: categoryId)),
          );
        } else {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const TrustBoostScreen()),
          );
        }
      },
      child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x181B1020)),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Verify your ${a.label.toLowerCase()}',
                style: const TextStyle(color: Color(Config.text1), fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            const Text('Prove a claim you’ve already made', style: TextStyle(color: Color(Config.text3), fontSize: 12)),
          ]),
        ),
        const SizedBox(width: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(color: Brand.accentTint, borderRadius: BorderRadius.circular(999)),
          child: Text('+${a.deltaPS}', style: TextStyle(color: Brand.accentBright, fontSize: 13, fontWeight: FontWeight.w700)),
        ),
      ]),
    ),
    );
  }
}
