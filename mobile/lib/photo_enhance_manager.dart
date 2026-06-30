import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'api.dart';
import 'app_logger.dart';

/// Status of the background AI photo-enhancement run.
enum EnhanceStatus { idle, running, success, failed }

/// App-lifetime background service that owns AI photo generation for the
/// signed-in man. It deliberately lives OUTSIDE the profile widget tree so a run
/// survives scrolling, tab switches, and navigation — it only dies when the app
/// process is killed (per product spec: "within running app only").
///
/// State machine (see the photo-story flow):
///  • On a saved photo change  → idle: start · running: cancel+restart · finished: ignore.
///  • On the Regenerate button → always cancel any run and start fresh.
///  • Success requires the FULL set of 3 photos; a partial result is a failure
///    (all-or-nothing) and nothing is written to the profile.
///  • A failed/cancelled run never touches the profile (the man's raw photo is
///    never promoted to a viewer-facing image).
class PhotoEnhanceManager extends ChangeNotifier {
  PhotoEnhanceManager._();
  static final PhotoEnhanceManager instance = PhotoEnhanceManager._();

  /// How many photos a complete run must produce (lead / warmth / lifestyle).
  static const _expectedCount = 3;

  EnhanceStatus _status = EnhanceStatus.idle;
  String? _error;
  String? _userId;

  // Each run gets a monotonic id; a stale run (superseded by a newer start)
  // never commits its result. The CancelToken aborts the in-flight HTTP work.
  int _epoch = 0;
  CancelToken? _cancelToken;

  EnhanceStatus get status => _status;
  String? get error => _error;
  bool get isRunning => _status == EnhanceStatus.running;

  /// Scope state to the active user so a previous account's run/result can't
  /// leak after a logout→login. Resets to idle when the user changes.
  void bindUser(String? userId) {
    if (_userId == userId) return;
    _userId = userId;
    _cancelToken?.cancel('user-changed');
    _cancelToken = null;
    _epoch++; // orphan any in-flight run
    _status = EnhanceStatus.idle;
    _error = null;
    notifyListeners();
  }

  /// Called after the user saves a photo change. Honors the state machine:
  /// only the first run (idle) auto-starts; a run in progress restarts with the
  /// latest photos; a finished run is left alone (needs the Regenerate button).
  void onPhotosSaved({required List<String> referenceUrls, required String archetype}) {
    if (_status == EnhanceStatus.success || _status == EnhanceStatus.failed) return;
    _start(referenceUrls: referenceUrls, archetype: archetype);
  }

  /// Regenerate button — the manual escape hatch. Always cancels any in-flight
  /// run and starts a fresh one, regardless of current state.
  void regenerate({required List<String> referenceUrls, required String archetype}) {
    _start(referenceUrls: referenceUrls, archetype: archetype);
  }

  void _start({required List<String> referenceUrls, required String archetype}) {
    if (referenceUrls.isEmpty) return;
    _cancelToken?.cancel('superseded');
    final token = CancelToken();
    _cancelToken = token;
    final myEpoch = ++_epoch;
    _status = EnhanceStatus.running;
    _error = null;
    notifyListeners();
    _run(referenceUrls, archetype, myEpoch, token);
  }

  Future<void> _run(List<String> referenceUrls, String archetype, int myEpoch, CancelToken token) async {
    try {
      final items = await enhancePhotos(referenceUrls, archetype: archetype, cancelToken: token);
      if (myEpoch != _epoch) return; // superseded by a newer run — drop result
      // All-or-nothing: a partial set is treated as a failure and not saved.
      if (items.length < _expectedCount) {
        throw 'Incomplete generation (${items.length}/$_expectedCount)';
      }
      await saveAiPhotos(items);
      if (myEpoch != _epoch) return;
      _status = EnhanceStatus.success;
      _error = null;
      notifyListeners();
    } catch (e) {
      // A cancel (restart) or a superseded run must stay quiet — it's not a
      // failure the user should see, and it must not clobber the newer run.
      if (myEpoch != _epoch || token.isCancelled) return;
      AppLogger.instance.error(e, screen: 'profile', action: 'enhance_photos');
      _status = EnhanceStatus.failed;
      // NOTE: raw message kept on purpose during the testing period.
      _error = "Couldn't enhance: $e";
      notifyListeners();
    }
  }
}
