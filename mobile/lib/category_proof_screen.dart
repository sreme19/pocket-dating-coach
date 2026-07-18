import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:record/record.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'selfie_camera.dart';

String _friendlyError(Object e) {
  final s = e.toString();
  if (s.contains('DioException') || s.contains('SocketException') ||
      s.contains('connection') || s.contains('network') || s.contains('timeout')) {
    return 'Connection issue. Please check your internet and try again.';
  }
  // Pass through explicit user-facing messages thrown by the API layer
  final msg = s.startsWith('Exception: ') ? s.substring(11) : s;
  if (msg.length < 200 && !msg.contains('Exception') && !msg.contains('Error(')) return msg;
  return 'Something went wrong. Please try again.';
}

// ── Category config ───────────────────────────────────────────────────────────

/// One do/don't tile in the visual "what counts" strip.
///
/// `image` is an example photo; when null the tile falls back to `icon`, so a
/// category can adopt photos one tile at a time.
class _ProofTile {
  final IconData icon;
  final String label;
  final bool counts;
  final String? image;
  const _ProofTile(this.icon, this.label, {this.counts = false, this.image});
}

/// Leaves the ✓ example in full colour.
const _tileNoFilter = ColorFilter.matrix(<double>[
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
]);

/// Luminance weights — drains colour from the ✗ examples so "wrong" reads at a
/// glance rather than depending on the badge.
const _tileDesaturate = ColorFilter.matrix(<double>[
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0,      0,      0,      1, 0,
]);

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

  /// Trust points awarded — shown in the app bar so the reward stays visible
  /// at the moment effort is asked for.
  final int points;

  /// Visual do/don't strip. When non-empty the screen renders the redesigned
  /// layout (upload target first, rule shown as tiles, examples collapsed);
  /// when empty it falls back to the original prose layout.
  final List<_ProofTile> tiles;

  /// The single decision-relevant rule, stated once beneath the tiles.
  final String rule;

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
    this.points = 0,
    this.tiles = const [],
    this.rule = '',
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
      'Travel or dining photos',
      'Events and concerts',
      'Restaurants and bars',
      'Hotels, flights, adventures',
    ],
    hintLine: '',
    points: 8,
    tiles: [
      _ProofTile(Icons.face_retouching_natural_rounded, 'Counts',
          counts: true, image: 'assets/proof/lifestyle_good.webp'),
      _ProofTile(Icons.landscape_outlined, 'No face',
          image: 'assets/proof/lifestyle_no_face.webp'),
      _ProofTile(Icons.phone_android_outlined, 'Screenshot',
          image: 'assets/proof/lifestyle_screenshot.webp'),
    ],
    rule: 'We match each photo to your selfie. No face, no points.',
    maxFiles: 20,
  ),
  'discipline': _CatConfig(
    id: 'discipline',
    icon: '💪',
    title: 'Discipline Proof',
    subtitle: 'Show your consistent habits and routines',
    privacyCopy: 'Private by default. Your proofs strengthen trust, verify authenticity, and help you get better matches.',
    examples: [
      'Gym check-ins and workouts',
      'Sport or training sessions',
      'Morning runs, swims, rides',
      'Practice, class, study sessions',
    ],
    hintLine: '',
    points: 4,
    tiles: [
      _ProofTile(Icons.face_retouching_natural_rounded, 'Counts',
          counts: true, image: 'assets/proof/discipline_good.webp'),
      _ProofTile(Icons.fitness_center_outlined, 'No face',
          image: 'assets/proof/discipline_no_face.webp'),
      _ProofTile(Icons.phone_android_outlined, 'Screenshot',
          image: 'assets/proof/discipline_screenshot.webp'),
    ],
    rule: 'We match each photo to your selfie. No face, no points.',
    maxFiles: 20,
  ),
  'social_proof': _CatConfig(
    id: 'social_proof',
    icon: '🤝',
    title: 'Social Proof',
    subtitle: 'Show your real social life — friends, events, and gatherings you host',
    privacyCopy: 'Nothing here is public. These signals confirm your lifestyle and improve compatibility.',
    examples: [
      'Group photos with friends',
      'Community or club events',
      'Sports teams and activities',
      'Dinners and celebrations',
    ],
    hintLine: '',
    points: 4,
    tiles: [
      _ProofTile(Icons.face_retouching_natural_rounded, 'Counts',
          counts: true, image: 'assets/proof/social_good.webp'),
      _ProofTile(Icons.groups_outlined, 'Face hidden',
          image: 'assets/proof/social_no_face.webp'),
      _ProofTile(Icons.phone_android_outlined, 'Screenshot',
          image: 'assets/proof/social_screenshot.webp'),
    ],
    rule: 'We match each photo to your selfie. In group shots, your face has to be visible.',
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
    subtitle: 'Photos of you at the places you\'ve been',
    privacyCopy: 'Your photos stay private and are never shown on your profile — viewers only ever see the country magnets. Your face must be in the photo: that\'s what makes a magnet impossible to fake.',
    examples: [
      'You in front of a recognisable landmark',
      'You with a street sign, shopfront or menu visible',
      'You holding your boarding pass or passport stamp',
      'Other people in the shot are fine — you just have to be in it too',
    ],
    hintLine: '',
    points: 8,
    tiles: [
      _ProofTile(Icons.emoji_flags_outlined, 'Counts',
          counts: true, image: 'assets/proof/travel_good.webp'),
      _ProofTile(Icons.photo_outlined, 'No face',
          image: 'assets/proof/travel_no_face.webp'),
      _ProofTile(Icons.receipt_long_outlined, 'Booking',
          image: 'assets/proof/travel_booking.webp'),
    ],
    rule: 'We match each photo to your selfie. No face, no points — a booking alone isn\'t you being there.',
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
    privacyCopy: 'Documents are private and never shown to anyone. The AI reads only balance ranges — viewers see the verified result, never your statements or exact figures.',
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
    privacyCopy: 'Documents stay private and are discarded after reading. To verify ownership you must upload a document that shows YOUR NAME — it is matched against your government ID. A photo of the car alone can\'t prove ownership.',
    examples: [
      'Vehicle registration certificate — your name must be visible (PDF or photo)',
      'Car insurance document — name + make/model visible',
      'Property title or deed showing your name (PDF or photo)',
      'Company registration or shareholding document',
      'Optional: a photo of you with the car (supporting only — not required)',
    ],
    hintLine: 'A name-bearing ownership document is required to earn verification points. The car photo is optional.',
    maxFiles: 10,
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
  final List<PlatformFile> _pdfFiles = [];
  bool _analysing = false;
  _UploadResult? _result;
  final List<XFile> _resumeImages = [];

  // ── Verified-proof editing ───────────────────────────────────────────────
  // Local, mutable copies of the existing proof's insight chips and thumbnails
  // so the user can remove bubbles and photos. Edits persist via
  // removeInsightChip() / removeProofThumbnail(); null until a proof is present.
  List<InsightChip>? _insights;
  List<String>? _thumbnails;
  int _photoCount = 0;
  bool _editProof = false;

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
    AppLogger.instance.screen('category_proof');
    AppLogger.instance.action('category_proof', 'select_category');
    if (widget.categoryId == 'intro') {
      _audioRec = AudioRecorder();
    }
    final existing = widget.existingProof;
    if (existing != null) {
      if (existing.insights.isNotEmpty) _insights = List<InsightChip>.of(existing.insights);
      if (existing.thumbnails.isNotEmpty) _thumbnails = List<String>.of(existing.thumbnails);
      _photoCount = existing.photoCount;
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
    final picked = await _picker.pickMultiImage(maxWidth: 1200, imageQuality: 72);
    if (picked.isEmpty) return;
    final combined = [..._files, ...picked];
    setState(() {
      _files
        ..clear()
        ..addAll(combined.take(_cfg.maxFiles));
    });
  }

  Future<void> _pickFromCamera() async {
    if (_analysing) return;
    if (_files.length >= _cfg.maxFiles) return;
    final shot = await _picker.pickImage(source: ImageSource.camera, maxWidth: 1200, imageQuality: 72);
    if (shot == null) return;
    setState(() => _files.add(shot));
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
    if (_result?.verified == true) return false;
    if (widget.categoryId == 'intro') return _voicePath != null || _videoPath != null;
    if (_files.isNotEmpty) return true;
    if (_pdfFiles.isNotEmpty) return true;
    if (_resumeImages.isNotEmpty) return true;
    if (_cfg.hasUrlInput && _urlController.text.trim().isNotEmpty) return true;
    return false;
  }

  Future<void> _pickPdf() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
      allowMultiple: true,
    );
    if (result == null || !mounted) return;
    setState(() {
      for (final f in result.files) {
        if (f.path != null && !_pdfFiles.any((p) => p.path == f.path)) {
          _pdfFiles.add(f);
        }
      }
    });
  }

  // ── 2-step ID gate: (1) upload government ID → extract name, (2) selfie → face match ──
  /// Relationship picker for an asset whose registered name isn\'t the user\'s.
  /// On selection, closes and retries the upload at the reduced "linked" tier.
  Future<void> _showRelationshipSheet({required String ownerName, required String reason}) async {
    Widget option(String emoji, String title, String desc, String value) => InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () {
        Navigator.of(context).pop();
        _analyse(relationship: value);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0x181B1020)),
        ),
        child: Row(children: [
          Text(emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(Config.text1))),
            const SizedBox(height: 2),
            Text(desc, style: const TextStyle(fontSize: 12, color: Color(Config.text2), height: 1.4)),
          ])),
        ]),
      ),
    );

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(Config.bg1),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(16, 20, 16, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('🚗  Whose name is on this document?',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(Config.text1))),
          const SizedBox(height: 8),
          Text(
            'The registered name${ownerName.isNotEmpty ? ' ("$ownerName")' : ''} doesn\'t match your verified ID. '
            'Tell us how this asset is connected to you — assets not in your own name are verified at reduced trust and flagged for review.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: Color(Config.text2), height: 1.5),
          ),
          const SizedBox(height: 16),
          option('🏢', 'My company owns it', 'Registered to a business I run or represent', 'company'),
          option('👪', 'A family member', 'Registered to a parent, spouse, or household member', 'family'),
          option('🏦', 'Financed or leased', 'Held by a bank or leasing company', 'financed'),
          option('↩️', 'Something else', 'Another legitimate connection', 'other'),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('This isn\'t my asset — cancel',
              style: TextStyle(fontSize: 12.5, color: Color(Config.text3), fontWeight: FontWeight.w600)),
          ),
        ]),
      ),
    );
  }

  Future<void> _showIdGateSheet() async {
    // Shared state
    int step = 1; // 1 = upload ID, 2 = take selfie
    XFile? idPicked;
    XFile? selfiePicked;
    bool busy = false;
    String? error;
    String? detectedName;
    String? idBase64;
    String? idMime;

    final faceMatched = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setS) {

        // ── Step 1 content ──
        Widget stepOneBody() => Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('🪪  Government ID', style: TextStyle(
            fontSize: 18, fontWeight: FontWeight.w800, color: Color(Config.text1))),
          const SizedBox(height: 8),
          const Text(
            'Upload a photo of your government ID or passport.\nYour name and face will be matched.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: Color(Config.text2), height: 1.5),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0x1AFBBF24), borderRadius: BorderRadius.circular(10)),
            child: const Text(
              '• Real ID card or passport (not a screenshot)\n• All text clearly readable\n• Good lighting, no blur or glare',
              style: TextStyle(fontSize: 12, color: Color(Config.text2), height: 1.5),
            ),
          ),
          const SizedBox(height: 16),
          if (idPicked == null)
            SizedBox(width: double.infinity, child: OutlinedButton.icon(
              onPressed: () async {
                final img = await ImagePicker().pickImage(
                  source: ImageSource.gallery,
                  imageQuality: 75,  // compress: full-res HEIC/JPEG can be 5MB+
                  maxWidth: 1600,
                );
                if (img != null) setS(() { idPicked = img; error = null; });
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
                child: Image.file(File(idPicked!.path), width: 72, height: 72, fit: BoxFit.cover),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(idPicked!.name,
                style: const TextStyle(fontSize: 13, color: Color(Config.text2)),
                maxLines: 2, overflow: TextOverflow.ellipsis)),
              TextButton(
                onPressed: () => setS(() { idPicked = null; error = null; }),
                child: const Text('Change'),
              ),
            ]),
          if (error != null) ...[
            const SizedBox(height: 10),
            Text(error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
          ],
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: FilledButton(
            onPressed: (idPicked == null || busy) ? null : () async {
              setS(() { busy = true; error = null; });
              try {
                final result = await verifyIdExtract(idPicked!.path);
                idBase64 = result['idBase64'] as String?;
                idMime = result['idMime'] as String?;
                final name = result['idName']?.toString();
                // The server matches the ID photo against the stored
                // verification selfie (the single reference face). A match
                // means identity is already proven — no second selfie needed.
                final faceMatch = result['faceMatch'] as bool?;
                if (faceMatch == true) {
                  if (ctx.mounted) Navigator.of(ctx).pop(true);
                  return;
                }
                if (faceMatch == false) {
                  setS(() {
                    busy = false;
                    idPicked = null;
                    error = 'The face on this ID doesn\'t match your verified selfie. Retake the ID photo in good lighting, without glare.';
                  });
                  return;
                }
                // No reference selfie on file yet — capture one now (step 2).
                // It becomes the single stored reference for all face checks.
                setS(() { busy = false; detectedName = name; step = 2; });
              } catch (e) {
                AppLogger.instance.error(e, screen: 'category_proof', action: 'process_id_front');
                setS(() { busy = false; error = e.toString().replaceFirst('Exception: ', ''); });
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(Config.accent),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Continue', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          )),
        ]);

        // ── Step 2 content ──
        Widget stepTwoBody() => Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('🤳  Face match', style: TextStyle(
            fontSize: 18, fontWeight: FontWeight.w800, color: Color(Config.text1))),
          const SizedBox(height: 8),
          if (detectedName != null && detectedName!.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0x1A22C55E),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0x6622C55E)),
              ),
              child: Row(children: [
                const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF22C55E), size: 16),
                const SizedBox(width: 8),
                Expanded(child: Text(
                  'Name detected: $detectedName',
                  style: const TextStyle(fontSize: 13, color: Color(0xFF22C55E), fontWeight: FontWeight.w600),
                )),
              ]),
            ),
            const SizedBox(height: 10),
          ],
          const Text(
            'Now take a quick selfie so we can confirm the face on your ID matches you.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: Color(Config.text2), height: 1.5),
          ),
          const SizedBox(height: 16),
          if (selfiePicked == null)
            SizedBox(width: double.infinity, child: OutlinedButton.icon(
              onPressed: () async {
                // Use the custom front-camera screen — image_picker can't force
                // the front lens on Android (preferredCameraDevice is ignored).
                // Gallery is intentionally not offered: a live selfie is required
                // so users cannot bypass face-match with someone else's photo.
                final path = await Navigator.of(ctx).push<String>(
                  MaterialPageRoute(builder: (_) => const SelfieCameraScreen()),
                );
                if (path != null) setS(() { selfiePicked = XFile(path); error = null; });
              },
              icon: const Icon(Icons.camera_front_rounded),
              label: const Text('Take selfie'),
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
                child: Image.file(File(selfiePicked!.path), width: 72, height: 72, fit: BoxFit.cover),
              ),
              const SizedBox(width: 12),
              const Expanded(child: Text('Selfie ready',
                  style: TextStyle(fontSize: 13, color: Color(Config.text2)))),
              TextButton(
                onPressed: () => setS(() { selfiePicked = null; error = null; }),
                child: const Text('Retake'),
              ),
            ]),
          if (error != null) ...[
            const SizedBox(height: 10),
            Text(error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
          ],
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: FilledButton(
            onPressed: (selfiePicked == null || busy || idBase64 == null) ? null : () async {
              setS(() { busy = true; error = null; });
              try {
                final matched = await verifySelfieVsId(selfiePicked!.path, idBase64!, idMime ?? 'image/jpeg');
                if (matched) {
                  if (ctx.mounted) Navigator.of(ctx).pop(true);
                } else {
                  setS(() { busy = false; error = 'Face does not match the ID. Please retake your selfie in good lighting.'; });
                }
              } catch (e) {
                AppLogger.instance.error(e, screen: 'category_proof', action: 'process_selfie');
                setS(() { busy = false; error = e.toString().replaceFirst('Exception: ', ''); });
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(Config.accent),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Match face', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          )),
          TextButton(
            onPressed: busy ? null : () => setS(() { step = 1; idPicked = null; idBase64 = null; error = null; }),
            child: const Text('← Back', style: TextStyle(color: Color(Config.text3), fontSize: 13)),
          ),
        ]);

        return Container(
          padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(ctx).padding.bottom + 24),
          decoration: const BoxDecoration(
            color: Color(Config.bg2),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(
                color: const Color(Config.text3), borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 20),
              // Step indicator
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                _StepDot(active: step == 1, done: step > 1, label: '1'),
                Container(width: 24, height: 2, color: step > 1 ? const Color(Config.accent) : const Color(Config.text3)),
                _StepDot(active: step == 2, done: false, label: '2'),
              ]),
              const SizedBox(height: 20),
              step == 1 ? stepOneBody() : stepTwoBody(),
            ]),
          ),
        );
      }),
    );

    // Only retry if face match was explicitly completed (pop(true)).
    // If the user dismissed the sheet without completing face match, faceMatched
    // is null — do NOT proceed, otherwise proof gets verified without ID check.
    if (mounted && faceMatched == true) _analyse();
  }

  Future<void> _analyse({String? relationship}) async {
    if (!_canAnalyse) return;
    AppLogger.instance.action('category_proof', 'submit_proof');
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
          res = await uploadProof(widget.categoryId, paths, relationship: relationship);
        } else if (url.isNotEmpty && _files.isEmpty && _pdfFiles.isEmpty) {
          res = await uploadProofUrl(widget.categoryId, url);
        } else {
          final paths = [
            ..._files.map((f) => f.path),
            ..._pdfFiles.map((p) => p.path!).where((p) => p.isNotEmpty),
          ];
          res = await uploadProof(widget.categoryId, paths, relationship: relationship);
        }
      }
      // Gated categories (spending/wealth/assets) require ID verification first
      if (res['requiresIdVerification'] == true) {
        setState(() { _analysing = false; });
        if (mounted) await _showIdGateSheet();
        return;
      }

      // Asset ownership doc name didn't match the verified ID — ask the owner to
      // declare the relationship (company / family / financed), then retry at the
      // reduced "linked" trust tier.
      if (res['requiresRelationship'] == true) {
        setState(() { _analysing = false; });
        if (mounted) {
          await _showRelationshipSheet(
            ownerName: (res['ownerName'] ?? '').toString(),
            reason: (res['reason'] ?? '').toString(),
          );
        }
        return;
      }

      // No readable owner name (e.g. a car photo, not an ownership document) —
      // require an explicit name-bearing document before ownership can verify.
      if (res['requiresOwnershipDoc'] == true) {
        final msg = (res['reason'] ?? '').toString().trim();
        setState(() {
          _analysing = false;
          _result = _UploadResult(
            verified: false,
            text: msg.isNotEmpty
                ? msg
                : 'Add an ownership document — registration, insurance, title, or deed — that clearly shows your name.',
            chips: const [],
          );
        });
        return;
      }

      final verified = res['verified'] == true;
      final pts = res['pts_awarded'] is num ? (res['pts_awarded'] as num).toInt() : 0;
      // Prefer the aggregated one-liner, but fall back to `reason` when it's
      // blank. `??` only fires on null, and the backend always sends
      // `aggregated` as a (often empty) string — so on a rejection the reason
      // would otherwise be swallowed, leaving a bare "Couldn't verify."
      final aggRaw = (res['aggregated'] ?? '').toString().trim();
      final agg = aggRaw.isNotEmpty ? aggRaw : (res['reason'] ?? '').toString().trim();
      final nameMismatch = res['nameMatch'] == false;
      // Garage ownership tier: anything other than 'self' earned reduced trust.
      final ownershipTier = res['ownershipTier']?.toString();
      final ownershipReduced = ownershipTier != null && ownershipTier != 'self';
      final ownershipReason = (res['ownershipReason'] ?? '').toString().trim();
      final ownerName = (res['ownerName'] ?? '').toString().trim();
      final chips = <String>[];
      if (res['insights'] is List) {
        for (final i in (res['insights'] as List)) {
          if (i is Map && i['label'] != null) chips.add('${i['emoji'] ?? '•'} ${i['label']}');
        }
      }
      final baseText = verified
          ? '✓ ${_cfg.title} verified · +$pts trust${agg.isNotEmpty ? '\n$agg' : ''}'
          : 'Couldn\'t verify.${agg.isNotEmpty ? '\n$agg' : ''}';
      // Face-gated categories: photos where the user's face wasn't found are
      // skipped by the server — tell the user which ones didn't count.
      String faceNote = '';
      final faceCheck = res['faceCheck'];
      if (verified && faceCheck is Map && faceCheck['unmatchedPhotos'] is List) {
        final skipped = (faceCheck['unmatchedPhotos'] as List).whereType<num>().map((n) => n.toInt()).toList();
        if (skipped.isNotEmpty) {
          faceNote = '\n\n⚠️ Photo${skipped.length > 1 ? 's' : ''} ${skipped.join(', ')} '
              'didn\'t clearly show your face and ${skipped.length > 1 ? 'were' : 'was'} not counted.';
        }
      }
      final ownershipNote = ownershipReduced
          ? '\n\n⚠️ ${ownershipReason.isNotEmpty ? ownershipReason : 'Ownership is linked, not personal — verified at reduced trust and flagged for review.'}'
          : ownershipTier == 'self'
              ? '\n\n✅ Ownership confirmed — the name on the document${ownerName.isNotEmpty ? ' ($ownerName)' : ''} matches your verified ID.'
              : (nameMismatch
                  ? '\n\n⚠️ The name on this document doesn\'t match your verified ID, so it\'s flagged for review. Upload documents in your own name to earn full trust.'
                  : '');
      setState(() {
        _analysing = false;
        _result = _UploadResult(
          verified: verified,
          text: '$baseText$faceNote$ownershipNote',
          chips: chips,
        );
      });
    } catch (e) {
      AppLogger.instance.error(e, screen: 'category_proof', action: 'analyze_proof');
      setState(() {
        _analysing = false;
        _result = _UploadResult(verified: false, text: _friendlyError(e), chips: const []);
      });
    }
  }

  bool get _hasEditable =>
      (_insights?.isNotEmpty ?? false) || (_thumbnails?.isNotEmpty ?? false);

  // ── Remove a verified-signal bubble (optimistic + persist) ────────────────
  Future<void> _removeInsight(String category, InsightChip chip) async {
    final list = _insights;
    if (list == null) return;
    final idx = list.indexOf(chip);
    if (idx < 0) return;
    setState(() {
      list.removeAt(idx);
      if (!_hasEditable) _editProof = false;
    });
    try {
      await removeInsightChip(category, chip.label);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'category_proof', action: 'remove_chip');
      if (!mounted) return;
      setState(() => list.insert(idx.clamp(0, list.length), chip));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendlyError(e))),
      );
    }
  }

  // ── Remove a thumbnail image (optimistic + persist) ───────────────────────
  Future<void> _removeThumbnail(String category, String url) async {
    final list = _thumbnails;
    if (list == null) return;
    final idx = list.indexOf(url);
    if (idx < 0) return;
    setState(() {
      list.removeAt(idx);
      if (_photoCount > 0) _photoCount--;
      if (!_hasEditable) _editProof = false;
    });
    try {
      await removeProofThumbnail(category, url);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'category_proof', action: 'remove_thumbnail');
      if (!mounted) return;
      setState(() {
        list.insert(idx.clamp(0, list.length), url);
        _photoCount++;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendlyError(e))),
      );
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
          if (_photoCount > 0)
            Text('$_photoCount photo${_photoCount == 1 ? '' : 's'}',
                style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
          // Pencil → toggle remove-mode for the signal bubbles + photos below
          if (_hasEditable) ...[
            const SizedBox(width: 4),
            GestureDetector(
              onTap: () => setState(() => _editProof = !_editProof),
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Icon(
                  _editProof ? Icons.check_rounded : Icons.edit_outlined,
                  size: 18,
                  color: _editProof
                      ? const Color(0xFF22C55E)
                      : const Color(Config.text2),
                ),
              ),
            ),
          ],
        ]),

        // AI summary
        if (proof.aggregated.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('"${proof.aggregated}"',
              style: const TextStyle(
                  color: Color(Config.text2), fontSize: 13, fontStyle: FontStyle.italic, height: 1.4)),
        ],

        // Insight chips
        if ((_insights ?? proof.insights).isNotEmpty) ...[
          const SizedBox(height: 10),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final chip in (_insights ?? proof.insights))
              GestureDetector(
                onTap: _editProof ? () => _removeInsight(proof.category, chip) : null,
                child: Container(
                  padding: EdgeInsets.only(
                      left: 10, right: _editProof ? 6 : 10, top: 5, bottom: 5),
                  decoration: BoxDecoration(
                    color: const Color(Config.bg3),
                    borderRadius: BorderRadius.circular(999),
                    border: _editProof
                        ? Border.all(color: const Color(0x66F87171))
                        : null,
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text('${chip.emoji} ${chip.label}',
                        style: const TextStyle(color: Color(Config.text1), fontSize: 12)),
                    if (_editProof) ...[
                      const SizedBox(width: 5),
                      const Icon(Icons.close_rounded, size: 14, color: Color(0xFFF87171)),
                    ],
                  ]),
                ),
              ),
          ]),
        ],

        // Thumbnail photos
        if ((_thumbnails ?? proof.thumbnails).isNotEmpty) ...[
          const SizedBox(height: 12),
          Builder(builder: (_) {
            final thumbs = _thumbnails ?? proof.thumbnails;
            return SizedBox(
              height: 72,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: thumbs.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (_, i) {
                  final url = thumbs[i];
                  return Stack(children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        url,
                        width: 72, height: 72, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 72, height: 72,
                          color: const Color(Config.bg3),
                          child: const Icon(Icons.image_not_supported_outlined,
                              color: Color(Config.text3), size: 20),
                        ),
                      ),
                    ),
                    if (_editProof)
                      Positioned(
                        top: 4, right: 4,
                        child: GestureDetector(
                          onTap: () => _removeThumbnail(proof.category, url),
                          child: Container(
                            width: 22, height: 22,
                            decoration: const BoxDecoration(
                                color: Colors.black54, shape: BoxShape.circle),
                            child: const Icon(Icons.close, size: 14, color: Colors.white),
                          ),
                        ),
                      ),
                  ]);
                },
              ),
            );
          }),
        ],

        const SizedBox(height: 10),
        Text(
            _editProof
                ? 'Tap a signal or photo to remove it · tap ✓ when done'
                : 'Upload more below to strengthen your proof →',
            style: const TextStyle(
                color: Color(Config.text3), fontSize: 11, fontStyle: FontStyle.italic)),
      ]),
    );
  }

  // ── Redesigned layout pieces (categories that define `tiles`) ─────────────

  /// Primary upload target — accent-filled so it reads as the action, with
  /// camera and gallery side by side.
  Widget _buildDropzone(_CatConfig cfg) => Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
        decoration: BoxDecoration(
          color: const Color(0x14FF3B6B),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x66FF3B6B), width: 1.5),
        ),
        child: Column(children: [
          Container(
            width: 52, height: 52,
            decoration: BoxDecoration(
              color: const Color(Config.accent),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.add_photo_alternate_rounded, color: Colors.white, size: 27),
          ),
          const SizedBox(height: 12),
          const Text('Add your photos',
              style: TextStyle(color: Color(Config.text1), fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text('Up to ${cfg.maxFiles} · your face in each',
              style: const TextStyle(color: Color(Config.text2), fontSize: 12)),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: _sourceButton(Icons.photo_camera_rounded, 'Camera', _pickFromCamera)),
            const SizedBox(width: 10),
            Expanded(child: _sourceButton(Icons.photo_library_rounded, 'Gallery', _pickPhotos)),
          ]),
        ]),
      );

  Widget _sourceButton(IconData icon, String label, VoidCallback onTap) => SizedBox(
        height: 44,
        child: OutlinedButton.icon(
          onPressed: _analysing ? null : onTap,
          icon: Icon(icon, size: 18),
          label: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(Config.accent),
            backgroundColor: const Color(Config.bg2),
            side: const BorderSide(color: Color(0x4DFF3B6B)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      );

  /// Visual do/don't strip — teaches the rule faster than the prose it replaces.
  Widget _buildTileStrip(_CatConfig cfg) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final t in cfg.tiles) ...[
            Expanded(child: _proofTile(t)),
            if (t != cfg.tiles.last) const SizedBox(width: 8),
          ],
        ],
      );

  Widget _proofTile(_ProofTile t) {
    const good = Color(0xFF22C55E);
    final tint = t.counts ? const Color(0x1A22C55E) : const Color(Config.bg2);
    final line = t.counts ? const Color(0x6622C55E) : const Color(0x181B1020);
    final fg = t.counts ? good : const Color(Config.text3);
    return Column(children: [
      AspectRatio(
        aspectRatio: 1,
        child: Stack(clipBehavior: Clip.none, fit: StackFit.expand, children: [
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: tint,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: line),
            ),
            child: t.image == null
                ? Icon(t.icon, size: 30, color: fg)
                : ColorFiltered(
                    colorFilter: t.counts ? _tileNoFilter : _tileDesaturate,
                    child: Image.asset(
                      t.image!,
                      fit: BoxFit.cover,
                      // Tiles render ~113dp wide; decode to match rather than
                      // holding a full-size bitmap per example.
                      cacheWidth: 360,
                      // A missing example degrades to the icon rather than
                      // breaking the screen.
                      errorBuilder: (_, _, _) => Icon(t.icon, size: 30, color: fg),
                    ),
                  ),
          ),
          Positioned(
            bottom: -5, right: -5,
            child: Container(
              width: 20, height: 20,
              decoration: BoxDecoration(
                color: t.counts ? good : const Color(Config.bg3),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(Config.bg1), width: 1.5),
              ),
              child: Icon(t.counts ? Icons.check_rounded : Icons.close_rounded,
                  size: 12, color: t.counts ? Colors.white : const Color(Config.text3)),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 8),
      Text(t.label,
          textAlign: TextAlign.center,
          style: TextStyle(
              color: fg, fontSize: 11, fontWeight: t.counts ? FontWeight.w700 : FontWeight.w400)),
    ]);
  }

  /// Privacy demoted to a footer that expands on tap.
  Widget _buildPrivacyFooter(_CatConfig cfg) => Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(bottom: 12),
          leading: const Icon(Icons.lock_outline_rounded, size: 15, color: Color(Config.text3)),
          title: const Text('Private — only AI highlights show',
              style: TextStyle(color: Color(Config.text3), fontSize: 12)),
          iconColor: const Color(Config.text3),
          collapsedIconColor: const Color(Config.text3),
          children: [
            Text(cfg.privacyCopy,
                style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4)),
          ],
        ),
      );

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
              if (cfg.tiles.isEmpty)
                Text(cfg.subtitle,
                    style: const TextStyle(color: Color(Config.text2), fontSize: 11),
                    overflow: TextOverflow.ellipsis),
            ]),
          ),
        ]),
        actions: [
          if (cfg.points > 0)
            Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0x22FF3B6B),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('+${cfg.points} pts',
                  style: const TextStyle(
                      color: Color(Config.accent), fontWeight: FontWeight.w700, fontSize: 13)),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // Privacy notice — demoted to a footer in the redesigned layout.
          if (cfg.tiles.isEmpty) ...[
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
          ],

          // ── Already verified history ─────────────────────────────────────
          if (widget.existingProof != null) ...[
            _buildHistorySection(widget.existingProof!),
            const SizedBox(height: 20),
          ],

          // WHAT WORKS — prose layout only; `tiles` categories show the strip
          // below the upload target instead.
          if (cfg.tiles.isEmpty && cfg.examples.isNotEmpty) ...[
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
              if (cfg.tiles.isNotEmpty)
                _buildDropzone(cfg)
              else
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

            // ── Visual do/don't strip + the one rule ─────────────────────────
            if (cfg.tiles.isNotEmpty) ...[
              const SizedBox(height: 16),
              _buildTileStrip(cfg),
              if (cfg.rule.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(cfg.rule,
                    style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4)),
              ],
              if (cfg.examples.isNotEmpty)
                Theme(
                  data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: const EdgeInsets.only(bottom: 8),
                    title: const Text('More examples',
                        style: TextStyle(
                            color: Color(Config.text2), fontSize: 13, fontWeight: FontWeight.w600)),
                    iconColor: const Color(Config.text2),
                    collapsedIconColor: const Color(Config.text2),
                    children: [
                      for (final ex in cfg.examples)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Icon(Icons.check, size: 15, color: Color(Config.accent)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(ex,
                                  style: const TextStyle(
                                      color: Color(Config.text1), fontSize: 14, height: 1.4)),
                            ),
                          ]),
                        ),
                    ],
                  ),
                ),
            ],

            const SizedBox(height: 16),
          ],

          // PDF picker — shown for assets category
          if (widget.categoryId == 'assets') ...[
            const Text('DOCUMENTS (PDF)',
                style: TextStyle(color: Color(Config.text2), fontSize: 12,
                    fontWeight: FontWeight.w700, letterSpacing: 0.6)),
            const SizedBox(height: 8),
            if (_pdfFiles.isEmpty)
              GestureDetector(
                onTap: _analysing ? null : _pickPdf,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  decoration: BoxDecoration(
                    color: const Color(Config.bg2),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0x33FF3B6B), width: 1.5),
                  ),
                  child: const Column(children: [
                    Icon(Icons.picture_as_pdf_outlined, color: Color(Config.text2), size: 28),
                    SizedBox(height: 8),
                    Text('Tap to add PDF documents',
                        style: TextStyle(color: Color(Config.text2), fontSize: 14,
                            fontWeight: FontWeight.w500)),
                    SizedBox(height: 4),
                    Text('RC, insurance, property deed, company docs',
                        style: TextStyle(color: Color(Config.text3), fontSize: 12)),
                  ]),
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(Config.bg2),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0x4DFF3B6B), width: 1.5),
                ),
                child: Column(children: [
                  for (final pdf in _pdfFiles)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(children: [
                        const Icon(Icons.picture_as_pdf_outlined,
                            color: Color(Config.accent), size: 20),
                        const SizedBox(width: 10),
                        Expanded(child: Text(pdf.name,
                            style: const TextStyle(color: Color(Config.text1), fontSize: 13),
                            overflow: TextOverflow.ellipsis)),
                        if (!_analysing)
                          GestureDetector(
                            onTap: () => setState(() => _pdfFiles.remove(pdf)),
                            child: const Icon(Icons.close,
                                color: Color(Config.text3), size: 18),
                          ),
                      ]),
                    ),
                  GestureDetector(
                    onTap: _analysing ? null : _pickPdf,
                    child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.add, color: Color(Config.accent), size: 16),
                      SizedBox(width: 4),
                      Text('Add more PDFs',
                          style: TextStyle(color: Color(Config.accent), fontSize: 13,
                              fontWeight: FontWeight.w600)),
                    ]),
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
                  : _result?.verified == true
                      ? const Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.check_circle_rounded, size: 18),
                          SizedBox(width: 8),
                          Text('Added to your profile', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        ])
                      : Text(
                          cfg.hasUrlInput && _urlController.text.trim().isNotEmpty && _files.isEmpty
                              ? 'Connect & Verify'
                              : 'Analyse & Verify',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            ),
          ),

          if (cfg.tiles.isNotEmpty) _buildPrivacyFooter(cfg),
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
                  : _result?.verified == true
                      ? const Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.check_circle_rounded, size: 18),
                          SizedBox(width: 8),
                          Text('Added to your profile', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
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

class _StepDot extends StatelessWidget {
  final bool active;
  final bool done;
  final String label;
  const _StepDot({required this.active, required this.done, required this.label});

  @override
  Widget build(BuildContext context) {
    final filled = active || done;
    return Container(
      width: 28, height: 28,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: filled ? const Color(Config.accent) : const Color(Config.bg3),
        border: Border.all(
          color: filled ? const Color(Config.accent) : const Color(Config.text3),
        ),
      ),
      child: Center(
        child: done
            ? const Icon(Icons.check_rounded, color: Colors.white, size: 14)
            : Text(label, style: TextStyle(
                fontSize: 12, fontWeight: FontWeight.w700,
                color: active ? Colors.white : const Color(Config.text3),
              )),
      ),
    );
  }
}
