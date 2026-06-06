import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
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
    return _ChatData(gender: gender, conversations: convos);
  }

  Future<void> _refresh() async {
    setState(() {
      _future = _load();
    });
    await _future;
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
          if (snap.hasError) {
            return _error(snap.error.toString());
          }
          final data = snap.data!;
          final isMan = data.gender == 'man';
          final isWoman = data.gender == 'woman';
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                if (isMan || isWoman)
                  _AdvisorRow(
                    wingman: isMan,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => AdvisorScreen(wingman: isMan),
                    )),
                  ),
                if (data.conversations.isEmpty)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(20, 40, 20, 0),
                    child: Text('No conversations yet — your matches will show up here.',
                        textAlign: TextAlign.center, style: TextStyle(color: Color(Config.text2))),
                  )
                else
                  ...data.conversations.map((c) => _ConversationTile(
                        convo: c,
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => ConversationScreen(
                            conversationId: c.id,
                            title: c.age != null ? '${c.name}, ${c.age}' : c.name,
                          ),
                        )),
                      )),
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
  _ChatData({required this.gender, required this.conversations});
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
        backgroundColor: const Color(0x2234D399),
        child: Text(wingman ? '🛡️' : '💚', style: const TextStyle(fontSize: 22)),
      ),
      title: Row(children: [
        Text(wingman ? 'AI Wingman' : 'AI Bestie',
            style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: const Color(0x2234D399),
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

class _ConversationTile extends StatelessWidget {
  final Conversation convo;
  final VoidCallback onTap;
  const _ConversationTile({required this.convo, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: CircleAvatar(
        radius: 24,
        backgroundColor: const Color(Config.bg3),
        backgroundImage: (convo.avatar != null && convo.avatar!.startsWith('http'))
            ? CachedNetworkImageProvider(convo.avatar!)
            : null,
        child: (convo.avatar == null || !convo.avatar!.startsWith('http'))
            ? Text(convo.name.isNotEmpty ? convo.name[0] : '?',
                style: const TextStyle(color: Color(Config.text1)))
            : null,
      ),
      title: Text(convo.age != null ? '${convo.name}, ${convo.age}' : convo.name,
          style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
      subtitle: Text(
        convo.lastMessage.isNotEmpty ? convo.lastMessage : 'Say hello 👋',
        maxLines: 1, overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: Color(Config.text2)),
      ),
      trailing: convo.unreadCount > 0
          ? CircleAvatar(
              radius: 11,
              backgroundColor: const Color(Config.accent),
              child: Text('${convo.unreadCount}',
                  style: const TextStyle(color: Color(0xFF052819), fontSize: 12, fontWeight: FontWeight.w700)),
            )
          : null,
    );
  }
}
