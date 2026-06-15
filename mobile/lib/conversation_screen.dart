import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api.dart';
import 'config.dart';
import 'match_profile_screen.dart';

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
  RealtimeChannel? _presenceChannel;
  bool _partnerOnline = false;
  String? _otherId;
  String? _otherAvatar;
  String _otherName = '';
  String? _otherGender;
  String? _viewerGender;
  String _myName = '';
  String? _myAvatar;

  @override
  void initState() {
    super.initState();
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
    final ch = Supabase.instance.client.channel('presence:${widget.conversationId}');
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
    try {
      // Refresh session if expired before loading
      try { await Supabase.instance.client.auth.refreshSession(); } catch (_) {}
      final thread = await fetchConversation(widget.conversationId);
      _otherId = thread.otherId;
      _otherAvatar = thread.otherAvatar;
      _otherName = thread.otherName;
      _otherGender = thread.otherGender;
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
      } catch (_) {}
      if (mounted) setState(() => _loading = false);
      markConversationRead(widget.conversationId).catchError((_) {});
    } catch (e) {
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

  Future<void> _sendImageMessage(String url) async {
    try {
      final sent = await sendMessage(widget.conversationId, '[IMG]$url');
      if (sent != null) _merge([sent], scroll: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Image send failed: $e')));
      }
    }
  }

  Future<void> _confirmBlock() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        title: const Text('Unmatch & block?', style: TextStyle(color: Color(Config.text1))),
        content: Text("You won't see $_otherName again and the conversation will be removed.",
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
                right: 0, bottom: 0,
                child: Container(
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
                Text(_partnerOnline ? 'Online' : 'Away',
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
                            reverse: true,
                            padding: const EdgeInsets.all(12),
                            itemCount: _messages.length,
                            itemBuilder: (context, i) {
                              final msg = _messages[_messages.length - 1 - i];
                              final prevMsg = i < _messages.length - 1
                                  ? _messages[_messages.length - 2 - i]
                                  : null;
                              final showName = prevMsg == null || prevMsg.senderId != msg.senderId;
                              return _Bubble(
                                msg: msg,
                                mine: msg.senderId == _myId,
                                otherName: _otherName,
                                otherAvatar: _otherAvatar,
                                myName: _myName,
                                myAvatar: _myAvatar,
                                showName: showName,
                              );
                            },
                          ),
          ),
          // _CallBestieButton is intentionally hidden
          _Composer(
            controller: _composer,
            sending: _sending,
            onSend: _send,
            conversationId: widget.conversationId,
            viewerGender: _viewerGender,
            otherGender: _otherGender,
            onImagePicked: _sendImageMessage,
          ),
        ],
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

  const _Bubble({
    required this.msg,
    required this.mine,
    required this.otherName,
    required this.otherAvatar,
    required this.myName,
    required this.myAvatar,
    required this.showName,
  });

  String _formatTime(DateTime? dt) {
    if (dt == null) return '';
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

    final avatar = showName
        ? CircleAvatar(
            radius: 15,
            backgroundColor: const Color(Config.bg3),
            backgroundImage: resolvedUrl != null ? CachedNetworkImageProvider(resolvedUrl) : null,
            child: resolvedUrl != null
                ? null
                : Text(initial,
                    style: const TextStyle(color: Color(Config.text1), fontSize: 11, fontWeight: FontWeight.w600)),
          )
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
      padding: EdgeInsets.only(top: showName ? 10 : 2, bottom: 2, left: 8, right: 8),
      child: Column(
        crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (showName)
            Padding(
              padding: EdgeInsets.only(
                left: mine ? 0 : 36,
                right: mine ? 36 : 0,
                bottom: 3,
              ),
              child: Text(displayName,
                  style: const TextStyle(
                      color: Color(Config.text3), fontSize: 11, fontWeight: FontWeight.w500)),
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

class _Composer extends StatefulWidget {
  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;
  final String conversationId;
  final String? viewerGender;
  final String? otherGender;
  final Future<void> Function(String url) onImagePicked;

  const _Composer({
    required this.controller,
    required this.sending,
    required this.onSend,
    required this.conversationId,
    required this.viewerGender,
    required this.otherGender,
    required this.onImagePicked,
  });

  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  bool _imageUploading = false;
  bool _wingmanLoading = false;

  bool get _showWingman =>
      widget.viewerGender == 'man' && widget.otherGender == 'woman';

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
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _imageUploading = false);
    }
  }

  Future<void> _showWingmanSheet() async {
    setState(() => _wingmanLoading = true);
    try {
      final result = await fetchWingmanSuggestion(widget.conversationId);
      if (!mounted) return;
      final suggestion = (result['suggestion'] ?? '').toString();
      final coaching = result['coaching'] as String?;
      if (suggestion.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not generate a suggestion. Try again.')),
        );
        return;
      }
      await showModalBottomSheet(
        context: context,
        backgroundColor: const Color(Config.bg2),
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (ctx) => _WingmanBottomSheet(
          suggestion: suggestion,
          coaching: coaching,
          onUse: (text) {
            widget.controller.text = text;
            widget.controller.selection = TextSelection.fromPosition(
              TextPosition(offset: text.length),
            );
          },
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Wingman error: $e')));
      }
    } finally {
      if (mounted) setState(() => _wingmanLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(Config.bg2),
      child: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
          child: Row(children: [
            // 📷 Image button
            SizedBox(
              width: 40,
              height: 40,
              child: _imageUploading
                  ? const Padding(
                      padding: EdgeInsets.all(10),
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)),
                    )
                  : IconButton(
                      onPressed: _pickAndSendImage,
                      icon: const Icon(Icons.image_outlined, color: Color(Config.text2)),
                      padding: EdgeInsets.zero,
                    ),
            ),
            // ✨ AI Wingman button (men chatting with women only)
            if (_showWingman) ...[
              const SizedBox(width: 2),
              SizedBox(
                width: 40,
                height: 40,
                child: _wingmanLoading
                    ? const Padding(
                        padding: EdgeInsets.all(10),
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFA855F7)),
                      )
                    : IconButton(
                        onPressed: _showWingmanSheet,
                        icon: const Icon(Icons.auto_awesome, color: Color(0xFFA855F7)),
                        padding: EdgeInsets.zero,
                        tooltip: 'AI Bestie',
                      ),
              ),
            ],
            const SizedBox(width: 4),
            Expanded(
              child: TextField(
                controller: widget.controller,
                style: const TextStyle(color: Color(Config.text1)),
                minLines: 1,
                maxLines: 4,
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
        ),
      ),
    );
  }
}

class _WingmanBottomSheet extends StatelessWidget {
  final String suggestion;
  final String? coaching;
  final void Function(String text) onUse;

  const _WingmanBottomSheet({
    required this.suggestion,
    required this.coaching,
    required this.onUse,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.auto_awesome, color: Color(0xFFA855F7), size: 20),
                const SizedBox(width: 8),
                const Text('AI Bestie suggestion',
                    style: TextStyle(color: Color(Config.text1), fontSize: 16, fontWeight: FontWeight.w700)),
              ]),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(Config.bg3),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0x33A855F7)),
                ),
                child: Text(suggestion,
                    style: const TextStyle(color: Color(Config.text1), fontSize: 15, height: 1.4)),
              ),
              if (coaching != null && coaching!.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(coaching!,
                    style: const TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.4)),
              ],
              const SizedBox(height: 18),
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(Config.text2),
                      side: const BorderSide(color: Color(Config.bg3)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                    ),
                    child: const Text('Dismiss'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: () {
                      onUse(suggestion);
                      Navigator.of(context).pop();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFA855F7),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                    ),
                    child: const Text('Use this reply', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }
}
