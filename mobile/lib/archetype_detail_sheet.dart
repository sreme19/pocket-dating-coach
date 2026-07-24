import 'package:flutter/material.dart';
import 'archetypes.dart';
import 'config.dart';
import 'season.dart';

/// Shows the archetype detail bottom sheet (mirrors ArchetypeDetailModal.svelte).
/// [onLockIn] is called with the archetype id when the user taps "Let's go →".
Future<void> showArchetypeDetailSheet(
  BuildContext context,
  Archetype archetype, {
  required VoidCallback onLockIn,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0xA6000000),
    builder: (_) => _ArchetypeDetailSheet(archetype: archetype, onLockIn: onLockIn),
  );
}

class _ArchetypeDetailSheet extends StatelessWidget {
  final Archetype archetype;
  final VoidCallback onLockIn;
  const _ArchetypeDetailSheet({required this.archetype, required this.onLockIn});

  @override
  Widget build(BuildContext context) {
    final isMan = archetype.id.endsWith('_man');
    final genderLabel = isMan ? 'Man' : 'Woman';
    final bestMatches = archetype.matchTraits.where((t) => t.tier == 'best').toList();
    final goodMatches = archetype.matchTraits.where((t) => t.tier == 'good').toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.88,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Color(Config.bg1),
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: const Color(0x331B1020),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Emoji box
                    Container(
                      width: 54, height: 54,
                      decoration: BoxDecoration(
                        color: const Color(Config.bg2),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0x181B1020)),
                      ),
                      child: Center(child: Text(archetype.emoji, style: const TextStyle(fontSize: 26))),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "YOU'RE A",
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.0, color: Color(Config.text3)),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${archetype.name}.',
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                              fontStyle: FontStyle.italic,
                              color: Color(Config.text1),
                              letterSpacing: -0.3,
                              height: 1,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Close button
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Container(
                        width: 32, height: 32,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(Config.bg2),
                          border: Border.all(color: const Color(0x181B1020)),
                        ),
                        child: const Center(
                          child: Text('✕', style: TextStyle(fontSize: 14, color: Color(Config.text2))),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0x181B1020)),
              // Scrollable body
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  children: [
                    // Description
                    Text(
                      archetype.longTag,
                      style: const TextStyle(
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: Color(Config.text2),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 22),
                    // YOU'LL MATCH WITH
                    _sectionLabel('💚  YOU\'LL MATCH WITH'),
                    const SizedBox(height: 10),
                    if (bestMatches.isNotEmpty) ...[
                      _tierLabel('BEST MATCH', Brand.accentBright),
                      const SizedBox(height: 8),
                      _chipWrap(bestMatches.map((t) => _chip(
                        '💎  ${t.label}',
                        bg: Brand.accentTint,
                        border: Brand.accent,
                        textColor: Brand.accentBright,
                        bold: true,
                      )).toList()),
                      if (goodMatches.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        _tierLabel('GOOD FIT', const Color(Config.text3)),
                        const SizedBox(height: 8),
                      ],
                    ],
                    if (goodMatches.isNotEmpty)
                      _chipWrap(goodMatches.map((t) => _chip(
                        '✓  ${t.label}',
                        bg: const Color(Config.bg2),
                        border: const Color(0x331B1020),
                        textColor: const Color(Config.text1),
                      )).toList()),
                    const SizedBox(height: 22),
                    // YOU WON'T SEE
                    _sectionLabel('✕  YOU WON\'T SEE', color: const Color(Config.text3)),
                    const SizedBox(height: 10),
                    _chipWrap(archetype.avoidTraits.map((t) => _chip(
                      '✕  ${t.label}',
                      bg: const Color(0x0FEF4444),
                      border: const Color(0x26EF4444),
                      textColor: const Color(Config.text3),
                      strikethrough: true,
                    )).toList()),
                    const SizedBox(height: 22),
                    // WHAT YOU BRING
                    _sectionLabel('✨  WHAT YOU BRING TO THE TABLE'),
                    const SizedBox(height: 10),
                    _chipWrap(archetype.brings.map((b) => _chip(
                      '✓  $b',
                      bg: const Color(Config.bg2),
                      border: const Color(0x331B1020),
                      textColor: const Color(Config.text1),
                    )).toList()),
                    const SizedBox(height: 100), // space for footer
                  ],
                ),
              ),
              // Footer — "Lock it in" button
              Container(
                padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).padding.bottom + 16),
                decoration: const BoxDecoration(
                  color: Color(Config.bg1),
                  border: Border(top: BorderSide(color: Color(0x181B1020))),
                ),
                child: SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      onLockIn();
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: Brand.accentBright,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    child: Text(
                      "I'm a ${archetype.name} $genderLabel — Let's go →",
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _sectionLabel(String text, {Color color = const Color(Config.text2)}) {
    return Text(
      text,
      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.9, color: color),
    );
  }

  Widget _tierLabel(String text, Color color) {
    return Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.9, color: color));
  }

  Widget _chipWrap(List<Widget> chips) {
    return Wrap(spacing: 8, runSpacing: 8, children: chips);
  }

  Widget _chip(String label, {
    required Color bg,
    required Color border,
    required Color textColor,
    bool bold = false,
    bool strikethrough = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          fontWeight: bold ? FontWeight.w600 : FontWeight.w500,
          color: textColor,
          decoration: strikethrough ? TextDecoration.lineThrough : null,
          decorationColor: textColor,
        ),
      ),
    );
  }
}
