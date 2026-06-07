import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'api.dart';
import 'config.dart';

class _Cat {
  final String id, label, emoji;
  final int points;
  final bool url; // true => verify by profile URL (social); false => image upload
  final String hint;
  const _Cat(this.id, this.label, this.emoji, this.points, {this.url = false, this.hint = ''});
}

const _categories = <_Cat>[
  _Cat('wealth', 'Wealth', '💎', 12, hint: 'Bank statement, payslip, or investment screenshot (numbers can be blurred).'),
  _Cat('spending', 'Spending', '🧾', 10, hint: 'Card statement or receipts showing your spending style.'),
  _Cat('assets', 'Assets (car, home)', '🚗', 10, hint: 'Car registration, property doc, or a photo with the asset.'),
  _Cat('lifestyle', 'Lifestyle', '🌍', 8, hint: 'Travel, dining, or experience photos with context.'),
  _Cat('intro', 'Video / voice intro', '🎙️', 8, hint: 'A short selfie video or voice clip — auto-verified.'),
  _Cat('hosting', 'Hosting', '🥂', 6, hint: 'Photos of you hosting — dinners, events, gatherings.'),
  _Cat('discipline', 'Discipline / fitness', '💪', 4, hint: 'Gym, sport, or routine screenshots.'),
  _Cat('social_proof', 'Social proof', '🤝', 4, hint: 'Group photos or events that show your social side.'),
  _Cat('linkedin', 'LinkedIn', '💼', 5, url: true, hint: 'Paste your LinkedIn URL (or upload a CV/profile screenshot).'),
  _Cat('instagram', 'Instagram', '📸', 3, url: true, hint: 'Paste your Instagram profile URL.'),
  _Cat('twitter', 'Twitter / X', '🐦', 2, url: true, hint: 'Paste your Twitter/X profile URL.'),
  _Cat('habit_tracker', 'Habit tracker', '📊', 2, hint: 'A habit-tracker app screenshot showing consistency.'),
];

/// Upload a proof artifact (or social URL) for a category → server verifies +
/// awards trust points.
class ProofUploadScreen extends StatefulWidget {
  const ProofUploadScreen({super.key});

  @override
  State<ProofUploadScreen> createState() => _ProofUploadScreenState();
}

class _ProofUploadScreenState extends State<ProofUploadScreen> {
  final _picker = ImagePicker();
  bool _busy = false;
  String? _activeCat;
  String? _resultText;
  bool _resultGood = false;
  List<String> _resultChips = const [];

  void _applyResult(_Cat cat, Map res) {
    final verified = res['verified'] == true;
    final pts = res['pts_awarded'] is num ? (res['pts_awarded'] as num).toInt() : 0;
    final agg = (res['aggregated'] ?? res['reason'] ?? '').toString();
    final nameMismatch = res['nameMatch'] == false;
    final chips = <String>[];
    if (res['insights'] is List) {
      for (final i in (res['insights'] as List)) {
        if (i is Map && i['label'] != null) chips.add('${i['emoji'] ?? '•'} ${i['label']}');
      }
    }
    setState(() {
      _busy = false;
      _activeCat = null;
      _resultGood = verified;
      _resultChips = verified ? chips : const [];
      _resultText = verified
          ? '✓ ${cat.label} verified · +$pts trust${agg.isNotEmpty ? '\n$agg' : ''}'
              '${nameMismatch ? '\n⚠️ Name on the document didn’t match your ID — flagged for review.' : ''}'
          : 'Couldn’t verify ${cat.label}.${agg.isNotEmpty ? '\n$agg' : ''}';
    });
  }

  /// The server requires a verified government ID before accepting this
  /// name-bearing document. Capture an ID, verify it, then retry the upload.
  Future<void> _runIdGate(_Cat cat, List<String> paths) async {
    setState(() { _busy = false; _activeCat = null; });
    final source = await showDialog<ImageSource>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        title: const Text('Verify your identity', style: TextStyle(color: Color(Config.text1), fontSize: 18)),
        content: const Text(
          'Documents that carry your name — bank statements, ownership papers, payslips — need a quick one-time government-ID check first. Upload the front of your Aadhaar, PAN, or passport. It stays private and only confirms the document is really yours.',
          style: TextStyle(color: Color(Config.text2), height: 1.4),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Not now', style: TextStyle(color: Color(Config.text2)))),
          TextButton(onPressed: () => Navigator.pop(ctx, ImageSource.gallery), child: const Text('Gallery', style: TextStyle(color: Color(Config.text2)))),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ImageSource.camera),
            style: FilledButton.styleFrom(backgroundColor: const Color(Config.accent), foregroundColor: const Color(0xFF052819)),
            child: const Text('Camera'),
          ),
        ],
      ),
    );
    if (source == null) return;

    final x = await _picker.pickImage(source: source, maxWidth: 1800, imageQuality: 85);
    if (x == null) return;

    setState(() { _busy = true; _activeCat = cat.id; _resultText = null; _resultChips = const []; });
    try {
      final b64 = base64Encode(await x.readAsBytes());
      final idRes = await verifyStep('id', {'image': b64, 'mimeType': 'image/jpeg'});
      Map idData = idRes; if (idRes['data'] is Map) idData = idRes['data'] as Map;
      final idName = (idData['idName'] as String?)?.trim();
      if (idName == null || idName.isEmpty) {
        setState(() {
          _busy = false; _activeCat = null; _resultGood = false;
          _resultText = "Couldn’t read your ID — retake with better lighting and hold the card flat.";
        });
        return;
      }
      // ID verified — retry the original document upload now that the gate is cleared.
      final res = await uploadProof(cat.id, paths);
      _applyResult(cat, res);
    } catch (e) {
      setState(() { _busy = false; _activeCat = null; _resultGood = false; _resultText = 'ID verification failed: $e'; });
    }
  }

  Future<void> _upload(_Cat cat, ImageSource source) async {
    if (_busy) return;
    setState(() { _busy = true; _activeCat = cat.id; _resultText = null; _resultChips = const []; });
    try {
      final List<XFile> files = source == ImageSource.gallery
          ? await _picker.pickMultiImage(maxWidth: 1800, imageQuality: 85)
          : [if (await _picker.pickImage(source: ImageSource.camera, maxWidth: 1800, imageQuality: 85) case final x?) x];
      if (files.isEmpty) { setState(() { _busy = false; _activeCat = null; }); return; }
      final paths = files.map((f) => f.path).toList();
      final res = await uploadProof(cat.id, paths);
      // Name-bearing document needs a verified government ID first → run the gate, then retry.
      if (res['requiresIdVerification'] == true) { await _runIdGate(cat, paths); return; }
      _applyResult(cat, res);
    } catch (e) {
      setState(() { _busy = false; _activeCat = null; _resultText = 'Upload failed: $e'; _resultGood = false; });
    }
  }

  Future<void> _uploadUrl(_Cat cat) async {
    if (_busy) return;
    final ctrl = TextEditingController();
    final url = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        title: Text('Connect ${cat.label}', style: const TextStyle(color: Color(Config.text1), fontSize: 18)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          keyboardType: TextInputType.url,
          style: const TextStyle(color: Color(Config.text1)),
          decoration: InputDecoration(
            hintText: 'https://…',
            hintStyle: const TextStyle(color: Color(Config.text3)),
            filled: true, fillColor: const Color(Config.bg3),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: Color(Config.text2)))),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            style: FilledButton.styleFrom(backgroundColor: const Color(Config.accent), foregroundColor: const Color(0xFF052819)),
            child: const Text('Verify'),
          ),
        ],
      ),
    );
    if (url == null || url.isEmpty) return;
    setState(() { _busy = true; _activeCat = cat.id; _resultText = null; _resultChips = const []; });
    try {
      final res = await uploadProofUrl(cat.id, url);
      _applyResult(cat, res);
    } catch (e) {
      setState(() { _busy = false; _activeCat = null; _resultText = 'Verify failed: $e'; _resultGood = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('Add a proof', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(4, 8, 4, 6),
            child: Text('Add proofs and our AI verifies them to boost your trust score. Connect a social profile by URL, or upload a photo / PDF.',
                style: TextStyle(color: Color(Config.text2), fontSize: 14, height: 1.4)),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(4, 0, 4, 12),
            child: Text('🔒 Your uploads stay private — only AI-read highlights appear on your profile, never the raw documents.',
                style: TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.3)),
          ),
          if (_resultText != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _resultGood ? const Color(0x2210B981) : const Color(0x22F87171),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _resultGood ? const Color(Config.accent) : const Color(0xFFF87171)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_resultText!,
                    style: TextStyle(color: _resultGood ? const Color(Config.accent) : const Color(0xFFF87171))),
                if (_resultChips.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final c in _resultChips)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(color: const Color(Config.bg3), borderRadius: BorderRadius.circular(999)),
                        child: Text(c, style: const TextStyle(color: Color(Config.text1), fontSize: 12)),
                      ),
                  ]),
                ],
              ]),
            ),
          ..._categories.map((c) => _row(c)),
        ],
      ),
    );
  }

  Widget _row(_Cat c) {
    final loading = _busy && _activeCat == c.id;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x18FFFFFF)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(c.emoji, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c.label, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600, fontSize: 15)),
              Text('+${c.points} trust', style: const TextStyle(color: Color(Config.accent), fontSize: 12, fontWeight: FontWeight.w600)),
            ]),
          ),
          if (loading)
            const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)))
          else if (c.url)
            FilledButton(
              onPressed: _busy ? null : () => _uploadUrl(c),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0x2210B981),
                foregroundColor: const Color(Config.accent),
                visualDensity: VisualDensity.compact,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Connect'),
            )
          else ...[
            IconButton(onPressed: _busy ? null : () => _upload(c, ImageSource.camera), icon: const Icon(Icons.photo_camera_outlined, color: Color(Config.text2))),
            IconButton(onPressed: _busy ? null : () => _upload(c, ImageSource.gallery), icon: const Icon(Icons.upload_outlined, color: Color(Config.accent))),
          ],
        ]),
        if (c.hint.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 36),
            child: Text(c.hint, style: const TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.3)),
          ),
      ]),
    );
  }
}
