// ============================================================
// src/content/02-senses.js — Indra: melihat kata, memilih incaran, makan, mencatat halaman
// Bagian dari tubuh Lexarach. Semua file di src/content/ berbagi variabel yang sama
// (urutan dimuat diatur di manifest.json). Listener baru dipasang di main().
// ============================================================

// ==========================================================
// 6. INDRA PENGLIHATAN: kata apa saja yang tampil di layar?
// ==========================================================
let candidates = []; // [{ word, range }]
const SKIP = 'script,style,noscript,textarea,input,select,code,pre,[contenteditable="true"],[contenteditable=""]';

function scanVisibleWords() {
  if (hasPasswordField()) { candidates = []; return; } // halaman sensitif: tutup mata
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const el = node.parentElement;
      if (!el || !node.textContent.trim() || el.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let node, checked = 0;
  while ((node = walker.nextNode()) && checked++ < 4000 && out.length < 150) {
    const pr = node.parentElement.getBoundingClientRect();
    if (pr.bottom < 0 || pr.top > innerHeight || pr.width === 0) continue; // di luar layar
    const re = /\p{L}{4,20}/gu; // kata dari huruf saja, 4–20 huruf
    let m;
    while ((m = re.exec(node.textContent)) && out.length < 150) {
      const word = m[0].toLowerCase();
      if (STOPWORDS.has(word) || eatenHere.has(word)) continue;
      // Range = penunjuk ke potongan teks, tanpa mengubah halaman.
      const range = document.createRange();
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const r = range.getBoundingClientRect();
      if (r.width === 0 || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
      out.push({ word, range });
    }
  }
  candidates = out;
}

// ==========================================================
// 7. RASA INGIN TAHU: memilih kata yang paling menarik
// ==========================================================
let target = null; // { word, range, interest, novel }
let huntTime = 0;  // sudah berapa detik mengejar target ini
let lastChoose = 0;
const ignoredHere = new Set(); // kata yang "menyerah" dikejar di halaman ini

function chooseTarget() {
  lastChoose = performance.now();
  huntTime = 0;
  const m = mouth();
  const c = memory.personality.curiosity;
  let best = null, bestScore = -Infinity;
  for (const cand of candidates) {
    if (eatenHere.has(cand.word) || ignoredHere.has(cand.word)) continue;
    // novelty = 1 kalau belum pernah lihat, mendekati 0 kalau sudah sering.
    const novelty = 1 / (1 + knownCount(cand.word));
    // Yang penasaran suka hal baru; yang tidak penasaran suka "makanan favorit".
    const interest = c * novelty + (1 - c) * (1 - novelty) * 0.6;
    const r = cand.range.getBoundingClientRect();
    const dist = Math.hypot(r.x + r.width / 2 - m.x, r.y + r.height / 2 - m.y);
    const score = interest - dist / 1500 + Math.random() * 0.15;
    if (score > bestScore) { bestScore = score; best = { ...cand, interest, novel: novelty === 1 }; }
  }
  // Kalau tidak ada yang cukup menarik, ia bosan dan berkeliaran saja.
  target = best && best.interest > 0.15 ? best : null;
}

function targetRect() {
  if (!target) return null;
  const r = target.range.getBoundingClientRect();
  if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) { target = null; return null; } // hilang (di-scroll)
  return r;
}

// ==========================================================
// 8. MAKAN
// ==========================================================
const crumbs = []; // efek visual kata yang sedang ditelan

function eat(point) {
  lungeAt = performance.now(); // animasi menyambar
  hunger = Math.max(0, hunger - 0.07);
  const word = target.word;
  // Catat pasangan kata berurutan dari kalimat tempat kata itu berada (lihat speech.js).
  // Dipakai saat bermimpi untuk menemukan kata-kata yang mirip (asosiasi).
  // Pasangan yang sama hanya dicatat sekali per halaman.
  const fresh = ([k, n]) => !learnedHere.has(k + '→' + n) && learnedHere.add(k + '→' + n);
  const newPairs = LexarachSpeech.extract(target.range.startContainer.textContent, target.range.startOffset).filter(fresh);
  pendingPairs.push(...newPairs);
  LexarachSpeech.learn(memory, newPairs);
  eatenHere.add(word);
  pending.push(word);
  memory.stats.wordsEaten++;
  // Gumaman karena kejadian
  const seen = (memory.words[word]?.count ?? 0) + 1;
  if ([5, 10, 25, 50, 100].includes(seen)) say(T('again', word, seen), { key: 'again-' + word });
  else if (target.novel && Math.random() < 0.15 + memory.personality.boldness * 0.25) say(T('newWord', word));
  if (eatenHere.size === 30) say(T('full', 30), { key: 'full' });
  // Update salinan memori lokal supaya langsung terasa "sudah kenal".
  if (memory.words[word]) memory.words[word].count++;
  else memory.words[word] = { count: 1, strength: 1, lastSeen: Date.now() };
  crumbs.push({ x: point.x, y: point.y, word, t: 0, novel: target.novel });
  candidates = candidates.filter(c => c.word !== word);
  target = null;
  // Mengunyah dulu; makhluk yang berenergi rendah mengunyah lebih lama.
  digestUntil = performance.now() + 500 + (1 - memory.personality.energy) * 1200;
}

// Lapor ke otak tiap 4 detik.
// Kata dikirim tiap 4 detik, tapi bahan belajar bahasa (yang datanya lebih besar)
// dikumpulkan dulu dan dikirim paling sering tiap 20 detik, atau saat pindah tab.
let lastLangFlush = Date.now();
function flush(force = false) {
  const sendLang = force || Date.now() - lastLangFlush > 20000;
  if (!pending.length && !(sendLang && pendingPairs.length)) return;
  const msg = { type: 'ATE', words: pending.splice(0) };
  if (sendLang) {
    msg.pairs = pendingPairs.splice(0);
    lastLangFlush = Date.now();
  }
  chrome.runtime.sendMessage(msg).catch(() => {});
}

// ==========================================================
// 8a. INGATAN HALAMAN: catat halaman yang benar-benar dibaca
// ==========================================================
// Setelah halaman dilihat 8 detik (dan sekali lagi setelah 60 detik, karena
// mungkin sudah di-scroll lebih jauh), insight.js mengambil kata kunci & kalimat
// intinya, lalu otak menyimpannya untuk fitur pencarian.
// URL disimpan tanpa ?query dan #hash (lebih privat). Bisa dimatikan di Pengaturan.
let readTime = 0;           // berapa detik halaman ini sudah dilihat
const indexAt = [8, 60];    // kapan mencatat
function tickReading(dt) {
  const before = readTime;
  readTime += dt;
  for (const t of indexAt) if (before < t && readTime >= t) indexNow();
}
function indexNow() {
  if (prefs.rememberPages === false || siteMode() === 'off' || hasPasswordField()) return;
  const idle = window.requestIdleCallback ?? (fn => setTimeout(fn, 0));
  idle(() => {
    const r = LexarachInsight.indexPage(knownCount);
    if (!r.terms.length) return;
    const firstTime = !pageTerms.length;
    pageTerms = r.terms.map(t => t.w);
    if (firstTime) tryRecall(r.terms); // hanya sekali per halaman
    chrome.runtime.sendMessage({
      type: 'INDEX',
      page: { url: location.origin + location.pathname, title: document.title.slice(0, 160) },
      terms: r.terms,
      snippets: r.snippets
    }).catch(() => {});
  });
}

// Dibuka lewat "Buka & sorot" di menu Ingatan? Ambil kalimat yang harus disorot.
let markChecked = false;
function checkMark() {
  if (markChecked) return;
  markChecked = true;
  chrome.runtime.sendMessage({ type: 'TAKE_MARK', url: location.origin + location.pathname }).then(res => {
    if (!res?.text) return;
    // Banyak situs memuat isinya belakangan, jadi coba sampai 6 kali (±9 detik).
    let tries = 0;
    const attempt = () => {
      const ok = LexarachInsight.highlightText(res.text, style.auto ? undefined : style.accent);
      if (ok) say(T('found'), { force: true });
      else if (++tries < 6) setTimeout(attempt, 1500);
    };
    attempt();
  }).catch(() => {});
}
