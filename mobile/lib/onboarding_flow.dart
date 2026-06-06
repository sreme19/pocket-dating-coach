import 'package:flutter/material.dart';
import 'api.dart';
import 'archetypes.dart';
import 'config.dart';
import 'verification_screen.dart';

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
  bool _over18 = false;
  bool _saving = false;
  String? _error;

  Future<void> _pickArchetype(String archetypeId) async {
    if (_saving) return;
    setState(() { _saving = true; _error = null; });
    try {
      await saveGenderArchetype(_gender, archetypeId);
      if (mounted) setState(() { _saving = false; _step = 2; });
    } catch (e) {
      if (mounted) setState(() { _saving = false; _error = 'Could not save: $e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    switch (_step) {
      case 2:
        return VerificationScreen(onDone: widget.onComplete);
      case 1:
        return _Lane(
          gender: _gender,
          saving: _saving,
          error: _error,
          onPick: _pickArchetype,
          onBack: () => setState(() => _step = 0),
        );
      default:
        return _Gate(
          gender: _gender,
          over18: _over18,
          onGender: (g) => setState(() => _gender = g),
          onOver18: (v) => setState(() => _over18 = v),
          onContinue: _over18 ? () => setState(() => _step = 1) : null,
        );
    }
  }
}

class _Gate extends StatelessWidget {
  final String gender;
  final bool over18;
  final ValueChanged<String> onGender;
  final ValueChanged<bool> onOver18;
  final VoidCallback? onContinue;
  const _Gate({required this.gender, required this.over18, required this.onGender, required this.onOver18, required this.onContinue});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
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
              _genderCard('man', '♂', 'Man', gender == 'man', () => onGender('man')),
              const SizedBox(width: 12),
              _genderCard('woman', '♀', 'Woman', gender == 'woman', () => onGender('woman')),
            ]),
            const SizedBox(height: 28),
            GestureDetector(
              onTap: () => onOver18(!over18),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(Config.bg2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: over18 ? const Color(Config.accent) : const Color(0x22FFFFFF)),
                ),
                child: Row(children: [
                  Icon(over18 ? Icons.check_box : Icons.check_box_outline_blank, color: over18 ? const Color(Config.accent) : const Color(Config.text3)),
                  const SizedBox(width: 12),
                  const Expanded(child: Text("I'm 18 or older", style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600))),
                ]),
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity, height: 54,
              child: FilledButton(
                onPressed: onContinue,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(Config.accent),
                  foregroundColor: const Color(0xFF052819),
                  disabledBackgroundColor: const Color(Config.bg3),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                child: const Text('Continue', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _genderCard(String id, String icon, String label, bool sel, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 24),
          decoration: BoxDecoration(
            color: const Color(Config.bg2),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: sel ? const Color(Config.accent) : const Color(0x22FFFFFF), width: sel ? 2 : 1),
          ),
          child: Column(children: [
            Text(icon, style: TextStyle(fontSize: 30, color: sel ? const Color(Config.accent) : const Color(Config.text2))),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 16)),
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
                          border: Border.all(color: const Color(0x18FFFFFF)),
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
