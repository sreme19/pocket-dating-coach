import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'config.dart';
import 'match_detail_screen.dart';

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen>
    with AutomaticKeepAliveClientMixin {
  late Future<List<DiscoveryProfile>> _future;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _future = fetchDiscovery();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = fetchDiscovery();
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
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Discover',
                style: TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
            Text('Find your match',
                style: TextStyle(fontSize: 12, color: Color(Config.text2), fontWeight: FontWeight.w400)),
          ],
        ),
        centerTitle: false,
      ),
      body: FutureBuilder<List<DiscoveryProfile>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                CircularProgressIndicator(color: Color(Config.accent)),
                SizedBox(height: 16),
                Text('Loading profiles…', style: TextStyle(color: Color(Config.text2))),
              ]),
            );
          }
          if (snap.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.cloud_off, color: Color(Config.text3), size: 48),
                  const SizedBox(height: 12),
                  Text('Could not load matches.\n${snap.error}',
                      textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2))),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _refresh, child: const Text('Retry')),
                ]),
              ),
            );
          }
          final profiles = snap.data ?? const [];
          if (profiles.isEmpty) {
            return const Center(
              child: Text('No matches right now — check back soon.',
                  style: TextStyle(color: Color(Config.text2))),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: profiles.length,
              separatorBuilder: (_, _) => const SizedBox(height: 16),
              itemBuilder: (context, i) => GestureDetector(
                onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => MatchDetailScreen(
                    profileId: profiles[i].id,
                    fallbackName: profiles[i].firstName,
                    fallbackAvatar: profiles[i].avatar,
                  ),
                )),
                child: _MatchCard(profile: profiles[i]),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _MatchCard extends StatelessWidget {
  final DiscoveryProfile profile;
  const _MatchCard({required this.profile});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: AspectRatio(
        aspectRatio: 3 / 4,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Image-heavy: each card loads a remote hero photo.
            if (profile.avatar != null && profile.avatar!.startsWith('http'))
              CachedNetworkImage(
                imageUrl: profile.avatar!,
                fit: BoxFit.cover,
                placeholder: (c, _) => const ColoredBox(color: Color(Config.bg3)),
                errorWidget: (c, _, _) => const _NoPhoto(),
              )
            else
              const _NoPhoto(),

            // Legibility gradient.
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.center,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0xCC000000)],
                ),
              ),
            ),

            // Trust badge.
            Positioned(
              top: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xE6052819),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(Config.accent)),
                ),
                child: Text('${profile.trustScore}% ${profile.trustLabel}',
                    style: const TextStyle(
                        color: Color(Config.accent), fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ),

            // Identity overlay.
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    profile.age != null ? '${profile.firstName}, ${profile.age}' : profile.firstName,
                    style: const TextStyle(
                        color: Colors.white, fontSize: 26, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Row(children: [
                    if (profile.city != null) ...[
                      const Icon(Icons.location_on_outlined, size: 15, color: Colors.white70),
                      const SizedBox(width: 3),
                      Flexible(child: Text(profile.city!,
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white70))),
                    ],
                    if (profile.distance != null) ...[
                      const SizedBox(width: 8),
                      Text('· ${profile.distance}', style: const TextStyle(color: Colors.white60, fontSize: 13)),
                    ],
                  ]),
                  const SizedBox(height: 10),
                  Row(children: [
                    if (profile.archetypeLabel.isNotEmpty)
                      _chip('✨ ${profile.archetypeLabel}', const Color(0x33A855F7), const Color(0xFFD8B4FE)),
                    const SizedBox(width: 8),
                    if (profile.verifiedCount > 0)
                      _chip('✓ ${profile.verifiedCount} verified', const Color(0x2234D399), const Color(Config.accent)),
                  ]),
                  if (profile.intent != null && profile.intent!.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text('Here for: ${profile.intent}',
                        maxLines: 2, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontSize: 14)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String text, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(text, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

class _NoPhoto extends StatelessWidget {
  const _NoPhoto();
  @override
  Widget build(BuildContext context) => const ColoredBox(
        color: Color(Config.bg3),
        child: Center(child: Text('📸', style: TextStyle(fontSize: 40))),
      );
}
