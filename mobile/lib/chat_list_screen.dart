import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api.dart';
import 'archetypes.dart';
import 'config.dart';
import 'conversation_screen.dart';
import 'advisor_screen.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen>
    with AutomaticKeepAliveClientMixin, WidgetsBindingObserver {
  late Future<_ChatData> _future;
  int _filter = 0; // 0 = All, 1 = Unread
  RealtimeChannel? _msgChannel;
  RealtimeChannel? _attentionChannel;
  RealtimeChannel? _matchChannel;
  RealtimeChannel? _onlineChannel;
  RealtimeChannel? _verificationChannel;
  final _onlineUsers = <String>{};
  final _clearedConvos = <String>{}; // optimistic read-clear before server confirms
  Timer? _periodicRefresh;

  // ── Find Match ────────────────────────────────────────────────────────────
  bool _fmEligible = true;
  int _fmRunsUsed = 0;
  int _fmRunsLimit = 3;
  bool _fmLoading = false;
  int get _fmRemaining => (_fmRunsLimit - _fmRunsUsed).clamp(0, _fmRunsLimit);

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _future = _load();
    _subscribeToMessages();
    _subscribeToPresence();
    // Periodic backstop: refresh every 15 s in case realtime misses an event.
    // Also re-checks FM eligibility so Trust & Boost completions surface quickly.
    _periodicRefresh = Timer.periodic(const Duration(seconds: 15), (_) {
      _refresh();
      _loadMatchmakerStatus();
    });
    _loadMatchmakerStatus();
  }

  Future<void> _loadMatchmakerStatus() async {
    try {
      final s = await getMatchmakerStatus();
      if (!mounted) return;
      setState(() {
        _fmEligible = s.eligible;
        _fmRunsUsed = s.runsUsed;
        _fmRunsLimit = s.runsLimit;
      });
    } catch (_) {}
  }

  Future<void> _runFindMatches() async {
    if (_fmLoading) return;
    if (!_fmEligible) { _showFmPopup('needs_verification'); return; }
    if (_fmRemaining <= 0) { _showFmPopup('limit_reached'); return; }

    setState(() => _fmLoading = true);
    try {
      final result = await runFindMatches();
      if (!mounted) return;
      if (result.runsUsed != null) _fmRunsUsed = result.runsUsed!;
      if (result.runsLimit != null) _fmRunsLimit = result.runsLimit!;
      _showFmPopup(result.status, match: result.match, bestScore: result.bestScore, debugInfo: result.debugInfo);
    } finally {
      if (mounted) setState(() => _fmLoading = false);
    }
  }

  void _showFmPopup(String status, {MatchmakerMatch? match, int? bestScore, String? debugInfo}) {
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (_) => _FindMatchDialog(
        status: status,
        match: match,
        bestScore: bestScore,
        debugInfo: debugInfo,
        fmRemaining: _fmRemaining,
        fmRunsLimit: _fmRunsLimit,
        onGoVerify: () {
          Navigator.pop(context);
          // Navigate to verification screen
          Navigator.of(context).pushNamed('/verification');
        },
        onOpenChat: (matchId, firstName, age) {
          Navigator.pop(context);
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ConversationScreen(
              conversationId: matchId,
              title: age != null ? '$firstName, $age' : firstName,
              onReturn: () { if (mounted) _refresh(); },
            ),
          )).then((_) => _refresh());
        },
      ),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _periodicRefresh?.cancel();
    if (_msgChannel != null) Supabase.instance.client.removeChannel(_msgChannel!);
    if (_attentionChannel != null) Supabase.instance.client.removeChannel(_attentionChannel!);
    if (_matchChannel != null) Supabase.instance.client.removeChannel(_matchChannel!);
    if (_onlineChannel != null) Supabase.instance.client.removeChannel(_onlineChannel!);
    if (_verificationChannel != null) Supabase.instance.client.removeChannel(_verificationChannel!);
    super.dispose();
  }

  // Refresh when app comes back to foreground
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  void _subscribeToMessages() {
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid == null) return;

    // Real-time: new chat messages → refresh conversation list
    _msgChannel = Supabase.instance.client
        .channel('chat-list-messages:$uid')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'verified_vibe_messages',
          callback: (_) => _refresh(),
        )
        .subscribe();

    // Real-time: new match created by matchmaker → refresh list + update FM button
    final myId = uid;
    _matchChannel = Supabase.instance.client
        .channel('chat-list-matches:$uid')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'verified_vibe_matches',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user1_id',
            value: myId,
          ),
          callback: (_) { _refresh(); _loadMatchmakerStatus(); },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'verified_vibe_matches',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user2_id',
            value: myId,
          ),
          callback: (_) { _refresh(); _loadMatchmakerStatus(); },
        )
        .subscribe();

    // Real-time: Notice Me / Secret Admirer sent OR received → refresh
    // so Admirers tab and Sent tab update instantly without manual pull-to-refresh.
    _attentionChannel = Supabase.instance.client
        .channel('chat-list-attention:$uid')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'attention_messages',
          callback: (_) => _refresh(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'attention_messages',
          callback: (_) => _refresh(),
        )
        .subscribe();

    // Real-time: verification step completed → instantly re-check Find Match eligibility.
    // This ensures the FM button updates immediately after Trust & Boost without needing
    // to close and reopen the app.
    _verificationChannel = Supabase.instance.client
        .channel('chat-list-verification:$uid')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'verified_vibe_verification',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: uid,
          ),
          callback: (_) => _loadMatchmakerStatus(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'verified_vibe_verification',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: uid,
          ),
          callback: (_) => _loadMatchmakerStatus(),
        )
        .subscribe();
  }

  void _subscribeToPresence() {
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid == null) return;
    final ch = Supabase.instance.client.channel('presence:online-users');
    ch.onPresenceSync((_) {
      final online = <String>{};
      for (final s in ch.presenceState()) {
        for (final p in s.presences) {
          final u = p.payload['uid']?.toString();
          if (u != null && u != uid) online.add(u);
        }
      }
      if (mounted) setState(() => _onlineUsers
        ..clear()
        ..addAll(online));
    });
    ch.subscribe((status, _) async {
      if (status == RealtimeSubscribeStatus.subscribed) {
        await ch.track({'uid': uid});
      }
    });
    _onlineChannel = ch;
  }

  Future<_ChatData> _load() async {
    try {
      final gender = await fetchCurrentUserGender();
      final convos = await fetchConversations();
      List<Admirer> admirers = const [];
      List<SentAdmirer> sentAdmirers = const [];
      TipSummary? tipSummary;
      try {
        final results = await Future.wait([fetchAdmirers(), fetchSentAdmirers(), fetchMyTips()]);
        admirers = results[0] as List<Admirer>;
        sentAdmirers = results[1] as List<SentAdmirer>;
        tipSummary = results[2] as TipSummary;
      } catch (_) {/* non-fatal */}
      return _ChatData(gender: gender, conversations: convos, admirers: admirers, sentAdmirers: sentAdmirers, tipSummary: tipSummary);
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('SocketException') || msg.contains('Failed host lookup') ||
          msg.contains('connection timeout') || msg.contains('receive timeout') ||
          msg.contains('connect timeout') || msg.contains('Network is unreachable') ||
          msg.contains('Connection refused')) {
        throw Exception('No internet connection. Please check your network and retry.');
      }
      if (msg.contains('timed out') && !msg.contains('401')) {
        throw Exception('Server took too long to respond. Please try again.');
      }
      if (msg.contains('401') || msg.contains('Unauthorized')) {
        throw Exception('Session expired. Please sign out and sign back in.');
      }
      rethrow;
    }
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    // Load in background — don't replace _future until data is ready so the
    // existing list stays visible (no loading spinner on every 15s poll).
    try {
      final data = await _load();
      if (mounted) setState(() { _future = Future.value(data); });
    } catch (e) {
      if (mounted) setState(() { _future = Future.error(e); });
    }
  }

  Future<void> _open(Conversation c) async {
    // 1. Optimistically clear badge immediately on tap.
    if (c.unreadCount > 0) {
      setState(() => _clearedConvos.add(c.id));
      // 2. Fire mark-read NOW (before opening screen) so the server timestamp
      //    is definitely persisted before we call _refresh() on return.
      markConversationRead(c.id).catchError((_) {});
    }
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ConversationScreen(
        conversationId: c.id,
        title: c.age != null ? '${c.name}, ${c.age}' : c.name,
        // Refresh the list the moment back is pressed (before animation ends)
        // so the user sees updated data as soon as the screen transitions back.
        onReturn: () { if (mounted) _refresh(); },
      ),
    ));
    // Belt-and-suspenders: also refresh after animation completes (handles
    // cases where onReturn fired before mark-read persisted to server).
    await _refresh();
    if (mounted) setState(() => _clearedConvos.remove(c.id));
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        automaticallyImplyLeading: false,
        centerTitle: false,
        titleSpacing: 20,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Messages', style: TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
            Text('Chat with your matches', style: TextStyle(fontSize: 12, color: Color(Config.text2), fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _FindMatchButton(
              loading: _fmLoading,
              eligible: _fmEligible,
              remaining: _fmRemaining,
              onTap: _runFindMatches,
            ),
          ),
        ],
      ),
      body: FutureBuilder<_ChatData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(Config.accent)));
          }
          if (snap.hasError) return _error(snap.error.toString());

          final data = snap.data!;
          final isMan = data.gender == 'man';
          final isWoman = data.gender == 'woman';
          final newMatches = data.conversations.where((c) => !c.hasMessages).toList();
          var active = data.conversations.where((c) => c.hasMessages).toList()
            ..sort((a, b) => (b.lastMessageTime ?? DateTime(1970))
                .compareTo(a.lastMessageTime ?? DateTime(1970)));
          final unreadTotal = active.where((c) => c.unreadCount > 0 && !_clearedConvos.contains(c.id)).length;
          if (_filter == 1) active = active.where((c) => c.unreadCount > 0 && !_clearedConvos.contains(c.id)).toList();

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 16),
              children: [
                if ((isMan || isWoman) && _filter != 3)
                  _AdvisorRow(
                    wingman: isMan,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => AdvisorScreen(wingman: isMan),
                    )),
                  ),
                if (newMatches.isNotEmpty && _filter != 2 && _filter != 3) _NewMatches(matches: newMatches, onTap: _open, onlineUsers: _onlineUsers),
                _FilterTabs(
                  filter: _filter,
                  allCount: data.conversations.where((c) => c.hasMessages).length,
                  unreadCount: unreadTotal,
                  admirerCount: data.admirers.length,
                  sentCount: data.sentAdmirers.length,
                  onChanged: (i) => setState(() => _filter = i),
                ),
                if (_filter == 2) ...[
                  if (data.tipSummary != null && data.tipSummary!.total > 0)
                    _TipSummaryCard(tip: data.tipSummary!),
                  if (data.admirers.isEmpty)
                    const Padding(
                      padding: EdgeInsets.fromLTRB(20, 40, 20, 0),
                      child: Text('No admirers yet — when someone notices you, they\'ll show up here. 🌹',
                          textAlign: TextAlign.center, style: TextStyle(color: Color(Config.text2))),
                    )
                  else
                    ...data.admirers.map((a) => _AdmirerCard(admirer: a, onReplied: _refresh)),
                ] else if (_filter == 3) ...[
                  const _MatchmakerCard(),
                  if (data.sentAdmirers.isEmpty)
                    const Padding(
                      padding: EdgeInsets.fromLTRB(20, 24, 20, 0),
                      child: Text(
                        'No notices sent yet \u2014 admire someone from Discover to get started.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Color(Config.text2)),
                      ),
                    )
                  else
                    ...data.sentAdmirers.map((s) => _SentAdmirerCard(admirer: s)),
                ] else if (active.isEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 40, 20, 0),
                    child: Text(
                      _filter == 1
                          ? 'No unread messages.'
                          : (data.conversations.isEmpty
                              ? 'No conversations yet — your matches will show up here.'
                              : 'No active chats yet — say hello to a new match above.'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(Config.text2)),
                    ),
                  )
                else
                  ...active.map((c) => _ConversationTile(
                    convo: c,
                    onTap: () => _open(c),
                    myId: Supabase.instance.client.auth.currentUser?.id,
                    online: c.otherId != null && _onlineUsers.contains(c.otherId),
                    cleared: _clearedConvos.contains(c.id),
                  )),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _error(String e) {
    final friendly = e.contains('No internet') ? e
        : e.contains('Session expired') ? e
        : e.contains('401') || e.contains('Unauthorized')
            ? 'Session expired. Please sign out and sign back in.'
        : e.contains('timeout') || e.contains('SocketException') || e.contains('DioException')
            ? 'No internet connection. Please check your network and retry.'
        : 'Something went wrong. Please try again.';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.cloud_off, color: Color(Config.text3), size: 48),
          const SizedBox(height: 12),
          Text(friendly, textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2))),
          const SizedBox(height: 16),
          FilledButton(onPressed: _refresh, child: const Text('Retry')),
        ]),
      ),
    );
  }
}

class _ChatData {
  final String? gender;
  final List<Conversation> conversations;
  final List<Admirer> admirers;
  final List<SentAdmirer> sentAdmirers;
  final TipSummary? tipSummary;
  _ChatData({required this.gender, required this.conversations, required this.admirers, required this.sentAdmirers, this.tipSummary});
}

/// Shows anonymous tip feedback received on the user's profile.
class _TipSummaryCard extends StatelessWidget {
  final TipSummary tip;
  const _TipSummaryCard({required this.tip});

  String _label(String tag) => tag.replaceAll('-', ' ');

  @override
  Widget build(BuildContext context) {
    // Sort tags by count descending, take top 5
    final sorted = tip.tagCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final topTags = sorted.take(5).toList();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x33FFB800)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Text('💬', style: TextStyle(fontSize: 18)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '${tip.total} anonymous tip${tip.total == 1 ? '' : 's'} on your profile',
              style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 15),
            ),
          ),
        ]),
        if (topTags.isNotEmpty) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: topTags.map((e) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0x1AFFB800),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0x44FFB800)),
              ),
              child: Text(
                '${_label(e.key)} ×${e.value}',
                style: const TextStyle(color: Color(Config.text1), fontSize: 12),
              ),
            )).toList(),
          ),
        ],
        if (tip.textSamples.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('"${tip.textSamples.first}"',
              style: const TextStyle(color: Color(Config.text2), fontSize: 13, fontStyle: FontStyle.italic)),
        ],
        const SizedBox(height: 8),
        const Text('Tips are anonymous — only aggregated feedback is shown.',
            style: TextStyle(color: Color(Config.text3), fontSize: 11)),
      ]),
    );
  }
}

String _ago(DateTime? t) {
  if (t == null) return '';
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'now';
  if (d.inMinutes < 60) return '${d.inMinutes}m';
  if (d.inHours < 24) return '${d.inHours}h';
  if (d.inDays < 7) return '${d.inDays}d';
  return '${(d.inDays / 7).floor()}w';
}

/// Avatar with a colored ring — green when online, grey when offline.
class _RingAvatar extends StatelessWidget {
  final String? url;
  final String name;
  final double radius;
  final bool online;
  const _RingAvatar({required this.url, required this.name, this.radius = 24, this.online = false});
  @override
  Widget build(BuildContext context) {
    final hasUrl = url != null && url!.startsWith('http');
    final ringColor = online ? const Color(0xFF22C55E) : const Color(0xFFAAAAAA);
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: ringColor, width: 2)),
      child: CircleAvatar(
        radius: radius,
        backgroundColor: const Color(Config.bg3),
        backgroundImage: hasUrl ? CachedNetworkImageProvider(url!) : null,
        child: hasUrl ? null : Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
            style: const TextStyle(color: Color(Config.text1))),
      ),
    );
  }
}

class _NewMatches extends StatelessWidget {
  final List<Conversation> matches;
  final void Function(Conversation) onTap;
  final Set<String> onlineUsers;
  const _NewMatches({required this.matches, required this.onTap, required this.onlineUsers});
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 12, 20, 8),
          child: Text('NEW MATCHES',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: Color(Config.text2))),
        ),
        SizedBox(
          height: 96,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: matches.length,
            separatorBuilder: (_, _) => const SizedBox(width: 14),
            itemBuilder: (c, i) {
              final m = matches[i];
              return GestureDetector(
                onTap: () => onTap(m),
                child: SizedBox(
                  width: 64,
                  child: Column(children: [
                    Stack(clipBehavior: Clip.none, children: [
                      _RingAvatar(url: m.avatar, name: m.name, radius: 28, online: m.otherId != null && onlineUsers.contains(m.otherId)),
                      const Positioned(right: -2, top: -2, child: Text('✨', style: TextStyle(fontSize: 14))),
                    ]),
                    const SizedBox(height: 4),
                    Text(m.age != null ? '${m.name}, ${m.age}' : m.name,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Color(Config.text2), fontSize: 12)),
                  ]),
                ),
              );
            },
          ),
        ),
        const Divider(color: Color(0x141B1020), height: 24),
      ],
    );
  }
}

class _FilterTabs extends StatelessWidget {
  final int filter;
  final int allCount;
  final int unreadCount;
  final int admirerCount;
  final int sentCount;
  final ValueChanged<int> onChanged;
  const _FilterTabs({required this.filter, required this.allCount, required this.unreadCount, required this.admirerCount, required this.sentCount, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
      child: Row(children: [
        _tab('All $allCount', 0),
        const SizedBox(width: 8),
        _tab(unreadCount > 0 ? 'Unread $unreadCount' : 'Unread', 1),
        const SizedBox(width: 8),
        _tab(admirerCount > 0 ? '🌹 Admirers $admirerCount' : '🌹 Admirers', 2),
        const SizedBox(width: 8),
        _tab(sentCount > 0 ? '💌 Sent $sentCount' : '💌 Sent', 3),
      ]),
    );
  }

  Widget _tab(String label, int i) {
    final on = filter == i;
    return GestureDetector(
      onTap: () => onChanged(i),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: on ? const Color(0x22FF3B6B) : const Color(Config.bg3),
          borderRadius: BorderRadius.circular(999),
          border: on ? Border.all(color: const Color(0x4DFF3B6B)) : null,
        ),
        child: Text(label,
            style: TextStyle(
              fontSize: 13,
              color: on ? const Color(Config.accent) : const Color(Config.text2),
              fontWeight: on ? FontWeight.w700 : FontWeight.w500,
            )),
      ),
    );
  }
}

class _AdvisorRow extends StatelessWidget {
  final bool wingman;
  final VoidCallback onTap;
  const _AdvisorRow({required this.wingman, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: CircleAvatar(
        radius: 24,
        backgroundColor: const Color(0x22FF3B6B),
        child: Text(wingman ? '🛡️' : '💚', style: const TextStyle(fontSize: 22)),
      ),
      title: Row(children: [
        Text(wingman ? 'AI Wingman' : 'AI Bestie',
            style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: const Color(0x22FF3B6B),
            borderRadius: BorderRadius.circular(6),
          ),
          child: const Text('ADVISOR',
              style: TextStyle(color: Color(Config.accent), fontSize: 10, fontWeight: FontWeight.w700)),
        ),
      ]),
      subtitle: Text(
        wingman ? 'Match reads, approach tips & fresh insights' : 'Tips, match summaries & fresh insights',
        style: const TextStyle(color: Color(Config.text2), fontSize: 13),
      ),
      trailing: const Icon(Icons.chevron_right, color: Color(Config.text3)),
    );
  }
}

class _AdmirerCard extends StatelessWidget {
  final Admirer admirer;
  final VoidCallback onReplied;
  const _AdmirerCard({required this.admirer, required this.onReplied});

  Future<void> _reply(BuildContext context) async {
    final ctrl = TextEditingController();
    final text = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        title: Text('Reply to ${admirer.name}', style: const TextStyle(color: Color(Config.text1), fontSize: 18)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          style: const TextStyle(color: Color(Config.text1)),
          decoration: InputDecoration(
            hintText: 'Say something back…',
            hintStyle: const TextStyle(color: Color(Config.text3)),
            filled: true, fillColor: const Color(Config.bg3),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: Color(Config.text2)))),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            style: FilledButton.styleFrom(backgroundColor: const Color(Config.accent), foregroundColor: const Color(0xFFFFFFFF)),
            child: const Text('Send'),
          ),
        ],
      ),
    );
    if (text == null || text.isEmpty) return;
    try {
      final matchId = await replyToAdmirer(admirer.id, text);
      if (context.mounted && matchId != null && matchId.isNotEmpty) {
        await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => ConversationScreen(
            conversationId: matchId,
            title: admirer.age != null ? '${admirer.name}, ${admirer.age}' : admirer.name,
          ),
        ));
      }
      onReplied();
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmirer = admirer.messageType == 'secret_admirer';
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x33EC4899)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: const BoxDecoration(shape: BoxShape.circle, border: Border.fromBorderSide(BorderSide(color: Color(0xFFEC4899), width: 2))),
            child: CircleAvatar(
              radius: 22,
              backgroundColor: const Color(Config.bg3),
              backgroundImage: (admirer.avatar != null && admirer.avatar!.startsWith('http'))
                  ? CachedNetworkImageProvider(admirer.avatar!) : null,
              child: (admirer.avatar == null || !admirer.avatar!.startsWith('http'))
                  ? Text(admirer.name.isNotEmpty ? admirer.name[0].toUpperCase() : '?', style: const TextStyle(color: Color(Config.text1))) : null,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(admirer.age != null ? '${admirer.name}, ${admirer.age}' : admirer.name,
                  style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
              Text(isAdmirer ? '🌹 Secret admirer' : '👀 Wants your attention',
                  style: const TextStyle(color: Color(0xFFEC4899), fontSize: 12)),
            ]),
          ),
        ]),
        const SizedBox(height: 10),
        Text(admirer.content, style: const TextStyle(color: Color(Config.text1), height: 1.3)),
        const SizedBox(height: 12),
        if (admirer.replied)
          Row(children: [
            const Icon(Icons.check_circle, size: 16, color: Color(Config.accent)),
            const SizedBox(width: 6),
            const Text('You replied', style: TextStyle(color: Color(Config.text2), fontSize: 13)),
          ])
        else
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => _reply(context),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0x22EC4899),
                foregroundColor: const Color(0xFFE11D54),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Reply', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
      ]),
    );
  }
}

/// Informational card explaining how AI Matchmaker works (shown in Sent tab).
class _MatchmakerCard extends StatelessWidget {
  const _MatchmakerCard();
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0x22FF3B6B), Color(0x11A855F7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x33FF3B6B)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            color: const Color(0x22FF3B6B),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Center(child: Text('✨', style: TextStyle(fontSize: 22))),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('AI Matchmaker',
                  style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 15)),
              SizedBox(width: 8),
              _ActiveBadge(),
            ]),
            SizedBox(height: 4),
            Text(
              'Running every night — when your compatibility score with someone reaches 70+, a match is created automatically.',
              style: TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _ActiveBadge extends StatelessWidget {
  const _ActiveBadge();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0x2222C55E),
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Text('ACTIVE',
          style: TextStyle(color: Color(0xFF16A34A), fontSize: 10, fontWeight: FontWeight.w700)),
    );
  }
}

/// A card showing a sent admire/attention message and its reply status.
class _SentAdmirerCard extends StatelessWidget {
  final SentAdmirer admirer;
  const _SentAdmirerCard({required this.admirer});

  @override
  Widget build(BuildContext context) {
    final hasReplied = admirer.replied;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: hasReplied ? const Color(0x3322C55E) : const Color(0x33FF3B6B),
        ),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.fromBorderSide(
                BorderSide(color: hasReplied ? const Color(0xFF22C55E) : const Color(Config.accent), width: 2),
              ),
            ),
            child: CircleAvatar(
              radius: 22,
              backgroundColor: const Color(Config.bg3),
              backgroundImage: (admirer.avatar != null && admirer.avatar!.startsWith('http'))
                  ? CachedNetworkImageProvider(admirer.avatar!) : null,
              child: (admirer.avatar == null || !admirer.avatar!.startsWith('http'))
                  ? Text(admirer.name.isNotEmpty ? admirer.name[0].toUpperCase() : '?',
                      style: const TextStyle(color: Color(Config.text1))) : null,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(admirer.age != null ? '${admirer.name}, ${admirer.age}' : admirer.name,
                  style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
              Text(
                hasReplied ? '✅ They replied!' : '⏳ Waiting for reply…',
                style: TextStyle(
                  color: hasReplied ? const Color(0xFF16A34A) : const Color(Config.text2),
                  fontSize: 12,
                ),
              ),
            ]),
          ),
          Text(_ago(admirer.createdAt),
              style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
        ]),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0x0A1B1020),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text('You: ${admirer.content}',
              style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.3)),
        ),
        if (hasReplied) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0x1122C55E),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text('${admirer.name}: ${admirer.replyContent}',
                style: const TextStyle(color: Color(Config.text1), fontSize: 13, height: 1.3)),
          ),
        ],
      ]),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  final Conversation convo;
  final VoidCallback onTap;
  final String? myId;
  final bool online;
  final bool cleared;
  const _ConversationTile({required this.convo, required this.onTap, this.myId, this.online = false, this.cleared = false});

  @override
  Widget build(BuildContext context) {
    final arch = convo.archetype.isNotEmpty ? archetypeFor(convo.archetype) : null;
    return ListTile(
      onTap: onTap,
      leading: _RingAvatar(url: convo.avatar, name: convo.name, online: online),
      title: Row(children: [
        Flexible(
          child: Text(convo.age != null ? '${convo.name}, ${convo.age}' : convo.name,
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
        ),
        if (arch != null) ...[
          const SizedBox(width: 6),
          Text(arch.emoji, style: const TextStyle(fontSize: 13)),
        ],
      ]),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Row(children: [
          if (convo.trustScore > 0) ...[
            const Text('🛡', style: TextStyle(fontSize: 11)),
            const SizedBox(width: 2),
            Text('${convo.trustScore}',
                style: const TextStyle(color: Color(Config.text3), fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Builder(builder: (_) {
              final isMe = myId != null && convo.lastMessageSenderId == myId;
              final rawMsg = convo.lastMessage;
              final displayMsg = rawMsg.startsWith('[IMG]') ? '📷 Photo' : rawMsg;
              final preview = rawMsg.isNotEmpty
                  ? (isMe ? 'You: $displayMsg' : displayMsg)
                  : 'Say hello 👋';
              final hasUnread = convo.unreadCount > 0 && !cleared;
              return Text(
                preview,
                maxLines: 1, overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: hasUnread ? const Color(Config.text1) : const Color(Config.text2),
                  fontWeight: hasUnread ? FontWeight.w600 : FontWeight.w400,
                ),
              );
            }),
          ),
        ]),
      ),
      trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        if (convo.lastMessageTime != null)
          Text(_ago(convo.lastMessageTime),
              style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
        if (convo.unreadCount > 0 && !cleared) ...[
          const SizedBox(height: 4),
          CircleAvatar(
            radius: 10,
            backgroundColor: const Color(Config.accent),
            child: Text('${convo.unreadCount}',
                style: const TextStyle(color: Color(0xFFFFFFFF), fontSize: 11, fontWeight: FontWeight.w700)),
          ),
        ],
      ]),
    );
  }
}

// ── Find Match Button ──────────────────────────────────────────────────────

class _FindMatchButton extends StatelessWidget {
  final bool loading;
  final bool eligible;
  final int remaining;
  final VoidCallback onTap;
  const _FindMatchButton({required this.loading, required this.eligible, required this.remaining, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFFF3B6B), Color(0xFFFF7A4D)],
          ),
          borderRadius: BorderRadius.circular(999),
          boxShadow: [BoxShadow(color: const Color(0xFFFF3B6B).withOpacity(0.35), blurRadius: 10, offset: const Offset(0, 3))],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (loading)
            const SizedBox(
              width: 13, height: 13,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          else
            const Text('✨', style: TextStyle(fontSize: 13)),
          const SizedBox(width: 5),
          Text(
            loading ? 'Finding…' : 'Find Match',
            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
          ),
          if (!loading && eligible && remaining > 0) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.25),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('$remaining', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
            ),
          ],
        ]),
      ),
    );
  }
}

// ── Find Match Dialog ──────────────────────────────────────────────────────

class _FindMatchDialog extends StatelessWidget {
  final String status;
  final MatchmakerMatch? match;
  final int? bestScore;
  final int fmRemaining;
  final int fmRunsLimit;
  final String? debugInfo;
  final VoidCallback onGoVerify;
  final void Function(String matchId, String firstName, int? age) onOpenChat;

  const _FindMatchDialog({
    required this.status,
    required this.match,
    required this.bestScore,
    required this.fmRemaining,
    required this.fmRunsLimit,
    this.debugInfo,
    required this.onGoVerify,
    required this.onOpenChat,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(Config.bg2),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
        child: _body(context),
      ),
    );
  }

  Widget _body(BuildContext context) {
    switch (status) {
      case 'matched':
        final m = match!;
        return Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('💕', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          const Text("It's a Match!", style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Color(Config.text1))),
          const SizedBox(height: 16),
          _Avatar(url: m.avatarUrl, name: m.firstName),
          const SizedBox(height: 14),
          RichText(text: TextSpan(
            style: const TextStyle(fontSize: 14, color: Color(Config.text2), height: 1.5),
            children: [
              TextSpan(text: 'You and ${m.firstName}'),
              if (m.age != null) TextSpan(text: ', ${m.age}'),
              const TextSpan(text: ' are a '),
              TextSpan(text: '${m.score}% compatibility', style: const TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
              const TextSpan(text: ' match.'),
            ],
          )),
          const SizedBox(height: 22),
          Row(children: [
            Expanded(child: _GhostBtn(label: 'Later', onTap: () => Navigator.pop(context))),
            const SizedBox(width: 10),
            Expanded(child: _PrimaryBtn(label: 'Say Hi 👋', onTap: () => onOpenChat(m.matchId, m.firstName, m.age))),
          ]),
        ]);

      case 'needs_verification':
        return Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('🔒', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          const Text('Finish verification first', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(Config.text1))),
          const SizedBox(height: 10),
          const Text('Complete verification to join the matchmaking pool — then AI can find you a match.',
              textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: Color(Config.text2), height: 1.5)),
          const SizedBox(height: 22),
          Row(children: [
            Expanded(child: _GhostBtn(label: 'Not now', onTap: () => Navigator.pop(context))),
            const SizedBox(width: 10),
            Expanded(child: _PrimaryBtn(label: 'Verify now', onTap: onGoVerify)),
          ]),
        ]);

      case 'limit_reached':
        return Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('✨', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          const Text("You've used all your matches", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(Config.text1))),
          const SizedBox(height: 10),
          Text("You've used all $fmRunsLimit AI match searches. More will be available to unlock soon.",
              textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: Color(Config.text2), height: 1.5)),
          const SizedBox(height: 22),
          _PrimaryBtn(label: 'Got it', onTap: () => Navigator.pop(context)),
        ]);

      case 'no_match':
        final searchesLeft = fmRemaining;
        return Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('🔍', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          const Text('No match this time', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(Config.text1))),
          const SizedBox(height: 10),
          Text(
            bestScore != null
                ? 'The closest candidate scored $bestScore% — below the match bar. Enriching your profile improves your matches.'
                : 'No compatible match right now. Check back as more people join the pool.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: Color(Config.text2), height: 1.5),
          ),
          const SizedBox(height: 8),
          Text('$searchesLeft search${searchesLeft == 1 ? '' : 'es'} left',
              style: const TextStyle(fontSize: 12, color: Color(Config.text3))),
          const SizedBox(height: 22),
          _PrimaryBtn(label: 'Got it', onTap: () => Navigator.pop(context)),
        ]);

      default: // error
        return Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('⚠️', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          const Text('Something went wrong', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(Config.text1))),
          const SizedBox(height: 10),
          const Text("We couldn't run the matchmaker. Please try again in a moment.",
              textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: Color(Config.text2), height: 1.5)),
          if (debugInfo != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.red.shade900, borderRadius: BorderRadius.circular(8)),
              child: Text(debugInfo!, style: const TextStyle(fontSize: 11, color: Colors.white, fontFamily: 'monospace')),
            ),
          ],
          const SizedBox(height: 22),
          _PrimaryBtn(label: 'Close', onTap: () => Navigator.pop(context)),
        ]);
    }
  }
}

class _Avatar extends StatelessWidget {
  final String? url;
  final String name;
  const _Avatar({required this.url, required this.name});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 80, height: 80,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: const Color(Config.accent), width: 2.5),
      ),
      child: ClipOval(child: url != null
        ? CachedNetworkImage(imageUrl: url!, fit: BoxFit.cover, width: 80, height: 80)
        : Container(
            color: const Color(Config.bg3),
            alignment: Alignment.center,
            child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: Color(Config.accent))),
          ),
      ),
    );
  }
}

class _PrimaryBtn extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _PrimaryBtn({required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFFF3B6B), Color(0xFFFF7A4D)]),
        borderRadius: BorderRadius.circular(999),
      ),
      alignment: Alignment.center,
      child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15)),
    ),
  );
}

class _GhostBtn extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _GhostBtn({required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x331B1020)),
      ),
      alignment: Alignment.center,
      child: Text(label, style: const TextStyle(color: Color(Config.text2), fontWeight: FontWeight.w500, fontSize: 15)),
    ),
  );
}
