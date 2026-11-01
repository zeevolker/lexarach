# Bahan Chrome Web Store

Semua yang perlu disalin ke [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
Gambar ada di `store/images/`; paket unggahan dibuat dengan `store/build-zip.ps1`.

---

## 1. Tab "Package"
Unggah `lexarach-1.0.0.zip`.

## 2. Tab "Store listing"

**Category:** Productivity → Tools (alternatif: Education)
**Language:** Indonesian (tambahkan English sebagai bahasa kedua)

### Deskripsi (Bahasa Indonesia)
```
Lexarach adalah laba-laba robot kecil yang hidup di halaman yang Anda baca. Ia memakan kata, mengingat bacaan Anda, dan membantu Anda menemukannya lagi kapan saja.

🔎 INGATAN BACAAN
Setiap halaman yang Anda baca lebih dari 8 detik dicatat: kata kunci dan kalimat intinya. Cari dengan kata apa pun. Lexarach memahami imbuhan bahasa Indonesia, jadi "dimangsa" tetap menemukan halaman yang berisi "memangsa".

🖍️ BUKA & SOROT
Buka hasil pencarian dan kalimat yang cocok langsung disorot di halaman.

📝 CATATAN SEKALI KLIK
Blok teks lalu klik "Beri makan Lexarach", klik kanan, atau tekan Alt+R. Kutipan tersimpan bersama sumbernya dan bisa dicari, diubah, atau diekspor ke Markdown.

📄 RINGKAS & TANDAI
Pilih 3–5 kalimat inti halaman mana pun dan tandai langsung di halaman.

📊 LAPORAN MINGGUAN
Lihat berapa halaman yang Anda baca, berapa catatan yang Anda simpan, dan topik apa yang paling sering Anda baca minggu ini.

🕷️ BENAR-BENAR HIDUP
Lexarach bisa lapar, beristirahat, membersihkan diri, melompat, merajut jaring, dan bergelantung. Kepribadiannya (rasa ingin tahu, keberanian, energi) berubah sesuai kebiasaan membaca Anda dan cara Anda memperlakukannya. Ia juga bergumam tentang hal yang ia temukan, misalnya bacaan lama yang mirip dengan halaman ini.

🔒 PRIVASI PENUH
• Semua data tersimpan di komputer Anda. Tidak ada server, akun, analitik, atau pelacak.
• Situs bank, surel, dan halaman login tidak dibaca sama sekali.
• Aktifkan, sembunyikan (Alt+H), atau nonaktifkan untuk semua situs, atau atur per situs.
• Seret Lexarach ke mana saja di layar.
• Mode tidak mengganggu: meredup saat Anda mengetik dan bersembunyi saat menonton video.
• Ekspor/impor cadangan kapan saja.

Antarmuka tersedia dalam Bahasa Indonesia dan English. Warna Lexarach bisa diatur sesuka Anda.
```

### Description (English)
```
Lexarach is a tiny robot spider that lives on the pages you read. It eats words, remembers your reading, and helps you find it again whenever you need it.

🔎 READING MEMORY
Every page you read for more than 8 seconds is remembered: its keywords and key sentences. Search with any word; Lexarach understands Indonesian affixes, so a word still matches its other forms.

🖍️ OPEN & HIGHLIGHT
Open a search result and the matching sentence is highlighted on the page.

📝 ONE-CLICK NOTES
Select text, then click "Feed Lexarach", use the right-click menu, or press Alt+R. Quotes are saved with their source and can be searched, edited, or exported to Markdown.

📄 SUMMARIZE & HIGHLIGHT
Pick the 3–5 key sentences of any page and highlight them in place.

📊 WEEKLY REPORT
See how many pages you read, how many notes you saved, and your top topics this week.

🕷️ TRULY ALIVE
Lexarach gets hungry, rests, grooms, jumps, weaves webs and swings on a thread. Its personality (curiosity, boldness, energy) changes with your reading habits and how you treat it. It also murmurs about what it notices, such as an older page you read on the same topic.

🔒 PRIVATE BY DESIGN
• All data stays on your computer. No servers, accounts, analytics or trackers.
• Banking, email and login pages are never read.
• Turn it on, hide it (Alt+H), or turn it off on all sites, or per site.
• Drag Lexarach anywhere on screen.
• Calm mode: dims while you type and hides during fullscreen video.
• Export/import backups at any time.

Interface in English and Indonesian. Colors are fully customizable.
```

### Gambar
| Kolom | File |
|---|---|
| Store icon (128×128) | `images/store-icon-128.png` |
| Screenshots (1280×800, maks. 5) | `images/screenshot-id-1…5.png` (Indonesia), `images/screenshot-en-1…5.png` (English) |
| Small promo tile (440×280) | `images/promo-small-440x280.png` |
| Marquee promo tile (1400×560, opsional) | `images/promo-marquee-1400x560.png` |

**Official URL / Homepage:** `https://github.com/zeevolker/lexarach`
**Support URL:** `https://github.com/zeevolker/lexarach/issues`

## 3. Tab "Privacy practices"

**Single purpose:**
```
Lexarach is a reading companion: it remembers the pages a user reads (keywords and key sentences, stored only on the user's device) so the user can search them again, save highlighted text as notes, and summarize pages, presented as an animated spider on the page.
```

**Permission justification:**
| Izin | Isi kolom |
|---|---|
| `storage` | Stores the user's reading memory, notes and settings locally in chrome.storage.local. Nothing is sent off the device. |
| `alarms` | Runs a local memory-consolidation task every 30 minutes (strengthens frequent words, fades rare ones, links related words). |
| `scripting` | After install or update, injects the content scripts into tabs that were already open, so the user does not need to reload them. |
| `contextMenus` | Adds the "Feed Lexarach" item to the right-click menu for selected text, which saves it as a note. |
| Host permission (`http://*/*`, `https://*/*`) | The core feature reads the visible text of the pages the user reads, on any site the user chooses, to build the local reading memory and summaries. Users can disable it per site; banking, email and login pages are excluded. |
| Remote code | **No**, I am not using remote code. All JavaScript is bundled in the package. |

**Data usage** (centang yang sesuai; semua tetap di perangkat):
- ☑ **Web history**: judul dan URL halaman yang dibaca (disimpan lokal untuk fitur Ingatan)
- ☑ **Website content**: kata kunci dan kalimat inti halaman, serta teks yang dipilih pengguna sebagai catatan
- Centang ketiga pernyataan: tidak dijual ke pihak ketiga, tidak dipakai untuk tujuan di luar fungsi inti, tidak dipakai untuk kelayakan kredit/pinjaman.

**Privacy policy URL:** `https://github.com/zeevolker/lexarach/blob/main/PRIVACY.md`

## 4. Tab "Distribution"
Free · Public (atau *Unlisted* dulu untuk uji coba) · semua wilayah.
