// ============================================================
// src/content/08-life.js — Siklus hidup: satu Lexarach per tab, tidur, pesan, MULAI
// Bagian dari tubuh Lexarach. Semua file di src/content/ berbagi variabel yang sama
// (urutan dimuat diatur di manifest.json). Listener baru dipasang di main().
// ============================================================

// ==========================================================
// 11. SIKLUS HIDUP
// ==========================================================
// ---------- Satu Lexarach untuk semua tab ----------
// Hanya tab yang sedang kamu lihat yang "dihuni" Lexarach (diatur oleh background.js).
// Tab lain benar-benar diam: tidak digambar, tidak memindai -> hemat CPU.
// Saat pindah tab, posisi & arah hadap disimpan ("renikLive") lalu dilanjutkan
// di tab baru, jadi terasa seperti satu makhluk yang mengikutimu.
let focused = false;
let looping = false;

function saveLive() {
  chrome.storage.local.set({ renikLive: { x: body.x / innerWidth, y: body.y / innerHeight, heading, at: Date.now() } });
}
// Mulai "bersih" di posisi baru: kaki diatur ulang (termasuk yang sedang melangkah),
// efek lama dibuang, dan kanvas dikosongkan supaya gambar terakhir dari kunjungan
// sebelumnya tidak berkedip sesaat (penyebab glitch saat masuk).
function resetPose() {
  for (const leg of legs) { leg.foot = null; leg.from = null; leg.t = 1; leg.lastWindow = -1; }
  lastHeading = heading;
  crumbs.length = 0;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
}

function placeFromLive(live) {
  if (AIRBORNE.has(act.kind)) act = newAct('rest', performance.now());
  body.x = Math.max(60, Math.min(innerWidth - 60, live.x * innerWidth));
  body.y = Math.max(60, Math.min(innerHeight - 60, live.y * innerHeight));
  if (typeof live.heading === 'number') heading = live.heading;
  vel.x = vel.y = speedNow = 0;
  resetPose();
}
function updateDisplay() {
  const visible = alive && focused && siteMode() === 'normal' && calm !== 'media';
  canvas.style.display = visible ? 'block' : 'none';
  canvas.style.opacity = asleep ? '0.55' : calm === 'typing' ? '0.15' : '1';
  handle.style.display = visible && asleep ? 'block' : 'none'; // bisa diseret hanya saat tidur
  if (visible) startLoop();
}
function startLoop() {
  if (looping) return;
  looping = true;
  last = performance.now();
  requestAnimationFrame(loop);
}
// Pindah ke tab di KANAN -> Lexarach masuk dari tepi KIRI (from = 'left'),
// pindah ke tab di KIRI -> masuk dari tepi KANAN (from = 'right').
let entering = null; // { x, y } tujuan saat merayap masuk
let enterDelayUntil = 0;
function enterFrom(side, live) {
  act = newAct('wander', performance.now());
  const y = Math.max(90, Math.min(innerHeight - 90, (live?.y ?? 0.5) * innerHeight));
  const dir = side === 'left' ? 1 : -1;
  body.x = side === 'left' ? -80 : innerWidth + 80; // mulai di luar layar
  body.y = y;
  heading = side === 'left' ? 0 : Math.PI;
  vel.x = dir * 80; vel.y = 0; speedNow = 80;
  resetPose();
  entering = { x: side === 'left' ? 170 : innerWidth - 170, y };
  enterDelayUntil = 0; // jeda sudah terjadi sebelum muncul (lihat setFocused)
  target = null;
}

// Saat tab ini jadi aktif, Lexarach SELALU menunggu sebentar dulu (0,6–1,8 detik),
// seolah butuh waktu "menyusul" ke tab ini, baru merayap masuk dari tepi layar.
// Arah masuk dikirim otak lewat pesan FOCUS. Kalau pesan itu datang belakangan
// (dua sinyal bisa "balapan"), arahnya tetap terpakai karena kita baru memutuskan
// setelah jeda selesai.
let pendingFrom = null;
let appearTimer = null;

function setFocused(v, from = null) {
  if (!v) {
    clearTimeout(appearTimer);
    appearTimer = null;
    pendingFrom = null;
    if (!focused) return;
    focused = false;
    flush(true);  // laporkan semua yang sudah dimakan & dipelajari sebelum "pergi"
    saveLive();   // titipkan posisi untuk tab berikutnya
    target = null;
    entering = null;
    feedTarget = null;
    hideFeedBtn();
    ctx.clearRect(0, 0, innerWidth, innerHeight); // jangan tinggalkan gambar lama
    updateDisplay();
    return;
  }
  if (from) pendingFrom = from;
  if (focused || appearTimer) return; // sudah terlihat, atau sedang menunggu muncul
  const delay = asleep ? 0 : 600 + Math.random() * 1200;
  appearTimer = setTimeout(() => {
    appearTimer = null;
    focused = true;
    chrome.storage.local.get('renikLive').then(r => {
      const live = r.renikLive;
      if (asleep) {
        if (live) placeFromLive(live);            // yang tidur tidak berjalan
      } else {
        // Arah dari otak; kalau tidak ada (mis. tab baru dibuka), dari tepi terdekat.
        const side = pendingFrom ?? (live && live.x > 0.5 ? 'right' : 'left');
        enterFrom(side, live);
      }
      pendingFrom = null;
      updateDisplay();
      startLoop();
      checkMark();
      // Pertama kali mengunjungi situs ini?
      if (memory?.stats?.sites?.[location.hostname] === 1) {
        setTimeout(() => say(T('newPlace', location.hostname.replace(/^www\./, '')), { key: 'place', force: true }), 2500);
      }
    });
  }, delay);
}

// Kalau extension di-reload/dihapus, skrip ini jadi "yatim": hapus diri sendiri.
let dead = false;
function checkOrphan() {
  if (dead || chrome.runtime?.id) return false;
  dead = true;
  focused = false;
  canvas.remove();
  handle.remove();
  return true;
}

let last = performance.now();
function loop(now) {
  // Berhenti total kalau tidak terlihat (tab lain, disembunyikan di situs ini, atau layar penuh).
  if (!focused || siteMode() !== 'normal' || calm === 'media' || checkOrphan()) { looping = false; return; }
  const dt = Math.min(0.05, (now - last) / 1000); // detik sejak frame terakhir
  last = now;
  if (alive && asleep) {
    updateSpeech(now);
    sleepStep(dt);
    draw(dt, now);
  } else if (alive) {
    if (calm === 'typing') { digestUntil = now + 250; target = null; } // sedang mengetik: diam
    // Selesai mengunyah? Langsung cari makanan berikutnya (tanpa menunggu pindaian).
    updateActivity(dt, now);
    checkMood(dt, now);
    if (act.kind === 'forage' && !target && !entering && now > digestUntil && now - lastChoose > 400 && candidates.length) chooseTarget();
    updateSpeech(now);
    if (!updateAirborne(dt, now)) {
      updateBody(dt, now);
      updateLegs(dt);
      if (act.kind === 'groom' && !feedTarget && mode === 'GROOM') groomLegs(now);
    }
    draw(dt, now);
  }
  requestAnimationFrame(loop);
}

// ---------- Diseret saat tidur ----------
// Kanvas tidak bisa diklik (pointer-events: none), jadi saat tidur kita pasang
// "pegangan" transparan kecil tepat di atas tubuh Lexarach.
const handle = document.createElement('div');
handle.dataset.lexarach = '1';
handle.title = 'Seret untuk memindahkan Lexarach';
Object.assign(handle.style, {
  position: 'fixed', width: '64px', height: '64px', borderRadius: '50%',
  cursor: 'grab', zIndex: '2147483647', display: 'none', touchAction: 'none'
});
let dragging = null;
const endDrag = () => {
  if (!dragging) return;
  dragging = null;
  handle.style.cursor = 'grab';
  // Ingat posisinya (dalam persen layar), dipakai juga di halaman berikutnya.
  saveLive();
  changeMood('boldness', -0.004); // dibangunkan paksa & dipindah: sedikit kurang berani
};

function initDrag() {
  handle.addEventListener('pointerdown', e => {
    dragging = { dx: body.x - e.clientX, dy: body.y - e.clientY };
    handle.setPointerCapture(e.pointerId);
    handle.style.cursor = 'grabbing';
    e.preventDefault();
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    body.x = Math.max(20, Math.min(innerWidth - 20, e.clientX + dragging.dx));
    body.y = Math.max(20, Math.min(innerHeight - 20, e.clientY + dragging.dy));
  });
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}


// Tidur: diam di tempat, kaki ditekuk rapat ke tubuh.
function sleepStep(dt) {
  mode = dragging ? 'MOVE' : 'DREAM';
  if (AIRBORNE.has(act.kind)) {                    // tertidur saat di udara: langsung kembali ke tanah
    if (act.kind === 'hang') { body.x = act.data.anchor.x; body.y = act.data.anchor.y; }
    if (act.kind === 'jump') { body.x = act.data.to.x; body.y = act.data.to.y; }
    act = newAct('rest', performance.now());
  }
  const hs = 64 * Math.max(0.8, size);
  handle.style.width = handle.style.height = hs + 'px';
  handle.style.left = body.x - hs / 2 + 'px';
  handle.style.top = body.y - hs / 2 + 'px';
  target = null; // orang tidur tidak berburu
  vel.x = vel.y = speedNow = 0;
  for (const leg of legs) {
    const ang = heading + leg.side * LEG_ANGLE[leg.i];
    const reach = LEG_REACH[leg.i] * size * 0.45;
    const curl = { x: body.x + Math.cos(ang) * reach, y: body.y + Math.sin(ang) * reach };
    if (!leg.foot) leg.foot = { ...curl };
    leg.foot.x += (curl.x - leg.foot.x) * Math.min(1, dt * (dragging ? 8 : 2));
    leg.foot.y += (curl.y - leg.foot.y) * Math.min(1, dt * 2);
    leg.t = 1;
  }
}

function setAlive(state) {
  const first = memory === null;
  const wasAsleep = asleep;
  const now = performance.now();
  memory = state;
  if (state) state.stats ??= { wordsEaten: 0 };
  alive = !!state;
  asleep = !!state?.sleeping;
  updateDisplay();
  if (!state) return;

  if (asleep && !wasAsleep) { target = null; if (!first) speech = null; }

  // Mimpi baru? Tampilkan selagi tidur.
  const latest = state.dreams?.[0];
  if (latest && latest.at > lastDreamAt) {
    lastDreamAt = latest.at;
  }

  // Baru bangun: menggeliat dulu sebelum jalan.
  if (wasAsleep && !asleep) {
    say(T('woke'), { force: true });
    digestUntil = now + 1500;
  }
}

function boot(state) {
  if (!state) return;
  resize();
  detectTheme();
  addEventListener('resize', resize);
  document.documentElement.appendChild(canvas);
  document.documentElement.appendChild(handle);
  document.documentElement.appendChild(feedBtn);
  setAlive(state);
  scanVisibleWords();
  // Memindai dijalankan saat browser sedang senggang, supaya animasi tidak tersendat.
  const idle = window.requestIdleCallback ?? (fn => setTimeout(fn, 0));
  setInterval(() => {
    if (!alive || asleep || !focused || siteMode() !== 'normal' || calm || checkOrphan()) return; // tidak sedang aktif = tidak makan
    idle(() => {
      detectTheme();
      scanVisibleWords();
      if (act.kind === 'forage' && !target && !entering) chooseTarget();
    });
  }, 1500);
  setInterval(() => { if (checkOrphan()) return; flush(); if (focused) saveLive(); }, 4000);
  // Waktu baca dihitung per detik (juga saat Lexarach disembunyikan), untuk mencatat halaman.
  setInterval(() => {
    if (focused && !document.hidden && !asleep && siteMode() !== 'off') tickReading(1);
  }, 1000);
  // Mode tidak mengganggu diperiksa dua kali per detik.
  setInterval(checkCalm, 500);
  addEventListener('focusin', checkCalm);
  addEventListener('focusout', () => setTimeout(checkCalm, 50));
  document.addEventListener('fullscreenchange', checkCalm);
  addEventListener('pagehide', () => { flush(true); if (focused) saveLive(); });
  // Tab disembunyikan -> diam. Tab terlihat lagi -> tanya otak apakah ini tab aktif.
  const askActive = () => chrome.runtime.sendMessage({ type: 'WHO_ACTIVE' })
    .then(r => setFocused(!!r?.active)).catch(() => {});
  document.addEventListener('visibilitychange', () => (document.hidden ? setFocused(false) : askActive()));
  askActive();
}

// ==========================================================
// MULAI
// ==========================================================
// Baca pengaturan, sapa otak, terima memori, lalu hidup.
// Kalau situs ini diatur "jangan masuk", Lexarach tidak mulai sama sekali
// (tapi tetap mendengarkan, kalau nanti pengaturannya diubah).
let started = false;
function start() {
  if (started) return;
  started = true;
  chrome.runtime.sendMessage({ type: 'HELLO', host: location.hostname }).then(boot).catch(() => {});
}

function main() {
  // Bersihkan "laba-laba yatim" dari versi lama Lexarach di halaman ini.
  // (Saat extension di-reload, skrip lama di tab yang sudah terbuka tidak ikut mati.)
  // Termasuk sisa versi lama sebelum ganti nama (data-renik).
  document.querySelectorAll('[data-lexarach], [data-renik], div[title="Seret untuk memindahkan Lexarach"], div[title="Seret untuk memindahkan Renik"]').forEach(el => el.remove());
  [...document.documentElement.children]
    .filter(el => el.tagName === 'CANVAS' && el.style.zIndex === '2147483647')
    .forEach(el => el.remove());

  initPointer();
  initFeed();
  initDrag();

  // ---------- Perintah dari menu (popup) ----------
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'SUMMARIZE') {
      if (hasPasswordField()) return reply({ error: 'private' });
      reply(LexarachInsight.summarize(knownCount));
    } else if (msg.type === 'HIGHLIGHT') {
      const ok = LexarachInsight.highlight(style.auto ? undefined : style.accent);
      if (ok && memory) speech = { text: T('core'), start: performance.now(), until: performance.now() + 3000 };
      reply({ ok });
    } else if (msg.type === 'CLEAR_HIGHLIGHT') {
      LexarachInsight.clearHighlight();
      reply({ ok: true });
    } else if (msg.type === 'FEED_SELECTION') {
      const sel = window.getSelection();
      const range = sel && sel.rangeCount && sel.toString().trim() === msg.text.trim() ? sel.getRangeAt(0).cloneRange() : null;
      feedSelection(msg.text, range);
      reply({ ok: true });
    } else if (msg.type === 'FEED_SELECTION_CURRENT') {
      // Dari pintasan Alt+R: ambil teks yang sedang diblok di halaman ini.
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (text) feedSelection(text, sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null);
      hideFeedBtn();
      reply({ ok: !!text });
    } else if (msg.type === 'FOCUS') {
      setFocused(!!msg.active, msg.from ?? null);
      reply({ ok: true });
    } else if (msg.type === 'PING') {
      reply({ ok: true, build: BUILD });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.renikPrefs) {
      prefs = changes.renikPrefs.newValue ?? {};
      if (!started) { if (siteMode() !== 'off') start(); return; }
      if (siteMode() === 'off') { hideFeedBtn(); target = null; feedTarget = null; }
      checkCalm();
      updateDisplay();
    }
    if (area === 'local' && changes.renikStyle) style = { ...DEFAULT_STYLE, ...changes.renikStyle.newValue };
    if (area !== 'local') return;
    // Bagian bahasa berubah (disimpan terpisah di "renikLang").
    if (changes.renikLang && memory) {
      const L = changes.renikLang.newValue ?? {};
      memory.chain = L.chain ?? {};
      // Pelajaran yang belum sempat dilaporkan ke otak jangan sampai hilang.
      LexarachSpeech.learn(memory, pendingPairs);
    }
    // Bagian inti berubah.
    if (changes.renik) {
      const fresh = changes.renik.newValue;
      if (fresh) {
        fresh.chain = memory?.chain ?? {};
        // Pertahankan kata yang barusan dimakan tapi belum sempat dilaporkan.
        for (const w of pending) fresh.words[w] ??= { count: 1, strength: 1, lastSeen: Date.now() };
        fresh.stats.wordsEaten += pending.length;
      }
      setAlive(fresh);
    }
  });

  chrome.storage.local.get('renikPrefs').then(r => {
    prefs = r.renikPrefs ?? {};
    if (siteMode() !== 'off') start();
  });
}

if (!LEXARACH_SKIP) main();
