import 'package:flutter/material.dart';

/// Minimal markdown renderer for advisor replies — the same subset the web
/// renders: **bold**, `- `/`• ` bullet lists, paragraphs (blank-line separated),
/// and single-newline line breaks. Avoids a heavyweight dependency.
Widget buildMarkdown(String text, {required Color color, double fontSize = 15}) {
  final blocks = text.trim().split(RegExp(r'\n\s*\n'));
  final children = <Widget>[];
  final base = TextStyle(color: color, fontSize: fontSize, height: 1.4);

  for (final raw in blocks) {
    final block = raw.trim();
    if (block.isEmpty) continue;
    final lines = block.split('\n');
    final isList = lines.every((l) => RegExp(r'^\s*[-•]\s+').hasMatch(l.trim()) || l.trim().isEmpty);

    if (isList) {
      for (final l in lines) {
        final t = l.trim();
        if (t.isEmpty) continue;
        final content = t.replaceFirst(RegExp(r'^[-•]\s+'), '');
        children.add(Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('•  ', style: base),
            Expanded(child: RichText(text: TextSpan(style: base, children: _inline(content, base)))),
          ]),
        ));
      }
    } else {
      // Render line-by-line so `#`/`##`/`###` headings become bold lines.
      for (final line in lines) {
        final l = line.trim();
        if (l.isEmpty) continue;
        final h = RegExp(r'^#{1,6}\s+(.*)$').firstMatch(l);
        if (h != null) {
          children.add(Padding(
            padding: const EdgeInsets.only(top: 2, bottom: 4),
            child: Text(h.group(1)!,
                style: base.copyWith(fontWeight: FontWeight.w700, fontSize: fontSize + 1)),
          ));
        } else {
          children.add(Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: RichText(text: TextSpan(style: base, children: _inline(l, base))),
          ));
        }
      }
    }
  }

  return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: children);
}

/// Parse **bold** spans (and keep single newlines as line breaks).
List<InlineSpan> _inline(String text, TextStyle base) {
  final spans = <InlineSpan>[];
  final re = RegExp(r'\*\*(.+?)\*\*');
  var i = 0;
  for (final m in re.allMatches(text)) {
    if (m.start > i) spans.add(TextSpan(text: text.substring(i, m.start)));
    spans.add(TextSpan(text: m.group(1), style: const TextStyle(fontWeight: FontWeight.w700)));
    i = m.end;
  }
  if (i < text.length) spans.add(TextSpan(text: text.substring(i)));
  return spans;
}
