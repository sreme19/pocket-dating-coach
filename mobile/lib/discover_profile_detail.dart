import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'season.dart';
import 'profile_body.dart';
import 'engage_sheets.dart';

/// The full single-profile view (photo, rich body, Bestie's Take, Tip/Notice/
/// Next/Prev) — a self-contained copy of the detail rendering that used to be
/// the only way to browse Discover, now also reachable by tapping a card in
/// the iOS feed (see discover_screen.dart's `_iosFeedBody`). Owns its own
/// index into [feed] so it works standalone whether pushed as its own route
/// or (in principle) embedded inline.
class ProfileDetailView extends StatefulWidget {
  const ProfileDetailView({
    super.key,
    required this.feed,
    required this.initialIndex,
    required this.viewerGender,
    required this.sentAttentionIds,
    required this.tippedIds,
    required this.matchedUserIds,
  });

  final List<DiscoveryProfile> feed;
  final int initialIndex;
  final String? viewerGender;
  // Shared, mutable — same Set instances the feed screen reads, so ticks made
  // here (Tip sent, Admire sent) are already reflected if the user goes back.
  final Set<String> sentAttentionIds;
  final Set<String> tippedIds;
  final Set<String> matchedUserIds;

  @override
  State<ProfileDetailView> createState() => _ProfileDetailViewState();
}

class _ProfileDetailViewState extends State<ProfileDetailView> {
  late int _idx;
  final _scroll = ScrollController();
  Future<MatchDetail>? _detail;
  List<BestieFlag> _bestieFlags = [];
  bool _bestieFlagsLoading = false;
  Timer? _bestieReviewTimer;
  int _bestieReviewStep = 0;
  bool _autoSkipping = false;
  static const List<String> _bestieReviewSteps = [
    'Pulling up his verified proofs…',
    'Cross-checking his claims against what\'s verified…',
    'Flagging anything that doesn\'t add up…',
    'Putting your take together…',
  ];

  @override
  void initState() {
    super.initState();
    _idx = widget.initialIndex;
    _detail = _current!.id.startsWith('seed-') ? null : fetchMatchDetail(_current!.id);
    _maybeFetchBestie();
  }

  @override
  void dispose() {
    _bestieReviewTimer?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  DiscoveryProfile? get _current {
    if (_idx < 0 || _idx >= widget.feed.length) return null;
    return widget.feed[_idx];
  }

  void _maybeFetchBestie() {
    final cur = _current;
    if (widget.viewerGender != 'woman' || cur == null || cur.gender != 'man') return;
    setState(() { _bestieFlags = []; _bestieFlagsLoading = true; _bestieReviewStep = 0; });
    _startBestieReview();
    fetchBestieFlags(cur.id).then((flags) {
      if (mounted) setState(() { _bestieFlags = flags; _bestieFlagsLoading = false; });
      _stopBestieReview();
    });
  }

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
    if (_idx + 1 >= widget.feed.length) return;
    setState(() {
      _idx += 1;
      _detail = _current!.id.startsWith('seed-') ? null : fetchMatchDetail(_current!.id);
      _bestieFlags = [];
      _bestieFlagsLoading = false;
      _autoSkipping = false;
    });
    _maybeFetchBestie();
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  void _prev() {
    AppLogger.instance.action('discover', 'previous');
    if (_idx <= 0) return;
    setState(() {
      _idx -= 1;
      _detail = _current!.id.startsWith('seed-') ? null : fetchMatchDetail(_current!.id);
      _bestieFlags = [];
      _bestieFlagsLoading = false;
      _autoSkipping = false;
    });
    _maybeFetchBestie();
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    final cur = _current;
    if (cur == null) return const SizedBox.shrink();
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
              padding: EdgeInsets.zero,
              children: [
                _photo(cur, avatar, trust, d?.heroIsAi ?? false),
                if (loading)
                  const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))
                else if (d == null && snap.hasError) ...[
                  _profileError(snap.error),
                ]
                else ...[
                  if (d != null)
                    ...richProfileBody(context, d,
                        subjectUserId: !cur.id.startsWith('seed-') ? cur.id : null,
                        surface: 'discover'),
                  if (widget.viewerGender == 'woman' && cur.gender == 'man')
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

  Widget _photo(DiscoveryProfile cur, String? avatar, int trust, bool heroIsAi) {
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
        if (cur.isNetworking)
          Positioned(
            right: 16, top: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFF0E9AAE),
                borderRadius: BorderRadius.circular(999),
              ),
              child: const Text('🌱 Networking',
                  style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
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
                border: Border.all(color: Brand.accent, width: 2),
              ),
              child: Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('$trust%', style: TextStyle(color: Brand.accent, fontSize: 17, fontWeight: FontWeight.w800, height: 1)),
                  Text(trustLabel(trust).replaceAll(' Trust', '').replaceAll('Fully Verified', 'Verified'),
                      style: TextStyle(color: Brand.accent, fontSize: 8)),
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
          Text(
            '✓ Nothing suspicious — profile claims look consistent with what was verified.',
            style: TextStyle(color: Brand.accent, fontSize: 13),
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
    final g = widget.viewerGender;
    final networking = SeasonState.isNetworking;
    final alreadySent = widget.sentAttentionIds.contains(cur.id);
    final alreadyTipped = widget.tippedIds.contains(cur.id);
    final alreadyMatched = widget.matchedUserIds.contains(cur.id);
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
        decoration: const BoxDecoration(
          color: Color(Config.bg1),
          border: Border(top: BorderSide(color: Color(0x141B1020))),
        ),
        child: Row(children: [
          if (_idx > 0) ...[
            SizedBox(
              width: 44,
              height: 44,
              child: OutlinedButton(
                onPressed: _prev,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(Config.text2),
                  side: const BorderSide(color: Color(0x331B1020)),
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Icon(Icons.arrow_back_ios_new_rounded, size: 16),
              ),
            ),
            const SizedBox(width: 8),
          ],
          if (!alreadyMatched) ...[
            Expanded(
              child: OutlinedButton.icon(
                onPressed: g == null || alreadyTipped ? null : () async {
                  AppLogger.instance.action('discover', 'like');
                  final sent = await showTipSheet(context, targetUserId: cur.id, viewerGender: g);
                  if (sent && mounted) setState(() => widget.tippedIds.add(cur.id));
                },
                icon: alreadyTipped
                    ? const Icon(Icons.check, size: 16)
                    : const Icon(Icons.chat_bubble_outline, size: 16),
                label: Text(alreadyTipped ? 'Tipped ✓' : 'Tip'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: alreadyTipped ? const Color(Config.text3) : const Color(Config.text1),
                  side: BorderSide(color: alreadyTipped ? const Color(0x221B1020) : const Color(0x331B1020)),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: g == null || alreadySent ? null : () async {
                  AppLogger.instance.action('discover', 'like');
                  final sent = await showAdmireSheet(context, recipientId: cur.id, viewerGender: g, name: cur.firstName);
                  if (sent && mounted) setState(() => widget.sentAttentionIds.add(cur.id));
                },
                icon: alreadySent
                    ? const Icon(Icons.check, size: 15)
                    : Text(networking ? '🤝' : (g == 'woman' ? '🌹' : '👀'), style: const TextStyle(fontSize: 14)),
                label: Text(alreadySent
                    ? 'Sent ✓'
                    : (networking ? 'Connect' : (g == 'woman' ? 'Admire' : 'Notice'))),
                style: OutlinedButton.styleFrom(
                  foregroundColor: alreadySent
                      ? const Color(Config.text3)
                      : (networking ? Brand.accent : Brand.accentAlpha(0xFF)),
                  side: BorderSide(color: alreadySent
                      ? const Color(0x221B1020)
                      : (networking ? const Color(0x550E9AAE) : Brand.accentAlpha(0x55))),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ] else
            Expanded(
              child: OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.favorite, size: 15),
                label: const Text('Matched ✓'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(Config.text3),
                  side: const BorderSide(color: Color(0x221B1020)),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          const SizedBox(width: 8),
          SizedBox(
            width: 90,
            child: FilledButton(
              onPressed: _idx + 1 < widget.feed.length ? _next : null,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.bg3),
                foregroundColor: const Color(Config.text1),
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Next →', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
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
