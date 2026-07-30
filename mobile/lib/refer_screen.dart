import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'season.dart';

/// Invite — one entry, three flows (toggle). Kept in step with the web screen
/// src/routes/verified-vibe/refer/+page.svelte for flows and tone, with TWO
/// deliberate divergences: the share row (the DM-first channel block below has not
/// been ported to web, which still has the WhatsApp-primary row), and cash (see
/// below).
///
///  - Invite women (Flow 2, Model B): ambassador referral. A "mood" (networking /
///    casual / serious) sets the share message + the landing the invitee sees
///    (via ?m=).
///  - Invite men (Flow 1, Model A): her AI Bestie screens the men in her DMs and
///    hands her the gems.
///  - Privately (Flow 3): a SECOND token whose /beta landing carries nothing
///    about the sender and which never forms a match, in either direction. It can
///    go to anyone, men or women, which is why it is the one extra tab men see too.
///
/// Data comes from GET /api/verified-vibe/referral-link (see api.dart). The
/// private link comes back null until migration 20260726170526 has been run, and
/// the tab is then hidden rather than promising privacy the backend can't keep.
///
/// SHARE ROW — DM-first ordering. Instagram and Snapchat lead, WhatsApp and the
/// OS share sheet sit in a minor row beneath them. Neither Instagram nor
/// Snapchat can be handed a pre-filled message from outside their app (no public
/// URL scheme or API does it), so those two buttons copy the message and then
/// deep-link in, and she pastes. That is not a degraded path here: she is
/// pasting the same message into twenty DMs in a row, so one copy serves the
/// whole blast and she never has to come back between DMs. Hence [_copiedFor]
/// is a PERSISTENT state chip, not the 1.6s "Copied ✓" flash used for the link.
/// WhatsApp keeps its `wa.me?text=` pre-fill — strictly better, and it sits in
/// the minor row so the two behaviours never read as siblings.
///
/// SKINS — the whole screen repaints per flow (see [_Skin]): Invite women takes
/// the mood she picked (teal Networking / warm-black Casual / dusty-rose Serious),
/// Invite men gets its own violet and Privately its own graphite, since neither
/// has a mood. Purely cosmetic — it
/// does not touch matching, and it is NOT the Networking Season flag even though
/// Networking borrows the same teal so that teal keeps meaning one thing to a
/// user. The channel buttons are the one thing a skin never touches: their
/// colours are promises about where the tap lands.
///
/// CASH — NOT SHOWN HERE, on either platform, and this is deliberate. The server
/// ledger (see beta-invite.ts) still accrues for every verified signup, including
/// ones that originate in the app, so nobody loses what they have earned, and the
/// web screen still displays balances and rates. But no rupee amount, rate, cap,
/// earnings total or UPI reference may appear in this file: App Review rejected the
/// app under Guideline 1.1.4 (compensated dating), and per-signup cash rewards for
/// recruiting women is the hardest thing to defend in that context. There is no
/// platform gate — one code path, both platforms, nothing to regress.
/// [ReferralLink.cash] and [ReferralLink.menCash] are intentionally left unread.
/// See docs/requirements/AppStore_Rejection_Remediation.md §3.
///
/// House style: display strings use DOUBLE quotes so straight apostrophes
/// ("I've", "don't", "you're", "she'll") are safe without escaping. No curly quotes.
class ReferScreen extends StatefulWidget {
  const ReferScreen({super.key});

  @override
  State<ReferScreen> createState() => _ReferScreenState();
}

enum _View { loading, ready, denied, error }

enum _Tab { women, men, private }

enum _Mood { networking, casual, serious }

/// Where she is sending it. Order here is the order on screen.
enum _Channel { instagram, snapchat, whatsapp, more }

/// Background line art drawn behind a skin's content.
enum _Motif { none, mesh, ribbons, rings, facets, veil }

/// The full token set for one skin.
///
/// A mood skin is deliberately NOT a single accent swap: on the Casual black
/// ground the surface and text ramps invert, and [accentText] has to be LIGHTER
/// than [accent] (the opposite of both light skins) or the sublines and
/// "Copy message" fall below contrast.
class _Skin {
  const _Skin({
    required this.page,
    required this.card,
    required this.fill,
    required this.accent,
    required this.accentText,
    required this.tint,
    required this.border1,
    required this.border2,
    required this.text1,
    required this.text2,
    required this.text3,
    required this.earnFrom,
    required this.earnTo,
    required this.ctaText,
    required this.motif,
    required this.artOpacity,
    required this.dark,
  });

  final Color page; // page background (bg1)
  final Color card; // card / surface (bg2)
  final Color fill; // subtle fill (bg3) — progress track, hint chip
  final Color accent; // CTA fill, chip border, progress fill
  final Color accentText; // the accent used AS TEXT on the page ground
  final Color tint; // pale accent fill — selected chip, link strip
  final Color border1;
  final Color border2;
  final Color text1;
  final Color text2;
  final Color text3;
  final Color earnFrom; // earn-card gradient start
  final Color earnTo; // earn-card gradient end
  final Color ctaText; // label on top of [accent]
  final _Motif motif;
  final double artOpacity;
  final bool dark; // drives the status-bar icon brightness

  /// The app's own accent — season aware, so the Invite men flow still turns
  /// teal during Networking Season. Non-const: [Brand] is resolved at build.
  static _Skin appDefault() => _Skin(
        page: const Color(Config.bg1),
        card: const Color(Config.bg2),
        fill: const Color(Config.bg3),
        accent: Brand.accent,
        accentText: Brand.accentBright,
        tint: Brand.accentTint,
        border1: const Color(0xFFF1E0E3),
        border2: const Color(0xFFE7D2D7),
        text1: const Color(Config.text1),
        text2: const Color(Config.text2),
        text3: const Color(Config.text3),
        earnFrom: const Color(0xFFFFF6E8),
        earnTo: Brand.accentTint,
        ctaText: Colors.white,
        motif: _Motif.none,
        artOpacity: 0,
        dark: false,
      );

  /// Networking — the shipped Networking Season teal, reused so that teal always
  /// means the same thing to a user.
  static const networking = _Skin(
    page: Color(0xFFEDF6F7),
    card: Color(0xFFFFFFFF),
    fill: Color(0xFFDDEEF0),
    accent: Color(0xFF0E9AAE),
    accentText: Color(0xFF0A7C8C),
    tint: Color(0xFFE1F4F6),
    border1: Color(0xFFD7E9EB),
    border2: Color(0xFFC3DDE1),
    text1: Color(0xFF0C1F23),
    text2: Color(0xFF5A7075),
    text3: Color(0xFF8CA5A9),
    earnFrom: Color(0xFFF4FBFC),
    earnTo: Color(0xFFE1F4F6),
    ctaText: Colors.white,
    motif: _Motif.mesh,
    artOpacity: 0.085,
    dark: false,
  );

  /// Casual — warm black with rose gold. Not pure black, and not a neon accent:
  /// on black, saturated pink reads nightclub while gold reads low light.
  static const casual = _Skin(
    page: Color(0xFF0D0A0C),
    card: Color(0xFF171013),
    fill: Color(0xFF211619),
    accent: Color(0xFFE3A07A),
    accentText: Color(0xFFF0BC98), // LIGHTER than accent — see class doc
    tint: Color(0xFF241619),
    border1: Color(0xFF291D21),
    border2: Color(0xFF3B292F),
    text1: Color(0xFFF7EEEB),
    text2: Color(0xFFB8A3A5),
    text3: Color(0xFF8B7478),
    earnFrom: Color(0xFF2A151E),
    earnTo: Color(0xFF170F12),
    ctaText: Color(0xFF140D10),
    motif: _Motif.ribbons,
    artOpacity: 0.16,
    dark: true,
  );

  /// Serious — dusty rose quartz, pulled well off the riteangle hot pink so it
  /// reads as its own mood rather than as the app's default.
  static const serious = _Skin(
    page: Color(0xFFF7E8EC),
    card: Color(0xFFFFFDFD),
    fill: Color(0xFFF0DBE1),
    accent: Color(0xFFB03B5E),
    accentText: Color(0xFF8E2B49),
    tint: Color(0xFFF2D9E1),
    border1: Color(0xFFEBD3DA),
    border2: Color(0xFFDFC0C9),
    text1: Color(0xFF22131A),
    text2: Color(0xFF6B535B),
    text3: Color(0xFFA38C93),
    earnFrom: Color(0xFFFDF4F1),
    earnTo: Color(0xFFF2D9E1),
    ctaText: Colors.white,
    motif: _Motif.rings,
    artOpacity: 0.09,
    dark: false,
  );

  /// Invite men — violet. Not one of the three moods: this flow is her own DMs
  /// being screened, so it gets its own colour, distinct from all of them and
  /// still inside the brand family (violet is pink's neighbour).
  static const suitors = _Skin(
    page: Color(0xFFF3F0FB),
    card: Color(0xFFFFFFFF),
    fill: Color(0xFFE7E1F8),
    accent: Color(0xFF6C4BC7),
    accentText: Color(0xFF56349F),
    tint: Color(0xFFE9E2FB),
    border1: Color(0xFFE4DDF4),
    border2: Color(0xFFD5CAEC),
    text1: Color(0xFF17102A),
    text2: Color(0xFF605771),
    text3: Color(0xFF978DA9),
    earnFrom: Color(0xFFFBF8FF),
    earnTo: Color(0xFFE9E2FB),
    ctaText: Colors.white,
    motif: _Motif.facets,
    artOpacity: 0.075,
    dark: false,
  );

  /// Privately — graphite. Deliberately the least romantic skin in the set: this
  /// is the tab you open to keep your dating life out of a group chat, and a cool
  /// neutral says discretion where any of the moods would say the opposite. Reads
  /// as clearly distinct from [suitors] violet at a glance.
  static const private = _Skin(
    page: Color(0xFFEEF1F5),
    card: Color(0xFFFFFFFF),
    fill: Color(0xFFE2E7EE),
    accent: Color(0xFF3F5872),
    accentText: Color(0xFF2B3F56),
    tint: Color(0xFFE3E9F1),
    border1: Color(0xFFDFE5EC),
    border2: Color(0xFFCBD4DE),
    text1: Color(0xFF0F1720),
    text2: Color(0xFF56606D),
    text3: Color(0xFF8B95A3),
    earnFrom: Color(0xFFF7F9FC),
    earnTo: Color(0xFFE3E9F1),
    ctaText: Colors.white,
    motif: _Motif.veil,
    artOpacity: 0.075,
    dark: false,
  );

  static _Skin forMood(_Mood m) {
    switch (m) {
      case _Mood.networking:
        return networking;
      case _Mood.casual:
        return casual;
      case _Mood.serious:
        return serious;
    }
  }
}

class _ReferScreenState extends State<ReferScreen> {
  /// Ink for text sitting ON a bright channel colour (Snapchat yellow). Fixed,
  /// not skinned: on the Casual skin `text1` is near-white and would vanish.
  static const _onBright = Color(0xFF1B1020);

  // Channel brand colours — the one place in the app that isn't riteangle pink,
  // because these buttons are promises about where the tap lands. A mood skin
  // never touches them.
  static const _snapYellow = Color(0xFFFFFC00);
  static const _waGreen = Color(0xFF25D366);
  static const _igGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFEDA75), Color(0xFFFA7E1E), Color(0xFFD62976), Color(0xFF962FBF), Color(0xFF4F5BD5)],
    stops: [0.0, 0.24, 0.58, 0.82, 1.0],
  );

  _View _view = _View.loading;
  _Tab _tab = _Tab.women;
  _Mood _mood = _Mood.networking;
  ReferralLink? _link;
  // NOTE: the referral cash ledger (ReferralCash) is deliberately NOT read or
  // rendered in the app on either platform. The server keeps accruing it and the web
  // surface still shows it; showing per-signup cash rewards inside a dating app that
  // App Review flagged under Guideline 1.1.4 is the risk we removed.
  // See docs/requirements/AppStore_Rejection_Remediation.md §3.
  String? _gender;
  int _invited = 0;
  int _signedUp = 0;
  bool _copiedLink = false;
  bool _copiedMsg = false;

  /// The channel she last copied for, or null if she hasn't tapped one yet.
  /// Deliberately never auto-cleared — it has to survive her leaving for
  /// Instagram and coming back mid-blast.
  _Channel? _copiedFor;

  /// Set when the deep link wouldn't open, so the chip can say why instead of
  /// leaving her staring at a screen that did nothing visible.
  bool _appMissing = false;
  final _msg = TextEditingController(); // Invite men
  final _womenMsg = TextEditingController(); // Invite women
  final _privateMsg = TextEditingController(); // Privately

  /// The active skin, resolved once per build and read by every widget below.
  _Skin _s = _Skin.networking;

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('refer');
    _load();
  }

  @override
  void dispose() {
    _msg.dispose();
    _womenMsg.dispose();
    _privateMsg.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _view = _View.loading);
    try {
      final link = await fetchReferralLink();
      if (!mounted) return;
      setState(() {
        _link = link;
        _gender = link.gender;
        _invited = link.invited;
        _signedUp = link.signedUp;
        _msg.text = _messageFor(link.shareUrl);
        _womenMsg.text = _inviteMessageFor("${link.shareUrl}?m=${_moodStr(_mood)}", _mood);
        final priv = link.private;
        if (priv != null) _privateMsg.text = _privateMessageFor(priv.shareUrl);
        _view = _View.ready;
      });
    } on ReferralLinkDenied {
      if (mounted) setState(() => _view = _View.denied);
    } catch (_) {
      if (mounted) setState(() => _view = _View.error);
    }
  }

  bool get _showMen => _gender == 'woman' && _tab == _Tab.men;

  ReferralPrivateLink? get _private => _link?.private;

  /// The Privately tab is only reachable once the server actually issues a
  /// private token — see [ReferralLink.private].
  bool get _showPrivate => _private != null && _tab == _Tab.private;

  /// Men see one flow (invite women); Privately makes two.
  bool get _showToggle => _gender == 'woman' || _private != null;

  /// Invite men gets the violet [_Skin.suitors], Privately the graphite
  /// [_Skin.private]; Invite women gets her mood. The loading / denied / error
  /// states keep the app accent, so the screen never flashes a skin before we
  /// know which flow she is even on.
  _Skin get _activeSkin {
    if (_view != _View.ready) return _Skin.appDefault();
    if (_showPrivate) return _Skin.private;
    return _showMen ? _Skin.suitors : _Skin.forMood(_mood);
  }

  // ── Invite men copy ──────────────────────────────────────────────────────
  String _messageFor(String url) =>
      "hey! sorry, I've got hundreds of messages here and don't have time to reply to them all. "
      "but I'd genuinely love to talk if you're my type. I'm moving my convos over to the Riteangle app, "
      "so if you actually wanna get to know me, start here 👉 $url";

  // ── Invite women copy ────────────────────────────────────────────────────
  String _moodStr(_Mood m) =>
      m == _Mood.networking ? 'networking' : (m == _Mood.casual ? 'casual' : 'serious');

  String _womenLink(_Mood m) => "${_link?.shareUrl ?? ''}?m=${_moodStr(m)}";

  String _womenMessageFor(String url, _Mood m) {
    switch (m) {
      case _Mood.networking:
        return "hey! got an invite to this, it's an invite-only network of properly high-functioning "
            "people (tech, finance, founders, creatives, sport). the circle is genuinely impressive and "
            "it's first come first serve. (some people use it to meet someone too, no pressure) 👉 $url";
      case _Mood.casual:
        return "ok this one's actually not like the other dating apps, everyone's identity-verified, "
            "and an AI weeds out the creeps before they reach you. "
            "come make trouble with me 👉 $url";
      case _Mood.serious:
        return "found a dating app that's actually for people who want something real, verified, serious, "
            "a lot of tech/finance types. thought of you, here's an invite 👉 $url";
    }
  }

  // A man inviting women speaks in his own voice (and never mentions the
  // auto-match — that's his private upside, not surfaced to her).
  String _menMessageFor(String url, _Mood m) {
    switch (m) {
      case _Mood.networking:
        return "hey! got an invite to this, it's an invite-only network of high-functioning people "
            "(tech, finance, founders, creatives, sport). genuinely impressive crowd and it's first "
            "come first serve. thought you'd fit right in 👉 $url";
      case _Mood.casual:
        return "found this app, everyone's identity-verified and the crowd is way better than the "
            "usual ones. you should check it out 👉 $url";
      case _Mood.serious:
        return "found a dating app that's actually for people who want something real, everyone "
            "verified, no time-wasters. thought of you, here's an invite 👉 $url";
    }
  }

  String _inviteMessageFor(String url, _Mood m) =>
      _gender == 'man' ? _menMessageFor(url, m) : _womenMessageFor(url, m);

  // ── Privately copy ───────────────────────────────────────────────────────
  // Same voice for men and women, and no mood: this one goes into group chats and
  // to people who don't know the sender is dating, so it stays about the app.
  String _privateMessageFor(String url) =>
      "hey! I've got an invite to riteangle — it's invite-only and everyone's identity-verified "
      "(dating if you want that, just good people if you don't). thought you'd like it in there. "
      "here you go 👉 $url";

  void _selectMood(_Mood m) {
    setState(() {
      _mood = m;
      _womenMsg.text = _inviteMessageFor(_womenLink(m), m);
    });
  }

  // ── Sharing ──────────────────────────────────────────────────────────────
  static const _channelEvent = {
    _Channel.instagram: 'share_instagram',
    _Channel.snapchat: 'share_snapchat',
    _Channel.whatsapp: 'share_whatsapp',
    _Channel.more: 'share_more',
  };

  /// Deep links for the copy-and-paste channels. Both are undocumented:
  /// `instagram://direct-inbox` lands on her DM list, `snapchat://` only gets as
  /// far as the camera (Snapchat exposes no chat deep link). Verify both on real
  /// handsets — neither is a contract.
  static const _channelScheme = {
    _Channel.instagram: 'instagram://direct-inbox',
    _Channel.snapchat: 'snapchat://',
  };

  Future<void> _shareVia(_Channel c, String text) async {
    AppLogger.instance.action('refer', _channelEvent[c]!);

    if (c == _Channel.whatsapp) {
      final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}');
      await _open(uri);
      return;
    }

    if (c == _Channel.more) {
      await SharePlus.instance.share(ShareParams(text: text));
      return;
    }

    // Instagram / Snapchat: the message can only travel on the clipboard.
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    setState(() {
      _copiedFor = c;
      _appMissing = false;
    });
    final opened = await _open(Uri.parse(_channelScheme[c]!));
    if (!opened && mounted) setState(() => _appMissing = true);
  }

  /// launchUrl throws rather than returning false when nothing can handle the
  /// scheme, so both outcomes have to collapse to one bool.
  Future<bool> _open(Uri uri) async {
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }

  void _copy(String text, {required bool isLink}) {
    Clipboard.setData(ClipboardData(text: text));
    AppLogger.instance.action('refer', isLink ? 'copy_link' : 'copy_message');
    setState(() {
      if (isLink) {
        _copiedLink = true;
      } else {
        _copiedMsg = true;
      }
    });
    Future.delayed(const Duration(milliseconds: 1600), () {
      if (!mounted) return;
      setState(() {
        if (isLink) {
          _copiedLink = false;
        } else {
          _copiedMsg = false;
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    _s = _activeSkin;

    // Casual is a dark ground, so the OS status-bar icons have to flip to light.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: _s.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 260),
        color: _s.page,
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: _s.page,
            elevation: 0,
            iconTheme: IconThemeData(color: _s.text2),
            title: Text('Invite',
                style: TextStyle(fontWeight: FontWeight.w700, color: _s.text1)),
            centerTitle: true,
          ),
          body: _content(),
        ),
      ),
    );
  }

  Widget _content() {
    switch (_view) {
      case _View.loading:
        return Center(child: CircularProgressIndicator(color: _s.accent));
      case _View.denied:
        return _pad(Text(
          "Invite is for women inviting friends. It isn't available on your account.",
          textAlign: TextAlign.center,
          style: TextStyle(color: _s.text2, height: 1.5, fontSize: 15),
        ));
      case _View.error:
        return _pad(Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              "Couldn't load your link. Check your connection and try again.",
              textAlign: TextAlign.center,
              style: TextStyle(color: _s.text2, height: 1.5, fontSize: 15),
            ),
            const SizedBox(height: 14),
            OutlinedButton(onPressed: _load, child: const Text('Retry')),
          ],
        ));
      case _View.ready:
        return _readyBody();
    }
  }

  Widget _pad(Widget child) =>
      Center(child: Padding(padding: const EdgeInsets.all(32), child: child));

  Widget _readyBody() {
    return SingleChildScrollView(
      // CustomPaint paints its painter BEFORE the child and sizes to it, so the
      // art covers the whole scroll extent and scrolls with the content.
      child: CustomPaint(
        painter: _SkinArtPainter(motif: _s.motif, color: _s.accent, opacity: _s.artOpacity),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_showToggle) ...[_toggle(), const SizedBox(height: 20)],
              ...(_showPrivate
                  ? _privateChildren()
                  : _showMen
                      ? _menChildren()
                      : _womenChildren()),
            ],
          ),
        ),
      ),
    );
  }

  // ── Toggle ───────────────────────────────────────────────────────────────
  Widget _toggle() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: _s.fill,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _s.border1),
      ),
      child: Row(
        children: [
          // Three pills only fit on a narrow phone at a smaller type size.
          _toggleBtn('Invite women', _tab == _Tab.women, () => setState(() => _tab = _Tab.women),
              compact: _threePills),
          if (_gender == 'woman')
            _toggleBtn('Invite men', _tab == _Tab.men, () => setState(() => _tab = _Tab.men),
                compact: _threePills),
          if (_private != null)
            _toggleBtn('Privately', _tab == _Tab.private, () => setState(() => _tab = _Tab.private),
                compact: _threePills),
        ],
      ),
    );
  }

  bool get _threePills => _gender == 'woman' && _private != null;

  Widget _toggleBtn(String label, bool on, VoidCallback onTap, {bool compact = false}) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? _s.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: compact ? 12 : 13,
                  color: on ? _s.ctaText : _s.text2)),
        ),
      ),
    );
  }

  // ── Invite men (Flow 1) ──────────────────────────────────────────────────
  List<Widget> _menChildren() {
    return [
      Text('Turn your DMs into dates.',
          style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: _s.text1,
              height: 1.1,
              letterSpacing: -0.5)),
      const SizedBox(height: 6),
      Text('Your AI Bestie speaks to them. Not you.',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _s.accentText)),
      const SizedBox(height: 16),
      Text(
        "Hundreds of guys sliding into your DMs on Instagram, WhatsApp and Tinder? "
        "Most are creeps 🙄 but a few are genuine. "
        "You don't have the time to text them all. So send them your link: your Bestie "
        "talks to every one of them, ranks them, and brings you only the ones worth your time.",
        style: TextStyle(fontSize: 14.5, color: _s.text2, height: 1.55),
      ),
      const SizedBox(height: 22),
      _step(1, 'Share your link with the guys already chasing you.'),
      const SizedBox(height: 10),
      _step(2, "Your Bestie gets to know and ranks each of them, so you don't have to."),
      const SizedBox(height: 10),
      _step(3, 'The best ones get handed straight to you. You only meet the gems.'),
      const SizedBox(height: 22),
      _messageBlock(
        controller: _msg,
        label: "WHAT YOU'RE SENDING",
        hint: 'Edit it to sound like you before you send.',
      ),
      const SizedBox(height: 14),
      ..._channelBlock(message: () => _msg.text, link: _link?.shareUrl ?? ''),
      const SizedBox(height: 22),
      _statusLine(),
    ];
  }

  // ── Privately (Flow 3) ───────────────────────────────────────────────────
  /// One link for anyone, with nothing about the sender attached to it. The three
  /// [_fact] cards are the education: a privacy promise that isn't stated exactly
  /// is worse than not making it, so each of the three things this mode changes is
  /// spelled out rather than implied by the word "private".
  List<Widget> _privateChildren() {
    final p = _private!;

    return [
      Text('Send it to anyone. Stay invisible.',
          style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: _s.text1,
              height: 1.1,
              letterSpacing: -0.5)),
      const SizedBox(height: 6),
      Text('One link for men and women. Nothing about you travels with it.',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _s.accentText)),
      const SizedBox(height: 16),
      Text(
        "Same invite — but this link doesn't carry your photo, your name or your "
        "profile, and nobody who joins through it lands in your matches. Use it for group chats, "
        "your college batch, work folks, family: anyone you'd rather not have know your dating life.",
        style: TextStyle(fontSize: 14.5, color: _s.text2, height: 1.55),
      ),
      const SizedBox(height: 20),
      _fact("🕶️", "Your photo and profile stay here.",
          "Whoever opens this link sees riteangle, not you — no picture, no name, no age or city. "
          "Even the WhatsApp link preview shows only the app logo."),
      const SizedBox(height: 10),
      _fact("✅", "Everyone who joins is still credited to you.",
          "A person who signs up through your private link and gets verified is recorded against "
          "your invites, exactly like the other tabs."),
      const SizedBox(height: 10),
      _fact("🚫", "Nobody you invite gets matched with you.",
          "Not the men, not the women. Your matches don't change, and no one who joins through this "
          "link is ever shown that you invited them."),
      const SizedBox(height: 22),
      _messageBlock(
        controller: _privateMsg,
        label: "WHAT THEY'LL SEE",
        hint: 'Works in a group chat too. Edit before you send.',
      ),
      const SizedBox(height: 14),
      ..._channelBlock(message: () => _privateMsg.text, link: p.shareUrl),
      const SizedBox(height: 8),
      Text(
        "This is a different link from your other tabs — that one still shows your profile. Only "
        "this one is private.",
        style: TextStyle(fontSize: 12, color: _s.text3, height: 1.45),
      ),
      const SizedBox(height: 22),
      // This link's own funnel — it forms no matches, so "joined" is the end state.
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _s.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _s.border1),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _stat('${p.invited}', 'invited', _s.text1),
            Container(
              width: 4,
              height: 4,
              margin: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(color: _s.text3, shape: BoxShape.circle),
            ),
            _stat('${p.joined}', 'joined', _s.accentText),
          ],
        ),
      ),
    ];
  }

  /// A property of the private mode — same card rhythm as [_step], but an icon
  /// instead of a number, because these are facts and not an order of operations.
  Widget _fact(String icon, String lead, String body) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: _s.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _s.border1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: _s.tint, shape: BoxShape.circle),
            child: Text(icon, style: const TextStyle(fontSize: 14)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text.rich(
              TextSpan(children: [
                TextSpan(
                    text: "$lead ",
                    style: TextStyle(fontWeight: FontWeight.w700, color: _s.text1)),
                TextSpan(text: body),
              ]),
              style: TextStyle(fontSize: 13.5, color: _s.text2, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }

  // ── Invite women (Flow 2 · cash) ─────────────────────────────────────────
  List<Widget> _womenChildren() {
    final isMan = _gender == 'man';
    return [
      Text(isMan ? 'Invite women you vouch for.' : 'Invite your girls.',
          style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: _s.text1,
              height: 1.1,
              letterSpacing: -0.5)),
      const SizedBox(height: 6),
      Text('A curated circle is only as good as who’s in it.',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _s.accentText)),
      const SizedBox(height: 16),
      Text(
        isMan
            ? "Invite women you'd genuinely vouch for. Each one who joins gets into a curated, safe circle."
            : "Bring the women you'd want in a genuinely good room. She gets into a curated, safe circle, and the circle gets better. Everybody wins.",
        style: TextStyle(fontSize: 14.5, color: _s.text2, height: 1.55),
      ),
      if (isMan) ...[const SizedBox(height: 12), _upsideBanner()],
      const SizedBox(height: 22),
      Text('HOW DO YOU WANT TO WORD IT?',
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: _s.text3)),
      const SizedBox(height: 8),
      _moodChips(),
      const SizedBox(height: 20),
      _messageBlock(
        controller: _womenMsg,
        label: "WHAT SHE'LL SEE",
        hint: 'Each mood also sends her to a matching page. Edit before you send.',
      ),
      const SizedBox(height: 14),
      ..._channelBlock(message: () => _womenMsg.text, link: _womenLink(_mood)),
    ];
  }

  Widget _upsideBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _s.tint,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _s.border2),
      ),
      child: Text(
        "✨ When someone you invite joins and gets verified, she's matched with you.",
        style: TextStyle(
            fontSize: 13.5, fontWeight: FontWeight.w600, color: _s.accentText, height: 1.4),
      ),
    );
  }

  Widget _moodChips() {
    return Row(
      children: [
        _moodChip(_Mood.networking, "🤝", "Networking"),
        const SizedBox(width: 8),
        _moodChip(_Mood.casual, "✨", "Casual"),
        const SizedBox(width: 8),
        _moodChip(_Mood.serious, "💍", "Serious"),
      ],
    );
  }

  Widget _moodChip(_Mood m, String ic, String label) {
    final on = _mood == m;
    return Expanded(
      child: GestureDetector(
        onTap: () => _selectMood(m),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 6),
          decoration: BoxDecoration(
            color: on ? _s.tint : _s.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: on ? _s.accent : _s.border2),
          ),
          child: Column(
            children: [
              Text(ic, style: const TextStyle(fontSize: 18)),
              const SizedBox(height: 4),
              Text(label,
                  style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: on ? _s.accentText : _s.text2)),
            ],
          ),
        ),
      ),
    );
  }

  // ── Shared components ────────────────────────────────────────────────────
  Widget _step(int n, String text) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: _s.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _s.border1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: _s.accent, shape: BoxShape.circle),
            child: Text('$n',
                style: TextStyle(color: _s.ctaText, fontWeight: FontWeight.w800, fontSize: 13)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text, style: TextStyle(fontSize: 14, color: _s.text1, height: 1.4)),
          ),
        ],
      ),
    );
  }

  // ── Channel block (DM-first) ─────────────────────────────────────────────
  /// [message] is a getter, not a value, so the buttons always send whatever is
  /// in the text field at tap time rather than whatever it held at build time.
  List<Widget> _channelBlock({required String Function() message, required String link}) {
    return [
      _copyChip(),
      const SizedBox(height: 10),
      _bigChannel(
        channel: _Channel.instagram,
        name: 'Instagram DMs',
        sub: 'copy & open · paste into each chat',
        gradient: _igGradient,
        fg: Colors.white,
        glyphBg: Colors.white.withValues(alpha: 0.22),
        glyph: _igGlyph(Colors.white, 17),
        onTap: () => _shareVia(_Channel.instagram, message()),
      ),
      const SizedBox(height: 8),
      _bigChannel(
        channel: _Channel.snapchat,
        name: 'Snapchat',
        sub: 'copy & open · paste into each chat',
        color: _snapYellow,
        fg: _onBright,
        glyphBg: _onBright.withValues(alpha: 0.10),
        glyph: _snapGlyph(_onBright, 18),
        onTap: () => _shareVia(_Channel.snapchat, message()),
      ),
      const SizedBox(height: 8),
      Row(
        children: [
          Expanded(
            child: _minorChannel(
              name: 'WhatsApp',
              glyphBg: _waGreen,
              glyph: const Icon(Icons.call_rounded, size: 13, color: Colors.white),
              onTap: () => _shareVia(_Channel.whatsapp, message()),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _minorChannel(
              name: 'More',
              glyphBg: _s.fill,
              glyph: Icon(Icons.more_horiz_rounded, size: 14, color: _s.text2),
              onTap: () => _shareVia(_Channel.more, message()),
            ),
          ),
        ],
      ),
      const SizedBox(height: 12),
      _linkStrip(link),
    ];
  }

  /// Two states, both persistent: what will happen, then what did. The link's
  /// own "Copied ✓" still flashes and clears — that one is a receipt, this one
  /// is an instruction she may need after backgrounding the app.
  Widget _copyChip() {
    final copied = _copiedFor;
    if (copied == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color: _s.fill,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.content_copy_rounded, size: 13, color: _s.text2),
            const SizedBox(width: 8),
            Flexible(
              child: Text("Tap an app below — we'll copy this first",
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _s.text2)),
            ),
          ],
        ),
      );
    }

    final app = copied == _Channel.instagram ? 'Instagram' : 'Snapchat';
    final text = _appMissing
        ? "Copied — $app isn't installed. Paste it wherever you like."
        : (copied == _Channel.instagram
            ? 'Copied. Long-press the DM box and paste.'
            : 'Copied. Open Chat, long-press, paste.');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
      decoration: BoxDecoration(
        // A dark chip on the light skins. On Casual the page is already dark, so
        // it steps UP to a raised surface instead of down.
        color: _s.dark ? _s.border2 : const Color(0xFF241A1E),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_appMissing ? Icons.info_outline_rounded : Icons.check_rounded,
              size: 14, color: _appMissing ? Colors.white70 : const Color(0xFF6EE7A8)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(text,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _bigChannel({
    required _Channel channel,
    required String name,
    required String sub,
    required Color fg,
    required Color glyphBg,
    required Widget glyph,
    required VoidCallback onTap,
    Color? color,
    Gradient? gradient,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: color,
          gradient: gradient,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: glyphBg, borderRadius: BorderRadius.circular(9)),
              child: glyph,
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w800, color: fg, letterSpacing: -0.1)),
                  const SizedBox(height: 1),
                  Text(sub,
                      style: TextStyle(
                          fontSize: 10.5, fontWeight: FontWeight.w600, color: fg.withValues(alpha: 0.78))),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 20, color: fg.withValues(alpha: 0.8)),
          ],
        ),
      ),
    );
  }

  Widget _minorChannel({
    required String name,
    required Color glyphBg,
    required Widget glyph,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
        decoration: BoxDecoration(
          color: _s.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _s.border2),
        ),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: glyphBg, borderRadius: BorderRadius.circular(7)),
              child: glyph,
            ),
            const SizedBox(width: 9),
            Flexible(
              child: Text(name,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _s.text1)),
            ),
          ],
        ),
      ),
    );
  }

  /// The link on its own, for anywhere the message doesn't fit — a bio, a story
  /// sticker, a comment.
  Widget _linkStrip(String link) {
    return GestureDetector(
      onTap: () => _copy(link, isLink: true),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: _s.tint,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _s.accent),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(link.replaceFirst(RegExp(r'^https?://'), ''),
                  style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: _s.text1)),
            ),
            const SizedBox(width: 8),
            Text(_copiedLink ? 'Copied ✓' : 'Copy link',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _s.accentText)),
          ],
        ),
      ),
    );
  }

  // ── Channel glyphs ───────────────────────────────────────────────────────
  Widget _igGlyph(Color c, double size) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: c, width: 1.7),
              borderRadius: BorderRadius.circular(size * 0.28),
            ),
          ),
          Container(
            width: size * 0.44,
            height: size * 0.44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: c, width: 1.7),
            ),
          ),
          Positioned(
            top: size * 0.19,
            right: size * 0.19,
            child: Container(width: size * 0.12, height: size * 0.12,
                decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
          ),
        ],
      ),
    );
  }

  Widget _snapGlyph(Color c, double size) =>
      SizedBox(width: size, height: size, child: CustomPaint(painter: _GhostPainter(c)));

  Widget _messageBlock({
    required TextEditingController controller,
    required String label,
    required String hint,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: _s.text3)),
            GestureDetector(
              onTap: () => _copy(controller.text, isLink: false),
              child: Text(_copiedMsg ? 'Copied ✓' : 'Copy message',
                  style: TextStyle(
                      fontSize: 12.5, fontWeight: FontWeight.w700, color: _s.accentText)),
            ),
          ],
        ),
        const SizedBox(height: 7),
        TextField(
          controller: controller,
          minLines: 4,
          maxLines: 8,
          cursorColor: _s.accent,
          style: TextStyle(fontSize: 14, color: _s.text1, height: 1.5),
          decoration: InputDecoration(
            filled: true,
            fillColor: _s.card,
            contentPadding: const EdgeInsets.all(12),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: _s.border2),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: _s.accent, width: 2),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 6, left: 2),
          child: Text(hint, style: TextStyle(fontSize: 12, color: _s.text3)),
        ),
      ],
    );
  }

  Widget _statusLine() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _s.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _s.border1),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _stat('$_invited', 'invited', _s.text1),
          Container(
            width: 4,
            height: 4,
            margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(color: _s.text3, shape: BoxShape.circle),
          ),
          _stat('$_signedUp', 'signed up', _s.accentText),
        ],
      ),
    );
  }

  Widget _stat(String k, String label, Color kColor) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(k, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: kColor)),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(fontSize: 14, color: _s.text2)),
      ],
    );
  }
}

/// Snapchat's ghost, drawn rather than shipped as an asset — a dome with a
/// three-scallop hem, on a 24x24 grid scaled to fit.
class _GhostPainter extends CustomPainter {
  const _GhostPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24.0;
    final p = Path()
      ..moveTo(5 * s, 18 * s)
      ..lineTo(5 * s, 10 * s)
      ..cubicTo(5 * s, 5.6 * s, 8.1 * s, 2.6 * s, 12 * s, 2.6 * s)
      ..cubicTo(15.9 * s, 2.6 * s, 19 * s, 5.6 * s, 19 * s, 10 * s)
      ..lineTo(19 * s, 18 * s)
      ..cubicTo(19 * s, 19.5 * s, 17.6 * s, 20 * s, 16.7 * s, 19.1 * s)
      ..cubicTo(15.9 * s, 18.3 * s, 14.7 * s, 18.3 * s, 13.9 * s, 19.1 * s)
      ..cubicTo(13 * s, 20 * s, 11.6 * s, 20 * s, 10.7 * s, 19.1 * s)
      ..cubicTo(9.9 * s, 18.3 * s, 8.7 * s, 18.3 * s, 7.9 * s, 19.1 * s)
      ..cubicTo(7 * s, 20 * s, 5 * s, 19.5 * s, 5 * s, 18 * s)
      ..close();
    canvas.drawPath(p, Paint()..color = color..style = PaintingStyle.fill);
  }

  @override
  bool shouldRepaint(_GhostPainter old) => old.color != color;
}

/// The skin's background line art — one flat colour, low opacity, sized to the
/// full scroll extent. Kept quiet on purpose: it should read as texture, not as
/// an illustration competing with the copy.
///
/// Geometry is expressed against a 340pt-wide reference (the width the motifs
/// were designed at) and scaled, so they keep their proportions on any screen.
/// In lockstep with the `buildArt` helper in the web screen.
class _SkinArtPainter extends CustomPainter {
  const _SkinArtPainter({
    required this.motif,
    required this.color,
    required this.opacity,
  });

  final _Motif motif;
  final Color color;
  final double opacity;

  static const _refWidth = 340.0;

  @override
  void paint(Canvas canvas, Size size) {
    if (motif == _Motif.none || opacity <= 0 || size.isEmpty) return;
    final k = size.width / _refWidth; // uniform scale
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..color = color.withValues(alpha: opacity)
      ..strokeCap = StrokeCap.round;

    switch (motif) {
      case _Motif.ribbons:
        _ribbons(canvas, size, k, paint);
      case _Motif.rings:
        _rings(canvas, size, k, paint);
      case _Motif.mesh:
        _mesh(canvas, size, k, paint);
      case _Motif.facets:
        _facets(canvas, size, k, paint);
      case _Motif.veil:
        _veil(canvas, size, k, paint);
      case _Motif.none:
        break;
    }
  }

  /// Privately — a veil: one family of close diagonals, frosted glass. A single
  /// direction only, so it never reads as the diamond lattice of the men skin.
  void _veil(Canvas canvas, Size size, double k, Paint paint) {
    paint.strokeWidth = 0.7 * k;
    final step = 22 * k;
    final h = size.height;
    for (var x = -h; x < size.width + h; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x + h, h), paint);
    }
  }

  /// Invite men — a diamond lattice: the gems she is left with once her Bestie
  /// has screened the DMs. Two families of diagonals, nothing more.
  void _facets(Canvas canvas, Size size, double k, Paint paint) {
    paint.strokeWidth = 0.7 * k;
    final step = 46 * k;
    final h = size.height;
    for (var x = -h; x < size.width + h; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x + h, h), paint);
      canvas.drawLine(Offset(x, 0), Offset(x - h, h), paint);
    }
  }

  /// Casual — long silk sweeps drifting down the page.
  void _ribbons(Canvas canvas, Size size, double k, Paint paint) {
    final rows = (size.height / (106 * k)).ceil() + 2;
    for (var i = 0; i < rows; i++) {
      final y0 = -80 * k + i * 106 * k;
      final amp = (52 + (i % 4) * 24) * k;
      final phase = i * 0.68;
      final path = Path();
      var first = true;
      for (var x = -30 * k; x <= size.width + 30 * k; x += 20 * k) {
        final y = y0 + math.sin((x / (112 * k)) + phase) * amp + x * 0.16;
        if (first) {
          path.moveTo(x, y);
          first = false;
        } else {
          path.lineTo(x, y);
        }
      }
      paint.strokeWidth = (1 + (i % 3) * 0.45) * k;
      canvas.drawPath(path, paint);
    }
  }

  /// Serious — concentric rings, centres pushed off-canvas, picking up the 💍.
  void _rings(Canvas canvas, Size size, double k, Paint paint) {
    paint.strokeWidth = 0.9 * k;
    final centres = [
      Offset(size.width * 0.9, size.height * 0.1),
      Offset(size.width * 0.1, size.height * 0.45),
      Offset(size.width * 0.76, size.height * 0.82),
    ];
    for (final c in centres) {
      for (var r = 40 * k; r < 260 * k; r += 19 * k) {
        canvas.drawCircle(c, r, paint);
      }
    }
  }

  /// Networking — scattered nodes joined to their near neighbours.
  void _mesh(Canvas canvas, Size size, double k, Paint paint) {
    paint.strokeWidth = 0.7 * k;
    // A fixed seed keeps the mesh stable across repaints (no drifting dots).
    final rnd = math.Random(7);
    final count = (62 * (size.height / (1200 * k))).round().clamp(24, 220);
    final pts = List<Offset>.generate(
      count,
      (_) => Offset(rnd.nextDouble() * size.width, rnd.nextDouble() * size.height),
    );
    final reach = 118 * k;
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        if ((pts[i] - pts[j]).distance < reach) canvas.drawLine(pts[i], pts[j], paint);
      }
    }
    final dot = Paint()..color = color.withValues(alpha: opacity);
    for (final p in pts) {
      canvas.drawCircle(p, 2.1 * k, dot);
    }
  }

  @override
  bool shouldRepaint(_SkinArtPainter old) =>
      old.motif != motif || old.color != color || old.opacity != opacity;
}
