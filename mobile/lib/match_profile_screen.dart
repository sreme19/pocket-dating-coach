import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'profile_body.dart';
import 'season.dart';

class MatchProfileScreen extends StatefulWidget {
  final String userId;
  final String title;
  const MatchProfileScreen({super.key, required this.userId, required this.title});

  @override
  State<MatchProfileScreen> createState() => _MatchProfileScreenState();
}

class _MatchProfileScreenState extends State<MatchProfileScreen> {
  late Future<MatchDetail> _future;

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('match_profile');
    _future = fetchMatchDetail(widget.userId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      body: FutureBuilder<MatchDetail>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator(color: Brand.accent));
          }
          if (snap.hasError || snap.data == null) {
            return Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.person_off, color: Color(Config.text3), size: 48),
                const SizedBox(height: 12),
                const Text('Could not load profile', style: TextStyle(color: Color(Config.text2))),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => setState(() { _future = fetchMatchDetail(widget.userId); }),
                  child: const Text('Retry'),
                ),
              ]),
            );
          }
          final d = snap.data!;
          final hasPhoto = d.avatar != null && d.avatar!.startsWith('http');
          return CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: MediaQuery.of(context).size.width * 1.25,
                pinned: true,
                backgroundColor: const Color(Config.bg1),
                foregroundColor: const Color(Config.text1),
                title: Text(widget.title,
                    style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
                flexibleSpace: FlexibleSpaceBar(
                  background: Stack(fit: StackFit.expand, children: [
                    if (hasPhoto)
                      CachedNetworkImage(imageUrl: d.avatar!, fit: BoxFit.cover)
                    else
                      const ColoredBox(color: Color(Config.bg3)),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.center,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Color(0xCC1B1020)],
                        ),
                      ),
                    ),
                    if (d.heroIsAi && hasPhoto)
                      Positioned(
                        left: 16, top: 16,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: const Color(0x9E1B1020),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text('✨ Generated from verified photos',
                              style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                        ),
                      ),
                    if (d.trustScore > 0)
                      Positioned(
                        right: 16, bottom: 16,
                        child: Container(
                          width: 64, height: 64,
                          decoration: BoxDecoration(
                            color: const Color(0xE61B1020),
                            shape: BoxShape.circle,
                            border: Border.all(color: Brand.accent, width: 2),
                          ),
                          child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Text('${d.trustScore}%',
                                style: TextStyle(color: Brand.accent, fontSize: 17, fontWeight: FontWeight.w800, height: 1)),
                            Text(trustLabel(d.trustScore).replaceAll(' Trust', '').replaceAll('Fully Verified', 'Verified'),
                                style: TextStyle(color: Brand.accent, fontSize: 8)),
                          ])),
                        ),
                      ),
                  ]),
                ),
              ),
              SliverList(
                delegate: SliverChildListDelegate([
                  ...richProfileBody(context, d),
                  const SizedBox(height: 32),
                ]),
              ),
            ],
          );
        },
      ),
    );
  }
}
