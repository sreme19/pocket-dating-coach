import 'package:flutter/material.dart';
import 'app_logger.dart';
import 'config.dart';
import 'discover_screen.dart';
import 'chat_list_screen.dart';
import 'profile_screen.dart';
import 'push_service.dart';

/// Authenticated app shell: bottom navigation between Discover and Profile.
/// IndexedStack keeps each screen's state alive across tab switches.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('home');
    // Let push deep-links switch the active tab (e.g. Wingman → Chat).
    PushService.onSwitchTab = (i) {
      if (mounted && i >= 0 && i < 3) setState(() => _index = i);
    };
    // Authenticated + in the app — request push permission + register FCM token.
    PushService.registerForUser();
  }

  @override
  void dispose() {
    PushService.onSwitchTab = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [DiscoverScreen(), ChatListScreen(), ProfileScreen()],
      ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: const Color(Config.bg2),
        indicatorColor: const Color(0x26FF3B6B),
        selectedIndex: _index,
        onDestinationSelected: (i) {
          AppLogger.instance.action('home', 'switch_tab', meta: {'tab': i});
          setState(() => _index = i);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined, color: Color(Config.text3)),
            selectedIcon: Icon(Icons.explore, color: Color(Config.accent)),
            label: 'Discover',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline, color: Color(Config.text3)),
            selectedIcon: Icon(Icons.chat_bubble, color: Color(Config.accent)),
            label: 'Chat',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline, color: Color(Config.text3)),
            selectedIcon: Icon(Icons.person, color: Color(Config.accent)),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
