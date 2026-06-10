import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'config.dart';
import 'profile_body.dart';
import 'engage_sheets.dart';

/// Discover: one full profile at a time (the web "Public Read") with Tip /
/// Notice-me / Next. This product has no like/pass — Next just advances.
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen>
    with AutomaticKeepAliveClientMixin {
  List<DiscoveryProfile>? _feed;
  int _idx = 0;
  String? _viewerGender;
  String? _error;
  Future<MatchDetail>? _detail;
  final _scroll = ScrollController();

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _feed = null; _error = null; _idx = 0; });
    try {
      final list = await fetchDiscovery();
      fetchCurrentUserGender().then((g) { if (mounted) setState(() => _viewerGender = g); });
      if (!mounted) return;
      setState(() {
        _feed = list;
        _detail = list.isEmpty ? null : fetchMatchDetail(list.first.id);
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  void _next() {
    final feed = _feed;
    if (feed == null) return;
    if (_idx + 1 >= feed.length) {
      setState(() => _idx = feed.length); // past end → caught-up state
      return;
    }
    setState(() {
      _idx += 1;
      _detail = fetchMatchDetail(feed[_idx].id);
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  DiscoveryProfile? get _current {
    final f = _feed;
    if (f == null || _idx >= f.length) return null;
    return f[_idx];
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
            Text('Find your match', style: TextStyle(fontSize: 12, color: Color(Config.text2), fontWeight: FontWeight.w400)),
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
      return _centered(Icons.cloud_off, friendly, 'Retry', _load);
    }
    if (_feed == null) {
      return const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        CircularProgressIndicator(color: Color(Config.accent)),
        SizedBox(height: 16),
        Text('Loading profiles…', style: TextStyle(color: Color(Config.text2))),
      ]));
    }
    final cur = _current;
    if (cur == null) {
      return _centered(null, "You're all caught up — check back soon.", 'Refresh', _load, emoji: '🎉');
    }

    return Column(children: [
      Expanded(
        child: FutureBuilder<MatchDetail>(
          future: _detail,
          builder: (context, snap) {
            final d = snap.data;
            final loading = snap.connectionState == ConnectionState.waiting;
            final avatar = d?.avatar ?? cur.avatar;
            final trust = d?.trustScore ?? cur.trustScore;
            return ListView(
              controller: _scroll,
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.zero,
              children: [
                _photo(avatar, trust),
                if (loading)
                  const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator(color: Color(Config.accent))))
                else if (d == null)
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('Couldn’t load this profile.\n${snap.error ?? ''}',
                        textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2))),
                  )
                else
                  ...richProfileBody(context, d),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
      _actionBar(cur),
    ]);
  }

  Widget _photo(String? avatar, int trust) {
    return AspectRatio(
      aspectRatio: 4 / 5,
      child: Stack(fit: StackFit.expand, children: [
        if (avatar != null && avatar.startsWith('http'))
          CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover,
              placeholder: (c, _) => const ColoredBox(color: Color(Config.bg3)),
              errorWidget: (c, _, _) => const _NoPhoto())
        else
          const _NoPhoto(),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.center, end: Alignment.bottomCenter,
                colors: [Colors.transparent, Color(0xCC1B1020)]),
          ),
        ),
        if (trust > 0)
          Positioned(
            right: 16, bottom: 16,
            child: Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: const Color(0xE61B1020), shape: BoxShape.circle,
                border: Border.all(color: const Color(Config.accent), width: 2),
              ),
              child: Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('$trust%', style: const TextStyle(color: Color(Config.accent), fontSize: 17, fontWeight: FontWeight.w800, height: 1)),
                  Text(trustLabel(trust).replaceAll(' Trust', '').replaceAll('Fully Verified', 'Verified'),
                      style: const TextStyle(color: Color(Config.accent), fontSize: 8)),
                ]),
              ),
            ),
          ),
      ]),
    );
  }

  Widget _actionBar(DiscoveryProfile cur) {
    final g = _viewerGender;
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
        decoration: const BoxDecoration(
          color: Color(Config.bg1),
          border: Border(top: BorderSide(color: Color(0x141B1020))),
        ),
        child: Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: g == null ? null : () => showTipSheet(context, targetUserId: cur.id, viewerGender: g),
              icon: const Icon(Icons.chat_bubble_outline, size: 18),
              label: const Text('Tip'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(Config.text1),
                side: const BorderSide(color: Color(0x331B1020)),
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: g == null ? null : () => showAdmireSheet(context, recipientId: cur.id, viewerGender: g, name: cur.firstName),
              icon: Text(g == 'woman' ? '🌹' : '👀', style: const TextStyle(fontSize: 15)),
              label: Text(g == 'woman' ? 'Admire' : 'Notice me'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFEC4899),
                side: const BorderSide(color: Color(0x55EC4899)),
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: FilledButton(
              onPressed: _next,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.bg3),
                foregroundColor: const Color(Config.text1),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Next →', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _centered(IconData? icon, String msg, String btn, VoidCallback onTap, {String? emoji}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (emoji != null) Text(emoji, style: const TextStyle(fontSize: 40)) else if (icon != null) Icon(icon, color: const Color(Config.text3), size: 48),
          const SizedBox(height: 12),
          Text(msg, textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2))),
          const SizedBox(height: 16),
          FilledButton(onPressed: onTap, child: Text(btn)),
        ]),
      ),
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
