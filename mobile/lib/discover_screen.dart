import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'app_logger.dart';
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
  List<BestieFlag> _bestieFlags = [];
  bool _bestieFlagsLoading = false;
  // Cold-start review animation — when Bestie generates a fresh take (cache miss),
  // we cycle through what she's checking so the wait reads as live analysis, not a dead spinner.
  Timer? _bestieReviewTimer;
  int _bestieReviewStep = 0;
  static const List<String> _bestieReviewSteps = [
    'Pulling up his verified proofs…',
    'Cross-checking his claims against what\'s verified…',
    'Flagging anything that doesn\'t add up…',
    'Putting your take together…',
  ];
  final Set<String> _sentAttentionIds = {}; // profiles already noticed/admired
  final Set<String> _tippedIds = {}; // profiles tipped this session
  final Set<String> _matchedUserIds = {}; // already mutual matches — hide Tip/Notice me
  bool _autoSkipping = false; // guard against re-entrant auto-skip

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('discover');
    _load();
  }

  @override
  void dispose() {
    _bestieReviewTimer?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    AppLogger.instance.action('discover', 'load_feed');
    // Don't clear the existing feed — keep it visible while reloading.
    setState(() { _error = null; });
    try {
      // Fetch profiles + gender in parallel so Tip/Notice buttons are
      // enabled immediately when profiles appear (not after a second setState).
      final results = await Future.wait([fetchDiscovery(), fetchCurrentUserGender()]);
      final list = results[0] as List<DiscoveryProfile>;
      final g = results[1] as String?;
      if (mounted) {
        setState(() => _viewerGender = g);
        _maybeFetchBestie();
      }
      // Load already-sent attention IDs so buttons show correct state
      fetchSentAdmirers().then((sent) {
        if (mounted) setState(() => _sentAttentionIds.addAll(sent.map((s) => s.recipientId)));
      }).catchError((_) {});
      // Load matched user IDs — hide Tip/Notice me for existing matches
      fetchConversations().then((convos) {
        if (mounted) {
          setState(() {
            for (final c in convos) {
              if (c.otherId != null) _matchedUserIds.add(c.otherId!);
            }
          });
        }
      }).catchError((_) {});
      if (!mounted) return;
      setState(() {
        _feed = list;
        _idx = 0;
        _bestieFlags = [];
        _bestieFlagsLoading = false;
        _detail = list.isEmpty || list.first.id.startsWith('seed-') ? null : fetchMatchDetail(list.first.id);
      });
    } catch (e) {
      AppLogger.instance.error(e, screen: 'discover', action: 'load_feed');
      if (!mounted) return;
      final msg = e.toString();
      final friendly = msg.contains('401') || msg.contains('Unauthorized')
          ? 'Session expired — please restart the app.'
          : (msg.contains('SocketException') || msg.contains('network') ||
                  msg.contains('connection') || msg.contains('timeout') ||
                  msg.contains('DioException'))
              ? 'No internet connection. Pull down to retry.'
              : 'Could not load profiles. Pull down to retry.';
      setState(() => _error = friendly);
    }
  }

  void _maybeFetchBestie() {
    final cur = _current;
    if (_viewerGender != 'woman' || cur == null || cur.gender != 'man') return;
    setState(() { _bestieFlags = []; _bestieFlagsLoading = true; _bestieReviewStep = 0; });
    _startBestieReview();
    fetchBestieFlags(cur.id).then((flags) {
      if (mounted) setState(() { _bestieFlags = flags; _bestieFlagsLoading = false; });
      _stopBestieReview();
    });
  }

  /// Cycle the review steps every ~1.4s while a fresh take is being generated.
  /// Cached takes return near-instantly, so this only meaningfully shows on a
  /// cold start — which is exactly the "Bestie is working for you" moment.
  void _startBestieReview() {
    _bestieReviewTimer?.cancel();
    _bestieReviewTimer = Timer.periodic(const Duration(milliseconds: 1400), (_) {
      if (!mounted || !_bestieFlagsLoading) { _stopBestieReview(); return; }
      setState(() {
        _bestieReviewStep = (_bestieReviewStep + 1) % _bestieReviewSteps.length;
      });
    });
  }

  void _stopBestieReview() {
    _bestieReviewTimer?.cancel();
    _bestieReviewTimer = null;
  }

  void _next() {
    AppLogger.instance.action('discover', 'skip');
    final feed = _feed;
    if (feed == null) return;
    if (_idx + 1 >= feed.length) {
      setState(() => _idx = feed.length); // past end → caught-up state
      return;
    }
    setState(() {
      _idx += 1;
      _detail = feed[_idx].id.startsWith('seed-') ? null : fetchMatchDetail(feed[_idx].id);
      _bestieFlags = [];
      _bestieFlagsLoading = false;
      _autoSkipping = false;
    });
    _maybeFetchBestie();
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  /// Loop back to the top after the end of the feed. Skipped profiles reappear
  /// on this fresh pass; anyone matched mid-session is dropped so matches don't
  /// resurface. No refetch — purely client-side re-pass of the loaded feed.
  void _startOver() {
    final feed = _feed;
    if (feed == null) return;
    final remaining = feed.where((p) => !_matchedUserIds.contains(p.id)).toList();
    setState(() {
      _feed = remaining;
      _idx = 0;
      _bestieFlags = [];
      _bestieFlagsLoading = false;
      _autoSkipping = false;
      _detail = remaining.isEmpty || remaining.first.id.startsWith('seed-') ? null : fetchMatchDetail(remaining.first.id);
    });
    if (remaining.isNotEmpty) _maybeFetchBestie();
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
      // Empty feed (nobody to show) vs reaching the end of a non-empty feed.
      if (_feed!.isEmpty) {
        return _centered(null, "You're all caught up — check back soon.", 'Refresh', _load, emoji: '🎉');
      }
      return _endOfFeed();
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
                _photo(avatar, trust, d?.heroIsAi ?? false),
                if (loading)
                  const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator(color: Color(Config.accent))))
                else if (d == null && snap.hasError) ...[
                  _profileError(snap.error),
                ]
                else ...[
                  if (d != null) ...richProfileBody(context, d),
                  if (_viewerGender == 'woman' && _current?.gender == 'man')
                    _bestieTake(),
                ],
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
      _actionBar(cur),
    ]);
  }

  Widget _profileError(Object? err) {
    final is404 = err.toString().contains('404');
    // Auto-skip deleted/unavailable profiles without user interaction.
    if (is404 && !_autoSkipping) {
      _autoSkipping = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) { _autoSkipping = false; _next(); }
      });
    }
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(
          is404 ? 'This profile is no longer available.' : "Couldn't load this profile.",
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(Config.text2), fontSize: 14),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _next,
          style: FilledButton.styleFrom(
            backgroundColor: const Color(Config.bg3),
            foregroundColor: const Color(Config.text1),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          child: const Text('Skip →'),
        ),
      ]),
    );
  }

  Widget _photo(String? avatar, int trust, bool heroIsAi) {
    final hasPhoto = avatar != null && avatar.startsWith('http');
    return AspectRatio(
      aspectRatio: 4 / 5,
      child: Stack(fit: StackFit.expand, children: [
        if (hasPhoto)
          CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover,
              placeholder: (c, _) => const ColoredBox(color: Color(Config.bg3)),
              errorWidget: (c, _, _) => const _NoPhoto())
        else
          const _NoPhoto(),
        if (heroIsAi && hasPhoto)
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

  Widget _bestieTake() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0x0DFBBF24),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x33FBBF24)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Text('💬', style: TextStyle(fontSize: 22)),
          const SizedBox(width: 10),
          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text("BESTIE'S TAKE",
                style: TextStyle(color: Color(0xFFFBBF24), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.6)),
            Text('What to double-check before you match',
                style: TextStyle(color: Color(Config.text2), fontSize: 11)),
          ]),
        ]),
        const SizedBox(height: 12),
        if (_bestieFlagsLoading)
          Row(children: [
            const SizedBox(
              width: 13, height: 13,
              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFBBF24)),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 350),
                transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
                child: Text(
                  _bestieReviewSteps[_bestieReviewStep],
                  key: ValueKey(_bestieReviewStep),
                  style: const TextStyle(color: Color(Config.text2), fontSize: 12),
                ),
              ),
            ),
          ])
        else if (_bestieFlags.isEmpty)
          const Text(
            '✓ Nothing suspicious — profile claims look consistent with what was verified.',
            style: TextStyle(color: Color(Config.accent), fontSize: 13),
          )
        else
          for (final flag in _bestieFlags)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: flag.level == 'red' ? const Color(0x1AEF4444) : const Color(0x1AFB923C),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: flag.level == 'red' ? const Color(0x4DEF4444) : const Color(0x4DFB923C),
                ),
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(flag.level == 'red' ? '🚨' : '⚠️', style: const TextStyle(fontSize: 15)),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(flag.title,
                      style: const TextStyle(color: Color(Config.text1), fontSize: 13, fontWeight: FontWeight.w600, height: 1.3)),
                  const SizedBox(height: 3),
                  Text(flag.detail,
                      style: const TextStyle(color: Color(Config.text2), fontSize: 12, height: 1.5)),
                ])),
              ]),
            ),
      ]),
    );
  }

  Widget _actionBar(DiscoveryProfile cur) {
    final g = _viewerGender;
    final alreadySent = _sentAttentionIds.contains(cur.id);
    final alreadyTipped = _tippedIds.contains(cur.id);
    final alreadyMatched = _matchedUserIds.contains(cur.id);
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
        decoration: const BoxDecoration(
          color: Color(Config.bg1),
          border: Border(top: BorderSide(color: Color(0x141B1020))),
        ),
        child: Row(children: [
          if (!alreadyMatched) ...[
            Expanded(
              child: OutlinedButton.icon(
                onPressed: g == null || alreadyTipped ? null : () async {
                  AppLogger.instance.action('discover', 'like');
                  final sent = await showTipSheet(context, targetUserId: cur.id, viewerGender: g);
                  if (sent && mounted) setState(() => _tippedIds.add(cur.id));
                },
                icon: alreadyTipped
                    ? const Icon(Icons.check, size: 18)
                    : const Icon(Icons.chat_bubble_outline, size: 18),
                label: Text(alreadyTipped ? 'Tipped ✓' : 'Tip'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: alreadyTipped ? const Color(Config.text3) : const Color(Config.text1),
                  side: BorderSide(color: alreadyTipped ? const Color(0x221B1020) : const Color(0x331B1020)),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: g == null || alreadySent ? null : () async {
                  AppLogger.instance.action('discover', 'like');
                  final sent = await showAdmireSheet(context, recipientId: cur.id, viewerGender: g, name: cur.firstName);
                  if (sent && mounted) setState(() => _sentAttentionIds.add(cur.id));
                },
                icon: alreadySent
                    ? const Icon(Icons.check, size: 15)
                    : Text(g == 'woman' ? '🌹' : '👀', style: const TextStyle(fontSize: 15)),
                label: Text(alreadySent ? 'Sent ✓' : (g == 'woman' ? 'Admire' : 'Notice me')),
                style: OutlinedButton.styleFrom(
                  foregroundColor: alreadySent ? const Color(Config.text3) : const Color(0xFFEC4899),
                  side: BorderSide(color: alreadySent ? const Color(0x221B1020) : const Color(0x55EC4899)),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(width: 10),
          ] else ...[
            Expanded(
              child: OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.favorite, size: 16),
                label: const Text('Matched ✓'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(Config.text3),
                  side: const BorderSide(color: Color(0x221B1020)),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(width: 10),
          ],
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

  /// Reached the end of a non-empty feed: explicit prompt, then loop on tap.
  Widget _endOfFeed() {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('🎉', style: TextStyle(fontSize: 40)),
            const SizedBox(height: 12),
            const Text(
              "You've reached the end of the line.",
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(Config.text1), fontSize: 16, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            const Text(
              "You've seen everyone for now. Take another pass from the top, or refresh to check for new people.",
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _startOver,
                icon: const Icon(Icons.replay, size: 18),
                label: const Text('Start from the top', style: TextStyle(fontWeight: FontWeight.w700)),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(Config.accent),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh, size: 18, color: Color(Config.text2)),
              label: const Text('Refresh', style: TextStyle(color: Color(Config.text2))),
            ),
          ]),
        ),
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
