import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

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
          _header('APP'),
          _row('Version', '1.0.1 (1)'),
          _row('Build', 'Flutter · Verified Vibe'),
          const SizedBox(height: 28),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: SizedBox(
              height: 50,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await Supabase.instance.client.auth.signOut();
                  if (context.mounted) Navigator.of(context).popUntil((r) => r.isFirst);
                },
                icon: const Icon(Icons.logout, color: Color(0xFFF87171)),
                label: const Text('Sign out', style: TextStyle(color: Color(0xFFF87171), fontWeight: FontWeight.w600)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0x33F87171)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _header(String t) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
        child: Text(t, style: const TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
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
