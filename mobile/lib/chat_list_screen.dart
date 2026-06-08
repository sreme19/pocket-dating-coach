import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
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
    with AutomaticKeepAliveClientMixin {
  late Future<_ChatData> _future;
  int _filter = 0; // 0 = All, 1 = Unread

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_ChatData> _load() async {
    final gender = await fetchCurrentUserGender();
    final convos = await fetchConversations();
    List<Admirer> admirers = const [];
    try {
      admirers = await fetchAdmirers();
    } catch (_) {/* non-fatal */}
    return _ChatData(gender: gender, conversations: convos, admirers: admirers);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  void _open(Conversation c) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ConversationScreen(
        conversationId: c.id,
        title: c.age != null ? '${c.name}, ${c.age}' : c.name,
      ),
    )).then((_) => _refresh());
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        titleSpacing: 20,
        title: const Text('Messages',
            style: TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
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
          var active = data.conversations.where((c) => c.hasMessages).toList();
          final unreadTotal = active.where((c) => c.unreadCount > 0).length;
          if (_filter == 1) active = active.where((c) => c.unreadCount > 0).toList();

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 16),
              children: [
                if (isMan || isWoman)
                  _AdvisorRow(
                    wingman: isMan,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => AdvisorScreen(wingman: isMan),
                    )),
                  ),
                if (newMatches.isNotEmpty && _filter != 2) _NewMatches(matches: newMatches, onTap: _open),
                _FilterTabs(
                  filter: _filter,
                  allCount: data.conversations.where((c) => c.hasMessages).length,
                  unreadCount: unreadTotal,
                  admirerCount: data.admirers.length,
                  onChanged: (i) => setState(() => _filter = i),
                ),
                if (_filter == 2) ...[
                  if (data.admirers.isEmpty)
                    const Padding(
                      padding: EdgeInsets.fromLTRB(20, 40, 20, 0),
                      child: Text('No admirers yet — when someone notices you, they’ll show up here. 🌹',
                          textAlign: TextAlign.center, style: TextStyle(color: Color(Config.text2))),
                    )
                  else
                    ...data.admirers.map((a) => _AdmirerCard(admirer: a, onReplied: _refresh)),
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
                  ...active.map((c) => _ConversationTile(convo: c, onTap: () => _open(c))),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _error(String e) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.cloud_off, color: Color(Config.text3), size: 48),
            const SizedBox(height: 12),
            Text(e, textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2))),
            const SizedBox(height: 16),
            FilledButton(onPressed: _refresh, child: const Text('Retry')),
          ]),
        ),
      );
}

class _ChatData {
  final String? gender;
  final List<Conversation> conversations;
  final List<Admirer> admirers;
  _ChatData({required this.gender, required this.conversations, required this.admirers});
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

/// Avatar with a colored ring (green for matches, customizable).
class _RingAvatar extends StatelessWidget {
  final String? url;
  final String name;
  final double radius;
  const _RingAvatar({required this.url, required this.name, this.radius = 24});
  @override
  Widget build(BuildContext context) {
    final hasUrl = url != null && url!.startsWith('http');
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: const Color(0xFF22C55E), width: 2)),
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
  const _NewMatches({required this.matches, required this.onTap});
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
                      _RingAvatar(url: m.avatar, name: m.name, radius: 28),
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
  final ValueChanged<int> onChanged;
  const _FilterTabs({required this.filter, required this.allCount, required this.unreadCount, required this.admirerCount, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
      child: Row(children: [
        _tab('All $allCount', 0),
        const SizedBox(width: 8),
        _tab(unreadCount > 0 ? 'Unread $unreadCount' : 'Unread', 1),
        const SizedBox(width: 8),
        _tab(admirerCount > 0 ? '🌹 Admirers $admirerCount' : '🌹 Admirers', 2),
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

class _ConversationTile extends StatelessWidget {
  final Conversation convo;
  final VoidCallback onTap;
  const _ConversationTile({required this.convo, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final arch = convo.archetype.isNotEmpty ? archetypeFor(convo.archetype) : null;
    return ListTile(
      onTap: onTap,
      leading: _RingAvatar(url: convo.avatar, name: convo.name),
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
        const Spacer(),
        if (convo.lastMessageTime != null)
          Text(_ago(convo.lastMessageTime),
              style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
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
            child: Text(
              convo.lastMessage.isNotEmpty ? convo.lastMessage : 'Say hello 👋',
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: convo.unreadCount > 0 ? const Color(Config.text1) : const Color(Config.text2),
                fontWeight: convo.unreadCount > 0 ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ),
        ]),
      ),
      trailing: convo.unreadCount > 0
          ? CircleAvatar(
              radius: 11,
              backgroundColor: const Color(Config.accent),
              child: Text('${convo.unreadCount}',
                  style: const TextStyle(color: Color(0xFFFFFFFF), fontSize: 12, fontWeight: FontWeight.w700)),
            )
          : null,
    );
  }
}
