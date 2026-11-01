// ============================================================
// background.js — "OTAK" Lexarach
// ------------------------------------------------------------
// Service worker ini satu-satunya yang MENULIS memori.
// Content script (tubuh di tiap tab) cuma mengirim pesan:
//   HELLO  -> "aku baru masuk ke halaman X"
//   ATE    -> "aku barusan makan kata-kata ini" (+ bahan belajar bahasa)
//   INDEX  -> "ini kata kunci & kalimat inti halaman yang sedang dibaca"
//   SLEEP  -> tidurkan / bangunkan
//   RESET  -> hapus semua memori (lahir ulang)
//
// Memori disimpan dalam TIGA bagian terpisah, supaya yang ditulis ulang
// hanya bagian yang berubah (lebih ringan saat memori makin besar):
// (Awalan "renik" adalah nama lama proyek; dipertahankan agar ingatan lama tetap terbaca.)
//   "renik"      -> inti: kepribadian, kata, statistik, mimpi, hubungan kata
//   "renikLang"  -> urutan kata: chain (lihat speech.js)
//   "renikPages" -> ingatan halaman: judul, alamat, kata kunci, kalimat inti
// Kenapa ditulis di satu tempat? Kalau 5 tab menulis bersamaan,
// datanya bisa saling menimpa. Di sini semua update diantre.
// ============================================================

// Catatan urutan kata (bahan asosiasi saat bermimpi), dipakai bersama dengan tubuh.
importScripts('../shared/lang.js', '../shared/speech.js');

const KEYS = { core: 'renik', lang: 'renikLang', pages: 'renikPages' };

// Memori melemah setengahnya tiap 2 hari kalau kata itu tidak ditemui lagi.
const HALF_LIFE_MS = 2 * 24 * 60 * 60 * 1000;
// Kalau kekuatan memori di bawah ini, kata itu "terlupakan" (dihapus).
const FORGET_BELOW = 0.05;
// Batas jumlah kata supaya storage tidak membengkak.
const MAX_WORDS = 800;

// ---------- Nama spesies (gaya latin, ditentukan saat lahir) ----------
const GENUS = ['Nexora', 'Retica', 'Vectra', 'Syntaxa', 'Lumina', 'Datona', 'Cibera', 'Glypha', 'Indexa', 'Lexara'];
const EPITHET = {
  curiosity: ['curiosa', 'exploratrix', 'quaerens'],
  boldness: ['audax', 'ferox', 'intrepida'],
  energy: ['velox', 'agilis', 'rapida']
};
function makeSpecies(p) {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  // Julukan diambil dari sifat paling menonjol.
  const top = Object.keys(EPITHET).sort((a, b) => p[b] - p[a])[0];
  return `${pick(GENUS)} ${pick(EPITHET[top])}`;
}

// ---------- Kelahiran ----------
function newCreature() {
  // Kepribadian awal acak, tapi tidak ekstrem (0.3 – 0.7).
  const r = () => +(0.3 + Math.random() * 0.4).toFixed(3);
  const personality = {
    curiosity: r(), // suka hal baru vs. suka yang familiar
    boldness: r(),  // berani mendekati kursor vs. kabur
    energy: r()     // cepat & lincah vs. lambat & santai
  };
  return {
    born: Date.now(),
    species: makeSpecies(personality),
    personality,
    words: {},        // { kata: { count, strength, lastSeen } }
    stats: { wordsEaten: 0, pagesVisited: 0, sites: {} }
  };
}

// ---------- Rumus lupa (exponential decay) ----------
// Kekuatan disimpan "pada saat terakhir dilihat", lalu dihitung
// melemahnya berdasarkan waktu yang sudah lewat.
function effectiveStrength(w, now) {
  return w.strength * Math.pow(0.5, (now - w.lastSeen) / HALF_LIFE_MS);
}

function forgetWeakMemories(state, now) {
  const entries = Object.entries(state.words);
  for (const [word, w] of entries) {
    if (effectiveStrength(w, now) < FORGET_BELOW) delete state.words[word];
  }
  // Kalau masih kebanyakan, buang yang paling lemah.
  const left = Object.entries(state.words);
  if (left.length > MAX_WORDS) {
    left
      .sort((a, b) => effectiveStrength(a[1], now) - effectiveStrength(b[1], now))
      .slice(0, left.length - MAX_WORDS)
      .forEach(([word]) => delete state.words[word]);
  }
}

const clamp = (v, lo = 0.05, hi = 0.95) => Math.min(hi, Math.max(lo, v));

// ---------- Antrean update supaya tidak saling menimpa ----------
// Ketiga bagian dimuat lalu digabung jadi satu objek "state" supaya kode lain tetap
// sederhana (state.words, state.chain, state.pages, ...). Setelah diubah,
// hanya bagian yang disebut di "touched" yang ditulis kembali.
const LANG_FIELDS = ['chain'];
let queue = Promise.resolve();

function update(mutator, touched = ['core']) {
  const job = queue.then(async () => {
    const r = await chrome.storage.local.get(Object.values(KEYS));
    const state = r.renik ?? newCreature();
    if (!state.species) state.species = makeSpecies(state.personality); // untuk Lexarach versi lama
    delete state.sleeping; delete state.sleptAt; // fitur tidur sudah dihapus (1.1.0)

    // Migrasi dari versi lama (semua tersimpan di "renik")
    let migrated = false;
    const lang = r.renikLang ?? (migrated = true, Object.fromEntries(LANG_FIELDS.map(f => [f, state[f] ?? {}])));
    const pages = r.renikPages ?? (migrated = true, state.pages ?? []);
    for (const f of LANG_FIELDS) state[f] = lang[f] ?? {};
    state.pages = pages;

    mutator(state, Date.now());

    const write = new Set(migrated ? ['core', 'lang', 'pages'] : touched);
    const out = {};
    if (write.has('lang')) out[KEYS.lang] = Object.fromEntries(LANG_FIELDS.map(f => [f, state[f]]));
    if (write.has('pages')) out[KEYS.pages] = state.pages;
    if (write.has('core')) {
      const core = { ...state };
      for (const f of [...LANG_FIELDS, 'chain2', 'seen', 'pages']) delete core[f]; // chain2 & seen: sisa fitur bicara lama
      out[KEYS.core] = core;
    }
    if (Object.keys(out).length) await chrome.storage.local.set(out);
    return state;
  });
  queue = job.catch(err => console.error('[Lexarach] update gagal:', err));
  return job;
}

// ---------- Apa yang terjadi saat menerima pesan ----------
function onHello(state, now, host) {
  state.stats.pagesVisited++;
  const isNewSite = !state.stats.sites[host];
  state.stats.sites[host] = (state.stats.sites[host] ?? 0) + 1;
  // Menjelajah situs baru membuatnya sedikit lebih berani.
  if (isNewSite) state.personality.boldness = clamp(state.personality.boldness + 0.004);
  // Pindah-pindah halaman itu melelahkan sedikit.
  state.personality.energy = clamp(state.personality.energy * 0.997);
  forgetWeakMemories(state, now);
}

function onAte(state, now, words) {
  const p = state.personality;
  for (const word of words) {
    const w = state.words[word];
    if (!w) {
      // Kata BARU: rasa ingin tahunya "dihadiahi", jadi makin penasaran.
      state.words[word] = { count: 1, strength: 1, lastSeen: now };
      p.curiosity = clamp(p.curiosity + 0.003);
    } else {
      // Kata LAMA: memori diperkuat, tapi rasa ingin tahu turun sedikit (bosan).
      w.strength = effectiveStrength(w, now) + 1;
      w.count++;
      w.lastSeen = now;
      p.curiosity = clamp(p.curiosity - 0.001);
    }
    state.stats.wordsEaten++;
    p.energy = clamp(p.energy + 0.001); // makan = tenaga
  }
  forgetWeakMemories(state, now);
}

// ============================================================
// MERAPIKAN INGATAN ("mimpi") — berjalan diam-diam di latar belakang
// ------------------------------------------------------------
// Setiap 30 menit, satu siklus:
//   1. Konsolidasi: kenangan terkuat diperkuat, yang lemah lebih cepat pudar
//   2. Asosiasi: kata yang punya "tetangga" sama dianggap mirip lalu dihubungkan
//   3. Jurnal: hubungan kata baru yang ditemukan dicatat
// ============================================================
const DREAM_ALARM = 'lexarach-dream';
const IGNORE = new Set(['<S>', '<E>']);

// Tetangga sebuah kata = kata yang biasa muncul sebelum DAN sesudahnya.
function neighbors(chain, words) {
  const n = Object.fromEntries(words.map(w => [w, new Set()]));
  for (const [a, row] of Object.entries(chain)) {
    for (const b of Object.keys(row)) {
      if (n[a] && !IGNORE.has(b)) n[a].add('>' + b); // sesudahnya
      if (n[b] && !IGNORE.has(a)) n[b].add('<' + a); // sebelumnya
    }
  }
  return n;
}

// Kemiripan Jaccard: (tetangga yang sama) / (semua tetangga keduanya)
function similarity(A, B) {
  if (!A.size || !B.size) return 0;
  let same = 0;
  for (const x of A) if (B.has(x)) same++;
  return same / (A.size + B.size - same);
}

function dreamCycle(state, now) {
  // --- 1. Konsolidasi ---
  const ranked = Object.entries(state.words)
    .map(([w, d]) => [w, effectiveStrength(d, now)])
    .sort((a, b) => b[1] - a[1]);
  for (const [w, eff] of ranked.slice(0, 5)) {
    state.words[w].strength = eff + 0.3;
    state.words[w].lastSeen = now;
  }
  for (const [w, eff] of ranked) {
    if (eff < 0.2) state.words[w].strength *= 0.7; // kenangan samar makin pudar
  }
  forgetWeakMemories(state, now);

  // --- 2. Asosiasi ---
  state.links ??= {};
  const chain = state.chain ?? {};
  // Hanya kata "isi" (bukan kata umum seperti "atas", "yang") supaya hubungannya masuk akal.
  const pool = ranked.map(([w]) => w)
    .filter(w => chain[w] && w.length >= 4 && !LexarachLang.STOP.has(w))
    .slice(0, 40);
  const nb = neighbors(chain, pool);
  const found = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      const sim = similarity(nb[a], nb[b]);
      if (sim < 0.25) continue;
      const isNew = !state.links[a]?.[b];
      (state.links[a] ??= {})[b] = +sim.toFixed(2);
      (state.links[b] ??= {})[a] = +sim.toFixed(2);
      if (isNew) found.push([a, b, sim]);
    }
  }
  // Tiap kata maksimal 5 hubungan terkuat.
  for (const [w, row] of Object.entries(state.links)) {
    const top = Object.entries(row).sort((x, y) => y[1] - x[1]).slice(0, 5);
    state.links[w] = Object.fromEntries(top);
  }

  // --- 3. Jurnal: catat hubungan kata baru yang ditemukan malam ini ---
  if (found.length) {
    state.dreams ??= [];
    state.dreams.unshift({
      at: now,
      links: found.sort((x, y) => y[2] - x[2]).slice(0, 3).map(([a, b]) => `${a} ~ ${b}`)
    });
    state.dreams = state.dreams.slice(0, 10);
  }
  state.stats.dreams = (state.stats.dreams ?? 0) + 1;
}

// Dijadwalkan ulang setiap browser dibuka / extension dipasang (create dengan nama yang sama
// hanya mengganti jadwal lama, jadi aman dipanggil berkali-kali).
function scheduleDreams() {
  chrome.alarms.create(DREAM_ALARM, { delayInMinutes: 5, periodInMinutes: 30 });
}
chrome.runtime.onStartup.addListener(scheduleDreams);

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== DREAM_ALARM) return;
  update((s, now) => {
    if (Object.keys(s.words ?? {}).length < 20) return; // belum cukup bahan
    dreamCycle(s, now);
  }); // hanya mengubah inti (kata, hubungan, jurnal)
});

// ---------- Ingatan halaman (untuk fitur "Cari di ingatan") ----------
// Tiap halaman: alamat, judul, kapan terakhir dibaca,
//   terms    : kata kunci [kata, kata_dasar..., bobot] hasil TF-IDF (insight.js)
//   snippets : beberapa kalimat inti (untuk cuplikan hasil pencarian)
const MAX_PAGES = 400;
function indexPage(state, now, msg) {
  const page = msg.page;
  if (!page?.url) return;
  let p = state.pages.find(x => x.url === page.url);
  if (!p) { p = { url: page.url }; state.pages.push(p); }
  p.title = page.title || p.title || '';
  p.at = now;
  p.terms = msg.terms ?? p.terms ?? [];
  p.snippets = msg.snippets ?? p.snippets ?? [];
  delete p.words; // format lama
  state.pages.sort((x, y) => y.at - x.at);
  state.pages = state.pages.slice(0, MAX_PAGES);
}

// ---------- Catatan: teks yang Anda "berikan" kepada Lexarach ----------
// Disimpan terpisah di "renikNotes" (tulisan pengguna, tidak ikut terhapus saat reset memori).
//   { id, text, url, title, at, edited? }
const MAX_NOTES = 500, MAX_NOTE_CHARS = 3000;
let notesQueue = Promise.resolve();
function notesOp(fn) {
  const job = notesQueue.then(async () => {
    const { renikNotes = [] } = await chrome.storage.local.get('renikNotes');
    const out = fn(renikNotes) ?? renikNotes;
    await chrome.storage.local.set({ renikNotes: out });
    return out;
  });
  notesQueue = job.catch(err => console.error('[Lexarach] catatan gagal:', err));
  return job;
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- Menu klik kanan: "Beri makan Lexarach" ----------
async function setupContextMenu() {
  // Saat Lexarach dinonaktifkan, menu klik kanannya ikut disembunyikan.
  const { renikPrefs = {} } = await chrome.storage.local.get('renikPrefs');
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'lexarach-feed', title: chrome.i18n.getMessage('feedMenu'), contexts: ['selection'],
      visible: renikPrefs.global !== 'off'
    });
  });
}
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local' || !ch.renikPrefs) return;
  const off = ch.renikPrefs.newValue?.global === 'off';
  chrome.contextMenus.update('lexarach-feed', { visible: !off }).catch?.(() => {});
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'lexarach-feed' || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'FEED_SELECTION', text: info.selectionText ?? '' }).catch(() => {});
});

// ---------- Pintasan keyboard: Alt+R = beri makan Lexarach teks yang sedang diblok ----------
chrome.commands.onCommand.addListener(async command => {
  // Alt+H: tampilkan / sembunyikan Lexarach di semua situs.
  if (command === 'toggle-hide') {
    const { renikPrefs = {} } = await chrome.storage.local.get('renikPrefs');
    if (renikPrefs.global === 'off') return; // sedang nonaktif: aktifkan lewat menu
    renikPrefs.global = renikPrefs.global === 'hidden' ? 'normal' : 'hidden';
    await chrome.storage.local.set({ renikPrefs });
    return;
  }
  if (command !== 'feed-lexarach') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'FEED_SELECTION_CURRENT' }).catch(() => {});
});

// ---------- "Buka & sorot" dari hasil pencarian ----------
// Popup menitipkan kalimat yang harus disorot untuk alamat tertentu;
// saat halaman itu terbuka, content script mengambilnya (TAKE_MARK) lalu menyorotnya.
async function putMark(url, text) {
  const { renikMarks = {} } = await chrome.storage.session.get('renikMarks');
  renikMarks[url] = { text, at: Date.now() };
  await chrome.storage.session.set({ renikMarks });
}
async function takeMark(url) {
  const { renikMarks = {} } = await chrome.storage.session.get('renikMarks');
  const m = renikMarks[url];
  if (!m) return null;
  delete renikMarks[url];
  await chrome.storage.session.set({ renikMarks });
  return Date.now() - m.at < 60000 ? m.text : null; // hanya berlaku 1 menit
}

// ---------- Satu Lexarach: hanya tab aktif yang dihuni ----------
// ID tab aktif disimpan di storage.session (tetap ada walau service worker sempat tidur).
async function currentActiveTab() {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return t?.id ?? null;
}
async function setActive(tabId) {
  const prev = (await chrome.storage.session.get('activeTab')).activeTab ?? null;
  await chrome.storage.session.set({ activeTab: tabId });
  // Arah masuk: tab baru di kanan tab lama -> Lexarach masuk dari kiri, dan sebaliknya.
  let from = null;
  if (prev !== null && tabId !== null && prev !== tabId) {
    try {
      const [a, b] = await Promise.all([chrome.tabs.get(prev), chrome.tabs.get(tabId)]);
      if (a.windowId === b.windowId) from = b.index > a.index ? 'left' : 'right';
    } catch { /* tab lama sudah ditutup */ }
  }
  if (prev !== null && prev !== tabId) chrome.tabs.sendMessage(prev, { type: 'FOCUS', active: false }).catch(() => {});
  if (tabId !== null) chrome.tabs.sendMessage(tabId, { type: 'FOCUS', active: true, from }).catch(() => {});
}
chrome.tabs.onActivated.addListener(({ tabId }) => setActive(tabId));
chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return; // pindah ke aplikasi lain: biarkan
  const [t] = await chrome.tabs.query({ active: true, windowId });
  if (t) setActive(t.id);
});

// Saat dipasang / diperbarui: pasang Lexarach versi baru ke semua tab yang sudah terbuka,
// supaya tidak perlu refresh satu per satu (skrip baru juga membersihkan versi lama).
const CONTENT_FILES = chrome.runtime.getManifest().content_scripts[0].js;
chrome.runtime.onInstalled.addListener(async details => {
  scheduleDreams();
  chrome.alarms.clear('renik-dream'); // nama alarm sebelum ganti nama
  update(() => {});
  setupContextMenu();
  if (details.reason === 'chrome_update') return; // skrip lama masih hidup & sama versinya
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const t of tabs) {
    // Tab yang masih dimuat akan dipasangi Chrome sendiri (extension sudah terdaftar).
    if (t.status !== 'complete') continue;
    // Tanya dulu: apakah Lexarach versi ini sudah ada di tab itu? (Chrome kadang sudah memasangnya
    // sendiri.) Memasang dua kali di tempat yang sama akan memicu error "already declared".
    chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => !!window.__lexarachInjected })
      .then(([res]) => {
        if (!res?.result) chrome.scripting.executeScript({ target: { tabId: t.id }, files: CONTENT_FILES });
      })
      .catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Tab baru dimuat / terlihat lagi: "apakah aku tab yang aktif?"
  if (msg.type === 'WHO_ACTIVE') {
    (async () => {
      const cur = await currentActiveTab();
      const saved = (await chrome.storage.session.get('activeTab')).activeTab ?? null;
      if (cur !== null && cur !== saved) await setActive(cur);
      sendResponse({ active: sender.tab?.id === (cur ?? saved) });
    })();
    return true;
  }
  // "Pernahkah aku membaca hal serupa?" — cari halaman lain yang berbagi kata kunci
  // dengan halaman yang sedang dibuka. Dipakai untuk gumaman pengingat.
  if (msg.type === 'RECALL') {
    chrome.storage.local.get('renikPages').then(({ renikPages = [] }) => {
      const want = new Set(msg.stems ?? []);
      let best = null;
      for (const p of renikPages) {
        if (p.url === msg.url || Date.now() - p.at < 10 * 60 * 1000) continue; // bukan halaman ini / yang barusan
        const shared = (p.terms ?? []).filter(t => (t.s ?? []).some(s => want.has(s)));
        if (shared.length < 2) continue;
        const score = shared.reduce((n, t) => n + (t.k ?? 0.5), 0);
        if (!best || score > best.score) best = { score, p, words: shared.slice(0, 2).map(t => t.w) };
      }
      sendResponse(best && best.score >= 0.8
        ? { title: best.p.title, url: best.p.url, at: best.p.at, words: best.words }
        : null);
    });
    return true;
  }
  // ---------- Catatan ----------
  if (msg.type === 'ADD_NOTE') {
    const text = String(msg.text ?? '').trim().slice(0, MAX_NOTE_CHARS);
    if (!text) { sendResponse({ ok: false }); return false; }
    notesOp(notes => [{ id: newId(), text, url: msg.page?.url ?? '', title: msg.page?.title ?? '', at: Date.now() }, ...notes].slice(0, MAX_NOTES))
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'UPDATE_NOTE') {
    notesOp(notes => notes.map(n => (n.id === msg.id ? { ...n, text: String(msg.text).trim().slice(0, MAX_NOTE_CHARS), edited: Date.now() } : n)))
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'DELETE_NOTE') {
    notesOp(notes => notes.filter(n => n.id !== msg.id)).then(() => sendResponse({ ok: true }));
    return true;
  }
  // ---------- Impor cadangan (dari menu Pengaturan) ----------
  // Ingatan, pengaturan, & warna diganti dengan isi file; catatan DIGABUNG (tidak ada yang hilang).
  if (msg.type === 'IMPORT') {
    const d = msg.data ?? {};
    const job = queue.then(async () => {
      const set = {};
      for (const k of ['renik', 'renikLang', 'renikPages', 'renikStyle', 'renikPrefs']) if (d[k] !== undefined) set[k] = d[k];
      await chrome.storage.local.set(set);
    });
    queue = job.catch(err => console.error('[Lexarach] impor gagal:', err));
    job
      .then(() => notesOp(notes => {
        const have = new Set(notes.map(n => n.id));
        const incoming = (d.renikNotes ?? []).filter(n => n?.id && typeof n.text === 'string' && !have.has(n.id));
        return [...notes, ...incoming].sort((x, y) => y.at - x.at).slice(0, MAX_NOTES);
      }))
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  // ---------- Lupakan satu halaman dari ingatan ----------
  if (msg.type === 'FORGET_PAGE') {
    update(s => { s.pages = s.pages.filter(p => p.url !== msg.url); }, ['pages']).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'PUT_MARK') { putMark(msg.url, msg.text).then(() => sendResponse({ ok: true })); return true; }
  if (msg.type === 'TAKE_MARK') { takeMark(msg.url).then(text => sendResponse({ text })); return true; }

  let job;
  // Tubuh (content scripts) butuh inti + bahasa, tapi tidak perlu daftar halaman.
  const forBody = s => { const { pages, ...rest } = s; return rest; };
  switch (msg.type) {
    case 'HELLO': job = update((s, now) => onHello(s, now, msg.host)).then(forBody); break;
    case 'ATE': {
      const hasLang = !!msg.pairs?.length;
      job = update((s, now) => {
        onAte(s, now, msg.words ?? []);
        if (hasLang) LexarachSpeech.learn(s, msg.pairs);
      }, hasLang ? ['core', 'lang'] : ['core']).then(() => ({ ok: true }));
      break;
    }
    case 'INDEX': job = update((s, now) => indexPage(s, now, msg), ['pages']).then(() => ({ ok: true })); break;
    case 'MOOD': {
      // Perubahan kecil kepribadian karena interaksi (dikagetkan / dielus).
      const ok = ['curiosity', 'boldness', 'energy'].includes(msg.trait) && Math.abs(msg.delta) <= 0.02;
      job = update(s => { if (ok) s.personality[msg.trait] = clamp(s.personality[msg.trait] + msg.delta); })
        .then(() => ({ ok }));
      break;
    }
    case 'RESET': job = update(s => {
      for (const k of Object.keys(s)) delete s[k];
      Object.assign(s, newCreature(), { chain: {}, pages: [] });
    }, ['core', 'lang', 'pages']).then(forBody); break;
    default: return false;
  }
  job.then(state => sendResponse(state)).catch(() => sendResponse(null));
  return true; // artinya: sendResponse akan dipanggil nanti (async)
});
