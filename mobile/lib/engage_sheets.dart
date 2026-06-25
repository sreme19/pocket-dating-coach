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
/// Returns true if the tip was sent successfully.
Future<bool> showTipSheet(BuildContext context, {required String targetUserId, required String viewerGender}) async {
  final tags = viewerGender == 'woman' ? _womanViewerTags : _manViewerTags;
  final selected = <String>{};
  final textCtrl = TextEditingController();
  var sending = false;
  var sent = false;

  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
      textCtrl.removeListener(() {});
      textCtrl.addListener(() => setSheet(() {}));
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
                        sent = true;
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
  return sent;
}

/// Admire / craving-attention note → POST /attention (one-time per pair).
/// Returns true if the note was sent (or was already sent previously).
Future<bool> showAdmireSheet(BuildContext context, {required String recipientId, required String viewerGender, required String name}) async {
  final textCtrl = TextEditingController();
  var sending = false;
  var sent = false;
  var generating = false;
  var tone = 'flirty';
  final title = viewerGender == 'woman' ? '🌹 Secret admirer' : '👀 Notice me';

  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
      textCtrl.removeListener(() {});
      textCtrl.addListener(() => setSheet(() {}));
      return Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(color: Color(Config.text1), fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text('Send $name one note to get on their radar. You only get one — make it count.', style: const TextStyle(color: Color(Config.text2), fontSize: 13)),
          const SizedBox(height: 14),
          const Text('TONE', style: TextStyle(color: Color(Config.text3), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final t in const [('flirty', '😏 Flirty'), ('professional', '🎯 Professional'), ('practical', '💬 Practical'), ('bold', '🔥 Bold')])
              GestureDetector(
                onTap: generating ? null : () => setSheet(() => tone = t.$1),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: tone == t.$1 ? const Color(0x22FF3B6B) : const Color(Config.bg3),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: tone == t.$1 ? const Color(Config.accent) : const Color(0x181B1020)),
                  ),
                  child: Text(t.$2, style: TextStyle(color: tone == t.$1 ? const Color(Config.accent) : const Color(Config.text2), fontSize: 13, fontWeight: FontWeight.w600)),
                ),
              ),
          ]),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: generating
                  ? null
                  : () async {
                      setSheet(() => generating = true);
                      try {
                        final text = await autoGenAttention(recipientId, viewerGender, tone);
                        textCtrl.text = text;
                        textCtrl.selection = TextSelection.collapsed(offset: text.length);
                        setSheet(() => generating = false);
                      } catch (e) {
                        setSheet(() => generating = false);
                        if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text("Couldn't generate: $e")));
                      }
                    },
              icon: generating
                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)))
                  : const Text('✨', style: TextStyle(fontSize: 14)),
              label: Text(generating ? 'Generating…' : (textCtrl.text.trim().isEmpty ? 'Auto-generate' : 'Regenerate'),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(Config.accent),
                side: const BorderSide(color: Color(0x55FF3B6B)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: textCtrl,
            maxLength: 500,
            minLines: 2, maxLines: 4,
            style: const TextStyle(color: Color(Config.text1)),
            decoration: InputDecoration(
              hintText: 'Your message…',
              hintStyle: const TextStyle(color: Color(Config.text3)),
              filled: true, fillColor: const Color(Config.bg3),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
          SizedBox(
            width: double.infinity, height: 50,
            child: FilledButton(
              onPressed: sending || textCtrl.text.trim().isEmpty
                  ? null
                  : () async {
                      setSheet(() => sending = true);
                      try {
                        await sendAttention(recipientId, viewerGender, textCtrl.text.trim());
                        sent = true;
                        if (ctx.mounted) Navigator.pop(ctx);
                        if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Sent to $name ✓')));
                      } catch (e) {
                        setSheet(() => sending = false);
                        if (e == 'already') {
                          sent = true; // already sent = treat as sent state
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("You've already sent $name a note.")));
                        } else {
                          if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Failed: $e')));
                        }
                      }
                    },
              style: FilledButton.styleFrom(backgroundColor: const Color(Config.accent), foregroundColor: const Color(0xFFFFFFFF), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              child: sending
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFFFFFF)))
                  : const Text('Send', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ]),
      );
    }),
  );
  return sent;
}
