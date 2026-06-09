import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api.dart';
import 'config.dart';
import 'voice_call_screen.dart';

class ConversationScreen extends StatefulWidget {
  final String conversationId;
  final String title;
  const ConversationScreen({super.key, required this.conversationId, required this.title});

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
  String? _otherId;
  String? _otherAvatar;
  String _otherName = '';
  String? _otherGender;
  String? _viewerGender;

  @override
  void initState() {
    super.initState();
    _initialLoad();
    fetchCurrentUserGender().then((g) { if (mounted) setState(() => _viewerGender = g); });
    _subscribeRealtime();
    // Polling backstop (mirrors the web client; covers the case where Supabase
    // realtime isn't enabled for the messages table yet).
    _poll = Timer.periodic(const Duration(seconds: 5), (_) => _pollOnce());
  }

  @override
  void dispose() {
    _poll?.cancel();
    if (_channel != null) Supabase.instance.client.removeChannel(_channel!);
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
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
    try {
      final thread = await fetchConversation(widget.conversationId);
      _otherId = thread.otherId;
      _otherAvatar = thread.otherAvatar;
      _otherName = thread.otherName;
      _otherGender = thread.otherGender;
      _merge(thread.messages, scroll: true);
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  Future<void> _pollOnce() async {
    try {
      final thread = await fetchConversation(widget.conversationId);
      _merge(thread.messages);
    } catch (_) {/* transient */}
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
          _merge([ChatMessage.fromApi(payload.newRecord)], scroll: true);
        } catch (_) {}
      },
    ).subscribe();
    _channel = ch;
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _send() async {
    final text = _composer.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    _composer.clear();
    try {
      final sent = await sendMessage(widget.conversationId, text);
      if (sent != null) _merge([sent], scroll: true);
      // Fast-poll briefly to catch an AI auto-reply.
      for (var i = 0; i < 6; i++) {
        await Future.delayed(const Duration(milliseconds: 1200));
        await _pollOnce();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Send failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _confirmBlock() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        title: const Text('Unmatch & block?', style: TextStyle(color: Color(Config.text1))),
        content: Text('You won’t see $_otherName again and the conversation will be removed.',
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
      await blockUser(_otherId!, matchId: widget.conversationId);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
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
                'Tell us what’s wrong. Our team reviews every report within 24 hours and removes objectionable content or users.',
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
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not report: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasAvatar = _otherAvatar != null && _otherAvatar!.startsWith('http');
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        titleSpacing: 0,
        title: Row(children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: const Color(Config.bg3),
            backgroundImage: hasAvatar ? CachedNetworkImageProvider(_otherAvatar!) : null,
            child: hasAvatar ? null : Text(_otherName.isNotEmpty ? _otherName[0].toUpperCase() : '?',
                style: const TextStyle(color: Color(Config.text1), fontSize: 13)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(widget.title,
                maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
          ),
        ]),
        actions: [
          PopupMenuButton<String>(
            color: const Color(Config.bg2),
            icon: const Icon(Icons.more_vert, color: Color(Config.text2)),
            onSelected: (v) {
              if (v == 'block') _confirmBlock();
              if (v == 'report') _reportUser();
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(value: 'report',
                  child: Text('Report', style: TextStyle(color: Color(Config.text1)))),
              const PopupMenuItem(value: 'block',
                  child: Text('Unmatch & block', style: TextStyle(color: Color(0xFFF87171)))),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(Config.accent)))
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: Color(Config.text2))))
                    : _messages.isEmpty
                        ? const Center(child: Text('Say hello 👋', style: TextStyle(color: Color(Config.text2))))
                        : ListView.builder(
                            controller: _scroll,
                            padding: const EdgeInsets.all(12),
                            itemCount: _messages.length,
                            itemBuilder: (context, i) => _Bubble(msg: _messages[i], mine: _messages[i].senderId == _myId, otherName: _otherName),
                          ),
          ),
          if (_viewerGender == 'man' && _otherGender == 'woman' && _otherId != null)
            _CallBestieButton(
              name: _otherName,
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => VoiceCallScreen(matchId: widget.conversationId, name: _otherName),
              )),
            ),
          _Composer(controller: _composer, sending: _sending, onSend: _send),
        ],
      ),
    );
  }
}

/// "Talk to {name}'s AI bestie" CTA — a male viewer can voice-call a female
/// match's AI bestie (gated server-side on her opt-in; shown optimistically).
class _CallBestieButton extends StatelessWidget {
  final String name;
  final VoidCallback onTap;
  const _CallBestieButton({required this.name, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: SizedBox(
        width: double.infinity, height: 48,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFFA855F7), Color(0xFFEC4899)]),
            borderRadius: BorderRadius.circular(999),
          ),
          child: TextButton.icon(
            onPressed: onTap,
            icon: const Icon(Icons.call, color: Colors.white, size: 18),
            label: Text("Talk to $name's AI bestie",
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            style: TextButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999))),
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final ChatMessage msg;
  final bool mine;
  final String otherName;
  const _Bubble({required this.msg, required this.mine, required this.otherName});

  @override
  Widget build(BuildContext context) {
    final ai = msg.isAi;
    final bg = mine
        ? const Color(Config.accent)
        : ai
            ? const Color(0x22FF3B6B)
            : const Color(Config.bg3);
    final fg = mine ? const Color(0xFFFFFFFF) : const Color(Config.text1);
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: ai ? Border.all(color: const Color(Config.accent)) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (ai)
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(otherName.isNotEmpty ? "$otherName's AI Bestie" : 'AI Bestie',
                    style: const TextStyle(color: Color(Config.accent), fontSize: 10, fontWeight: FontWeight.w700)),
              ),
            Text(
              '${msg.aiSignal != null ? '${msg.aiSignal} ' : ''}${msg.content}',
              style: TextStyle(color: fg, fontSize: 15, height: 1.3),
            ),
          ],
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;
  const _Composer({required this.controller, required this.sending, required this.onSend});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        color: const Color(Config.bg2),
        child: Row(children: [
          Expanded(
            child: TextField(
              controller: controller,
              style: const TextStyle(color: Color(Config.text1)),
              minLines: 1,
              maxLines: 4,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
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
            onTap: onSend,
            child: CircleAvatar(
              radius: 22,
              backgroundColor: const Color(Config.accent),
              child: sending
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFFFFFF)))
                  : const Icon(Icons.arrow_upward, color: Color(0xFFFFFFFF)),
            ),
          ),
        ]),
      ),
    );
  }
}
