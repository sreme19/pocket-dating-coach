import 'dart:async' show unawaited;

import 'package:flutter/material.dart';
import 'aibestie_claim.dart';
import 'app_logger.dart';
import 'config.dart';
import 'season.dart';
import 'discover_screen.dart';
import 'chat_list_screen.dart';
import 'profile_screen.dart';
import 'push_service.dart';

class _ChatIcon extends StatelessWidget {
  final int unread;
  final bool selected;
  const _ChatIcon({required this.unread, required this.selected});

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(
          selected ? Icons.chat_bubble : Icons.chat_bubble_outline,
          color: selected ? Brand.accent : const Color(Config.text3),
        ),
        if (unread > 0)
          Positioned(
            top: -4,
            right: -6,
            child: Container(
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: Brand.accent,
                borderRadius: BorderRadius.circular(999),
              ),
              alignment: Alignment.center,
              child: Text(
                unread > 99 ? '99+' : '$unread',
                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700, height: 1),
              ),
            ),
          ),
      ],
    );
  }
}

/// Authenticated app shell: bottom navigation between Discover and Profile.
/// IndexedStack keeps each screen's state alive across tab switches.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  /// Which tab is actually on screen (0 Discover, 1 Chat, 2 Profile).
  ///
  /// IndexedStack keeps every tab BUILT and alive, and all three share one
  /// ModalRoute — so a screen cannot tell whether it is visible by asking
  /// `ModalRoute.of(context)!.isCurrent`, which is true for all of them at once.
  /// The chat list relied on exactly that check before showing its hand-off
  /// modal, which is why the modal appeared on top of Discover.
  static final ValueNotifier<int> visibleTab = ValueNotifier<int>(0);

  /// Index of the Chat tab, so callers do not hard-code the magic number.
  static const int chatTabIndex = 1;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  void _setIndex(int i) {
    setState(() => _index = i);
    HomeShell.visibleTab.value = i;
  }

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('home');
    // Load the user's season (cache-first, then reconcile with the backend).
    SeasonState.hydrate();
    // Let push deep-links switch the active tab (e.g. Wingman → Chat).
    PushService.onSwitchTab = (i) {
      if (mounted && i >= 0 && i < 3) _setIndex(i);
    };
    // Authenticated + in the app — request push permission + register FCM token.
    PushService.registerForUser();
    // The retry for a landing-page conversation whose claim could not go through
    // during onboarding — no network, a session not yet settled. Only failures
    // that a later attempt could actually fix leave a code behind, so this is a
    // prefs read and nothing more for everyone else.
    unawaited(claimPendingConversation().catchError((Object e) {
      AppLogger.instance.error(e, screen: 'home', action: 'aibestie_claim');
      return null;
    }));
  }

  @override
  void dispose() {
    PushService.onSwitchTab = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: SeasonState.networking,
      builder: (context, networking, __) {
        final accent = Brand.accent;
        return Scaffold(
          body: IndexedStack(
            index: _index,
            children: const [DiscoverScreen(), ChatListScreen(), ProfileScreen()],
          ),
          // Season banner sits directly above the bottom nav so it spans every
          // tab without touching each screen's own AppBar/insets. Hidden in date
          // mode → the bottom bar is byte-for-byte the original there.
          bottomNavigationBar: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (networking)
                Material(
                  color: Brand.accentTint,
                  child: InkWell(
                    onTap: () {
                      AppLogger.instance.action('home', 'season_banner_tap');
                      _setIndex(0); // jump to Discover to flip back
                    },
                    child: SizedBox(
                      width: double.infinity,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text('🌱', style: TextStyle(fontSize: 13)),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                'Networking season · no dating pressure',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Brand.accentBright,
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              NavigationBar(
                backgroundColor: const Color(Config.bg2),
                indicatorColor: Brand.navIndicator,
                selectedIndex: _index,
                onDestinationSelected: (i) {
                  AppLogger.instance.action('home', 'switch_tab', meta: {'tab': i});
                  _setIndex(i);
                },
                destinations: [
                  NavigationDestination(
                    icon: const Icon(Icons.explore_outlined, color: Color(Config.text3)),
                    selectedIcon: Icon(Icons.explore, color: accent),
                    label: 'Discover',
                  ),
                  NavigationDestination(
                    icon: ValueListenableBuilder<int>(
                      valueListenable: ChatListScreen.unreadNotifier,
                      builder: (_, count, __) => _ChatIcon(unread: count, selected: false),
                    ),
                    selectedIcon: ValueListenableBuilder<int>(
                      valueListenable: ChatListScreen.unreadNotifier,
                      builder: (_, count, __) => _ChatIcon(unread: count, selected: true),
                    ),
                    label: 'Chat',
                  ),
                  NavigationDestination(
                    icon: const Icon(Icons.person_outline, color: Color(Config.text3)),
                    selectedIcon: Icon(Icons.person, color: accent),
                    label: 'Profile',
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
