import 'package:flutter/material.dart';
import 'api.dart';
import 'archetypes.dart';
import 'config.dart';
import 'live_now_carousel.dart';
import 'verification_screen.dart';

/// Gender chosen on the pre-auth "Two questions" gate during Create-account.
/// When set, OnboardingFlow skips its own gate and jumps straight to the lane.
String? pendingSignupGender;

/// New-user onboarding: gate (gender + 18+) → lane (archetype) → verification.
/// Calls [onComplete] once the user has an archetype saved + verification done
/// (or skipped), after which AuthGate re-checks and shows the app.
class OnboardingFlow extends StatefulWidget {
  final VoidCallback onComplete;
  const OnboardingFlow({super.key, required this.onComplete});

  @override
  State<OnboardingFlow> createState() => _OnboardingFlowState();
}

class _OnboardingFlowState extends State<OnboardingFlow> {
  int _step = 0; // 0 gate, 1 lane, 2 verification
  String _gender = 'man';
  String _archetype = ''; // chosen in the lane; drives verification questions
  bool _over18 = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // If the user already picked their gender on the pre-auth signup gate,
    // skip the gate and go straight to the lane (don't ask twice).
    final pending = pendingSignupGender;
    if (pending != null) {
      _gender = pending;
      _over18 = true;
      _step = 1;
      pendingSignupGender = null;
    }
  }

  Future<void> _pickArchetype(String archetypeId) async {
    if (_saving) return;
    setState(() { _saving = true; _error = null; });
    try {
      await saveGenderArchetype(_gender, archetypeId);
      if (mounted) setState(() { _saving = false; _archetype = archetypeId; _step = 2; });
    } catch (e) {
      if (mounted) setState(() { _saving = false; _error = 'Could not save: $e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    switch (_step) {
      case 2:
        return VerificationScreen(onDone: widget.onComplete, archetype: _archetype);
      case 1:
        return _Lane(
          gender: _gender,
          saving: _saving,
          error: _error,
          onPick: _pickArchetype,
          onBack: () => setState(() => _step = 0),
        );
      default:
        return GateStep(
          gender: _gender,
          over18: _over18,
          onGender: (g) => setState(() => _gender = g),
          onOver18: (v) => setState(() => _over18 = v),
          onContinue: _over18 ? () => setState(() => _step = 1) : null,
        );
    }
  }
}

/// The "Two questions. Then we move." gate — gender + 18+. Reused pre-auth on
/// the Create-account flow and in onboarding. [onSignIn], when provided, shows
/// an "Already a member? Sign in →" link (used on the signup gate).
class GateStep extends StatelessWidget {
  final String gender;
  final bool over18;
  final ValueChanged<String> onGender;
  final ValueChanged<bool> onOver18;
  final VoidCallback? onContinue;
  final VoidCallback? onSignIn;
  const GateStep({super.key, required this.gender, required this.over18, required this.onGender, required this.onOver18, required this.onContinue, this.onSignIn});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 12),
            const Text('Two questions.',
                style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: Color(Config.text1))),
            const Text('Then we move.',
                style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, fontStyle: FontStyle.italic, color: Color(Config.accent))),
            const SizedBox(height: 32),
            const Text("I'm a…", style: TextStyle(color: Color(Config.text2), fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Row(children: [
              _genderCard('man', '♂', 'Man', 'See Casual & Marriage-Minded', gender == 'man', () => onGender('man')),
              const SizedBox(width: 12),
              _genderCard('woman', '♀', 'Woman', 'See Spoilt & Safety-First', gender == 'woman', () => onGender('woman')),
            ]),
            const SizedBox(height: 28),
            const Text('Age confirmation', style: TextStyle(color: Color(Config.text2), fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: () => onOver18(!over18),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(Config.bg2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: over18 ? const Color(Config.accent) : const Color(0x221B1020)),
                ),
                child: Row(children: [
                  Icon(over18 ? Icons.check_box : Icons.check_box_outline_blank, color: over18 ? const Color(Config.accent) : const Color(Config.text3)),
                  const SizedBox(width: 12),
                  const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('I confirm I am 18 years of age or older.', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
                    SizedBox(height: 2),
                    Text('riteangle is strictly 18+. We ID-verify everyone — no exceptions.', style: TextStyle(color: Color(Config.text3), fontSize: 12)),
                  ])),
                ]),
              ),
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity, height: 54,
              child: FilledButton(
                onPressed: onContinue,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(Config.accent),
                  foregroundColor: const Color(0xFFFFFFFF),
                  disabledBackgroundColor: const Color(Config.bg3),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(over18 ? 'Continue' : 'Pick both to continue', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),
            if (onSignIn != null)
              Center(
                child: TextButton(
                  onPressed: onSignIn,
                  child: const Text('Already a member?  Sign in →', style: TextStyle(color: Color(Config.text2))),
                ),
              ),
            const SizedBox(height: 24),
            const LiveNowCarousel(showMixed: true),
          ]),
        ),
      ),
    );
  }

  Widget _genderCard(String id, String icon, String label, String sub, bool sel, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 18),
          decoration: BoxDecoration(
            color: const Color(Config.bg2),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: sel ? const Color(Config.accent) : const Color(0x221B1020), width: sel ? 2 : 1),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(icon, style: TextStyle(fontSize: 28, color: sel ? const Color(Config.accent) : const Color(Config.text2))),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 2),
            Text(sub, style: const TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.2)),
          ]),
        ),
      ),
    );
  }
}

class _Lane extends StatelessWidget {
  final String gender;
  final bool saving;
  final String? error;
  final ValueChanged<String> onPick;
  final VoidCallback onBack;
  const _Lane({required this.gender, required this.saving, required this.error, required this.onPick, required this.onBack});

  @override
  Widget build(BuildContext context) {
    final sections = laneSectionsFor(gender);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: Color(Config.text1)), onPressed: onBack),
        title: const Text('Pick your lane', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
      ),
      body: Stack(children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            LiveNowCarousel(viewerGender: gender),
            for (final s in sections) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
                child: Text(s.label.toUpperCase(),
                    style: const TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
              ),
              ...s.archetypes.map((a) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: GestureDetector(
                      onTap: () => onPick(a.id),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(Config.bg2),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0x181B1020)),
                        ),
                        child: Row(children: [
                          Text(a.emoji, style: const TextStyle(fontSize: 26)),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(a.name, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 16)),
                              const SizedBox(height: 2),
                              Text(a.tag, style: const TextStyle(color: Color(Config.text2), fontSize: 13)),
                            ]),
                          ),
                          const Icon(Icons.chevron_right, color: Color(Config.text3)),
                        ]),
                      ),
                    ),
                  )),
            ],
            if (error != null) Padding(padding: const EdgeInsets.all(8), child: Text(error!, style: const TextStyle(color: Color(0xFFF87171)))),
          ],
        ),
        if (saving)
          const Positioned.fill(child: ColoredBox(color: Color(0x88000000), child: Center(child: CircularProgressIndicator(color: Color(Config.accent))))),
      ]),
    );
  }
}
