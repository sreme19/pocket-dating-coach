import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
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
              '${nameMismatch ? '\n⚠️ Name on the document didn\'t match your ID — flagged for review.' : ''}'
          : 'Couldn\'t verify ${cat.label}.${agg.isNotEmpty ? '\n$agg' : ''}';
    });
  }

  /// Navigate to the staging screen — picks images there, uploads there,
  /// returns the server result map on success.
  Future<void> _upload(_Cat cat, ImageSource source) async {
    if (_busy) return;
    final res = await Navigator.of(context).push<Map>(
      MaterialPageRoute(builder: (_) => _ProofStagingScreen(cat: cat, initialSource: source)),
    );
    if (res == null) return;
    _applyResult(cat, res);
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
            style: FilledButton.styleFrom(backgroundColor: const Color(Config.accent), foregroundColor: const Color(0xFFFFFFFF)),
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
      setState(() { _busy = false; _activeCat = null; });
      _showError(_friendlyError(e));
    }
  }

  String _friendlyError(dynamic e) {
    if (e is DioException) {
      final data = e.response?.data;
      String? msg;
      if (data is Map) msg = (data['error'] ?? data['message'])?.toString();
      if (data is String && data.isNotEmpty) msg = data;
      if (msg != null && msg.isNotEmpty && msg.length < 200) return msg;
      final code = e.response?.statusCode;
      if (code == 403) return 'Permission denied. Please sign out and sign back in, then try again.';
      if (code == 401) return 'Session expired. Please sign out and sign back in.';
      if (code != null) return 'Server error ($code). Please try again.';
    }
    return 'Something went wrong. Please try again.';
  }

  void _showError(String msg) {
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Upload failed', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
        content: Text(msg, style: const TextStyle(color: Color(Config.text2), fontSize: 14, height: 1.5)),
        actions: [TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Got it', style: TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700)),
        )],
      ),
    );
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
                color: _resultGood ? const Color(0x22FF3B6B) : const Color(0x22F87171),
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
        border: Border.all(color: const Color(0x181B1020)),
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
                backgroundColor: const Color(0x22FF3B6B),
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

// ── Staging screen ────────────────────────────────────────────────────────────

/// Full-screen image staging area.
/// User picks images → previews them in a grid → taps "Analyse & Verify".
/// Pops with the server result Map on success, null on cancel.
class _ProofStagingScreen extends StatefulWidget {
  final _Cat cat;
  final ImageSource initialSource;
  const _ProofStagingScreen({super.key, required this.cat, required this.initialSource});

  @override
  State<_ProofStagingScreen> createState() => _ProofStagingScreenState();
}

class _ProofStagingScreenState extends State<_ProofStagingScreen> {
  final _picker = ImagePicker();
  List<XFile> _files = [];
  bool _loading = true; // picking initial images
  bool _busy    = false; // uploading

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _pickInitial());
  }

  Future<void> _pickInitial() async {
    final files = widget.initialSource == ImageSource.gallery
        ? await _picker.pickMultiImage(maxWidth: 1800, imageQuality: 85)
        : [if (await _picker.pickImage(source: ImageSource.camera, maxWidth: 1800, imageQuality: 85) case final x?) x];
    if (!mounted) return;
    if (files.isEmpty) { Navigator.pop(context); return; }
    setState(() { _files = files; _loading = false; });
  }

  Future<void> _addMore() async {
    final extra = await _picker.pickMultiImage(maxWidth: 1800, imageQuality: 85);
    if (extra.isNotEmpty && mounted) setState(() => _files = [..._files, ...extra]);
  }

  Future<void> _verify() async {
    if (_files.isEmpty || _busy) return;
    setState(() => _busy = true);
    try {
      final paths = _files.map((f) => f.path).toList();
      final res = await uploadProof(widget.cat.id, paths);

      if (res['requiresIdVerification'] == true) {
        setState(() => _busy = false);
        await _runIdGate(paths);
        return;
      }
      if (mounted) Navigator.pop(context, res);
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(Config.bg2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Upload failed', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
          content: Text(_friendlyError(e), style: const TextStyle(color: Color(Config.text2), fontSize: 14, height: 1.5)),
          actions: [TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Got it', style: TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700)),
          )],
        ),
      );
    }
  }

  /// Government-ID gate: verify ID first, then retry the original upload.
  Future<void> _runIdGate(List<String> paths) async {
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
            style: FilledButton.styleFrom(backgroundColor: const Color(Config.accent), foregroundColor: const Color(0xFFFFFFFF)),
            child: const Text('Camera'),
          ),
        ],
      ),
    );
    if (source == null || !mounted) return;

    final x = await _picker.pickImage(source: source, maxWidth: 1800, imageQuality: 85);
    if (x == null || !mounted) return;

    setState(() => _busy = true);
    try {
      final b64 = base64Encode(await x.readAsBytes());
      final idRes = await verifyStep('id', {'image': b64, 'mimeType': 'image/jpeg'});
      Map idData = idRes; if (idRes['data'] is Map) idData = idRes['data'] as Map;
      final idName = (idData['idName'] as String?)?.trim();
      if (idName == null || idName.isEmpty) {
        if (mounted) {
          setState(() => _busy = false);
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text("Couldn't read your ID — retake with better lighting and hold the card flat."),
          ));
        }
        return;
      }
      // ID verified — retry the original proof upload.
      final res = await uploadProof(widget.cat.id, paths);
      if (mounted) Navigator.pop(context, res);
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_friendlyError(e))));
      }
    }
  }

  String _friendlyError(dynamic e) {
    if (e is DioException) {
      final data = e.response?.data;
      String? msg;
      if (data is Map) msg = (data['error'] ?? data['message'])?.toString();
      if (data is String && data.isNotEmpty) msg = data;
      if (msg != null && msg.isNotEmpty && msg.length < 200) return msg;
      final code = e.response?.statusCode;
      if (code == 403) return 'Permission denied. Please sign out and sign back in, then try again.';
      if (code == 401) return 'Session expired. Please sign out and sign back in.';
      if (code != null) return 'Server error ($code). Please try again.';
    }
    return 'Something went wrong. Please try again.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        leading: IconButton(
          onPressed: _busy ? null : () => Navigator.pop(context),
          icon: const Icon(Icons.close, color: Color(Config.text1)),
        ),
        title: Row(children: [
          Text(widget.cat.emoji, style: const TextStyle(fontSize: 20)),
          const SizedBox(width: 8),
          Text(widget.cat.label,
              style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 17)),
        ]),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: const Color(0x22FF3B6B), borderRadius: BorderRadius.circular(999)),
            child: Text('+${widget.cat.points} pts',
                style: const TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700, fontSize: 13)),
          ),
        ],
      ),
      body: Column(children: [
        // Hint text
        if (widget.cat.hint.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(widget.cat.hint,
                style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4)),
          ),
        const SizedBox(height: 12),

        // Image grid
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: Color(Config.accent)))
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    itemCount: _files.length + 1, // last tile = "Add more"
                    itemBuilder: (ctx, i) {
                      if (i == _files.length) return _addMoreTile();
                      return _imageTile(i);
                    },
                  ),
                ),
        ),

        // Count pill
        if (!_loading && _files.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              '${_files.length} photo${_files.length == 1 ? '' : 's'} selected',
              style: const TextStyle(color: Color(Config.text3), fontSize: 13),
            ),
          ),

        // Analyse & Verify button
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: SizedBox(
              width: double.infinity,
              height: 56,
              child: FilledButton(
                onPressed: (_busy || _files.isEmpty) ? null : _verify,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(Config.accent),
                  foregroundColor: const Color(0xFFFFFFFF),
                  disabledBackgroundColor: const Color(0x44FF3B6B),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: _busy
                    ? const SizedBox(
                        width: 24, height: 24,
                        child: CircularProgressIndicator(color: Color(0xFFFFFFFF), strokeWidth: 2.5))
                    : const Text('Analyse & Verify',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
              ),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _imageTile(int i) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Image.file(File(_files[i].path), fit: BoxFit.cover),
        ),
        // Remove button
        Positioned(
          top: 6, right: 6,
          child: GestureDetector(
            onTap: _busy ? null : () => setState(() => _files.removeAt(i)),
            child: Container(
              width: 26, height: 26,
              decoration: const BoxDecoration(color: Color(0xCC000000), shape: BoxShape.circle),
              child: const Icon(Icons.close, color: Color(0xFFFFFFFF), size: 15),
            ),
          ),
        ),
      ],
    );
  }

  Widget _addMoreTile() {
    return GestureDetector(
      onTap: _busy ? null : _addMore,
      child: CustomPaint(
        painter: _DashedBorderPainter(color: const Color(0x99FF3B6B), radius: 16),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0x0AFF3B6B),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.add_photo_alternate_outlined, size: 38, color: Color(Config.accent)),
            SizedBox(height: 8),
            Text('Add more', style: TextStyle(color: Color(Config.accent), fontSize: 13, fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}

// ── Dashed border painter ─────────────────────────────────────────────────────

class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double radius;
  const _DashedBorderPainter({required this.color, this.radius = 12});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke;

    const dashLen = 6.0;
    const gapLen  = 4.0;

    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(1, 1, size.width - 2, size.height - 2),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics().first;
    double dist = 0;
    while (dist < metrics.length) {
      canvas.drawPath(metrics.extractPath(dist, dist + dashLen), paint);
      dist += dashLen + gapLen;
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) => old.color != color || old.radius != radius;
}
