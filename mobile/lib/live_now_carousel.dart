import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'config.dart';

class _Live {
  final String name;
  final int age;
  final String photo; // relative path under the web public dir
  final bool online;
  final String lastActive;
  const _Live(this.name, this.age, this.photo, this.online, this.lastActive);
}

// Seed social-proof profiles (mirror LiveWomenCarousel.svelte). Photos are
// served from the web public dir → prefixed with Config.apiBase on mobile.
const _women = <_Live>[
  _Live('Anjali', 25, '/female_profiles/anjali_Traditional_Family_First_g3s7mn/photos/Anjali_1.jpg', true, 'online'),
  _Live('Sarah', 24, '/female_profiles/sarah_Tech_Founder_045db3/photos/Sarah_1.jpg', true, 'online'),
  _Live('Emma', 27, '/female_profiles/emma_Outdoorsy_Adventure_w9d4cs/photos/Emma_1.jpg', false, '2h ago'),
  _Live('Jessica', 28, '/female_profiles/jessica_Ambitious_Professional_e89f0f/photos/Jessica_3.jpg', true, 'online'),
  _Live('Deepa', 33, '/female_profiles/deepa_Older_Dater_o1m4ft/photos/Deepa_1.jpg', false, '45m ago'),
  _Live('Lauren', 29, '/female_profiles/lauren_Ambitious_Corporate_c7f2nx/photos/Lauren_5.jpg', true, 'online'),
  _Live('Neha', 29, '/female_profiles/neha_NRI_Diaspora_x5r2vd/photos/Neha_1.jpg', false, '3h ago'),
  _Live('Priya', 30, '/female_profiles/priya_High_Value_Feminist_f2k7zt/photos/Priya_2.jpg', true, 'online'),
  _Live('Zara', 26, '/female_profiles/zara_Soft_Life_Seeker_m4p9rx/photos/fenomen-zara-1.jpg', true, 'online'),
  _Live('Diana', 35, '/female_profiles/diana_Fiercely_Independent_c4h9pw/photos/Diana_1.jpg', false, '1h ago'),
];

const _men = <_Live>[
  _Live('Daniel', 35, '/male_profiles/daniel_Emotionally_Available_v2r6ys/photos/Daniel_5.jpg', true, 'online'),
  _Live('Ethan', 29, '/male_profiles/ethan_Golden_Retriever_q7n5wc/photos/Ethan_1.jpg', true, 'online'),
  _Live('Greg', 42, '/male_profiles/greg_Casually_Ambitious_m6x2vt/photos/Greg_3.jpg', false, '30m ago'),
  _Live('Karan', 34, '/male_profiles/karan_Progressive_Traditional_u9j5ql/photos/Karan_5.jpg', true, 'online'),
  _Live('Ryan', 31, '/male_profiles/ryan_Serial_Dater_f4m2px/photos/Ryan_1.jpg', true, 'online'),
];

/// "Verified women/men online now" social-proof carousel (gender-aware: a man
/// sees women, a woman sees men).
class LiveNowCarousel extends StatelessWidget {
  final String? viewerGender;
  const LiveNowCarousel({super.key, required this.viewerGender});

  @override
  Widget build(BuildContext context) {
    final showMen = viewerGender == 'woman';
    final people = showMen ? _men : _women;
    final online = people.where((p) => p.online).length;
    final title = 'VERIFIED ${showMen ? 'MEN' : 'WOMEN'} ONLINE NOW';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x18FFFFFF)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Row(children: [
            Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF22C55E), shape: BoxShape.circle)),
            const SizedBox(width: 8),
            Expanded(child: Text(title,
                style: const TextStyle(color: Color(Config.text1), fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.5))),
            Text('$online live · ${people.length} today',
                style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
          ]),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 104,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: people.length,
            separatorBuilder: (_, _) => const SizedBox(width: 16),
            itemBuilder: (c, i) => _tile(people[i]),
          ),
        ),
      ]),
    );
  }

  Widget _tile(_Live p) {
    return SizedBox(
      width: 62,
      child: Column(children: [
        Stack(children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: const Color(Config.bg3),
            backgroundImage: CachedNetworkImageProvider('${Config.apiBase}${p.photo}'),
          ),
          Positioned(
            right: 0, bottom: 0,
            child: Container(
              width: 15, height: 15,
              decoration: BoxDecoration(
                color: p.online ? const Color(0xFF22C55E) : const Color(Config.text3),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(Config.bg2), width: 2.5),
              ),
            ),
          ),
        ]),
        const SizedBox(height: 6),
        Text('${p.name} ${p.age}',
            maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Color(Config.text1), fontSize: 12, fontWeight: FontWeight.w600)),
        Text(p.online ? 'Online' : p.lastActive,
            maxLines: 1, overflow: TextOverflow.ellipsis,
            style: TextStyle(color: p.online ? const Color(0xFF22C55E) : const Color(Config.text3), fontSize: 11)),
      ]),
    );
  }
}
