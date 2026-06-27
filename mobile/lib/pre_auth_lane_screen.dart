import 'dart:async';
import 'package:flutter/material.dart';
import 'app_logger.dart';
import 'archetypes.dart';
import 'archetype_detail_sheet.dart';
import 'config.dart';
import 'onboarding_flow.dart' show LiveMembersCarousel;

/// Pre-auth "Pick your lane" screen — shown after the gate but before email
/// sign-up. Mirrors the web /verified-vibe/home page. The chosen archetype id
/// is passed to [onPick]; [onBack] returns to the gate.
class PreAuthLaneScreen extends StatefulWidget {
  final String gender;
  final ValueChanged<String> onPick;
  final VoidCallback onBack;
  const PreAuthLaneScreen({
    super.key,
    required this.gender,
    required this.onPick,
    required this.onBack,
  });

  @override
  State<PreAuthLaneScreen> createState() => _PreAuthLaneScreenState();
}

class _PreAuthLaneScreenState extends State<PreAuthLaneScreen> {
  int _secondsLeft = 9 * 60 + 59;
  Timer? _timer;
  String? _expandedSection;

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('pre_auth_lane');
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _secondsLeft > 0) setState(() => _secondsLeft--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String get _timerText {
    final m = (_secondsLeft ~/ 60).toString().padLeft(2, '0');
    final s = (_secondsLeft % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final sections = laneSectionsFor(widget.gender);
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Back + eyebrow
              Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                GestureDetector(
                  onTap: widget.onBack,
                  child: const Padding(
                    padding: EdgeInsets.only(right: 14),
                    child: Icon(Icons.arrow_back_ios, size: 18, color: Color(Config.text2)),
                  ),
                ),
                Container(
                  width: 8, height: 8,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(Config.accent),
                    boxShadow: [BoxShadow(color: Color(Config.accentTint), blurRadius: 0, spreadRadius: 3)],
                  ),
                ),
                const SizedBox(width: 8),
                const Text('RITEANGLE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.4, color: Color(Config.accentBright))),
              ]),
              const SizedBox(height: 16),
              // Title
              RichText(
                text: const TextSpan(
                  style: TextStyle(
                    fontSize: 54,
                    fontWeight: FontWeight.w800,
                    fontStyle: FontStyle.italic,
                    height: 0.92,
                    letterSpacing: -1.0,
                    color: Color(Config.text1),
                  ),
                  children: [
                    TextSpan(text: 'Pick your\n'),
                    TextSpan(
                      text: 'lane.',
                      style: TextStyle(color: Color(Config.accentBright)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              // Urgency timer banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                decoration: BoxDecoration(
                  color: const Color(0x14E11D54),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0x3FE11D54)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        const Text('Get matched within', style: TextStyle(fontSize: 15, color: Color(Config.text2), fontWeight: FontWeight.w500)),
                        Text(_timerText, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(Config.accentBright), letterSpacing: -0.3, fontFeatures: [FontFeature.tabularFigures()])),
                        const Text('minutes.', style: TextStyle(fontSize: 15, color: Color(Config.text2), fontWeight: FontWeight.w500)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    RichText(
                      text: const TextSpan(
                        style: TextStyle(fontSize: 13, color: Color(Config.text3), height: 1.45),
                        children: [
                          TextSpan(text: 'Earn your profile, verify your intent. '),
                          TextSpan(text: 'Pay later.', style: TextStyle(color: Color(Config.accentBright), fontWeight: FontWeight.w600, fontStyle: FontStyle.italic)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              // Section header
              const Text('What are you here for?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(Config.text1), letterSpacing: -0.1)),
              const SizedBox(height: 4),
              const Text('Pick one. You can switch later.', style: TextStyle(fontSize: 13, color: Color(Config.text3))),
              const SizedBox(height: 14),
              // Collapsible lane sections
              ...sections.map((s) => _buildSection(s)),
              const SizedBox(height: 16),
              // Trust note
              const Center(
                child: Text(
                  'We verify ID, photos, spending pattern & intent.\nNo one sees the raw files — only the signals you allow.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: Color(Config.text3), height: 1.6),
                ),
              ),
              const SizedBox(height: 24),
              // Live members carousel
              const LiveMembersCarousel(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSection(LaneSection section) {
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
      child: Column(
        children: [
          GestureDetector(
            onTap: () => setState(() => _expandedSection = isOpen ? null : section.label),
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(children: [
                // Pill label
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: isSerious ? const Color(0x1FE11D54) : const Color(0x1FA78BFA),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Text(
                    '${isSerious ? '❤️' : '✌️'}  ${section.label.toUpperCase()}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                      color: isSerious ? const Color(Config.accentBright) : const Color(0xFFA78BFA),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text('${section.archetypes.length} options', style: const TextStyle(fontSize: 12, color: Color(Config.text3))),
                ),
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
            ...section.archetypes.map((a) => _archetypeRow(a, isLast: a == section.archetypes.last)),
          ],
        ],
      ),
    );
  }

  Widget _archetypeRow(Archetype a, {bool isLast = false}) {
    return Column(
      children: [
        InkWell(
          onTap: () {
            AppLogger.instance.action('pre_auth_lane', 'select_lane');
            showArchetypeDetailSheet(
              context, a,
              onLockIn: () {
                AppLogger.instance.action('pre_auth_lane', 'continue');
                widget.onPick(a.id);
              },
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(children: [
              Text(a.emoji, style: const TextStyle(fontSize: 24)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(a.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(Config.text1))),
                  const SizedBox(height: 2),
                  Text(a.tag, style: const TextStyle(fontSize: 12, color: Color(Config.text3), height: 1.3)),
                ]),
              ),
              const Icon(Icons.chevron_right, color: Color(Config.text3), size: 18),
            ]),
          ),
        ),
        if (!isLast) const Divider(height: 1, thickness: 1, indent: 16, color: Color(0x181B1020)),
      ],
    );
  }
}
