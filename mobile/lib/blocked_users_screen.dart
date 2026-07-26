import 'package:flutter/material.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'season.dart';

/// Settings › Blocked users. Lists everyone the user has blocked and lets them
/// unblock (reverses the bidirectional block; does not recreate the old match).
class BlockedUsersScreen extends StatefulWidget {
  const BlockedUsersScreen({super.key});

  @override
  State<BlockedUsersScreen> createState() => _BlockedUsersScreenState();
}

class _BlockedUsersScreenState extends State<BlockedUsersScreen> {
  List<BlockedUser>? _users;
  String? _error;
  final _busy = <String>{}; // ids currently being unblocked

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _error = null; });
    try {
      final list = await fetchBlockedUsers();
      if (mounted) setState(() => _users = list);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'blocked_users', action: 'load');
      if (mounted) setState(() { _error = 'Could not load blocked users.'; _users = const []; });
    }
  }

  Future<void> _unblock(BlockedUser u) async {
    setState(() => _busy.add(u.id));
    try {
      await unblockUser(u.id);
      if (mounted) setState(() => _users = _users?.where((x) => x.id != u.id).toList());
    } catch (e) {
      AppLogger.instance.error(e, screen: 'blocked_users', action: 'unblock');
      if (mounted) {
        setState(() => _busy.remove(u.id));
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not unblock: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final users = _users;
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('Blocked users',
            style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
      ),
      body: users == null
          ? Center(child: CircularProgressIndicator(color: Brand.accent))
          : users.isEmpty
              ? _empty()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: users.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0x141B1020)),
                    itemBuilder: (_, i) => _tile(users[i]),
                  ),
                ),
    );
  }

  Widget _empty() => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.block, size: 40, color: Color(Config.text3)),
            const SizedBox(height: 12),
            Text(_error ?? "You haven't blocked anyone.",
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(Config.text2), fontSize: 15)),
            const SizedBox(height: 4),
            const Text('Blocked people can’t see you and won’t appear in Discover.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.4)),
          ]),
        ),
      );

  Widget _tile(BlockedUser u) {
    final hasAvatar = u.avatar != null && u.avatar!.startsWith('http');
    final busy = _busy.contains(u.id);
    final label = u.age != null ? '${u.name}, ${u.age}' : u.name;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      leading: CircleAvatar(
        radius: 22,
        backgroundColor: const Color(Config.bg3),
        backgroundImage: hasAvatar ? NetworkImage(u.avatar!) : null,
        child: hasAvatar ? null : Text(u.name.isNotEmpty ? u.name[0].toUpperCase() : '?',
            style: const TextStyle(color: Color(Config.text2), fontWeight: FontWeight.w700)),
      ),
      title: Text(label, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
      trailing: busy
          ? SizedBox(width: 20, height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: Brand.accent))
          : OutlinedButton(
              onPressed: () => _unblock(u),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Brand.accent),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              ),
              child: Text('Unblock',
                  style: TextStyle(color: Brand.accent, fontWeight: FontWeight.w700)),
            ),
    );
  }
}
