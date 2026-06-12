import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';
import 'api.dart';
import 'config.dart';

// ── Data models ───────────────────────────────────────────────────────────────

class _Chip {
  final String? emoji;
  final String label;
  const _Chip(this.label, {this.emoji});
}

class _Section {
  final String key;
  final String icon;
  final String title;
  final String sub;
  final int max;        // 1 = single-select, 99 = unlimited multi
  final bool optional;
  final List<_Chip> chips;
  const _Section({
    required this.key,
    required this.icon,
    required this.title,
    required this.sub,
    this.max = 99,
    this.optional = false,
    required this.chips,
  });
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

// ── Step 1 — "What you're drawn to" (matrimony archetype) ────────────────────

const _drawnToSections = <_Section>[
  _Section(
    key: 'core_values', icon: '🏛️', title: 'Values that matter most',
    sub: 'Pick up to 3', max: 3,
    chips: [
      _Chip('Family-first',            emoji: '🏡'),
      _Chip('Culturally aligned',      emoji: '🕌'),
      _Chip('Respectful & grounded',   emoji: '🙏'),
      _Chip('Traditional values',      emoji: '📿'),
      _Chip('Religiously compatible',  emoji: '✝️'),
      _Chip('Community-oriented',      emoji: '🌍'),
      _Chip('Financially responsible', emoji: '💰'),
      _Chip('Parenting-aligned',       emoji: '👨‍👩‍👧'),
    ],
  ),
  _Section(
    key: 'family_approach', icon: '👨‍👩‍👧', title: 'Family approach',
    sub: 'Pick up to 3', max: 3,
    chips: [
      _Chip('Family approval matters',       emoji: '🤝'),
      _Chip('Respecting elders',             emoji: '🏠'),
      _Chip('Building legacy together',      emoji: '🧬'),
      _Chip('Strong family bonds',           emoji: '🎉'),
      _Chip('Cultural event participation',  emoji: '👐'),
      _Chip('Extended family involvement',   emoji: '🏘'),
      _Chip('Shared traditions',             emoji: '📿'),
      _Chip('Home-building values',          emoji: '🌺'),
    ],
  ),
  _Section(
    key: 'partner_fit', icon: '🎓', title: 'Partner background',
    sub: 'Pick up to 3', max: 3,
    chips: [
      _Chip('Same religion',       emoji: '🕌'),
      _Chip('Similar education',   emoji: '🎓'),
      _Chip('Stable career',       emoji: '💼'),
      _Chip('Cultural fit',        emoji: '🌍'),
      _Chip('Similar upbringing',  emoji: '🏡'),
      _Chip('Financially settled', emoji: '💰'),
      _Chip('Aligned on children', emoji: '🌸'),
    ],
  ),
  _Section(
    key: 'connection_style', icon: '🤝', title: 'Connection approach',
    sub: 'Pick up to 3', max: 3,
    chips: [
      _Chip('Respectful courtship',       emoji: '🕊'),
      _Chip('Gradual trust-building',     emoji: '⏳'),
      _Chip('Long-term vision first',     emoji: '💍'),
      _Chip('Meeting families early',     emoji: '👨‍👩‍👧'),
      _Chip('Demonstrating seriousness',  emoji: '✅'),
      _Chip('Honest about intent',        emoji: '💬'),
      _Chip('Letting it develop properly',emoji: '🌱'),
    ],
  ),
];

// ── Step 2 — "Background & lifestyle" (matrimony archetype) ──────────────────

const _howYouLiveSections = <_Section>[
  _Section(
    key: 'marital_status', icon: '💍', title: 'Your marital status',
    sub: 'Select one', max: 1,
    chips: [
      _Chip('Never married', emoji: '✨'),
      _Chip('Divorced',      emoji: '🔄'),
      _Chip('Widowed',       emoji: '🕊'),
    ],
  ),
  _Section(
    key: 'religion', icon: '🕌', title: 'Your religion',
    sub: 'Select one', max: 1,
    chips: [
      _Chip('Hindu',     emoji: '🕉'),
      _Chip('Muslim',    emoji: '☪️'),
      _Chip('Christian', emoji: '✝️'),
      _Chip('Sikh',      emoji: '🔱'),
      _Chip('Buddhist',  emoji: '☸️'),
      _Chip('Jain',      emoji: '🔶'),
      _Chip('Other',     emoji: '🌐'),
    ],
  ),
  _Section(
    key: 'lifestyle', icon: '🌿', title: 'Your lifestyle',
    sub: 'Select all that apply', max: 99,
    chips: [
      _Chip('Vegetarian',             emoji: '🥗'),
      _Chip('Non-smoker',             emoji: '🚭'),
      _Chip('Non-drinker',            emoji: '🚱'),
      _Chip('Religiously practicing', emoji: '🙏'),
      _Chip('Family-oriented',        emoji: '👨‍👩‍👧'),
      _Chip('Fitness-focused',        emoji: '💪'),
    ],
  ),
  _Section(
    key: 'income', icon: '💰', title: 'Annual income',
    sub: 'Optional · helps with matching', max: 1, optional: true,
    chips: [
      _Chip('Under ₹5L'),
      _Chip('₹5L – ₹10L'),
      _Chip('₹10L – ₹25L'),
      _Chip('₹25L – ₹50L'),
      _Chip('₹50L+'),
      _Chip('Prefer not to say', emoji: '🔒'),
    ],
  ),
];

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
  const VerificationScreen({super.key, required this.onDone, this.onBack});

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  final _picker = ImagePicker();
  int _step = 0;
  bool _busy = false;
  String? _error;

  // Step 0 — identity check
  bool _livenessDone = false;
  String _livenessResult = '';

  // Step 1 — drawn to (matrimony): sectionKey → selected label set (max 3 each)
  final _drawnTo = <String, Set<String>>{};

  // Step 2 — background & lifestyle (matrimony)
  String? _maritalStatus;
  String? _religion;
  final _lifestyle = <String>{};
  String? _income;

  // Step 3 — photos & place
  final _nameCtrl  = TextEditingController();
  final _ageCtrl   = TextEditingController();
  final _cityCtrl  = TextEditingController();
  final _photos    = <String?>[null, null, null]; // 3 portrait slots
  bool  _openToTravel = false;
  bool  _detectingCity = false;

  int get _photoCount => _photos.where((p) => p != null).length;

  bool get _stepComplete {
    switch (_step) {
      case 0: return _livenessDone;
      case 1: return _drawnToSections.every((s) => (_drawnTo[s.key]?.isNotEmpty ?? false));
      case 2: return _maritalStatus != null && _religion != null && _lifestyle.isNotEmpty;
      case 3:
        final a = int.tryParse(_ageCtrl.text.trim());
        return _photoCount > 0
            && _nameCtrl.text.trim().isNotEmpty
            && a != null && a >= 18 && a <= 120
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
      );
      final resp = await Dio().get(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {'lat': pos.latitude, 'lon': pos.longitude, 'format': 'json'},
        options: Options(headers: {'User-Agent': 'riteangle-app/1.0'}),
      );
      final addr = resp.data['address'] as Map<String, dynamic>? ?? {};
      final city = addr['city'] ?? addr['town'] ?? addr['village'] ?? addr['county'] ?? '';
      if (city.toString().isNotEmpty) {
        setState(() => _cityCtrl.text = city.toString());
      }
    } catch (_) {
      // silently ignore; user can type manually
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
    final x = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 85);
    if (x == null) return;
    final bytes = await x.readAsBytes();
    if (mounted) setState(() => _photos[slot] = base64Encode(bytes));
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
      setState(() { _step = 1; _error = null; });
      return;
    }

    setState(() { _busy = true; _error = null; });
    try {
      switch (_step) {
        case 1:
          await verifyStep('spending_or_qa', {
            'responses': {
              'drawn_to': {for (final s in _drawnToSections) s.key: (_drawnTo[s.key] ?? {}).toList()},
            },
            'mimeType': 'application/json',
          });
          break;
        case 2:
          await verifyStep('spending_or_qa', {
            'responses': {
              'marital_status': _maritalStatus,
              'religion': _religion,
              'lifestyle': _lifestyle.toList(),
              if (_income != null) 'income': _income,
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
          } catch (_) {}
          if (mounted) widget.onDone();
          return;
      }
      if (mounted) setState(() { _busy = false; _step++; _error = null; });
    } catch (e) {
      if (mounted) setState(() { _busy = false; _error = e.toString().replaceFirst('Exception: ', ''); });
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
              if (_step > 0) {
                setState(() { _step--; _error = null; });
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
              onConfirm: () => setState(() {
                _livenessDone = true;
                _livenessResult = 'Skipped';
              }),
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
        for (final s in _drawnToSections)
          _chipSection(
            section: s,
            selected: _drawnTo[s.key] ?? {},
            onToggle: (label) {
              setState(() {
                final set = _drawnTo.putIfAbsent(s.key, () => {});
                if (set.contains(label)) {
                  set.remove(label);
                } else if (set.length < s.max) {
                  set.add(label);
                }
              });
            },
          ),
        const SizedBox(height: 8),
        _testimonialCard(_testimonials[1]),
        const SizedBox(height: 16),
        _skipLink(onConfirm: () => setState(() { _step = 2; _error = null; })),
        const SizedBox(height: 20),
      ],
    );
  }

  // ── Step 2: Background & lifestyle ────────────────────────────────────────

  Widget _howYouLiveStep() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      children: [
        _stepTitle('Your background\n', 'and lifestyle.'),
        _timeTag('~45 sec'),
        const SizedBox(height: 24),
        _chipSection(
          section: _howYouLiveSections[0],
          selected: _maritalStatus != null ? {_maritalStatus!} : {},
          onToggle: (label) => setState(() =>
              _maritalStatus = _maritalStatus == label ? null : label),
        ),
        _chipSection(
          section: _howYouLiveSections[1],
          selected: _religion != null ? {_religion!} : {},
          onToggle: (label) => setState(() =>
              _religion = _religion == label ? null : label),
        ),
        _chipSection(
          section: _howYouLiveSections[2],
          selected: _lifestyle,
          onToggle: (label) {
            setState(() {
              if (_lifestyle.contains(label)) _lifestyle.remove(label);
              else _lifestyle.add(label);
            });
          },
        ),
        _chipSection(
          section: _howYouLiveSections[3],
          selected: _income != null ? {_income!} : {},
          onToggle: (label) => setState(() =>
              _income = _income == label ? null : label),
        ),
        const SizedBox(height: 4),
        const Text(
          '🔒  Your income is never shown — only used as a matching signal.',
          style: TextStyle(fontSize: 11, color: Color(Config.text3), height: 1.5),
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
            Expanded(child: _textField(_nameCtrl, 'First name', TextInputType.name, TextCapitalization.words)),
            const SizedBox(width: 10),
            SizedBox(
              width: 90,
              child: _textField(_ageCtrl, 'Age', TextInputType.number, TextCapitalization.none),
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
          return SizedBox(
            height: h,
            child: Row(
              children: [
                SizedBox(width: w, height: h, child: _photoSlot(0)),
                const SizedBox(width: 8),
                SizedBox(width: w, height: h, child: _photoSlot(1)),
                const SizedBox(width: 8),
                SizedBox(width: w, height: h, child: _photoSlot(2)),
              ],
            ),
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
              child: _textField(_cityCtrl, 'e.g. Mumbai', TextInputType.text, TextCapitalization.words),
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

  // ── Chip section ──────────────────────────────────────────────────────────

  Widget _chipSection({
    required _Section section,
    required Set<String> selected,
    required void Function(String) onToggle,
  }) {
    final atMax = selected.length >= section.max;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Text(section.icon, style: const TextStyle(fontSize: 18)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(section.title,
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(Config.text1))),
                        if (section.optional)
                          const Text(' · optional',
                              style: TextStyle(fontSize: 12, color: Color(Config.text3))),
                      ],
                    ),
                    Text(section.sub,
                        style: const TextStyle(fontSize: 12, color: Color(Config.text3))),
                  ],
                ),
              ),
              if (!section.optional)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: selected.isNotEmpty
                        ? const Color(Config.accentTint)
                        : const Color(0x121B1020),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    '${selected.length}',
                    style: TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w700,
                      color: selected.isNotEmpty
                          ? const Color(Config.accentBright)
                          : const Color(Config.text3),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8, runSpacing: 8,
            children: section.chips.map((chip) {
              final isSelected = selected.contains(chip.label);
              final disabled   = !isSelected && atMax;
              return GestureDetector(
                onTap: disabled ? null : () => onToggle(chip.label),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(Config.accentBright) : const Color(Config.bg2),
                    borderRadius: BorderRadius.circular(99),
                    border: Border.all(
                      color: isSelected
                          ? const Color(Config.accentBright)
                          : disabled
                              ? const Color(0x121B1020)
                              : const Color(0x331B1020),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (chip.emoji != null) ...[
                        Text(chip.emoji!, style: const TextStyle(fontSize: 14)),
                        const SizedBox(width: 6),
                      ],
                      Text(
                        chip.label,
                        style: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600,
                          color: isSelected
                              ? Colors.white
                              : disabled
                                  ? const Color(Config.text3)
                                  : const Color(Config.text1),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
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
        final filled = _drawnToSections.where((s) => _drawnTo[s.key]?.isNotEmpty ?? false).length;
        label = 'Pick at least one in each ($filled/${_drawnToSections.length})';
      } else if (_step == 2) {
        int n = 0;
        if (_maritalStatus != null) n++;
        if (_religion != null) n++;
        if (_lifestyle.isNotEmpty) n++;
        label = 'Answer the required sections ($n/3)';
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
    TextEditingController c, String hint, TextInputType kb, TextCapitalization cap,
  ) {
    return TextField(
      controller: c,
      keyboardType: kb,
      textCapitalization: cap,
      autocorrect: false,
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
      final msg = e.toString();
      if (!mounted) return;
      setState(() {
        _phase  = _LivenessPhase.failed;
        _errMsg = msg.contains('network') || msg.contains('SocketException')
            ? 'Network error — check your connection and retry.'
            : 'Verification failed — please try again.';
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
    return const Column(
      mainAxisAlignment: MainAxisAlignment.center,
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
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel', style: TextStyle(color: Color(0xFF9B8B8F), fontSize: 13)),
        ),
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
