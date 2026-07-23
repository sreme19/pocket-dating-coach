# Test Case QA — riteangle v1.0.5 (Build 34)

Dibuat dari commit yang masuk ke `main` pada 21–22 Juli 2026.  
Semua test case membutuhkan: akun pria yang sudah terverifikasi dengan ≥1 match aktif (wanita dengan AI Bestie aktif).

---

## Fitur 01 — Upload Bukti di Chat: Maksimal 10 Foto + Panduan Wajah
**Commit:** `ccd8ea9`  
**Lokasi di app:** Tab Chat → buka percakapan aktif → tap ikon 📎 di kotak pesan

| ID | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|------|-----------------------|--------|---------|
| TC-01 | Upload 1 foto sebagai bukti di dalam chat aktif | Bukti terkirim; Bestie mengakuinya di pesan berikutnya | ⬜ Pending | |
| TC-02 | Upload tepat 10 foto dalam satu sesi bukti | Semua 10 foto diterima, tidak ada pesan error batas | ⬜ Pending | |
| TC-03 | Upload foto tanpa wajah yang terlihat jelas | Ditolak + muncul panduan posisi wajah | ⬜ Pending | |
| TC-04 | Coba upload foto ke-11 | Upload diblokir atau dibatasi di 10 dengan pesan yang jelas | ⬜ Pending | |

---

## Fitur 02 — Sheet Trust & Boost (Setelah Verifikasi)
**Commit:** `71b3f6c`  
**Lokasi di app:** Tab Chat → buka percakapan aktif → upload bukti → tunggu verifikasi selesai

| ID | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|------|-----------------------|--------|---------|
| TC-05 | Upload foto bukti yang lolos verifikasi | Sheet "Trust & Boost" muncul otomatis dari bawah | ⬜ Pending | |
| TC-06 | Baca isi sheet Trust & Boost | Sheet menampilkan kategori yang terverifikasi dan perubahan trust score | ⬜ Pending | |
| TC-07 | Tutup sheet (swipe ke bawah / tap close) | Sheet tertutup; pengguna kembali ke chat tanpa kehilangan posisi scroll | ⬜ Pending | |

---

## Fitur 03 — Bestie: Undangan Bukti Proaktif Sesuai Preferensi Wanita
**Commit:** `4ec917b`  
**Lokasi di app:** Tab Chat → buka percakapan aktif yang ada Bestie-nya → kirim pesan berisi info personal

| ID | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|------|-----------------------|--------|---------|
| TC-08 | Pria menyebut pekerjaan/kantor ("saya kerja di startup") | Bestie mengundang upload bukti karir/LinkedIn dengan estimasi manfaat | ⬜ Pending | |
| TC-09 | Pria menyebut travel ("baru balik dari Jepang") | Bestie mengundang upload bukti perjalanan | ⬜ Pending | |
| TC-10 | Pria menyebut gym/fitness | Bestie mengundang upload bukti disiplin | ⬜ Pending | |
| TC-11 | Bestie sudah mengundang satu kategori; kirim pesan berikutnya | Tidak ada undangan ulang untuk kategori yang sama di pesan berturut-turut | ⬜ Pending | |
| TC-12 | Pria menolak secara eksplisit ("tidak mau, makasih") | Bestie merespons dengan baik; kategori tersebut tidak diangkat lagi | ⬜ Pending | |

---

## Fitur 04 — Gerbang Hand-off Bestie: Percakapan Harus Berisi
**Commit:** `af22d06`  
**Lokasi di app:** Tab Chat → buka percakapan aktif yang ada Bestie-nya → perhatikan kapan Bestie menyerahkan ke pria

| ID | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|------|-----------------------|--------|---------|
| TC-13 | Kirim 10+ pesan singkat tanpa isi ("haha", "oke", "mantap") | Bestie TIDAK hand off; terus menggali informasi bermakna | ⬜ Pending | |
| TC-14 | Chat normal dan upload minimal 1 bukti terverifikasi | Hand-off baru bisa terjadi setelah syarat isi terpenuhi | ⬜ Pending | |
| TC-15 | Pria cerita hal nyata (kota, pekerjaan, gaya hidup) tanpa upload bukti | Syarat isi terpenuhi; hand-off bisa lanjut jika syarat lain terpenuhi | ⬜ Pending | |

---

## Fitur 05 — Gerbang Hand-off Bestie: Bukti Harus Sesuai Nilai Wanita
**Commit:** `a4696f5`  
**Lokasi di app:** Tab Chat → buka percakapan aktif → cek profil wanita untuk lihat nilai/preferensinya → upload bukti yang sesuai/tidak sesuai

| ID | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|------|-----------------------|--------|---------|
| TC-16 | Wanita values "karir"; pria hanya upload bukti travel | Gerbang belum terpenuhi; Bestie minta bukti karir dulu sebelum hand-off | ⬜ Pending | |
| TC-17 | Wanita values "travel"; pria upload foto travel terverifikasi | Gerbang terpenuhi; hand-off lanjut jika syarat lain terpenuhi | ⬜ Pending | |

---

## Fitur 06 — Bestie Tidak Menggali Topik yang Sama Lebih dari 2 Kali
**Commit:** `dfac9b4`  
**Lokasi di app:** Tab Chat → buka percakapan aktif yang ada Bestie-nya → perhatikan pola pertanyaan Bestie

| ID | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|------|-----------------------|--------|---------|
| TC-18 | Bestie tanya kota asal 2 kali; pria hindari keduanya | Pesan ketiga berganti topik — tidak menanyakan kota lagi | ⬜ Pending | |
| TC-19 | Perhatikan 5 pesan Bestie berturut-turut di percakapan baru | Tidak ada satu topik yang ditanyakan lebih dari 2 kali; topik berganti | ⬜ Pending | |

---

## Fitur 07 — Bestie: Respons Hangat Setelah Upload Bukti
**Commit:** `4bf0f20`  
**Lokasi di app:** Tab Chat → buka percakapan aktif yang ada Bestie-nya → upload dan verifikasi bukti di tengah percakapan → perhatikan balasan Bestie

| ID | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|------|-----------------------|--------|---------|
| TC-20 | Upload dan verifikasi bukti disiplin di tengah percakapan | Balasan Bestie berikutnya menyebut kategori bukti dengan hangat (sekali), lalu lanjut chat | ⬜ Pending | |
| TC-21 | Cek panjang dan nada balasan Bestie | Maksimal 2 kalimat, tidak berlebihan; percakapan tetap natural | ⬜ Pending | |

---

## Fitur 08 — Tombol Verify di Chat: Hanya Foto (Bukan Dokumen)
**Commit:** `074caf1`  
**Lokasi di app:** Tab Chat → buka percakapan aktif → tap tombol 📎 Verify di kotak pesan

| ID | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|------|-----------------------|--------|---------|
| TC-22 | Tap tombol 📎 Verify di dalam chat aktif | Picker foto terbuka — hanya pilihan kamera/galeri yang muncul, tidak ada opsi dokumen | ⬜ Pending | |
| TC-23 | Coba lampirkan PDF atau file dokumen via Verify | Opsi dokumen tidak tersedia; hanya foto yang bisa dipilih | ⬜ Pending | |
| TC-24 | Upload foto valid via tombol Verify di chat | Foto diterima dan alur bukti berjalan normal | ⬜ Pending | |

---

## Ringkasan

| Total | Lulus | Gagal | Pending |
|-------|-------|-------|---------|
| 24 | 0 | 0 | 24 |

**Penguji:** _______________  
**Tanggal pengujian:** _______________  
**Build yang diuji:** v1.0.5 (34/35) — Production (riteangle.dating)
