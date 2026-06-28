import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'config.dart';

/// Minimal front-facing selfie capture screen.
///
/// Returns the captured image file path via `Navigator.pop(context, path)`, or
/// `null` if the user cancels. Used where a flow needs a selfie and the default
/// `image_picker` camera can't reliably force the front lens on Android
/// (`preferredCameraDevice` is only a hint most OEM camera apps ignore). This
/// uses the `camera` package directly so the front camera is guaranteed.
class SelfieCameraScreen extends StatefulWidget {
  const SelfieCameraScreen({super.key});

  @override
  State<SelfieCameraScreen> createState() => _SelfieCameraScreenState();
}

class _SelfieCameraScreenState extends State<SelfieCameraScreen> {
  CameraController? _ctrl;
  String? _err;
  bool _capturing = false;

  @override
  void initState() {
    super.initState();
    _open();
  }

  @override
  void dispose() {
    _ctrl?.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    try {
      final cams = await availableCameras();
      if (cams.isEmpty) throw Exception('No cameras found.');
      final front = cams.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cams.first,
      );
      final ctrl = CameraController(front, ResolutionPreset.high, enableAudio: false);
      await ctrl.initialize();
      if (!mounted) {
        ctrl.dispose();
        return;
      }
      setState(() => _ctrl = ctrl);
    } catch (e) {
      if (mounted) {
        setState(() => _err = 'Camera unavailable. Please allow camera access in Settings, then try again.');
      }
    }
  }

  Future<void> _capture() async {
    final ctrl = _ctrl;
    if (ctrl == null || !ctrl.value.isInitialized || _capturing) return;
    setState(() => _capturing = true);
    try {
      final x = await ctrl.takePicture();
      if (mounted) Navigator.pop(context, x.path);
    } catch (e) {
      if (mounted) setState(() {
        _capturing = false;
        _err = 'Capture failed. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    if (_err != null) {
      return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.no_photography_rounded, color: Color(0xFFF87171), size: 48),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text(_err!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFFF87171), fontSize: 14, height: 1.4)),
        ),
        const SizedBox(height: 24),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close', style: TextStyle(color: Colors.white70)),
        ),
      ]);
    }

    final ctrl = _ctrl;
    if (ctrl == null || !ctrl.value.isInitialized) {
      return const Center(child: CircularProgressIndicator(color: Colors.white));
    }

    return Stack(alignment: Alignment.center, children: [
      Positioned.fill(child: CameraPreview(ctrl)),
      const Positioned(
        top: 16,
        left: 24,
        right: 24,
        child: Column(children: [
          Text('Center your face',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
          SizedBox(height: 4),
          Text('Look straight into the camera and hold still',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70, fontSize: 12)),
        ]),
      ),
      Positioned(
        bottom: 32,
        child: Column(children: [
          GestureDetector(
            onTap: _capture,
            child: Container(
              width: 74,
              height: 74,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
                border: Border.all(color: const Color(Config.accent), width: 4),
              ),
              child: _capturing
                  ? const Padding(
                      padding: EdgeInsets.all(22),
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)))
                  : const Icon(Icons.camera_alt_rounded, color: Color(Config.accent), size: 32),
            ),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: _capturing ? null : () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Colors.white70)),
          ),
        ]),
      ),
    ]);
  }
}
