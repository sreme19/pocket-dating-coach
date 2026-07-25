import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';
import 'season.dart';

/// Refer & Earn — one entry, two flows (toggle), in LOCKSTEP with the web screen
/// src/routes/verified-vibe/refer/+page.svelte, EXCEPT the share row: the
/// DM-first channel block below has not been ported to web yet, which still has
/// the WhatsApp-primary row. Copy and flows stay in lockstep; keep them so.
///
///  - Invite women (Flow 2, Model B): CASH ambassador referral. She earns ₹100
///    per verified woman she brings (#1-25), then ₹150 (#26-100), cap 100. A
///    "mood" (networking / casual / serious) sets the share message + the landing
///    the invitee sees (via ?m=). Payout is manual (admin marks paid).
///  - Invite men (Flow 1, Model A): no money — her AI Bestie screens the men in
///    her DMs and hands her the gems.
///
/// Data comes from GET /api/verified-vibe/referral-link (see api.dart).
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
/// House style: display strings use DOUBLE quotes so straight apostrophes
/// ("I've", "don't", "you're", "she'll") are safe without escaping. No curly quotes.
class ReferScreen extends StatefulWidget {
  const ReferScreen({super.key});

  @override
  State<ReferScreen> createState() => _ReferScreenState();
}

enum _View { loading, ready, denied, error }

enum _Tab { women, men }

enum _Mood { networking, casual, serious }

/// Where she is sending it. Order here is the order on screen.
enum _Channel { instagram, snapchat, whatsapp, more }

class _ReferScreenState extends State<ReferScreen> {
  static const _border1 = Color(0xFFF1E0E3);
  static const _border2 = Color(0xFFE7D2D7);

  // Channel brand colours — the one place in the app that isn't riteangle pink,
  // because these buttons are promises about where the tap lands.
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
  ReferralCash? _cash;
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
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _view = _View.loading);
    try {
      final link = await fetchReferralLink();
      if (!mounted) return;
      setState(() {
        _link = link;
        _cash = link.cash;
        _gender = link.gender;
        _invited = link.invited;
        _signedUp = link.signedUp;
        _msg.text = _messageFor(link.shareUrl);
        _womenMsg.text = _inviteMessageFor("${link.shareUrl}?m=${_moodStr(_mood)}", _mood);
        _view = _View.ready;
      });
    } on ReferralLinkDenied {
      if (mounted) setState(() => _view = _View.denied);
    } catch (_) {
      if (mounted) setState(() => _view = _View.error);
    }
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
            "skews high-earning tech/finance, and an AI weeds out the creeps before they reach you. "
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
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(Config.text2)),
        title: const Text('Refer & Earn',
            style: TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
        centerTitle: true,
      ),
      body: _content(),
    );
  }

  Widget _content() {
    switch (_view) {
      case _View.loading:
        return Center(child: CircularProgressIndicator(color: Brand.accent));
      case _View.denied:
        return _pad(const Text(
          "Refer & Earn is for women inviting friends. It isn't available on your account.",
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(Config.text2), height: 1.5, fontSize: 15),
        ));
      case _View.error:
        return _pad(Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              "Couldn't load your link. Check your connection and try again.",
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(Config.text2), height: 1.5, fontSize: 15),
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
    final showMen = _gender == 'woman' && _tab == _Tab.men;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_gender == 'woman') ...[_toggle(), const SizedBox(height: 20)],
          ...(showMen ? _menChildren() : _womenChildren()),
        ],
      ),
    );
  }

  // ── Toggle ───────────────────────────────────────────────────────────────
  Widget _toggle() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(Config.bg3),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _border1),
      ),
      child: Row(
        children: [
          _toggleBtn('Invite women', _tab == _Tab.women, () => setState(() => _tab = _Tab.women)),
          _toggleBtn('Invite men', _tab == _Tab.men, () => setState(() => _tab = _Tab.men)),
        ],
      ),
    );
  }

  Widget _toggleBtn(String label, bool on, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? Brand.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(label,
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: on ? Colors.white : const Color(Config.text2))),
        ),
      ),
    );
  }

  // ── Invite men (Flow 1) ──────────────────────────────────────────────────
  List<Widget> _menChildren() {
    return [
      const Text('Turn your DMs into dates.',
          style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: Color(Config.text1),
              height: 1.1,
              letterSpacing: -0.5)),
      const SizedBox(height: 6),
      Text('Your AI Bestie speaks to them. Not you.',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Brand.accentBright)),
      const SizedBox(height: 16),
      const Text(
        "Hundreds of guys sliding into your DMs on Instagram, WhatsApp and Tinder? "
        "Most are creeps 🙄 but a few are genuine, successful, even high-earning. "
        "You don't have the time to text them all. So send them your link: your Bestie "
        "talks to every one of them, ranks them, and brings you only the ones worth your time.",
        style: TextStyle(fontSize: 14.5, color: Color(Config.text2), height: 1.55),
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

  // ── Invite women (Flow 2 · cash) ─────────────────────────────────────────
  List<Widget> _womenChildren() {
    final c = _cash;
    final isMan = _gender == 'man';
    return [
      Text(isMan ? 'Invite women. Earn real cash.' : 'Invite your girls. Earn real cash.',
          style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: Color(Config.text1),
              height: 1.1,
              letterSpacing: -0.5)),
      const SizedBox(height: 6),
      Text("₹${c?.currentTier ?? 100} for every friend who joins.",
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Brand.accentBright)),
      const SizedBox(height: 16),
      Text(
        isMan
            ? "Invite women you'd genuinely vouch for. You earn for each one who joins and gets verified, and she gets into a curated, safe circle."
            : "Bring the women you'd want in a genuinely good room. You earn for each one who joins and gets verified. She gets into a curated, safe circle. Everybody wins.",
        style: const TextStyle(fontSize: 14.5, color: Color(Config.text2), height: 1.55),
      ),
      if (isMan) ...[const SizedBox(height: 12), _upsideBanner()],
      const SizedBox(height: 20),
      _earnCard(),
      const SizedBox(height: 16),
      _capBar(),
      const SizedBox(height: 22),
      const Text('HOW DO YOU WANT TO WORD IT?',
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(Config.text3))),
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
        color: Brand.accentTint,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border2),
      ),
      child: Text(
        "✨ When someone you invite joins and gets verified, she's matched with you.",
        style: TextStyle(
            fontSize: 13.5, fontWeight: FontWeight.w600, color: Brand.accentBright, height: 1.4),
      ),
    );
  }

  Widget _earnCard() {
    final c = _cash;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFFFFF6E8), Brand.accentTint],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Brand.accentTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text("₹${c?.earnedInr ?? 0}",
                  style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: Color(Config.text1))),
              const SizedBox(width: 8),
              const Text("earned so far",
                  style: TextStyle(fontSize: 13, color: Color(Config.text2), fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: const Color(Config.bg2), borderRadius: BorderRadius.circular(999)),
            child: Text(
              "🎉 ₹${c?.currentTier ?? 100} per friend${(c?.verifiedCount ?? 0) < 25 ? ' · first 25' : ''}",
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Brand.accentBright),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "₹${c?.pendingInr ?? 0} pending · ₹${c?.paidInr ?? 0} paid · sent to your UPI once she's verified",
            style: const TextStyle(fontSize: 12, color: Color(Config.text2)),
          ),
        ],
      ),
    );
  }

  Widget _capBar() {
    final c = _cash;
    final pct = (c == null || c.cap == 0) ? 0.0 : (c.verifiedCount / c.cap).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text("Rewarded invites",
                style: TextStyle(fontSize: 12, color: Color(Config.text2), fontWeight: FontWeight.w600)),
            Text("${c?.verifiedCount ?? 0} / ${c?.cap ?? 100}",
                style: const TextStyle(fontSize: 12, color: Color(Config.text2), fontWeight: FontWeight.w600)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 8,
            backgroundColor: const Color(Config.bg3),
            valueColor: AlwaysStoppedAnimation(Brand.accent),
          ),
        ),
      ],
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
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 6),
          decoration: BoxDecoration(
            color: on ? Brand.accentTint : const Color(Config.bg2),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: on ? Brand.accent : _border2),
          ),
          child: Column(
            children: [
              Text(ic, style: const TextStyle(fontSize: 18)),
              const SizedBox(height: 4),
              Text(label,
                  style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: on ? Brand.accentBright : const Color(Config.text2))),
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
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: Brand.accent, shape: BoxShape.circle),
            child: Text('$n',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text,
                style: const TextStyle(fontSize: 14, color: Color(Config.text1), height: 1.4)),
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
        fg: const Color(Config.text1),
        glyphBg: const Color(Config.text1).withValues(alpha: 0.10),
        glyph: _snapGlyph(const Color(Config.text1), 18),
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
              glyphBg: const Color(Config.bg3),
              glyph: const Icon(Icons.more_horiz_rounded, size: 14, color: Color(Config.text2)),
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
          color: const Color(Config.bg3),
          borderRadius: BorderRadius.circular(999),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.content_copy_rounded, size: 13, color: Color(Config.text2)),
            SizedBox(width: 8),
            Flexible(
              child: Text("Tap an app below — we'll copy this first",
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(Config.text2))),
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
        color: const Color(0xFF241A1E),
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
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _border2),
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
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700, color: Color(Config.text1))),
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
          color: Brand.accentTint,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Brand.accent),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(link.replaceFirst(RegExp(r'^https?://'), ''),
                  style: const TextStyle(
                      fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(Config.text1))),
            ),
            const SizedBox(width: 8),
            Text(_copiedLink ? 'Copied ✓' : 'Copy link',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Brand.accentBright)),
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
                style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(Config.text3))),
            GestureDetector(
              onTap: () => _copy(controller.text, isLink: false),
              child: Text(_copiedMsg ? 'Copied ✓' : 'Copy message',
                  style: TextStyle(
                      fontSize: 12.5, fontWeight: FontWeight.w700, color: Brand.accentBright)),
            ),
          ],
        ),
        const SizedBox(height: 7),
        TextField(
          controller: controller,
          minLines: 4,
          maxLines: 8,
          style: const TextStyle(fontSize: 14, color: Color(Config.text1), height: 1.5),
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(Config.bg2),
            contentPadding: const EdgeInsets.all(12),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _border2),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Brand.accent, width: 2),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 6, left: 2),
          child: Text(hint, style: const TextStyle(fontSize: 12, color: Color(Config.text3))),
        ),
      ],
    );
  }

  Widget _statusLine() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border1),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _stat('$_invited', 'invited', const Color(Config.text1)),
          Container(
            width: 4,
            height: 4,
            margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration: const BoxDecoration(color: Color(Config.text3), shape: BoxShape.circle),
          ),
          _stat('$_signedUp', 'signed up', Brand.accentBright),
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
        Text(label, style: const TextStyle(fontSize: 14, color: Color(Config.text2))),
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
