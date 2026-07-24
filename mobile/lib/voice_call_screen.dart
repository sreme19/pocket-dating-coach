import 'dart:async';
import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'season.dart';

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

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('voice_call');
  }

  // Live transcript. The agent worker forwards both sides of the call as text
  // streams on the `lk.transcription` topic (user STT + the bestie's spoken
  // words, synced to her audio). We surface them as captions on screen.
  TranscriptionStreamReceiver? _transcripts;
  StreamSubscription<ReceivedMessage>? _transcriptSub;
  final ScrollController _scroll = ScrollController();
  // Keyed by `${role}:${segmentId}` so user + agent segments never collide.
  // Insertion order (LinkedHashMap) = display order.
  final Map<String, _Caption> _captions = {};

  // Live agent state from the `lk.agent.state` participant attribute
  // (initializing / listening / thinking / speaking). Drives the "she's
  // thinking…" filler so dead air between turns reads as continuity, not a
  // dropped call.
  String? _agentStatus;
  Timer? _thinkingTimer;
  int _thinkingPhrase = 0;

  List<String> get _thinkingPhrases => [
        'Thinking…',
        'Reading your profile to understand you better…',
        "Looking into ${widget.name}'s profile…",
        'Gathering my thoughts…',
      ];

  Future<void> _start() async {
    AppLogger.instance.action('voice_call', 'start_call');
    setState(() => _phase = _Phase.connecting);
    try {
      final mic = await Permission.microphone.request();
      if (!mic.isGranted) {
        setState(() { _phase = _Phase.error; _error = 'Microphone access is needed for a voice call.'; });
        return;
      }
      final s = await startVoiceCall(widget.matchId);
      _ownerName = s.ownerName;

      final room = Room(
        roomOptions: const RoomOptions(
          adaptiveStream: true,
          dynacast: true,
        ),
      );
      final listener = room.createListener();
      listener
        ..on<RoomDisconnectedEvent>((_) => _onRemoteEnded())
        ..on<TrackSubscribedEvent>((e) {
          // Remote audio tracks (AI Bestie voice) — route to speaker so the
          // user can hear the agent without holding phone to ear.
          if (e.track is RemoteAudioTrack) {
            Hardware.instance.setSpeakerphoneOn(true);
          }
        })
        // The agent publishes its lifecycle as a participant attribute; we use
        // it to show a "thinking…" indicator while she composes a reply.
        ..on<ParticipantAttributesChanged>((e) => _onAgentAttrs(e.participant))
        ..on<ParticipantConnectedEvent>((e) => _onAgentAttrs(e.participant));
      _room = room;
      _listener = listener;

      await room.connect(s.wsUrl, s.token, fastConnectOptions: FastConnectOptions(
        microphone: const TrackOption(enabled: true),
      ));

      // Subscribe to live transcription text streams before the agent speaks.
      // The receiver registers its `lk.transcription` handler lazily on listen.
      final receiver = TranscriptionStreamReceiver(room: room);
      _transcripts = receiver;
      _transcriptSub = receiver.messages().listen(_onTranscript);

      // Route audio to speaker (earpiece off) before publishing mic
      await Hardware.instance.setSpeakerphoneOn(true);
      await room.localParticipant?.setMicrophoneEnabled(true);

      if (!mounted) return;
      setState(() => _phase = _Phase.live);
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _elapsed++);
      });
    } catch (e) {
      AppLogger.instance.error(e, screen: 'voice_call', action: 'start_call');
      setState(() { _phase = _Phase.error; _error = '$e'; });
    }
  }

  Future<void> _toggleMute() async {
    final lp = _room?.localParticipant;
    if (lp == null) return;
    AppLogger.instance.action('voice_call', 'mute_toggle');
    _muted = !_muted;
    await lp.setMicrophoneEnabled(!_muted);
    if (mounted) setState(() {});
  }

  void _onTranscript(ReceivedMessage msg) {
    final content = msg.content;
    final bool isUser;
    if (content is UserTranscript) {
      isUser = true;
    } else if (content is AgentTranscript) {
      isUser = false;
    } else {
      return; // ignore loopback / other content
    }
    final text = content.text.trim();
    if (text.isEmpty) return;
    final key = '${isUser ? 'u' : 'a'}:${msg.id}';
    final existing = _captions[key];
    if (existing != null) {
      existing.text = text;
    } else {
      _captions[key] = _Caption(isUser: isUser, text: text);
    }
    // Once she's actually speaking, drop the "thinking…" filler immediately so
    // it never overlaps her words (the agent-state attribute can lag the first
    // transcript chunk by a beat).
    if (!isUser && _agentStatus != 'speaking') {
      _agentStatus = 'speaking';
      _syncThinkingTimer();
    }
    // The transcript ListView is reverse:true, so it stays pinned to the newest
    // line automatically — no manual scrolling needed.
    if (mounted) setState(() {});
  }

  void _onAgentAttrs(Participant p) {
    final raw = p.attributes['lk.agent.state'];
    if (raw == null || raw == _agentStatus) return; // not the agent, or no change
    _agentStatus = raw;
    _syncThinkingTimer();
    if (mounted) setState(() {});
  }

  // Run a phrase-rotation timer only while she's thinking; stop it otherwise.
  void _syncThinkingTimer() {
    final thinking = _agentStatus == 'thinking';
    if (thinking && _thinkingTimer == null) {
      _thinkingPhrase = 0;
      _thinkingTimer = Timer.periodic(const Duration(milliseconds: 2600), (_) {
        if (!mounted) return;
        setState(() => _thinkingPhrase = (_thinkingPhrase + 1) % _thinkingPhrases.length);
      });
    } else if (!thinking && _thinkingTimer != null) {
      _thinkingTimer!.cancel();
      _thinkingTimer = null;
    }
  }

  void _onRemoteEnded() {
    _timer?.cancel();
    if (mounted && _phase != _Phase.ended) setState(() => _phase = _Phase.ended);
  }

  Future<void> _hangUp() async {
    AppLogger.instance.action('voice_call', 'end_call');
    _timer?.cancel();
    await _room?.disconnect();
    _onRemoteEnded();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _thinkingTimer?.cancel();
    _transcriptSub?.cancel();
    _transcripts?.dispose();
    _scroll.dispose();
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
        return _center(CircularProgressIndicator(color: Brand.accent), 'Connecting you to ${widget.name}’s bestie…');
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
            backgroundColor: Brand.accent,
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
      const SizedBox(height: 4),
      Container(
        width: 84, height: 84,
        decoration: const BoxDecoration(color: Color(0x33A855F7), shape: BoxShape.circle),
        child: const Center(child: Text('💚', style: TextStyle(fontSize: 40))),
      ),
      const SizedBox(height: 12),
      Text("${widget.name}'s AI bestie",
          style: const TextStyle(color: Color(Config.text1), fontSize: 18, fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      Text(_clock, style: TextStyle(color: Brand.accent, fontSize: 15, fontWeight: FontWeight.w600)),
      const SizedBox(height: 14),
      Expanded(child: _transcriptView()),
      _statusPill(),
      const SizedBox(height: 10),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        _circleBtn(_muted ? Icons.mic_off : Icons.mic, _muted ? const Color(0xFFF59E0B) : const Color(Config.text1),
            const Color(Config.bg3), _toggleMute),
        const SizedBox(width: 32),
        _circleBtn(Icons.call_end, Colors.white, const Color(0xFFF87171), _hangUp, big: true),
      ]),
      const SizedBox(height: 12),
      Text(_muted ? 'Muted' : 'Tap the red button to end',
          style: const TextStyle(color: Color(Config.text3), fontSize: 13)),
      const SizedBox(height: 12),
    ]);
  }

  Widget _transcriptView() {
    if (_captions.isEmpty) {
      return Center(
        child: Text(
          'Say hi to get started…',
          style: const TextStyle(color: Color(Config.text3), fontSize: 14),
        ),
      );
    }
    // Newest last in _captions; reverse so index 0 (rendered at the bottom in a
    // reverse list) is the latest line. A reverse ListView stays pinned to the
    // bottom as new lines stream in — the user never has to scroll down — while
    // still letting them scroll up to read earlier turns.
    final items = _captions.values.toList(growable: false).reversed.toList(growable: false);
    return ShaderMask(
      // Fade the top edge so older lines dissolve as they scroll up.
      shaderCallback: (rect) => const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Colors.transparent, Colors.black, Colors.black],
        stops: [0.0, 0.08, 1.0],
      ).createShader(rect),
      blendMode: BlendMode.dstIn,
      child: ListView.builder(
        controller: _scroll,
        reverse: true,
        padding: const EdgeInsets.symmetric(vertical: 6),
        itemCount: items.length,
        itemBuilder: (_, i) => _bubble(items[i]),
      ),
    );
  }

  /// "She's thinking…" / "Connecting…" filler shown below the transcript while
  /// the bestie isn't speaking, so gaps between turns read as continuity rather
  /// than a dropped call. Collapses to nothing once she's listening/speaking.
  Widget _statusPill() {
    final status = _agentStatus;
    String? label;
    if (status == null || status == 'initializing') {
      label = "Connecting you with ${widget.name}'s bestie…";
    } else if (status == 'thinking') {
      label = _thinkingPhrases[_thinkingPhrase];
    }
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
      child: label == null
          ? const SizedBox(width: double.infinity, height: 0)
          : Padding(
              key: ValueKey(label),
              padding: const EdgeInsets.only(top: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  decoration: BoxDecoration(
                    color: const Color(Config.bg2),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 14, height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Brand.accent),
                      ),
                      const SizedBox(width: 10),
                      Flexible(
                        child: Text(
                          label,
                          style: const TextStyle(
                            color: Color(Config.text2),
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _bubble(_Caption c) {
    final isUser = c.isUser;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: EdgeInsets.only(top: 8, left: isUser ? 44 : 0, right: isUser ? 0 : 44),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isUser ? Brand.accentTint : const Color(Config.bg2),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isUser ? 'You' : "${widget.name}'s bestie",
              style: TextStyle(
                color: isUser ? Brand.accentBright : const Color(Config.text3),
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              c.text,
              textAlign: isUser ? TextAlign.right : TextAlign.left,
              style: const TextStyle(color: Color(Config.text1), fontSize: 15, height: 1.35),
            ),
          ],
        ),
      ),
    );
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
    final content = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(width: 40, height: 40, child: icon),
        const SizedBox(height: 16),
        SizedBox(
          width: 260,
          child: Text(msg, textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2), fontSize: 15, height: 1.5)),
        ),
      ],
    );
    if (!showClose) return Center(child: content);
    return Column(children: [
      const Spacer(),
      content,
      const Spacer(),
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

/// A single live caption line. [isUser] true = the caller (you), false = the
/// bestie. [text] is the latest full text for the transcript segment.
class _Caption {
  final bool isUser;
  String text;
  _Caption({required this.isUser, required this.text});
}
