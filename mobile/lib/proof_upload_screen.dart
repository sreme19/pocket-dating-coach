import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'api.dart';
import 'config.dart';

class _Cat {
  final String id, label, emoji;
  final int points;
  const _Cat(this.id, this.label, this.emoji, this.points);
}

const _categories = <_Cat>[
  _Cat('wealth', 'Wealth', '💎', 12),
  _Cat('spending', 'Spending', '🧾', 10),
  _Cat('assets', 'Assets (car, home)', '🚗', 10),
  _Cat('lifestyle', 'Lifestyle', '🌍', 8),
  _Cat('intro', 'Video / voice intro', '🎙️', 8),
  _Cat('hosting', 'Hosting', '🥂', 6),
  _Cat('discipline', 'Discipline / fitness', '💪', 4),
  _Cat('social_proof', 'Social proof', '🤝', 4),
];

/// Upload a proof artifact for a category → server verifies + awards trust points.
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

  Future<void> _upload(_Cat cat, ImageSource source) async {
    if (_busy) return;
    setState(() { _busy = true; _activeCat = cat.id; _resultText = null; });
    try {
      final List<XFile> files = source == ImageSource.gallery
          ? await _picker.pickMultiImage(maxWidth: 1800, imageQuality: 85)
          : [if (await _picker.pickImage(source: ImageSource.camera, maxWidth: 1800, imageQuality: 85) case final x?) x];
      if (files.isEmpty) { setState(() { _busy = false; _activeCat = null; }); return; }
      final res = await uploadProof(cat.id, files.map((f) => f.path).toList());
      final verified = res['verified'] == true;
      final pts = res['pts_awarded'] is num ? (res['pts_awarded'] as num).toInt() : 0;
      final agg = (res['aggregated'] ?? res['reason'] ?? '').toString();
      setState(() {
        _busy = false;
        _resultGood = verified;
        _resultText = verified
            ? '✓ ${cat.label} verified · +$pts trust${agg.isNotEmpty ? '\n$agg' : ''}'
            : 'Couldn’t verify ${cat.label}.${agg.isNotEmpty ? '\n$agg' : ''}';
      });
    } catch (e) {
      setState(() { _busy = false; _resultText = 'Upload failed: $e'; _resultGood = false; });
    } finally {
      setState(() => _activeCat = null);
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
            padding: EdgeInsets.fromLTRB(4, 8, 4, 12),
            child: Text('Upload a photo (or PDF for wealth/spending). Our AI checks it and adds trust points to your score.',
                style: TextStyle(color: Color(Config.text2), fontSize: 14, height: 1.4)),
          ),
          if (_resultText != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _resultGood ? const Color(0x2234D399) : const Color(0x22F87171),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _resultGood ? const Color(Config.accent) : const Color(0xFFF87171)),
              ),
              child: Text(_resultText!,
                  style: TextStyle(color: _resultGood ? const Color(Config.accent) : const Color(0xFFF87171))),
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
      child: Row(children: [
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
        else ...[
          IconButton(onPressed: _busy ? null : () => _upload(c, ImageSource.camera), icon: const Icon(Icons.photo_camera_outlined, color: Color(Config.text2))),
          IconButton(onPressed: _busy ? null : () => _upload(c, ImageSource.gallery), icon: const Icon(Icons.upload_outlined, color: Color(Config.accent))),
        ],
      ]),
    );
  }
}
