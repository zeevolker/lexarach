// ============================================================
// src/content/04-feed.js — Beri makan Lexarach -> Catatan
// Bagian dari tubuh Lexarach. Semua file di src/content/ berbagi variabel yang sama
// (urutan dimuat diatur di manifest.json). Listener baru dipasang di main().
// ============================================================

// ==========================================================
// 8d. BERI MAKAN LEXARACH -> CATATAN
// ==========================================================
// Blok teks di halaman, lalu klik tombol "Beri makan Lexarach" (atau klik kanan).
// Teks langsung disimpan ke Catatan (lewat otak), lalu Lexarach merayap ke sana
// dan "memakannya" sebagai animasi.
let feedTarget = null; // { range, text }

function feedSelection(text, range = null) {
  hunger = Math.max(0, hunger - 0.15);
  text = String(text ?? '').replace(/\s+\n/g, '\n').trim().slice(0, 3000);
  if (!text || siteMode() === 'off' || hasPasswordField()) return;
  chrome.runtime.sendMessage({
    type: 'ADD_NOTE', text,
    page: { url: location.origin + location.pathname, title: document.title.slice(0, 160) }
  }).catch(() => {});
  if (!focused || siteMode() !== 'normal') return; // tetap tersimpan, hanya tanpa animasi
  target = null;
  feedTarget = { range, text };
}

function finishFeed(point) {
  const now = performance.now();
  if (point && feedTarget) {
    const t = feedTarget.text;
    crumbs.push({ x: point.x, y: point.y, word: t.length > 22 ? t.slice(0, 21) + '…' : t, t: 0, novel: true });
    // Kilatan sorotan sebentar di teks yang dimakan
    if (feedTarget.range && window.CSS?.highlights && window.Highlight) {
      CSS.highlights.set('lexarach-feed', new Highlight(feedTarget.range));
      let st = document.getElementById('lexarach-feed-style');
      if (!st) { st = document.createElement('style'); st.id = 'lexarach-feed-style'; document.head.appendChild(st); }
      const tint = !style.auto && /^#[0-9a-f]{6}$/i.test(style.joint) ? style.joint + '66' : 'rgba(198,255,0,.4)';
      st.textContent = `::highlight(lexarach-feed){ background-color:${tint}; color:inherit; }`;
      setTimeout(() => CSS.highlights.delete('lexarach-feed'), 1400);
    }
    digestUntil = now + 1200;
  }
  feedTarget = null;
  say(T('noted'), { force: true });
}

// Tombol kecil yang muncul di dekat teks yang diblok.
const feedBtn = document.createElement('div');
feedBtn.dataset.lexarach = '1';
Object.assign(feedBtn.style, {
  position: 'fixed', zIndex: '2147483647', display: 'none', cursor: 'pointer',
  font: '11px ui-monospace, "Cascadia Mono", Consolas, monospace', letterSpacing: '.04em',
  padding: '5px 9px', background: 'rgba(7,8,13,.92)', border: '1px solid #00e5ff', color: '#00e5ff',
  boxShadow: '0 0 10px rgba(0,229,255,.35)', userSelect: 'none'
});
let feedSel = null; // { text, range }
function hideFeedBtn() { feedBtn.style.display = 'none'; feedSel = null; }
function showFeedBtn() {
  if (!alive || !focused || siteMode() === 'off' || hasPasswordField()) return;
  const sel = window.getSelection();
  const text = sel?.toString().trim() ?? '';
  if (!sel || sel.rangeCount === 0 || text.length < 3) return hideFeedBtn();
  const host = sel.anchorNode?.parentElement;
  if (host?.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')) return hideFeedBtn();
  const range = sel.getRangeAt(0).cloneRange();
  const r = range.getBoundingClientRect();
  if (!r.width && !r.height) return hideFeedBtn();
  const c = palette(memory.personality);
  feedBtn.textContent = '◆ ' + T('feedBtn');
  feedBtn.style.color = c.accent;
  feedBtn.style.borderColor = c.accent;
  feedBtn.style.display = 'block';
  const bw = feedBtn.offsetWidth;
  feedBtn.style.left = Math.max(8, Math.min(innerWidth - bw - 8, r.right - bw)) + 'px';
  feedBtn.style.top = (r.top > 44 ? r.top - 34 : r.bottom + 8) + 'px';
  feedSel = { text, range };
}
function initFeed() {
  // mousedown (bukan click) supaya teks yang diblok tidak hilang sebelum diambil
  feedBtn.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    if (feedSel) feedSelection(feedSel.text, feedSel.range);
    window.getSelection()?.removeAllRanges();
    hideFeedBtn();
  });
  addEventListener('mouseup', e => { if (e.target !== feedBtn) setTimeout(showFeedBtn, 10); }, true);
  addEventListener('mousedown', e => { if (e.target !== feedBtn) hideFeedBtn(); }, true);
  addEventListener('scroll', hideFeedBtn, { passive: true, capture: true });
  addEventListener('keydown', hideFeedBtn, true);
}
