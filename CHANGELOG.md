# Riwayat perubahan

## 1.0.0 — 31 Oktober 2026
- **Ganti nama: Renik → Lexarach** (*lexicon* + *arachnid*). Ingatan lama tetap terbaca, dan cadangan lama tetap bisa diimpor.
- Kode dipecah menjadi modul di `src/` (`content/`, `background/`, `popup/`, `shared/`).
- Pintasan **Alt+R** untuk *Beri makan Lexarach* (bisa diubah di `chrome://extensions/shortcuts`).
- Kartu **Minggu ini** di tab Status: halaman, catatan baru, hari membaca, dan topik 7 hari terakhir.
- Logo baru (robot laba-laba) dan bahan Chrome Web Store.
- Nama dan deskripsi extension mengikuti bahasa browser (`_locales/`).
- Mencegah pemasangan ganda saat extension diperbarui.
- Dokumentasi: arsitektur, algoritma, dan kebijakan privasi.

## 0.9.2
- Keberanian bisa turun (dikagetkan, diseret saat tidur) dan naik (dielus).
- Bingkai luar jaring kini beranimasi (0.9.1).

## 0.9.0
- Bentuk robot laba-laba; rasa lapar dan kegiatan: istirahat, membersihkan diri, mengamati, melompat,
  merajut jaring, bergelantung.
- Perilaku saat makan di dekat pointer (ragu, mengendap, menyambar).

## 0.8.0
- Cadangan (ekspor/impor JSON, ekspor catatan Markdown), kontrol per situs, mode tidak mengganggu.
- Catatan ikut muncul di pencarian Ingatan.

## 0.7.1
- "Buka & sorot" mengabaikan perbedaan spasi, bisa lintas paragraf, dan mencoba ulang untuk halaman yang dimuat belakangan.

## 0.7.0
- Fitur Catatan (beri makan Lexarach lewat tombol atau klik kanan; lihat, ubah, hapus di menu).
- Tombol Lupakan untuk menghapus halaman tertentu dari ingatan.

## 0.6.0
- Gumaman kembali, kini berdasarkan fakta (kata baru, pengingat bacaan lama, minat, lama membaca).
- Tab Mimpi disembunyikan; statistik *Hari ini* menggantikan *Hubungan*.

## 0.5.0
- Sistem pertumbuhan dan fitur bicara dihapus agar Lexarach fokus sebagai teman membaca.
- Glitch saat masuk ke tab diperbaiki (kanvas dikosongkan, kaki diatur ulang, jangkauan kaki dibatasi).

## 0.4.0 dan sebelumnya
- Satu Lexarach untuk semua tab, masuk dari tepi layar sesuai arah perpindahan tab.
- Ingatan halaman dengan stemmer bahasa Indonesia, ringkasan TF-IDF, tandai halaman.
- Popup bergaya HUD; warna bisa diatur; Lexarach bisa ditidurkan dan dipindah.
- Purwarupa pertama: organisme kanvas yang memakan kata.
