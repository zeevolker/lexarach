// ============================================================
// popup.js — MENU LEXARACH
// ------------------------------------------------------------
// Tab:
//   Status      kepribadian, statistik, minat, tidurkan
//   Ingatan     cari halaman yang pernah dibaca (kata dasar + cuplikan + "Buka & sorot" + Lupakan)
//   Catatan     teks yang Anda berikan kepada Lexarach: cari, lihat, ubah, hapus
//   Halaman     ringkas & tandai kalimat inti halaman yang sedang dibuka
//   Pengaturan  bahasa, warna, privasi, hapus memori
// Pakai juga: lang.js (LexarachLang).
// ============================================================
const HALF_LIFE_MS = 2 * 24 * 60 * 60 * 1000; // sama dengan background.js
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const strength = (d, now) => d.strength * Math.pow(0.5, (now - d.lastSeen) / HALF_LIFE_MS);

let state = null;   // memori Lexarach (gabungan inti + bahasa + halaman)
let style = null;   // warna
let prefs = {};     // { lang, rememberPages, calm, sites, global }

// ============================================================
// TEKS DUA BAHASA
// ============================================================
const I18N = {
  id: {
    tabStatus: 'Status', tabMemory: 'Ingatan', tabNotes: 'Catatan', tabPage: 'Halaman', tabSettings: 'Pengaturan',
    stOn: 'AKTIF', stHidden: 'TERSEMBUNYI', stOff: 'NONAKTIF', age: 'Usia', newborn: 'Baru lahir',
    justNow: 'baru saja', min: n => `${n} menit`, hour: n => `${n} jam`, day: n => `${n} hari`, ago: t => `${t} yang lalu`,
    personality: 'Kepribadian', curiosity: 'Rasa ingin tahu', boldness: 'Keberanian', energy: 'Energi',
    statWords: 'KATA', statPages: 'HALAMAN', statToday: 'HARI INI',
    weekTitle: 'Minggu ini', weekSub: '· 7 hari terakhir', weekPages: 'HALAMAN', weekNotes: 'CATATAN BARU',
    weekDays: 'HARI MEMBACA', weekEmpty: 'Belum ada bacaan dalam 7 hari terakhir.',
    interests: 'Minat Anda', interestsSub: '· topik yang paling sering Anda baca',
    interestsEmpty: 'Belum ada. Ajak Lexarach menjelajah terlebih dahulu.',
    presence: 'Kehadiran', modeOn: 'Aktif', modeHidden: 'Sembunyikan', modeOff: 'Nonaktifkan',
    siteOverride: m => `Saat ini Kehadiran di tab Status diatur ke “${m}” untuk semua situs, jadi pengaturan itu yang berlaku.`,
    hintOn: 'Lexarach berkeliaran dan membaca bersama Anda. Seret tubuhnya untuk memindahkannya.',
    hintHidden: 'Tidak terlihat di semua situs, tapi tetap mengingat halaman dan menerima catatan. Pintasan: Alt+H.',
    hintOff: 'Tidak muncul dan tidak membaca apa pun di semua situs. Ingatan dan catatan Anda tetap aman.',
    searchPh: 'Di mana saya pernah membaca tentang…',
    stored: n => `${n} HALAMAN TERSIMPAN DALAM INGATAN`, matches: n => `${n} HALAMAN COCOK`, notFound: 'TIDAK DITEMUKAN DALAM INGATAN',
    noPages: 'Belum ada halaman. Lexarach mencatat setiap halaman yang Anda baca lebih dari beberapa detik.',
    open: 'Buka', openMark: 'Buka & sorot', forget: 'Lupakan', sure: 'Yakin?',
    siteTitle: 'Situs ini', siteNormal: 'Normal', siteHidden: 'Sembunyikan Lexarach (tetap mengingat halaman)',
    siteOff: 'Jangan masuk (tidak membaca & tidak mengingat)', siteNote: 'Berlaku untuk semua halaman di situs ini.',
    siteNA: 'bukan situs web',
    calmTitle: 'Mode tidak mengganggu',
    calmDesc: 'Lexarach meredup dan diam saat Anda mengetik, serta bersembunyi saat layar penuh atau saat video besar diputar.',
    backup: 'Cadangan',
    backupDesc: 'Semua ingatan dan catatan hanya tersimpan di peramban ini. Simpan cadangan agar tidak hilang.',
    exportAll: 'Ekspor semua (.json)', importBtn: 'Impor dari file', exportMd: 'Ekspor catatan (.md)',
    importConfirm: n => `Ganti ingatan Lexarach dengan isi file ini? ${n} catatan dari file akan digabungkan dengan catatan yang sudah ada.`,
    importOk: 'Cadangan berhasil dipulihkan.', importBad: 'File ini bukan cadangan Lexarach yang valid.',
    exported: 'Berkas cadangan telah diunduh.', mdTitle: 'Catatan Lexarach', mdExported: d => `Diekspor pada ${d}`,
    mdSource: 'Sumber', untitled: 'Tanpa judul',
    notesInfo: (n, p) => `${n} CATATAN · ${p} HALAMAN COCOK`, noteTag: 'CATATAN', openNotes: 'Lihat di Catatan',
    notesPh: 'Cari di catatan…', nNotes: n => `${n} CATATAN`, nMatch: n => `${n} CATATAN COCOK`,
    notesEmpty: 'Belum ada catatan. Blok teks di halaman mana pun, lalu klik “Beri makan Lexarach” (atau klik kanan → Beri makan Lexarach).',
    edit: 'Ubah', del: 'Hapus', save: 'Simpan', cancel: 'Batal', more: 'selengkapnya', less: 'ringkas', edited: 'diubah',
    summarize: 'Ringkas halaman ini', mark: 'Tandai', unmark: 'Hapus tanda',
    pageIntro: 'Lexarach akan memilih kalimat-kalimat inti dari halaman yang sedang Anda buka.',
    scanning: 'MEMINDAI…', keywords: 'Kata kunci', essentials: 'Inti halaman', nSentences: n => `· ${n} kalimat`,
    noParagraph: 'Tidak ditemukan paragraf yang cukup panjang untuk diringkas.',
    errPrivate: 'Halaman ini memiliki kolom kata sandi sehingga Lexarach tidak membacanya.',
    errUnreachable: 'Lexarach tidak dapat masuk ke halaman ini (halaman sistem, situs yang diblokir demi privasi, atau halaman yang dibuka sebelum Lexarach dipasang; coba muat ulang halaman).',
    language: 'Bahasa', colors: 'Warna', autoColor: 'Ikuti kepribadian (otomatis)',
    cBody: 'Tubuh', cJoint: 'Sendi', cAccent: 'Aksen', cGlow: 'Cahaya', preset: 'Gunakan preset ini',
    privacy: 'Privasi',
    rememberPages: 'Ingat halaman yang dikunjungi (untuk fitur Ingatan). Data hanya disimpan di komputer ini.',
    reset: 'Hapus semua memori',
    resetConfirm: 'Hapus semua memori? Lexarach akan lahir kembali dengan kepribadian baru, dan ingatan halaman ikut terhapus. Catatan Anda tidak ikut terhapus.',
    footer: 'LEXARACH · ORGANISME DIGITAL',
    stale: (b, w) => `⚠ Tab ini menjalankan kode Lexarach versi ${b ?? 'lama'}, sedangkan ekstensi versi ${w}. Kemungkinan file di folder src/content tertimpa versi lama. Tutup file-file itu di editor tanpa menyimpan, lalu muat ulang ekstensi.`
  },
  en: {
    tabStatus: 'Status', tabMemory: 'Memory', tabNotes: 'Notes', tabPage: 'Page', tabSettings: 'Settings',
    stOn: 'ACTIVE', stHidden: 'HIDDEN', stOff: 'OFF', age: 'Age', newborn: 'Just born',
    justNow: 'just now', min: n => `${n} min`, hour: n => `${n} h`, day: n => `${n} d`, ago: t => `${t} ago`,
    personality: 'Personality', curiosity: 'Curiosity', boldness: 'Boldness', energy: 'Energy',
    statWords: 'WORDS', statPages: 'PAGES', statToday: 'TODAY',
    weekTitle: 'This week', weekSub: '· last 7 days', weekPages: 'PAGES', weekNotes: 'NEW NOTES',
    weekDays: 'READING DAYS', weekEmpty: 'No reading in the last 7 days.',
    interests: 'Your interests', interestsSub: '· topics you read most',
    interestsEmpty: 'Nothing yet. Take Lexarach browsing first.',
    presence: 'Presence', modeOn: 'Active', modeHidden: 'Hide', modeOff: 'Turn off',
    siteOverride: m => `Presence on the Status tab is set to “${m}” for all sites, so that setting applies.`,
    hintOn: 'Lexarach roams and reads along with you. Drag its body to move it.',
    hintHidden: 'Invisible on every site, but still remembers pages and accepts notes. Shortcut: Alt+H.',
    hintOff: 'Does not appear or read anything on any site. Your memory and notes stay safe.',
    searchPh: 'Where did I read about…',
    stored: n => `${n} PAGES IN MEMORY`, matches: n => `${n} MATCHING PAGES`, notFound: 'NOT FOUND IN MEMORY',
    noPages: 'No pages yet. Lexarach records every page you read for more than a few seconds.',
    open: 'Open', openMark: 'Open & highlight', forget: 'Forget', sure: 'Sure?',
    siteTitle: 'This site', siteNormal: 'Normal', siteHidden: 'Hide Lexarach (still remember pages)',
    siteOff: 'Stay out (do not read or remember)', siteNote: 'Applies to every page on this site.',
    siteNA: 'not a website',
    calmTitle: 'Do-not-disturb mode',
    calmDesc: 'Lexarach dims and stays still while you type, and hides in fullscreen or while a large video plays.',
    backup: 'Backup',
    backupDesc: 'All memory and notes live only in this browser. Keep a backup so nothing is lost.',
    exportAll: 'Export all (.json)', importBtn: 'Import from file', exportMd: 'Export notes (.md)',
    importConfirm: n => `Replace Lexarach's memory with this file? ${n} notes from the file will be merged with your existing notes.`,
    importOk: 'Backup restored.', importBad: 'This file is not a valid Lexarach backup.',
    exported: 'Backup file downloaded.', mdTitle: 'Lexarach notes', mdExported: d => `Exported on ${d}`,
    mdSource: 'Source', untitled: 'Untitled',
    notesInfo: (n, p) => `${n} NOTES · ${p} MATCHING PAGES`, noteTag: 'NOTE', openNotes: 'Show in Notes',
    notesPh: 'Search notes…', nNotes: n => `${n} NOTES`, nMatch: n => `${n} MATCHING NOTES`,
    notesEmpty: 'No notes yet. Select text on any page, then click “Feed Lexarach” (or right-click → Feed Lexarach).',
    edit: 'Edit', del: 'Delete', save: 'Save', cancel: 'Cancel', more: 'more', less: 'less', edited: 'edited',
    summarize: 'Summarize this page', mark: 'Highlight', unmark: 'Clear highlight',
    pageIntro: 'Lexarach will pick the key sentences of the page you are viewing.',
    scanning: 'SCANNING…', keywords: 'Keywords', essentials: 'Page essentials', nSentences: n => `· ${n} sentences`,
    noParagraph: 'No paragraphs long enough to summarize.',
    errPrivate: 'This page has a password field, so Lexarach does not read it.',
    errUnreachable: 'Lexarach cannot enter this page (a system page, a site blocked for privacy, or a page opened before Lexarach was installed; try reloading it).',
    language: 'Language', colors: 'Colors', autoColor: 'Follow personality (automatic)',
    cBody: 'Body', cJoint: 'Joints', cAccent: 'Accent', cGlow: 'Glow', preset: 'Use this preset',
    privacy: 'Privacy',
    rememberPages: 'Remember visited pages (for the Memory feature). Data is stored only on this computer.',
    reset: 'Erase all memory',
    resetConfirm: 'Erase all memory? Lexarach will be reborn with a new personality, and page memory will be erased too. Your notes will be kept.',
    footer: 'LEXARACH · DIGITAL ORGANISM',
    stale: (b, w) => `⚠ This tab is running Lexarach code version ${b ?? 'old'}, but the extension is version ${w}. The files in src/content were probably overwritten with an old version. Close them in your editor without saving, then reload the extension.`
  }
};
const lang = () => (prefs.lang === 'en' ? 'en' : 'id');
function T(key, ...args) {
  const v = I18N[lang()][key];
  return typeof v === 'function' ? v(...args) : v;
}
function applyLanguage() {
  document.documentElement.lang = lang();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = T(el.dataset.i18nPh); });
  $('lang').value = lang();
}

function age(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return T('justNow');
  if (m < 60) return T('min', m);
  const h = Math.floor(m / 60);
  if (h < 24) return T('hour', h);
  return T('day', Math.floor(h / 24));
}
const ago = ms => (Math.floor(ms / 60000) < 1 ? T('justNow') : T('ago', age(ms)));

// ---------- Tab ----------
document.querySelectorAll('nav button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id === 'tab-' + b.dataset.tab));
    if (b.dataset.tab === 'memory') { $('q').focus(); search(); }
  };
});

// ============================================================
// WARNA (sama seperti di content scripts)
// ============================================================
const DEFAULT_STYLE = { auto: false, body: '#ff2bd6', joint: '#c6ff00', accent: '#00e5ff', glow: 8 };
const PRESETS = [
  ['#ff2bd6', '#c6ff00', '#00e5ff'], // neon magenta
  ['#ff5a1f', '#ffe600', '#7b61ff'], // magma
  ['#00ff9c', '#00b3ff', '#ff3d81'], // hijau toksik
  ['#7b61ff', '#ff2bd6', '#00ffd5'], // ultraviolet
  ['#ff1744', '#00e5ff', '#fff176']  // sinyal merah
];

function palette() {
  if (!style.auto) return style;
  const hue = (270 + (state?.personality?.curiosity ?? 0.5) * 110) % 360;
  return {
    body: `hsl(${hue}, 100%, 60%)`,
    joint: `hsl(${(hue + 70) % 360}, 100%, 58%)`,
    accent: `hsl(${(hue + 180) % 360}, 100%, 55%)`
  };
}

function applyTheme() {
  const c = palette();
  for (const k of ['body', 'joint', 'accent']) document.documentElement.style.setProperty('--' + k, c[k]);
  drawEmblem(c);
}

// Lambang kecil Lexarach di header (laba-laba mini yang digambar dengan kode).
function drawEmblem(c) {
  const cv = $('emblem'), g = cv.getContext('2d');
  const S = cv.width, m = S / 2, sc = S / 52;
  g.clearRect(0, 0, S, S);
  g.lineCap = 'round';
  g.shadowBlur = 6;
  g.strokeStyle = c.body; g.shadowColor = c.body; g.lineWidth = 1.4 * sc;
  const legAng = [0.45, 1.85, 2.3, 2.8];
  for (const side of [-1, 1]) {
    legAng.forEach(a => {
      const ang = -Math.PI / 2 + side * a;
      const kx = m + Math.cos(ang) * 12 * sc + side * 4 * sc, ky = m + Math.sin(ang) * 12 * sc - 3 * sc;
      const fx = m + Math.cos(ang) * 22 * sc, fy = m + Math.sin(ang) * 22 * sc;
      g.beginPath(); g.moveTo(m, m); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.fillStyle = c.joint; g.fillRect(kx - 1.2 * sc, ky - 1.2 * sc, 2.4 * sc, 2.4 * sc);
    });
  }
  g.strokeStyle = c.body; g.lineWidth = 1.5 * sc;
  g.beginPath(); g.ellipse(m, m + 7 * sc, 5 * sc, 7 * sc, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; const x = m + Math.cos(a) * 4.5 * sc, y = m - 3 * sc + Math.sin(a) * 4.5 * sc; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.stroke();
  g.fillStyle = c.joint; g.shadowColor = c.joint;
  g.beginPath(); g.arc(m, m - 3 * sc, 1.8 * sc, 0, Math.PI * 2); g.fill();
  g.strokeStyle = c.accent; g.shadowColor = c.accent; g.lineWidth = 1 * sc;
  g.beginPath(); g.arc(m, m + 7 * sc, 2.6 * sc, 0.3, 2.6); g.stroke();
}

// ============================================================
// STATUS
// ============================================================
const TRAITS = ['curiosity', 'boldness', 'energy'];
// Kata umum yang bukan "topik" (tidak ditampilkan sebagai minat).
const COMMON = new Set(('atas bawah suka hidup makan besar kecil baru lama baik buruk sudah belum ' +
  'paling sedikit tempat waktu orang cara ingin dapat punya membuat memiliki melakukan bukan ' +
  'about after again back because being between could every first great might never other ' +
  'should since still thing through under where while years').split(' '));

function renderStatus() {
  const s = state, now = Date.now();
  const lived = now - s.born < 60000 ? T('newborn') : `${T('age')} ${age(now - s.born)}`;
  $('species').textContent = s.species ?? 'Lexarach';
  $('sub').textContent = lived.toUpperCase();
  renderPresence();

  $('traits').innerHTML = TRAITS.map(k => {
    const v = s.personality[k];
    return `<div class="meter"><span>${esc(T(k))}</span><div class="bar"><i style="width:${v * 100}%"></i></div><span class="v">${v.toFixed(2)}</span></div>`;
  }).join('');

  $('nEaten').textContent = s.stats.wordsEaten;
  $('nPages').textContent = (s.pages ?? []).length;
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  $('nToday').textContent = (s.pages ?? []).filter(p => p.at >= midnight.getTime()).length; // halaman dibaca hari ini

  // ---- Minggu ini: dari ingatan halaman & catatan 7 hari terakhir
  const weekAgo = now - 7 * 864e5;
  const weekPages = (s.pages ?? []).filter(pg => pg.at >= weekAgo);
  $('wPages').textContent = weekPages.length;
  $('wNotes').textContent = notes.filter(n => n.at >= weekAgo).length;
  $('wDays').textContent = new Set(weekPages.map(pg => new Date(pg.at).toDateString())).size;
  // Topik utama = kata kunci yang bobotnya paling besar bila dijumlahkan dari semua halaman minggu ini
  const topicScore = new Map();
  for (const pg of weekPages) for (const t of pg.terms ?? []) topicScore.set(t.w, (topicScore.get(t.w) ?? 0) + (t.k ?? 0.5));
  const weekTop = [...topicScore].filter(([w]) => !COMMON.has(w)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  $('wTopics').innerHTML = weekTop.length
    ? weekTop.map(([w], i) => `<span class="chip ${i < 3 ? 'hot' : ''}" data-q="${esc(w)}" style="cursor:pointer">${esc(w)}</span>`).join('')
    : `<span class="muted">${esc(T('weekEmpty'))}</span>`;
  $('wTopics').querySelectorAll('[data-q]').forEach(el => el.onclick = () => {
    $('q').value = el.dataset.q;
    document.querySelector('nav button[data-tab="memory"]').click();
  });

  // Minat = kata terkuat di ingatannya (bukan kata umum)
  const top = Object.entries(s.words)
    .filter(([w]) => w.length >= 4 && !COMMON.has(w) && !LexarachLang.STOP.has(w))
    .map(([w, d]) => [w, strength(d, now)])
    .sort((a, b) => b[1] - a[1]).slice(0, 14);
  $('interests').innerHTML = top.length
    ? top.map(([w], i) => `<span class="chip ${i < 4 ? 'hot' : ''}" data-q="${esc(w)}" style="cursor:pointer">${esc(w)}</span>`).join('')
    : `<span class="muted">${esc(T('interestsEmpty'))}</span>`;
  // Klik minat -> cari di ingatan
  $('interests').querySelectorAll('[data-q]').forEach(el => el.onclick = () => {
    $('q').value = el.dataset.q;
    document.querySelector('nav button[data-tab="memory"]').click();
  });
}

// Kehadiran global: 'normal' (aktif) / 'hidden' (sembunyi di semua situs) / 'off' (nonaktif).
function renderPresence() {
  const g = prefs.global ?? 'normal';
  const key = { normal: 'On', hidden: 'Hidden', off: 'Off' }[g];
  $('state').textContent = T('st' + key);
  $('state').className = 'state ' + (g === 'normal' ? '' : g);
  $('presenceHint').textContent = T('hint' + key);
  for (const b of $('presence').querySelectorAll('button')) {
    const on = b.dataset.mode === g;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  }
}
for (const b of $('presence').querySelectorAll('button')) {
  b.onclick = () => { savePrefs({ global: b.dataset.mode }); renderPresence(); };
}

// ============================================================
// INGATAN: "Di mana saya pernah membaca tentang …"
// ============================================================
// Semua kata diubah ke kata dasar dulu (lang.js), jadi "membaca" cocok dengan "dibaca".
// Skor tiap halaman:
//   kata dasar sama                       = 1 × (0.5 + bobot kata di halaman itu)
//   awalan sama (min. 4 huruf)            = 0.6 × …
//   kata yang terhubung lewat mimpi       = 0.5 × …
//   kata ada di judul                     = +1.5
const pageCache = new WeakMap();
function pageTerms(p) {
  let c = pageCache.get(p);
  if (!c) {
    const terms = (p.terms ?? []).map(t => ({ w: t.w, stems: t.s ?? [LexarachLang.stem(t.w)], k: t.k ?? 0.5 }));
    // Format lama (sebelum v0.4): hanya ada daftar kata yang dimakan
    for (const w of p.words ?? []) terms.push({ w, stems: LexarachLang.stems(w), k: 0.3 });
    const titleStems = new Set(LexarachLang.terms(p.title ?? '').flatMap(t => t.stems));
    c = { terms, titleStems };
    pageCache.set(p, c);
  }
  return c;
}

function queryStems(text) {
  let qs = LexarachLang.terms(text);
  if (!qs.length) qs = (text.toLowerCase().match(/\p{L}{3,}/gu) || []).map(w => ({ word: w, stems: LexarachLang.stems(w) }));
  const wanted = new Map(); // kata dasar -> bobot
  const add = (st, wt) => wanted.set(st, Math.max(wanted.get(st) ?? 0, wt));
  for (const q of qs) {
    for (const st of q.stems) add(st, 1);
    for (const linked of Object.keys(state.links?.[q.word] ?? {})) for (const st of LexarachLang.stems(linked)) add(st, 0.5);
  }
  return wanted;
}

// Tandai kata yang cocok di dalam cuplikan.
function markSnippet(text, wanted) {
  return text.split(/(\p{L}+)/u).map((part, i) => {
    if (i % 2 === 0) return esc(part);
    return LexarachLang.stems(part).some(s => wanted.has(s)) ? `<mark>${esc(part)}</mark>` : esc(part);
  }).join('');
}

function search() {
  if (!state) return;
  const pages = state.pages ?? [];
  const text = $('q').value.trim();
  if (!text) {
    $('qinfo').textContent = T('stored', pages.length);
    $('results').innerHTML = pages.slice(0, 8).map(p => resultHTML(p, null, [])).join('') ||
      `<div class="muted">${esc(T('noPages'))}</div>`;
    bindResults();
    return;
  }
  const wanted = queryStems(text);
  const scored = [];
  for (const p of pages) {
    const { terms, titleStems } = pageTerms(p);
    let score = 0;
    const hits = new Set();
    for (const t of terms) {
      let best = 0;
      for (const st of t.stems) {
        for (const [q, wt] of wanted) {
          const m = st === q ? wt : (Math.min(st.length, q.length) >= 4 && (st.startsWith(q) || q.startsWith(st))) ? wt * 0.6 : 0;
          if (m > best) best = m;
        }
      }
      if (best) { score += best * (0.5 + t.k); hits.add(t.w); }
    }
    if ([...wanted.keys()].some(q => titleStems.has(q))) score += 1.5;
    if (score > 0) scored.push({ p, score, hits: [...hits] });
  }
  scored.sort((a, b) => b.score - a.score || b.p.at - a.p.at);

  // Catatan yang cocok ditampilkan paling atas (itu yang Anda anggap penting).
  const noteHits = notes.filter(n => n.text.toLowerCase().includes(text.toLowerCase()) ||
    LexarachLang.terms(n.text).some(t => t.stems.some(s => wanted.has(s)))).slice(0, 5);

  $('qinfo').textContent = noteHits.length
    ? T('notesInfo', noteHits.length, scored.length)
    : scored.length ? T('matches', scored.length) : T('notFound');
  $('results').innerHTML = noteHits.map(n => noteHitHTML(n, wanted)).join('') +
    scored.slice(0, 12).map(x => resultHTML(x.p, wanted, x.hits)).join('');
  bindResults();
}

function bestSnippet(p, wanted) {
  const snips = p.snippets ?? [];
  if (!snips.length) return null;
  if (!wanted) return snips[0];
  let best = null, bestN = 0;
  for (const s of snips) {
    const n = LexarachLang.terms(s).filter(t => t.stems.some(x => wanted.has(x))).length;
    if (n > bestN) { best = s; bestN = n; }
  }
  return best ?? snips[0]; // tidak ada yang memuat kata itu: tampilkan kalimat inti pertama sebagai konteks
}

function resultHTML(p, wanted, hits) {
  let host = '';
  try { host = new URL(p.url).hostname.replace(/^www\./, ''); } catch {}
  const snip = bestSnippet(p, wanted);
  return `<div class="result">
    <div class="rt">${esc(p.title || p.url)}</div>
    <div class="rm">${esc(host)} · ${esc(ago(Date.now() - p.at))}</div>
    ${snip ? `<div class="snip">${wanted ? markSnippet(snip, wanted) : esc(snip)}</div>` : ''}
    ${hits.length ? `<div class="chips">${hits.slice(0, 6).map(h => `<span class="chip hot">${esc(h)}</span>`).join('')}</div>` : ''}
    <div class="actions">
      <button class="btn" data-open="${esc(p.url)}">${esc(T('open'))}</button>
      ${snip ? `<button class="btn" data-mark="${esc(p.url)}" data-text="${esc(snip)}">${esc(T('openMark'))}</button>` : ''}
      <button class="btn danger" data-forget="${esc(p.url)}" style="margin-left:auto">${esc(T('forget'))}</button>
    </div>
  </div>`;
}

function noteHitHTML(n, wanted) {
  let host = '';
  try { host = n.url ? new URL(n.url).hostname.replace(/^www\./, '') : ''; } catch {}
  const short = n.text.length > 240 ? n.text.slice(0, 237) + '…' : n.text;
  return `<div class="result note-hit">
    <div class="tag">◆ ${esc(T('noteTag'))}</div>
    <div class="snip">${markSnippet(short, wanted)}</div>
    <div class="rm">${esc(n.title || host)} · ${esc(ago(Date.now() - n.at))}</div>
    <div class="actions">
      ${n.url ? `<button class="btn" data-mark="${esc(n.url)}" data-text="${esc(n.text.slice(0, 600))}">${esc(T('openMark'))}</button>` : ''}
      <button class="btn" data-gonotes="${esc(n.id)}">${esc(T('openNotes'))}</button>
    </div>
  </div>`;
}

function bindResults() {
  $('results').querySelectorAll('[data-gonotes]').forEach(b => b.onclick = () => {
    $('nq').value = '';
    openNotes.add(b.dataset.gonotes);
    document.querySelector('nav button[data-tab="notes"]').click();
    renderNotes();
    document.querySelector(`.note[data-id="${CSS.escape(b.dataset.gonotes)}"]`)?.scrollIntoView({ block: 'center' });
  });
  $('results').querySelectorAll('[data-open]').forEach(b => b.onclick = () => chrome.tabs.create({ url: b.dataset.open }));
  // "Buka & sorot": titipkan kalimatnya ke otak, lalu buka halamannya.
  $('results').querySelectorAll('[data-mark]').forEach(b => b.onclick = async () => {
    await chrome.runtime.sendMessage({ type: 'PUT_MARK', url: b.dataset.mark, text: b.dataset.text });
    chrome.tabs.create({ url: b.dataset.mark });
  });
  // "Lupakan": klik sekali -> "Yakin?", klik lagi -> halaman dihapus dari ingatan.
  $('results').querySelectorAll('[data-forget]').forEach(b => b.onclick = () => {
    if (b.dataset.armed !== '1') {
      b.dataset.armed = '1';
      b.textContent = T('sure');
      setTimeout(() => { b.dataset.armed = '0'; b.textContent = T('forget'); }, 3000);
      return;
    }
    chrome.runtime.sendMessage({ type: 'FORGET_PAGE', url: b.dataset.forget });
  });
}
let qTimer;
$('q').oninput = () => { clearTimeout(qTimer); qTimer = setTimeout(search, 150); };

// ============================================================
// CATATAN: teks yang Anda berikan kepada Lexarach
// ============================================================
let notes = [];
let editing = null;            // id catatan yang sedang diubah
const openNotes = new Set();   // catatan yang sedang dibuka penuh

function renderNotes() {
  if (editing) return; // jangan ganggu saat sedang mengetik
  const q = $('nq').value.trim();
  let list = notes;
  if (q) {
    const wanted = new Set(LexarachLang.terms(q).flatMap(t => t.stems));
    const ql = q.toLowerCase();
    list = notes.filter(n => n.text.toLowerCase().includes(ql) || (n.title ?? '').toLowerCase().includes(ql) ||
      LexarachLang.terms(n.text).some(t => t.stems.some(s => wanted.has(s))));
  }
  $('ninfo').textContent = q ? T('nMatch', list.length) : T('nNotes', notes.length);
  if (!notes.length) { $('notes').innerHTML = `<div class="muted">${esc(T('notesEmpty'))}</div>`; return; }
  $('notes').innerHTML = list.map(n => {
    let host = '';
    try { host = n.url ? new URL(n.url).hostname.replace(/^www\./, '') : ''; } catch {}
    const long = n.text.length > 280 || n.text.split('\n').length > 5;
    return `<div class="note" data-id="${esc(n.id)}">
      <div class="nt ${openNotes.has(n.id) ? 'open' : ''}">${esc(n.text)}</div>
      ${long ? `<div class="more" data-more>${esc(openNotes.has(n.id) ? T('less') : T('more'))}</div>` : ''}
      <div class="rm">${esc(n.title || host)}${host && n.title ? ' · ' + esc(host) : ''} · ${esc(ago(Date.now() - n.at))}${n.edited ? ' · ' + esc(T('edited')) : ''}</div>
      <div class="actions">
        ${n.url ? `<button class="btn" data-nopen>${esc(T('openMark'))}</button>` : ''}
        <button class="btn" data-nedit>${esc(T('edit'))}</button>
        <button class="btn danger" data-ndel style="margin-left:auto">${esc(T('del'))}</button>
      </div>
    </div>`;
  }).join('');

  $('notes').querySelectorAll('.note').forEach(el => {
    const n = notes.find(x => x.id === el.dataset.id);
    el.querySelector('[data-more]')?.addEventListener('click', () => {
      openNotes.has(n.id) ? openNotes.delete(n.id) : openNotes.add(n.id);
      renderNotes();
    });
    el.querySelector('[data-nopen]')?.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ type: 'PUT_MARK', url: n.url, text: n.text.slice(0, 600) });
      chrome.tabs.create({ url: n.url });
    });
    el.querySelector('[data-nedit]').onclick = () => startEdit(el, n);
    const del = el.querySelector('[data-ndel]');
    del.onclick = () => {
      if (del.dataset.armed !== '1') {
        del.dataset.armed = '1';
        del.textContent = T('sure');
        setTimeout(() => { del.dataset.armed = '0'; del.textContent = T('del'); }, 3000);
        return;
      }
      chrome.runtime.sendMessage({ type: 'DELETE_NOTE', id: n.id });
    };
  });
}

function startEdit(el, n) {
  editing = n.id;
  el.innerHTML = `<textarea>${esc(n.text)}</textarea>
    <div class="actions"><button class="btn" data-save>${esc(T('save'))}</button><button class="btn" data-cancel>${esc(T('cancel'))}</button></div>`;
  const ta = el.querySelector('textarea');
  ta.focus();
  el.querySelector('[data-save]').onclick = async () => {
    const text = ta.value.trim();
    editing = null;
    if (text) await chrome.runtime.sendMessage({ type: 'UPDATE_NOTE', id: n.id, text });
    else await chrome.runtime.sendMessage({ type: 'DELETE_NOTE', id: n.id }); // dikosongkan = dihapus
    renderNotes();
  };
  el.querySelector('[data-cancel]').onclick = () => { editing = null; renderNotes(); };
}
let nqTimer;
$('nq').oninput = () => { clearTimeout(nqTimer); nqTimer = setTimeout(renderNotes, 150); };

// ============================================================
// HALAMAN: ringkas & tandai (dikerjakan insight.js di halaman)
// ============================================================
async function askTab(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return { error: 'none' };
  try { return await chrome.tabs.sendMessage(tab.id, msg); }
  catch { return { error: 'unreachable' }; }
}
const pageError = err => T(err === 'private' ? 'errPrivate' : 'errUnreachable');

$('summarize').onclick = async () => {
  $('summary').innerHTML = `<div class="muted mono">${esc(T('scanning'))}</div>`;
  const r = await askTab({ type: 'SUMMARIZE' });
  if (!r || r.error) { $('summary').innerHTML = `<div class="muted">${esc(pageError(r?.error))}</div>`; return; }
  if (!r.sentences.length) { $('summary').innerHTML = `<div class="muted">${esc(T('noParagraph'))}</div>`; return; }
  $('summary').innerHTML = `
    <div class="card"><h3>${esc(T('keywords'))}</h3><div class="chips">${r.keywords.map(k => `<span class="chip hot">${esc(k)}</span>`).join('')}</div></div>
    <div class="card"><h3>${esc(T('essentials'))} <span>${esc(T('nSentences', r.sentences.length))}</span></h3>
      ${r.sentences.map(s => `<div class="key">${esc(s)}</div>`).join('')}
    </div>`;
};

$('mark').onclick = async () => {
  const marked = $('mark').dataset.on === '1';
  const r = await askTab({ type: marked ? 'CLEAR_HIGHLIGHT' : 'HIGHLIGHT' });
  if (!r || r.error) { $('summary').innerHTML = `<div class="muted">${esc(pageError(r?.error))}</div>`; return; }
  $('mark').dataset.on = marked ? '0' : '1';
  $('mark').textContent = marked ? T('mark') : T('unmark');
};

// ============================================================
// PENGATURAN
// ============================================================
function renderSettings() {
  $('auto').checked = style.auto;
  $('c-body').value = style.body;
  $('c-joint').value = style.joint;
  $('c-accent').value = style.accent;
  $('glow').value = style.glow;
  for (const id of ['c-body', 'c-joint', 'c-accent']) $(id).classList.toggle('disabled', style.auto);
  $('rememberPages').checked = prefs.rememberPages !== false;
  $('calm').checked = prefs.calm !== false;
}
function saveStyle(patch) {
  style = { ...style, ...patch };
  chrome.storage.local.set({ renikStyle: style });
  renderSettings();
  applyTheme();
}
function savePrefs(patch) {
  prefs = { ...prefs, ...patch };
  chrome.storage.local.set({ renikPrefs: prefs });
}
$('auto').onchange = e => saveStyle({ auto: e.target.checked });
$('c-body').oninput = e => saveStyle({ body: e.target.value, auto: false });
$('c-joint').oninput = e => saveStyle({ joint: e.target.value, auto: false });
$('c-accent').oninput = e => saveStyle({ accent: e.target.value, auto: false });
$('glow').oninput = e => saveStyle({ glow: +e.target.value });
for (const [body, joint, accent] of PRESETS) {
  const b = document.createElement('button');
  b.dataset.i18nTitle = 'preset';
  b.style.background = `conic-gradient(${body} 0 33%, ${joint} 0 66%, ${accent} 0)`;
  b.onclick = () => saveStyle({ body, joint, accent, auto: false });
  $('presets').appendChild(b);
}
$('lang').onchange = e => { savePrefs({ lang: e.target.value }); applyLanguage(); renderAll(); renderNotes(); };
$('rememberPages').onchange = e => savePrefs({ rememberPages: e.target.checked });
$('reset').onclick = () => { if (confirm(T('resetConfirm'))) chrome.runtime.sendMessage({ type: 'RESET' }); };

// ============================================================
// SITUS INI (tab Halaman)
// ============================================================
let siteHost = null;
async function initSiteCard() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const u = new URL(tab?.url ?? '');
    if (/^https?:$/.test(u.protocol)) siteHost = u.hostname;
  } catch {}
  $('siteHost').textContent = '· ' + (siteHost ? siteHost.replace(/^www\./, '') : T('siteNA'));
  $('siteMode').disabled = !siteHost;
  $('siteMode').value = (siteHost && prefs.sites?.[siteHost]) || 'normal';
  renderSiteOverride();
}
function renderSiteOverride() {
  const g = prefs.global ?? 'normal';
  $('siteOverride').textContent = g === 'normal' ? '' : T('siteOverride', T(g === 'off' ? 'modeOff' : 'modeHidden'));
}
$('siteMode').onchange = e => {
  const sites = { ...(prefs.sites ?? {}) };
  if (e.target.value === 'normal') delete sites[siteHost]; else sites[siteHost] = e.target.value;
  savePrefs({ sites });
};
$('calm').onchange = e => savePrefs({ calm: e.target.checked });

// ============================================================
// CADANGAN
// ============================================================
const isFull = new URLSearchParams(location.search).has('full'); // menu dibuka sebagai tab biasa
const today = () => new Date().toISOString().slice(0, 10);

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

$('exportAll').onclick = async () => {
  const data = await chrome.storage.local.get(['renik', 'renikLang', 'renikPages', 'renikNotes', 'renikStyle', 'renikPrefs']);
  const file = { app: 'lexarach', version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(), data };
  download(`lexarach-cadangan-${today()}.json`, JSON.stringify(file, null, 1), 'application/json');
  $('backupMsg').textContent = T('exported');
};

$('exportMd').onclick = () => {
  const fmt = t => new Date(t).toLocaleString(lang() === 'en' ? 'en-GB' : 'id-ID', { dateStyle: 'long', timeStyle: 'short' });
  const lines = [`# ${T('mdTitle')}`, '', `_${T('mdExported', fmt(Date.now()))}_`, ''];
  for (const n of notes) {
    let host = '';
    try { host = n.url ? new URL(n.url).hostname.replace(/^www\./, '') : ''; } catch {}
    lines.push(`## ${n.title || host || T('untitled')}`, '');
    lines.push(...n.text.split('\n').map(l => '> ' + l), '');
    lines.push(n.url ? `${T('mdSource')}: [${n.title || host}](${n.url}) · ${fmt(n.at)}` : fmt(n.at), '', '---', '');
  }
  download(`lexarach-catatan-${today()}.md`, lines.join('\n'), 'text/markdown');
  $('backupMsg').textContent = T('exported');
};

// Jendela menu kecil akan tertutup saat dialog pilih-file muncul,
// jadi impor dikerjakan di tab biasa (popup.html?full).
$('importBtn').onclick = () => {
  if (!isFull) {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/popup/popup.html?full=1&tab=settings&import=1') });
    window.close();
    return;
  }
  $('importFile').click();
};
$('importFile').onchange = async e => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  let file;
  try { file = JSON.parse(await f.text()); } catch { file = null; }
  const d = file?.data;
  const valid = ['lexarach', 'renik'].includes(file?.app) && d?.renik?.personality && typeof d.renik.words === 'object';
  if (!valid) { $('backupMsg').textContent = T('importBad'); return; }
  if (!confirm(T('importConfirm', (d.renikNotes ?? []).length))) return;
  const r = await chrome.runtime.sendMessage({ type: 'IMPORT', data: d });
  $('backupMsg').textContent = r?.ok ? T('importOk') : T('importBad');
};

// ============================================================
// MULAI
// ============================================================
function renderAll() {
  if (!state) return;
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = T(el.dataset.i18nTitle); });
  renderStatus();
  if ($('tab-memory').classList.contains('on')) search();
  applyTheme();
}

// Memori tersimpan dalam 3 bagian (lihat background.js); di sini digabung lagi.
function merge(core, langPart, pages) {
  if (!core) return null;
  return { ...core, ...(langPart ?? {}), pages: pages ?? core.pages ?? [] };
}

$('ver').textContent = 'v' + chrome.runtime.getManifest().version;
chrome.storage.local.get(['renik', 'renikLang', 'renikPages', 'renikStyle', 'renikPrefs', 'renikNotes']).then(r => {
  prefs = r.renikPrefs ?? {};
  notes = r.renikNotes ?? [];
  style = { ...DEFAULT_STYLE, ...r.renikStyle };
  state = merge(r.renik, r.renikLang, r.renikPages);
  applyLanguage();
  renderSettings();
  renderAll();
  search();
  renderNotes();
  initSiteCard();

  // Dibuka sebagai tab biasa (mis. untuk impor): lebar tetap, langsung ke tab yang diminta.
  if (isFull) {
    document.body.classList.add('full');
    document.querySelector('#siteCard').style.display = 'none';
    const want = new URLSearchParams(location.search).get('tab');
    if (want) document.querySelector(`nav button[data-tab="${want}"]`)?.click();
    if (new URLSearchParams(location.search).has('import')) $('backupMsg').textContent = '↓ ' + T('importBtn');
  }

  // Cek apakah tab ini menjalankan kode Lexarach versi terbaru.
  askTab({ type: 'PING' }).then(res => {
    const want = chrome.runtime.getManifest().version;
    if (res?.ok && res.build !== want) {
      $('stale').style.display = 'block';
      $('stale').textContent = T('stale', res.build, want);
    }
  });
});

chrome.storage.onChanged.addListener(ch => {
  if (ch.renikPrefs) { prefs = ch.renikPrefs.newValue ?? {}; renderPresence(); renderSiteOverride(); }
  if (ch.renikNotes) { notes = ch.renikNotes.newValue ?? []; renderNotes(); if (state) renderStatus(); }
  if (!state && !ch.renik) return;
  if (ch.renik) state = merge(ch.renik.newValue, { chain: state?.chain, chain2: state?.chain2, seen: state?.seen }, state?.pages);
  if (ch.renikLang && state) Object.assign(state, ch.renikLang.newValue ?? {});
  if (ch.renikPages && state) state.pages = ch.renikPages.newValue ?? [];
  renderAll();
});
