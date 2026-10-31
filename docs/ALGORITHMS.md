# Algoritma di Balik Lexarach

Semua algoritma ditulis sendiri dalam JavaScript murni, tanpa library. Dokumen ini menjelaskan
idenya, rumusnya, dan letaknya di kode.

---

## 1. Ringkasan & kata kunci: TF-IDF ekstraktif
`src/content/insight.js` → `analyze()`, `summarize()`, `indexPage()`

1. Teks halaman diambil dari blok yang terlihat (`p`, `li`, `h1–h3`, …), lalu menu, iklan, dan formulir dilewati.
2. Teks dipecah menjadi kalimat, lalu tiap kata diubah ke kata dasar (lihat §2).
3. **TF** = frekuensi kata dasar di halaman ÷ frekuensi tertinggi.
4. **IDF** tidak memakai korpus luar. Lexarach memakai pengalamannya sendiri: kata yang sudah sangat
   sering ia makan di mana-mana dianggap umum.

```
bobot(k) = TF(k) × 1 / (1 + 0.3 · ln(1 + kaliDilihat(k)))
skor(kalimat) = Σ bobot(k unik) / √(jumlah kata)  ×  (1 + 0.25 · (1 − posisi/total))
```

Pembagian dengan √panjang mencegah kalimat panjang selalu menang. Faktor posisi sedikit
mengutamakan kalimat di awal artikel, karena biasanya berisi inti berita. Ringkasan mengambil 3–5 kalimat
terbaik lalu mengurutkannya kembali sesuai urutan di halaman. Indeks halaman menyimpan 30 kata kunci
dan 6 kalimat (maks. 220 karakter) sebagai cuplikan pencarian.

## 2. Stemmer bahasa Indonesia
`src/shared/lang.js` → `stemsId()`

Versi sederhana dari algoritma Nazief–Adriani, **tanpa kamus**:

1. Buang partikel (`-lah -kah -tah -pun`) lalu kata ganti (`-ku -mu -nya`).
2. Buang **awalan** sampai dua putaran (`di- ke- se- ter- per- ber- me- pe-` dengan aturan peluluhan).
3. Buang **akhiran** `-kan`/`-an`, serta `-i` hanya bila kata tadi berawalan.

Tanpa kamus, beberapa awalan ambigu: *memakan* → **makan**, sedangkan *memukul* → **pukul**. Keduanya
berbentuk `mem + vokal`. Karena itu fungsi mengembalikan **dua kandidat** (`[pakan, makan]`). Saat mencari,
dua kata dianggap sama bila kandidatnya beririsan. Hasilnya, "dimangsa" menemukan "memangsa", dan kesalahan
pemotongan tidak merusak pencarian.

Awalan diproses **sebelum** akhiran (urutan Nazief–Adriani), supaya kata seperti *pemakan* tidak terpotong
menjadi *pemak*.

## 3. Mengingat bacaan lama (RECALL)
`src/background/background.js`

Saat Anda membaca halaman, kata kunci halaman itu dibandingkan dengan semua halaman di indeks:

```
skor(halaman lama) = Σ bobot kata kunci yang sama   (minimal 2 kata yang sama)
```

Halaman yang sama, atau yang baru dibuka < 10 menit lalu, dilewati. Bila skor ≥ 0,8, Lexarach bergumam:
*"kamu pernah membaca soal harimau dan hutan di kompas.com, 3 hari lalu"*.

## 4. Gerak: steering behaviors
`src/content/06-motion.js` → `updateBody()`

Memakai model kendali Craig Reynolds. Setiap bingkai dihitung **kecepatan yang diinginkan**, lalu:

```
gaya = batasi(diinginkan − kecepatan, maxForce)
kecepatan += gaya · dt
```

- `maxSpeed = 35 + 100·energi`, `maxForce = 320 + 320·energi` (px/s, px/s²)
- **Arrive**: melambat secara linear di dalam radius tertentu, jadi berhenti tanpa melewati target.
- **Wander**: sudut acak yang berubah pelan sehingga jalan-jalan tampak alami.
- **Lari-berhenti** (*burst*): laba-laba sungguhan bergerak cepat lalu diam sejenak.

Keputusan "mau ke mana" adalah mesin keadaan sederhana dengan prioritas:
perintah makan → masuk layar → kabur → mencerna → kegiatan → incaran dekat pointer → reaksi pointer → berburu → jalan-jalan.

## 5. Kaki: inverse kinematics dua tulang
`src/content/01-body.js` → `solveKnee()`

Tiap kaki terdiri dari paha (L1 = 32) dan betis (L2 = 36). Jika posisi pinggul dan telapak diketahui,
sudut lutut dihitung dengan **hukum kosinus**:

```
d = |telapak − pinggul|   (dibatasi ≤ L1 + L2)
a = acos((L1² + d² − L2²) / (2·L1·d))
sudutPaha = atan2(dy, dx) + arahTekuk · a
```

`arahTekuk` **tetap per kaki**: kaki depan menekuk ke luar sisi tubuh, kaki belakang ke arah sebaliknya.
Sebelumnya arah ini dipilih ulang setiap bingkai, sehingga lutut sering "melompat" ke sisi lain. Dengan
arah tetap, lompatan lutut menjadi 0 dalam pengujian.

## 6. Gaya berjalan tetrapod
`src/content/01-body.js` → `updateLegs()`

Delapan kaki dibagi dua kelompok berselang-seling (L1-R2-L3-R4 dan R1-L2-R3-L4), seperti laba-laba asli.
Fase langkah digerakkan oleh **jarak tempuh**, bukan waktu (`gaitPhase += kecepatan·dt / STRIDE`),
jadi kaki berhenti saat tubuh berhenti. Setiap setengah siklus, kelompok yang mendapat giliran memindahkan
kakinya ke titik di depan pinggul (diprediksi dari kecepatan), dibatasi 94% panjang kaki agar tidak
pernah lurus kaku. Saat diangkat, lutut didorong sedikit ke luar untuk ilusi 3D.

## 7. Melompat: parabola
`src/content/05-activity.js` → `startJump()`, `updateAirborne()`

```
z(p) = 4 · h · p · (1 − p),   p ∈ [0, 1]
```

Tinggi puncak `h = min(60, 22 + 0,12·jarak)`. Tubuh digambar naik setinggi `z`, sedangkan bayangan tetap di
tanah dan mengecil, sehingga lompatan 2D terlihat 3D. Sebelum terbang ada fase jongkok, dan selama terbang
ada benang pengaman (*dragline*).

## 8. Bergelantung: bandul teredam
`src/content/05-activity.js`

```
ω' = −(g / L) · sin θ − c · ω       (g = 900, c = 0.35)
θ += ω · dt,   posisi = jangkar + L · (sin θ, cos θ)
```

Integrasi Euler semi-implisit. Sesekali Lexarach "menendang" untuk mengayun, dan pointer yang lewat
cepat ikut mendorongnya. Setelah itu ia memanjat sambil benang memendek.

## 9. Merajut jaring: tiga fase
`src/content/05-activity.js` → `startWeb()`, `webPoint()`

| Progres | Fase | Yang digambar |
|---|---|---|
| 0–0,30 | Jari-jari | Garis dari pusat ke tiap titik jangkar, satu per satu |
| 0,30–0,48 | Bingkai | Poligon luar menghubungkan ujung jari-jari |
| 0,48–1 | Spiral | Spiral dari luar ke dalam; Lexarach berjalan mengikuti titik spiral |

Gambar jaring dan posisi Lexarach dihitung dari satu nilai progres yang sama, jadi benang selalu
keluar tepat dari nosel pemintal.

## 10. Asosiasi saat tidur: kemiripan Jaccard
`src/background/background.js` → `dreamCycle()` (alarm tiap 30 detik)

Untuk kata "isi" (bukan kata umum, panjang ≥ 4), Lexarach mengumpulkan **tetangga**: kata yang muncul
tepat sebelum atau sesudahnya. Dua kata dianggap berhubungan bila konteksnya mirip:

```
J(A, B) = |tetangga(A) ∩ tetangga(B)| / |tetangga(A) ∪ tetangga(B)|   ≥ 0.25
```

Contoh: "harimau" dan "kucing" sama-sama muncul sebelum "suka …" dan "hidup di …". Setiap kata
menyimpan maksimal 5 hubungan, dan hubungan ini memperluas pencarian di Ingatan. Di siklus yang sama,
kenangan kuat diperkuat dan yang samar dipudarkan, sehingga *Minat Anda* tetap relevan.

## 11. Kepribadian
Tiga nilai 0,05–0,95 yang berubah pelan karena perilaku pengguna:

| Sifat | Pengaruh pada perilaku | Berubah karena |
|---|---|---|
| Rasa ingin tahu | Bobot kata baru saat memilih incaran | Kata baru +0,003; kata dikenal −0,001 |
| Keberanian | Berani makan dekat pointer, jarang kabur | Situs baru +0,004; dielus +0,003; dikagetkan −0,006 |
| Energi | Kecepatan, frekuensi lompat & jalan-jalan | Tiap kata +0,001; tiap halaman ×0,997 |

"Dikagetkan" berarti pointer bergerak cepat (> 1400 px/s, dalam radius 130 px) menuju tubuhnya. "Dielus" berarti pointer pelan
di dekatnya selama ±2,5 detik.

## 12. Privasi sejak rancangan
`src/content/00-setup.js`

- Domain bank, surel, dan pesan, serta subdomain berlabel `login`, `auth`, `mail`, `bank`, …, tidak dimuat sama sekali.
- Halaman dengan kolom kata sandi tidak dibaca.
- Kolom isian, `textarea`, `contenteditable`, serta kode dilewati saat memindai; formulir, menu, dan footer tidak ikut diringkas.
- URL disimpan tanpa `?query` dan `#hash`, sehingga token tidak ikut tersimpan.
- Tidak ada `fetch`, analitik, atau server. Semua data ada di `chrome.storage.local`.
- Sorotan memakai **CSS Custom Highlight API**, jadi DOM halaman tidak diubah.
