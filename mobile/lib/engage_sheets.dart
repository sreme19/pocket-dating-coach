import 'package:flutter/material.dart';
import 'api.dart';
import 'config.dart';

const _womanViewerTags = [
  'handsome', 'charming', 'successful-vibes', 'trustworthy', 'well-spoken',
  'mysterious', 'great-photos', 'improve-photos', 'not-my-type', 'red-flag-energy',
];
const _manViewerTags = [
  'stunning', 'elegant', 'warm', 'approachable', 'interesting-vibe',
  'authentic', 'great-photos', 'improve-photos', 'intimidating', 'guarded',
];

String _pretty(String slug) => slug
    .split('-')
    .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1))
    .join(' ');

/// Anonymous tip: tag chips + optional note → POST /tips.
Future<void> showTipSheet(BuildContext context, {required String targetUserId, required String viewerGender}) {
  final tags = viewerGender == 'woman' ? _womanViewerTags : _manViewerTags;
  final selected = <String>{};
  final textCtrl = TextEditingController();
  var sending = false;

  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
      return Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('💬 Leave an anonymous tip', style: TextStyle(color: Color(Config.text1), fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('They only ever see aggregate counts — never who said what.', style: TextStyle(color: Color(Config.text2), fontSize: 13)),
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 8, children: tags.map((t) {
            final on = selected.contains(t);
            return GestureDetector(
              onTap: () => setSheet(() => on ? selected.remove(t) : selected.add(t)),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: on ? const Color(0x22FF3B6B) : const Color(Config.bg3),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: on ? const Color(Config.accent) : const Color(0x181B1020)),
                ),
                child: Text(_pretty(t), style: TextStyle(color: on ? const Color(Config.accent) : const Color(Config.text2), fontSize: 13, fontWeight: FontWeight.w600)),
              ),
            );
          }).toList()),
          const SizedBox(height: 14),
          TextField(
            controller: textCtrl,
            maxLength: 280,
            style: const TextStyle(color: Color(Config.text1)),
            decoration: InputDecoration(
              hintText: 'Optional note…',
              hintStyle: const TextStyle(color: Color(Config.text3)),
              filled: true, fillColor: const Color(Config.bg3),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
          SizedBox(
            width: double.infinity, height: 50,
            child: FilledButton(
              onPressed: sending || (selected.isEmpty && textCtrl.text.trim().isEmpty)
                  ? null
                  : () async {
                      setSheet(() => sending = true);
                      try {
                        await submitTip(targetUserId, viewerGender, selected.toList(), textCtrl.text.trim());
                        if (ctx.mounted) Navigator.pop(ctx);
                        if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tip sent 💬')));
                      } catch (e) {
                        setSheet(() => sending = false);
                        if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Failed: $e')));
                      }
                    },
              style: FilledButton.styleFrom(backgroundColor: const Color(Config.accent), foregroundColor: const Color(0xFFFFFFFF), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              child: sending
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFFFFFF)))
                  : const Text('Send tip', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ]),
      );
    }),
  );
}

/// Admire / craving-attention note → POST /attention (one-time per pair).
/// Mirrors the web AttentionSheet: eyebrow + title, styled hint, tone chips,
/// ✨ Auto Gen (AI), remaining-char countdown, and an in-sheet success state.
Future<void> showAdmireSheet(BuildContext context, {required String recipientId, required String viewerGender, required String name}) {
  final textCtrl = TextEditingController();
  var sending = false;
  var autoGenning = false;
  var submitted = false;
  var tone = 'flirty';
  String? error;

  final isSecret = viewerGender == 'woman';
  final eyebrow = isSecret ? 'SECRET ADMIRER' : 'CRAVING ATTENTION';
  final emoji = isSecret ? '🌹' : '👀';
  final title = isSecret ? 'Your message to $name' : "Get $name's attention";
  final hint = isSecret
      ? '$name will see this in their Secret Admirers inbox.'
      : '$name will see this in their Craving Attention inbox.';
  final submitLabel = isSecret ? 'Send secret admirer 🌹' : 'Send message 👀';
  const tones = [
    ('flirty', '💋', 'Flirty'),
    ('professional', '💼', 'Professional'),
    ('practical', '🎯', 'Practical'),
    ('bold', '🔥', 'Bold'),
  ];

  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
      if (submitted) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 28, 20, 40 + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(emoji, style: const TextStyle(fontSize: 48)),
            const SizedBox(height: 10),
            const Text('Message sent!', style: TextStyle(color: Color(Config.text1), fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('$name will see it in their inbox.', textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text3), fontSize: 13)),
          ]),
        );
      }
      final remaining = 500 - textCtrl.text.length;
      return Padding(
        padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + MediaQuery.of(ctx).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0x331B1020), borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 14),
            Text(eyebrow, style: const TextStyle(color: Color(Config.accentBright), fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1)),
            const SizedBox(height: 4),
            Text(title, style: const TextStyle(color: Color(Config.text1), fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(color: const Color(Config.bg1), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0x181B1020))),
              child: Text(hint, style: const TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.5)),
            ),
            const SizedBox(height: 12),
            Stack(children: [
              TextField(
                controller: textCtrl,
                maxLength: 500,
                minLines: 4, maxLines: 6,
                onChanged: (_) => setSheet(() {}),
                style: const TextStyle(color: Color(Config.text1), height: 1.5),
                decoration: InputDecoration(
                  hintText: 'Write something that stands out…',
                  hintStyle: const TextStyle(color: Color(Config.text3)),
                  filled: true, fillColor: const Color(Config.bg1),
                  counterText: '',
                  contentPadding: const EdgeInsets.fromLTRB(12, 12, 12, 26),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0x181B1020))),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(Config.accentBright))),
                ),
              ),
              Positioned(
                right: 10, bottom: 8,
                child: Text('$remaining', style: TextStyle(fontSize: 10, color: remaining < 60 ? const Color(0xFFF59E0B) : const Color(Config.text3))),
              ),
            ]),
            const SizedBox(height: 12),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final t in tones)
                GestureDetector(
                  onTap: () => setSheet(() => tone = t.$1),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: tone == t.$1 ? const Color(Config.accentTint) : const Color(Config.bg1),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: tone == t.$1 ? const Color(Config.accentBright) : const Color(0x221B1020)),
                    ),
                    child: Text('${t.$2} ${t.$3}',
                        style: TextStyle(fontSize: 12, fontWeight: tone == t.$1 ? FontWeight.w700 : FontWeight.w500, color: tone == t.$1 ? const Color(Config.accentBright) : const Color(Config.text2))),
                  ),
                ),
            ]),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: autoGenning
                  ? null
                  : () async {
                      setSheet(() { autoGenning = true; error = null; });
                      try {
                        final text = await autoGenAttention(recipientId, viewerGender, tone);
                        textCtrl.text = text;
                        setSheet(() => autoGenning = false);
                      } catch (_) {
                        setSheet(() { autoGenning = false; error = 'Could not generate — try writing your own.'; });
                      }
                    },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(color: const Color(Config.accentTint), borderRadius: BorderRadius.circular(999), border: Border.all(color: const Color(Config.accentBright))),
                child: Text(autoGenning ? '⏳ Generating…' : '✨ Auto Gen',
                    style: const TextStyle(color: Color(Config.accentBright), fontSize: 13, fontWeight: FontWeight.w600)),
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity, height: 50,
              child: FilledButton(
                onPressed: sending || textCtrl.text.trim().isEmpty
                    ? null
                    : () async {
                        setSheet(() { sending = true; error = null; });
                        try {
                          await sendAttention(recipientId, viewerGender, textCtrl.text.trim());
                          setSheet(() { sending = false; submitted = true; });
                          await Future.delayed(const Duration(milliseconds: 1400));
                          if (ctx.mounted) Navigator.pop(ctx);
                        } catch (e) {
                          setSheet(() => sending = false);
                          final msg = e == 'already' ? "You've already sent $name a note." : 'Failed: $e';
                          if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(msg)));
                        }
                      },
                style: FilledButton.styleFrom(backgroundColor: const Color(Config.accentBright), foregroundColor: const Color(0xFFFFFFFF), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: sending
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFFFFFF)))
                    : Text(submitLabel, style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ]),
        ),
      );
    }),
  );
}
