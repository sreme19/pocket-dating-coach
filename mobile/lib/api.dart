import 'dart:convert' show base64Encode;
import 'dart:io' show Platform, File;
import 'dart:typed_data' show Uint8List;
import 'package:flutter/foundation.dart' show debugPrint;
import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart' show MediaType;
// hide MultipartFile + MediaType: both dio and supabase export them; we use dio's.
import 'package:supabase_flutter/supabase_flutter.dart' hide MultipartFile;
import 'app_logger.dart';
import 'config.dart';

/// The user's profile, assembled from the same two sources the web app uses:
///  1. `verified_vibe_users` row (identity, avatar_url, trust) — direct Supabase.
///  2. `/api/verified-vibe/master-profile` (about, photos, proofs) — Vercel API
///     with a Bearer token. (Native HTTP ignores CORS, so no preflight needed.)
/// An AI-read insight chip (emoji + label) within a verified-signal group.
class InsightChip {
  final String emoji;
  final String label;
  /// True when this insight was inferred from a DIFFERENT upload than the
  /// section it appears in (cross-section signal). [from] is the source proof
  /// category (e.g. 'lifestyle') so the UI can mark it as inferred, not verified.
  final bool inferred;
  final String? from;
  InsightChip(this.emoji, this.label, {this.inferred = false, this.from});
}

/// A group of verified-signal chips for one category, with the AI summary line.
class SignalGroup {
  final List<InsightChip> chips;
  final String aggregated;
  SignalGroup(this.chips, this.aggregated);
  bool get isNotEmpty => chips.isNotEmpty;
}

/// A car in the user's garage (parsed from the `assets` proof category).
class GarageCar {
  final String make;
  final String model;
  final String? year;
  final String? color;
  final String? vehicleType;
  /// True when the car was seen in a non-assets upload (cross-section signal)
  /// rather than read from a verified ownership document. [from] = source category.
  final bool inferred;
  final String? from;
  GarageCar({required this.make, required this.model, this.year, this.color, this.vehicleType, this.inferred = false, this.from});
  String get title => [make, model].where((s) => s.isNotEmpty).join(' ');
}

/// A spending category row (parsed from the `spending` proof breakdown).
class SpendItem {
  final String emoji;
  final String category;
  final String amountLabel;
  SpendItem(this.emoji, this.category, this.amountLabel);
}

/// An uploaded profile photo (url + slot label) — the editable photo list that
/// maps to master-profile `photos[]`.
class PhotoItem {
  final String url;
  final String label;
  PhotoItem(this.url, this.label);
}

/// An AI-enhanced profile photo with its role (slot) and scene description.
class AiPhotoItem {
  final String url;
  final String role; // 'lead', 'warmth', 'lifestyle'
  final String scene;
  AiPhotoItem(this.url, this.role, this.scene);
}

class ProfileData {
  final String name;
  final int? age;
  final String? city;
  final String? heroPhotoUrl;
  final List<String> photos; // all displayable photo URLs (ai + uploaded)
  final List<PhotoItem> uploadedPhotos; // editable uploaded photos (url+label)
  final List<AiPhotoItem> aiPhotoItems; // AI-enhanced photos with role info
  final int trustScore;
  final int proofsCount;
  final String about;
  final bool profileComplete;
  final String? gender;
  final String archetype; // raw code, e.g. casual_generous_man
  final List<String> hardNos;
  final List<String> vibeWords;
  // Verified signals
  final SignalGroup? career; // linkedin
  final SignalGroup? lifestyle; // lifestyle
  final SignalGroup? health; // discipline
  final SignalGroup? social; // social_proof
  final SignalGroup? wealth; // wealth (Money Matters chips)
  // Money matters
  final String? annualIncome;
  final String? netWorth;
  final List<SpendItem> spending;
  // Garage + travel
  final List<GarageCar> garage;
  final List<String> countries;
  // AI portraits
  final String? personalityPortraitUrl;
  final String? garagePortraitUrl;
  // Raw generatedProfile map, kept so edits can merge without dropping fields.
  final Map<String, dynamic> rawGenerated;
  // "Here For" intent line (owner-declared; here_for_title / here_for_desc columns).
  final String? hereForTitle;
  final String? hereForDesc;

  bool get isMan => gender == 'man';

  ProfileData({
    required this.name,
    required this.age,
    required this.city,
    required this.heroPhotoUrl,
    required this.photos,
    required this.uploadedPhotos,
    required this.aiPhotoItems,
    required this.trustScore,
    required this.proofsCount,
    required this.about,
    required this.profileComplete,
    required this.gender,
    required this.archetype,
    required this.hardNos,
    required this.vibeWords,
    required this.career,
    required this.lifestyle,
    required this.health,
    required this.social,
    required this.wealth,
    required this.annualIncome,
    required this.netWorth,
    required this.spending,
    required this.garage,
    required this.countries,
    required this.personalityPortraitUrl,
    required this.garagePortraitUrl,
    required this.rawGenerated,
    this.hereForTitle,
    this.hereForDesc,
  });
}

final _dio = () {
  final d = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 20),
    // SvelteKit CSRF protection blocks multipart/form-data POSTs without a matching
    // Origin header (it only exempts application/json). Native apps never send Origin,
    // so we must set it explicitly to match the server's own host.
    headers: {
      'Origin': 'https://pocket-dating-coach.vercel.app',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
          'AppleWebKit/605.1.15 (like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    },
  ));
  AppLogger.instance.attachToDio(d);
  return d;
}();

int _asInt(dynamic v) => v is num ? v.toInt() : (int.tryParse('$v') ?? 0);

/// The signed-in user's id, or null if not authenticated.
String? currentUserId() => Supabase.instance.client.auth.currentUser?.id;

Future<ProfileData> fetchProfile() async {
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  final session = supabase.auth.currentSession;
  if (user == null || session == null) {
    throw StateError('Not authenticated');
  }

  // 1. Identity + avatar + trust — direct Supabase (RLS lets a user read self).
  final rowFuture = supabase
      .from('verified_vibe_users')
      .select('first_name, age, city, avatar_url, trust_score, gender, archetype, hard_nos, here_for_title, here_for_desc')
      .eq('id', user.id)
      .maybeSingle();
  final stepsFuture = supabase
      .from('verified_vibe_verification')
      .select('step, status, data')
      .eq('user_id', user.id);
  final parallel = await Future.wait<dynamic>([rowFuture, stepsFuture]);
  final row = parallel[0] as Map?;
  final verifySteps = (parallel[1] as List).cast<Map>();

  // 2. Master profile — remote API with Bearer token.
  Map<String, dynamic> master = {};
  try {
    final resp = await _dio.get(
      '${Config.apiBase}/api/verified-vibe/master-profile',
      options: Options(headers: {'Authorization': 'Bearer ${session.accessToken}'}),
    );
    if (resp.data is Map) master = Map<String, dynamic>.from(resp.data as Map);
  } catch (_) {
    // Non-fatal — fall back to whatever the users row gives us.
  }

  final photosRaw = (master['photos'] as List?) ?? const [];
  final aiPhotos = (master['aiPhotos'] as List?) ?? const [];
  final generated = master['generatedProfile'] as Map?;
  final draft = master['profileDraft'] as Map?;
  final proofs = (master['proofInsightsLocalStorage'] as List?) ?? const [];

  // A man's raw upload must NEVER be displayed — viewers (and his own hero) only
  // ever see AI-enhanced portraits. Raw uploads still feed the editable photo
  // manager + enhance source (uploadedPhotos), just never the display list/hero.
  final isMan = (row?['gender']?.toString()) == 'man';

  // All displayable photo URLs: AI photos first, then uploaded (http/data only).
  final photos = <String>[];
  final uploaded = <PhotoItem>[];
  final aiPhotoItemsList = <AiPhotoItem>[];
  for (final p in aiPhotos) {
    if (p is Map && p['url'] is String) {
      photos.add(p['url'] as String);
      aiPhotoItemsList.add(AiPhotoItem(
        p['url'] as String,
        (p['role'] ?? '').toString(),
        (p['scene'] ?? '').toString(),
      ));
    }
  }
  for (final p in photosRaw) {
    if (p is Map && p['dataUrl'] is String) {
      final u = p['dataUrl'] as String;
      if (u.startsWith('http') || u.startsWith('data:')) {
        uploaded.add(PhotoItem(u, (p['label'] ?? 'photo').toString()));
        if (!isMan) photos.add(u); // men: raw uploads are edit-only, never displayed
      }
    }
  }
  String? hero = photos.isNotEmpty ? photos.first : null;
  // Never fall a man back to avatar_url — it may still hold his raw upload until
  // his AI photos are generated + saved. Show the placeholder until AI exists.
  if (hero == null && !isMan) hero = row?['avatar_url'] as String?;

  final name = (row?['first_name'] ?? draft?['firstName'] ?? 'You').toString();
  final age = row?['age'] != null ? _asInt(row!['age']) : (draft?['age'] != null ? _asInt(draft!['age']) : null);
  final city = (row?['city'] ?? draft?['city'])?.toString();
  final about = (generated?['about'] ?? '').toString();
  // Compute trust score as sum of pts (matches Trust & Boost screen logic)
  Map? _vstepFor(String name) {
    for (final s in verifySteps) { if (s['step'] == name) return s; }
    return null;
  }
  final _idScore  = _stepScore(_vstepFor('id'));
  final _livScore = _stepScore(_vstepFor('liveness'));
  final _phScore  = _stepScore(_vstepFor('photos'));
  final _qaScore  = _stepScore(_vstepFor('spending_or_qa'));
  final _vPts = (_idScore > 0 ? 10 : 0) + (_livScore > 0 ? 10 : 0)
              + (_phScore > 0 ? 15 : 0) + (_qaScore  > 0 ? 10 : 0);
  // Proof pts + count computed directly from verifySteps so they are accurate
  // even if the master-profile API call fails (proofs list would be empty).
  const _catPts = <String, int>{
    'lifestyle': 8, 'hosting': 6, 'discipline': 4, 'social_proof': 4,
    'linkedin': 5, 'instagram': 3, 'twitter': 2, 'habit_tracker': 2,
    'intro': 8, 'spending': 10, 'assets': 10, 'wealth': 12, 'travel': 8,
  };
  int _proofPts = 0;
  int _proofCount = 0;
  for (final s in verifySteps) {
    final step = s['step']?.toString() ?? '';
    if (step.startsWith('proof_') && s['status'] == 'completed') {
      _proofCount++;
      final cat = step.replaceFirst('proof_', '');
      _proofPts += _catPts[cat] ?? 4;
    }
  }
  final trust = (_vPts + _proofPts).clamp(0, 100);
  final gender = row?['gender']?.toString();
  final archetype = (row?['archetype'] ?? '').toString();
  final hardNos = <String>[];
  if (row?['hard_nos'] is List) {
    for (final h in (row!['hard_nos'] as List)) {
      final s = '$h'.trim();
      if (s.isNotEmpty) hardNos.add(s);
    }
  }

  // Vibe words from the AI-generated personality descriptors.
  final vibeWords = <String>[];
  final descs = generated?['personalityDescriptors'];
  if (descs is List) {
    for (final d in descs) {
      if (d != null && '$d'.trim().isNotEmpty) vibeWords.add('$d'.trim());
    }
  }

  // Group proof insights by category.
  Map<String, dynamic>? proofFor(String cat) {
    for (final p in proofs) {
      if (p is Map && p['category'] == cat) return Map<String, dynamic>.from(p);
    }
    return null;
  }

  SignalGroup? signal(String cat) {
    final p = proofFor(cat);
    if (p == null) return null;
    final chips = <InsightChip>[];
    final ins = p['insights'];
    if (ins is List) {
      for (final i in ins) {
        if (i is Map) {
          chips.add(InsightChip((i['emoji'] ?? '•').toString(), (i['label'] ?? '').toString()));
        }
      }
    }
    if (chips.isEmpty) return null;
    return SignalGroup(chips, (p['aggregated'] ?? '').toString());
  }

  // Garage cars from the `assets` proof.
  final garage = <GarageCar>[];
  final assetsProof = proofFor('assets');
  if (assetsProof != null && assetsProof['assets'] is List) {
    for (final a in (assetsProof['assets'] as List)) {
      if (a is Map && (a['type'] == 'car' || a['make'] != null)) {
        garage.add(GarageCar(
          make: (a['make'] ?? '').toString(),
          model: (a['model'] ?? '').toString(),
          year: a['year']?.toString(),
          color: a['color']?.toString(),
        ));
      }
    }
  }

  // Spending breakdown from the `spending` proof — deduplicated by category.
  final spending = <SpendItem>[];
  final _seenSpendCategories = <String>{};
  final spendProof = proofFor('spending');
  if (spendProof != null && spendProof['spendingBreakdown'] is List) {
    for (final s in (spendProof['spendingBreakdown'] as List)) {
      if (s is Map) {
        final category = (s['category'] ?? '').toString();
        if (category.isNotEmpty && _seenSpendCategories.add(category)) {
          spending.add(SpendItem(
            (s['emoji'] ?? '💳').toString(),
            category,
            (s['amountLabel'] ?? '').toString(),
          ));
        }
      }
    }
  }

  // Travel: the server's countriesTraveled is the only source. It already unions
  // in each proof's locations AND subtracts the ones the owner deleted, so
  // re-harvesting proofs[].locations here would resurrect removed magnets and
  // mint them from proofs that never passed the face check.
  final countries = <String>[];
  void addCountry(dynamic c) {
    final s = '$c'.trim();
    if (s.isNotEmpty && !countries.contains(s)) countries.add(s);
  }
  if (master['countriesTraveled'] is List) {
    for (final c in (master['countriesTraveled'] as List)) {
      addCountry(c);
    }
  }

  final money = (master['moneyMatters'] ?? generated?['moneyMatters']) as Map?;
  String? nonEmpty(dynamic v) {
    final s = v?.toString().trim();
    return (s != null && s.isNotEmpty) ? s : null;
  }

  return ProfileData(
    name: name,
    age: (age != null && age > 0) ? age : null,
    city: (city != null && city.isNotEmpty) ? city : null,
    heroPhotoUrl: hero,
    photos: photos,
    uploadedPhotos: uploaded,
    aiPhotoItems: aiPhotoItemsList,
    trustScore: trust,
    proofsCount: _proofCount,
    about: about,
    profileComplete: (draft != null || generated != null)
        || (row?['first_name'] != null && row?['age'] != null),
    gender: gender,
    archetype: archetype,
    hardNos: hardNos,
    hereForTitle: nonEmpty(row?['here_for_title']),
    hereForDesc: nonEmpty(row?['here_for_desc']),
    vibeWords: vibeWords,
    career: signal('linkedin'),
    lifestyle: signal('lifestyle'),
    health: signal('discipline'),
    social: signal('social_proof'),
    wealth: signal('wealth'),
    annualIncome: nonEmpty(money?['annualIncome']),
    netWorth: nonEmpty(money?['netWorth']),
    spending: spending,
    garage: garage,
    countries: countries,
    personalityPortraitUrl: nonEmpty(master['personalityPortraitUrl']),
    garagePortraitUrl: nonEmpty(master['garagePortraitUrl']),
    rawGenerated: generated != null ? Map<String, dynamic>.from(generated) : <String, dynamic>{},
  );
}

/// Save name / age / city to verified_vibe_users (the authoritative identity
/// row that discovery, matching, and chat all read). Mirrors the web hero edit.
Future<void> saveIdentity({required String firstName, int? age, String? city}) async {
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  if (user == null) throw StateError('Not authenticated');
  final patch = <String, dynamic>{};
  if (firstName.trim().isNotEmpty) patch['first_name'] = firstName.trim();
  if (age != null && age > 0) patch['age'] = age;
  if (city != null) patch['city'] = city.trim();
  if (patch.isEmpty) return;
  await supabase.from('verified_vibe_users').update(patch).eq('id', user.id);
}

/// Generate an AI portrait from the user's lead photo, then persist its URL to
/// master-profile (personalityPortraitUrl, or garagePortraitUrl when lifestyle).
/// Returns the hosted image URL. Slow (image gen) — 120s timeout.
Future<String> generatePortrait({required String referenceImageUrl, bool lifestyle = false}) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');
  final headers = {'Authorization': 'Bearer ${session.accessToken}', 'Content-Type': 'application/json'};
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/personality-portrait',
    data: {
      'referenceImageUrl': referenceImageUrl,
      'personalityTraits': const [
        {'name': 'Decisiveness', 'level': 'Very high', 'percentage': 95},
        {'name': 'Warmth', 'level': 'High', 'percentage': 80},
        {'name': 'Openness', 'level': 'High', 'percentage': 75},
        {'name': 'Pace', 'level': 'Solid', 'percentage': 65},
        {'name': 'Stability', 'level': 'High', 'percentage': 78},
      ],
      if (lifestyle)
        'sceneOverride':
            'confident person in smart casual attire, evening city setting, luxury lifestyle atmosphere, golden hour lighting, urban outdoor environment, sophisticated and relaxed',
    },
    options: Options(headers: headers, receiveTimeout: const Duration(seconds: 120)),
  );
  final url = (resp.data is Map) ? resp.data['imageUrl'] : null;
  if (url is! String || url.isEmpty) throw 'Generation failed';
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: {lifestyle ? 'garagePortraitUrl' : 'personalityPortraitUrl': url},
    options: Options(headers: headers),
  );
  return url;
}

/// Replace the user's countries-traveled list (Travel Magnets).
Future<void> saveCountries(List<String> countries) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: {'countriesTraveled': countries, 'countriesReplace': true},
    options: Options(headers: {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    }),
  );
}

/// Save customised "What He Brings" items under `brings` in generatedProfile.
Future<void> saveBrings(List<Map<String, String>> items, Map<String, dynamic> existingGenerated) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');
  final merged = Map<String, dynamic>.from(existingGenerated)..['brings'] = items;
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: {'generatedProfile': merged},
    options: Options(headers: {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    }),
  );
}

/// Save the About text. POST master-profile replaces generatedProfile wholesale,
/// so we merge `about` into the existing map to avoid dropping other fields.
Future<void> saveAbout(String about, Map<String, dynamic> existingGenerated) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');
  final merged = Map<String, dynamic>.from(existingGenerated)..['about'] = about.trim();
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: {'generatedProfile': merged},
    options: Options(headers: {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    }),
  );
}

/// Ask AI to generate an About bio based on current profile data.
/// Returns a suggested about string, or throws on error.
Future<String> generateAboutText(ProfileData d) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/generate-profile',
    data: {
      'intake': {
        'firstName': d.name,
        'age': d.age ?? 0,
        'city': d.city ?? '',
        'about': d.about,
        'lookingFor': '',
        'personalityTags': d.vibeWords,
        'interests': d.countries,
      },
      'photoLabels': [],
      'archetype': d.archetype,
      'trustScore': d.trustScore,
    },
    options: Options(headers: {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    }),
  );
  final body = resp.data;
  if (body is Map && body['about'] is String && (body['about'] as String).isNotEmpty) {
    return body['about'] as String;
  }
  throw 'Could not generate — try again.';
}

/// Save Money Matters directly to the top-level moneyMatters field (used from
/// Trust & Boost — no existingGenerated required).
Future<void> saveMoneyMattersDirect({String? income, String? netWorth}) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');
  final mm = <String, dynamic>{};
  if (income != null && income.trim().isNotEmpty) mm['annualIncome'] = income.trim();
  if (netWorth != null && netWorth.trim().isNotEmpty) mm['netWorth'] = netWorth.trim();
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: {'moneyMatters': mm},
    options: Options(headers: {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    }),
  );
}

/// Save Money Matters (income / net worth). Merges into moneyMatters sub-map
/// of generatedProfile without dropping other fields.
Future<void> saveMoneyMatters({
  required String income,
  required String netWorth,
  required Map<String, dynamic> existingGenerated,
}) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');
  final merged = Map<String, dynamic>.from(existingGenerated);
  final money = Map<String, dynamic>.from(merged['moneyMatters'] as Map? ?? {});
  money['annualIncome'] = income.trim();
  money['netWorth'] = netWorth.trim();
  merged['moneyMatters'] = money;
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: {'generatedProfile': merged},
    options: Options(headers: {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    }),
  );
}

String _bearerToken() {
  final s = Supabase.instance.client.auth.currentSession;
  if (s == null) throw StateError('Not authenticated');
  return 'Bearer ${s.accessToken}';
}

// ── Preference weighting (explicit step — Scoring redesign Phase 0b) ───────────

class PreferenceDimension {
  final String id;
  final String label;
  final String cls; // 'open' | 'sensitive'
  final String blurb;
  const PreferenceDimension({required this.id, required this.label, required this.cls, required this.blurb});
  factory PreferenceDimension.fromJson(Map<String, dynamic> j) => PreferenceDimension(
        id: j['id'] as String,
        label: j['label'] as String? ?? j['id'] as String,
        cls: j['cls'] as String? ?? 'open',
        blurb: j['blurb'] as String? ?? '',
      );
}

class PreferenceWeights {
  final List<PreferenceDimension> dimensions;
  final Map<String, int> importance; // dimId → 0..maxImportance
  final String? weightsSource;        // 'explicit' | 'extracted' | 'balanced' | null
  final int maxImportance;
  const PreferenceWeights({required this.dimensions, required this.importance, this.weightsSource, this.maxImportance = 5});
  factory PreferenceWeights.fromJson(Map<String, dynamic> j) {
    final dims = (j['dimensions'] as List? ?? [])
        .map((d) => PreferenceDimension.fromJson(d as Map<String, dynamic>))
        .toList();
    final imp = <String, int>{};
    (j['importance'] as Map? ?? {}).forEach((k, v) => imp[k as String] = (v as num).round());
    return PreferenceWeights(
      dimensions: dims,
      importance: imp,
      weightsSource: j['weightsSource'] as String?,
      maxImportance: (j['maxImportance'] as num?)?.round() ?? 5,
    );
  }
}

/// Fetch the dimension taxonomy + the user's current importance ratings.
Future<PreferenceWeights> fetchPreferenceWeights() async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/preferences/weights',
    options: Options(headers: {'Authorization': _bearerToken()}),
  );
  return PreferenceWeights.fromJson(resp.data as Map<String, dynamic>);
}

/// Save importance ratings (0..max per dimension id). Server normalises → weights
/// (Σ=1) and stores them with weights_source='explicit'.
Future<void> savePreferenceWeights(Map<String, int> importance) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/preferences/weights',
    data: {'importance': importance},
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
}

// ── Profile Strength (Scoring redesign Phase 2) ───────────────────────────────

class PsAction {
  final String dimension;
  final String label;
  final num deltaPS;
  const PsAction({required this.dimension, required this.label, required this.deltaPS});
  factory PsAction.fromJson(Map<String, dynamic> j) => PsAction(
        dimension: j['dimension'] as String? ?? '',
        label: j['label'] as String? ?? '',
        deltaPS: (j['deltaPS'] as num?) ?? 0,
      );
}

class ProfileStrength {
  final bool hasVectors;
  final int profileStrength;
  final String band;
  final String? nextBand;
  final int? pointsToNextBand;
  final double progressInBand;
  final int psNow;
  final int psVerified;
  final num deltaVerify;
  final String verifiedBand;
  final List<PsAction> actions;
  const ProfileStrength({
    required this.hasVectors,
    this.profileStrength = 0,
    this.band = '',
    this.nextBand,
    this.pointsToNextBand,
    this.progressInBand = 0,
    this.psNow = 0,
    this.psVerified = 0,
    this.deltaVerify = 0,
    this.verifiedBand = '',
    this.actions = const [],
  });
  factory ProfileStrength.fromJson(Map<String, dynamic> j) {
    if (j['hasVectors'] != true) return const ProfileStrength(hasVectors: false);
    final up = (j['verificationUpside'] as Map?) ?? {};
    return ProfileStrength(
      hasVectors: true,
      profileStrength: (j['profileStrength'] as num?)?.round() ?? 0,
      band: j['band'] as String? ?? '',
      nextBand: j['nextBand'] as String?,
      pointsToNextBand: (j['pointsToNextBand'] as num?)?.round(),
      progressInBand: ((j['progressInBand'] as num?) ?? 0).toDouble(),
      psNow: (up['psNow'] as num?)?.round() ?? 0,
      psVerified: (up['psVerified'] as num?)?.round() ?? 0,
      deltaVerify: (up['deltaPS'] as num?) ?? 0,
      verifiedBand: j['verifiedBand'] as String? ?? '',
      actions: ((j['actions'] as List?) ?? [])
          .map((a) => PsAction.fromJson(a as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// Fetch the user's Profile Strength band + momentum + verification-upside actions.
Future<ProfileStrength> fetchProfileStrength() async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/profile-strength',
    options: Options(headers: {'Authorization': _bearerToken()}),
  );
  return ProfileStrength.fromJson(resp.data as Map<String, dynamic>);
}

/// Upload a profile photo (base64 data URL) → returns the hosted URL. When
/// label == 'lead' the backend also sets verified_vibe_users.avatar_url.
Future<String> uploadPhoto(String dataUrl, String label) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/upload-photo',
    data: {'dataUrl': dataUrl, 'label': label},
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
  final url = (resp.data is Map) ? resp.data['url'] : null;
  if (url is! String || url.isEmpty) throw 'Upload failed';
  return url;
}

/// Persist the full uploaded-photos list to master-profile (replaces photos[]),
/// and sync the lead (first) photo to verified_vibe_users.avatar_url so it shows
/// everywhere discovery/chat read the identity row.
Future<void> savePhotos(List<PhotoItem> photos, {bool isMan = false}) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: {'photos': [for (final p in photos) {'dataUrl': p.url, 'label': p.label}]},
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
  // A man's raw photo must never be presented, so never mirror it to avatar_url —
  // his avatar is only ever set to the AI lead by saveAiPhotos. Women's avatar
  // tracks their real lead photo as before.
  if (isMan) return;
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  if (user != null && photos.isNotEmpty) {
    await supabase.from('verified_vibe_users').update({'avatar_url': photos.first.url}).eq('id', user.id);
  }
}

/// Generate AI-enhanced profile photos via the photo-enhance pipeline.
/// Pass ALL of the man's uploaded photos — the server uses them as multi-reference,
/// which materially improves identity lock (Gemini edit-framing engine). Slow (~up to 120s).
Future<List<AiPhotoItem>> enhancePhotos(List<String> referenceUrls, {String archetype = 'casual_man', CancelToken? cancelToken}) async {
  // Server requires base64 data URLs — download + encode each reference (men have ≤3).
  final dataUrls = <String>[];
  for (final url in referenceUrls.take(5)) {
    if (url.startsWith('data:')) { dataUrls.add(url); continue; }
    try {
      final imgResp = await _dio.get<List<int>>(url, cancelToken: cancelToken, options: Options(responseType: ResponseType.bytes));
      final bytes = imgResp.data ?? <int>[];
      if (bytes.isEmpty) continue;
      final ext = url.split('?').first.split('.').last.toLowerCase();
      final mime = switch (ext) {
        'png'  => 'image/png',
        'webp' => 'image/webp',
        'gif'  => 'image/gif',
        _      => 'image/jpeg',
      };
      dataUrls.add('data:$mime;base64,${base64Encode(bytes)}');
    } catch (_) {/* skip a reference that fails to download */}
  }
  if (dataUrls.isEmpty) throw 'Could not load reference photos';

  final Response<dynamic> resp;
  try {
    resp = await _dio.post(
      '${Config.apiBase}/api/photo-enhance/generate',
      data: {
        'referenceDataUrls': dataUrls,
        'referenceDataUrl': dataUrls.first, // back-compat / fal fallback ref
        'archetype': archetype.isNotEmpty ? archetype : 'casual_man',
        'count': 3,
      },
      cancelToken: cancelToken,
      options: Options(
        headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'},
        receiveTimeout: const Duration(seconds: 120),
      ),
    );
  } on DioException catch (e) {
    // Face pre-flight rejection — surface the server's message ("No face can be
    // identified in your photos.") instead of the raw DioException dump.
    final data = e.response?.data;
    if (data is Map && data['error'] == 'no_face') {
      throw (data['message'] ?? 'No face can be identified in your photos.').toString();
    }
    rethrow;
  }
  final raw = (resp.data is Map)
      ? ((resp.data as Map)['photos'] as List?) ?? <dynamic>[]
      : <dynamic>[];
  return [
    for (final p in raw)
      if (p is Map && p['url'] is String)
        AiPhotoItem(
          p['url'] as String,
          (p['role'] ?? '').toString(),
          (p['scene'] ?? '').toString(),
        ),
  ];
}

/// Persist AI-enhanced photos to master-profile (replaces aiPhotos[]).
Future<void> saveAiPhotos(List<AiPhotoItem> aiPhotos) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: {
      'aiPhotos': [
        for (final p in aiPhotos) {'url': p.url, 'role': p.role, 'scene': p.scene},
      ],
    },
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
  // Point the public avatar at the AI lead portrait — a man's raw photo must
  // never be shown to viewers, and every viewer endpoint serves avatar_url.
  if (aiPhotos.isNotEmpty) {
    final lead = aiPhotos.firstWhere((p) => p.role == 'lead', orElse: () => aiPhotos.first);
    final user = Supabase.instance.client.auth.currentUser;
    if (user != null && lead.url.isNotEmpty) {
      await Supabase.instance.client
          .from('verified_vibe_users')
          .update({'avatar_url': lead.url}).eq('id', user.id);
    }
  }
}

/// Change the user's archetype (direct Supabase update — RLS allows self).
Future<void> saveArchetype(String archetype) async {
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  if (user == null) throw StateError('Not authenticated');
  await supabase.from('verified_vibe_users').update({'archetype': archetype}).eq('id', user.id);
}

/// Delete the spending_or_qa verification step so the user re-fills Q&A
/// after changing their lane/archetype (different archetypes have different questions).
/// Also clears the `onboarding` field in user_master_profile so the old Q&A
/// responses are not carried over to the new archetype's questions.
Future<void> resetQAVerification() async {
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  if (user == null) return;

  // 1. Delete spending_or_qa row from verified_vibe_verification
  await supabase
      .from('verified_vibe_verification')
      .delete()
      .eq('user_id', user.id)
      .eq('step', 'spending_or_qa');

  // 2. Clear onboarding field in user_master_profile.data so old Q&A
  //    responses don't persist for the new archetype.
  final row = await supabase
      .from('user_master_profile')
      .select('data')
      .eq('user_id', user.id)
      .maybeSingle();
  if (row != null) {
    final data = Map<String, dynamic>.from((row['data'] as Map?) ?? {});
    data.remove('onboarding');
    await supabase
        .from('user_master_profile')
        .update({'data': data})
        .eq('user_id', user.id);
  }
}

/// Persist hard-nos (dealbreakers). Routes through the server endpoint (not a
/// direct Supabase write) so the matchmaker pool entry is refreshed and the edit
/// propagates to matching — hard_nos is the single source of truth for
/// dealbreakers.
Future<void> saveHardNos(List<String> hardNos) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/hard-nos',
    data: {'hardNos': hardNos},
    options: Options(headers: {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    }),
  );
}

/// Save the owner's "Here For" intent line (here_for_title / here_for_desc).
Future<void> saveHereFor(String title, String desc) async {
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  if (user == null) throw StateError('Not authenticated');
  await supabase.from('verified_vibe_users').update({
    'here_for_title': title.trim(),
    'here_for_desc': desc.trim(),
  }).eq('id', user.id);
}

/// Ask the AI to suggest more insight chips for a proof category. Returns the
/// generated chips (may be empty if the AI asks to clarify / redirect).
Future<List<InsightChip>> suggestInsights(
    String category, List<String> existingLabels, String aggregated) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/wingman',
    data: {
      'message':
          'Suggest 3 more insight chips from my $category documents. Existing labels to avoid: ${existingLabels.join(', ')}. Aggregated data: $aggregated',
      'profileSnapshot': {
        'proofInsights': [
          {'category': category, 'labels': existingLabels, 'aggregated': aggregated},
        ],
      },
    },
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
  final out = <InsightChip>[];
  if (resp.data is Map && resp.data['new_insights'] is List) {
    for (final i in (resp.data['new_insights'] as List)) {
      if (i is Map && i['label'] != null) {
        out.add(InsightChip((i['emoji'] ?? '•').toString(), i['label'].toString()));
      }
    }
  }
  return out;
}

/// Add an insight chip to a proof category (persists to verifiedProofs).
Future<void> addInsightChip(String category, String label, String emoji) =>
    _insightChip('add', category, label, emoji);

/// Remove an insight chip from a proof category.
Future<void> removeInsightChip(String category, String label) =>
    _insightChip('remove', category, label, null);

Future<void> _insightChip(String action, String category, String label, String? emoji) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/insight-chip',
    data: {'action': action, 'category': category, 'label': label, if (emoji != null) 'emoji': emoji},
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
}

/// Remove a thumbnail image from a proof category (persists to verifiedProofs
/// and best-effort deletes the underlying Storage object).
Future<void> removeProofThumbnail(String category, String url) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/proof-thumbnail',
    data: {'action': 'remove', 'category': category, 'url': url},
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
}

/// Result of cleaning a free-typed dealbreaker. Either a usable [cleaned] phrase,
/// or a [rejectedReason] when the input isn't a valid dealbreaker (gibberish, a
/// slur, a question, etc.) — in that case nothing should be added to the list.
class CleanupResult {
  final String? cleaned;
  final String? rejectedReason;
  const CleanupResult.ok(this.cleaned) : rejectedReason = null;
  const CleanupResult.rejected(this.rejectedReason) : cleaned = null;
  bool get isRejected => rejectedReason != null;
}

/// Normalize a free-typed dealbreaker into a concise phrase (Claude haiku).
/// Falls back to accepting the trimmed input on any transport error.
Future<CleanupResult> cleanupText(String text) async {
  try {
    final resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/cleanup-text',
      data: {'text': text},
      options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
    );
    final data = resp.data;
    if (data is Map && data['rejected'] == true) {
      final r = data['reason'];
      return CleanupResult.rejected(
        (r is String && r.trim().isNotEmpty)
            ? r.trim()
            : "That doesn't look like a dealbreaker — try naming a trait you'd want to avoid.",
      );
    }
    final c = (data is Map) ? data['cleaned'] : null;
    return CleanupResult.ok((c is String && c.trim().isNotEmpty) ? c.trim() : text.trim());
  } catch (_) {
    return CleanupResult.ok(text.trim());
  }
}

/// A match card in the Discover feed (from /api/verified-vibe/discovery-feed,
/// `data.profiles[]`). Native HTTP, Bearer auth.
class DiscoveryProfile {
  final String id;
  final String firstName;
  final int? age;
  final String? city;
  final String? avatar;
  final int trustScore;
  final String archetypeLabel;
  final String? intent;
  final String? distance;
  final int verifiedCount;
  final String? gender;

  DiscoveryProfile({
    required this.id,
    required this.firstName,
    required this.age,
    required this.city,
    required this.avatar,
    required this.trustScore,
    required this.archetypeLabel,
    required this.intent,
    required this.distance,
    required this.verifiedCount,
    this.gender,
  });

  String get trustLabel {
    if (trustScore >= 80) return 'High Trust';
    if (trustScore >= 60) return 'Trusted';
    if (trustScore >= 40) return 'Building Trust';
    return 'New here';
  }

  /// Turn a raw archetype code into a label, e.g.
  /// `hopeless_romantic_woman` → `Hopeless-Romantic`.
  static String prettyArchetype(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    final stripped = raw.replaceAll(RegExp(r'_(man|woman)$'), '');
    final parts = stripped
        .split('_')
        .where((p) => p.isNotEmpty)
        .map((p) => p[0].toUpperCase() + p.substring(1));
    return parts.join('-');
  }
}

Future<List<DiscoveryProfile>> fetchDiscovery({int limit = 12}) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');

  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/discovery-feed',
    queryParameters: {'limit': limit, 'sortBy': 'trustScore'},
    options: Options(headers: {'Authorization': 'Bearer ${session.accessToken}'}),
  );

  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : const {};
  final profiles = (data['profiles'] as List?) ?? const [];

  return profiles.whereType<Map>().map((p) {
    return DiscoveryProfile(
      id: '${p['id']}',
      firstName: (p['firstName'] ?? p['first_name'] ?? '—').toString(),
      age: p['age'] is num ? (p['age'] as num).toInt() : null,
      city: (p['city'] as String?)?.trim().isNotEmpty == true ? p['city'] as String : null,
      avatar: p['avatar'] as String?,
      trustScore: p['trustScore'] is num ? (p['trustScore'] as num).toInt() : 0,
      archetypeLabel: DiscoveryProfile.prettyArchetype(p['archetype'] as String?),
      intent: (p['looking'] ?? p['hereFor']) as String?,
      distance: p['distance'] as String?,
      verifiedCount: (p['verified'] as List?)?.length ?? 0,
      gender: p['gender'] as String?,
    );
  }).toList();
}

// ── Push ──────────────────────────────────────────────────────────────────

/// Register an FCM device token for the signed-in user (backend sends via FCM).
Future<void> registerPushToken(String token) async {
  await _dio.post(
    '${Config.apiBase}/api/push/register',
    data: {'token': token, 'platform': Platform.isIOS ? 'ios' : 'android'},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

// ── Trust / Boost ───────────────────────────────────────────────────────────

class ProofItem {
  final String category;
  final String aggregated;
  final int points;
  final int photoCount;
  final String insightLabel;
  final List<InsightChip> insights;
  final List<String> thumbnails;
  final String verifiedAt;
  ProofItem({
    required this.category,
    required this.aggregated,
    required this.points,
    this.photoCount = 0,
    this.insightLabel = '',
    this.insights = const [],
    this.thumbnails = const [],
    this.verifiedAt = '',
  });
}

class TrustData {
  final int trustScore;
  final bool identityVerified;
  final String archetype;
  final List<ProofItem> proofs;
  // Per-step breakdown scores (0–100), matching website calculateTrustScore()
  final int idScore;
  final int livenessScore;
  final int photoScore;
  final int qaScore;
  // Money Matters (self-declared from master-profile)
  final String? annualIncome;
  final String? netWorth;
  // Travel Magnets (manual + AI-detected countries)
  final List<String> countries;
  TrustData({
    required this.trustScore,
    required this.identityVerified,
    required this.archetype,
    required this.proofs,
    this.idScore = 0,
    this.livenessScore = 0,
    this.photoScore = 0,
    this.qaScore = 0,
    this.annualIncome,
    this.netWorth,
    this.countries = const [],
  });
  int get proofPoints => proofs.fold(0, (s, p) => s + p.points);
  ProofItem? proofFor(String category) {
    for (final p in proofs) {
      if (p.category == category) return p;
    }
    return null;
  }
}

/// Compute a 0–100 score for one verification step, mirroring the website's
/// calculateStepScore() in trustScore.ts.
int _stepScore(Map? record) {
  if (record == null) return 0;
  final status = record['status']?.toString() ?? '';
  if (status != 'completed') return 0;
  final data = record['data'];
  if (data is Map && data['confidenceScore'] is num) {
    return (data['confidenceScore'] as num).round().clamp(0, 100);
  }
  return 100; // completed but no confidence score → full marks
}

/// Intent score for spending_or_qa:
///   50 — drawn_to responses present (step 1 done)
///  100 — drawn_to + how_you_live responses present (both steps done)
/// Legacy completed rows without structured responses stay at 100.
int _qaIntentScore(Map? record) {
  if (record == null) return 0;
  final status = record['status']?.toString() ?? '';
  if (status != 'completed') return 0;
  final data = record['data'];
  if (data is! Map) return 100; // legacy row
  final responses = data['responses'];
  if (responses is! Map) return 100; // legacy format
  final hasDrawnTo = responses.containsKey('drawn_to');
  final hasHowYouLive = responses.keys.any((k) => k != 'drawn_to');
  if (hasDrawnTo && hasHowYouLive) return 100;
  if (hasDrawnTo || hasHowYouLive) return 50;
  return 0;
}

Future<TrustData> fetchTrust() async {
  final uid = Supabase.instance.client.auth.currentUser!.id;
  final session = Supabase.instance.client.auth.currentSession!;

  // Fetch user row and verification steps in parallel
  final futures = await Future.wait<dynamic>([
    Supabase.instance.client
        .from('verified_vibe_users')
        .select('trust_score, identity_verified, archetype')
        .eq('id', uid)
        .maybeSingle(),
    Supabase.instance.client
        .from('verified_vibe_verification')
        .select('step, status, data')
        .eq('user_id', uid),
  ]);

  final row = futures[0] as Map?;
  final steps = (futures[1] as List).cast<Map>();

  Map? stepFor(String name) {
    for (final s in steps) {
      if (s['step'] == name) return s;
    }
    return null;
  }

  final idScore       = _stepScore(stepFor('id'));
  final livenessScore = _stepScore(stepFor('liveness'));
  // Website maps 'photos' → Lifestyle, 'spending_or_qa' → Intent
  final photoScore    = _stepScore(stepFor('photos'));
  // Proportional: 50 when drawn_to done, 100 when both drawn_to + how_you_live done.
  final qaScore       = _qaIntentScore(stepFor('spending_or_qa'));

  List<ProofItem> proofs = [];
  String? annualIncome;
  String? netWorth;
  final List<String> countries = [];
  try {
    final resp = await _dio.get(
      '${Config.apiBase}/api/verified-vibe/master-profile',
      options: Options(headers: {'Authorization': 'Bearer ${session.accessToken}'}),
    );
    final body = resp.data is Map ? resp.data as Map : const {};
    final list = (body['proofInsightsLocalStorage'] as List?) ?? const [];
    proofs = list.whereType<Map>().map((p) {
      final chips = (p['insights'] as List? ?? []).whereType<Map>().map((i) =>
          InsightChip((i['emoji'] ?? '').toString(), (i['label'] ?? '').toString())).toList();
      final thumbs = (p['thumbnails'] as List? ?? []).whereType<String>().toList();
      return ProofItem(
        category: (p['category'] ?? '').toString(),
        aggregated: (p['aggregated'] ?? p['insight_label'] ?? '').toString(),
        points: p['pts_awarded'] is num ? (p['pts_awarded'] as num).toInt() : 0,
        photoCount: p['photo_count'] is num ? (p['photo_count'] as num).toInt() : 0,
        insightLabel: (p['insight_label'] ?? '').toString(),
        insights: chips,
        thumbnails: thumbs,
        verifiedAt: (p['verified_at'] ?? '').toString(),
      );
    }).toList();
    String? ne(dynamic v) { final s = v?.toString().trim(); return (s != null && s.isNotEmpty) ? s : null; }
    final mm = body['moneyMatters'] as Map?;
    annualIncome = ne(mm?['annualIncome']);
    netWorth     = ne(mm?['netWorth']);
    if (body['countriesTraveled'] is List) {
      for (final c in (body['countriesTraveled'] as List)) {
        final s = c?.toString().trim() ?? '';
        if (s.isNotEmpty && !countries.contains(s)) countries.add(s);
      }
    }
  } catch (_) {}

  // Trust score = direct sum of completed verification pts + proof pts_awarded.
  // This matches the "+N pts" shown on Show-Off cards so the chart reacts
  // predictably when a user uploads a proof.
  // Verification step pts (mirrors getTrustPoints in verify-step server):
  //   id=10, liveness=10, photos=15, spending_or_qa=10 → max 45 pts
  final verifyPts = (idScore       > 0 ? 10 : 0)
                  + (livenessScore > 0 ? 10 : 0)
                  + (photoScore    > 0 ? 15 : 0)
                  + (qaScore       > 0 ? 10 : 0);
  final proofPts = proofs.fold(0, (sum, p) => sum + p.points);
  final computedScore = (verifyPts + proofPts).clamp(0, 100);

  return TrustData(
    trustScore:      computedScore,
    identityVerified: row?['identity_verified'] == true,
    archetype:       (row?['archetype'] ?? '').toString(),
    proofs:          proofs,
    idScore:         idScore,
    livenessScore:   livenessScore,
    photoScore:      photoScore,
    qaScore:         qaScore,
    annualIncome:    annualIncome,
    netWorth:        netWorth,
    countries:       countries,
  );
}

/// Detect MIME type from file extension so the server can filter images/audio/video.
MediaType _mimeOf(String path) {
  final ext = path.split('.').last.toLowerCase();
  return switch (ext) {
    'jpg' || 'jpeg' => MediaType('image', 'jpeg'),
    'png'           => MediaType('image', 'png'),
    'webp'          => MediaType('image', 'webp'),
    'gif'           => MediaType('image', 'gif'),
    'heic'          => MediaType('image', 'heic'),
    'mp4'           => MediaType('video', 'mp4'),
    'mov'           => MediaType('video', 'quicktime'),
    'm4a' || 'aac'  => MediaType('audio', 'mp4'),
    'mp3'           => MediaType('audio', 'mpeg'),
    'webm'          => MediaType('video', 'webm'),
    'pdf'           => MediaType('application', 'pdf'),
    _               => MediaType('application', 'octet-stream'),
  };
}

/// Upload a proof artifact (multipart) for a category → returns the API result
/// ({verified, insights, pts_awarded, aggregated, ...}).
Future<Map> uploadProof(String category, List<String> filePaths,
    {String? relationship, String? matchId}) async {
  final form = FormData();
  form.fields.add(MapEntry('category', category));
  // Declared ownership relationship for assets not in the user's own name
  // (company / family / financed / other) — set by the relationship picker.
  if (relationship != null && relationship.isNotEmpty) {
    form.fields.add(MapEntry('relationship', relationship));
  }
  // When the upload answers a Bestie in-chat proof request, matchId lets the
  // server fulfil/fail that request (spec §3 Step 3).
  if (matchId != null && matchId.isNotEmpty) {
    form.fields.add(MapEntry('matchId', matchId));
  }
  for (final path in filePaths) {
    form.files.add(MapEntry('files',
        await MultipartFile.fromFile(path, contentType: _mimeOf(path))));
  }
  late Response resp;
  try {
    resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/proof-upload',
      data: form,
      options: Options(
        headers: {'Authorization': _bearer()},
        receiveTimeout: const Duration(seconds: 120),
        validateStatus: (s) => true,
      ),
    );
  } on DioException {
    throw Exception('Connection error — please check your internet and try again.');
  }
  final body = resp.data is Map ? resp.data as Map : const {};
  if ((resp.statusCode ?? 0) >= 400) {
    final code = resp.statusCode;
    final serverMsg = (body['error'] ?? body['message'])?.toString();
    if (code == 503) throw Exception('AI service temporarily unavailable. Please try again in a moment.');
    if (code == 413) throw Exception('Photos are too large. Try selecting fewer photos.');
    if (code == 401 || code == 403) throw Exception('Session expired — please sign out and back in.');
    if (serverMsg != null && serverMsg.isNotEmpty && serverMsg.length < 200) throw Exception(serverMsg);
    throw Exception('Upload failed (error $code). Please try again.');
  }
  return body;
}

/// Submit a government-ID photo (KTP/passport) for the lightweight ID gate.
/// Returns true on success, throws a user-friendly message on failure.
Future<bool> verifyIdStep(String imagePath) async {
  final bytes = await File(imagePath).readAsBytes();
  final ext = imagePath.split('.').last.toLowerCase();
  final mime = switch (ext) {
    'png' => 'image/png', 'webp' => 'image/webp', _ => 'image/jpeg',
  };
  final b64 = base64Encode(bytes);
  late Response resp;
  try {
    resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/verify-step',
      data: {'step': 'id', 'data': {'image': b64, 'mimeType': mime}},
      options: Options(
        headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'},
        receiveTimeout: const Duration(seconds: 60),
        validateStatus: (s) => true, // handle all status codes manually
      ),
    );
  } on DioException catch (e) {
    throw Exception('Network error — check your connection and try again.');
  }
  final body = resp.data is Map ? resp.data as Map : const {};
  if (resp.statusCode == 201 || body['status'] == 'completed') return true;
  if (resp.statusCode == 422) {
    throw Exception('ID photo could not be read. Make sure it\'s clear, well-lit, and not a screenshot.');
  }
  final msg = body['error']?.toString();
  throw Exception(msg?.isNotEmpty == true ? msg : 'ID verification failed. Please try again.');
}

/// Extract name and face from government ID. Returns map with keys:
///   idName (String?), faceMatch (bool?), faceConfidence (num?), idBase64 (String)
Future<Map<String, dynamic>> verifyIdExtract(String imagePath) async {
  final bytes = await File(imagePath).readAsBytes();
  final ext = imagePath.split('.').last.toLowerCase();
  final mime = switch (ext) {
    'png' => 'image/png', 'webp' => 'image/webp', _ => 'image/jpeg',
  };
  final b64 = base64Encode(bytes);
  late Response resp;
  try {
    resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/verify-step',
      data: {'step': 'id', 'data': {'image': b64, 'mimeType': mime}},
      options: Options(
        headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'},
        receiveTimeout: const Duration(seconds: 60),
        validateStatus: (s) => true,
      ),
    );
  } on DioException {
    throw Exception('Network error — check your connection and try again.');
  }
  final body = resp.data is Map ? resp.data as Map : const {};
  if (resp.statusCode != 201 && body['status'] != 'completed') {
    if (resp.statusCode == 422) {
      throw Exception('ID photo could not be read. Make sure it\'s clear, well-lit, and not a screenshot.');
    }
    final msg = body['error']?.toString();
    throw Exception(msg?.isNotEmpty == true ? msg : 'ID verification failed. Please try again.');
  }
  final data = body['data'] is Map ? body['data'] as Map : const {};
  return {
    'idName': data['idName']?.toString(),
    'faceMatch': data['faceMatch'] as bool?,
    'faceConfidence': data['faceConfidence'] as num?,
    'idBase64': b64,
    'idMime': mime,
  };
}

/// Verify a live selfie against the government ID photo.
/// The server applies the same liveness standard as onboarding AND the ID
/// face-match (bar 65); it returns the combined decision in `match`. Returns
/// that decision (fails open only on a server-side API error).
Future<bool> verifySelfieVsId(String selfiePath, String idBase64, String idMime) async {
  final bytes = await File(selfiePath).readAsBytes();
  final selfieB64 = base64Encode(bytes);
  late Response resp;
  try {
    resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/verify-step',
      data: {
        'step': 'liveness',
        'data': {
          'selfieImage': selfieB64,
          'mimeType': 'image/jpeg',
          'idPhotoBase64': idBase64,
        },
      },
      options: Options(
        headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'},
        receiveTimeout: const Duration(seconds: 60),
        validateStatus: (s) => true,
      ),
    );
  } on DioException {
    throw Exception('Network error — check your connection and try again.');
  }
  final body = resp.data is Map ? resp.data as Map : const {};
  if (resp.statusCode != 201 && body['status'] != 'completed') {
    final msg = body['error']?.toString();
    throw Exception(msg?.isNotEmpty == true ? msg : 'Face verification failed. Please try again.');
  }
  final data = body['data'] is Map ? body['data'] as Map : const {};
  // If Claude itself errored (images too large, API failure) the server sets
  // apiError:true — fail open so users aren't hard-blocked by infra issues.
  if (data['apiError'] == true) return true;
  // Server is the single source of truth: `match` already encodes both the
  // liveness (genuine live person) and the ID face-match (bar 65) decisions.
  return data['match'] == true;
}

/// Upload proof with both a profile URL and a file (e.g. LinkedIn URL + resume PDF).
Future<Map> uploadProofWithUrl(String category, String profileUrl, String filePath) async {
  final form = FormData();
  form.fields.add(MapEntry('category', category));
  form.fields.add(MapEntry('profile_url', profileUrl));
  form.files.add(MapEntry('files',
      await MultipartFile.fromFile(filePath, contentType: _mimeOf(filePath))));
  return _uploadProofPost(form);
}

/// Verify a social proof by profile URL (linkedin / instagram / twitter) — the
/// backend auto-verifies a URL-only submission (no screenshot required).
Future<Map> uploadProofUrl(String category, String profileUrl) async {
  final form = FormData();
  form.fields.add(MapEntry('category', category));
  form.fields.add(MapEntry('profile_url', profileUrl));
  return _uploadProofPost(form);
}

Future<Map> _uploadProofPost(FormData form) async {
  late Response resp;
  try {
    resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/proof-upload',
      data: form,
      options: Options(
        headers: {'Authorization': _bearer()},
        receiveTimeout: const Duration(seconds: 120),
        validateStatus: (s) => true,
      ),
    );
  } on DioException {
    throw Exception('Connection error — please check your internet and try again.');
  }
  final body = resp.data is Map ? resp.data as Map : const {};
  if ((resp.statusCode ?? 0) >= 400) {
    final code = resp.statusCode;
    final serverMsg = (body['error'] ?? body['message'])?.toString();
    if (code == 503) throw Exception('AI service temporarily unavailable. Please try again in a moment.');
    if (code == 413) throw Exception('Photos are too large. Try selecting fewer photos.');
    if (code == 401 || code == 403) throw Exception('Session expired — please sign out and back in.');
    if (serverMsg != null && serverMsg.isNotEmpty && serverMsg.length < 200) throw Exception(serverMsg);
    throw Exception('Upload failed (error $code). Please try again.');
  }
  return body;
}

/// Permanently delete the account + all data (DELETE /api/verified-vibe/account).
/// Optional churn reason/feedback. The server also removes the auth user.
Future<void> deleteAccount({String? reason, String? feedback}) async {
  await _dio.delete(
    '${Config.apiBase}/api/verified-vibe/account',
    data: {if (reason != null) 'reason': reason, if (feedback != null && feedback.isNotEmpty) 'feedback': feedback},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

/// Human-readable trust tier (mirrors getTrustScoreLabel in trustScore.ts).
String trustLabel(int score) {
  if (score <= 0) return 'Not Verified';
  if (score < 25) return 'Minimal Trust';
  if (score < 50) return 'Low Trust';
  if (score < 75) return 'Medium Trust';
  if (score < 100) return 'High Trust';
  return 'Fully Verified';
}

// ── Tip / Attention ─────────────────────────────────────────────────────────

class TipSummary {
  final int total;
  final Map<String, int> tagCounts;
  final List<String> textSamples;
  const TipSummary({required this.total, required this.tagCounts, required this.textSamples});
}

/// Fetch aggregated tips received by the current user.
Future<TipSummary> fetchMyTips() async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return const TipSummary(total: 0, tagCounts: {}, textSamples: []);
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/tips',
    queryParameters: {'targetUserId': uid},
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final rawTags = body['tagCounts'];
  final tags = rawTags is Map
      ? rawTags.map((k, v) => MapEntry(k.toString(), (v is num ? v.toInt() : 0)))
      : <String, int>{};
  final texts = body['textSamples'] is List
      ? (body['textSamples'] as List).map((e) => e.toString()).toList()
      : <String>[];
  return TipSummary(
    total: (body['totalTips'] as num?)?.toInt() ?? 0,
    tagCounts: tags,
    textSamples: texts,
  );
}

Future<void> submitTip(String targetUserId, String submitterGender, List<String> tags, String? text) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/tips',
    data: {
      'targetUserId': targetUserId,
      'submitterGender': submitterGender,
      'tags': tags,
      if (text != null && text.isNotEmpty) 'text': text,
    },
    options: Options(headers: {'Content-Type': 'application/json'}),
  );
}

/// Send a secret-admirer / craving-attention note. messageType derived from the
/// sender's gender (man → craving_attention, woman → secret_admirer).
/// Throws 'already' if a note was already sent to this person (409).
Future<void> sendAttention(String recipientId, String senderGender, String content) async {
  final uid = Supabase.instance.client.auth.currentUser!.id;
  final messageType = senderGender == 'woman' ? 'secret_admirer' : 'craving_attention';
  try {
    await _dio.post(
      '${Config.apiBase}/api/verified-vibe/attention',
      data: {'senderId': uid, 'recipientId': recipientId, 'messageType': messageType, 'content': content},
      options: Options(headers: {'Content-Type': 'application/json'}),
    );
  } on DioException catch (e) {
    if (e.response?.statusCode == 409) throw 'already';
    rethrow;
  }
}

/// Generate an AI-written attention note via the live auto-gen endpoint.
/// [tone] is one of: flirty | professional | practical | bold. messageType is
/// derived from the sender's gender (man → craving_attention, woman → secret_admirer).
Future<String> autoGenAttention(String recipientId, String senderGender, String tone) async {
  final uid = Supabase.instance.client.auth.currentUser!.id;
  final messageType = senderGender == 'woman' ? 'secret_admirer' : 'craving_attention';
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/attention/auto-gen',
    data: {'senderId': uid, 'recipientId': recipientId, 'messageType': messageType, 'tone': tone},
    options: Options(headers: {'Content-Type': 'application/json'}),
  );
  final data = resp.data;
  final text = (data is Map ? data['text'] : null)?.toString().trim() ?? '';
  if (text.isEmpty) throw 'No message generated';
  return text;
}

// ── Onboarding ──────────────────────────────────────────────────────────────

/// A signed-in user still needs onboarding if their verified_vibe_users row has
/// no archetype yet (brand-new sign-up). Defaults to false on error so we don't
/// trap existing users in onboarding.
Future<bool> needsOnboarding() async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return false;
  try {
    final row = await Supabase.instance.client
        .from('verified_vibe_users')
        .select('archetype')
        .eq('id', uid)
        .maybeSingle();
    final a = row?['archetype'] as String?;
    return a == null || a.isEmpty;
  } catch (_) {
    return false;
  }
}

Future<void> saveGenderArchetype(String gender, String archetype) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) throw StateError('Not authenticated');
  final supabase = Supabase.instance.client;
  // verified_vibe_users has NOT NULL first_name/age, so seed placeholders for a
  // brand-new row (verification's ID/photos steps overwrite name/age/city).
  // Preserve existing identity fields if the row already exists.
  final existing = await supabase
      .from('verified_vibe_users')
      .select('first_name, age, city')
      .eq('id', uid)
      .maybeSingle();
  await supabase.from('verified_vibe_users').upsert({
    'id': uid,
    'is_seed': false, // real signup — mirror web (profileService.saveProfile)
    'gender': gender,
    'archetype': archetype,
    'first_name': existing?['first_name'] ?? 'New member',
    'age': existing?['age'] ?? 18,
    'city': existing?['city'] ?? '',
  }, onConflict: 'id');
}

/// Submit a verification step (id | liveness | photos | spending_or_qa).
/// Images go as base64 inside `data` (matches the web verify-step endpoint).
Future<Map> verifyStep(String step, Map<String, dynamic> data) async {
  // Refresh session if null (can happen after long inactivity during onboarding)
  if (Supabase.instance.client.auth.currentSession == null) {
    await Supabase.instance.client.auth.refreshSession();
  }
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/verify-step',
    data: {'step': step, 'data': data},
    options: Options(
      headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'},
      receiveTimeout: const Duration(seconds: 90),
    ),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  return (body['data'] as Map?) ?? body;
}

// ── Chat ────────────────────────────────────────────────────────────────────

String _bearer() {
  final s = Supabase.instance.client.auth.currentSession;
  if (s == null) throw StateError('Not authenticated');
  return 'Bearer ${s.accessToken}';
}

/// A conversation row (from /api/verified-vibe/chat/conversations). The
/// conversation id == match id (verified_vibe_matches.id).
class Conversation {
  final String id;
  final String? otherId; // matched user's UUID
  final String name;
  final int? age;
  final String? avatar;
  final String lastMessage;
  final String? lastMessageSenderId;
  final DateTime? lastMessageTime;
  final int unreadCount;
  final bool hasMessages;
  final String archetype; // raw code
  final String? gender;
  final int trustScore;
  /// AI Bestie wrapped up and is waiting for the woman (this viewer) to step in.
  final bool handoffPending;

  Conversation({
    required this.id,
    this.otherId,
    required this.name,
    required this.age,
    required this.avatar,
    required this.lastMessage,
    this.lastMessageSenderId,
    required this.lastMessageTime,
    required this.unreadCount,
    required this.hasMessages,
    required this.archetype,
    required this.gender,
    required this.trustScore,
    this.handoffPending = false,
  });
}

DateTime? _dt(dynamic v) => v == null ? null : DateTime.tryParse(v.toString());

Future<List<Conversation>> fetchConversations() async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/chat/conversations',
    options: Options(
      headers: {'Authorization': _bearer()},
      receiveTimeout: const Duration(seconds: 45),
    ),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : const {};
  final convos = (data['conversations'] as List?) ?? const [];
  return convos.whereType<Map>().map((c) {
    final u = (c['matchedUser'] as Map?) ?? const {};
    return Conversation(
      id: (c['id'] ?? c['matchId']).toString(),
      otherId: u['id'] as String?,
      name: (u['firstName'] ?? '—').toString(),
      age: u['age'] is num ? (u['age'] as num).toInt() : null,
      avatar: u['avatar'] as String?,
      lastMessage: (c['lastMessage'] ?? '').toString(),
      lastMessageSenderId: c['lastMessageSenderId'] as String?,
      lastMessageTime: _dt(c['lastMessageTime']),
      unreadCount: c['unreadCount'] is num ? (c['unreadCount'] as num).toInt() : 0,
      hasMessages: c['hasMessages'] == true,
      archetype: (u['archetype'] ?? '').toString(),
      gender: u['gender'] as String?,
      trustScore: u['trustScore'] is num ? (u['trustScore'] as num).toInt() : 0,
      handoffPending: c['handoffPending'] == true,
    );
  }).toList();
}

class ChatMessage {
  final String id;
  final String senderId;
  final String content;
  final bool isAi;
  final String? aiSignal;
  // Bestie's private "read" note on a received (man's) message — female-owner
  // eyes only. Rendered as the coaching card; never shown to the man.
  final String? aiRead;
  final DateTime? createdAt;

  ChatMessage({
    required this.id,
    required this.senderId,
    required this.content,
    required this.isAi,
    required this.aiSignal,
    required this.aiRead,
    required this.createdAt,
  });

  factory ChatMessage.fromApi(Map m) => ChatMessage(
        id: (m['id'] ?? '').toString(),
        senderId: (m['senderId'] ?? m['sender_id'] ?? '').toString(),
        content: (m['content'] ?? '').toString(),
        isAi: (m['isAi'] ?? m['is_ai']) == true,
        aiSignal: (m['aiSignal'] ?? m['ai_signal']) as String?,
        aiRead: (m['aiRead'] ?? m['ai_read']) as String?,
        createdAt: _dt(m['createdAt'] ?? m['created_at']),
      );
}

/// Bestie-driven in-chat proof request state on a match (spec §3 Step 3).
/// Category always comes from the woman's Bestie question; the man's proof
/// upload button only exists while a request is [active].
class ProofRequest {
  final String category;
  final String status; // pending | failed_attempt | refused | fulfilled | closed
  final int attempts;
  ProofRequest({required this.category, required this.status, required this.attempts});

  /// Request is open → show the man's proof upload affordance.
  bool get active => status == 'pending' || status == 'failed_attempt';

  static ProofRequest? fromApi(dynamic raw) {
    if (raw is! Map) return null;
    final cat = raw['category']?.toString();
    final st = raw['status']?.toString();
    if (cat == null || cat.isEmpty || st == null || st.isEmpty) return null;
    return ProofRequest(
      category: cat,
      status: st,
      attempts: (raw['attempts'] as num?)?.toInt() ?? 0,
    );
  }
}

/// AI Bestie CHECKLIST (spec §D/§F). The per-man list of things Bestie draws out
/// before the woman steps in. Drives the man's "she joins in" progress (done/total,
/// NOT a fixed 5) and the wrap-up hand-off (wrapped → his chat freezes). The mobile
/// side only needs the counts + status; the full item list stays server-side.
class BestieChecklist {
  final int total; // number of checklist items
  final int done;  // items marked done
  final String status; // active | wrapped
  BestieChecklist({required this.total, required this.done, required this.status});

  /// Bestie has wrapped up → the man's chat freezes until the woman steps in.
  bool get wrapped => status == 'wrapped';

  static BestieChecklist? fromApi(dynamic raw) {
    if (raw is! Map) return null;
    final items = raw['items'];
    if (items is! List) return null;
    final done = items.where((i) => i is Map && i['status'] == 'done').length;
    final st = raw['status']?.toString() ?? 'active';
    return BestieChecklist(total: items.length, done: done, status: st);
  }
}

class ConversationThread {
  final String? otherId;
  final String otherName;
  final String? otherAvatar;
  final String? otherGender;
  final bool aiBestieActive;
  final ProofRequest? proofRequest;
  final BestieChecklist? bestieChecklist;
  final List<ChatMessage> messages;
  ConversationThread({required this.otherId, required this.otherName, required this.otherAvatar, required this.otherGender, required this.aiBestieActive, this.proofRequest, this.bestieChecklist, required this.messages});
}

Future<ConversationThread> fetchConversation(String conversationId) async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/chat/$conversationId',
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : const {};
  final u = (data['matchedUser'] as Map?) ?? const {};
  final msgs = (data['messages'] as List?) ?? const [];
  return ConversationThread(
    otherId: u['id'] as String?,
    otherName: (u['firstName'] ?? 'Chat').toString(),
    otherAvatar: u['avatar'] as String?,
    otherGender: u['gender'] as String?,
    aiBestieActive: data['aiBestieActive'] != false, // default true; only false when explicitly off
    proofRequest: ProofRequest.fromApi(data['proofRequest']),
    bestieChecklist: BestieChecklist.fromApi(data['bestieChecklist']),
    messages: msgs.whereType<Map>().map(ChatMessage.fromApi).toList(),
  );
}

/// Resume AI Bestie for a match (sets ai_bestie_active = true). Turning it OFF
/// happens automatically when the woman sends her own message — she's stepping
/// in — so there's no explicit deactivate call.
Future<void> activateBestie(String conversationId) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/ai-bestie/activate',
    data: {'conversationId': conversationId},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

/// A started AI-bestie voice call — LiveKit room + join token.
class VoiceCallSession {
  final String callId;
  final String room;
  final String token;
  final String wsUrl;
  final String ownerName;
  VoiceCallSession({required this.callId, required this.room, required this.token, required this.wsUrl, required this.ownerName});
}

/// Start a voice call with the match's AI bestie. Throws with the server's
/// message on 403 (owner hasn't opted in) / 409 (call already in progress).
Future<VoiceCallSession> startVoiceCall(String matchId) async {
  try {
    final resp = await _dio.post(
      '${Config.apiBase}/api/voice/calls/start',
      data: {'matchId': matchId, 'consent': true},
      options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
    );
    final b = resp.data is Map ? resp.data as Map : const {};
    return VoiceCallSession(
      callId: (b['callId'] ?? '').toString(),
      room: (b['room'] ?? '').toString(),
      token: (b['token'] ?? '').toString(),
      wsUrl: (b['wsUrl'] ?? '').toString(),
      ownerName: (b['ownerName'] ?? 'her').toString(),
    );
  } on DioException catch (e) {
    final data = e.response?.data is Map ? e.response!.data as Map : const {};
    // Prefer the server's human-readable `message`; fall back to mapping the
    // `error` code, then a generic line. Never surface the raw code (e.g.
    // "not_enabled") to the user.
    final message = data['message']?.toString();
    if (message != null && message.trim().isNotEmpty) throw message;
    final code = data['error']?.toString();
    switch (code) {
      case 'not_enabled':
        throw 'Her AI bestie isn\'t taking calls yet.';
      case 'call_in_progress':
        throw 'A call is already in progress.';
      default:
        throw 'Could not start the call.';
    }
  }
}

/// Block + unmatch a user (records a pass + removes the match). matchId optional.
Future<void> blockUser(String blockedUserId, {String? matchId}) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/block-user',
    data: {'blockedUserId': blockedUserId, if (matchId != null) 'matchId': matchId},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

/// Soft unmatch: removes the match/conversation but leaves the person in the
/// pool, so they can still surface in Discover and re-match later. (Block is the
/// hard version that also hides them permanently.)
Future<void> unmatchUser(String matchedUserId, String matchId) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/unmatch',
    data: {'matchedUserId': matchedUserId, 'matchId': matchId},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

/// A user the caller has blocked (for the Blocked-users management list).
class BlockedUser {
  final String id;
  final String name;
  final int? age;
  final String? avatar;
  const BlockedUser({required this.id, required this.name, this.age, this.avatar});
}

/// Users the caller has blocked, most-recent first.
Future<List<BlockedUser>> fetchBlockedUsers() async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/blocked-users',
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : const {};
  final list = (data['blocked'] as List?) ?? const [];
  return list.whereType<Map>().map((u) => BlockedUser(
        id: (u['id'] ?? '').toString(),
        name: (u['firstName'] ?? '—').toString(),
        age: u['age'] is num ? (u['age'] as num).toInt() : null,
        avatar: u['avatar'] as String?,
      )).where((u) => u.id.isNotEmpty).toList();
}

/// Reverse a block (removes the bidirectional block rows). Does not recreate the
/// old match — they re-match through Discover if they reconnect.
Future<void> unblockUser(String blockedUserId) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/unblock-user',
    data: {'blockedUserId': blockedUserId},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

/// Report a user for objectionable content/behavior (separate from block).
/// [reason] is one of: inappropriate_content, harassment, fake_profile, scam, other.
/// The moderation team reviews every report within 24 hours.
Future<void> reportUser(
  String reportedUserId, {
  required String reason,
  String? description,
  String? matchId,
}) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/report-user',
    data: {
      'reportedUserId': reportedUserId,
      'reason': reason,
      if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
      if (matchId != null) 'matchId': matchId,
    },
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

/// A received secret-admirer / craving-attention message (inbox).
class Admirer {
  final String id;
  final String senderId;
  final String name;
  final int? age;
  final String? avatar;
  final String archetype;
  final String messageType; // secret_admirer | craving_attention
  final String content;
  final String? replyContent;
  final bool isRead;
  Admirer({
    required this.id,
    required this.senderId,
    required this.name,
    required this.age,
    required this.avatar,
    required this.archetype,
    required this.messageType,
    required this.content,
    required this.replyContent,
    required this.isRead,
  });
  bool get replied => replyContent != null && replyContent!.isNotEmpty;
}

/// Fetch received admirer messages for the signed-in user (marks them read).
Future<List<Admirer>> fetchAdmirers() async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return [];
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/attention',
    queryParameters: {'recipientId': uid},
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final msgs = (resp.data is Map ? resp.data['messages'] : null) as List? ?? const [];
  return msgs.whereType<Map>().map((m) => Admirer(
        id: (m['id'] ?? '').toString(),
        senderId: (m['senderId'] ?? '').toString(),
        name: (m['senderName'] ?? '—').toString(),
        age: m['senderAge'] is num ? (m['senderAge'] as num).toInt() : null,
        avatar: m['senderAvatar'] as String?,
        archetype: (m['senderArchetype'] ?? '').toString(),
        messageType: (m['messageType'] ?? 'secret_admirer').toString(),
        content: (m['content'] ?? '').toString(),
        replyContent: m['replyContent'] as String?,
        isRead: m['isRead'] == true,
      )).toList();
}

/// A sent admirer/craving-attention message (outbox).
class SentAdmirer {
  final String id;
  final String recipientId;
  final String name;
  final int? age;
  final String? avatar;
  final String archetype;
  final String messageType; // secret_admirer | craving_attention
  final String content;
  final String? replyContent;
  final String? replySentAt;
  final DateTime createdAt;
  SentAdmirer({
    required this.id,
    required this.recipientId,
    required this.name,
    required this.age,
    required this.avatar,
    required this.archetype,
    required this.messageType,
    required this.content,
    required this.replyContent,
    required this.replySentAt,
    required this.createdAt,
  });
  bool get replied => replyContent != null && replyContent!.isNotEmpty;
}

/// Fetch sent admirer/attention messages for the signed-in user.
Future<List<SentAdmirer>> fetchSentAdmirers() async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return [];
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/attention',
    queryParameters: {'senderId': uid, 'withDetails': 'true'},
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final msgs = (resp.data is Map ? resp.data['messages'] : null) as List? ?? const [];
  return msgs.whereType<Map>().map((m) => SentAdmirer(
        id: (m['id'] ?? '').toString(),
        recipientId: (m['recipientId'] ?? '').toString(),
        name: (m['recipientName'] ?? '—').toString(),
        age: m['recipientAge'] is num ? (m['recipientAge'] as num).toInt() : null,
        avatar: m['recipientAvatar'] as String?,
        archetype: (m['recipientArchetype'] ?? '').toString(),
        messageType: (m['messageType'] ?? 'craving_attention').toString(),
        content: (m['content'] ?? '').toString(),
        replyContent: m['replyContent'] as String?,
        replySentAt: m['replySentAt'] as String?,
        createdAt: DateTime.tryParse((m['createdAt'] ?? '').toString()) ?? DateTime.now(),
      )).toList();
}

/// Reply to an admirer message — creates a mutual match + seeds the chat.
/// Returns the matchId of the (new or existing) conversation.
Future<String?> replyToAdmirer(String messageId, String replyContent) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/attention/reply',
    data: {'messageId': messageId, 'replyContent': replyContent},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
  return (resp.data is Map ? resp.data['matchId'] : null) as String?;
}

/// Hand an admirer/attention message off to the AI Bestie — creates a match
/// with Bestie active, seeds the chat with his note, and lets Bestie reply.
/// Returns the matchId of the (new or existing) conversation.
Future<String?> replyToAdmirerWithBestie(String messageId) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/attention/reply-with-bestie',
    data: {'messageId': messageId},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
  return (resp.data is Map ? resp.data['matchId'] : null) as String?;
}

/// Mark a conversation as read — clears the unread badge on the Messages list.
Future<void> markConversationRead(String matchId) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return;
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/chat/mark-read',
    data: {'matchId': matchId, 'userId': uid},
    options: Options(
      headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'},
      validateStatus: (s) => true,
    ),
  );
}

Future<ChatMessage?> sendMessage(String conversationId, String content) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/chat/send',
    data: {'conversationId': conversationId, 'content': content},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : const {};
  final m = data['message'] as Map?;
  return m == null ? null : ChatMessage.fromApi(m);
}

/// After mobile onboarding completes, sync data from `verified_vibe_users` and
/// `verified_vibe_verification` into `user_master_profile` so the web profile
/// and AI context can read them. Also pushes profileDraft (name/age/city).
/// Fire-and-forget safe — catch errors at the call site.
Future<void> syncVerificationToMasterProfile() async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) return;
  final uid = session.user.id;

  // Run verification rows + user row fetches in parallel
  final results = await Future.wait<dynamic>([
    Supabase.instance.client
        .from('verified_vibe_verification')
        .select('step, data')
        .eq('user_id', uid)
        .eq('status', 'completed'),
    Supabase.instance.client
        .from('verified_vibe_users')
        .select('first_name, age, city')
        .eq('id', uid)
        .maybeSingle(),
  ]);

  final rows = results[0] as List;
  final userRow = results[1] as Map?;

  // Merge all `responses` fields from spending_or_qa rows
  final mergedResponses = <String, dynamic>{};
  for (final row in rows) {
    final data = row['data'] as Map?;
    final responses = data?['responses'];
    if (responses is Map) {
      mergedResponses.addAll(Map<String, dynamic>.from(responses));
    }
  }

  final payload = <String, dynamic>{};

  if (mergedResponses.isNotEmpty) {
    payload['onboarding'] = mergedResponses;
  }

  // Push profileDraft so web profile displays name/age/city without a separate save
  if (userRow != null) {
    final draft = <String, dynamic>{};
    final name = (userRow['first_name'] ?? '').toString();
    if (name.isNotEmpty) draft['firstName'] = name;
    if (userRow['age'] != null) draft['age'] = userRow['age'];
    final city = (userRow['city'] ?? '').toString();
    if (city.isNotEmpty) draft['city'] = city;
    if (draft.isNotEmpty) payload['profileDraft'] = draft;
  }

  if (payload.isEmpty) return;

  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: payload,
    options: Options(headers: {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    }),
  );
}

/// Current user's gender ('man' / 'woman') — gates the AI Wingman vs Bestie row.
Future<String?> fetchCurrentUserGender() async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return null;
  final row = await Supabase.instance.client
      .from('verified_vibe_users')
      .select('gender, archetype')
      .eq('id', uid)
      .maybeSingle();
  final g = row?['gender'] as String?;
  if (g != null && g.isNotEmpty) return g;
  final a = row?['archetype'] as String?;
  if (a != null && a.endsWith('_man')) return 'man';
  if (a != null && a.endsWith('_woman')) return 'woman';
  return null;
}


// ── Match detail (rich public profile) ─────────────────────────────────────

/// A named, tabbable verified-signal group (Career/Lifestyle/Health/Social).
class NamedSignal {
  final String emoji;
  final String label;
  final SignalGroup group;
  NamedSignal(this.emoji, this.label, this.group);
}

/// A labelled group of archetype answer chips (e.g. "Energy in a relationship").
class ChipGroup {
  final String label;
  final List<String> chips;
  ChipGroup(this.label, this.chips);
}

class MatchDetail {
  final String name;
  final int? age;
  final String? city;
  final String? avatar;
  final int trustScore;
  final String archetypeLabel;
  final String archetypeEmoji;
  final String? hereFor;
  final String? about;
  final List<String> vibeWords;
  final List<({String emoji, String text})> whatBrings;
  final List<String> travel;
  // Rich Public-Read sections
  final List<ChipGroup> archetypeChips;
  final List<NamedSignal> verifiedSignals;
  final List<GarageCar> garage;
  final String? annualIncome;
  final String? netWorth;
  final List<InsightChip> careerLines;
  final List<InsightChip> wealthInsights;
  final String? personalityPortraitUrl;
  final String? garagePortraitUrl;
  // Personality radar: decisiveness / warmth / openness / pace (0-100 each)
  final Map<String, int>? traitScores;
  // Gender-aware photo set (hero-first). `ai` marks AI-enhanced portraits (men).
  final List<({String url, bool ai})> photos;
  // Whether the hero (avatar) is an AI-enhanced portrait — drives the hero badge.
  final bool heroIsAi;

  MatchDetail({
    required this.name,
    required this.age,
    required this.city,
    required this.avatar,
    required this.trustScore,
    required this.archetypeLabel,
    required this.archetypeEmoji,
    required this.hereFor,
    required this.about,
    required this.vibeWords,
    required this.whatBrings,
    required this.travel,
    required this.archetypeChips,
    required this.verifiedSignals,
    required this.garage,
    required this.annualIncome,
    this.netWorth,
    required this.careerLines,
    required this.wealthInsights,
    required this.personalityPortraitUrl,
    required this.garagePortraitUrl,
    this.traitScores,
    this.photos = const [],
    this.heroIsAi = false,
  });
}

List<InsightChip> _parseChips(dynamic list) {
  final out = <InsightChip>[];
  if (list is List) {
    for (final i in list) {
      if (i is Map && i['label'] != null) {
        out.add(InsightChip(
          (i['emoji'] ?? '•').toString(),
          i['label'].toString(),
          inferred: i['inferred'] == true,
          from: i['from']?.toString(),
        ));
      }
    }
  }
  return out;
}

Future<MatchDetail> fetchMatchDetail(String profileId) async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/public-profile/$profileId',
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final d = (body['data'] is Map ? body['data'] as Map : const {});
  final brings = (d['whatBrings'] as List?) ?? const [];

  // Archetype chip groups
  final archetypeChips = <ChipGroup>[];
  if (d['archetypeChips'] is List) {
    for (final g in (d['archetypeChips'] as List)) {
      if (g is Map && g['chips'] is List) {
        archetypeChips.add(ChipGroup(
          (g['label'] ?? '').toString(),
          (g['chips'] as List).map((c) => c.toString()).toList(),
        ));
      }
    }
  }

  // Verified signals (ready-made groups with label/icon/insights/aggregated)
  final signals = <NamedSignal>[];
  if (d['verifiedSignals'] is List) {
    for (final s in (d['verifiedSignals'] as List)) {
      if (s is Map) {
        final chips = _parseChips(s['insights']);
        if (chips.isNotEmpty) {
          signals.add(NamedSignal(
            (s['icon'] ?? '•').toString(),
            (s['label'] ?? '').toString(),
            SignalGroup(chips, (s['aggregated'] ?? '').toString()),
          ));
        }
      }
    }
  }

  // Garage cars
  final garage = <GarageCar>[];
  if (d['garageCars'] is List) {
    for (final a in (d['garageCars'] as List)) {
      if (a is Map && a['make'] != null) {
        garage.add(GarageCar(
          make: (a['make'] ?? '').toString(),
          model: (a['model'] ?? '').toString(),
          year: a['year']?.toString(),
          color: a['color']?.toString(),
          vehicleType: a['vehicleType']?.toString(),
          inferred: a['inferred'] == true,
          from: a['from']?.toString(),
        ));
      }
    }
  }

  final money = d['moneyMatters'] as Map?;
  String? incomeNonEmpty(dynamic v) {
    final s = v?.toString().trim();
    return (s != null && s.isNotEmpty) ? s : null;
  }

  // Photo set — gender-aware, hero-first, AI-flagged (built server-side).
  final photos = <({String url, bool ai})>[];
  if (d['photos'] is List) {
    for (final p in (d['photos'] as List)) {
      if (p is Map && p['url'] is String && (p['url'] as String).startsWith('http')) {
        photos.add((url: p['url'] as String, ai: p['ai'] == true));
      }
    }
  }

  return MatchDetail(
    name: (d['firstName'] ?? '—').toString(),
    age: d['age'] is num ? (d['age'] as num).toInt() : null,
    city: d['city'] as String?,
    avatar: d['avatar'] as String?,
    trustScore: d['trustScore'] is num ? (d['trustScore'] as num).toInt() : 0,
    archetypeLabel: (d['archetypeName'] ?? DiscoveryProfile.prettyArchetype(d['archetype'] as String?)).toString(),
    archetypeEmoji: (d['archetypeEmoji'] ?? '✨').toString(),
    hereFor: d['hereFor'] as String?,
    about: d['about'] as String?,
    vibeWords: ((d['vibeWords'] as List?) ?? const []).map((e) => e.toString()).toList(),
    whatBrings: brings.whereType<Map>().map((b) => (emoji: (b['emoji'] ?? '•').toString(), text: (b['text'] ?? '').toString())).toList(),
    travel: ((d['travelLocations'] as List?) ?? const []).map((e) => e.toString()).toList(),
    archetypeChips: archetypeChips,
    verifiedSignals: signals,
    garage: garage,
    annualIncome: incomeNonEmpty(money?['annualIncome']),
    netWorth: incomeNonEmpty(money?['netWorth']),
    careerLines: _parseChips(money?['careerLines']),
    wealthInsights: _parseChips(money?['wealthInsights']),
    personalityPortraitUrl: incomeNonEmpty(d['personalityPortraitUrl']),
    garagePortraitUrl: incomeNonEmpty(d['garagePortraitUrl']),
    traitScores: d['traitScores'] is Map ? {
      for (final e in (d['traitScores'] as Map).entries)
        e.key.toString(): (e.value is num ? (e.value as num).toInt() : 0),
    } : null,
    photos: photos,
    heroIsAi: d['heroIsAi'] == true,
  );
}

/// AI advisor turn (Wingman for men, Bestie for women). userId in body; no
/// Bearer required by the endpoint. Returns the assistant's reply text.
/// A Bestie-prepared draft message the user can send to a match.
class AdvisorDraft {
  final String matchName;
  final String matchId;
  final String content;
  AdvisorDraft(this.matchName, this.matchId, this.content);
}

class AdvisorReply {
  final String reply;
  final List<AdvisorDraft> drafts;
  AdvisorReply(this.reply, this.drafts);
}

/// One turn with the advisor. `intent` is 'chat' | 'summary' | 'insights'
/// (summary/insights send an empty message and let the server build the prompt).
Future<AdvisorReply> askAdvisor({
  required bool wingman,
  required String message,
  required List<Map<String, String>> history,
  String intent = 'chat',
}) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) throw StateError('Not authenticated');
  final path = wingman ? 'ai-wingman' : 'ai-bestie';
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/$path/chat',
    data: {'userId': uid, 'message': message, 'intent': intent, 'history': history},
    options: Options(
      headers: {'Content-Type': 'application/json'},
      receiveTimeout: const Duration(seconds: 60),
    ),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final drafts = <AdvisorDraft>[];
  if (body['drafts'] is List) {
    for (final d in (body['drafts'] as List)) {
      if (d is Map && d['content'] != null) {
        drafts.add(AdvisorDraft(
          (d['matchName'] ?? 'your match').toString(),
          (d['matchId'] ?? '').toString(),
          d['content'].toString(),
        ));
      }
    }
  }
  return AdvisorReply((body['reply'] ?? body['error'] ?? '…').toString(), drafts);
}

/// A "what-if" lever in the match-intelligence panel (trust/standing deltas).
class IntelLever {
  final String label;
  final num trustBefore;
  final num trustAfter;
  IntelLever(this.label, this.trustBefore, this.trustAfter);
}

/// One match's standing in the "Where you stand" panel.
class MatchIntel {
  final String partnerName;
  final num? appeal;
  final int? standingRank;
  final int? standingPool;
  final List<String> checklist;
  final List<IntelLever> simulation;
  MatchIntel({
    required this.partnerName,
    required this.appeal,
    required this.standingRank,
    required this.standingPool,
    required this.checklist,
    required this.simulation,
  });
}

/// Fetch the advisor "Where you stand" intelligence (userId-in-query, no bearer).
Future<List<MatchIntel>> fetchMatchIntelligence() async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return [];
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/match-intelligence',
    queryParameters: {'userId': uid},
    options: Options(receiveTimeout: const Duration(seconds: 30)),
  );
  final matches = (resp.data is Map ? resp.data['matches'] : null) as List? ?? const [];
  return matches.whereType<Map>().map((m) {
    final sim = <IntelLever>[];
    if (m['simulation'] is List) {
      for (final s in (m['simulation'] as List)) {
        if (s is Map) {
          sim.add(IntelLever(
            (s['label'] ?? s['action'] ?? '').toString(),
            s['trustBefore'] is num ? s['trustBefore'] as num : 0,
            s['trustAfter'] is num ? s['trustAfter'] as num : 0,
          ));
        }
      }
    }
    return MatchIntel(
      partnerName: (m['partnerName'] ?? 'your match').toString(),
      appeal: m['appeal'] is num ? m['appeal'] as num : null,
      standingRank: m['standingRank'] is num ? (m['standingRank'] as num).toInt() : null,
      standingPool: m['standingPool'] is num ? (m['standingPool'] as num).toInt() : null,
      checklist: ((m['checklist'] as List?) ?? const []).map((e) => e.toString()).toList(),
      simulation: sim,
    );
  }).toList();
}

/// Proactive advisor greeting. Returns (id, content) or null if nothing new.
Future<({String id, String content})?> fetchGreeting() async {
  try {
    final resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/ai-greeting',
      data: const {},
      options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'},
          receiveTimeout: const Duration(seconds: 60)),
    );
    final b = resp.data is Map ? resp.data as Map : const {};
    final content = (b['content'] ?? '').toString();
    final id = (b['greetingId'] ?? '').toString();
    if (content.isEmpty) return null;
    return (id: id, content: content);
  } catch (_) {
    return null; // non-fatal — advisor still works without a greeting
  }
}

/// An AI Bestie flag shown when a woman views a man's profile on the discover screen.
class BestieFlag {
  final String level; // 'orange' | 'red'
  final String title;
  final String detail;
  BestieFlag(this.level, this.title, this.detail);
}

/// Fetches AI Bestie profile flags for a male profile. Non-fatal — returns [] on error.
Future<List<BestieFlag>> fetchBestieFlags(String profileId) async {
  try {
    final resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/bestie-profile-flags',
      data: {'profileId': profileId},
      options: Options(
        headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'},
        receiveTimeout: const Duration(seconds: 30),
      ),
    );
    final flags = (resp.data is Map ? resp.data['flags'] : null) as List? ?? const [];
    return flags.whereType<Map>().map((f) => BestieFlag(
      (f['level'] ?? 'orange').toString(),
      (f['title'] ?? '').toString(),
      (f['detail'] ?? '').toString(),
    )).toList();
  } catch (_) {
    return [];
  }
}

/// Thumbs feedback on a greeting. rating: 1 (helpful) or -1 (not helpful).
Future<void> submitGreetingFeedback(String greetingId, int rating, {String? reasonChip}) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/ai-feedback',
    data: {'greetingId': greetingId, 'rating': rating, if (reasonChip != null) 'reasonChip': reasonChip},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

/// Thumbs feedback on an advisor message (userId-in-body, no bearer).
Future<void> submitMessageFeedback({
  required bool wingman,
  required String messageContent,
  required bool positive,
  String? reasonChip,
}) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return;
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/ai-bestie/feedback',
    data: {
      'userId': uid,
      'assistantType': wingman ? 'wingman' : 'bestie',
      'feedbackType': positive ? 'positive' : 'negative',
      'messageContent': messageContent,
      if (reasonChip != null) 'reasonChip': reasonChip,
    },
    options: Options(headers: {'Content-Type': 'application/json'}),
  );
}

/// Upload an image to the `chat-images` Supabase storage bucket and return its public URL.
/// [bytes] is the raw image data; [ext] is the file extension (e.g. 'jpg', 'png').
Future<String> uploadChatImage(Uint8List bytes, String ext) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) throw StateError('Not authenticated');
  final path = '$uid/${DateTime.now().millisecondsSinceEpoch}.$ext';
  await Supabase.instance.client.storage
      .from('chat-images')
      .uploadBinary(
        path,
        bytes,
        fileOptions: FileOptions(contentType: 'image/$ext', upsert: false),
      );
  return Supabase.instance.client.storage.from('chat-images').getPublicUrl(path);
}

// ── AI Matchmaker ──────────────────────────────────────────────────────────

class MatchmakerStatus {
  final bool eligible;
  final int runsUsed;
  final int runsLimit;
  MatchmakerStatus({required this.eligible, required this.runsUsed, required this.runsLimit});
  int get remaining => (runsLimit - runsUsed).clamp(0, runsLimit);
}

class MatchmakerMatch {
  final String matchId;
  final String firstName;
  final int? age;
  final String? avatarUrl;
  final int score;
  MatchmakerMatch({required this.matchId, required this.firstName, this.age, this.avatarUrl, required this.score});
}

class MatchmakerResult {
  final String status; // 'matched' | 'no_match' | 'limit_reached' | 'needs_verification' | 'error'
  final MatchmakerMatch? match;
  final int? bestScore;
  final int? runsUsed;
  final int? runsLimit;
  final String? debugInfo; // temporary debug info
  MatchmakerResult({required this.status, this.match, this.bestScore, this.runsUsed, this.runsLimit, this.debugInfo});
}

Future<MatchmakerStatus> getMatchmakerStatus() async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/matchmaker/find-matches',
    options: Options(
      headers: {'Authorization': _bearer()},
      validateStatus: (s) => true,
    ),
  );
  debugPrint('[MM-status] HTTP ${resp.statusCode} body=${resp.data}');
  if ((resp.statusCode ?? 0) >= 400) {
    return MatchmakerStatus(eligible: false, runsUsed: 0, runsLimit: 3);
  }
  final body = resp.data is Map ? resp.data as Map : const {};
  final runsLimit = (body['runsLimit'] as num?)?.toInt() ?? 0;
  final status = MatchmakerStatus(
    eligible: body['eligible'] == true,
    runsUsed: (body['runsUsed'] as num?)?.toInt() ?? 0,
    runsLimit: runsLimit > 0 ? runsLimit : 3, // 0 = not set yet → default 3
  );
  debugPrint('[MM-status] eligible=${status.eligible} runsUsed=${status.runsUsed} runsLimit=${status.runsLimit}');
  return status;
}

Future<MatchmakerResult> runFindMatches() async {
  try {
    final resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/matchmaker/find-matches',
      options: Options(
        headers: {'Authorization': _bearer()},
        receiveTimeout: const Duration(seconds: 120),
        validateStatus: (s) => true,
      ),
    );
    if ((resp.statusCode ?? 0) >= 400) {
      final errBody = resp.data is Map ? (resp.data as Map)['error']?.toString() : resp.data?.toString();
      return MatchmakerResult(status: 'error', debugInfo: 'HTTP ${resp.statusCode}: $errBody');
    }
    final body = resp.data is Map ? resp.data as Map : const {};
    final status = (body['status'] ?? 'error').toString();
    MatchmakerMatch? match;
    if (status == 'matched' && body['match'] is Map) {
      final m = body['match'] as Map;
      match = MatchmakerMatch(
        matchId: m['matchId']?.toString() ?? '',
        firstName: m['firstName']?.toString() ?? '',
        age: (m['age'] as num?)?.toInt(),
        avatarUrl: m['avatarUrl']?.toString(),
        score: (m['score'] as num?)?.toInt() ?? 0,
      );
    }
    final runsLimit = (body['runsLimit'] as num?)?.toInt() ?? 0;
    return MatchmakerResult(
      status: status,
      match: match,
      bestScore: (body['bestScore'] as num?)?.toInt(),
      runsUsed: (body['runsUsed'] as num?)?.toInt(),
      runsLimit: runsLimit > 0 ? runsLimit : 3,
    );
  } on DioException catch (e) {
    return MatchmakerResult(status: 'error', debugInfo: 'DioException: ${e.type} ${e.message}');
  } catch (e) {
    return MatchmakerResult(status: 'error', debugInfo: 'catch: $e');
  }
}

/// Fetch an AI Bestie reply suggestion for [conversationId] (shown to women chatting with men).
/// Returns `{'suggestion': str, 'coaching': str?}`.
Future<Map<String, dynamic>> fetchWingmanSuggestion(String conversationId) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/ai-wingman/generate-response',
    data: {'conversationId': conversationId},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : const {};
  return {
    'suggestion': (data['suggestion'] ?? '').toString(),
    'coaching': data['coaching'] as String?,
  };
}
