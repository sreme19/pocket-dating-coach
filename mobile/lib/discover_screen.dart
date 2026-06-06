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
  List<DiscoveryProfile>? _profiles;
  String? _error;
  final Set<String> _acting = {};

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _profiles = null;
      _error = null;
    });
    try {
      final list = await fetchDiscovery();
      if (mounted) setState(() => _profiles = list);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _act(DiscoveryProfile p, bool like) async {
    if (_acting.contains(p.id)) return;
    setState(() => _acting.add(p.id));
    try {
      var matched = false;
      if (like) {
        matched = await likeProfile(p.id);
      } else {
        await passProfile(p.id);
      }
      if (!mounted) return;
      setState(() => _profiles?.removeWhere((x) => x.id == p.id));
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(Config.bg3),
        content: Text(
          matched ? "It's a match with ${p.firstName}! 🎉" : (like ? 'Liked ${p.firstName}' : 'Passed'),
          style: const TextStyle(color: Color(Config.text1)),
        ),
      ));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
      }
    } finally {
      _acting.remove(p.id);
    }
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
            Text('Discover', style: TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
            Text('Find your match',
                style: TextStyle(fontSize: 12, color: Color(Config.text2), fontWeight: FontWeight.w400)),
          ],
        ),
        centerTitle: false,
      ),
      body: _body(),
    );
  }

  Widget _body() {
    if (_error != null) {
      final friendly = _error!.contains('401')
          ? 'Your session expired — sign out and back in.'
          : "Couldn't load matches. Check your connection and retry.";
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.cloud_off, color: Color(Config.text3), size: 48),
            const SizedBox(height: 12),
            Text(friendly, textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2))),
            const SizedBox(height: 16),
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ]),
        ),
      );
    }
    if (_profiles == null) {
      return const Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          CircularProgressIndicator(color: Color(Config.accent)),
          SizedBox(height: 16),
          Text('Loading profiles…', style: TextStyle(color: Color(Config.text2))),
        ]),
      );
    }
    final profiles = _profiles!;
    if (profiles.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('🎉', style: TextStyle(fontSize: 40)),
            const SizedBox(height: 12),
            const Text("You're all caught up — check back soon.",
                textAlign: TextAlign.center, style: TextStyle(color: Color(Config.text2))),
            const SizedBox(height: 16),
            FilledButton(onPressed: _load, child: const Text('Refresh')),
          ]),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        itemCount: profiles.length,
        separatorBuilder: (_, _) => const SizedBox(height: 16),
        itemBuilder: (context, i) => _MatchCard(
          profile: profiles[i],
          onOpen: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => MatchDetailScreen(
              profileId: profiles[i].id,
              fallbackName: profiles[i].firstName,
              fallbackAvatar: profiles[i].avatar,
            ),
          )),
          onPass: () => _act(profiles[i], false),
          onLike: () => _act(profiles[i], true),
        ),
      ),
    );
  }
}

class _MatchCard extends StatelessWidget {
  final DiscoveryProfile profile;
  final VoidCallback onOpen;
  final VoidCallback onPass;
  final VoidCallback onLike;
  const _MatchCard({required this.profile, required this.onOpen, required this.onPass, required this.onLike});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onOpen,
      behavior: HitTestBehavior.opaque,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: AspectRatio(
          aspectRatio: 3 / 4,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (profile.avatar != null && profile.avatar!.startsWith('http'))
                CachedNetworkImage(
                  imageUrl: profile.avatar!,
                  fit: BoxFit.cover,
                  placeholder: (c, _) => const ColoredBox(color: Color(Config.bg3)),
                  errorWidget: (c, _, _) => const _NoPhoto(),
                )
              else
                const _NoPhoto(),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.center, end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Color(0xE6000000)],
                  ),
                ),
              ),
              Positioned(
                top: 12, right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xE6052819),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(Config.accent)),
                  ),
                  child: Text('${profile.trustScore}% ${profile.trustLabel}',
                      style: const TextStyle(color: Color(Config.accent), fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ),
              Positioned(
                left: 16, right: 16, bottom: 76,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(profile.age != null ? '${profile.firstName}, ${profile.age}' : profile.firstName,
                        style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    if (profile.city != null)
                      Row(children: [
                        const Icon(Icons.location_on_outlined, size: 15, color: Colors.white70),
                        const SizedBox(width: 3),
                        Flexible(child: Text(profile.city!,
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white70))),
                        if (profile.distance != null)
                          Text('  ·  ${profile.distance}', style: const TextStyle(color: Colors.white60, fontSize: 13)),
                      ]),
                    const SizedBox(height: 8),
                    if (profile.archetypeLabel.isNotEmpty)
                      _chip('✨ ${profile.archetypeLabel}', const Color(0x33A855F7), const Color(0xFFD8B4FE)),
                  ],
                ),
              ),
              // Pass / Like actions
              Positioned(
                left: 0, right: 0, bottom: 16,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _actionBtn(Icons.close, const Color(0xFFF87171), onPass),
                    const SizedBox(width: 24),
                    _actionBtn(Icons.favorite, const Color(Config.accent), onLike),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _actionBtn(IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 52, height: 52,
        decoration: BoxDecoration(
          color: const Color(0xCC0B1120),
          shape: BoxShape.circle,
          border: Border.all(color: color, width: 2),
        ),
        child: Icon(icon, color: color, size: 26),
      ),
    );
  }

  Widget _chip(String text, Color bg, Color fg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600)),
      );
}

class _NoPhoto extends StatelessWidget {
  const _NoPhoto();
  @override
  Widget build(BuildContext context) => const ColoredBox(
        color: Color(Config.bg3),
        child: Center(child: Text('📸', style: TextStyle(fontSize: 40))),
      );
}
