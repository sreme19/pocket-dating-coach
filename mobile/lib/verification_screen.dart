import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'api.dart';
import 'config.dart';

/// Native verification: ID scan → liveness selfie → intent → photos, each
/// submitted to /api/verified-vibe/verify-step (images as base64). On a real
/// device the camera captures real photos; on the emulator it still exercises
/// capture → upload → response. "Skip for now" lets onboarding complete.
class VerificationScreen extends StatefulWidget {
  final VoidCallback onDone;
  const VerificationScreen({super.key, required this.onDone});

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

enum _StepState { todo, working, done, error }

class _VerificationScreenState extends State<VerificationScreen> {
  final _picker = ImagePicker();
  String? _idPhotoB64;

  final Map<String, _StepState> _state = {
    'id': _StepState.todo,
    'liveness': _StepState.todo,
    'intent': _StepState.todo,
    'photos': _StepState.todo,
  };
  final Map<String, String> _result = {};

  bool get _allDone => _state.values.every((s) => s == _StepState.done);

  Future<String?> _capture({required ImageSource source, bool front = false}) async {
    final x = await _picker.pickImage(
      source: source,
      maxWidth: 1600,
      imageQuality: 85,
      preferredCameraDevice: front ? CameraDevice.front : CameraDevice.rear,
    );
    if (x == null) return null;
    final bytes = await x.readAsBytes();
    return base64Encode(bytes);
  }

  void _set(String step, _StepState s, [String? result]) {
    if (!mounted) return;
    setState(() {
      _state[step] = s;
      if (result != null) _result[step] = result;
    });
  }

  Future<void> _runId(ImageSource source) async {
    _set('id', _StepState.working);
    try {
      final b64 = await _capture(source: source);
      if (b64 == null) { _set('id', _StepState.todo); return; }
      _idPhotoB64 = b64;
      final res = await verifyStep('id', {'image': b64, 'mimeType': 'image/jpeg'});
      final name = res['idName'] ?? (res['data'] is Map ? (res['data'] as Map)['idName'] : null);
      _set('id', _StepState.done, name != null ? 'ID read: $name' : 'ID submitted');
    } catch (e) {
      _set('id', _StepState.error, _err(e));
    }
  }

  Future<void> _runLiveness() async {
    _set('liveness', _StepState.working);
    try {
      final b64 = await _capture(source: ImageSource.camera, front: true);
      if (b64 == null) { _set('liveness', _StepState.todo); return; }
      final res = await verifyStep('liveness', {
        'selfieImage': b64,
        'idPhotoBase64': _idPhotoB64 ?? '',
        'mimeType': 'image/jpeg',
      });
      final conf = res['confidence'] ?? (res['data'] is Map ? (res['data'] as Map)['confidence'] : null);
      _set('liveness', _StepState.done, conf != null ? 'Liveness · ${conf is num ? conf.round() : conf}%' : 'Selfie submitted');
    } catch (e) {
      _set('liveness', _StepState.error, _err(e));
    }
  }

  Future<void> _runIntent() async {
    _set('intent', _StepState.working);
    try {
      await verifyStep('spending_or_qa', {
        'responses': {'intent': 'serious'},
        'mimeType': 'application/json',
      });
      _set('intent', _StepState.done, 'Intent recorded');
    } catch (e) {
      _set('intent', _StepState.error, _err(e));
    }
  }

  Future<void> _runPhotos(ImageSource source) async {
    _set('photos', _StepState.working);
    try {
      final List<XFile> files = source == ImageSource.gallery
          ? await _picker.pickMultiImage(maxWidth: 1600, imageQuality: 85)
          : [if (await _picker.pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 85) case final x?) x];
      if (files.isEmpty) { _set('photos', _StepState.todo); return; }
      final images = <String>[];
      for (final f in files) {
        images.add(base64Encode(await f.readAsBytes()));
      }
      final labels = {for (var i = 0; i < images.length; i++) '$i': i == 0 ? 'main' : 'photo'};
      final res = await verifyStep('photos', {
        'images': images,
        'mimeTypes': List.filled(images.length, 'image/jpeg'),
        'labels': labels,
        'city': '',
        'openToTravel': true,
      });
      final url = res['avatarUrl'] ?? (res['data'] is Map ? (res['data'] as Map)['avatarUrl'] : null);
      _set('photos', _StepState.done, url != null ? '${images.length} photo(s) · lead set' : '${images.length} photo(s) uploaded');
    } catch (e) {
      _set('photos', _StepState.error, _err(e));
    }
  }

  String _err(Object e) => e.toString().replaceFirst('Exception: ', '');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('Get verified', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
        actions: [
          TextButton(onPressed: widget.onDone, child: const Text('Skip for now', style: TextStyle(color: Color(Config.text2)))),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(4, 8, 4, 16),
            child: Text('Every member is identity-verified. Four quick checks build your Trust Score.',
                style: TextStyle(color: Color(Config.text2), fontSize: 15, height: 1.4)),
          ),
          _stepCard(
            step: 'id', icon: '🪪', title: 'Government ID', sub: 'Scan your ID — proves you’re real.',
            onPrimary: () => _runId(ImageSource.camera), primaryLabel: 'Scan ID',
            onSecondary: () => _runId(ImageSource.gallery),
          ),
          _stepCard(
            step: 'liveness', icon: '🤳', title: 'Liveness selfie', sub: 'A quick selfie to match your ID.',
            onPrimary: _runLiveness, primaryLabel: 'Take selfie',
          ),
          _stepCard(
            step: 'intent', icon: '✨', title: 'Your intent', sub: 'What you’re here for.',
            onPrimary: _runIntent, primaryLabel: 'Confirm intent',
          ),
          _stepCard(
            step: 'photos', icon: '📸', title: 'Profile photos', sub: 'Add photos — first one is your lead.',
            onPrimary: () => _runPhotos(ImageSource.camera), primaryLabel: 'Take photo',
            onSecondary: () => _runPhotos(ImageSource.gallery),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity, height: 54,
            child: FilledButton(
              onPressed: _allDone ? widget.onDone : null,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accent),
                foregroundColor: const Color(0xFF052819),
                disabledBackgroundColor: const Color(Config.bg3),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(_allDone ? 'Enter Verified Vibe' : 'Finish all checks to continue',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stepCard({
    required String step,
    required String icon,
    required String title,
    required String sub,
    required VoidCallback onPrimary,
    required String primaryLabel,
    VoidCallback? onSecondary,
  }) {
    final s = _state[step]!;
    final done = s == _StepState.done;
    final working = s == _StepState.working;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: done ? const Color(Config.accent) : const Color(0x18FFFFFF)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(icon, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 16)),
              Text(sub, style: const TextStyle(color: Color(Config.text2), fontSize: 13)),
            ]),
          ),
          if (done) const Icon(Icons.check_circle, color: Color(Config.accent)),
        ]),
        if (_result[step] != null) ...[
          const SizedBox(height: 8),
          Text(_result[step]!,
              style: TextStyle(color: s == _StepState.error ? const Color(0xFFF87171) : const Color(Config.accent), fontSize: 13)),
        ],
        const SizedBox(height: 12),
        Row(children: [
          if (working)
            const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent))))
          else ...[
            OutlinedButton(
              onPressed: onPrimary,
              style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(Config.accent)), foregroundColor: const Color(Config.accent)),
              child: Text(done ? 'Redo' : primaryLabel),
            ),
            if (onSecondary != null) ...[
              const SizedBox(width: 10),
              TextButton(onPressed: onSecondary, child: const Text('Upload', style: TextStyle(color: Color(Config.text2)))),
            ],
          ],
        ]),
      ]),
    );
  }
}
