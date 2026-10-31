// ============================================================
// src/content/00-setup.js — Persiapan: privasi, keadaan, teks dua bahasa, pengaturan situs, kanvas
// Bagian dari tubuh Lexarach. Semua file di src/content/ berbagi variabel yang sama
// (urutan dimuat diatur di manifest.json). Listener baru dipasang di main().
// ============================================================

// Versi kode ini. Harus sama dengan "version" di manifest.json.
// Popup memakai ini untuk mendeteksi kalau tab menjalankan kode lama.
const BUILD = '1.0.0';


// ==========================================================
// 1. PRIVASI: halaman yang tidak boleh dimasuki
// ==========================================================
// Tambahkan sendiri situs yang menurutmu pribadi.
const BLOCKED_HOSTS = [
  'klikbca.com', 'web.whatsapp.com', 'web.telegram.org',
  'mail.google.com', 'outlook.live.com', 'paypal.com'
];
// Kalau salah satu bagian nama domain persis kata ini, diblok.
// contoh: "accounts.google.com" -> ada "accounts" -> diblok.
const BLOCKED_LABELS = ['mail', 'accounts', 'login', 'auth', 'signin', 'sso', 'ibank'];

function isBlockedPage() {
  const host = location.hostname.toLowerCase();
  if (BLOCKED_HOSTS.some(h => host === h || host.endsWith('.' + h))) return true;
  return host.split('.').some(l => BLOCKED_LABELS.includes(l) || l.includes('bank'));
}
// Halaman yang punya kolom password = halaman sensitif.
const hasPasswordField = () => !!document.querySelector('input[type="password"]');

// Lexarach tidak hidup di dalam iframe, di halaman yang diblokir, atau kalau sudah berjalan
// di halaman ini. Semua listener baru dipasang di main() (08-life.js) kalau LEXARACH_SKIP false.
const LEXARACH_SKIP = window.top !== window || !!window.__lexarachLoaded || isBlockedPage();
window.__lexarachInjected = true; // penanda untuk otak: kode Lexarach sudah ada di halaman ini
if (!LEXARACH_SKIP) window.__lexarachLoaded = true;

// Kata-kata umum yang tidak bergizi (tidak dimakan).
const STOPWORDS = new Set((
  'yang untuk dengan dari pada dalam adalah akan atau juga tidak sudah lebih ' +
  'oleh karena bisa dapat saat kami kita mereka anda saya kamu harus masih ' +
  'seperti sebagai telah antara setelah tersebut hanya bahwa hari tahun ' +
  'this that with from have will your what when which their there they ' +
  'about would been were into more than them then some only also just ' +
  'here these those over such very most other like make made'
).split(' '));

// ==========================================================
// 2. KEADAAN (STATE)
// ==========================================================
let memory = null;     // salinan memori dari otak
let alive = false;     // true kalau sudah siap
let asleep = false;    // sedang tidur & bermimpi (tidak membaca halaman)
let lastDreamAt = 0;   // mimpi terakhir yang sudah ditampilkan
let prefs = {};        // pengaturan dari menu (kunci "renikPrefs")

// ---------- Teks dua bahasa (dipilih di menu Pengaturan) ----------
const STR = {
  id: {
    core: 'ini inti halamannya',
    found: 'ini yang kamu cari',
    woke: 'sudah bangun. ingatanku sudah kurapikan',
    feedBtn: 'Beri makan Lexarach',
    webDone: 'jaringku sudah jadi',
    startled: 'kaget!',
    petted: 'rasanya aman di dekatmu',
    noted: 'tersimpan di Catatan',
    newWord: w => `kata baru: ${w}`,
    again: (w, n) => `${w} lagi, sudah ${n} kali`,
    full: n => `kenyang. sudah ${n} kata di halaman ini`,
    recall: (w, host, ago) => `kamu pernah membaca soal ${w} di ${host}, ${ago}`,
    interest: w => `${w} lagi? sepertinya kamu suka topik ini`,
    longRead: m => `sudah ${m} menit di sini. mau kuringkas? buka menu Halaman`,
    quiet: 'halaman ini sepi kata. aku jalan-jalan saja',
    newPlace: h => `tempat baru: ${h}`,
    and: 'dan',
    ago: { now: 'baru saja', min: n => `${n} menit lalu`, hour: n => `${n} jam lalu`, yesterday: 'kemarin', day: n => `${n} hari lalu` },
    newSignal: 'SINYAL BARU',
    known: n => `DIKENAL ×${n}`,
    modes: { WANDER: 'JELAJAH', HUNT: 'BURU', DIGEST: 'CERNA', APPROACH: 'MENDEKAT', FLEE: 'KABUR',
             ENTER: 'MASUK', DREAM: 'TIDUR', MOVE: 'PINDAH', TX: 'BERGUMAM', FEED: 'MAKAN',
             WAIT: 'RAGU', SNEAK: 'MENGENDAP', REST: 'ISTIRAHAT', GROOM: 'MEMBERSIHKAN', LOOK: 'MENGAMATI',
             JUMP: 'MELOMPAT', WEB: 'MERAJUT', HANG: 'BERGELANTUNG', CLIMB: 'MEMANJAT' }
  },
  en: {
    core: 'this is the core of the page',
    found: 'here is what you were looking for',
    woke: 'awake. i tidied up my memory',
    feedBtn: 'Feed Lexarach',
    webDone: 'my web is done',
    startled: 'startled!',
    petted: 'i feel safe around you',
    noted: 'saved to Notes',
    newWord: w => `new word: ${w}`,
    again: (w, n) => `${w} again, ${n} times now`,
    full: n => `full. ${n} words on this page`,
    recall: (w, host, ago) => `you read about ${w} on ${host}, ${ago}`,
    interest: w => `${w} again? you seem to like this topic`,
    longRead: m => `${m} minutes here. want a summary? open the Page menu`,
    quiet: 'not many words here. just wandering',
    newPlace: h => `new place: ${h}`,
    and: 'and',
    ago: { now: 'just now', min: n => `${n} min ago`, hour: n => `${n} h ago`, yesterday: 'yesterday', day: n => `${n} days ago` },
    newSignal: 'NEW SIGNAL',
    known: n => `KNOWN ×${n}`,
    modes: { WANDER: 'WANDER', HUNT: 'HUNT', DIGEST: 'DIGEST', APPROACH: 'APPROACH', FLEE: 'FLEE',
             ENTER: 'ENTER', DREAM: 'SLEEP', MOVE: 'MOVE', TX: 'MURMUR', FEED: 'FEED',
             WAIT: 'WAIT', SNEAK: 'SNEAK', REST: 'REST', GROOM: 'GROOM', LOOK: 'LOOK',
             JUMP: 'JUMP', WEB: 'WEAVE', HANG: 'HANG', CLIMB: 'CLIMB' }
  }
};
const uiLang = () => (prefs.lang === 'en' ? 'en' : 'id');
function T(key, ...args) {
  const v = STR[uiLang()][key];
  return typeof v === 'function' ? v(...args) : v;
}
const modeLabel = m => STR[uiLang()].modes[m] ?? m;

// ---------- Pengaturan per situs (menu Halaman → "Situs ini") ----------
//   'normal' : Lexarach hidup & membaca seperti biasa
//   'hidden' : Lexarach tidak terlihat, tapi halaman tetap diingat & bisa diberi catatan
//   'off'    : Lexarach tidak masuk sama sekali (tidak membaca, tidak mengingat)
const HOST = location.hostname;
const siteMode = () => prefs.sites?.[HOST] ?? 'normal';

// ---------- Mode tidak mengganggu (bisa dimatikan di Pengaturan) ----------
//   'typing' : Anda sedang mengetik -> Lexarach diam & sangat redup
//   'media'  : layar penuh / video besar sedang diputar -> Lexarach disembunyikan
let calm = null;
function checkCalm() {
  let next = null;
  if (prefs.calm !== false) {
    const ae = document.activeElement;
    const typing = ae && (ae.isContentEditable || /^(TEXTAREA|SELECT)$/.test(ae.tagName) ||
      (ae.tagName === 'INPUT' && !/^(button|checkbox|radio|submit|reset|range|color|file|image)$/i.test(ae.type)));
    let media = !!document.fullscreenElement;
    if (!media) {
      for (const v of document.querySelectorAll('video')) {
        if (v.paused || v.ended) continue;
        const r = v.getBoundingClientRect();
        if (r.width * r.height > innerWidth * innerHeight * 0.35) { media = true; break; }
      }
    }
    next = media ? 'media' : typing ? 'typing' : null;
  }
  if (next !== calm) { calm = next; if (typeof updateDisplay === 'function') updateDisplay(); }
}
chrome.storage.local.get('renikPrefs').then(r => { prefs = r.renikPrefs ?? {}; });
const pending = [];    // kata yang dimakan tapi belum dilaporkan
const pendingPairs = [];   // pasangan kata [a, b] dari kalimat sekitar makanan (orde-1)
const learnedHere = new Set(); // yang sudah dipelajari di halaman ini (tidak dihitung dua kali)
const eatenHere = new Set(); // kata yang sudah dimakan di halaman ini
let mode = 'WANDER';   // status yang ditampilkan di label HUD

const knownCount = w => memory?.words?.[w]?.count ?? 0;

// ==========================================================
// 3. KANVAS (lapisan transparan di atas halaman)
// ==========================================================
const canvas = document.createElement('canvas');
canvas.dataset.lexarach = '1';
Object.assign(canvas.style, {
  position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh',
  pointerEvents: 'none',   // klik tetap tembus ke halaman
  zIndex: '2147483647'
});
const ctx = canvas.getContext('2d');
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Halaman gelap atau terang? Supaya garis Lexarach tetap kelihatan.
let darkPage = false;
function detectTheme() {
  for (const el of [document.body, document.documentElement]) {
    const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (c && (c.length < 4 || +c[3] > 0)) {
      const [r, g, b] = c.map(Number);
      darkPage = 0.299 * r + 0.587 * g + 0.114 * b < 128;
      return;
    }
  }
  darkPage = false; // latar transparan = biasanya putih
}
