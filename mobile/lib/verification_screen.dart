import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'onboarding_questions.dart';
import 'onboarding_qa_step.dart';

String _friendlyError(Object e) {
  if (e is DioException) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return 'Connection timed out. Please check your internet and try again.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Connection issue. Please check your internet and try again.';
    }
    // Extract server error message (e.g. "Photos are not consistent...")
    final body = e.response?.data;
    if (body is Map) {
      final msg = body['error'] ?? body['message'];
      if (msg is String && msg.isNotEmpty) return msg;
    }
    return 'Something went wrong. Please try again.';
  }
  final s = e.toString();
  if (s.contains('SocketException') || s.contains('connection') ||
      s.contains('network') || s.contains('timeout')) {
    return 'Connection issue. Please check your internet and try again.';
  }
  if (s.contains('Not authenticated') || s.contains('Bad state')) {
    return 'Session expired. Please restart the app and try again.';
  }
  return 'Something went wrong. Please try again.';
}

class _Testimonial {
  final String photoPath;
  final String quoteBefore;
  final String highlight;
  final String quoteAfter;
  final String name;
  final int age;
  final String profession;
  const _Testimonial({
    required this.photoPath,
    required this.quoteBefore,
    required this.highlight,
    required this.quoteAfter,
    required this.name,
    required this.age,
    required this.profession,
  });
}

// ── Testimonials (one per step) ───────────────────────────────────────────────

const _testimonials = <_Testimonial>[
  // Step 0 — identity
  _Testimonial(
    photoPath: '/female_profiles/priya_High_Value_Feminist_f2k7zt/photos/Priya_2.jpg',
    quoteBefore: '"I still want the fairytale — but with someone ',
    highlight: 'serious enough to prove it',
    quoteAfter: '. That\'s all verification is."',
    name: 'Priya', age: 30, profession: 'UX Researcher',
  ),
  // Step 1 — drawn to
  _Testimonial(
    photoPath: '/female_profiles/anjali_Traditional_Family_First_g3s7mn/photos/Anjali_1.jpg',
    quoteBefore: '"The men who take this seriously aren\'t just filling in forms. They\'re already ',
    highlight: 'showing me who they are',
    quoteAfter: '. That matters."',
    name: 'Anjali', age: 25, profession: 'Pharmacist',
  ),
  // Step 2 — lifestyle
  _Testimonial(
    photoPath: '/female_profiles/anjali_Traditional_Family_First_g3s7mn/photos/Anjali_1.jpg',
    quoteBefore: '"A man who knows what he\'s looking for isn\'t intimidating. ',
    highlight: 'He\'s a relief',
    quoteAfter: '."',
    name: 'Anjali', age: 25, profession: 'Pharmacist',
  ),
  // Step 3 — photos
  _Testimonial(
    photoPath: '/female_profiles/anjali_Traditional_Family_First_g3s7mn/photos/Anjali_1.jpg',
    quoteBefore: '"I want to see your world a little. A man who\'s ',
    highlight: 'generous with his attention, effort, and presence',
    quoteAfter: ' stands out for me."',
    name: 'Anjali', age: 25, profession: 'Pharmacist',
  ),
];

// ── Main widget ───────────────────────────────────────────────────────────────

/// Staged, one-step-at-a-time verification flow (mirrors the web high-intent
/// flow). Steps: 0 Identity → 1 What you're drawn to → 2 Background & lifestyle
/// → 3 Photos & place. Each step submits to /api/verified-vibe/verify-step.
class VerificationScreen extends StatefulWidget {
  final VoidCallback onDone;
  final VoidCallback? onBack; // called when back is pressed on step 0
  final String? archetypeId;  // determines which question set to show
  final int initialStep;
  /// Steps to skip because they're already completed (0=liveness, 1=qa1, 2=qa2, 3=photos)
  final Set<int> skipSteps;
  const VerificationScreen({super.key, required this.onDone, this.onBack, this.archetypeId, this.initialStep = 0, this.skipSteps = const {}});

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  final _picker = ImagePicker();
  late int _step;
  bool _busy = false;
  String? _error;

  /// Find the next step that isn't already skipped
  int _nextStep(int from) {
    int next = from + 1;
    while (next <= 3 && widget.skipSteps.contains(next)) next++;
    return next;
  }

  /// Find the previous step that isn't already skipped (-1 means no previous step)
  int _prevStep(int from) {
    int prev = from - 1;
    while (prev >= 0 && widget.skipSteps.contains(prev)) prev--;
    return prev;
  }

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('verification');
    _step = widget.initialStep;
    _photos = List<String?>.filled(_isWoman ? 6 : 3, null);
    _preloadUserData();
  }

  Future<void> _preloadUserData() async {
    try {
      final uid = Supabase.instance.client.auth.currentUser?.id;
      if (uid == null) return;

      // Fetch user info + all verification rows in parallel
      final userRowFuture = Supabase.instance.client
          .from('verified_vibe_users')
          .select('first_name, age, city')
          .eq('id', uid)
          .maybeSingle();
      final verifyRowsFuture = Supabase.instance.client
          .from('verified_vibe_verification')
          .select('step, data')
          .eq('user_id', uid);
      final parallel = await Future.wait<dynamic>([userRowFuture, verifyRowsFuture]);
      if (!mounted) return;

      // ── Step 3: name / age / city ─────────────────────────────────────────
      final userRow = parallel[0] as Map?;
      if (userRow != null) {
        final existingName = (userRow['first_name'] ?? '').toString();
        if (existingName.isNotEmpty && existingName != 'New member' && _nameCtrl.text.isEmpty)
          _nameCtrl.text = existingName;
        if (userRow['age'] != null && _ageCtrl.text.isEmpty)
          _ageCtrl.text = userRow['age'].toString();
        if ((userRow['city'] ?? '').toString().isNotEmpty && _cityCtrl.text.isEmpty)
          _cityCtrl.text = userRow['city'].toString();
      }

      // ── Steps 1, 2 & 3: Q&A answers + photos from verification rows ───────
      final verifyRows = (parallel[1] as List).cast<Map>();
      for (final row in verifyRows) {
        final step = row['step'] as String?;
        final data = row['data'] as Map?;
        if (data == null) continue;

        if (step == 'spending_or_qa') {
          final responses = data['responses'] as Map?;
          if (responses == null) continue;

          // Step 1: drawn_to answers → _drawnTo map
          final drawnTo = responses['drawn_to'] as Map?;
          if (drawnTo != null) {
            for (final e in drawnTo.entries) {
              if (e.value is List && (e.value as List).isNotEmpty) {
                _drawnTo[e.key.toString()] =
                    List<String>.from((e.value as List).map((v) => v.toString()));
              }
            }
          }

          // Step 2: how-you-live answers (flat, keyed by section). Single/card
          // sections may have been stored as a scalar; normalise to a list.
          for (final s in _step2Sections) {
            final vals = responses[s.key];
            if (vals is List && vals.isNotEmpty) {
              _howYouLive[s.key] = List<String>.from(vals.map((e) => e.toString()));
            } else if (vals is String && vals.isNotEmpty) {
              _howYouLive[s.key] = [vals];
            }
          }
        }

        if (step == 'photos') {
          // Step 3: pre-fill photos + city + open-to-travel
          final images = data['images'] as List?;
          if (images != null) {
            for (var i = 0; i < images.length && i < _photos.length; i++) {
              if (_photos[i] == null) _photos[i] = images[i]?.toString();
            }
          }
          if (data['openToTravel'] == true) _openToTravel = true;
          if ((data['city'] ?? '').toString().isNotEmpty && _cityCtrl.text.isEmpty)
            _cityCtrl.text = data['city'].toString();
        }
      }

      if (mounted) setState(() {});
    } catch (_) {
      AppLogger.instance.error('init_camera failed', screen: 'verification', action: 'init_camera');
    }
  }

  // Step 0 — identity check
  bool _livenessDone = false;
  String _livenessResult = '';

  // Step 1 (drawn-to) & Step 2 (how-you-live): sectionKey → selected labels.
  // Both use the archetype-specific question sets from onboarding_questions.dart
  // (a faithful port of the web DrawnToStep / HowYouLiveStep).
  final _drawnTo = <String, List<String>>{};
  final _howYouLive = <String, List<String>>{};

  // ── Archetype-specific question sets ──────────────────────────────────────

  String get _arch => widget.archetypeId ?? '';

  List<QSection> get _step1Sections => drawnToSections(_arch);
  List<QSection> get _step2Sections => howYouLiveSections(_arch);

  List<String> get _step1Required => drawnToRequiredKeys(_arch);
  List<String> get _step2Required => howYouLiveRequiredKeys(_arch);

  /// Apply the selection rule for a section to a picks map (mirrors the web
  /// toggleMulti / pickSingle): multi toggles up to [QSection.max]; single and
  /// card replace the current choice (tap again to clear).
  void _applyPick(Map<String, List<String>> picks, QSection s, String label) {
    final cur = List<String>.from(picks[s.key] ?? const []);
    if (s.kind == QKind.multi) {
      if (cur.contains(label)) {
        cur.remove(label);
      } else if (cur.length < s.max) {
        cur.add(label);
      }
      picks[s.key] = cur;
    } else {
      picks[s.key] = cur.contains(label) ? [] : [label];
    }
  }

  // Step 3 — photos & place
  final _nameCtrl  = TextEditingController();
  final _ageCtrl   = TextEditingController();
  final _cityCtrl  = TextEditingController();
  late List<String?> _photos; // 3 slots for men, 6 for women
  bool  _openToTravel = false;
  bool  _detectingCity = false;

  bool get _isWoman => (widget.archetypeId ?? '').endsWith('_woman');

  int get _photoCount => _photos.where((p) => p != null).length;

  bool get _stepComplete {
    switch (_step) {
      case 0: return _livenessDone;
      case 1: return _step1Required.every((k) => (_drawnTo[k]?.isNotEmpty ?? false));
      case 2: return _step2Required.every((k) => (_howYouLive[k]?.isNotEmpty ?? false));
      case 3:
        final a = int.tryParse(_ageCtrl.text.trim());
        return _photoCount > 0
            && _nameCtrl.text.trim().isNotEmpty
            && a != null && a >= 18 && a <= 99
            && _cityCtrl.text.trim().isNotEmpty;
      default: return false;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _ageCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  Future<void> _detectCity() async {
    // 1. Check / request permission
    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(Config.bg2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Location access needed',
              style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
          content: const Text(
            'Please enable location access in Settings so riteangle can detect your city.',
            style: TextStyle(color: Color(Config.text2), fontSize: 14, height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(Config.text3))),
            ),
            TextButton(
              onPressed: () { Navigator.pop(ctx); Geolocator.openAppSettings(); },
              child: const Text('Open Settings', style: TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      );
      return;
    }

    // 2. Get position + reverse geocode
    setState(() => _detectingCity = true);
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.low),
      ).timeout(const Duration(seconds: 10));
      final resp = await Dio().get(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {'lat': pos.latitude, 'lon': pos.longitude, 'format': 'json'},
        options: Options(headers: {'User-Agent': 'riteangle-app/1.0'}),
      );
      final addr = resp.data['address'] as Map<String, dynamic>? ?? {};
      final city = addr['city'] ?? addr['town'] ?? addr['village'] ?? addr['county'] ?? '';
      if (city.toString().isNotEmpty) {
        setState(() => _cityCtrl.text = city.toString());
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not detect city. Please type it manually.')),
          );
        }
      }
    } catch (_) {
      AppLogger.instance.error('capture_id failed', screen: 'verification', action: 'capture_id');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not detect location. Please type your city manually.')),
        );
      }
    } finally {
      if (mounted) setState(() => _detectingCity = false);
    }
  }

  Future<void> _takeSelfie() async {
    setState(() { _busy = true; _error = null; });
    final result = await Navigator.push<_LivenessResult>(
      context,
      PageRouteBuilder(
        fullscreenDialog: true,
        opaque: true,
        pageBuilder: (_, __, ___) => const _LivenessCaptureScreen(),
      ),
    );
    if (!mounted) return;
    setState(() { _busy = false; });
    if (result == null) return;
    setState(() {
      _livenessDone = true;
      _livenessResult = result.message;
    });
  }

  Future<void> _pickPhoto(int slot) async {
    AppLogger.instance.action('verification', 'upload_verification_photo');
    // If tapping an empty slot, offer multi-select so the user can pick
    // several photos at once and fill consecutive empty slots.
    if (_photos[slot] == null) {
      final picked = await _picker.pickMultiImage(maxWidth: 1024, imageQuality: 75);
      if (picked.isEmpty) return;
      // Fill starting from this slot, skipping slots that already have a photo.
      final emptySlots = [
        for (int i = slot; i < _photos.length; i++)
          if (_photos[i] == null) i,
      ];
      final toFill = picked.take(emptySlots.length).toList();
      for (int j = 0; j < toFill.length; j++) {
        final bytes = await toFill[j].readAsBytes();
        final b64 = base64Encode(bytes);
        if (mounted) setState(() => _photos[emptySlots[j]] = b64);
      }
    } else {
      // Tapping a slot that already has a photo → replace it with a single pick.
      final x = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 75);
      if (x == null) return;
      final bytes = await x.readAsBytes();
      if (mounted) setState(() => _photos[slot] = base64Encode(bytes));
    }
  }

  void _showSkipDialog({required VoidCallback onConfirm}) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(
                color: const Color(0x1FFBBF24),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Center(child: Text('⚠️', style: TextStyle(fontSize: 28))),
            ),
            const SizedBox(height: 16),
            const Text(
              'Skip this step?',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(Config.text1)),
            ),
            const SizedBox(height: 8),
            const Text(
              'Skipping verification steps may reduce your trust score and limit your matches.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Color(Config.text2), height: 1.5),
            ),
          ],
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(Config.text1),
                    side: const BorderSide(color: Color(0x331B1020)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    onConfirm();
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFFBBF24),
                    foregroundColor: const Color(0xFF78350F),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    elevation: 0,
                  ),
                  child: const Text('Skip Anyway', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _advance() async {
    if (_busy) return;

    // Step 0 just advances — liveness was already submitted in _takeSelfie.
    if (_step == 0) {
      final next = _nextStep(0);
      if (next > 3) { widget.onDone(); return; }
      setState(() { _step = next; _error = null; });
      return;
    }

    AppLogger.instance.action('verification', 'submit_verification');
    setState(() { _busy = true; _error = null; });
    try {
      switch (_step) {
        case 1:
          // Submit only drawn_to answers → server marks spending_or_qa completed
          // with just these responses. Trust & Boost shows Intent at 50%.
          await verifyStep('spending_or_qa', {
            'responses': {
              'drawn_to': {for (final s in _step1Sections) s.key: _drawnTo[s.key] ?? <String>[]},
            },
            'mimeType': 'application/json',
          });
          break;
        case 2:
          // Submit only how_you_live answers. Server merges with the drawn_to
          // responses already saved from step 1 — no data is lost.
          // Trust & Boost then shows Intent at 100%.
          await verifyStep('spending_or_qa', {
            'responses': {
              for (final s in _step2Sections) s.key: _howYouLive[s.key] ?? <String>[],
            },
            'mimeType': 'application/json',
          });
          break;
        case 3:
          final imgs = _photos.whereType<String>().toList();
          await verifyStep('photos', {
            'images': imgs,
            'mimeTypes': List.filled(imgs.length, 'image/jpeg'),
            'labels': {for (var i = 0; i < imgs.length; i++) '$i': i == 0 ? 'main' : 'photo'},
            'city': _cityCtrl.text.trim(),
            'openToTravel': _openToTravel,
          });
          try {
            await saveIdentity(
              firstName: _nameCtrl.text.trim(),
              age: int.tryParse(_ageCtrl.text.trim()),
              city: _cityCtrl.text.trim(),
            );
          } catch (_) {
            AppLogger.instance.error('parse_age failed', screen: 'verification', action: 'parse_age');
          }
          // Sync Q&A onboarding responses to user_master_profile so web
          // profile and AI context can read them.
          syncVerificationToMasterProfile().catchError((_) {});
          if (mounted) widget.onDone();
          return;
      }
      final next = _nextStep(_step);
      if (next > 3) { if (mounted) { setState(() { _busy = false; }); widget.onDone(); } return; }
      if (mounted) setState(() { _busy = false; _step = next; _error = null; });
    } catch (e) {
      AppLogger.instance.error(e, screen: 'verification', action: 'save_responses');
      if (mounted) setState(() { _busy = false; _error = _friendlyError(e); });
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            const SizedBox(height: 20),
            _buildStepPills(),
            const SizedBox(height: 16),
            _buildProgressBar(),
            const SizedBox(height: 4),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                transitionBuilder: (child, anim) => FadeTransition(
                  opacity: CurvedAnimation(parent: anim, curve: Curves.easeIn),
                  child: SlideTransition(
                    position: Tween<Offset>(begin: const Offset(0.04, 0), end: Offset.zero)
                        .animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
                    child: child,
                  ),
                ),
                child: KeyedSubtree(key: ValueKey(_step), child: _buildStepBody()),
              ),
            ),
            _buildFooter(context),
          ],
        ),
      ),
    );
  }

  // ── Header ────────────────────────────────────────────────────────────────

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: _busy ? null : () {
              final prev = _prevStep(_step);
              if (prev >= 0) {
                setState(() { _step = prev; _error = null; });
              } else {
                widget.onBack?.call();
              }
            },
            child: Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: const Color(Config.bg2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0x181B1020)),
              ),
              child: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: Color(Config.text1)),
            ),
          ),
          const Expanded(
            child: Text(
              'Verification',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Config.text1)),
            ),
          ),
          SizedBox(
            width: 36,
            child: TextButton(
              onPressed: () => _showSkipDialog(onConfirm: widget.onDone),
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('Skip', style: TextStyle(fontSize: 13, color: Color(Config.text3))),
            ),
          ),
        ],
      ),
    );
  }

  // ── Step pills ────────────────────────────────────────────────────────────

  Widget _buildStepPills() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(4, (i) {
        final active = i == _step;
        final done   = i < _step;
        return Padding(
          padding: EdgeInsets.only(right: i < 3 ? 40 : 0),
          child: Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: active || done
                  ? const Color(Config.accentBright)
                  : const Color(Config.bg2),
              border: Border.all(
                color: active || done
                    ? const Color(Config.accentBright)
                    : const Color(0x331B1020),
                width: 1.5,
              ),
              boxShadow: active || done ? null : [
                const BoxShadow(color: Color(0x0F000000), blurRadius: 4, offset: Offset(0, 1)),
              ],
            ),
            child: Center(
              child: done
                  ? const Icon(Icons.check, size: 16, color: Colors.white)
                  : Text(
                      '${i + 1}',
                      style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700,
                        color: active ? Colors.white : const Color(Config.text2),
                      ),
                    ),
            ),
          ),
        );
      }),
    );
  }

  // ── Progress bar ──────────────────────────────────────────────────────────

  Widget _buildProgressBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: LinearProgressIndicator(
          value: (_step + 1) / 4,
          minHeight: 4,
          backgroundColor: const Color(0x221B1020),
          valueColor: const AlwaysStoppedAnimation(Color(Config.accentBright)),
        ),
      ),
    );
  }

  // ── Step router ───────────────────────────────────────────────────────────

  Widget _buildStepBody() {
    switch (_step) {
      case 0: return _identityStep();
      case 1: return _drawnToStep();
      case 2: return _howYouLiveStep();
      case 3: return _photosStep();
      default: return const SizedBox.shrink();
    }
  }

  // ── Step 0: Identity check ────────────────────────────────────────────────

  Widget _identityStep() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      children: [
        _stepTitle('Identity\n', 'check.'),
        _timeTag('~60 sec'),
        const SizedBox(height: 24),
        _cameraCard(),
        const SizedBox(height: 10),
        Center(
          child: TextButton(
            onPressed: _busy ? null : () => _showSkipDialog(
              onConfirm: () {
                setState(() {
                  _livenessDone = true;
                  _livenessResult = 'Skipped';
                });
                _advance();
              },
            ),
            child: const Text(
              'Skip identity check — lower your trust score',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13, color: Color(Config.text3),
                decoration: TextDecoration.underline,
                decorationColor: Color(Config.text3),
              ),
            ),
          ),
        ),
        const SizedBox(height: 28),
        _testimonialCard(_testimonials[0]),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _cameraCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _livenessDone ? const Color(Config.accentBright) : const Color(Config.text3),
          width: _livenessDone ? 2 : 1,
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(
              color: const Color(Config.accentTint),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              _livenessDone ? Icons.check_circle_outline_rounded : Icons.camera_front_rounded,
              size: 36, color: const Color(Config.accentBright),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _livenessDone ? 'Selfie captured ✓' : '📷 Quick selfie',
            style: TextStyle(
              fontSize: 16, fontWeight: FontWeight.w700,
              color: _livenessDone ? const Color(Config.accentBright) : const Color(Config.text1),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _livenessDone
                ? (_livenessResult.isNotEmpty ? _livenessResult : 'Selfie verified')
                : '⏱ 60 sec · confirms you\'re a real person — no ID needed.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: Color(Config.text2), height: 1.4),
          ),
        ],
      ),
    );
  }

  // ── Step 1: What you're drawn to ──────────────────────────────────────────

  Widget _drawnToStep() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      children: [
        _stepTitle('What you\'re\n', 'drawn to.'),
        _timeTag('~2 min'),
        const SizedBox(height: 24),
        QaStep(
          sections: _step1Sections,
          picks: _drawnTo,
          onTap: (s, label) => setState(() => _applyPick(_drawnTo, s, label)),
        ),
        const SizedBox(height: 8),
        _testimonialCard(_testimonials[1]),
        const SizedBox(height: 16),
        _skipLink(onConfirm: () => setState(() { _step = 2; _error = null; })),
        const SizedBox(height: 20),
      ],
    );
  }

  // ── Step 2: How you live ──────────────────────────────────────────────────

  Widget _howYouLiveStep() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      children: [
        _stepTitle('How you\n', 'live.'),
        _timeTag('~2 min'),
        const SizedBox(height: 24),
        QaStep(
          sections: _step2Sections,
          picks: _howYouLive,
          onTap: (s, label) => setState(() => _applyPick(_howYouLive, s, label)),
        ),
        const SizedBox(height: 24),
        _testimonialCard(_testimonials[2]),
        const SizedBox(height: 16),
        _skipLink(onConfirm: () => setState(() { _step = 3; _error = null; })),
        const SizedBox(height: 20),
      ],
    );
  }

  // ── Step 3: Photos & place ────────────────────────────────────────────────

  Widget _photosStep() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      children: [
        _stepTitle('Almost\n', 'there.'),
        _timeTag('~60 sec'),
        const SizedBox(height: 24),
        // About you
        const Text('About you',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(Config.text2))),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _textField(_nameCtrl, 'First name', TextInputType.name, TextCapitalization.words, maxLength: 30)),
            const SizedBox(width: 10),
            SizedBox(
              width: 96,
              child: _ageDropdown(),
            ),
          ],
        ),
        const SizedBox(height: 20),
        // Photos
        const Text('Your photos',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(Config.text2))),
        const SizedBox(height: 8),
        LayoutBuilder(builder: (ctx, box) {
          final w = (box.maxWidth - 16) / 3;
          final h = w * 4 / 3;
          final rows = _photos.length ~/ 3;
          return Column(
            children: [
              for (int row = 0; row < rows; row++) ...[
                if (row > 0) const SizedBox(height: 8),
                SizedBox(
                  height: h,
                  child: Row(
                    children: [
                      for (int col = 0; col < 3; col++) ...[
                        if (col > 0) const SizedBox(width: 8),
                        SizedBox(width: w, height: h, child: _photoSlot(row * 3 + col)),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          );
        }),
        const SizedBox(height: 8),
        const Text('Add at least 1 photo to continue.',
            style: TextStyle(fontSize: 11, color: Color(Config.text3))),
        const SizedBox(height: 20),
        // City
        const Text('Your city',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(Config.text2))),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _textField(_cityCtrl, 'e.g. Mumbai', TextInputType.text, TextCapitalization.words, maxLength: 60),
            ),
            const SizedBox(width: 8),
            OutlinedButton.icon(
              onPressed: _detectingCity ? null : _detectCity,
              icon: _detectingCity
                  ? const SizedBox(width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accentBright)))
                  : const Icon(Icons.my_location_rounded, size: 16),
              label: const Text('Detect'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(Config.accentBright),
                side: const BorderSide(color: Color(Config.accentBright)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        // Travel toggle
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(Config.bg2),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0x181B1020)),
          ),
          child: Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Open to travel',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(Config.text1))),
                    Text('Show your profile when you travel',
                        style: TextStyle(fontSize: 12, color: Color(Config.text3))),
                  ],
                ),
              ),
              Switch(
                value: _openToTravel,
                onChanged: (v) => setState(() => _openToTravel = v),
                activeColor: const Color(Config.accentBright),
              ),
            ],
          ),
        ),
        const SizedBox(height: 28),
        _testimonialCard(_testimonials[3]),
        const SizedBox(height: 16),
        _skipLink(onConfirm: widget.onDone),
        const SizedBox(height: 20),
      ],
    );
  }

  // ── Photo slot ────────────────────────────────────────────────────────────

  Widget _photoSlot(int slot) {
    final b64 = _photos[slot];
    return Stack(
      fit: StackFit.expand,
      children: [
        GestureDetector(
          onTap: _busy ? null : () => _pickPhoto(slot),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(Config.bg2),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: b64 != null ? const Color(Config.accentBright) : const Color(0x331B1020),
              ),
            ),
            child: b64 != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(11),
                    child: Image.memory(base64Decode(b64), fit: BoxFit.cover),
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add, color: const Color(Config.text3), size: slot == 0 ? 28 : 22),
                      const SizedBox(height: 4),
                      Text(
                        slot == 0 ? 'Main photo' : 'Photo ${slot + 1}',
                        style: const TextStyle(fontSize: 11, color: Color(Config.text3)),
                      ),
                    ],
                  ),
          ),
        ),
        if (slot == 0 && b64 != null)
          Positioned(
            bottom: 6, left: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(Config.accentBright),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text('Main',
                  style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ),
        if (b64 != null)
          Positioned(
            top: 4, right: 4,
            child: GestureDetector(
              onTap: () => setState(() => _photos[slot] = null),
              child: Container(
                width: 22, height: 22,
                decoration: const BoxDecoration(color: Color(0xCC1B1020), shape: BoxShape.circle),
                child: const Icon(Icons.close, size: 12, color: Colors.white),
              ),
            ),
          ),
      ],
    );
  }

  // ── Testimonial card ──────────────────────────────────────────────────────

  Widget _testimonialCard(_Testimonial t) {
    final url = '${Config.apiBase}${t.photoPath}';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 12, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  ClipOval(
                    child: Image.network(
                      url, width: 48, height: 48, fit: BoxFit.cover,
                      errorBuilder: (_, e, s) => Container(
                        width: 48, height: 48,
                        decoration: const BoxDecoration(
                          color: Color(Config.accentTint),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.person, color: Color(Config.accentBright), size: 28),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 0, right: -2,
                    child: Container(
                      width: 16, height: 16,
                      decoration: const BoxDecoration(
                        color: Color(Config.accentBright),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check, size: 10, color: Colors.white),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${t.name}, ${t.age}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(Config.text1))),
                  Text(t.profession,
                      style: const TextStyle(fontSize: 12, color: Color(Config.text3))),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          RichText(
            text: TextSpan(
              style: const TextStyle(
                fontSize: 14, color: Color(Config.text2),
                fontStyle: FontStyle.italic, height: 1.5,
              ),
              children: [
                TextSpan(text: t.quoteBefore),
                TextSpan(
                  text: t.highlight,
                  style: const TextStyle(
                    color: Color(Config.accentBright),
                    fontWeight: FontWeight.w700,
                    fontStyle: FontStyle.italic,
                  ),
                ),
                TextSpan(text: t.quoteAfter),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Footer CTA ────────────────────────────────────────────────────────────

  Widget _buildFooter(BuildContext context) {
    final String label;
    final VoidCallback? action;

    if (_step == 0) {
      if (!_livenessDone) {
        label  = 'Take a quick selfie';
        action = _busy ? null : _takeSelfie;
      } else {
        label  = 'Continue →';
        action = _busy ? null : _advance;
      }
    } else if (_stepComplete) {
      label  = _step == 3 ? 'Finish & enter →' : 'Continue →';
      action = _busy ? null : _advance;
    } else {
      action = null;
      if (_step == 1) {
        final filled = _step1Required.where((k) => _drawnTo[k]?.isNotEmpty ?? false).length;
        label = 'Pick at least one in each ($filled/${_step1Required.length})';
      } else if (_step == 2) {
        final filled = _step2Required.where((k) => _howYouLive[k]?.isNotEmpty ?? false).length;
        label = 'Answer the required sections ($filled/${_step2Required.length})';
      } else {
        label = 'Add your name, age, a photo & city';
      }
    }

    return Container(
      padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.of(context).padding.bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_error != null) ...[
            Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
            const SizedBox(height: 8),
          ],
          SizedBox(
            width: double.infinity, height: 56,
            child: FilledButton(
              onPressed: action,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accentBright),
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(Config.bg3),
                disabledForegroundColor: const Color(Config.text3),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: _busy
                  ? const SizedBox(width: 22, height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(label,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  Widget _skipLink({required VoidCallback onConfirm}) {
    return Center(
      child: TextButton(
        onPressed: () => _showSkipDialog(onConfirm: onConfirm),
        child: const Text(
          'Skip this step — lower your trust score',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13, color: Color(Config.text3),
            decoration: TextDecoration.underline,
            decorationColor: Color(Config.text3),
          ),
        ),
      ),
    );
  }

  Widget _stepTitle(String line1, String line2) {
    return RichText(
      text: TextSpan(
        style: const TextStyle(
          fontSize: 42, fontWeight: FontWeight.w800,
          fontStyle: FontStyle.italic, height: 0.92, letterSpacing: -1.0,
        ),
        children: [
          TextSpan(text: line1, style: const TextStyle(color: Color(Config.text1))),
          TextSpan(text: line2, style: const TextStyle(color: Color(Config.accentBright))),
        ],
      ),
    );
  }

  Widget _timeTag(String time) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(children: [
        const Text('⏱', style: TextStyle(fontSize: 14)),
        const SizedBox(width: 4),
        Text(time, style: const TextStyle(fontSize: 14, color: Color(Config.text3))),
      ]),
    );
  }

  Widget _textField(
    TextEditingController c, String hint, TextInputType kb, TextCapitalization cap, {
    int? maxLength,
  }) {
    return TextField(
      controller: c,
      keyboardType: kb,
      textCapitalization: cap,
      autocorrect: false,
      maxLength: maxLength,
      buildCounter: maxLength == null
          ? null
          : (_, {required currentLength, required isFocused, maxLength}) => null,
      inputFormatters: maxLength == null
          ? null
          : [LengthLimitingTextInputFormatter(maxLength)],
      onChanged: (_) => setState(() {}),
      style: const TextStyle(color: Color(Config.text1)),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(Config.text3)),
        filled: true,
        fillColor: const Color(Config.bg2),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(Config.accentBright), width: 1.5),
        ),
      ),
    );
  }

  // Age is a constrained dropdown (18–99) so members can't enter an out-of-range
  // or non-numeric age. Backs the same _ageCtrl used by validation/submit.
  Widget _ageDropdown() {
    final current = int.tryParse(_ageCtrl.text.trim());
    final value = (current != null && current >= 18 && current <= 99) ? current : null;
    return DropdownButtonFormField<int>(
      value: value,
      isExpanded: true,
      hint: const Text('Age', style: TextStyle(color: Color(Config.text3))),
      style: const TextStyle(color: Color(Config.text1), fontSize: 16),
      dropdownColor: const Color(Config.bg2),
      icon: const Icon(Icons.arrow_drop_down, color: Color(Config.text3)),
      items: [
        for (int a = 18; a <= 99; a++)
          DropdownMenuItem(value: a, child: Text('$a')),
      ],
      onChanged: (v) => setState(() {
        _ageCtrl.text = v?.toString() ?? '';
      }),
      decoration: InputDecoration(
        filled: true,
        fillColor: const Color(Config.bg2),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(Config.accentBright), width: 1.5),
        ),
      ),
    );
  }
}

// ── Liveness capture result ───────────────────────────────────────────────────

class _LivenessResult {
  final String message;
  const _LivenessResult(this.message);
}

// ── Liveness capture screen ───────────────────────────────────────────────────

enum _LivenessPhase { idle, opening, ready, filling, verifying, failed, underReview }

class _LivenessCaptureScreen extends StatefulWidget {
  const _LivenessCaptureScreen();

  @override
  State<_LivenessCaptureScreen> createState() => _LivenessCaptureScreenState();
}

class _LivenessCaptureScreenState extends State<_LivenessCaptureScreen> {
  _LivenessPhase _phase = _LivenessPhase.idle;
  CameraController? _ctrl;
  double _fillPct = 0;
  Timer? _fillTimer;
  Timer? _delayTimer;
  String? _errMsg;
  int _matchPct = 0;
  int _failCount = 0; // track consecutive failures to show skip option

  @override
  void dispose() {
    _cleanupTimers();
    _ctrl?.dispose();
    super.dispose();
  }

  void _cleanupTimers() {
    _delayTimer?.cancel();
    _fillTimer?.cancel();
    _delayTimer = null;
    _fillTimer = null;
  }

  void _stopStream() {
    _cleanupTimers();
    _ctrl?.dispose();
    _ctrl = null;
  }

  Future<void> _openCamera() async {
    setState(() { _phase = _LivenessPhase.opening; _errMsg = null; });
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) throw Exception('No cameras found.');
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      final ctrl = CameraController(front, ResolutionPreset.high, enableAudio: false);
      await ctrl.initialize();
      if (!mounted) { ctrl.dispose(); return; }
      setState(() { _ctrl = ctrl; _phase = _LivenessPhase.ready; });
      _scheduleAutoCapture();
    } catch (e) {
      AppLogger.instance.error(e, screen: 'verification', action: 'upload_selfie');
      if (mounted) {
        setState(() {
          _phase = _LivenessPhase.idle;
          _errMsg = 'Camera unavailable. Please allow access in Settings.';
        });
      }
    }
  }

  void _scheduleAutoCapture() {
    // 2s pause so user can centre face, then ring fills over 1.5s
    _delayTimer = Timer(const Duration(milliseconds: 2000), () {
      if (!mounted) return;
      setState(() { _phase = _LivenessPhase.filling; _fillPct = 0; });
      const totalMs = 1500;
      const tickMs  = 30;
      const step    = 100.0 / (totalMs / tickMs);
      _fillTimer = Timer.periodic(const Duration(milliseconds: tickMs), (t) {
        if (!mounted) { t.cancel(); return; }
        final next = (_fillPct + step).clamp(0.0, 100.0);
        setState(() => _fillPct = next);
        if (next >= 100) {
          t.cancel();
          _fillTimer = null;
          _doCapture();
        }
      });
    });
  }

  Future<void> _doCapture() async {
    final ctrl = _ctrl;
    if (ctrl == null || !ctrl.value.isInitialized) return;
    try {
      final xfile = await ctrl.takePicture();
      final bytes = await xfile.readAsBytes();
      final b64   = base64Encode(bytes);
      // Stop camera before verifying
      _stopStream();
      if (!mounted) return;
      setState(() { _phase = _LivenessPhase.verifying; });
      await _runVerification(b64);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'verification', action: 'upload_id');
      if (mounted) setState(() { _phase = _LivenessPhase.failed; _errMsg = 'Capture failed. Please try again.'; });
    }
  }

  Future<void> _runVerification(String b64) async {
    try {
      final res = await verifyStep('liveness', {'selfieImage': b64, 'mimeType': 'image/jpeg'});
      if (!mounted) return;
      final conf = res['confidence'] ?? (res['data'] is Map ? (res['data'] as Map)['confidence'] : null);
      final pct  = conf is num ? conf.toDouble() : 0.0;
      if (pct > 0 && pct < 50) {
        setState(() { _phase = _LivenessPhase.underReview; _matchPct = pct.round(); });
      } else {
        final msg = pct > 0 ? 'Live selfie · ${pct.round()}%' : 'Selfie verified ✓';
        if (mounted) Navigator.pop(context, _LivenessResult(msg));
      }
    } catch (e) {
      AppLogger.instance.error(e, screen: 'verification', action: 'upload_income');
      if (!mounted) return;
      setState(() {
        _phase  = _LivenessPhase.failed;
        _failCount++;
        _errMsg = _friendlyError(e);
      });
    }
  }

  void _retry() {
    _stopStream();
    setState(() { _phase = _LivenessPhase.idle; _fillPct = 0; _errMsg = null; _matchPct = 0; });
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    switch (_phase) {
      case _LivenessPhase.idle:
      case _LivenessPhase.opening:
        return _idleScreen();
      case _LivenessPhase.ready:
      case _LivenessPhase.filling:
        return _cameraScreen();
      case _LivenessPhase.verifying:
        return _verifyingScreen();
      case _LivenessPhase.failed:
        return _failedScreen();
      case _LivenessPhase.underReview:
        return _underReviewScreen();
    }
  }

  // ── Idle / guide screen ───────────────────────────────────────────────────

  Widget _idleScreen() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: 200, height: 250,
          child: CustomPaint(painter: _OvalGuidePainter()),
        ),
        const SizedBox(height: 20),
        const Text(
          'Look straight into the camera\nand hold still.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFFCBC0C4), fontSize: 15, height: 1.5),
        ),
        if (_errMsg != null) ...[
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(_errMsg!, textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFF87171), fontSize: 13, height: 1.4)),
          ),
        ],
        const SizedBox(height: 32),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: SizedBox(
            width: double.infinity, height: 54,
            child: FilledButton(
              onPressed: _phase == _LivenessPhase.opening ? null : _openCamera,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accentBright),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _phase == _LivenessPhase.opening
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('📷  Start', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel', style: TextStyle(color: Color(0xFF9B8B8F), fontSize: 13)),
        ),
      ],
    );
  }

  // ── Live camera + ring ────────────────────────────────────────────────────

  Widget _cameraScreen() {
    final ctrl = _ctrl;
    if (ctrl == null || !ctrl.value.isInitialized) return _verifyingScreen();
    return Stack(
      fit: StackFit.expand,
      children: [
        // Camera preview, mirrored for selfie feel
        Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()..scale(-1.0, 1.0, 1.0),
          child: CameraPreview(ctrl),
        ),
        // Oval ring overlay
        CustomPaint(painter: _LivenessRingPainter(fillPct: _fillPct)),
        // Close button
        Positioned(
          top: 16, right: 16,
          child: GestureDetector(
            onTap: () { _stopStream(); Navigator.pop(context); },
            child: Container(
              width: 38, height: 38,
              decoration: const BoxDecoration(color: Color(0x99000000), shape: BoxShape.circle),
              child: const Icon(Icons.close, color: Colors.white, size: 20),
            ),
          ),
        ),
        // Instruction bubble
        Positioned(
          bottom: 48, left: 0, right: 0,
          child: Center(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
              decoration: BoxDecoration(
                color: _phase == _LivenessPhase.filling
                    ? const Color(0x99FF3B6B)
                    : const Color(0x99000000),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                _phase == _LivenessPhase.ready ? 'Centre your face in the ring' : 'Hold still…',
                style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600,
                  color: _phase == _LivenessPhase.filling
                      ? const Color(0xFFFFE1EA)
                      : Colors.white,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── Verifying spinner ─────────────────────────────────────────────────────

  Widget _verifyingScreen() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(width: 64, height: 64,
            child: CircularProgressIndicator(strokeWidth: 4, color: Color(Config.accentBright))),
          SizedBox(height: 24),
          Text('Verifying your selfie…',
              style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
          SizedBox(height: 8),
          Text('Confirming you\'re a real, live person',
              style: TextStyle(color: Color(0xFF9B8B8F), fontSize: 13)),
        ],
      ),
    );
  }

  // ── Failed ────────────────────────────────────────────────────────────────

  Widget _failedScreen() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 72, height: 72,
          decoration: BoxDecoration(
            color: const Color(0x1FEF4444),
            border: Border.all(color: const Color(0x66EF4444), width: 2),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.close_rounded, color: Color(0xFFEF4444), size: 32),
        ),
        const SizedBox(height: 20),
        const Text('Selfie check failed',
            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            _errMsg ?? 'Please try again in better lighting.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF9B8B8F), fontSize: 13, height: 1.4),
          ),
        ),
        const SizedBox(height: 32),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: SizedBox(
            width: double.infinity, height: 54,
            child: FilledButton(
              onPressed: _retry,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accentBright),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text('Try again', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ),
        ),
        if (_failCount >= 2) ...[
          const SizedBox(height: 4),
          TextButton(
            onPressed: () => Navigator.pop(context, _LivenessResult('Skipped')),
            child: const Text(
              'Skip selfie (lower trust score)',
              style: TextStyle(color: Color(0xFF9B8B8F), fontSize: 13,
                  decoration: TextDecoration.underline, decorationColor: Color(0xFF9B8B8F)),
            ),
          ),
        ] else ...[
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF9B8B8F), fontSize: 13)),
          ),
        ],
      ],
    );
  }

  // ── Under review ──────────────────────────────────────────────────────────

  Widget _underReviewScreen() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 88, height: 88,
          decoration: BoxDecoration(
            color: const Color(0x1FFBBF24),
            border: Border.all(color: const Color(0x73FBBF24), width: 2),
            shape: BoxShape.circle,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('$_matchPct%', style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 22, fontWeight: FontWeight.w800, height: 1)),
              const Text('score', style: TextStyle(color: Color(0xB3FBBF24), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.06)),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text('Under review', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            'Your selfie will be reviewed within 24 hours. You can continue in the meantime.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF9B8B8F), fontSize: 13, height: 1.4),
          ),
        ),
        const SizedBox(height: 32),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: SizedBox(
            width: double.infinity, height: 54,
            child: FilledButton(
              onPressed: () => Navigator.pop(context, const _LivenessResult('Under review — will be checked within 24h')),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accentBright),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text('Continue', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel', style: TextStyle(color: Color(0xFF9B8B8F), fontSize: 13)),
        ),
      ],
    );
  }
}

// ── Painters ──────────────────────────────────────────────────────────────────

/// Dashed oval guide shown on the idle screen (dark background)
class _OvalGuidePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height * 0.48;
    final rect = Rect.fromCenter(
      center: Offset(cx, cy),
      width: size.width * 0.78,
      height: size.height * 0.79,
    );
    canvas.drawOval(rect, Paint()
      ..color = const Color(0x44FFFFFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5);
  }

  @override bool shouldRepaint(covariant CustomPainter _) => false;
}

/// Live ring overlay drawn on top of the camera feed
class _LivenessRingPainter extends CustomPainter {
  final double fillPct; // 0–100
  const _LivenessRingPainter({required this.fillPct});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final ovalW = size.width * 0.78;
    final ovalH = ovalW * 1.28;
    final rect  = Rect.fromCenter(center: Offset(cx, cy), width: ovalW, height: ovalH);

    // Track
    canvas.drawOval(rect, Paint()
      ..color = const Color(0x44FFFFFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3);

    // Pink progress arc (starts at top = -π/2, sweeps clockwise)
    if (fillPct > 0) {
      const startAngle = -3.14159265 / 2;
      final sweepAngle  = (fillPct / 100) * 2 * 3.14159265;
      canvas.drawArc(rect, startAngle, sweepAngle, false, Paint()
        ..color = const Color(0xFFFF3B6B)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round);
    }
  }

  @override
  bool shouldRepaint(covariant _LivenessRingPainter old) => old.fillPct != fillPct;
}
