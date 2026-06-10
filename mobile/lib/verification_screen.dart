import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'api.dart';
import 'config.dart';
import 'onboarding_questions.dart';
import 'onboarding_qa_step.dart';

/// Staged, one-step-at-a-time verification (mirrors the web's high-intent flow):
/// 1 Identity Check (live selfie) → 2 Drawn To → 3 How You Live → 4 Photos.
/// A progress bar + per-step momentum keep it moving. Each step submits to
/// /api/verified-vibe/verify-step. No government ID is collected here — that's
/// requested later, only when a name-bearing document is uploaded. The selfie
/// is stored server-side as the anchor face for that later ID match.
class VerificationScreen extends StatefulWidget {
  final VoidCallback onDone;
  /// Archetype chosen in the lane step — drives the Step 2 & 3 question sets.
  final String archetype;
  const VerificationScreen({super.key, required this.onDone, this.archetype = ''});

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _StepMeta {
  final String emoji, title, desc, time, momentum;
  const _StepMeta(this.emoji, this.title, this.desc, this.time, this.momentum);
}

const _steps = <_StepMeta>[
  _StepMeta('🪪', 'Identity Check', "Prove you're a real person.", '~60 sec',
      'Every member passes a live selfie check — that’s why matches here actually show up.'),
  _StepMeta('✨', 'Drawn To', "What you're here for.", '~1 min',
      'Clear intent means better matches — and fewer wasted conversations.'),
  _StepMeta('💼', 'How You Live', 'Your lifestyle & standards.', '~1 min',
      'This shapes who you see and who sees you. Be honest — it pays off.'),
  _StepMeta('📸', 'Photos & Place', 'Almost there.', '~60 sec',
      'Real photos + your city unlock Discovery. You’re one step from matching.'),
];

class _VerificationScreenState extends State<VerificationScreen> {
  final _picker = ImagePicker();
  int _step = 0;
  bool _busy = false;
  String? _error;

  // Archetype drives which questions Steps 2 & 3 ask (mirrors the web flow).
  String _arch = '';
  // Step 1 — identity (live selfie only; no government ID at onboarding)
  bool _livenessDone = false;
  String _livenessResult = '';
  // Step 2 — "Drawn To" picks  (section.key → selected labels)
  final Map<String, List<String>> _drawn = {};
  // Step 3 — "How You Live" picks
  final Map<String, List<String>> _how = {};
  // Step 4 — about you, photos & place
  final _nameCtrl = TextEditingController();
  final _ageCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final List<String> _photoB64 = [];
  bool _openToTravel = false;

  int? get _age => int.tryParse(_ageCtrl.text.trim());

  @override
  void initState() {
    super.initState();
    _arch = widget.archetype;
    if (_arch.isEmpty) {
      // Re-entry without an archetype passed in — recover it from the profile.
      fetchProfile().then((p) {
        if (mounted && p.archetype.isNotEmpty) setState(() => _arch = p.archetype);
      }).catchError((_) {});
    }
  }

  bool get _stepComplete {
    switch (_step) {
      case 0: return _livenessDone;
      case 1: return drawnToRequiredKeys(_arch).every((k) => (_drawn[k]?.isNotEmpty ?? false));
      case 2: return howYouLiveRequiredKeys(_arch).every((k) => (_how[k]?.isNotEmpty ?? false));
      case 3:
        final a = _age;
        return _photoB64.isNotEmpty
            && _nameCtrl.text.trim().isNotEmpty
            && a != null && a >= 18 && a <= 120
            && _cityCtrl.text.trim().isNotEmpty;
      default: return false;
    }
  }

  @override
  void dispose() { _nameCtrl.dispose(); _ageCtrl.dispose(); _cityCtrl.dispose(); super.dispose(); }

  Future<String?> _capture({required ImageSource source, bool front = false}) async {
    final x = await _picker.pickImage(source: source, maxWidth: 1600, imageQuality: 85,
        preferredCameraDevice: front ? CameraDevice.front : CameraDevice.rear);
    if (x == null) return null;
    return base64Encode(await x.readAsBytes());
  }

  Future<void> _runLiveness() async {
    setState(() { _busy = true; _error = null; });
    try {
      final b64 = await _capture(source: ImageSource.camera, front: true);
      if (b64 == null) { setState(() => _busy = false); return; }
      // No idPhotoBase64 — the server runs a liveness-only check and stores this
      // selfie as the anchor face for a later government-ID match.
      final res = await verifyStep('liveness', {'selfieImage': b64, 'mimeType': 'image/jpeg'});
      final conf = res['confidence'] ?? (res['data'] is Map ? (res['data'] as Map)['confidence'] : null);
      setState(() {
        _busy = false; _livenessDone = true;
        _livenessResult = conf != null ? 'Live selfie · ${conf is num ? conf.round() : conf}%' : 'Selfie verified ✓';
      });
    } catch (e) {
      setState(() { _busy = false; _error = _err(e); });
    }
  }

  Future<void> _pickPhotos() async {
    // Cap at 3 (matches web) + modest downscale so the combined base64 payload
    // stays well under the serverless request-body limit — was hitting HTTP 413
    // (Payload Too Large) when several full-size photos were sent in one request.
    final files = await _picker.pickMultiImage(maxWidth: 1280, imageQuality: 80);
    if (files.isEmpty) return;
    final capped = files.take(3).toList();
    final imgs = <String>[];
    for (final f in capped) { imgs.add(base64Encode(await f.readAsBytes())); }
    if (!mounted) return;
    setState(() { _photoB64..clear()..addAll(imgs); });
  }

  /// Advance: submit the current step's data, then move on (or finish).
  Future<void> _continue() async {
    if (!_stepComplete || _busy) return;
    setState(() { _busy = true; _error = null; });
    try {
      switch (_step) {
        case 1:
          // Archetype-specific "Drawn To" picks (section.key → labels), matching web.
          await verifyStep('spending_or_qa', {'responses': _drawn, 'mimeType': 'application/json'});
          break;
        case 2:
          // Archetype-specific "How You Live" picks, matching web.
          await verifyStep('spending_or_qa', {'responses': _how, 'mimeType': 'application/json'});
          break;
        case 3:
          final labels = {for (var i = 0; i < _photoB64.length; i++) '$i': i == 0 ? 'main' : 'photo'};
          await verifyStep('photos', {
            'images': _photoB64,
            'mimeTypes': List.filled(_photoB64.length, 'image/jpeg'),
            'labels': labels,
            'city': _cityCtrl.text.trim(),
            'openToTravel': _openToTravel,
          });
          // Name + age are now collected here (no longer auto-filled from a government ID).
          try {
            await saveIdentity(firstName: _nameCtrl.text.trim(), age: _age, city: _cityCtrl.text.trim());
          } catch (_) {}
          break;
      }
      if (!mounted) return;
      if (_step >= _steps.length - 1) {
        widget.onDone();
      } else {
        setState(() { _busy = false; _step++; });
      }
    } catch (e) {
      setState(() { _busy = false; _error = _err(e); });
    }
  }

  /// Apply a Q&A selection. Multi sections cap at section.max (FIFO slide when
  /// full); single/card sections hold one pick (tap again to clear) — mirrors
  /// the web toggle()/pickSingle() behaviour.
  void _togglePick(Map<String, List<String>> map, QSection s, String label) {
    setState(() {
      final cur = List<String>.from(map[s.key] ?? const []);
      if (s.kind == QKind.multi) {
        if (cur.contains(label)) {
          cur.remove(label);
        } else if (cur.length >= s.max) {
          cur.removeAt(0);
          cur.add(label);
        } else {
          cur.add(label);
        }
        map[s.key] = cur;
      } else {
        map[s.key] = cur.contains(label) ? <String>[] : <String>[label];
      }
    });
  }

  /// Skip the CURRENT step only (mirrors the web's per-step "Skip this step" +
  /// confirmation) — advance to the next step, or finish if this is the last.
  /// Previously the top "Skip" called onDone() and abandoned the whole flow.
  Future<void> _skipStep() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        title: const Text('Skip this step?',
            style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w800)),
        content: const Text(
            'Skipping verification steps may reduce your trust score and limit your matches.',
            style: TextStyle(color: Color(Config.text2))),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Color(Config.text2))),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Skip anyway',
                style: TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _error = null);
    if (_step >= _steps.length - 1) {
      widget.onDone(); // last step skipped → enter the app (matches web)
    } else {
      setState(() => _step++);
    }
  }

  String _err(Object e) => e.toString().replaceFirst('Exception: ', '');

  @override
  Widget build(BuildContext context) {
    final meta = _steps[_step];
    final completed = _step + (_stepComplete ? 1 : 0);
    // Steps 2 & 3 use the archetype-specific hero title (e.g. "What you're drawn to.").
    final heroTitle = _step == 1
        ? drawnToTitle(_arch)
        : _step == 2
            ? howYouLiveTitle(_arch)
            : meta.title;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        leading: _step > 0
            ? IconButton(icon: const Icon(Icons.arrow_back, color: Color(Config.text1)), onPressed: _busy ? null : () => setState(() { _step--; _error = null; }))
            : null,
        title: Text('Step ${_step + 1} of ${_steps.length}',
            style: const TextStyle(color: Color(Config.text2), fontSize: 14, fontWeight: FontWeight.w600)),
        actions: [TextButton(onPressed: _busy ? null : _skipStep, child: const Text('Skip', style: TextStyle(color: Color(Config.text3))))],
      ),
      body: Column(children: [
        // Progress bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: completed / _steps.length, minHeight: 6,
              backgroundColor: const Color(0x221B1020),
              valueColor: const AlwaysStoppedAnimation(Color(Config.accent)),
            ),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
            children: [
              Text(meta.emoji, style: const TextStyle(fontSize: 44)),
              const SizedBox(height: 12),
              Text(heroTitle, style: const TextStyle(color: Color(Config.text1), fontSize: 26, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Row(children: [
                Text(meta.desc, style: const TextStyle(color: Color(Config.text2), fontSize: 15)),
                const SizedBox(width: 8),
                Text('· ${meta.time}', style: const TextStyle(color: Color(Config.text3), fontSize: 13)),
              ]),
              const SizedBox(height: 24),
              _stepBody(),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: const Color(0x22FF3B6B), borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  const Text('💚', style: TextStyle(fontSize: 16)),
                  const SizedBox(width: 10),
                  Expanded(child: Text(meta.momentum, style: const TextStyle(color: Color(Config.accent), fontSize: 13, height: 1.4))),
                ]),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
              ],
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: SizedBox(
              width: double.infinity, height: 54,
              child: FilledButton(
                onPressed: (_stepComplete && !_busy) ? _continue : null,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(Config.accent),
                  foregroundColor: const Color(0xFFFFFFFF),
                  disabledBackgroundColor: const Color(Config.bg3),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _busy
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFFFFFF)))
                    : Text(_step >= _steps.length - 1 ? 'Finish & enter' : 'Continue',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _stepBody() {
    switch (_step) {
      case 0:
        return Column(children: [
          _captureCard('🤳', 'Quick selfie', "A quick face check confirms you're a real person — no ID needed.", _livenessDone, _livenessResult,
              primaryLabel: 'Take selfie', onPrimary: _runLiveness),
        ]);
      case 1:
        return QaStep(sections: drawnToSections(_arch), picks: _drawn, onTap: (s, l) => _togglePick(_drawn, s, l));
      case 2:
        return QaStep(sections: howYouLiveSections(_arch), picks: _how, onTap: (s, l) => _togglePick(_how, s, l));
      case 3:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // About you — first name + age (collected here now that ID is gone from onboarding)
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: TextField(
                controller: _nameCtrl,
                textCapitalization: TextCapitalization.words,
                onChanged: (_) => setState(() {}),
                style: const TextStyle(color: Color(Config.text1)),
                decoration: InputDecoration(
                  labelText: 'First name',
                  labelStyle: const TextStyle(color: Color(Config.text2)),
                  filled: true, fillColor: const Color(Config.bg2),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              width: 96,
              child: TextField(
                controller: _ageCtrl,
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
                style: const TextStyle(color: Color(Config.text1)),
                decoration: InputDecoration(
                  labelText: 'Age',
                  labelStyle: const TextStyle(color: Color(Config.text2)),
                  filled: true, fillColor: const Color(Config.bg2),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 14),
          GestureDetector(
            onTap: _busy ? null : _pickPhotos,
            child: Container(
              height: 120,
              decoration: BoxDecoration(
                color: const Color(Config.bg2),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _photoB64.isNotEmpty ? const Color(Config.accent) : const Color(0x331B1020)),
              ),
              child: Center(child: _photoB64.isEmpty
                  ? const Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.add_a_photo_outlined, color: Color(Config.text2)),
                      SizedBox(height: 6),
                      Text('Add up to 3 photos', style: TextStyle(color: Color(Config.text2))),
                    ])
                  : Text('✓ ${_photoB64.length} photo${_photoB64.length == 1 ? '' : 's'} · tap to change',
                      style: const TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w600))),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _cityCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(color: Color(Config.text1)),
            decoration: InputDecoration(
              labelText: 'Your city',
              labelStyle: const TextStyle(color: Color(Config.text2)),
              filled: true, fillColor: const Color(Config.bg2),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => setState(() => _openToTravel = !_openToTravel),
            behavior: HitTestBehavior.opaque,
            child: Row(children: [
              Icon(_openToTravel ? Icons.check_box : Icons.check_box_outline_blank,
                  color: _openToTravel ? const Color(Config.accent) : const Color(Config.text3), size: 22),
              const SizedBox(width: 10),
              const Expanded(
                child: Text('✈️  Open to travel matches',
                    style: TextStyle(color: Color(Config.text1), fontSize: 14, fontWeight: FontWeight.w600)),
              ),
            ]),
          ),
        ]);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _captureCard(String emoji, String title, String sub, bool done, String result,
      {required String primaryLabel, VoidCallback? onPrimary, VoidCallback? onSecondary, String? disabledHint}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: done ? const Color(Config.accent) : const Color(0x181B1020)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 15)),
            Text(sub, style: const TextStyle(color: Color(Config.text2), fontSize: 13)),
          ])),
          if (done) const Icon(Icons.check_circle, color: Color(Config.accent)),
        ]),
        if (result.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(result, style: const TextStyle(color: Color(Config.accent), fontSize: 13)),
        ],
        const SizedBox(height: 12),
        Row(children: [
          OutlinedButton(
            onPressed: onPrimary,
            style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(Config.accent)), foregroundColor: const Color(Config.accent)),
            child: Text(done ? 'Redo' : primaryLabel),
          ),
          if (onSecondary != null) ...[
            const SizedBox(width: 10),
            TextButton(onPressed: onSecondary, child: const Text('Upload', style: TextStyle(color: Color(Config.text2)))),
          ],
          if (disabledHint != null) ...[
            const SizedBox(width: 10),
            Text(disabledHint, style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
          ],
        ]),
      ]),
    );
  }

}
