// ============================================================
// src/content/03-voice.js — Pesan singkat & gumaman berbasis fakta
// Bagian dari tubuh Lexarach. Semua file di src/content/ berbagi variabel yang sama
// (urutan dimuat diatur di manifest.json). Listener baru dipasang di main().
// ============================================================

// ==========================================================
// 8b. PESAN SINGKAT di panel HUD (mis. "ini yang kamu cari")
// ==========================================================
let speech = null;       // { text, start, until }

// ==========================================================
// 8c. GUMAMAN — selalu berdasarkan FAKTA, bukan kata acak
// ==========================================================
// Dua jenis:
//   - karena KEJADIAN: makan kata baru, kata yang sering muncul, kenyang,
//     teringat bacaan lama yang mirip (RECALL), tempat baru
//   - SESEKALI (tiap ±25–55 detik): sudah lama membaca, halaman sepi,
//     halaman ini membahas topik favoritmu
// Aturannya: jeda minimal 9 detik antar gumaman, dan topik yang sama
// tidak diulang di halaman yang sama.
let lastSayAt = 0;
const saidHere = new Set();
let nextMurmur = performance.now() + 25000 + Math.random() * 20000;
let pageTerms = [];        // kata kunci halaman ini (dari indexNow)

function say(text, { key = null, force = false } = {}) {
  const now = performance.now();
  if (!text || asleep) return;
  if (key && saidHere.has(key)) return;
  if (!force && now - lastSayAt < 9000) return;
  if (key) saidHere.add(key);
  lastSayAt = now;
  speech = { text, start: now, until: now + 3000 + text.length * 60 };
}

function agoText(ms) {
  const A = STR[uiLang()].ago;
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return A.now;
  if (m < 60) return A.min(m);
  if (h < 24) return A.hour(h);
  return d === 1 ? A.yesterday : A.day(d);
}

// Minat = 5 kata terkuat di ingatan (bukan kata umum).
function topInterests() {
  const now = Date.now();
  return Object.entries(memory?.words ?? {})
    .filter(([w]) => w.length >= 4 && !LexarachLang.STOP.has(w))
    .map(([w, d]) => [w, d.strength * Math.pow(0.5, (now - d.lastSeen) / (2 * 864e5))])
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
}

function updateSpeech(now) {
  if (speech && now > speech.until) speech = null;
  if (asleep || entering || speech || now < nextMurmur) return;
  nextMurmur = now + 25000 + Math.random() * 30000;
  // Pilih gumaman pertama yang memang sesuai keadaan sekarang.
  const minutes = Math.floor(readTime / 60);
  const fav = pageTerms.find(w => topInterests().includes(w));
  const options = [
    [minutes >= 5, 'long', () => T('longRead', minutes)],
    [!!fav, 'interest', () => T('interest', fav)],
    [readTime > 25 && candidates.length === 0, 'quiet', () => T('quiet')]
  ];
  for (const [ok, key, text] of options) {
    if (ok && !saidHere.has(key)) { say(text(), { key }); return; }
  }
}

// Setelah halaman dicatat: adakah bacaan lama yang mirip? (dicari oleh otak)
function tryRecall(terms) {
  chrome.runtime.sendMessage({
    type: 'RECALL',
    url: location.origin + location.pathname,
    stems: terms.slice(0, 12).map(t => t.s?.[0] ?? t.w)
  }).then(r => {
    if (!r) return;
    let host = r.url;
    try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch {}
    say(T('recall', r.words.join(` ${T('and')} `), host, agoText(Date.now() - r.at)), { key: 'recall', force: true });
  }).catch(() => {});
}
