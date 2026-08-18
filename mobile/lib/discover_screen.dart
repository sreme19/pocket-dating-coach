import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'error_text.dart';
import 'season.dart';
import 'profile_body.dart';
import 'engage_sheets.dart';
import 'verification_screen.dart';
import 'discover_profile_detail.dart';

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

  // ── Missing-selfie notice ───────────────────────────────────────────────────
  // The discovery gate and the matchmaker pool both require liveness + photos, so
  // a user who never took the selfie browses a normal-looking feed while being
  // invisible in everyone else's. Nothing used to say so. Null = not yet known.
  bool? _missingSelfie;
  Set<int> _selfieSkipSteps = const {};

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('discover');
    _load();
    _checkSelfie();
  }

  /// Look for a completed liveness row. Also records which of the other steps are
  /// already done, so the CTA drops the user on the selfie and nothing else.
  Future<void> _checkSelfie() async {
    try {
      final uid = Supabase.instance.client.auth.currentUser?.id;
      if (uid == null) return;
      final rows = await Supabase.instance.client
          .from('verified_vibe_verification')
          .select('step, status')
          .eq('user_id', uid);
      final done = <String>{
        for (final r in (rows as List).cast<Map>())
          if (r['status'] == 'completed') r['step'].toString(),
      };
      if (!mounted) return;
      setState(() {
        _missingSelfie = !done.contains('liveness');
        // The banner promises a selfie and about a minute, so always skip the
        // two optional Q&A steps — dropping someone into a questionnaire they
        // did not agree to is how the selfie got skipped in the first place.
        // Photos are only skipped when already done: a user missing BOTH still
        // needs them, and step 3 is mandatory anyway.
        _selfieSkipSteps = {1, 2, if (done.contains('photos')) 3};
      });
    } catch (_) {
      // Best-effort: a failed check just means no banner, never a broken feed.
    }
  }

  Widget _selfieNotice() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Brand.accentBright.withValues(alpha: 0.45)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Text('👋', style: TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'No one can see you yet',
              style: TextStyle(
                fontSize: 14, fontWeight: FontWeight.w700, color: Brand.accentBright),
            ),
          ),
        ]),
        const SizedBox(height: 6),
        const Text(
          "You can browse, but your profile stays hidden from everyone else until "
          "you finish your selfie check. It takes about a minute.",
          style: TextStyle(fontSize: 13, height: 1.45, color: Color(Config.text2)),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {
              AppLogger.instance.action('discover', 'start_missing_selfie');
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => VerificationScreen(
                  initialStep: 0,
                  skipSteps: _selfieSkipSteps,
                  onDone: () {
                    Navigator.of(context).pop();
                    _checkSelfie();
                  },
                ),
              ));
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Brand.accentBright,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Take my selfie',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          ),
        ),
      ]),
    );
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
      final friendly = isAuthError(msg)
          ? 'Session expired — please restart the app.'
          : isServerError(msg)
              ? "Something went wrong on our end. It's not you — pull down to retry."
              : (isNetworkError(msg) || msg.contains('network'))
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

  /// Step back to a profile already passed this session. Pure client-side —
  /// re-walks the loaded feed, no refetch. Mirror of [_next].
  void _prev() {
    AppLogger.instance.action('discover', 'previous');
    final feed = _feed;
    if (feed == null || _idx <= 0) return;
    setState(() {
      _idx -= 1;
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
    return ValueListenableBuilder<bool>(
      valueListenable: SeasonState.networking,
      builder: (context, networking, __) {
        return Scaffold(
          appBar: AppBar(
            backgroundColor: const Color(Config.bg1),
            elevation: 0,
            titleSpacing: 20,
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Discover', style: TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
                Text(networking ? 'Find your people' : 'Find your match',
                    style: const TextStyle(fontSize: 12, color: Color(Config.text2), fontWeight: FontWeight.w400)),
              ],
            ),
            centerTitle: false,
            // Networking Season is women-only for now — it was getting overused
            // by men in a way that confused the women on the other end of chat.
            actions: [
              if (_viewerGender == 'woman') _seasonToggle(networking),
              const SizedBox(width: 12),
            ],
          ),
          // The notice sits above every feed state — loading, empty and card —
          // because being invisible is true in all of them.
          body: Column(children: [
            if (_missingSelfie == true) _selfieNotice(),
            Expanded(child: _body()),
          ]),
        );
      },
    );
  }

  /// The Date ⇄ Networking flip. Writes the season globally (reskins the whole
  /// app) and persists it to the backend.
  Widget _seasonToggle(bool networking) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x221B1020)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        _seasonSeg(label: 'Date', emoji: '🌹', on: !networking, onTap: () => _setSeason(false)),
        _seasonSeg(label: 'Network', emoji: '💬', on: networking, onTap: () => _setSeason(true)),
      ]),
    );
  }

  Widget _seasonSeg({
    required String label,
    required String emoji,
    required bool on,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: on ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: on ? Brand.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(emoji, style: const TextStyle(fontSize: 11)),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            color: on ? Colors.white : const Color(Config.text3),
          )),
        ]),
      ),
    );
  }

  Future<void> _setSeason(bool networking) async {
    AppLogger.instance.action('discover', 'set_season', meta: {'networking': networking});
    final res = await SeasonState.set(networking);
    // Return-to-Date consent (Phase 4): if she just left a networking season and
    // has contacts to tell, ASK before letting them know she's dating again.
    if (!networking && res['returnedFromNetworking'] == true && mounted) {
      final count = res['activeContacts'] is num ? (res['activeContacts'] as num).toInt() : 0;
      if (count <= 0) return;
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Open to dating again?'),
          content: Text(
            "Want your AI Bestie to let your $count networking "
            "${count == 1 ? 'contact' : 'contacts'} know you're open to dating again? "
            "They'll get a warm heads-up — no one else is told.",
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Not now')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes, let them know')),
          ],
        ),
      );
      if (ok == true) {
        int notified = 0;
        try { notified = await notifyNetworkingReturn(); } catch (_) {}
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Let ${notified > 0 ? notified : count} '
                '${(notified > 0 ? notified : count) == 1 ? 'contact' : 'contacts'} know 🌹')),
          );
        }
      }
    }
  }

  Widget _body() {
    if (_error != null) {
      // _error is ALREADY the classified, user-facing message from _load. This
      // used to rebuild its own here and threw that away, so every failure but a
      // 401 read "Check your connection" — including a 500, which no amount of
      // connection-checking fixes.
      final isNetwork = _error!.contains('No internet');
      return _centered(
        isNetwork ? Icons.cloud_off : Icons.error_outline_rounded,
        _error!,
        'Retry',
        _load,
      );
    }
    if (_feed == null) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        CircularProgressIndicator(color: Brand.accent),
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

    // iOS-only: a scrollable feed of compact preview cards instead of one full
    // profile at a time. Same feed data, same Tip/Notice/Next actions — tapping
    // a card pushes the exact unchanged full-profile view (ProfileDetailView).
    // Android is untouched below.
    if (Platform.isIOS) {
      return _iosFeedBody();
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
                  Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator(color: Brand.accent)))
                else if (d == null && snap.hasError) ...[
                  _profileError(snap.error),
                ]
                else ...[
                  // _current carries the id; MatchDetail does not. Seed profiles
                  // have synthetic ids and no real owner, so they get no footer.
                  if (d != null)
                    ...richProfileBody(context, d,
                        subjectUserId: (_current != null && !_current!.id.startsWith('seed-'))
                            ? _current!.id
                            : null,
                        surface: 'discover'),
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

  // ── iOS feed (App Store 4.3b differentiation pass) ────────────────────────
  // Compact cards over the same _feed list already loaded for the Android
  // path. No new network calls, no new actions — heart reuses the existing
  // Notice/Admire flow, tapping the card opens the unchanged full profile.

  void _openProfileDetail(int index) {
    AppLogger.instance.action('discover', 'open_card', meta: {'index': index});
    Navigator.of(context).push(MaterialPageRoute(builder: (_) {
      return Scaffold(
        backgroundColor: const Color(Config.bg1),
        appBar: AppBar(
          backgroundColor: const Color(Config.bg1),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close, color: Color(Config.text1)),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: ProfileDetailView(
          feed: _feed!,
          initialIndex: index,
          viewerGender: _viewerGender,
          sentAttentionIds: _sentAttentionIds,
          tippedIds: _tippedIds,
          matchedUserIds: _matchedUserIds,
        ),
      );
    })).then((_) {
      // Sets are mutated by reference inside ProfileDetailView — refresh so
      // the feed's own heart-state chips reflect anything sent while there.
      if (mounted) setState(() {});
    });
  }

  Widget _iosFeedBody() {
    final feed = _feed!;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        itemCount: feed.length,
        itemBuilder: (context, i) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: _iosFeedCard(feed[i], i, feed.length),
        ),
      ),
    );
  }

  Widget _iosFeedCard(DiscoveryProfile p, int i, int total) {
    final g = _viewerGender;
    final alreadySent = _sentAttentionIds.contains(p.id);
    final alreadyMatched = _matchedUserIds.contains(p.id);
    final hasPhoto = p.avatar != null && p.avatar!.startsWith('http');
    final verified = p.verifiedCount > 0;
    final trust = p.trustScore;
    return GestureDetector(
      onTap: () => _openProfileDetail(i),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x1A1B1020)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Stack(clipBehavior: Clip.none, children: [
              ClipOval(
                child: hasPhoto
                    ? CachedNetworkImage(
                        imageUrl: p.avatar!, width: 48, height: 48, fit: BoxFit.cover,
                        placeholder: (c, _) => const ColoredBox(color: Color(Config.bg3), child: SizedBox(width: 48, height: 48)),
                        errorWidget: (c, _, _) => const _NoPhoto())
                    : const SizedBox(
                        width: 48, height: 48,
                        child: ColoredBox(color: Color(Config.bg3), child: Icon(Icons.person, color: Color(Config.text3))),
                      ),
              ),
              if (verified)
                Positioned(
                  right: -2, bottom: -2,
                  child: Container(
                    width: 17, height: 17,
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F6E56), shape: BoxShape.circle,
                      border: Border.all(color: const Color(Config.bg2), width: 2),
                    ),
                    child: const Icon(Icons.verified, size: 10, color: Colors.white),
                  ),
                ),
            ]),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  p.age != null ? '${p.firstName}, ${p.age}' : p.firstName,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: Color(Config.text1)),
                ),
                if (p.city != null || p.distance != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Text(
                      [p.city, p.distance].where((s) => s != null && s.isNotEmpty).join(' · '),
                      style: const TextStyle(fontSize: 11, color: Color(Config.text2)),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.only(top: 5),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Brand.accentAlpha(0x22),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(p.archetypeLabel,
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Brand.accentBright)),
                  ),
                ),
              ]),
            ),
            const SizedBox(width: 8),
            Stack(clipBehavior: Clip.none, children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: hasPhoto
                    ? CachedNetworkImage(
                        imageUrl: p.avatar!, width: 58, height: 58, fit: BoxFit.cover,
                        placeholder: (c, _) => const ColoredBox(color: Color(Config.bg3), child: SizedBox(width: 58, height: 58)),
                        errorWidget: (c, _, _) => const _NoPhoto())
                    : const SizedBox(
                        width: 58, height: 58,
                        child: ColoredBox(color: Color(Config.bg3), child: Icon(Icons.image_not_supported_outlined, color: Color(Config.text3))),
                      ),
              ),
              if (trust > 0)
                Positioned(
                  right: -8, bottom: -8,
                  child: Container(
                    width: 30, height: 30,
                    decoration: BoxDecoration(
                      color: const Color(Config.bg2), shape: BoxShape.circle,
                      border: Border.all(color: Brand.accent, width: 1.5),
                    ),
                    child: Center(
                      child: Text('$trust%',
                          style: TextStyle(color: Brand.accent, fontSize: 8.5, fontWeight: FontWeight.w800)),
                    ),
                  ),
                ),
            ]),
          ]),
          if (p.intent != null && p.intent!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(p.intent!,
                  style: const TextStyle(fontSize: 12, color: Color(Config.text2), height: 1.35),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
            ),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(Config.bg3),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('Curated by your AI Bestie · ${i + 1} of $total',
                    style: const TextStyle(fontSize: 10.5, color: Color(Config.text2), fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(width: 8),
            if (alreadyMatched)
              const Icon(Icons.favorite, size: 22, color: Color(Config.text3))
            else
              GestureDetector(
                onTap: g == null || alreadySent ? null : () async {
                  AppLogger.instance.action('discover', 'like');
                  final sent = await showAdmireSheet(context, recipientId: p.id, viewerGender: g, name: p.firstName);
                  if (sent && mounted) setState(() => _sentAttentionIds.add(p.id));
                },
                child: Container(
                  width: 34, height: 34,
                  decoration: BoxDecoration(
                    color: alreadySent ? const Color(Config.bg3) : Brand.accent,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(alreadySent ? Icons.check : Icons.favorite,
                      size: 16, color: alreadySent ? const Color(Config.text3) : Colors.white),
                ),
              ),
          ]),
        ]),
      ),
    );
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
        // Networking Season badge — always teal so it reads as "networking intent"
        // even to a date-mode viewer (opposite-gender networkers still appear).
        if (_current?.isNetworking == true)
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
    final g = _viewerGender;
    final networking = SeasonState.isNetworking;
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
                  if (sent && mounted) setState(() => _tippedIds.add(cur.id));
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
                  if (sent && mounted) setState(() => _sentAttentionIds.add(cur.id));
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
              onPressed: _next,
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
                  backgroundColor: Brand.accent,
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
