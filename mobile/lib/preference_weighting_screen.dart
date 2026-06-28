import 'package:flutter/material.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';

/// Explicit preference-weighting step (Scoring & Matching redesign §6a, Phase 0b).
/// The user rates how much each value dimension matters to them in a partner;
/// the backend normalises these into preference weights w (Σ=1) used by the
/// two-sided appeal model. Reachable from Settings (so existing users can tune)
/// and intended as a lightweight onboarding step for new users.
///
/// Kept in lockstep with the web equivalent (/verified-vibe/settings/preferences)
/// and the shared taxonomy (src/lib/verified-vibe/dimensions.ts), which is the
/// source the backend serves.
class PreferenceWeightingScreen extends StatefulWidget {
  /// Called after a successful save (e.g. advance onboarding or pop).
  final VoidCallback? onSaved;
  /// When provided (onboarding context), shows a "Skip for now" action so the
  /// step is never a trap. Defaults to null (Settings context — no skip).
  final VoidCallback? onSkip;
  const PreferenceWeightingScreen({super.key, this.onSaved, this.onSkip});

  @override
  State<PreferenceWeightingScreen> createState() => _PreferenceWeightingScreenState();
}

class _PreferenceWeightingScreenState extends State<PreferenceWeightingScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<PreferenceDimension> _dims = [];
  Map<String, int> _importance = {};
  int _max = 5;
  String? _source;

  static const _labels = ['Skip', 'Low', 'Some', 'Matters', 'A lot', 'Must-have'];

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('preference_weighting');
    _load();
  }

  Future<void> _load() async {
    try {
      final p = await fetchPreferenceWeights();
      if (!mounted) return;
      setState(() {
        _dims = p.dimensions;
        _importance = Map<String, int>.from(p.importance);
        _max = p.maxImportance;
        _source = p.weightsSource;
        _loading = false;
      });
    } catch (e) {
      AppLogger.instance.error(e, screen: 'prefer_weighting', action: 'load_preferences');
      if (mounted) setState(() { _error = 'Could not load: $e'; _loading = false; });
    }
  }

  Future<void> _save() async {
    if (_saving) return;
    AppLogger.instance.action('preference_weighting', 'save_weights');
    setState(() { _saving = true; _error = null; });
    try {
      await savePreferenceWeights(_importance);
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved — your matches will weight what matters to you.')),
      );
      widget.onSaved?.call();
      if (widget.onSaved == null && Navigator.canPop(context)) Navigator.of(context).pop(true);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'prefer_weighting', action: 'save_preferences');
      if (mounted) setState(() { _saving = false; _error = 'Could not save: $e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final open = _dims.where((d) => d.cls == 'open').toList();
    final sensitive = _dims.where((d) => d.cls == 'sensitive').toList();
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('What you value',
            style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
        automaticallyImplyLeading: widget.onSkip == null,
        actions: [
          if (widget.onSkip != null)
            TextButton(
              onPressed: () {
                AppLogger.instance.action('preference_weighting', 'skip_onboarding');
                widget.onSkip!.call();
              },
              child: const Text('Skip for now', style: TextStyle(color: Color(Config.text2))),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(Config.accent)))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                const Text(
                  'Tell us what matters most to you in a match. We weight your matches by what YOU value — the same person ranks differently for different people.',
                  style: TextStyle(color: Color(Config.text2), fontSize: 14, height: 1.5),
                ),
                if (_source == 'explicit') ...[
                  const SizedBox(height: 10),
                  _pill('✓ You\'ve set these — tweak anytime'),
                ],
                const SizedBox(height: 20),
                _sectionLabel('WHAT YOU VALUE IN A PARTNER'),
                for (final d in open) _dimRow(d),
                if (sensitive.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  _sectionLabel('PERSONAL PREFERENCES'),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(4, 0, 4, 8),
                    child: Text(
                      'Optional, and personal — these shape who you see but never your own standing.',
                      style: TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.4),
                    ),
                  ),
                  for (final d in sensitive) _dimRow(d),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
                ],
                const SizedBox(height: 24),
                SizedBox(
                  height: 54,
                  child: FilledButton(
                    onPressed: _saving ? null : _save,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(Config.accent),
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: const Color(Config.bg3),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(50)),
                      elevation: 0,
                    ),
                    child: _saving
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Save what matters', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _pill(String t) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(color: const Color(Config.accentTint), borderRadius: BorderRadius.circular(999)),
        child: Text(t, style: const TextStyle(color: Color(Config.accentBright), fontSize: 12, fontWeight: FontWeight.w600)),
      );

  Widget _sectionLabel(String t) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
        child: Text(t, style: const TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
      );

  Widget _dimRow(PreferenceDimension d) {
    final v = _importance[d.id] ?? 2;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x181B1020)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(d.label, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(d.blurb, style: const TextStyle(color: Color(Config.text3), fontSize: 12, height: 1.35)),
                ]),
              ),
              const SizedBox(width: 10),
              Text(
                _labels[v.clamp(0, _labels.length - 1)],
                style: const TextStyle(color: Color(Config.accentBright), fontSize: 12, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: const Color(Config.accent),
              inactiveTrackColor: const Color(Config.bg3),
              thumbColor: const Color(Config.accent),
              overlayColor: const Color(Config.accentTint),
              trackHeight: 4,
            ),
            child: Slider(
              value: v.toDouble(),
              min: 0,
              max: _max.toDouble(),
              divisions: _max,
              onChanged: (nv) => setState(() => _importance[d.id] = nv.round()),
            ),
          ),
        ],
      ),
    );
  }
}
