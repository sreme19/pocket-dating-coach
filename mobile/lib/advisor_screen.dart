import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'app_logger.dart';
import 'category_proof_screen.dart';
import 'config.dart';
import 'markdown.dart';
import 'season.dart';
import 'trust_boost_screen.dart';

/// AI advisor chat — Wingman (men) or Bestie (women). Proactive greeting on
/// open, quick-action intent chips, markdown replies, Bestie drafts, and
/// thumbs feedback. Each send posts the running history to the chat endpoint.
/// The transcript hydrates from the server thread (/advisor/history) so it
/// survives a reinstall and follows the user to a second device; the local
/// SharedPreferences copy is only an offline fallback.
class AdvisorScreen extends StatefulWidget {
  final bool wingman;
  /// When set, this message is auto-sent once on open (e.g. the hand-off "Review"
  /// button seeds a "summarize my chat with him" request).
  final String? initialMessage;
  const AdvisorScreen({super.key, required this.wingman, this.initialMessage});

  @override
  State<AdvisorScreen> createState() => _AdvisorScreenState();
}

class _Turn {
  final String role; // 'user' | 'assistant' | 'greeting'
  final String content;
  final List<AdvisorDraft> drafts;
  final String? greetingId;
  /// Server message id, when this turn came from (or was stored by) the backend.
  final String? id;
  /// Server kind: 'chat' | 'greeting' | 'nudge' | 'task_ack' | 'task_result'.
  /// Drives which card renders this turn.
  final String kind;
  final Map<String, dynamic>? payload;
  /// The async task this turn belongs to — ties an ack card to the result that
  /// later supersedes it.
  final String? taskId;
  int feedback = 0; // -1, 0, 1
  _Turn(
    this.role,
    this.content, {
    this.drafts = const [],
    this.greetingId,
    this.id,
    this.kind = 'chat',
    this.payload,
    this.taskId,
  });

  /// Greeting/nudge turns render with the accent border + "a note for you" label,
  /// and route their thumbs to the greeting feedback endpoint.
  bool get isGreeting => role == 'greeting' || kind == 'greeting' || kind == 'nudge';

  /// Payload reads, all tolerant of a missing/short payload: the chat endpoint
  /// hands back a queued task WITHOUT the ack payload, so the card has to render
  /// on nothing until the next hydration fills it in.
  List<String> get steps =>
      ((payload?['steps'] as List?) ?? const []).map((e) => e.toString()).toList();
  int get etaMinutes => payload?['etaMinutes'] is num ? (payload!['etaMinutes'] as num).toInt() : 2;
  /// 'match_scan' | 'profile_audit' — the ack stores it as taskKind, the result as kind.
  String get taskKind => (payload?['taskKind'] ?? payload?['kind'] ?? '').toString();
  /// The runner gave up after its retries — an apology, not a result.
  bool get taskFailed => payload?['failed'] == true;
}

class _AdvisorScreenState extends State<AdvisorScreen> with WidgetsBindingObserver {
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  final List<_Turn> _turns = [];
  bool _thinking = false;
  /// Re-checks the thread while an async task is still out. Runs only while a
  /// task_ack is unanswered; the card says "you can close this", but plenty of
  /// people sit and watch it, and they should see the answer land.
  Timer? _taskPoll;
  AppLifecycleState _lifecycle = AppLifecycleState.resumed;
  /// Proof-portfolio state for the pinned card. Null until the first fetch lands
  /// (or forever, if it fails) — the card is additive, so the thread must read
  /// normally without it.
  AdvisorPortfolio? _portfolio;

  bool get _wm => widget.wingman;
  String get _name => _wm ? 'AI Wingman' : 'AI Bestie';
  String get _historyKey => _wm ? 'vv_advisor_history_wingman' : 'vv_advisor_history_bestie';

  List<({String label, String intent})> get _chips => [
        (label: 'Summarize matches', intent: 'summary'),
        (label: _wm ? 'New insights' : 'Fresh insights', intent: 'insights'),
        (label: 'Better matches', intent: 'better_matches'),
        (label: 'Update profile', intent: 'update_profile'),
      ];

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('advisor');
    AppLogger.instance.action('advisor', 'load_advisor');
    WidgetsBinding.instance.addObserver(this);
    _loadHistory().then((_) => _loadPortfolio()).then((_) => _loadGreeting()).then((_) => _loadHandoffNudge()).then((_) {
      final seed = widget.initialMessage?.trim();
      if (seed != null && seed.isNotEmpty && mounted) _send(text: seed);
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _lifecycle = state;
    // Back in the foreground: check straight away rather than waiting out a tick.
    if (state == AppLifecycleState.resumed && _taskPending) _pollTaskOnce();
    // The member may have uploaded a proof on the web (or in another tab of the
    // app) while we were away — the card must not still be selling a done move.
    if (state == AppLifecycleState.resumed) _loadPortfolio();
  }

  /// Refresh the pinned portfolio card. Non-fatal by construction: a null result
  /// leaves the previous card in place rather than blanking it, so a single flaky
  /// request does not make the card flicker away.
  Future<void> _loadPortfolio() async {
    final p = await fetchAdvisorPortfolio();
    if (!mounted || p == null) return;
    setState(() => _portfolio = p);
  }

  /// Deep-link into the proof-upload flow for one category, then re-read the
  /// portfolio so the card reflects whatever they just uploaded.
  Future<void> _openProof(String categoryId) async {
    AppLogger.instance.action('advisor', 'tap_portfolio_action', meta: {'category': categoryId});
    await Navigator.of(context).push(MaterialPageRoute(
      // habit_tracker has no dedicated upload screen in the app yet; Trust &
      // Boost is the surface that can still take it.
      builder: (_) => categoryId == 'habit_tracker'
          ? const TrustBoostScreen(scrollToShowOff: true)
          : CategoryProofScreen(categoryId: categoryId),
    ));
    await _loadPortfolio();
  }

  /// Surface the AI Bestie's time-sensitive hand-off nudge (spec B2, point 4) —
  /// only for the woman's Bestie, and only while a match is still awaiting her.
  Future<void> _loadHandoffNudge() async {
    if (widget.wingman) return; // nudge is a Bestie-only, woman-facing message
    final n = await fetchHandoffNudge();
    if (n == null || !mounted) return;
    if (_alreadyShown(n.id, n.content)) return; // hydration already has it
    setState(() => _turns.add(_Turn('greeting', n.content, greetingId: n.id, kind: 'nudge')));
    _scrollToBottom();
    _markRead();
  }

  /// The server thread is the source of truth — hydrate from it so a reinstall or
  /// a second device shows the real conversation (proactive greetings included).
  /// SharedPreferences survives only as an offline fallback.
  Future<void> _loadHistory() async {
    final h = await fetchAdvisorHistory();
    if (!mounted) return;
    if (h == null || h.messages.isEmpty) {
      await _loadCachedHistory(); // offline (or nothing stored yet)
      return;
    }
    _applyHistory(h);
    _scrollToBottom();
    _saveHistory(); // keep the offline cache in step with the server
    _markRead();
    _syncTaskPoll();
  }

  /// Replace the thread with the server's copy.
  void _applyHistory(AdvisorHistory h) {
    setState(() {
      _turns.clear();
      for (final m in h.messages) {
        _turns.add(_Turn(
          // Proactive turns keep the local 'greeting' role so the bubble styling
          // and the greeting-feedback route behave exactly as before.
          (m.kind == 'greeting' || m.kind == 'nudge') ? 'greeting' : m.role,
          m.content,
          greetingId: m.greetingId,
          id: m.id,
          kind: m.kind,
          payload: m.payload,
          taskId: m.taskId,
        ));
      }
    });
  }

  /// Offline fallback: the last 30 chat turns this device saw.
  Future<void> _loadCachedHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_historyKey);
    if (raw == null || !mounted) return;
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      setState(() {
        for (final item in list) {
          _turns.add(_Turn(item['role'] as String, item['content'] as String));
        }
      });
      _scrollToBottom();
    } catch (_) {
      AppLogger.instance.error('load_history failed', screen: 'advisor', action: 'load_history');
    }
  }

  /// True when the thread already carries this proactive turn. The greeting and
  /// hand-off-nudge endpoints hand back content the server now ALSO persists, so
  /// without this check hydration + the POST would render it twice.
  bool _alreadyShown(String id, String content) => _turns.any((t) =>
      (id.isNotEmpty && (t.greetingId == id || t.id == id)) ||
      (t.isGreeting && t.content == content));

  /// Clear the advisor badge. Fetching history does not mark read — we do, once
  /// the user is actually looking at the thread.
  void _markRead() {
    if (!mounted) return;
    markAdvisorRead();
  }

  Future<void> _saveHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final toSave = _turns
        // task_ack is UI state ("on it, close this"), not conversation — caching it
        // would resurrect a dead spinner offline.
        .where((t) => (t.role == 'user' || t.role == 'assistant') && t.kind != 'task_ack')
        .map((t) => {'role': t.role, 'content': t.content})
        .toList();
    final trimmed = toSave.length > 30 ? toSave.sublist(toSave.length - 30) : toSave;
    await prefs.setString(_historyKey, jsonEncode(trimmed));
  }

  Future<void> _loadGreeting() async {
    final g = await fetchGreeting();
    if (g == null || !mounted) return;
    if (_alreadyShown(g.id, g.content)) return; // hydration already has it
    setState(() => _turns.add(_Turn('greeting', g.content, greetingId: g.id, kind: 'greeting')));
    _scrollToBottom();
    _markRead();
  }

  /// History as role/content maps, excluding greeting + non-text turns. task_ack is
  /// dropped for the same reason the server drops it when building the prompt: "on
  /// it, I'll ping you" teaches the model to acknowledge instead of answer.
  List<Map<String, String>> get _history => [
        for (final t in _turns)
          if ((t.role == 'user' || t.role == 'assistant') && t.kind != 'task_ack')
            {'role': t.role == 'user' ? 'user' : 'assistant', 'content': t.content},
      ];

  /// Tasks whose result turn has already landed.
  Set<String> get _answeredTasks => {
        for (final t in _turns)
          if (t.kind == 'task_result' && (t.taskId ?? '').isNotEmpty) t.taskId!,
      };

  /// Tasks with an ack but no result yet. A taskId-less ack is excluded on purpose:
  /// nothing could ever match it, so it would keep the poll running forever.
  Set<String> get _pendingTasks {
    final answered = _answeredTasks;
    return {
      for (final t in _turns)
        if (t.kind == 'task_ack' && (t.taskId ?? '').isNotEmpty && !answered.contains(t.taskId))
          t.taskId!,
    };
  }

  bool get _taskPending => _pendingTasks.isNotEmpty;

  /// Turns to render. A task_ack is dropped once its task_result has landed — a
  /// spinner still spinning beside a finished answer reads as a bug.
  List<_Turn> get _visibleTurns {
    final answered = _answeredTasks;
    if (answered.isEmpty) return _turns;
    return _turns.where((t) => !(t.kind == 'task_ack' && answered.contains(t.taskId))).toList();
  }

  /// Run the poll exactly while there's something to wait for. Idempotent, so it's
  /// safe to call after anything that could queue or resolve a task.
  void _syncTaskPoll() {
    if (!mounted) return;
    if (_taskPending) {
      _taskPoll ??= Timer.periodic(const Duration(seconds: 20), (_) => _pollTaskOnce());
    } else {
      _taskPoll?.cancel();
      _taskPoll = null;
    }
  }

  /// One tick: has the cron written the answer yet?
  ///
  /// Deliberately narrow — it re-applies the thread ONLY when a result for a task
  /// we're waiting on has appeared. Re-applying on every tick would clobber
  /// local-only turns (the Profile-tab tip from the chip) and fight the scroll
  /// position for no gain.
  Future<void> _pollTaskOnce() async {
    if (!mounted) return;
    final pending = _pendingTasks;
    if (pending.isEmpty) {
      _syncTaskPoll(); // resolved elsewhere — stop ticking
      return;
    }
    if (_lifecycle != AppLifecycleState.resumed) return; // no work while backgrounded
    final h = await fetchAdvisorHistory();
    if (!mounted || h == null) return;
    final landed = h.messages.any((m) => m.kind == 'task_result' && pending.contains(m.taskId));
    if (!landed) return;
    // Follow the thread down only if they were already at the bottom — someone
    // scrolled up re-reading the ack should not get yanked.
    final wasAtBottom = _atBottom();
    _applyHistory(h);
    _saveHistory();
    _markRead();
    if (wasAtBottom) _scrollToBottom();
    _syncTaskPoll();
  }

  /// Within about a bubble's height of the end of the list.
  bool _atBottom() {
    if (!_scroll.hasClients) return true;
    final p = _scroll.position;
    return p.pixels >= p.maxScrollExtent - 80;
  }

  Future<void> _chip(String intent, String label) async {
    if (_thinking) return;
    if (intent == 'update_profile') {
      setState(() => _turns.add(_Turn('assistant',
          'Head to your **Profile** tab to edit your photos, About, archetype, and proof signals. Boosting your trust score there is the fastest way to better matches.')));
      _scrollToBottom();
      _saveHistory();
      return;
    }
    if (intent == 'better_matches') {
      await _send(text: 'How can I get better matches?');
      return;
    }
    // summary / insights — empty message + intent
    setState(() => _turns.add(_Turn('user', label)));
    await _run(message: '', intent: intent);
  }

  Future<void> _send({String? text}) async {
    final t = (text ?? _composer.text).trim();
    if (t.isEmpty || _thinking) return;
    AppLogger.instance.action('advisor', 'send_advisor_message');
    _composer.clear();
    setState(() => _turns.add(_Turn('user', t)));
    await _run(message: t, intent: 'chat');
  }

  Future<void> _run({required String message, required String intent}) async {
    setState(() => _thinking = true);
    _scrollToBottom();
    try {
      final history = _history.where((m) => m['content'] != message).toList();
      final r = await askAdvisor(wingman: _wm, message: message, history: history, intent: intent);
      setState(() {
        _turns.add(_Turn('assistant', r.reply,
            drafts: r.drafts,
            id: r.messageId,
            kind: r.taskQueued ? 'task_ack' : 'chat',
            taskId: r.taskId));
        _thinking = false;
      });
      _saveHistory();
      _markRead(); // the server stored this turn as unread; we just showed it
      // The ack card's steps + ETA live in the turn the server just wrote, not in
      // the chat response — re-hydrate so the card renders whole rather than bare.
      if (r.taskQueued) {
        await _loadHistory();
        // Also covers a re-hydrate that failed and left only the local ack turn.
        _syncTaskPoll();
      }
    } catch (e) {
      AppLogger.instance.error(e, screen: 'advisor', action: 'run_advisor');
      final err = e.toString();
      final msg = (err.contains('404'))
          ? 'Sorry, $_name is temporarily unavailable. Please try again later.'
          : (err.contains('timeout') || err.contains('SocketException') || err.contains('DioException'))
              ? 'No internet connection. Please check your network and try again.'
              : 'Something went wrong. Please try again.';
      setState(() {
        _turns.add(_Turn('assistant', '⚠️ $msg'));
        _thinking = false;
      });
    }
    _scrollToBottom();
  }

  Future<void> _sendDraft(AdvisorDraft d) async {
    try {
      await sendMessage(d.matchId, d.content);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Sent to ${d.matchName} 💬')));
    } catch (e) {
      AppLogger.instance.error(e, screen: 'advisor', action: 'send_draft');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _feedback(_Turn t, bool positive) async {
    setState(() => t.feedback = positive ? 1 : -1);
    try {
      if (t.isGreeting && t.greetingId != null && t.greetingId!.isNotEmpty) {
        await submitGreetingFeedback(t.greetingId!, positive ? 1 : -1);
      } else {
        await submitMessageFeedback(wingman: _wm, messageContent: t.content, positive: positive);
      }
    } catch (_) {
      AppLogger.instance.error('submit_feedback failed', screen: 'advisor', action: 'submit_feedback');
      /* non-fatal */
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _taskPoll?.cancel();
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visibleTurns;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: Row(children: [
          Text(_wm ? '🛡️ ' : '💚 ', style: const TextStyle(fontSize: 18)),
          Text(_name, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
        ]),
      ),
      body: Column(children: [
        // Pinned, not a message: it sits OUTSIDE the ListView so it cannot scroll
        // away behind the thread. The whole point of this surface is the next
        // move, and it should still be on screen after twenty turns of chat.
        if (_portfolio != null) PortfolioCard(p: _portfolio!, onOpen: _openProof),
        Expanded(
          child: visible.isEmpty && !_thinking
              ? _Intro(wingman: _wm)
              : ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.all(12),
                  itemCount: visible.length + (_thinking ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i >= visible.length) return const _Thinking();
                    final t = visible[i];
                    if (t.kind == 'task_ack') return _TaskAckCard(turn: t);
                    if (t.kind == 'task_result') {
                      return _TaskResultCard(turn: t, onFeedback: _feedback);
                    }
                    return _Bubble(turn: t, onSendDraft: _sendDraft, onFeedback: _feedback);
                  },
                ),
        ),
        // Quick-action chips
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: [
              for (final c in _chips)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    label: Text(c.label, style: TextStyle(color: Brand.accent, fontSize: 13)),
                    backgroundColor: Brand.accentAlpha(0x22),
                    side: BorderSide(color: Brand.accentAlpha(0x4D)),
                    onPressed: _thinking ? null : () => _chip(c.intent, c.label),
                  ),
                ),
            ],
          ),
        ),
        _composerBar(),
      ]),
    );
  }

  Widget _composerBar() => Container(
        color: const Color(Config.bg2),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
            child: Row(children: [
            Expanded(
              child: TextField(
                controller: _composer,
                style: const TextStyle(color: Color(Config.text1)),
                minLines: 1,
                maxLines: 4,
                maxLength: 1000,
                buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(
                  hintText: 'Ask $_name…',
                  hintStyle: const TextStyle(color: Color(Config.text3)),
                  filled: true,
                  fillColor: const Color(Config.bg3),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _send,
              child: CircleAvatar(
                radius: 22,
                backgroundColor: Brand.accent,
                child: Icon(Icons.arrow_upward, color: Color(0xFFFFFFFF)),
              ),
            ),
          ]),
          ),
        ),
      );
}

class _Intro extends StatelessWidget {
  final bool wingman;
  const _Intro({required this.wingman});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Text(
          wingman
              ? 'Your Wingman reads your matches and helps you make the right move. Ask anything, or tap a shortcut below.'
              : 'Your Bestie has your back — match reads, tips, and drafts. Ask anything, or tap a shortcut below.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(Config.text2), fontSize: 15, height: 1.4),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final _Turn turn;
  final void Function(AdvisorDraft) onSendDraft;
  final void Function(_Turn, bool) onFeedback;
  const _Bubble({required this.turn, required this.onSendDraft, required this.onFeedback});

  @override
  Widget build(BuildContext context) {
    final mine = turn.role == 'user';
    final greeting = turn.isGreeting;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
        decoration: BoxDecoration(
          color: mine ? Brand.accent : const Color(Config.bg3),
          borderRadius: BorderRadius.circular(16),
          border: greeting ? Border.all(color: Brand.accentAlpha(0x4D)) : null,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (greeting)
            Padding(
              padding: EdgeInsets.only(bottom: 4),
              child: Text('👋 A note for you',
                  style: TextStyle(color: Brand.accent, fontSize: 11, fontWeight: FontWeight.w700)),
            ),
          mine
              ? Text(turn.content, style: const TextStyle(color: Color(0xFFFFFFFF), fontSize: 15, height: 1.35))
              : buildMarkdown(turn.content, color: const Color(Config.text1)),
          for (final d in turn.drafts) _DraftCard(draft: d, onSend: () => onSendDraft(d)),
          if (!mine) _Feedback(turn: turn, onFeedback: onFeedback),
        ]),
      ),
    );
  }
}

class _DraftCard extends StatelessWidget {
  final AdvisorDraft draft;
  final VoidCallback onSend;
  const _DraftCard({required this.draft, required this.onSend});
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x221B1020)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Draft for ${draft.matchName}',
            style: const TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Text(draft.content, style: const TextStyle(color: Color(Config.text1), fontSize: 14, height: 1.3)),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: draft.matchId.isEmpty ? null : onSend,
            style: FilledButton.styleFrom(
              backgroundColor: Brand.accent,
              foregroundColor: const Color(0xFFFFFFFF),
              visualDensity: VisualDensity.compact,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Send', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ]),
    );
  }
}

// ── Async task cards ────────────────────────────────────────────────────────
// Task-shaped asks ("help me get matches", "audit my profile") queue real work
// server-side: an ack turn lands immediately and the cron writes the answer back
// into the thread later. Both arrive as ordinary hydrated turns, distinguished
// only by `kind`, so they get their own card shapes rather than plain bubbles.

/// Shared shell: left accent stripe + white card. IntrinsicHeight is what lets a
/// 4px stripe match the card's height inside a vertically unbounded list.
class _StripeCard extends StatelessWidget {
  final Color stripe;
  final List<Widget> children;
  const _StripeCard({required this.stripe, required this.children});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.92),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x221B1020)),
        ),
        child: IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(width: 4, color: stripe),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: children,
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// "Working on it" — the task was accepted and the answer lands later.
///
/// The step ticks are static: first done, second running, the rest queued. The
/// server does not report per-step progress yet, and for a ~2 minute task that
/// read is honest enough while staying truthful about the order of the work.
class _TaskAckCard extends StatelessWidget {
  final _Turn turn;
  const _TaskAckCard({required this.turn});

  @override
  Widget build(BuildContext context) {
    const amber = Color(Config.warn);
    // Respect the OS reduce-motion setting — an indefinite spinner is exactly the
    // thing that switch exists to stop.
    final still = MediaQuery.of(context).disableAnimations;
    final steps = turn.steps;
    final eta = turn.etaMinutes;
    return _StripeCard(stripe: amber, children: [
      Row(children: [
        SizedBox(
          width: 14,
          height: 14,
          child: still
              ? const Icon(Icons.hourglass_top_rounded, size: 14, color: amber)
              : const CircularProgressIndicator(strokeWidth: 2, color: amber),
        ),
        const SizedBox(width: 8),
        Text('Working on it — about $eta ${eta == 1 ? 'minute' : 'minutes'}',
            style: const TextStyle(color: amber, fontSize: 12, fontWeight: FontWeight.w700)),
      ]),
      const SizedBox(height: 8),
      buildMarkdown(turn.content, color: const Color(Config.text1)),
      // Steps are absent on the turn the chat response hands back; they arrive with
      // the next hydration, so the card has to read fine without them.
      for (var i = 0; i < steps.length; i++) _step(steps[i], i),
    ]);
  }

  Widget _step(String label, int i) {
    final (IconData icon, int color, FontWeight weight) = i == 0
        ? (Icons.check_circle, Config.success, FontWeight.w500)
        : i == 1
            ? (Icons.autorenew, Config.warn, FontWeight.w600)
            : (Icons.circle_outlined, Config.text3, FontWeight.w400);
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 15, color: Color(color)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(label,
              style: TextStyle(
                color: Color(i > 1 ? Config.text3 : Config.text2),
                fontSize: 13,
                fontWeight: weight,
              )),
        ),
      ]),
    );
  }
}

/// The finished answer. Green stripe when it delivered; muted when the runner gave
/// up after its retries — an apology should not wear a success colour.
class _TaskResultCard extends StatelessWidget {
  final _Turn turn;
  final void Function(_Turn, bool) onFeedback;
  const _TaskResultCard({required this.turn, required this.onFeedback});

  String get _headline => turn.taskFailed
      ? "That one didn't finish"
      : turn.taskKind == 'profile_audit'
          ? 'Your profile audit is ready'
          : '📊 Your match scan is ready';

  @override
  Widget build(BuildContext context) {
    final stripe = Color(turn.taskFailed ? Config.text3 : Config.success);
    return _StripeCard(stripe: stripe, children: [
      Text(_headline, style: TextStyle(color: stripe, fontSize: 13, fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      // content already carries the summary + numbered action list as markdown.
      buildMarkdown(turn.content, color: const Color(Config.text1)),
      _Feedback(turn: turn, onFeedback: onFeedback),
    ]);
  }
}

class _Feedback extends StatelessWidget {
  final _Turn turn;
  final void Function(_Turn, bool) onFeedback;
  const _Feedback({required this.turn, required this.onFeedback});
  @override
  Widget build(BuildContext context) {
    if (turn.feedback != 0) {
      return Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(turn.feedback > 0 ? 'Thanks 👍' : 'Noted 🙏',
            style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        GestureDetector(
          onTap: () => onFeedback(turn, true),
          child: const Icon(Icons.thumb_up_outlined, size: 16, color: Color(Config.text3)),
        ),
        const SizedBox(width: 16),
        GestureDetector(
          onTap: () => onFeedback(turn, false),
          child: const Icon(Icons.thumb_down_outlined, size: 16, color: Color(Config.text3)),
        ),
      ]),
    );
  }
}

// ── Pinned Trust & Boost portfolio card ─────────────────────────────────────
// The median member has proven ZERO optional categories, so the advisor thread
// leads with the portfolio rather than waiting to be asked about it. Pinned
// above the ListView: progress, per-category chips, and the one highest-value
// next move with its absolute payoff.

/// One proof category as the card labels it. Mirrors
/// src/lib/verified-vibe/proof-categories.ts — the server's source of truth for
/// ids and labels — so a chip never disagrees with the payload it renders.
class _ProofCat {
  final String id;
  final String emoji;
  final String label;
  /// Every dimension this proof evidences is a money dimension. These may be
  /// shown as verification only, NEVER as an appeal or standing gain (App Store
  /// guideline 1.1.4). The server already keeps them out of `actions`; this flag
  /// is the client-side belt to that braces.
  final bool money;
  const _ProofCat(this.id, this.emoji, this.label, {this.money = false});
}

/// Catalog order is the server's ask-priority order: lowest friction and highest
/// leverage first, ID-gated document categories trailing.
const _proofCats = <_ProofCat>[
  _ProofCat('linkedin', '💼', 'Career'),
  _ProofCat('discipline', '💪', 'Fitness'),
  _ProofCat('travel', '✈️', 'Travel'),
  _ProofCat('lifestyle', '🌍', 'Lifestyle'),
  _ProofCat('social_proof', '🤝', 'Social life'),
  _ProofCat('hosting', '🍽️', 'Hosting'),
  _ProofCat('intro', '🎙️', 'Intro video'),
  _ProofCat('instagram', '📸', 'Instagram'),
  _ProofCat('habit_tracker', '📈', 'Habits'),
  _ProofCat('twitter', '🐦', 'X / Twitter'),
  _ProofCat('assets', '🚗', 'Assets', money: true),
  _ProofCat('wealth', '🏦', 'Financial', money: true),
  _ProofCat('spending', '🧾', 'Spending', money: true),
];

_ProofCat? _proofCat(String id) {
  for (final c in _proofCats) {
    if (c.id == id) return c;
  }
  return null;
}

bool _isMoneyCat(String id) => _proofCat(id)?.money ?? false;

/// Whole numbers stay whole ("+5"), fractions keep one place ("+0.5"). Values are
/// printed as the server computed them — never rounded into a nicer story.
String _fmtNum(num n) {
  final d = n.toDouble();
  return d == d.roundToDouble() ? d.toInt().toString() : d.toStringAsFixed(1);
}

/// Public (unlike the other cards in this file) so the App Store 1.1.4 money rule
/// can be pinned down by a widget test — see test/portfolio_card_test.dart. That
/// rule is not a preference, so it gets a guard rather than a comment.
class PortfolioCard extends StatefulWidget {
  final AdvisorPortfolio p;
  final void Function(String categoryId) onOpen;
  const PortfolioCard({super.key, required this.p, required this.onOpen});

  /// Shared with the web card (localStorage) by name only — the two stores never
  /// sync, but keeping one key means one concept to reason about.
  static const String openKey = 'vv_trust_boost_card_open';

  @override
  State<PortfolioCard> createState() => _PortfolioCardState();
}

class _PortfolioCardState extends State<PortfolioCard> {
  /// Expanded until the member says otherwise: the card has to be discovered
  /// before it can be dismissed, and a first-run collapse would hide the entire
  /// point of the surface. Only a stored '0' collapses it — same rule as the web
  /// card, so the two platforms behave identically.
  bool _open = true;

  AdvisorPortfolio get p => widget.p;
  void Function(String categoryId) get onOpen => widget.onOpen;

  @override
  void initState() {
    super.initState();
    _restoreOpen();
  }

  Future<void> _restoreOpen() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      if (prefs.getString(PortfolioCard.openKey) == '0') setState(() => _open = false);
    } catch (_) {
      /* non-fatal — the card just stays open */
    }
  }

  Future<void> _toggle() async {
    setState(() => _open = !_open);
    AppLogger.instance
        .action('advisor', 'toggle_portfolio_card', meta: {'open': _open.toString()});
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(PortfolioCard.openKey, _open ? '1' : '0');
    } catch (_) {
      /* non-fatal — it just will not stick */
    }
  }

  /// Completed ids, normalised: callers upstream carry both bare ids (`travel`)
  /// and verification steps (`proof_travel`).
  Set<String> get _done => {
        for (final c in p.completed)
          c.startsWith('proof_') ? c.substring(6) : c,
      };

  @override
  Widget build(BuildContext context) {
    final top = p.topAction;
    return Container(
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        border: Border(bottom: BorderSide(color: Brand.accentAlpha(0x22))),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(14, 10, 14, _open ? 12 : 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Header + meter stay put when collapsed: the count and the bar are the
          // glanceable part, and on a real phone the rest was eating a third of
          // the screen and pushing the conversation off.
          _header(),
          const SizedBox(height: 8),
          _meter(),
          if (_open) ...[
            if ((p.band ?? '').isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(_bandLine(), style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
            ],
            const SizedBox(height: 10),
            _chips(top?.id),
            if (top != null) ...[
              const SizedBox(height: 10),
              _nextMove(top),
            ],
          ],
        ]),
      ),
    );
  }

  /// The whole header row is the tap target — a bare chevron is a hard thing to
  /// hit on a phone.
  Widget _header() => GestureDetector(
        onTap: _toggle,
        behavior: HitTestBehavior.opaque,
        child: Semantics(
          button: true,
          label: _open ? 'Collapse proof portfolio' : 'Expand proof portfolio',
          child: Row(children: [
            const Text('🛡', style: TextStyle(fontSize: 13)),
            const SizedBox(width: 6),
            const Expanded(
              child: Text('YOUR PROOF PORTFOLIO',
                  style: TextStyle(
                      color: Color(Config.text2),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8)),
            ),
            // "proofs", not "proven": the header counts categories and the band
            // line counts Profile Strength points, so both have to name their unit.
            Text('${p.done} of ${p.total} proofs',
                style:
                    TextStyle(color: Brand.accentBright, fontSize: 13, fontWeight: FontWeight.w800)),
            Icon(_open ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                size: 20, color: const Color(Config.text3)),
          ]),
        ),
      );

  /// Zero looks like zero — no minimum sliver. A hairline of fill at `0 of 13`
  /// reads as "something is already done", which is the opposite of true.
  Widget _meter() => ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: LinearProgressIndicator(
          value: p.fraction,
          minHeight: 7,
          backgroundColor: Brand.accentAlpha(0x28),
          color: Brand.accent,
        ),
      );

  /// The number here is Profile Strength POINTS; the header two lines up counts
  /// PROOF CATEGORIES. At `0 of 13 proofs` above and a 13-point gap below, the old
  /// wording ("13 to go") read as "13 more proofs to upload" — wrong, and
  /// discouraging in exactly the place we are trying to encourage. Both lines now
  /// name their unit, so the same figure can never be misread as the other one.
  String _bandLine() {
    final band = p.band ?? '';
    final next = p.nextBand;
    final pts = p.pointsToNextBand;
    if (next == null || next.isEmpty || pts == null) return band;
    final n = _fmtNum(pts);
    return '$band - $n ${n == '1' ? 'point' : 'points'} to "$next"';
  }

  /// One horizontal row rather than a wrap: the card is pinned, so its height has
  /// to stay bounded no matter how many categories exist. The highlighted next
  /// move leads so it is always in view without scrolling.
  Widget _chips(String? topId) {
    final done = _done;
    final ordered = <String>[
      if (topId != null && topId.isNotEmpty) topId,
      for (final c in _proofCats)
        if (c.id != topId && done.contains(c.id)) c.id,
      // Anything the server counts that this catalog does not know (e.g. photos)
      // still shows as earned rather than silently vanishing.
      for (final id in done)
        if (id != topId && _proofCat(id) == null) id,
      for (final c in _proofCats)
        if (c.id != topId && !done.contains(c.id)) c.id,
    ];
    return SizedBox(
      height: 30,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final id in ordered)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: _chip(id, isTop: id == topId, isDone: done.contains(id)),
            ),
        ],
      ),
    );
  }

  Widget _chip(String id, {required bool isTop, required bool isDone}) {
    final cat = _proofCat(id);
    final label = cat?.label ?? _humanise(id);
    final (Color bg, Color border, Color fg) = isTop
        ? (Brand.accent, Brand.accent, const Color(0xFFFFFFFF))
        : isDone
            ? (const Color(0x1410B981), const Color(0x4010B981), const Color(Config.text2))
            : (const Color(Config.bg3), const Color(0x141B1020), const Color(Config.text3));
    return GestureDetector(
      onTap: () => onOpen(id),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: border),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (isDone)
            const Padding(
              padding: EdgeInsets.only(right: 4),
              child: Icon(Icons.check_rounded, size: 13, color: Color(Config.success)),
            )
          else if (cat != null)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Text(cat.emoji, style: const TextStyle(fontSize: 11)),
            ),
          Text(label,
              style: TextStyle(
                  color: fg, fontSize: 12, fontWeight: isTop ? FontWeight.w700 : FontWeight.w500)),
        ]),
      ),
    );
  }

  /// 'social_proof' -> 'Social proof', for ids this build does not know about.
  String _humanise(String id) {
    final words = id.replaceAll('_', ' ');
    return words.isEmpty ? id : '${words[0].toUpperCase()}${words.substring(1)}';
  }

  /// The single highest-value move. Money categories get verification language and
  /// no payoff numbers at all; everything else states the server's absolute
  /// figures plainly.
  Widget _nextMove(PortfolioAction a) {
    final money = _isMoneyCat(a.id);
    final label = a.label.isEmpty ? (_proofCat(a.id)?.label ?? 'your next proof') : a.label;
    return GestureDetector(
      onTap: () => onOpen(a.id),
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
        decoration: BoxDecoration(
          color: Brand.accentTint,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Brand.accentAlpha(0x33)),
        ),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(money ? 'Next: verify ${label.toLowerCase()}' : 'Next: add ${label.toLowerCase()}',
                  style: const TextStyle(
                      color: Color(Config.text1), fontSize: 14.5, fontWeight: FontWeight.w700)),
              const SizedBox(height: 3),
              if (money)
                // No gain, no delta, no named match. Verification framing only.
                const Text('Confirms you are real. It does not change how appealing you look.',
                    style: TextStyle(color: Color(Config.text2), fontSize: 12.5, height: 1.35))
              else ...[
                Text(_payoffLine(a),
                    style: const TextStyle(color: Color(Config.text2), fontSize: 12.5, height: 1.35)),
                if (a.appealGains.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: _appealLine(a.appealGains),
                  )
                else if (a.matchesHelped > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(_matchesLine(a.matchesHelped),
                        style: const TextStyle(color: Color(Config.text2), fontSize: 12.5)),
                  ),
              ],
              if (a.askPhrase.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(a.askPhrase,
                      style: const TextStyle(color: Color(Config.text3), fontSize: 11.5, height: 1.3)),
                ),
            ]),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(color: Brand.accent, borderRadius: BorderRadius.circular(999)),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Text('Add proof',
                  style: TextStyle(color: Color(0xFFFFFFFF), fontSize: 12.5, fontWeight: FontWeight.w700)),
              SizedBox(width: 2),
              Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFFFFFFFF)),
            ]),
          ),
        ]),
      ),
    );
  }

  /// Fallback when the server gave a match count but no names to attach it to.
  String _matchesLine(int n) =>
      n == 1 ? 'Helps with 1 of your matches' : 'Helps with $n of your matches';

  /// deltaPS is absolute, and crossing a band is the strongest thing we can
  /// truthfully say about it.
  String _payoffLine(PortfolioAction a) {
    final delta = '+${_fmtNum(a.deltaPS)} profile strength';
    final after = a.bandAfter;
    if (a.crossesBand && after != null && after.isNotEmpty) {
      return '$delta - moves you up to "$after"';
    }
    return delta;
  }

  /// "Lifts you with Aisha +3.2" — the named match in bold. Caps at two names so
  /// the pinned card cannot grow a list.
  Widget _appealLine(List<PortfolioAppealGain> gains) {
    final shown = gains.length > 2 ? gains.sublist(0, 2) : gains;
    const base = TextStyle(color: Color(Config.text2), fontSize: 12.5, height: 1.35);
    final spans = <TextSpan>[const TextSpan(text: 'Lifts you with ')];
    for (var i = 0; i < shown.length; i++) {
      if (i > 0) spans.add(const TextSpan(text: ' and '));
      spans.add(TextSpan(
          text: shown[i].name,
          style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)));
      spans.add(TextSpan(text: ' +${_fmtNum(shown[i].delta)}'));
    }
    return RichText(text: TextSpan(style: base, children: spans));
  }
}

class _Thinking extends StatelessWidget {
  const _Thinking();
  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: EdgeInsets.all(12),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Brand.accent)),
          SizedBox(width: 10),
          Text('thinking…', style: TextStyle(color: Color(Config.text2))),
        ]),
      ),
    );
  }
}
