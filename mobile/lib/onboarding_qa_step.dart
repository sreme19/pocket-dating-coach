import 'package:flutter/material.dart';
import 'config.dart';
import 'onboarding_questions.dart';
import 'season.dart';

/// Renders an archetype-specific Q&A step — the native equivalent of the web
/// DrawnToStep / HowYouLiveStep bodies. Supports three section kinds:
///   • multi  → wrap of selectable chips (capped at [QSection.max]) + "+ more"
///   • single → wrap of chips, one selectable at a time (tap again to clear)
///   • card   → stacked cards (emoji + label + sub), one selectable
///
/// Controlled widget: the parent owns [picks] and applies the selection rule in
/// [onTap]; this widget only owns the local "more options expanded" state.
class QaStep extends StatefulWidget {
  final List<QSection> sections;
  final Map<String, List<String>> picks;
  final void Function(QSection section, String label) onTap;

  const QaStep({
    super.key,
    required this.sections,
    required this.picks,
    required this.onTap,
  });

  @override
  State<QaStep> createState() => _QaStepState();
}

class _QaStepState extends State<QaStep> {
  static const _border = Color(0x181B1020); // subtle ink border (unselected)
  static Color get _selectedFill => Brand.accentAlpha(0x22); // reskins with season
  final Set<String> _expanded = {};

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final s in widget.sections) ...[
          _header(s),
          const SizedBox(height: 10),
          _body(s),
          const SizedBox(height: 22),
        ],
      ],
    );
  }

  Widget _header(QSection s) {
    final picked = widget.picks[s.key] ?? const [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Text(s.icon, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(s.title,
                style: const TextStyle(
                    color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 16)),
          ),
          if (s.private) ...[const _PrivateBadge(), const SizedBox(width: 8)],
          if (s.kind == QKind.multi)
            Text('${picked.length}/${s.max}',
                style: TextStyle(
                    color: picked.isEmpty ? const Color(Config.text3) : Brand.accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 2),
        Text(s.sub, style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
      ],
    );
  }

  Widget _body(QSection s) {
    switch (s.kind) {
      case QKind.card:
        return Column(
          children: [
            for (final o in s.options) ...[_card(s, o), const SizedBox(height: 8)],
          ],
        );
      case QKind.single:
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [for (final o in s.options) _chip(s, o)],
        );
      case QKind.multi:
        final showMore = _expanded.contains(s.key);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final o in s.options) _chip(s, o),
              if (showMore)
                for (final o in s.more) _chip(s, o),
            ]),
            if (s.more.isNotEmpty) ...[
              const SizedBox(height: 8),
              GestureDetector(
                onTap: () => setState(() =>
                    showMore ? _expanded.remove(s.key) : _expanded.add(s.key)),
                child: Text(showMore ? 'Show less' : '+ more options',
                    style: TextStyle(
                        color: Brand.accent, fontWeight: FontWeight.w600, fontSize: 13)),
              ),
            ],
          ],
        );
    }
  }

  Widget _chip(QSection s, QOption o) {
    final selected = (widget.picks[s.key] ?? const []).contains(o.label);
    final muted = o.quiet && !selected;
    return GestureDetector(
      onTap: () => widget.onTap(s, o.label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? _selectedFill : const Color(Config.bg2),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: selected ? Brand.accent : _border,
              width: selected ? 1.5 : 1),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (o.emoji != null) ...[
            Text(o.emoji!, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 6),
          ],
          Text(o.label,
              style: TextStyle(
                  color: selected
                      ? Brand.accent
                      : (muted ? const Color(Config.text3) : const Color(Config.text1)),
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  fontSize: 14)),
        ]),
      ),
    );
  }

  Widget _card(QSection s, QOption o) {
    final selected = (widget.picks[s.key] ?? const []).contains(o.label);
    return GestureDetector(
      onTap: () => widget.onTap(s, o.label),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? _selectedFill : const Color(Config.bg2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: selected ? Brand.accent : _border,
              width: selected ? 1.5 : 1),
        ),
        child: Row(children: [
          if (o.emoji != null) ...[
            Text(o.emoji!, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(o.label,
                  style: TextStyle(
                      color: selected ? Brand.accent : const Color(Config.text1),
                      fontWeight: FontWeight.w700,
                      fontSize: 15)),
              if (o.sub != null) ...[
                const SizedBox(height: 2),
                Text(o.sub!,
                    style: const TextStyle(color: Color(Config.text2), fontSize: 12.5, height: 1.3)),
              ],
            ]),
          ),
          Icon(selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
              color: selected ? Brand.accent : const Color(Config.text3), size: 20),
        ]),
      ),
    );
  }
}

class _PrivateBadge extends StatelessWidget {
  const _PrivateBadge();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
            color: const Color(0x141B1020), borderRadius: BorderRadius.circular(999)),
        child: const Row(mainAxisSize: MainAxisSize.min, children: [
          Text('🔒', style: TextStyle(fontSize: 9)),
          SizedBox(width: 4),
          Text('PRIVATE',
              style: TextStyle(
                  color: Color(Config.text2),
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5)),
        ]),
      );
}
