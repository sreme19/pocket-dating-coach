import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'match_profile_screen.dart';
import 'push_service.dart';
import 'voice_call_screen.dart';

class ConversationScreen extends StatefulWidget {
  final String conversationId;
  final String title;
  /// Called the moment the screen starts to be dismissed (before animation).
  /// Use this to trigger a chat-list refresh as early as possible.
  final VoidCallback? onReturn;
  const ConversationScreen({super.key, required this.conversationId, required this.title, this.onReturn});

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  final List<ChatMessage> _messages = [];
  final Set<String> _ids = {};
  String get _myId => Supabase.instance.client.auth.currentUser?.id ?? '';

  bool _loading = true;
  bool _sending = false;
  String? _error;
  Timer? _poll;
  RealtimeChannel? _channel;
  RealtimeChannel? _presenceChannel;
  bool _partnerOnline = false;
  String? _otherId;
  String? _otherAvatar;
  String _otherName = '';
  String? _otherGender;
  String? _viewerGender;
  String _myName = '';
  String? _myAvatar;
  bool _bestieActive = true; // per-match AI Bestie state (woman's side)
  bool _bestieBannerDismissed = false; // woman's banner dismiss flag
  bool _manBannerDismissed = false;    // man's banner dismiss flag
  ProofRequest? _proofRequest;         // Bestie's open in-chat proof ask (man's side)
  bool _proofUploading = false;        // verification in progress
  bool _bestieCardCollapsed = false;
  BestieChecklist? _checklist;         // Bestie's per-man checklist (drives progress + freeze)
  bool _awaitingHandoff = false;       // local freeze fallback after a 409 send rejection

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('conversation');
    _initialLoad();
    fetchCurrentUserGender().then((g) { if (mounted) setState(() => _viewerGender = g); });
    _subscribeRealtime();
    _subscribePresence();
    // Polling backstop
    _poll = Timer.periodic(const Duration(seconds: 5), (_) => _pollOnce());
  }

  @override
  void dispose() {
    _poll?.cancel();
    if (_channel != null) Supabase.instance.client.removeChannel(_channel!);
    if (_presenceChannel != null) Supabase.instance.client.removeChannel(_presenceChannel!);
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _subscribePresence() {
    // Use the same global channel as ChatListScreen so users tracked anywhere
    // in the app (chat list OR another conversation) show as Online here.
    final ch = Supabase.instance.client.channel('presence:online-users');
    ch.onPresenceSync((_) {
      if (!mounted) return;
      final state = ch.presenceState();
      final otherOnline = state.any(
        (s) => s.presences.any((p) => p.payload['uid']?.toString() == _otherId),
      );
      setState(() => _partnerOnline = otherOnline);
    });
    ch.subscribe((status, _) async {
      if (status == RealtimeSubscribeStatus.subscribed) {
        await ch.track({'uid': _myId});
      }
    });
    _presenceChannel = ch;
  }

  void _merge(List<ChatMessage> incoming, {bool scroll = false}) {
    var added = false;
    for (final m in incoming) {
      if (m.id.isEmpty || _ids.contains(m.id)) continue;
      _ids.add(m.id);
      _messages.add(m);
      added = true;
    }
    if (added) {
      _messages.sort((a, b) =>
          (a.createdAt ?? DateTime(0)).compareTo(b.createdAt ?? DateTime(0)));
      if (mounted) setState(() {});
      if (scroll) _scrollToBottom();
    }
  }

  Future<void> _initialLoad() async {
    AppLogger.instance.action('conversation', 'load_messages');
    try {
      // Refresh session if expired before loading
      try { await Supabase.instance.client.auth.refreshSession(); } catch (_) {
        AppLogger.instance.error('refresh_session failed', screen: 'conversation', action: 'refresh_session');
      }
      final thread = await fetchConversation(widget.conversationId);
      _otherId = thread.otherId;
      _otherAvatar = thread.otherAvatar;
      _otherName = thread.otherName;
      _otherGender = thread.otherGender;
      _bestieActive = thread.aiBestieActive;
      _proofRequest = thread.proofRequest;
      _checklist = thread.bestieChecklist;
      _merge(thread.messages, scroll: true);
      // Re-check presence now that _otherId is known — fixes race condition
      // where onPresenceSync fired before _initialLoad completed (Android).
      if (_presenceChannel != null) {
        final ps = _presenceChannel!.presenceState();
        final online = ps.any(
          (s) => s.presences.any((p) => p.payload['uid']?.toString() == _otherId),
        );
        if (mounted) setState(() => _partnerOnline = online);
      }
      // Fetch current user's name + avatar for bubble display
      try {
        final me = await Supabase.instance.client
            .from('verified_vibe_users')
            .select('first_name, avatar_url')
            .eq('id', _myId)
            .maybeSingle();
        if (me != null) {
          _myName = (me['first_name'] ?? '').toString();
          _myAvatar = me['avatar_url'] as String?;
        }
      } catch (_) {
        AppLogger.instance.error('load_user_profile failed', screen: 'conversation', action: 'load_user_profile');
      }
      if (mounted) setState(() => _loading = false);
      markConversationRead(widget.conversationId).catchError((_) {});
    } catch (e) {
      AppLogger.instance.error(e, screen: 'conversation', action: 'initial_load');
      final msg = e.toString();
      final friendly = msg.contains('401') || msg.contains('Unauthorized')
          ? 'Session expired — please close and reopen the app.'
          : 'Could not load messages. Check your connection.';
      if (mounted) setState(() { _loading = false; _error = friendly; });
    }
  }

  Future<void> _pollOnce() async {
    try {
      final thread = await fetchConversation(widget.conversationId);
      _merge(thread.messages);
      // Keep the proof-request state live — this is what makes the 📎 appear the
      // moment her Bestie asks (and disappear on refusal/fulfilment). Don't stomp
      // a local in-flight upload's optimistic state while _proofUploading.
      final proofChanged = !_proofUploading &&
          (thread.proofRequest?.status != _proofRequest?.status ||
           thread.proofRequest?.category != _proofRequest?.category);
      // Keep the checklist live so the man's counter fills + his chat freezes the
      // moment Bestie wraps up (and the woman's step-in prompt appears).
      final checklistChanged = thread.bestieChecklist?.status != _checklist?.status ||
          thread.bestieChecklist?.done != _checklist?.done ||
          thread.bestieChecklist?.total != _checklist?.total;
      if (mounted && (thread.aiBestieActive != _bestieActive || proofChanged || checklistChanged)) {
        setState(() {
          if (thread.aiBestieActive != _bestieActive) {
            _bestieActive = thread.aiBestieActive;
            _bestieBannerDismissed = false; // re-show banner on status change
            _manBannerDismissed = false;
          }
          if (proofChanged) _proofRequest = thread.proofRequest;
          if (checklistChanged) _checklist = thread.bestieChecklist;
        });
      }
    } catch (_) {
      AppLogger.instance.error('load_thread_state failed', screen: 'conversation', action: 'load_thread_state');
      /* transient */
    }
  }

  void _subscribeRealtime() {
    final ch = Supabase.instance.client.channel('match:${widget.conversationId}:messages');
    ch.onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'verified_vibe_messages',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'match_id',
        value: widget.conversationId,
      ),
      callback: (payload) {
        try {
          final msg = ChatMessage.fromApi(payload.newRecord);
          _merge([msg], scroll: true);
          // If the incoming message is from the other person (e.g. AI Bestie
          // reply that arrives after we marked read), immediately re-stamp
          // last_read_at so the badge stays clear while we're in this screen.
          if (msg.senderId != _myId) {
            markConversationRead(widget.conversationId).catchError((_) {});
          }
        } catch (_) {
          AppLogger.instance.error('mark_read failed', screen: 'conversation', action: 'mark_read');
        }
      },
    ).subscribe();
    _channel = ch;
  }

  void _scrollToBottom() {
    // ListView is reversed, so position 0 = newest message (bottom of screen).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(0,
            duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _send() async {
    final text = _composer.text.trim();
    if (text.isEmpty || _sending) return;
    AppLogger.instance.action('conversation', 'send_message');
    setState(() => _sending = true);
    _composer.clear();
    try {
      final sent = await sendMessage(widget.conversationId, text);
      if (sent != null) _merge([sent], scroll: true);
      // The woman sending her own message = stepping in → backend deactivates
      // her Bestie. Reflect it optimistically (poll reconciles).
      if (_viewerGender == 'woman' && _bestieActive && mounted) {
        setState(() => _bestieActive = false);
      }
    } on AwaitingHandoffException catch (e) {
      // Wrap-up freeze (Option A): Bestie handed off and is on hold for the woman.
      // Flip to the frozen composer instead of a generic error. His text never sent.
      if (mounted) {
        setState(() => _awaitingHandoff = true);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (e) {
      AppLogger.instance.error(e, screen: 'conversation', action: 'send_message');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Send failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
    // Poll in background to catch an AI auto-reply (does not block the send button).
    Future(() async {
      for (var i = 0; i < 12; i++) {
        await Future.delayed(const Duration(milliseconds: 1250));
        await _pollOnce();
      }
    });
  }

  /// Replaces the man's composer once Bestie has wrapped up (Option A freeze): he
  /// can't send until the woman steps in. Her reply lifts this (Bestie deactivates).
  Widget _frozenComposer() {
    final name = _otherName.isNotEmpty ? _otherName : widget.title;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Row(children: [
        const Text('✨', style: TextStyle(fontSize: 16)),
        const SizedBox(width: 10),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(color: Color(Config.text2), fontSize: 12.5, height: 1.4),
              children: [
                const TextSpan(text: 'AI Bestie has everything it needs and asked '),
                TextSpan(text: name, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
                const TextSpan(text: " to jump in. Hang tight — she'll take it from here."),
              ],
            ),
          ),
        ),
      ]),
    );
  }

  Future<void> _resumeBestie() async {
    setState(() => _bestieActive = true); // optimistic
    try {
      await activateBestie(widget.conversationId);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'conversation', action: 'activate_bestie');
      if (mounted) {
        setState(() => _bestieActive = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not resume Bestie: $e')));
      }
    }
  }

  /// True when the viewer is a man and the woman's AI Bestie is currently the
  /// proxy speaker in this thread — i.e. he is NOT yet talking to her directly.
  /// Drives the header identity and the intro card so the man always knows up
  /// front he's talking to her Bestie, not her.
  bool get _bestieIsProxy =>
      _viewerGender == 'man' && _otherGender == 'woman' && _bestieActive;

  /// Progress toward the woman stepping in, from Bestie's per-man CHECKLIST (spec
  /// §D/§F) — NOT a fixed 5. `_itemsDone` is how many items she has checked off,
  /// `_itemsTotal` is how many she chose for THIS man. Both 0 until the checklist
  /// has been generated (the very first moments of the thread).
  int get _itemsDone => _checklist?.done ?? 0;
  int get _itemsTotal => _checklist?.total ?? 0;

  /// The MAN's chat is frozen once Bestie has wrapped up her checklist and is on
  /// hold for the woman to step in (spec §F/§K, Option A). `_awaitingHandoff` is a
  /// local fallback set when the send route rejects a send with 409.
  bool get _manFrozen => _bestieIsProxy && ((_checklist?.wrapped ?? false) || _awaitingHandoff);

  /// First-class transparency + path-plan card shown to the MALE match while
  /// the woman's AI Bestie is the proxy speaker. Ports the web `bestie-intro-card`
  /// so the man (a) knows up front he's talking to her Bestie — not her — and
  /// (b) sees concrete progress toward her stepping in. Fills the top void that
  /// sparse threads otherwise leave blank.
  Widget _bestieIntroCard() {
    final name = _otherName.isNotEmpty ? _otherName : widget.title;
    final done = _itemsDone;
    final total = _itemsTotal;
    final wrapped = _checklist?.wrapped ?? false;
    final hasChecklist = total > 0;
    final progress = hasChecklist ? done / total : 0.0;
    // Collapsed pill / header label reflects the checklist state.
    final progressLabel = wrapped ? 'done ✓' : (hasChecklist ? '$done/$total cleared' : '…');
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 2),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x33FF3B6B)),
        boxShadow: const [
          BoxShadow(color: Color(0x14FF3B6B), blurRadius: 14, offset: Offset(0, 6)),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(
          onTap: () => setState(() => _bestieCardCollapsed = !_bestieCardCollapsed),
          behavior: HitTestBehavior.opaque,
          child: Row(children: [
            Container(
              width: 34, height: 34,
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFFFF3B6B), Color(0xFFBF5AF2)]),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.auto_awesome, size: 17, color: Colors.white),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('AI Bestie',
                    style: TextStyle(color: Color(Config.text1), fontSize: 14, fontWeight: FontWeight.w700)),
                Text('${name.toUpperCase()}\'S AI BESTIE',
                    style: const TextStyle(
                        color: Color(Config.text3), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.6)),
              ]),
            ),
            if (_bestieCardCollapsed)
              Text(progressLabel,
                  style: const TextStyle(color: Color(Config.accent), fontSize: 11, fontWeight: FontWeight.w700)),
            const SizedBox(width: 6),
            Icon(
              _bestieCardCollapsed ? Icons.keyboard_arrow_down : Icons.keyboard_arrow_up,
              size: 18,
              color: const Color(Config.text3),
            ),
          ]),
        ),
        if (!_bestieCardCollapsed) ...[
          const SizedBox(height: 12),
          RichText(
            text: TextSpan(
              style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4),
              children: [
                TextSpan(text: name, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
                const TextSpan(text: ' asked her AI Bestie to get to know you first. Anything you share here, '),
                TextSpan(text: name, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
                const TextSpan(text: ' sees — directly, or summarised. Bring your best.'),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (hasChecklist || wrapped) ...[
            Row(children: [
              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w600),
                    children: [
                      TextSpan(text: name, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
                      TextSpan(text: wrapped ? ' is stepping in' : ' joins in'),
                    ],
                  ),
                ),
              ),
              Text(progressLabel,
                  style: const TextStyle(color: Color(Config.accent), fontSize: 12, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 7),
            Row(children: [
              const Text('★', style: TextStyle(color: Color(Config.accent), fontSize: 13)),
              const SizedBox(width: 6),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    height: 7,
                    color: const Color(0x14FF3B6B),
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: wrapped ? 1.0 : progress,
                      child: Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(colors: [Color(0xFFFF3B6B), Color(0xFFBF5AF2)]),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ]),
            const SizedBox(height: 9),
          ],
          Text(
            wrapped
                ? 'AI Bestie has everything it needs — $name has been asked to jump in.'
                : (hasChecklist
                    ? 'She can also drop in herself, any time.'
                    : 'AI Bestie is getting to know you. She can also drop in herself, any time.'),
            style: const TextStyle(color: Color(Config.text3), fontSize: 11.5, fontStyle: FontStyle.italic),
          ),
        ],
      ]),
    );
  }

  /// Explicit hand-off notice for the MALE match once the woman steps in and
  /// her Bestie is no longer the proxy (spec §C9 — the hand-off is never
  /// silent). Persists while the thread is direct, so re-opening still shows it.
  Widget _directHandoffBanner() {
    if (_manBannerDismissed) return const SizedBox.shrink();
    final name = _otherName.isNotEmpty ? _otherName : widget.title;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 2),
      padding: const EdgeInsets.fromLTRB(12, 4, 4, 4),
      decoration: BoxDecoration(
        color: const Color(0x1422C55E),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0x3322C55E)),
      ),
      child: Row(children: [
        const Text('💚', style: TextStyle(fontSize: 14)),
        const SizedBox(width: 8),
        Expanded(
          child: Text("You're now talking to $name directly.",
              style: const TextStyle(color: Color(0xFF22C55E), fontSize: 12, fontWeight: FontWeight.w600)),
        ),
        IconButton(
          icon: const Icon(Icons.close, size: 16, color: Color(0xFF22C55E)),
          onPressed: () => setState(() => _manBannerDismissed = true),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
          tooltip: 'Dismiss',
        ),
      ]),
    );
  }

  /// Per-match AI Bestie status, shown to the woman only. When active, an
  /// info pill (sending a message steps in); when off, a Resume button.
  Widget _bestieBanner() {
    if (_bestieBannerDismissed) return const SizedBox.shrink();
    if (_bestieActive) {
      return Container(
        margin: const EdgeInsets.fromLTRB(16, 6, 16, 0),
        padding: const EdgeInsets.fromLTRB(12, 4, 4, 4),
        decoration: BoxDecoration(
          color: const Color(0x1422C55E),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0x3322C55E)),
        ),
        child: Row(children: [
          const Text('💚', style: TextStyle(fontSize: 14)),
          const SizedBox(width: 8),
          const Expanded(
            child: Text('AI Bestie is chatting on your behalf — send a message any time to step in.',
                style: TextStyle(color: Color(0xFF22C55E), fontSize: 12, fontWeight: FontWeight.w600)),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 16, color: Color(0xFF22C55E)),
            onPressed: () => setState(() => _bestieBannerDismissed = true),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            tooltip: 'Dismiss',
          ),
        ]),
      );
    }
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 0),
      padding: const EdgeInsets.fromLTRB(12, 4, 4, 4),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0x33EC4899)),
      ),
      child: Row(children: [
        const Expanded(
          child: Text("You're handling this chat. Hand it back any time.",
              style: TextStyle(color: Color(Config.text2), fontSize: 12)),
        ),
        TextButton.icon(
          onPressed: _resumeBestie,
          icon: const Text('💚', style: TextStyle(fontSize: 13)),
          label: const Text('Resume Bestie', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF22C55E),
            padding: const EdgeInsets.symmetric(horizontal: 8),
          ),
        ),
        IconButton(
          icon: const Icon(Icons.close, size: 16, color: Color(0xFFAAAAAA)),
          onPressed: () => setState(() => _bestieBannerDismissed = true),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
          tooltip: 'Dismiss',
        ),
      ]),
    );
  }

  Future<void> _sendImageMessage(String url) async {
    try {
      final sent = await sendMessage(widget.conversationId, '[IMG]$url');
      if (sent != null) _merge([sent], scroll: true);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'conversation', action: 'send_image_message');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Image send failed: $e')));
      }
    }
  }

  void _proofSnack(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), duration: const Duration(seconds: 5)),
    );
  }

  /// Man answers his match's Bestie proof request: pick a photo, run it through
  /// the FULL verification pipeline (Vision + face-match + anti-forgery + ID
  /// gate) scoped to this match. The file is never shown to her — only the
  /// verified signal reaches her Bestie. Category comes from her request.
  Future<void> _uploadRequestedProof() async {
    final req = _proofRequest;
    if (req == null || !req.active || _proofUploading) return;

    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: const Color(Config.bg2),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined, color: Color(Config.text1)),
            title: const Text('Choose from gallery', style: TextStyle(color: Color(Config.text1))),
            onTap: () => Navigator.pop(ctx, ImageSource.gallery),
          ),
          ListTile(
            leading: const Icon(Icons.camera_alt_outlined, color: Color(Config.text1)),
            title: const Text('Take a photo', style: TextStyle(color: Color(Config.text1))),
            onTap: () => Navigator.pop(ctx, ImageSource.camera),
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (source == null) return;

    final file = await ImagePicker().pickImage(source: source, imageQuality: 85);
    if (file == null) return;

    setState(() => _proofUploading = true);
    try {
      final res = await uploadProof(req.category, [file.path], matchId: widget.conversationId);
      if (!mounted) return;

      if (res['requiresIdVerification'] == true) {
        // Gated category (wealth/spending) without verified ID — a prerequisite,
        // not a failed attempt. The request stays open.
        _proofSnack(res['requiresSelfie'] == true
            ? 'This proof needs your verified selfie first — finish verification in your profile, then try again.'
            : 'This proof needs your government ID verified first — finish verification in your profile, then try again.');
      } else if (res['verified'] == true) {
        final insights = res['insights'];
        final label = (insights is List && insights.isNotEmpty && insights.first is Map)
            ? (insights.first as Map)['label']?.toString() ?? 'Proof verified'
            : 'Proof verified';
        final pts = (res['pts_awarded'] as num?)?.toInt() ?? 0;
        final name = _otherName.isNotEmpty ? _otherName : 'She';
        _proofSnack('🔒 Verified: $label (+$pts pts), saved to your profile. $name can\'t see the file, but her Bestie knows it\'s real.');
        setState(() => _proofRequest = ProofRequest.fromApi(res['proofRequest']));
      } else {
        final reason = res['reason']?.toString() ?? 'we couldn\'t confirm that from this photo.';
        _proofSnack('❌ Didn\'t pass verification: $reason You can try again with a clearer photo.');
        final updated = ProofRequest.fromApi(res['proofRequest']);
        if (updated != null) setState(() => _proofRequest = updated);
      }
    } catch (e) {
      AppLogger.instance.error(e, screen: 'conversation', action: 'upload_requested_proof');
      _proofSnack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _proofUploading = false);
    }
  }

  /// Soft unmatch — ends this match/conversation but leaves the person in the
  /// pool (they can resurface in Discover and re-match). The gentle exit.
  Future<void> _confirmUnmatch() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        title: const Text('Unmatch?', style: TextStyle(color: Color(Config.text1))),
        content: Text(
            "This ends your match with $_otherName and removes the conversation. "
            "They may still appear in Discover and could match with you again.",
            style: const TextStyle(color: Color(Config.text2))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel', style: TextStyle(color: Color(Config.text2)))),
          TextButton(onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Unmatch', style: TextStyle(color: Color(0xFFF87171), fontWeight: FontWeight.w700))),
        ],
      ),
    );
    if (ok != true || _otherId == null) return;
    try {
      await unmatchUser(_otherId!, widget.conversationId);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      AppLogger.instance.error(e, screen: 'conversation', action: 'unmatch_user');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  /// Hard exit — unmatch AND block, so the two never see each other again.
  Future<void> _confirmBlock() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        title: const Text('Unmatch & block?', style: TextStyle(color: Color(Config.text1))),
        content: Text("You won't see $_otherName again and the conversation will be removed. "
            "You can undo this later from Settings › Blocked users.",
            style: const TextStyle(color: Color(Config.text2))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel', style: TextStyle(color: Color(Config.text2)))),
          TextButton(onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Block', style: TextStyle(color: Color(0xFFF87171), fontWeight: FontWeight.w700))),
        ],
      ),
    );
    if (ok != true || _otherId == null) return;
    try {
      await blockUser(_otherId!, matchId: widget.conversationId);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      AppLogger.instance.error(e, screen: 'conversation', action: 'block_user');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  /// Report objectionable content/behavior (separate from block, per Apple
  /// Guideline 1.2). User picks a reason; reviewed within 24 hours. Offers to
  /// also block on success.
  Future<void> _reportUser() async {
    if (_otherId == null) return;
    final reason = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: const Color(Config.bg2),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Report $_otherName',
                  style: const TextStyle(color: Color(Config.text1), fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              const Text(
                "Tell us what's wrong. Our team reviews every report within 24 hours and removes objectionable content or users.",
                style: TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4),
              ),
            ]),
          ),
          for (final r in const [
            ['inappropriate_content', 'Inappropriate or offensive content'],
            ['harassment', 'Harassment or abuse'],
            ['fake_profile', 'Fake profile or impersonation'],
            ['scam', 'Scam or spam'],
            ['other', 'Something else'],
          ])
            ListTile(
              title: Text(r[1], style: const TextStyle(color: Color(Config.text1))),
              onTap: () => Navigator.pop(ctx, r[0]),
            ),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (reason == null || _otherId == null) return;
    try {
      await reportUser(_otherId!, reason: reason, matchId: widget.conversationId);
      if (!mounted) return;
      // Offer to block too — reporting and blocking are independent actions.
      final alsoBlock = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(Config.bg2),
          title: const Text('Report received', style: TextStyle(color: Color(Config.text1))),
          content: Text(
            'Thanks — our team reviews every report within 24 hours. Do you also want to unmatch & block $_otherName?',
            style: const TextStyle(color: Color(Config.text2)),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Not now', style: TextStyle(color: Color(Config.text2)))),
            TextButton(onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Unmatch & block', style: TextStyle(color: Color(0xFFF87171), fontWeight: FontWeight.w700))),
          ],
        ),
      );
      if (alsoBlock == true && _otherId != null) {
        await blockUser(_otherId!, matchId: widget.conversationId);
        if (mounted) Navigator.of(context).pop();
      }
    } catch (e) {
      AppLogger.instance.error(e, screen: 'conversation', action: 'report_user');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not report: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasAvatar = _otherAvatar != null && _otherAvatar!.startsWith('http');
    return PopScope(
      // Intercept ALL back gestures (swipe-back on iOS, system back on Android)
      // so we can trigger the chat-list refresh before the animation starts.
      onPopInvokedWithResult: (bool didPop, _) {
        if (didPop) widget.onReturn?.call();
      },
      child: Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Color(Config.text1)),
          onPressed: () {
            widget.onReturn?.call(); // notify chat list to refresh NOW (before animation)
            PushService.onSwitchTab?.call(1); // always return to Chat tab
            Navigator.of(context).pop();
          },
        ),
        title: GestureDetector(
          onTap: _otherId == null ? null : () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => MatchProfileScreen(userId: _otherId!, title: widget.title),
          )),
          child: Row(children: [
            Stack(children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: const Color(Config.bg3),
                backgroundImage: hasAvatar ? CachedNetworkImageProvider(_otherAvatar!) : null,
                child: hasAvatar ? null : Text(_otherName.isNotEmpty ? _otherName[0].toUpperCase() : '?',
                    style: const TextStyle(color: Color(Config.text1), fontSize: 13)),
              ),
              Positioned(
                right: -1, bottom: -1,
                child: _bestieIsProxy
                    ? Container(
                        width: 15, height: 15,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFFFF3B6B), Color(0xFFBF5AF2)]),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(Config.bg1), width: 2),
                        ),
                        child: const Icon(Icons.auto_awesome, size: 8, color: Colors.white),
                      )
                    : Container(
                        width: 11, height: 11,
                        decoration: BoxDecoration(
                          color: _partnerOnline ? const Color(0xFF22C55E) : const Color(0xFFAAAAAA),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(Config.bg1), width: 2),
                        ),
                      ),
              ),
            ]),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(widget.title,
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600, fontSize: 15)),
                _bestieIsProxy
                    ? const Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.auto_awesome, size: 11, color: Color(Config.accent)),
                        SizedBox(width: 3),
                        Text('AI Bestie',
                            style: TextStyle(
                                color: Color(Config.accent), fontSize: 11, fontWeight: FontWeight.w700)),
                      ])
                    : Text(_partnerOnline ? 'Online' : 'Away',
                        style: TextStyle(
                          color: _partnerOnline ? const Color(0xFF22C55E) : const Color(0xFFAAAAAA),
                          fontSize: 11, fontWeight: FontWeight.w500,
                        )),
              ]),
            ),
          ]),
        ),
        actions: [
          PopupMenuButton<String>(
            color: const Color(Config.bg2),
            icon: const Icon(Icons.more_vert, color: Color(Config.text2)),
            onSelected: (v) {
              if (v == 'unmatch') _confirmUnmatch();
              if (v == 'block') _confirmBlock();
              if (v == 'report') _reportUser();
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(value: 'report',
                  child: Text('Report', style: TextStyle(color: Color(Config.text1)))),
              const PopupMenuItem(value: 'unmatch',
                  child: Text('Unmatch', style: TextStyle(color: Color(Config.text1)))),
              const PopupMenuItem(value: 'block',
                  child: Text('Unmatch & block', style: TextStyle(color: Color(0xFFF87171)))),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (_bestieIsProxy && !_loading) _bestieIntroCard(),
          // Status banners at the TOP so they don't crowd the composer
          if (!_loading && _viewerGender == 'woman' && _otherGender == 'man')
            _bestieBanner(),
          if (!_loading && _viewerGender == 'man' && _otherGender == 'woman' && !_bestieActive)
            _directHandoffBanner(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(Config.accent)))
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: Color(Config.text2))))
                    : _messages.isEmpty
                        ? const Center(child: Text('Say hello 👋', style: TextStyle(color: Color(Config.text2))))
                        : ListView.builder(
                            controller: _scroll,
                            reverse: true,
                            padding: const EdgeInsets.all(12),
                            itemCount: _messages.length,
                            itemBuilder: (context, i) {
                              final msg = _messages[_messages.length - 1 - i];
                              final prevMsg = i < _messages.length - 1
                                  ? _messages[_messages.length - 2 - i]
                                  : null;
                              final nextMsg = i > 0 ? _messages[_messages.length - i] : null;
                              final isGroupStart = prevMsg == null || prevMsg.senderId != msg.senderId;
                              final showName = nextMsg == null || nextMsg.senderId != msg.senderId;
                              return _Bubble(
                                msg: msg,
                                mine: msg.senderId == _myId,
                                otherName: _otherName,
                                otherAvatar: _otherAvatar,
                                myName: _myName,
                                myAvatar: _myAvatar,
                                showName: showName,
                                isGroupStart: isGroupStart,
                              );
                            },
                          ),
          ),
          if (!_loading && _viewerGender == 'man' && _otherGender == 'woman' && _bestieActive && !_manBannerDismissed && !_manFrozen)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      AppLogger.instance.action('conversation', 'open_voice_call');
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => VoiceCallScreen(
                          matchId: widget.conversationId,
                          name: _otherName.isNotEmpty ? _otherName : widget.title,
                        ),
                      )).then((_) {
                        if (mounted) setState(() => _manBannerDismissed = false);
                        _pollOnce();
                      });
                    },
                    child: Container(
                      height: 40,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFF3B6B), Color(0xFFBF5AF2)],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        ),
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: const [BoxShadow(color: Color(0x44FF3B6B), blurRadius: 10, offset: Offset(0, 4))],
                      ),
                      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Text('✨', style: TextStyle(fontSize: 15)),
                        const SizedBox(width: 7),
                        Text('Voice chat with ${_otherName.isNotEmpty ? _otherName : widget.title}\'s AI Bestie',
                            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
                        const SizedBox(width: 7),
                        const Icon(Icons.mic_rounded, color: Colors.white, size: 16),
                      ]),
                    ),
                  ),
                ),
              ]),
            ),
          if (_manFrozen)
            _frozenComposer()
          else
            _Composer(
              controller: _composer,
              sending: _sending,
              onSend: _send,
              conversationId: widget.conversationId,
              viewerGender: _viewerGender,
              otherGender: _otherGender,
              otherName: _otherName,
              onImagePicked: _sendImageMessage,
              proofRequest: _proofRequest,
              proofUploading: _proofUploading,
              onUploadProof: _uploadRequestedProof,
            ),
        ],
      ),
    ),
    );
  }
}



class _Bubble extends StatelessWidget {
  final ChatMessage msg;
  final bool mine;
  final String otherName;
  final String? otherAvatar;
  final String myName;
  final String? myAvatar;
  final bool showName;
  final bool isGroupStart;

  const _Bubble({
    required this.msg,
    required this.mine,
    required this.otherName,
    required this.otherAvatar,
    required this.myName,
    required this.myAvatar,
    required this.showName,
    required this.isGroupStart,
  });

  String _formatTime(DateTime? dt) {
    if (dt == null || dt.year < 2020) return ''; // filter epoch/invalid dates
    final local = dt.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDay = DateTime(local.year, local.month, local.day);
    if (msgDay == today) {
      final h = local.hour % 12 == 0 ? 12 : local.hour % 12;
      final m = local.minute.toString().padLeft(2, '0');
      final ampm = local.hour < 12 ? 'AM' : 'PM';
      return '$h:$m $ampm';
    }
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${months[local.month - 1]} ${local.day}';
  }

  @override
  Widget build(BuildContext context) {
    final ai = msg.isAi;
    final displayName = mine ? myName : (ai ? "${otherName.isNotEmpty ? otherName : 'AI'}'s AI Bestie" : otherName);
    final avatarUrl = mine ? myAvatar : otherAvatar;
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : '?';
    final resolvedUrl = (avatarUrl != null && avatarUrl.startsWith('http')) ? avatarUrl : null;

    final bubbleBg = mine
        ? const Color(Config.accent)
        : ai
            ? const Color(0x22FF3B6B)
            : const Color(Config.bg3);
    final textColor = mine ? const Color(0xFFFFFFFF) : const Color(Config.text1);
    final timeColor = mine ? const Color(0x99FFFFFF) : const Color(Config.text3);

    // Own messages have no avatar (like Bumble/iMessage — you know who you are)
    final baseAvatar = CircleAvatar(
      radius: 15,
      backgroundColor: const Color(Config.bg3),
      backgroundImage: resolvedUrl != null ? CachedNetworkImageProvider(resolvedUrl) : null,
      child: resolvedUrl != null
          ? null
          : Text(initial,
              style: const TextStyle(color: Color(Config.text1), fontSize: 11, fontWeight: FontWeight.w600)),
    );
    final avatar = mine
        ? const SizedBox(width: 0)
        : showName
            // AI Bestie messages keep her photo (she's represented) but carry a
            // sparkle badge so they're never mistaken for her speaking directly.
            ? (ai
                ? SizedBox(
                    width: 30, height: 30,
                    child: Stack(clipBehavior: Clip.none, children: [
                      baseAvatar,
                      Positioned(
                        right: -2, bottom: -2,
                        child: Container(
                          width: 14, height: 14,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [Color(0xFFFF3B6B), Color(0xFFBF5AF2)]),
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(Config.bg1), width: 1.5),
                          ),
                          child: const Icon(Icons.auto_awesome, size: 7, color: Colors.white),
                        ),
                      ),
                    ]),
                  )
                : baseAvatar)
            : const SizedBox(width: 30);

    // Detect image messages: [IMG]https://...
    final isImage = msg.content.startsWith('[IMG]');
    final imageUrl = isImage ? msg.content.substring(5) : null;

    final bubbleChild = isImage && imageUrl != null
        ? ClipRRect(
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(mine ? 16 : 4),
              bottomRight: Radius.circular(mine ? 4 : 16),
            ),
            child: CachedNetworkImage(
              imageUrl: imageUrl,
              width: MediaQuery.of(context).size.width * 0.55,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(
                width: MediaQuery.of(context).size.width * 0.55,
                height: 160,
                color: const Color(Config.bg3),
                child: const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent))),
              ),
              errorWidget: (_, __, ___) => Container(
                width: MediaQuery.of(context).size.width * 0.55,
                height: 80,
                color: const Color(Config.bg3),
                child: const Icon(Icons.broken_image, color: Color(Config.text3)),
              ),
            ),
          )
        : Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 7),
            decoration: BoxDecoration(
              color: bubbleBg,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(mine ? 16 : 4),
                bottomRight: Radius.circular(mine ? 4 : 16),
              ),
              border: ai ? Border.all(color: const Color(Config.accent)) : null,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${msg.aiSignal != null ? '${msg.aiSignal} ' : ''}${msg.content}',
                  style: TextStyle(color: textColor, fontSize: 15, height: 1.35),
                ),
                const SizedBox(height: 3),
                Align(
                  alignment: Alignment.bottomRight,
                  child: Text(_formatTime(msg.createdAt),
                      style: TextStyle(color: timeColor, fontSize: 10.5)),
                ),
              ],
            ),
          );

    final bubble = ConstrainedBox(
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.65),
      child: bubbleChild,
    );

    return Padding(
      padding: EdgeInsets.only(top: isGroupStart ? 10 : 2, bottom: 2, left: 8, right: 8),
      child: Column(
        crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (showName && !mine)
            Padding(
              padding: const EdgeInsets.only(left: 36, bottom: 3),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                if (ai) ...[
                  const Icon(Icons.auto_awesome, size: 11, color: Color(Config.accent)),
                  const SizedBox(width: 3),
                ],
                Text(displayName,
                    style: TextStyle(
                        color: ai ? const Color(Config.accent) : const Color(Config.text3),
                        fontSize: 11,
                        fontWeight: ai ? FontWeight.w700 : FontWeight.w500)),
              ]),
            ),
          Row(
            mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: mine
                ? [bubble, const SizedBox(width: 6), avatar]
                : [avatar, const SizedBox(width: 6), bubble],
          ),
        ],
      ),
    );
  }
}

/// Short, man-facing description of what each proof category means. Mirrors the
/// web PROOF_CATEGORY_SHORT map so both surfaces read the same.
const Map<String, String> _kProofCategoryShort = {
  'travel': 'travel proof (passport stamps or trip photos with you in them)',
  'lifestyle': 'a lifestyle photo (you living it)',
  'discipline': 'a fitness photo (you training)',
  'social_proof': 'a photo with your people',
  'wealth': 'wealth proof (bank statement or payslip)',
  'spending': 'spending proof (receipts or bills)',
};

class _Composer extends StatefulWidget {
  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;
  final String conversationId;
  final String? viewerGender;
  final String? otherGender;
  final String otherName;
  final Future<void> Function(String url) onImagePicked;
  final ProofRequest? proofRequest;
  final bool proofUploading;
  final VoidCallback onUploadProof;

  const _Composer({
    required this.controller,
    required this.sending,
    required this.onSend,
    required this.conversationId,
    required this.viewerGender,
    required this.otherGender,
    required this.otherName,
    required this.onImagePicked,
    required this.proofRequest,
    required this.proofUploading,
    required this.onUploadProof,
  });

  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  bool _imageUploading = false;

  bool get _showWingman =>
      widget.viewerGender == 'man' && widget.otherGender == 'woman';

  // Man's contextual proof affordance: only while his match's Bestie has an
  // open request (spec §3 Step 3 — no unprompted uploads).
  bool get _proofActive =>
      _showWingman && (widget.proofRequest?.active ?? false);

  Future<void> _pickAndSendImage() async {
    // Let user choose gallery or camera
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: const Color(Config.bg2),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.photo_library, color: Color(Config.text1)),
            title: const Text('Choose from gallery', style: TextStyle(color: Color(Config.text1))),
            onTap: () => Navigator.pop(ctx, ImageSource.gallery),
          ),
          ListTile(
            leading: const Icon(Icons.camera_alt, color: Color(Config.text1)),
            title: const Text('Take a photo', style: TextStyle(color: Color(Config.text1))),
            onTap: () => Navigator.pop(ctx, ImageSource.camera),
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (source == null) return;

    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, imageQuality: 85);
    if (file == null) return;

    setState(() => _imageUploading = true);
    try {
      final bytes = await file.readAsBytes();
      final ext = file.path.split('.').last.toLowerCase();
      final safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].contains(ext) ? ext : 'jpg';
      final url = await uploadChatImage(bytes, safeExt);
      await widget.onImagePicked(url);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'conversation', action: 'upload_chat_image');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _imageUploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final req = widget.proofRequest;
    final proofLabel = req == null
        ? ''
        : (_kProofCategoryShort[req.category] ?? '${req.category} proof');
    return ColoredBox(
      color: const Color(Config.bg2),
      child: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Bestie proof-request banner — the 📎 exists only while her request
          // is open; the category comes from her question, never a picker.
          if (_proofActive)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8, left: 2, right: 2),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0x14FF3B6B),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0x33FF3B6B)),
              ),
              child: Row(children: [
                const Text('✨', style: TextStyle(fontSize: 13)),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(
                    "${widget.otherName.isNotEmpty ? widget.otherName : 'Her'}'s Bestie asked for $proofLabel"
                    "${req?.status == 'failed_attempt' ? ' — last try didn\'t pass, give it another go' : ''}"
                    '. Tap 📎 to get it verified. Private: she never sees the file.',
                    style: const TextStyle(color: Color(Config.text2), fontSize: 12, height: 1.35),
                  ),
                ),
              ]),
            ),
          Row(children: [
            // 📎 Proof upload — man answering his match's Bestie request. Only
            // rendered while the request is open (spec §3 Step 3).
            if (_proofActive) ...[
              widget.proofUploading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 10),
                      child: SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFF3B6B))),
                    )
                  : InkWell(
                      onTap: widget.onUploadProof,
                      borderRadius: BorderRadius.circular(999),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                        decoration: BoxDecoration(
                          color: const Color(0x14FF3B6B),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: const Color(0x33FF3B6B)),
                        ),
                        child: const Row(mainAxisSize: MainAxisSize.min, children: [
                          Text('📎', style: TextStyle(fontSize: 14)),
                          SizedBox(width: 4),
                          Text('Verify',
                              style: TextStyle(
                                  color: Color(0xFFFF3B6B), fontSize: 12, fontWeight: FontWeight.w700)),
                        ]),
                      ),
                    ),
              const SizedBox(width: 2),
            ],
            // 📷 Image button — temporarily disabled
            // SizedBox(
            //   width: 40,
            //   height: 40,
            //   child: _imageUploading
            //       ? const Padding(
            //           padding: EdgeInsets.all(10),
            //           child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)),
            //         )
            //       : IconButton(
            //           onPressed: _pickAndSendImage,
            //           icon: const Icon(Icons.image_outlined, color: Color(Config.text2)),
            //           padding: EdgeInsets.zero,
            //         ),
            // ),
            const SizedBox(width: 4),
            Expanded(
              child: TextField(
                controller: widget.controller,
                style: const TextStyle(color: Color(Config.text1)),
                minLines: 1,
                maxLines: 4,
                maxLength: 2000,
                buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => widget.onSend(),
                decoration: InputDecoration(
                  hintText: 'Message…',
                  hintStyle: const TextStyle(color: Color(Config.text3)),
                  filled: true,
                  fillColor: const Color(Config.bg3),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: widget.onSend,
              child: CircleAvatar(
                radius: 22,
                backgroundColor: const Color(Config.accent),
                child: widget.sending
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFFFFFF)))
                    : const Icon(Icons.arrow_upward, color: Color(0xFFFFFFFF)),
              ),
            ),
          ]),
          ]),
        ),
      ),
    );
  }
}
