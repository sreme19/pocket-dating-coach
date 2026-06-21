import 'package:flutter/material.dart';
import 'config.dart';
import 'onboarding_flow.dart' show LiveMembersCarousel;

/// "Earn your profile." overview screen — shown after OTP verification,
/// before the step-by-step verification flow. Mirrors verify/+page.svelte.
class EarnProfileScreen extends StatelessWidget {
  final VoidCallback onStart;
  final VoidCallback? onSkip;
  const EarnProfileScreen({super.key, required this.onStart, this.onSkip});

  static const _steps = [
    ('01', 'Identity Selfie',  'prove you\'re real',       '~30 sec'),
    ('02', 'Lifestyle Choices','prove you\'re solid',      '~45 sec'),
    ('03', 'Match Preferences','tell us who you want',     '~3 min' ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title
                    RichText(
                      text: const TextSpan(
                        style: TextStyle(
                          fontSize: 52,
                          fontWeight: FontWeight.w800,
                          fontStyle: FontStyle.italic,
                          height: 0.92,
                          letterSpacing: -1.0,
                        ),
                        children: [
                          TextSpan(
                            text: 'Earn your\n',
                            style: TextStyle(color: Color(Config.text1)),
                          ),
                          TextSpan(
                            text: 'profile.',
                            style: TextStyle(color: Color(Config.accentBright)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 28),
                    // Step cards — separate cards with 8px gap (matches Svelte gap: 8px)
                    ..._steps.map((s) => _StepRow(num: s.$1, name: s.$2, sub: s.$3, time: s.$4)),
                    const SizedBox(height: 8),
                    // Total time banner (accent-tint bg + border)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(Config.accentTint),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0x4DFF3B6B)),
                      ),
                      child: Row(
                        children: [
                          const Text('⚡', style: TextStyle(fontSize: 16)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: RichText(
                              text: const TextSpan(
                                style: TextStyle(fontSize: 14, color: Color(Config.text1)),
                                children: [
                                  TextSpan(text: 'Total time · '),
                                  TextSpan(
                                    text: '~5 min',
                                    style: TextStyle(
                                      color: Color(Config.accentBright),
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const Text(
                            'Pause anytime',
                            style: TextStyle(fontSize: 12, color: Color(Config.text3)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 28),
                    // Live members carousel
                    const LiveMembersCarousel(),
                    const SizedBox(height: 28),
                  ],
                ),
              ),
            ),
            // Sticky footer CTA
            Container(
              padding: EdgeInsets.fromLTRB(
                16, 12, 16, MediaQuery.of(context).padding.bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: FilledButton(
                      onPressed: onStart,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(Config.accentBright),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Start with Identity Selfie →',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'We verify ID, photos, spending pattern & intent.\nNo one sees the raw files — only the signals you allow.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(Config.text3),
                      height: 1.6,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  final String num, name, sub, time;
  const _StepRow({required this.num, required this.name, required this.sub, required this.time});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x181B1020)),
      ),
      child: Row(
        children: [
          // Number badge — accentTint bg, accentBright text, 36×36
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: const Color(Config.accentTint),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(
                num,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(Config.accentBright),
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w600,
                    color: Color(Config.text1), height: 1.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(sub, style: const TextStyle(fontSize: 12, color: Color(Config.text3))),
              ],
            ),
          ),
          Text(time, style: const TextStyle(fontSize: 12, color: Color(Config.text3))),
        ],
      ),
    );
  }
}
