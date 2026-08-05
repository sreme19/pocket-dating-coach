import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'api.dart';
import 'app_logger.dart';
import 'archetypes.dart';
import 'config.dart';
import 'earn_profile_screen.dart';
import 'pre_auth_lane_screen.dart';
import 'verification_screen.dart';
import 'season.dart';

/// Gender chosen on the pre-auth gate. OnboardingFlow reads this to skip its
/// own gate and jump straight to lane (or verification if archetype also set).
String? pendingSignupGender;

/// Archetype chosen on the pre-auth "Pick your lane" screen.
/// When set, OnboardingFlow skips the lane step and saves it automatically.
String? pendingSignupArchetype;

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
  int _step = 0; // 0 gate, 1 lane, 2 earn, 3 verification
  String _gender = 'man';
  bool _over18 = false;
  bool _saving = false;
  String? _error;

  String? _pendingArchetypeId;
  String? _savedArchetypeId;

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('onboarding');
    final pendingGender = pendingSignupGender;
    if (pendingGender != null) {
      _gender = pendingGender;
      _over18 = true;
      pendingSignupGender = null;
    }
    // If archetype was also pre-selected on the pre-auth lane screen, jump
    // directly to EarnProfileScreen (step 2) — no lane flash — and save in
    // the background after the first frame.
    final pendingArch = pendingSignupArchetype;
    if (pendingArch != null) {
      _pendingArchetypeId = pendingArch;
      _savedArchetypeId = pendingArch;
      pendingSignupArchetype = null;
      _step = 2; // start at EarnProfileScreen, skip lane
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _pendingArchetypeId != null) {
          _pickArchetype(_pendingArchetypeId!);
          _pendingArchetypeId = null;
        }
      });
    } else if (pendingGender != null) {
      _step = 1; // no archetype yet — show lane
    }
  }

  Future<void> _pickArchetype(String archetypeId) async {
    AppLogger.instance.action('onboarding', 'pick_archetype');
    if (_saving) return;
    setState(() { _saving = true; _error = null; });
    try {
      await saveGenderArchetype(_gender, archetypeId);
      // Only advance to step 2 if not already at step 2+ (prevents going
      // back from VerificationScreen when the background save finishes late).
      if (mounted) setState(() { _saving = false; _savedArchetypeId = archetypeId; if (_step < 2) _step = 2; });
    } catch (e) {
      AppLogger.instance.error(e, screen: 'onboarding', action: 'pick_archetype');
      if (mounted) setState(() { _saving = false; _error = 'Could not save: $e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final Widget child;
    if (_step == 3) {
      child = VerificationScreen(
        onDone: widget.onComplete,
        onBack: () => setState(() => _step = 2),
        archetypeId: _savedArchetypeId,
      );
    } else if (_step == 2) {
      child = EarnProfileScreen(
        onStart: () {
          AppLogger.instance.action('onboarding', 'next_step', meta: {'step': _step});
          setState(() => _step = 3);
        },
        onSkip: () {
          AppLogger.instance.action('onboarding', 'submit_onboarding');
          widget.onComplete();
        },
      );
    } else if (_step == 1) {
      child = PreAuthLaneScreen(
        gender: _gender,
        onPick: _pickArchetype,
        onBack: () => setState(() => _step = 0),
      );
    } else {
      child = GateStep(
        gender: _gender,
        over18: _over18,
        onGender: (g) => setState(() => _gender = g),
        onOver18: (v) => setState(() => _over18 = v),
        onContinue: _over18 ? () {
          AppLogger.instance.action('onboarding', 'next_step', meta: {'step': _step});
          setState(() => _step = 1);
        } : null,
      );
    }
    return _Transition(stepKey: _step, child: child);
  }
}

/// Wraps any full-screen step in a smooth fade+slide AnimatedSwitcher.
/// [stepKey] changes trigger the animation.
class _Transition extends StatelessWidget {
  final int stepKey;
  final Widget child;
  const _Transition({required this.stepKey, required this.child});

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      transitionBuilder: (c, animation) => FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Curves.easeIn),
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.04, 0),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
          child: c,
        ),
      ),
      child: KeyedSubtree(key: ValueKey(stepKey), child: child),
    );
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
    final bool ready = gender.isNotEmpty && over18;
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Eyebrow: pulse dot + RITEANGLE
              Row(children: [
                Container(
                  width: 8, height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Brand.accent,
                    boxShadow: [BoxShadow(color: Brand.accentTint, blurRadius: 0, spreadRadius: 4)],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'RITEANGLE',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.4,
                    color: Brand.accentBright,
                  ),
                ),
              ]),
              const SizedBox(height: 18),
              // Title
              RichText(
                text: TextSpan(
                  style: const TextStyle(
                    fontSize: 44,
                    fontWeight: FontWeight.w800,
                    fontStyle: FontStyle.italic,
                    height: 0.95,
                    letterSpacing: -0.8,
                    color: Color(Config.text1),
                  ),
                  children: [
                    TextSpan(text: 'Two questions.\n'),
                    TextSpan(
                      text: 'Then we move.',
                      style: TextStyle(color: Brand.accentBright),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              // Q1: I'm a...
              _sectionLabel('1', "I'm a…", gender.isNotEmpty),
              const SizedBox(height: 12),
              Row(children: [
                _genderCard('man', '♂', 'Man', 'See Casual & Marriage-Minded', gender == 'man', () => onGender('man')),
                const SizedBox(width: 10),
                _genderCard('woman', '♀', 'Woman', 'See Spoilt & Safety-First', gender == 'woman', () => onGender('woman')),
              ]),
              const SizedBox(height: 22),
              // Q2: I'm 18 or older
              _sectionLabel('2', "I'm 18 or older", over18),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => onOver18(!over18),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(Config.bg2),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: over18 ? Brand.accent : const Color(0x221B1020),
                    ),
                  ),
                  child: Row(children: [
                    // Custom checkbox box
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 26, height: 26,
                      decoration: BoxDecoration(
                        color: over18 ? Brand.accent : const Color(Config.bg3),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: over18 ? Brand.accent : const Color(0x331B1020),
                        ),
                      ),
                      child: over18
                          ? const Center(
                              child: Text('✓', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                            )
                          : null,
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Yes, I\'m 18+', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600, fontSize: 15)),
                        SizedBox(height: 2),
                        Text('Required — we ID-verify everyone, no exceptions.', style: TextStyle(color: Color(Config.text3), fontSize: 12)),
                      ]),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 28),
              // CTA button
              SizedBox(
                width: double.infinity, height: 54,
                child: FilledButton(
                  onPressed: ready ? onContinue : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: Brand.accent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(Config.bg3),
                    disabledForegroundColor: const Color(Config.text3),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(50)),
                    elevation: 0,
                  ),
                  child: Text(
                    ready ? "Let's go →" : 'Pick both to continue',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              // Privacy text
              RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: const TextStyle(fontSize: 11, color: Color(Config.text3), height: 1.55),
                  children: [
                    const TextSpan(text: 'By continuing you agree to ID verification, our '),
                    TextSpan(
                      text: 'Terms',
                      style: const TextStyle(color: Color(Config.text2), decoration: TextDecoration.underline),
                      recognizer: TapGestureRecognizer()..onTap = () {},
                    ),
                    const TextSpan(text: ' and '),
                    TextSpan(
                      text: 'Privacy',
                      style: const TextStyle(color: Color(Config.text2), decoration: TextDecoration.underline),
                      recognizer: TapGestureRecognizer()..onTap = () {},
                    ),
                    const TextSpan(text: '.\nWe never share ID details with matches.'),
                  ],
                ),
              ),
              if (onSignIn != null) ...[
                const SizedBox(height: 28),
                // Sign in link
                RichText(
                  textAlign: TextAlign.center,
                  text: TextSpan(
                    style: const TextStyle(fontSize: 14, color: Color(Config.text3)),
                    children: [
                      const TextSpan(text: 'Already a member? '),
                      TextSpan(
                        text: 'Sign in →',
                        style: TextStyle(color: Brand.accent, fontWeight: FontWeight.w600),
                        recognizer: TapGestureRecognizer()..onTap = onSignIn!,
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionLabel(String num, String title, bool done) {
    return Row(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: 22, height: 22,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done ? Brand.accent : const Color(Config.bg3),
            border: Border.all(
              color: done ? Brand.accent : const Color(0x331B1020),
            ),
          ),
          child: Center(
            child: Text(
              done ? '✓' : num,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: done ? Colors.white : const Color(Config.text2),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: Color(Config.text1),
            letterSpacing: -0.08,
          ),
        ),
      ],
    );
  }

  Widget _genderCard(String id, String icon, String label, String sub, bool sel, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.fromLTRB(14, 18, 14, 18),
          decoration: BoxDecoration(
            color: const Color(Config.bg2),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: sel ? Brand.accent : const Color(0x221B1020),
              width: sel ? 1.5 : 1,
            ),
            gradient: sel
                ? RadialGradient(
                    center: Alignment(1.0, -1.0),
                    radius: 1.2,
                    colors: [Brand.accentTint, Color(Config.bg2)],
                    stops: [0.0, 0.7],
                  )
                : null,
          ),
          child: Stack(
            children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(icon, style: TextStyle(fontSize: 26, color: sel ? Brand.accent : const Color(Config.text2))),
                const SizedBox(height: 6),
                Text(label, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600, fontSize: 17, letterSpacing: -0.1)),
                const SizedBox(height: 4),
                Text(sub, style: const TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.4)),
              ]),
              if (sel)
                Positioned(
                  top: 0, right: 0,
                  child: Container(
                    width: 22, height: 22,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: Brand.accent),
                    child: const Center(
                      child: Text('✓', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
            ],
          ),
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
          Positioned.fill(child: ColoredBox(color: Color(0x88000000), child: Center(child: CircularProgressIndicator(color: Brand.accent)))),
      ]),
    );
  }
}
