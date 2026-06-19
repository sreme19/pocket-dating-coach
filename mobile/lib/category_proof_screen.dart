import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'config.dart';

// ── Category config ───────────────────────────────────────────────────────────

class _CatConfig {
  final String id;
  final String icon;
  final String title;
  final String subtitle;
  final String privacyCopy;
  final List<String> examples;
  final String hintLine;
  final int maxFiles;
  final bool hasUrlInput;
  final String? urlLabel;
  final String? urlPlaceholder;
  final bool hasOAuthConnect;
  final String? connectLabel;
  final String? connectUrl;
  final Color? connectColor;
  const _CatConfig({
    required this.id,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.privacyCopy,
    required this.examples,
    required this.hintLine,
    this.maxFiles = 20,
    this.hasUrlInput = false,
    this.urlLabel,
    this.urlPlaceholder,
    this.hasOAuthConnect = false,
    this.connectLabel,
    this.connectUrl,
    this.connectColor,
  });
}

const _configs = <String, _CatConfig>{
  'lifestyle': _CatConfig(
    id: 'lifestyle',
    icon: '🌍',
    title: 'Lifestyle Proof',
    subtitle: 'Show your real world: travel, dining, experiences',
    privacyCopy: 'Your uploads stay private. They help confirm your profile is authentic and improve match quality.',
    examples: [
      'Hotel or flight booking screenshots',
      'Restaurant or bar photos with context',
      'Event or concert tickets',
      'Travel photos with locations and moments visible',
    ],
    hintLine: 'Mix photos and booking screenshots for the strongest signal. Up to 20 photos.',
    maxFiles: 20,
  ),
  'discipline': _CatConfig(
    id: 'discipline',
    icon: '💪',
    title: 'Discipline Proof',
    subtitle: 'Show your consistent routines',
    privacyCopy: 'Private by default. Your proofs strengthen trust, verify authenticity, and help you get better matches.',
    examples: [
      'Gym check-in or workout selfie',
      'Fitness app streak screenshot',
      'Reading app or book log',
      'Sleep tracker weekly summary',
    ],
    hintLine: 'Streak screens from apps are the most convincing. Up to 20 photos.',
    maxFiles: 20,
  ),
  'social_proof': _CatConfig(
    id: 'social_proof',
    icon: '🤝',
    title: 'Social Proof',
    subtitle: 'Show your real social connections',
    privacyCopy: 'Nothing here is public. These signals confirm your lifestyle and improve compatibility.',
    examples: [
      'Group photos with friends',
      'Community or club events you attend',
      'Sports team or group activity photos',
      'Social gathering moments',
    ],
    hintLine: 'Natural group moments beat posed shots. Up to 20 photos.',
    maxFiles: 20,
  ),
  'hosting': _CatConfig(
    id: 'hosting',
    icon: '🍽️',
    title: 'Hosting Proof',
    subtitle: 'Show you host dinners, celebrations, gatherings',
    privacyCopy: 'Nothing here is public. These signals confirm your lifestyle and improve compatibility.',
    examples: [
      'Photos of dinners or parties you\'ve hosted',
      'Table setups or event setups',
      'Group celebration photos at your place',
      'Restaurant reservation or catering receipt',
    ],
    hintLine: 'Real moments at home work better than restaurant photos alone. Up to 20 photos.',
    maxFiles: 20,
  ),
  'intro': _CatConfig(
    id: 'intro',
    icon: '🎙️',
    title: 'Voice & Video Intro',
    subtitle: 'A short intro makes matches feel safe messaging first',
    privacyCopy: 'Only the AI-extracted highlights appear on your profile. Your raw audio/video stays private.',
    examples: [
      '30–60 second voice memo, introduce yourself naturally',
      'Short video clip (face visible, no filters needed)',
      'Talk about what you\'re looking for, your vibe',
      'Natural beats scripted — just be yourself.',
    ],
    hintLine: 'One voice and one video is the ideal combo.',
    maxFiles: 2,
  ),
  'linkedin': _CatConfig(
    id: 'linkedin',
    icon: '💼',
    title: 'LinkedIn / CV',
    subtitle: 'Connect your LinkedIn or upload a screenshot',
    privacyCopy: 'Your uploads are never shared publicly. Used only to verify authenticity and improve your Trust Score.',
    examples: [
      'Tap "Open LinkedIn" → go to your profile → copy URL',
      'Paste your profile URL in the field below',
      'Or screenshot your profile with name, title and company visible',
      'We only check your role and company — nothing else is read',
    ],
    hintLine: 'URL or screenshot accepted — both can be used together.',
    maxFiles: 3,
    hasUrlInput: true,
    urlLabel: 'LinkedIn URL',
    urlPlaceholder: 'linkedin.com/in/yourname',
    hasOAuthConnect: true,
    connectLabel: 'Open LinkedIn',
    connectUrl: 'https://www.linkedin.com',
    connectColor: Color(0xFF0A66C2),
  ),
  'instagram': _CatConfig(
    id: 'instagram',
    icon: '📸',
    title: 'Instagram',
    subtitle: 'Connect your Instagram to verify social presence',
    privacyCopy: 'Your profile stays private. This only confirms you are an active, genuine person online.',
    examples: [
      'Tap "Open Instagram" → sign in → go to your profile',
      'Copy your profile URL from the browser address bar',
      'Paste it below — we only check username and post count',
      'Your posts and DMs stay completely private',
    ],
    hintLine: 'Takes under 60 seconds. Your posts and DMs stay private.',
    maxFiles: 1,
    hasUrlInput: true,
    urlLabel: 'Your Instagram profile URL',
    urlPlaceholder: 'instagram.com/yourhandle',
    hasOAuthConnect: true,
    connectLabel: 'Open Instagram',
    connectUrl: 'https://www.instagram.com/accounts/login/',
    connectColor: Color(0xFFE1306C),
  ),
  'twitter': _CatConfig(
    id: 'twitter',
    icon: '🐦',
    title: 'Twitter / X',
    subtitle: 'Connect your X / Twitter to show real interests',
    privacyCopy: 'Your profile stays private. This only confirms your real interests and online presence.',
    examples: [
      'Tap "Open X" → sign in → go to your profile',
      'Copy your profile URL from the browser address bar',
      'Paste it below — your DMs and private posts stay private',
      'We only verify that the account is real and active',
    ],
    hintLine: 'Takes under 60 seconds. Your private posts are never accessed.',
    maxFiles: 1,
    hasUrlInput: true,
    urlLabel: 'Your X / Twitter profile URL',
    urlPlaceholder: 'x.com/yourhandle',
    hasOAuthConnect: true,
    connectLabel: 'Open X (Twitter)',
    connectUrl: 'https://x.com/i/flow/login',
    connectColor: Color(0xFF000000),
  ),
  'travel': _CatConfig(
    id: 'travel',
    icon: '✈️',
    title: 'Travel Proof',
    subtitle: 'Passport stamps, boarding passes, visa stickers',
    privacyCopy: 'Your uploads stay private. AI scans for country names and adds them to your Travel Magnets automatically.',
    examples: [
      'Passport pages with entry/exit stamps',
      'Boarding passes (origin and destination visible)',
      'Visa stickers or approval letters',
      'Hotel booking confirmation or travel itinerary',
    ],
    hintLine: 'More stamps = more countries detected. Up to 20 photos.',
    maxFiles: 20,
  ),
  'spending': _CatConfig(
    id: 'spending',
    icon: '🧾',
    title: 'Spending Proof',
    subtitle: 'Restaurant bills, travel receipts, event tickets',
    privacyCopy: 'Your uploads stay private. AI reads spend amounts to verify generosity — shown as a lifestyle signal on your profile.',
    examples: [
      'Restaurant or bar receipt (amount and venue visible)',
      'Hotel or travel booking confirmation',
      'Event, concert or experience ticket receipt',
      'Shopping or luxury purchase receipt',
    ],
    hintLine: 'Receipts with visible amounts work best. Up to 5 photos.',
    maxFiles: 5,
  ),
  'wealth': _CatConfig(
    id: 'wealth',
    icon: '🏦',
    title: 'Wealth Proof',
    subtitle: 'Bank statement, investment or financial document',
    privacyCopy: 'Documents are private. AI only reads balance ranges — your actual amounts are never stored or shared.',
    examples: [
      'Bank statement (balance page)',
      'Investment account or brokerage statement',
      'Crypto portfolio screenshot',
      'Property valuation or mortgage document',
    ],
    hintLine: 'Statement pages showing balances work best. Up to 5 files.',
    maxFiles: 5,
  ),
  'assets': _CatConfig(
    id: 'assets',
    icon: '🚗',
    title: 'Assets Proof',
    subtitle: 'Car registration, property deed, company docs',
    privacyCopy: 'Documents stay private. AI extracts make, model and year to build your Garage section on your profile.',
    examples: [
      'Vehicle registration certificate',
      'Car insurance document (make/model visible)',
      'Property title or deed',
      'Company registration or shareholding document',
    ],
    hintLine: 'Registration docs are the easiest. Up to 5 files.',
    maxFiles: 5,
  ),
};

// ── Screen ────────────────────────────────────────────────────────────────────

/// Dedicated proof-upload screen for a single category.
/// Mirrors the Svelte /verified-vibe/proof-upload?category=X page.
class CategoryProofScreen extends StatefulWidget {
  final String categoryId;
  final ProofItem? existingProof;
  const CategoryProofScreen({super.key, required this.categoryId, this.existingProof});

  @override
  State<CategoryProofScreen> createState() => _CategoryProofScreenState();
}

class _CategoryProofScreenState extends State<CategoryProofScreen> {
  final _picker = ImagePicker();
  final _urlController = TextEditingController();
  final List<XFile> _files = [];
  bool _analysing = false;
  _UploadResult? _result;
  final List<XFile> _resumeImages = [];

  // ── Intro-only recording state ──────────────────────────────────────────────
  AudioRecorder? _audioRec;
  bool _isRecordingVoice = false;
  int _voiceSeconds = 0;
  Timer? _voiceTimer;
  String? _voicePath;
  String? _videoPath;

  @override
  void initState() {
    super.initState();
    if (widget.categoryId == 'intro') {
      _audioRec = AudioRecorder();
    }
  }

  @override
  void dispose() {
    _urlController.dispose();
    _voiceTimer?.cancel();
    _audioRec?.dispose();
    super.dispose();
  }

  _CatConfig get _cfg => _configs[widget.categoryId] ??
      const _CatConfig(
        id: 'lifestyle',
        icon: '📂',
        title: 'Upload Proof',
        subtitle: 'Upload supporting documents',
        privacyCopy: '🔒 Your uploads stay private.',
        examples: [],
        hintLine: '',
      );

  Future<void> _pickPhotos() async {
    if (_analysing) return;
    final picked = await _picker.pickMultiImage(maxWidth: 1800, imageQuality: 85);
    if (picked.isEmpty) return;
    final combined = [..._files, ...picked];
    setState(() {
      _files
        ..clear()
        ..addAll(combined.take(_cfg.maxFiles));
    });
  }

  Future<void> _pickResumeImages() async {
    if (_analysing) return;
    final picked = await _picker.pickMultiImage(maxWidth: 1800, imageQuality: 90);
    if (picked.isEmpty) return;
    setState(() {
      _resumeImages
        ..clear()
        ..addAll(picked.take(5));
    });
  }

  // ── Voice recording ─────────────────────────────────────────────────────────
  Future<void> _startVoice() async {
    final rec = _audioRec;
    if (rec == null || _isRecordingVoice) return;
    if (!await rec.hasPermission()) return;
    final path = '${Directory.systemTemp.path}/vv_voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await rec.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    setState(() { _isRecordingVoice = true; _voiceSeconds = 0; });
    _voiceTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() { _voiceSeconds++; });
    });
  }

  Future<void> _stopVoice() async {
    _voiceTimer?.cancel();
    _voiceTimer = null;
    final path = await _audioRec?.stop();
    setState(() {
      _isRecordingVoice = false;
      if (path != null) _voicePath = path;
    });
  }

  Future<void> _recordVideo() async {
    if (_analysing) return;
    final video = await _picker.pickVideo(
      source: ImageSource.camera,
      maxDuration: const Duration(minutes: 2),
    );
    if (video != null) setState(() { _videoPath = video.path; });
  }

  String _fmtSec(int s) =>
      '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';

  String? _extractLinkedInUsername(String url) {
    final normalized = url.contains('://') ? url : 'https://$url';
    final uri = Uri.tryParse(normalized);
    if (uri == null) return null;
    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    final inIdx = segments.indexOf('in');
    if (inIdx >= 0 && inIdx + 1 < segments.length) return segments[inIdx + 1];
    return null;
  }

  // ── Can submit ───────────────────────────────────────────────────────────────
  bool get _canAnalyse {
    if (_analysing) return false;
    if (widget.categoryId == 'intro') return _voicePath != null || _videoPath != null;
    if (_files.isNotEmpty) return true;
    if (_resumeImages.isNotEmpty) return true;
    if (_cfg.hasUrlInput && _urlController.text.trim().isNotEmpty) return true;
    return false;
  }

  // ── Lightweight ID gate: just upload KTP and let AI verify ──────────────────
  Future<void> _showIdGateSheet() async {
    XFile? picked;
    bool verifying = false;
    String? error;
    bool done = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setS) {
        return Container(
          padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(ctx).padding.bottom + 24),
          decoration: const BoxDecoration(
            color: Color(Config.bg2),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(
              color: const Color(Config.text3), borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 20),
            const Text('🪪  Verify your identity', style: TextStyle(
              fontSize: 18, fontWeight: FontWeight.w800, color: Color(Config.text1))),
            const SizedBox(height: 8),
            const Text(
              'This category requires a quick identity check.\nUpload a photo of your government ID or passport — AI verifies it in seconds.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Color(Config.text2), height: 1.5),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0x1AFBBF24),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Tips for best results:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFFBBF24))),
                SizedBox(height: 4),
                Text('• Real ID card or passport (not a screenshot)\n• All text clearly readable\n• Good lighting, no blur or glare', style: TextStyle(fontSize: 12, color: Color(Config.text2), height: 1.5)),
              ]),
            ),
            const SizedBox(height: 20),
            if (picked == null)
              SizedBox(width: double.infinity, child: OutlinedButton.icon(
                onPressed: () async {
                  final img = await ImagePicker().pickImage(source: ImageSource.gallery);
                  if (img != null) setS(() { picked = img; error = null; });
                },
                icon: const Icon(Icons.upload_file_rounded),
                label: const Text('Choose ID photo'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  foregroundColor: const Color(Config.accent),
                  side: const BorderSide(color: Color(Config.accent)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ))
            else
              Row(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.file(File(picked!.path), width: 72, height: 72, fit: BoxFit.cover),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(picked!.name,
                  style: const TextStyle(fontSize: 13, color: Color(Config.text2)),
                  maxLines: 2, overflow: TextOverflow.ellipsis)),
                TextButton(
                  onPressed: () => setS(() { picked = null; error = null; }),
                  child: const Text('Change'),
                ),
              ]),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
            ],
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, child: FilledButton(
              onPressed: (picked == null || verifying || done) ? null : () async {
                setS(() { verifying = true; error = null; });
                try {
                  final ok = await verifyIdStep(picked!.path);
                  if (ok) {
                    setS(() { done = true; verifying = false; });
                    if (ctx.mounted) Navigator.of(ctx).pop(true);
                  } else {
                    setS(() { verifying = false; error = 'ID could not be verified. Please try a clearer photo.'; });
                  }
                } catch (e) {
                  final msg = e.toString().replaceFirst('Exception: ', '');
                  setS(() { verifying = false; error = msg; });
                }
              },
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accent),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: verifying
                  ? const SizedBox(width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Verify ID', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            )),
          ]),
        );
      }),
    );

    // If ID was verified, retry the proof upload automatically
    if (mounted) _analyse();
  }

  Future<void> _analyse() async {
    if (!_canAnalyse) return;
    setState(() { _analysing = true; _result = null; });
    try {
      final Map res;
      if (widget.categoryId == 'intro') {
        final paths = [
          ?_voicePath,
          ?_videoPath,
        ];
        res = await uploadProof('intro', paths);
      } else {
        final url = _urlController.text.trim();
        if (_resumeImages.isNotEmpty && url.isNotEmpty) {
          res = await uploadProofWithUrl(widget.categoryId, url, _resumeImages.first.path);
        } else if (_resumeImages.isNotEmpty) {
          final paths = _resumeImages.map((f) => f.path).toList();
          res = await uploadProof(widget.categoryId, paths);
        } else if (url.isNotEmpty && _files.isEmpty) {
          res = await uploadProofUrl(widget.categoryId, url);
        } else {
          final paths = _files.map((f) => f.path).toList();
          res = await uploadProof(widget.categoryId, paths);
        }
      }
      // Gated categories (spending/wealth/assets) require ID verification first
      if (res['requiresIdVerification'] == true) {
        setState(() { _analysing = false; });
        if (mounted) await _showIdGateSheet();
        return;
      }

      final verified = res['verified'] == true;
      final pts = res['pts_awarded'] is num ? (res['pts_awarded'] as num).toInt() : 0;
      final agg = (res['aggregated'] ?? res['reason'] ?? '').toString();
      final chips = <String>[];
      if (res['insights'] is List) {
        for (final i in (res['insights'] as List)) {
          if (i is Map && i['label'] != null) chips.add('${i['emoji'] ?? '•'} ${i['label']}');
        }
      }
      setState(() {
        _analysing = false;
        _result = _UploadResult(
          verified: verified,
          text: verified
              ? '✓ ${_cfg.title} verified · +$pts trust${agg.isNotEmpty ? '\n$agg' : ''}'
              : 'Couldn\'t verify.${agg.isNotEmpty ? '\n$agg' : ''}',
          chips: chips,
        );
      });
    } catch (e) {
      setState(() {
        _analysing = false;
        _result = _UploadResult(verified: false, text: 'Upload failed: $e', chips: const []);
      });
    }
  }

  // ── Existing proof history ────────────────────────────────────────────────
  Widget _buildHistorySection(ProofItem proof) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0x1A22C55E),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF22C55E), width: 1.5),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Header
        Row(children: [
          const Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '${_cfg.title} verified · +${proof.points} pts',
              style: const TextStyle(
                  color: Color(0xFF22C55E), fontWeight: FontWeight.w700, fontSize: 14),
            ),
          ),
          if (proof.photoCount > 0)
            Text('${proof.photoCount} photo${proof.photoCount == 1 ? '' : 's'}',
                style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
        ]),

        // AI summary
        if (proof.aggregated.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('"${proof.aggregated}"',
              style: const TextStyle(
                  color: Color(Config.text2), fontSize: 13, fontStyle: FontStyle.italic, height: 1.4)),
        ],

        // Insight chips
        if (proof.insights.isNotEmpty) ...[
          const SizedBox(height: 10),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final chip in proof.insights)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                    color: const Color(Config.bg3), borderRadius: BorderRadius.circular(999)),
                child: Text('${chip.emoji} ${chip.label}',
                    style: const TextStyle(color: Color(Config.text1), fontSize: 12)),
              ),
          ]),
        ],

        // Thumbnail photos
        if (proof.thumbnails.isNotEmpty) ...[
          const SizedBox(height: 12),
          SizedBox(
            height: 72,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: proof.thumbnails.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) => ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  proof.thumbnails[i],
                  width: 72, height: 72, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 72, height: 72,
                    color: const Color(Config.bg3),
                    child: const Icon(Icons.image_not_supported_outlined,
                        color: Color(Config.text3), size: 20),
                  ),
                ),
              ),
            ),
          ),
        ],

        const SizedBox(height: 10),
        const Text('Upload more below to strengthen your proof →',
            style: TextStyle(color: Color(Config.text3), fontSize: 11, fontStyle: FontStyle.italic)),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cfg = _cfg;
    if (widget.categoryId == 'intro') return _buildIntroScreen(cfg);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        leading: const BackButton(color: Color(Config.text1)),
        title: Row(children: [
          Text(cfg.icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(cfg.title,
                  style: const TextStyle(
                      color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 16),
                  overflow: TextOverflow.ellipsis),
              Text(cfg.subtitle,
                  style: const TextStyle(color: Color(Config.text2), fontSize: 11),
                  overflow: TextOverflow.ellipsis),
            ]),
          ),
        ]),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // Privacy notice
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0x1A6366F1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0x336366F1)),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('🔒', style: TextStyle(fontSize: 15)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(cfg.privacyCopy,
                    style: const TextStyle(color: Color(0xFF4338CA), fontSize: 13, height: 1.4)),
              ),
            ]),
          ),

          const SizedBox(height: 20),

          // ── Already verified history ─────────────────────────────────────
          if (widget.existingProof != null) ...[
            _buildHistorySection(widget.existingProof!),
            const SizedBox(height: 20),
          ],

          // WHAT WORKS
          if (cfg.examples.isNotEmpty) ...[
            const Text('WHAT WORKS',
                style: TextStyle(
                    color: Color(Config.text2),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6)),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(Config.bg2),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0x181B1020)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final ex in cfg.examples) ...[
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Icon(Icons.check, size: 15, color: Color(Config.accent)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(ex,
                            style: const TextStyle(
                                color: Color(Config.text1), fontSize: 14, height: 1.4)),
                      ),
                    ]),
                    if (ex != cfg.examples.last) const SizedBox(height: 8),
                  ],
                  if (cfg.hintLine.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(cfg.hintLine,
                        style: const TextStyle(
                            color: Color(Config.accent),
                            fontSize: 13,
                            fontStyle: FontStyle.italic,
                            height: 1.4)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // ── Social connect section (LinkedIn / Instagram / Twitter) ──────────
          if (cfg.hasOAuthConnect) ...[
            SizedBox(
              width: double.infinity, height: 52,
              child: FilledButton.icon(
                onPressed: _analysing ? null : () async {
                  final url = Uri.tryParse(cfg.connectUrl ?? '');
                  if (url != null) await launchUrl(url, mode: LaunchMode.externalApplication);
                },
                style: FilledButton.styleFrom(
                  backgroundColor: cfg.connectColor ?? const Color(Config.accent),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.open_in_new, size: 18),
                label: Text(cfg.connectLabel ?? 'Open',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // ── URL input ────────────────────────────────────────────────────────
          if (cfg.hasUrlInput) ...[
            Text(cfg.urlLabel ?? 'Profile URL',
                style: const TextStyle(
                    color: Color(Config.text2),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6)),
            const SizedBox(height: 8),
            TextField(
              controller: _urlController,
              enabled: !_analysing,
              keyboardType: TextInputType.url,
              autocorrect: false,
              style: const TextStyle(color: Color(Config.text1), fontSize: 15),
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: cfg.urlPlaceholder,
                hintStyle: const TextStyle(color: Color(Config.text3)),
                filled: true,
                fillColor: const Color(Config.bg2),
                suffixIcon: _urlController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 18, color: Color(Config.text3)),
                        onPressed: () { _urlController.clear(); setState(() {}); },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0x181B1020)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0x181B1020)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(Config.accent)),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              ),
            ),
            if (_urlController.text.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              // LinkedIn: show extracted username preview card
              if (widget.categoryId == 'linkedin') ...[
                Builder(builder: (_) {
                  final username = _extractLinkedInUsername(_urlController.text.trim());
                  if (username == null) {
                    return const Row(children: [
                      Icon(Icons.check_circle, size: 14, color: Color(Config.accent)),
                      SizedBox(width: 4),
                      Text('URL captured',
                          style: TextStyle(color: Color(Config.accent), fontSize: 12, fontWeight: FontWeight.w600)),
                    ]);
                  }
                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0A66C2).withOpacity(0.07),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF0A66C2).withOpacity(0.2)),
                    ),
                    child: Row(children: [
                      Container(
                        width: 36, height: 36,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0A66C2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Center(child: Text('in',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16))),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('linkedin.com/in/$username',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0A66C2))),
                        const SizedBox(height: 2),
                        const Text('Profile will be read & verified',
                            style: TextStyle(fontSize: 11, color: Color(Config.text2))),
                      ])),
                      const Icon(Icons.check_circle, size: 16, color: Color(0xFF00C853)),
                    ]),
                  );
                }),
              ] else ...[
                const Row(children: [
                  Icon(Icons.check_circle, size: 14, color: Color(Config.accent)),
                  SizedBox(width: 4),
                  Text('URL captured',
                      style: TextStyle(color: Color(Config.accent), fontSize: 12, fontWeight: FontWeight.w600)),
                ]),
              ],
            ],
            const SizedBox(height: 20),
          ],

          // Resume upload — shown only for LinkedIn
          if (widget.categoryId == 'linkedin') ...[
            Text('RESUME / CV',
                style: const TextStyle(
                    color: Color(Config.text2),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6)),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _analysing ? null : _pickResumeImages,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 14),
                decoration: BoxDecoration(
                  color: _resumeImages.isNotEmpty ? const Color(0x08FF3B6B) : const Color(Config.bg2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _resumeImages.isNotEmpty
                        ? const Color(Config.accent).withOpacity(0.4)
                        : const Color(0x221B1020),
                    width: _resumeImages.isNotEmpty ? 1.5 : 1,
                  ),
                ),
                child: _resumeImages.isNotEmpty
                    ? Row(children: [
                        const Icon(Icons.description_outlined, color: Color(Config.accent), size: 22),
                        const SizedBox(width: 10),
                        Expanded(child: Text('${_resumeImages.length} page${_resumeImages.length > 1 ? 's' : ''} uploaded',
                            style: const TextStyle(fontSize: 13, color: Color(Config.text1), fontWeight: FontWeight.w500))),
                        GestureDetector(
                          onTap: () => setState(() => _resumeImages.clear()),
                          child: const Icon(Icons.close, size: 16, color: Color(Config.text3)),
                        ),
                      ])
                    : const Row(children: [
                        Icon(Icons.upload_file_outlined, color: Color(Config.text2), size: 22),
                        SizedBox(width: 10),
                        Expanded(child: Text('Tap to upload resume screenshots',
                            style: TextStyle(fontSize: 13, color: Color(Config.text2)))),
                        Text('Optional', style: TextStyle(fontSize: 11, color: Color(Config.text3))),
                      ]),
              ),
            ),
            const SizedBox(height: 4),
            const Text('Screenshot each page of your CV · Optional but boosts your Career signal',
                style: TextStyle(fontSize: 11, color: Color(Config.text3))),
            const SizedBox(height: 20),
          ],

          // Upload area — hidden for URL-only categories (social: linkedin/instagram/twitter)
          if (!cfg.hasUrlInput) ...[
            if (_files.isEmpty)
              // ── Empty state ──────────────────────────────────────────────────
              GestureDetector(
                onTap: _analysing ? null : _pickPhotos,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 36),
                  decoration: BoxDecoration(
                    color: const Color(Config.bg2),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0x33FF3B6B), width: 1.5),
                  ),
                  child: Column(children: [
                    Container(
                      width: 52, height: 52,
                      decoration: BoxDecoration(
                        color: const Color(Config.bg3),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.add_photo_alternate_outlined,
                          color: Color(Config.text2), size: 28),
                    ),
                    const SizedBox(height: 12),
                    const Text('Tap to select photos',
                        style: TextStyle(
                            color: Color(Config.text2), fontSize: 15, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 4),
                    Text('Up to ${cfg.maxFiles} files · JPEG / PNG / HEIC',
                        style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
                  ]),
                ),
              )
            else
              // ── Photo grid preview ───────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(Config.bg2),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0x4DFF3B6B), width: 1.5),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  // Header row
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8, left: 2),
                    child: Row(children: [
                      Text('${_files.length} photo${_files.length == 1 ? '' : 's'} selected',
                          style: const TextStyle(
                              color: Color(Config.text1),
                              fontWeight: FontWeight.w600,
                              fontSize: 13)),
                      const Spacer(),
                      GestureDetector(
                        onTap: _analysing ? null : () => setState(() => _files.clear()),
                        child: const Text('Clear all',
                            style: TextStyle(
                                color: Color(Config.text3),
                                fontSize: 12,
                                decoration: TextDecoration.underline)),
                      ),
                    ]),
                  ),
                  // Grid
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 3,
                    crossAxisSpacing: 6,
                    mainAxisSpacing: 6,
                    children: [
                      // Thumbnails with remove button
                      for (final f in _files)
                        Stack(children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.file(
                              File(f.path),
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: double.infinity,
                            ),
                          ),
                          if (!_analysing)
                            Positioned(
                              top: 4, right: 4,
                              child: GestureDetector(
                                onTap: () => setState(() => _files.remove(f)),
                                child: Container(
                                  width: 22, height: 22,
                                  decoration: const BoxDecoration(
                                      color: Colors.black54, shape: BoxShape.circle),
                                  child: const Icon(Icons.close,
                                      size: 14, color: Colors.white),
                                ),
                              ),
                            ),
                        ]),
                      // Add-more tile
                      if (_files.length < cfg.maxFiles)
                        GestureDetector(
                          onTap: _analysing ? null : _pickPhotos,
                          child: Container(
                            decoration: BoxDecoration(
                              color: const Color(Config.bg3),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0x33FF3B6B)),
                            ),
                            child: const Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.add, color: Color(Config.text3), size: 28),
                                SizedBox(height: 4),
                                Text('Add more',
                                    style: TextStyle(
                                        color: Color(Config.text3), fontSize: 11)),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ]),
              ),

            const SizedBox(height: 16),
          ],

          // Result banner
          if (_result != null)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _result!.verified ? const Color(0x22FF3B6B) : const Color(0x22F87171),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: _result!.verified
                        ? const Color(Config.accent)
                        : const Color(0xFFF87171)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_result!.text,
                    style: TextStyle(
                        color: _result!.verified
                            ? const Color(Config.accent)
                            : const Color(0xFFF87171),
                        height: 1.4)),
                if (_result!.chips.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final c in _result!.chips)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                            color: const Color(Config.bg3),
                            borderRadius: BorderRadius.circular(999)),
                        child: Text(c,
                            style: const TextStyle(
                                color: Color(Config.text1), fontSize: 12)),
                      ),
                  ]),
                ],
              ]),
            ),

          // Analyse & Verify / Connect & Verify button
          SizedBox(
            width: double.infinity, height: 50,
            child: FilledButton(
              onPressed: _canAnalyse ? _analyse : null,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accent),
                disabledBackgroundColor: const Color(0x33FF3B6B),
                foregroundColor: Colors.white,
                disabledForegroundColor: const Color(0x66FF3B6B),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _analysing
                  ? const Row(mainAxisSize: MainAxisSize.min, children: [
                      SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Color(Config.accent)),
                      ),
                      SizedBox(width: 10),
                      Text('Analysing…', style: TextStyle(fontWeight: FontWeight.w700)),
                    ])
                  : Text(
                      cfg.hasUrlInput && _urlController.text.trim().isNotEmpty && _files.isEmpty
                          ? 'Connect & Verify'
                          : 'Analyse & Verify',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            ),
          ),
        ],
      ),
    );
  }

  // ── Intro-specific screen ─────────────────────────────────────────────────
  Widget _buildIntroScreen(_CatConfig cfg) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        leading: const BackButton(color: Color(Config.text1)),
        title: Row(children: [
          Text(cfg.icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(cfg.title,
                  style: const TextStyle(
                      color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 16),
                  overflow: TextOverflow.ellipsis),
              Text(cfg.subtitle,
                  style: const TextStyle(color: Color(Config.text2), fontSize: 11),
                  overflow: TextOverflow.ellipsis),
            ]),
          ),
        ]),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // Privacy
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0x1A6366F1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0x336366F1)),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('🔒', style: TextStyle(fontSize: 15)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(cfg.privacyCopy,
                    style: const TextStyle(color: Color(0xFF4338CA), fontSize: 13, height: 1.4)),
              ),
            ]),
          ),

          const SizedBox(height: 24),

          // ── Two record tiles ──────────────────────────────────────────────
          Row(children: [
            // Voice tile
            Expanded(
              child: GestureDetector(
                onTap: _isRecordingVoice ? _stopVoice : (_voicePath == null ? _startVoice : null),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
                  decoration: BoxDecoration(
                    color: _isRecordingVoice
                        ? const Color(0x22FF3B6B)
                        : (_voicePath != null ? const Color(0x1A22C55E) : const Color(Config.bg2)),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: _isRecordingVoice
                          ? const Color(Config.accent)
                          : (_voicePath != null ? const Color(0xFF22C55E) : const Color(0x181B1020)),
                      width: 1.5,
                    ),
                  ),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    if (_isRecordingVoice) ...[
                      const SizedBox(
                        width: 24, height: 24,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.5, color: Color(Config.accent)),
                      ),
                      const SizedBox(height: 10),
                      Text(_fmtSec(_voiceSeconds),
                          style: const TextStyle(
                              color: Color(Config.accent),
                              fontWeight: FontWeight.w800,
                              fontSize: 22)),
                      const SizedBox(height: 6),
                      const Text('Tap to stop',
                          style: TextStyle(color: Color(Config.text2), fontSize: 12)),
                    ] else if (_voicePath != null) ...[
                      const Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 32),
                      const SizedBox(height: 8),
                      const Text('Voice recorded',
                          style: TextStyle(
                              color: Color(0xFF22C55E),
                              fontWeight: FontWeight.w700,
                              fontSize: 13)),
                      const SizedBox(height: 4),
                      GestureDetector(
                        onTap: () => setState(() { _voicePath = null; }),
                        child: const Text('Re-record',
                            style: TextStyle(
                                color: Color(Config.text3),
                                fontSize: 11,
                                decoration: TextDecoration.underline)),
                      ),
                    ] else ...[
                      const Text('🎙️', style: TextStyle(fontSize: 36)),
                      const SizedBox(height: 10),
                      const Text('Record Voice',
                          style: TextStyle(
                              color: Color(Config.text1),
                              fontWeight: FontWeight.w700,
                              fontSize: 14)),
                      const SizedBox(height: 4),
                      const Text('30–60 sec',
                          style: TextStyle(color: Color(Config.text3), fontSize: 12)),
                    ],
                  ]),
                ),
              ),
            ),

            const SizedBox(width: 12),

            // Video tile
            Expanded(
              child: GestureDetector(
                onTap: _videoPath == null ? _recordVideo : null,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
                  decoration: BoxDecoration(
                    color: _videoPath != null ? const Color(0x1A22C55E) : const Color(Config.bg2),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: _videoPath != null ? const Color(0xFF22C55E) : const Color(0x181B1020),
                      width: 1.5,
                    ),
                  ),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    if (_videoPath != null) ...[
                      const Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 32),
                      const SizedBox(height: 8),
                      const Text('Video recorded',
                          style: TextStyle(
                              color: Color(0xFF22C55E),
                              fontWeight: FontWeight.w700,
                              fontSize: 13)),
                      const SizedBox(height: 4),
                      GestureDetector(
                        onTap: () => setState(() { _videoPath = null; }),
                        child: const Text('Re-record',
                            style: TextStyle(
                                color: Color(Config.text3),
                                fontSize: 11,
                                decoration: TextDecoration.underline)),
                      ),
                    ] else ...[
                      const Text('🎥', style: TextStyle(fontSize: 36)),
                      const SizedBox(height: 10),
                      const Text('Record Video',
                          style: TextStyle(
                              color: Color(Config.text1),
                              fontWeight: FontWeight.w700,
                              fontSize: 14)),
                      const SizedBox(height: 4),
                      const Text('30–60 sec',
                          style: TextStyle(color: Color(Config.text3), fontSize: 12)),
                    ],
                  ]),
                ),
              ),
            ),
          ]),

          const SizedBox(height: 24),

          // Result banner
          if (_result != null)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _result!.verified ? const Color(0x22FF3B6B) : const Color(0x22F87171),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: _result!.verified
                        ? const Color(Config.accent)
                        : const Color(0xFFF87171)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_result!.text,
                    style: TextStyle(
                        color: _result!.verified
                            ? const Color(Config.accent)
                            : const Color(0xFFF87171),
                        height: 1.4)),
                if (_result!.chips.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final c in _result!.chips)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                            color: const Color(Config.bg3),
                            borderRadius: BorderRadius.circular(999)),
                        child: Text(c,
                            style: const TextStyle(color: Color(Config.text1), fontSize: 12)),
                      ),
                  ]),
                ],
              ]),
            ),

          // Submit Intro button
          SizedBox(
            width: double.infinity, height: 50,
            child: FilledButton(
              onPressed: _canAnalyse ? _analyse : null,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accent),
                disabledBackgroundColor: const Color(0x33FF3B6B),
                foregroundColor: Colors.white,
                disabledForegroundColor: const Color(0x66FF3B6B),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _analysing
                  ? const Row(mainAxisSize: MainAxisSize.min, children: [
                      SizedBox(width: 18, height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Color(Config.accent))),
                      SizedBox(width: 10),
                      Text('Submitting…', style: TextStyle(fontWeight: FontWeight.w700)),
                    ])
                  : const Text('Submit Intro',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            ),
          ),
        ],
      ),
    );
  }
}

class _UploadResult {
  final bool verified;
  final String text;
  final List<String> chips;
  const _UploadResult({required this.verified, required this.text, required this.chips});
}
