import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'config.dart';
import 'settings_screen.dart';
import 'trust_boost_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Future<ProfileData> _future;

  @override
  void initState() {
    super.initState();
    _future = fetchProfile();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = fetchProfile();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('My Profile',
            style: TextStyle(fontWeight: FontWeight.w600, color: Color(Config.text1))),
        centerTitle: true,
        actions: [
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.settings_outlined, color: Color(Config.text2)),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
        ],
      ),
      body: FutureBuilder<ProfileData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const _Loading();
          }
          if (snap.hasError || !snap.hasData) {
            return _ErrorState(onRetry: _refresh, error: '${snap.error ?? 'No data'}');
          }
          // Data is ready — the entire populated UI is built in one pass and
          // painted in a single frame. No empty-then-mutate, so nothing to
          // "switch screens to fix" like the WebView.
          return RefreshIndicator(
            onRefresh: _refresh,
            child: _ProfileBody(data: snap.data!),
          );
        },
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();
  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: Color(Config.accent)),
          SizedBox(height: 16),
          Text('Loading your profile…', style: TextStyle(color: Color(Config.text2))),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  final String error;
  const _ErrorState({required this.onRetry, required this.error});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, color: Color(Config.text3), size: 48),
            const SizedBox(height: 12),
            Text(error, textAlign: TextAlign.center,
                style: const TextStyle(color: Color(Config.text2))),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _ProfileBody extends StatelessWidget {
  final ProfileData data;
  const _ProfileBody({required this.data});

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        _Hero(url: data.heroPhotoUrl),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                data.age != null ? '${data.name}, ${data.age}' : data.name,
                style: const TextStyle(
                  fontSize: 30, fontWeight: FontWeight.w700,
                  fontStyle: FontStyle.italic, color: Color(Config.text1),
                ),
              ),
              if (data.city != null) ...[
                const SizedBox(height: 6),
                Row(children: [
                  const Icon(Icons.location_on_outlined, size: 16, color: Color(Config.text2)),
                  const SizedBox(width: 4),
                  Text(data.city!, style: const TextStyle(color: Color(Config.text2))),
                ]),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Row(
            children: [
              _Stat(label: 'TRUST', value: data.trustScore > 0 ? '${data.trustScore}' : '—',
                  sub: data.trustScore > 0 ? 'score' : 'not yet'),
              _divider(),
              _Stat(label: 'PROFILE', value: data.profileComplete ? '✓' : '—',
                  sub: data.profileComplete ? 'complete' : 'incomplete',
                  valueColor: const Color(0xFFF59E0B)),
              _divider(),
              _Stat(label: 'VERIFIED', value: '${data.proofsCount}',
                  sub: 'proofs', valueColor: const Color(Config.accent)),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
          child: SizedBox(
            width: double.infinity, height: 50,
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const TrustBoostScreen()),
              ),
              icon: const Icon(Icons.bolt),
              label: const Text('Trust & Boost', style: TextStyle(fontWeight: FontWeight.w700)),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0x2234D399),
                foregroundColor: const Color(Config.accent),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
            ),
          ),
        ),
        const Divider(color: Color(0x14FFFFFF), height: 32),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.auto_awesome, size: 16, color: Color(Config.text2)),
                const SizedBox(width: 6),
                const Text('ABOUT',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                        letterSpacing: 0.5, color: Color(Config.text2))),
              ]),
              const SizedBox(height: 10),
              Text(
                data.about.isNotEmpty ? data.about : 'Your story goes here.',
                style: const TextStyle(fontSize: 16, height: 1.5, color: Color(Config.text1)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _divider() => Container(width: 1, height: 36, color: const Color(0x14FFFFFF));
}

class _Hero extends StatelessWidget {
  final String? url;
  const _Hero({required this.url});
  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 4 / 5,
      child: (url != null && url!.startsWith('http'))
          ? CachedNetworkImage(
              imageUrl: url!,
              fit: BoxFit.cover,
              placeholder: (c, _) => const ColoredBox(
                color: Color(Config.bg2),
                child: Center(child: CircularProgressIndicator(color: Color(Config.accent))),
              ),
              errorWidget: (c, _, _) => const _PhotoPlaceholder(),
            )
          : const _PhotoPlaceholder(),
    );
  }
}

class _PhotoPlaceholder extends StatelessWidget {
  const _PhotoPlaceholder();
  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(Config.bg2),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('📸', style: TextStyle(fontSize: 40)),
            SizedBox(height: 8),
            Text('Add photos to boost\nyour profile',
                textAlign: TextAlign.center, style: TextStyle(color: Color(Config.text3))),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label, value, sub;
  final Color? valueColor;
  const _Stat({required this.label, required this.value, required this.sub, this.valueColor});
  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
              letterSpacing: 0.5, color: Color(Config.text3))),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700,
              color: valueColor ?? const Color(Config.text1))),
          const SizedBox(height: 2),
          Text(sub, style: const TextStyle(fontSize: 12, color: Color(Config.text2))),
        ],
      ),
    );
  }
}
