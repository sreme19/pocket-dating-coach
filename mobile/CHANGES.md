# Mobile iOS UI Changes Log

## Session: 2026-06-12

### 1. Login Screen Redesign (`auth_screen.dart`)
Sebelumnya: toggle Sign in / Create account biasa, background putih, brand hanya icon kecil.

**Sekarang:**
- Background cream pink (`Config.bg1 = #FFF3F0`)
- Brand header: icon rounded-square dengan SVG mark riteangle (L-angle coral+pink + heart), wordmark dua warna `rite`**angle**, tagline "Trust-first dating" italic
- Form dalam white card dengan rounded corners + shadow
- Label "Email address" di atas input field
- Input field: fill pink tint, border hanya saat focus
- Tombol pill-shape "Send code →" / "Create account →"
- Privacy policy text dengan link pink di bawah tombol
- Segmented toggle dihapus → diganti dengan link "New here? Create an account →" di bawah card
- Logo SVG diport dari `src/lib/verified-vibe/components/RiteLogo.svelte` ke Flutter `CustomPainter`

---

### 2. Gate Screen Redesign (`onboarding_flow.dart` — `GateStep`)
Sebelumnya: background putih, tidak ada logo, title kecil, section label plain text.

**Sekarang (web parity):**
- Background cream pink
- Eyebrow: pulse dot + "RITEANGLE" uppercase
- Title italic besar 44px "Two questions. / *Then we move.*"
- Section labels dengan badge lingkaran bernomor 1/2 → berubah ✓ (pink) saat done
- Label section "I'm 18 or older" (bukan "Age confirmation")
- 18+ card: teks "Yes, I'm 18+" + custom checkbox box 26px rounded, radial gradient saat selected
- Gender cards: checkmark ✓ di pojok kanan atas saat selected + radial gradient background
- Button pill-shape: "Pick both to continue" → "Let's go →" saat ready
- Privacy text: "By continuing you agree to ID verification, our Terms and Privacy..."
- "Already a member? **Sign in →**" dengan styling pink
- **VERIFIED MEMBERS ONLINE NOW** carousel di bawah (auto-scroll, foto dari CDN Vercel)

---

### 3. Verified Members Carousel (`onboarding_flow.dart` — `LiveMembersCarousel`)
Widget baru (dibuat public agar bisa dipakai di screen lain).

- White card dengan border rounded 14px
- Header: pulse dot + "VERIFIED MEMBERS ONLINE NOW" + "10 live · 17 today"
- 17 profil seed (10 women + 7 men, interleaved) dari data yang sama dengan web
- Foto dari `https://pocket-dating-coach.vercel.app` + path foto
- Auto-scroll linear 28 detik, loop seamless (list diduplikasi)
- Status dot: pink (online) / abu-abu (offline)
- Nama + umur + "● Online" / "● Xh ago"

---

### 4. Pre-Auth Lane Screen (baru: `pre_auth_lane_screen.dart`)
Screen baru yang diinsert antara GateStep dan email form saat signup.

**Flow baru:**
```
Gate (gender + 18+)
  → "Let's go →"
    → Pick your lane (PreAuthLaneScreen) ← BARU
      → tap archetype
        → Email form (masukkan email)
          → OTP verify
            → OnboardingFlow (skip gate + lane, langsung verification)
```

**Fitur PreAuthLaneScreen:**
- Back arrow ke gate
- Eyebrow pulse dot + "RITEANGLE"
- Title italic besar: "Pick your / *lane.*"
- Urgency timer countdown (9:59 → 0:00) dengan banner pink
- "What are you here for?" + "Pick one. You can switch later."
- 2 collapsible sections: **❤️ SERIOUS CONNECTION** (pink pill) dan **✌️ LOW-PRESSURE** (purple pill)
- Setiap section berisi archetype cards dengan emoji + nama + tag + chevron
- Tap archetype → langsung lanjut ke email form
- Trust note: "We verify ID, photos, spending pattern & intent..."
- `LiveMembersCarousel` di bawah
- `pendingSignupArchetype` disimpan → `OnboardingFlow` auto-save ke backend dan skip lane step

---

### 5. Supabase Email Template (`supabase/email-templates/magic-link-otp.html`)
Template HTML custom untuk OTP email (mengganti default Supabase).

**Design:**
- Background `#FFF3F0` (cream pink)
- Brand header: SVG mark + "rite**angle**" + "Trust-first dating"
- Code ditampilkan besar (40px) dalam kotak pink dengan border
- `{{ .Token }}` = variable Supabase untuk 6-digit code
- "Expires in 10 minutes · Do not share this code"
- Footer dengan Privacy Policy & Terms links

**Cara pasang:**
1. Supabase Dashboard → project `stikoktiaxqtcsohcxzp`
2. Authentication → Email Templates → tab "Magic Link"
3. Subject: `Your riteangle sign-in code – {{ .Token }}`
4. Body: paste isi file `supabase/email-templates/magic-link-otp.html`

---

---

### 6. Archetype Detail Sheet (baru: `archetype_detail_sheet.dart`)
Pop-up bottom sheet yang muncul ketika user tap salah satu archetype di PreAuthLaneScreen. Mirrors `ArchetypeDetailModal.svelte` dari web.

**Fitur:**
- `showArchetypeDetailSheet(context, archetype, onLockIn: ...)` menggunakan `showModalBottomSheet` dengan `DraggableScrollableSheet` (initialChildSize: 0.88)
- Handle bar drag indicator
- Header: emoji box 54px rounded + "YOU'RE A" label + nama italic + tombol ✕ close
- Konten scrollable:
  - `longTag` description (italic)
  - **💚 YOU'LL MATCH WITH**: best match chips (pink border + 💎) + good fit chips (white + ✓)
  - **✕ YOU WON'T SEE**: avoid chips (red tint, strikethrough)
  - **✨ WHAT YOU BRING**: brings chips (white + ✓)
- Footer sticky: tombol "I'm a {name} {Man/Woman} — Let's go →" (accent pink pill)

**Save ke database:**
Tap "Let's go →" → `Navigator.pop()` + `onLockIn()` → `widget.onPick(archetypeId)` (di `PreAuthLaneScreen`)
→ `auth_screen.dart` simpan `pendingSignupArchetype = archetypeId`
→ setelah OTP auth → `OnboardingFlow.initState()` baca global → auto-call `_pickArchetype(id)`
→ `saveGenderArchetype(gender, archetypeId)` di `api.dart` (line 747) → upsert ke `verified_vibe_users`

---

### Files yang diubah/dibuat:
| File | Status |
|------|--------|
| `mobile/lib/auth_screen.dart` | Modified |
| `mobile/lib/onboarding_flow.dart` | Modified |
| `mobile/lib/pre_auth_lane_screen.dart` | **New** |
| `supabase/email-templates/magic-link-otp.html` | **New** |
