import 'dart:async';
import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';
import 'api.dart';
import 'config.dart';

/// Live voice call with a match's AI bestie. Joins the LiveKit room minted by
/// /api/voice/calls/start; the agent (server-side) speaks back. Audio-only.
class VoiceCallScreen extends StatefulWidget {
  final String matchId;
  final String name;
  const VoiceCallScreen({super.key, required this.matchId, required this.name});

  @override
  State<VoiceCallScreen> createState() => _VoiceCallScreenState();
}

enum _Phase { consent, connecting, live, ended, error }

class _VoiceCallScreenState extends State<VoiceCallScreen> {
  _Phase _phase = _Phase.consent;
  Room? _room;
  EventsListener<RoomEvent>? _listener;
  Timer? _timer;
  int _elapsed = 0;
  bool _muted = false;
  String _ownerName = '';
  String? _error;

  Future<void> _start() async {
    setState(() => _phase = _Phase.connecting);
    try {
      final mic = await Permission.microphone.request();
      if (!mic.isGranted) {
        setState(() { _phase = _Phase.error; _error = 'Microphone access is needed for a voice call.'; });
        return;
      }
      final s = await startVoiceCall(widget.matchId);
      _ownerName = s.ownerName;
      final room = Room();
      final listener = room.createListener();
      listener.on<RoomDisconnectedEvent>((_) => _onRemoteEnded());
      _room = room;
      _listener = listener;
      await room.connect(s.wsUrl, s.token);
      await room.localParticipant?.setMicrophoneEnabled(true);
      if (!mounted) return;
      setState(() => _phase = _Phase.live);
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _elapsed++);
      });
    } catch (e) {
      setState(() { _phase = _Phase.error; _error = '$e'; });
    }
  }

  Future<void> _toggleMute() async {
    final lp = _room?.localParticipant;
    if (lp == null) return;
    _muted = !_muted;
    await lp.setMicrophoneEnabled(!_muted);
    if (mounted) setState(() {});
  }

  void _onRemoteEnded() {
    _timer?.cancel();
    if (mounted && _phase != _Phase.ended) setState(() => _phase = _Phase.ended);
  }

  Future<void> _hangUp() async {
    _timer?.cancel();
    await _room?.disconnect();
    _onRemoteEnded();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _listener?.dispose();
    _room?.dispose();
    super.dispose();
  }

  String get _clock {
    final m = (_elapsed ~/ 60).toString().padLeft(2, '0');
    final s = (_elapsed % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      body: SafeArea(child: Padding(
        padding: const EdgeInsets.all(28),
        child: _byPhase(),
      )),
    );
  }

  Widget _byPhase() {
    switch (_phase) {
      case _Phase.consent:
        return _consent();
      case _Phase.connecting:
        return _center(const CircularProgressIndicator(color: Color(Config.accent)), 'Connecting you to ${widget.name}’s bestie…');
      case _Phase.error:
        return _center(const Text('⚠️', style: TextStyle(fontSize: 40)), _error ?? 'Something went wrong.', showClose: true);
      case _Phase.ended:
        return _center(const Text('👋', style: TextStyle(fontSize: 40)),
            'Call ended. ${_ownerName.isNotEmpty ? _ownerName : widget.name}’s bestie is writing a recap in the chat…', showClose: true);
      case _Phase.live:
        return _live();
    }
  }

  Widget _consent() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Spacer(),
      const Center(child: Text('📞', style: TextStyle(fontSize: 56))),
      const SizedBox(height: 20),
      Text("Talk to ${widget.name}'s AI bestie",
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(Config.text1), fontSize: 22, fontWeight: FontWeight.w800)),
      const SizedBox(height: 14),
      const Text(
        "You'll have a live voice chat with her AI bestie to get a sense of who she is. The call may be recorded, and a short recap is shared back into your chat.",
        textAlign: TextAlign.center,
        style: TextStyle(color: Color(Config.text2), fontSize: 15, height: 1.5),
      ),
      const Spacer(),
      SizedBox(
        height: 54,
        child: FilledButton.icon(
          onPressed: _start,
          icon: const Icon(Icons.call),
          label: const Text('I understand — call', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(Config.accent),
            foregroundColor: const Color(0xFFFFFFFF),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
      const SizedBox(height: 10),
      TextButton(onPressed: () => Navigator.of(context).pop(),
          child: const Text('Not now', style: TextStyle(color: Color(Config.text2)))),
    ]);
  }

  Widget _live() {
    return Column(children: [
      const Spacer(),
      Container(
        width: 120, height: 120,
        decoration: const BoxDecoration(color: Color(0x33A855F7), shape: BoxShape.circle),
        child: const Center(child: Text('💚', style: TextStyle(fontSize: 56))),
      ),
      const SizedBox(height: 20),
      Text("${widget.name}'s AI bestie",
          style: const TextStyle(color: Color(Config.text1), fontSize: 20, fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      Text(_clock, style: const TextStyle(color: Color(Config.accent), fontSize: 16, fontWeight: FontWeight.w600)),
      const Spacer(),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        _circleBtn(_muted ? Icons.mic_off : Icons.mic, _muted ? const Color(0xFFF59E0B) : const Color(Config.text1),
            const Color(Config.bg3), _toggleMute),
        const SizedBox(width: 32),
        _circleBtn(Icons.call_end, Colors.white, const Color(0xFFF87171), _hangUp, big: true),
      ]),
      const SizedBox(height: 16),
      Text(_muted ? 'Muted' : 'Tap the red button to end',
          style: const TextStyle(color: Color(Config.text3), fontSize: 13)),
      const SizedBox(height: 20),
    ]);
  }

  Widget _circleBtn(IconData icon, Color fg, Color bg, VoidCallback onTap, {bool big = false}) {
    final size = big ? 72.0 : 60.0;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size, height: size,
        decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
        child: Icon(icon, color: fg, size: big ? 32 : 26),
      ),
    );
  }

  Widget _center(Widget icon, String msg, {bool showClose = false}) {
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Spacer(),
      icon,
      const SizedBox(height: 16),
      Text(msg, textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2), fontSize: 15, height: 1.5)),
      const Spacer(),
      if (showClose)
        SizedBox(
          height: 50,
          width: double.infinity,
          child: FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(Config.bg3),
              foregroundColor: const Color(Config.text1),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Done'),
          ),
        ),
    ]);
  }
}
