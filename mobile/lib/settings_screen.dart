import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api.dart';
import 'app_logger.dart';
import 'blocked_users_screen.dart';
import 'config.dart';
import 'preference_weighting_screen.dart';
import 'profile_strength_screen.dart';
import 'push_service.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  Future<void> _signOut(BuildContext context, {bool localOnly = false}) async {
    await PushService.signOutCleanup();
    try {
      await Supabase.instance.client.auth.signOut(
        scope: localOnly ? SignOutScope.local : SignOutScope.global,
      );
    } catch (_) {
      AppLogger.instance.error('sign_out failed', screen: 'settings', action: 'sign_out');
      // If server-side user was already deleted, force local session clear.
      await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);
    }
    if (context.mounted) Navigator.of(context).popUntil((r) => r.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('Settings',
            style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
      ),
      body: ListView(
        children: [
          _header('ACCOUNT'),
          _row('Email', user?.email ?? '—'),
          _row('User ID', user?.id ?? '—', mono: true),
          _header('MATCHING'),
          _navRow(
            context,
            'Profile strength',
            'See your standing and how to climb',
            const ProfileStrengthScreen(),
          ),
          _navRow(
            context,
            'What you value',
            'Tune how much each quality matters to you in a match',
            const PreferenceWeightingScreen(),
          ),
          _header('SAFETY'),
          _navRow(
            context,
            'Blocked users',
            'Review and unblock people you’ve blocked',
            const BlockedUsersScreen(),
          ),
          _header('APP'),
          _row('Version', '1.0.1 (9)'),
          _row('Build', 'Flutter · riteangle'),
          const SizedBox(height: 28),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: SizedBox(
              height: 50,
              child: OutlinedButton.icon(
                onPressed: () => _signOut(context),
                icon: const Icon(Icons.logout, color: Color(0xFFF87171)),
                label: const Text('Sign out', style: TextStyle(color: Color(0xFFF87171), fontWeight: FontWeight.w600)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0x33F87171)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ),
          const SizedBox(height: 32),
          Center(
            child: TextButton(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: const Color(Config.bg2),
                shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
                builder: (_) => DeleteAccountSheet(onDeleted: () => _signOut(context)),
              ),
              child: const Text('Delete account',
                  style: TextStyle(color: Color(Config.text3), decoration: TextDecoration.underline)),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _header(String t) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
        child: Text(t, style: const TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
      );

  Widget _navRow(BuildContext context, String title, String sub, Widget dest) => InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => dest)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: const TextStyle(color: Color(Config.text1), fontSize: 15, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(sub, style: const TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.35)),
                ]),
              ),
              const Icon(Icons.chevron_right, color: Color(Config.text3)),
            ],
          ),
        ),
      );

  Widget _row(String label, String value, {bool mono = false}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: Color(Config.text2), fontSize: 15)),
            const SizedBox(width: 16),
            Expanded(
              child: Text(value, textAlign: TextAlign.right,
                  style: TextStyle(
                      color: const Color(Config.text1), fontSize: mono ? 12 : 15,
                      fontFamily: mono ? 'monospace' : null)),
            ),
          ],
        ),
      );
}

/// Delete-account flow: optional churn reason + feedback, then type DELETE to
/// confirm. Calls DELETE /api/verified-vibe/account, then signs out.
class DeleteAccountSheet extends StatefulWidget {
  final VoidCallback onDeleted;
  const DeleteAccountSheet({super.key, required this.onDeleted});
  @override
  State<DeleteAccountSheet> createState() => _DeleteAccountSheetState();
}

class _DeleteAccountSheetState extends State<DeleteAccountSheet> {
  static const _reasons = <({String value, String label, String emoji})>[
    (value: 'found_someone', label: 'I met someone', emoji: '🎉'),
    (value: 'taking_break', label: 'Taking a break', emoji: '🌿'),
    (value: 'not_enough_matches', label: 'Not enough quality matches', emoji: '🔍'),
    (value: 'privacy', label: 'Privacy concerns', emoji: '🔒'),
    (value: 'too_expensive', label: 'Too expensive', emoji: '💸'),
    (value: 'technical', label: 'Bugs or technical issues', emoji: '🐞'),
    (value: 'other', label: 'Something else', emoji: '💬'),
  ];

  String? _reason;
  final _feedback = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  bool get _canDelete => _confirm.text.trim().toUpperCase() == 'DELETE';

  Future<void> _delete() async {
    if (!_canDelete || _busy) return;
    setState(() { _busy = true; _error = null; });
    try {
      await deleteAccount(reason: _reason, feedback: _feedback.text.trim());
      // Server deleted the auth user — clear local session immediately.
      await PushService.signOutCleanup();
      await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'settings', action: 'delete_account');
      setState(() { _busy = false; _error = 'Could not delete: $e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Delete account & data',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(Config.text1))),
          const SizedBox(height: 6),
          const Text('This permanently deletes your profile, matches, messages, and proofs. This can’t be undone.',
              style: TextStyle(fontSize: 13, color: Color(Config.text2), height: 1.4)),
          const SizedBox(height: 16),
          const Text('Mind sharing why? (optional)', style: TextStyle(fontSize: 13, color: Color(Config.text2))),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final r in _reasons)
              GestureDetector(
                onTap: () => setState(() => _reason = _reason == r.value ? null : r.value),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: _reason == r.value ? const Color(0x22F87171) : const Color(Config.bg3),
                    borderRadius: BorderRadius.circular(999),
                    border: _reason == r.value ? Border.all(color: const Color(0xFFF87171)) : null,
                  ),
                  child: Text('${r.emoji} ${r.label}',
                      style: TextStyle(fontSize: 13, color: _reason == r.value ? const Color(0xFFF87171) : const Color(Config.text2))),
                ),
              ),
          ]),
          const SizedBox(height: 14),
          TextField(
            controller: _feedback,
            maxLines: 2,
            style: const TextStyle(color: Color(Config.text1)),
            decoration: InputDecoration(
              hintText: 'Anything else? (optional)',
              hintStyle: const TextStyle(color: Color(Config.text3)),
              filled: true, fillColor: const Color(Config.bg3),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _confirm,
            onChanged: (_) => setState(() {}),
            textCapitalization: TextCapitalization.characters,
            style: const TextStyle(color: Color(Config.text1)),
            decoration: InputDecoration(
              labelText: 'Type DELETE to confirm',
              labelStyle: const TextStyle(color: Color(Config.text2)),
              filled: true, fillColor: const Color(Config.bg3),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity, height: 50,
            child: FilledButton(
              onPressed: (_canDelete && !_busy) ? _delete : null,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFF87171),
                foregroundColor: const Color(0xFF3B0A0A),
                disabledBackgroundColor: const Color(Config.bg3),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF3B0A0A)))
                  : const Text('Delete account', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ]),
      ),
    );
  }
}
