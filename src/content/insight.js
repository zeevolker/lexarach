// ============================================================
// insight.js — LEXARACH SEBAGAI TEMAN MEMBACA
// ------------------------------------------------------------
// Dipakai oleh content scripts (dijalankan di halaman web).
//   summarize()     -> pilih kalimat-kalimat inti + kata kunci halaman (tab Halaman)
//   indexPage()     -> kata kunci & kalimat inti untuk disimpan di ingatan (fitur pencarian)
//   highlight()     -> tandai kalimat inti langsung di halaman
//   highlightText() -> cari & sorot satu kalimat tertentu ("Buka & sorot")
// Penandaan memakai CSS Custom Highlight API, jadi isi halaman tidak diubah.
// Kata diolah dengan lang.js (stopword + kata dasar).
//
// Cara memilih kalimat inti (ringkasan ekstraktif, TF-IDF sederhana):
//   - TF  : kata yang sering muncul di halaman INI dianggap penting
//   - IDF : kata yang sudah sangat sering Lexarach lihat di mana-mana
//           (dari memorinya) dianggap umum -> bobotnya diturunkan
//   - Skor kalimat = jumlah bobot katanya, dinormalkan dengan panjang
// ============================================================
// 'var' + '??' supaya aman kalau file ini dimuat dua kali di halaman yang sama.
var LexarachInsight = globalThis.LexarachInsight ?? (() => {
  const SKIP = 'script,style,noscript,nav,header,footer,aside,form,button,code,pre,[aria-hidden="true"]';

  // Bagian utama halaman (artikel), kalau ada.
  function mainRoot() {
    return document.querySelector('article') || document.querySelector('main') ||
      document.querySelector('[role="main"]') || document.body;
  }

  // Gabungkan teks sebuah elemen + catat posisi tiap text node,
  // supaya nanti posisi kalimat bisa diubah jadi Range (untuk ditandai).
  function textMap(el, skip = SKIP) {
    const nodes = [];
    let text = '';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement?.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    let n;
    while ((n = walker.nextNode())) { nodes.push({ node: n, start: text.length }); text += n.data; }
    return { text, nodes };
  }

  function rangeFor(map, start, end) {
    const at = pos => {
      let hit = map.nodes[0];
      for (const n of map.nodes) { if (n.start <= pos) hit = n; else break; }
      return { node: hit.node, offset: Math.min(pos - hit.start, hit.node.data.length) };
    };
    const a = at(start), b = at(end);
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    return r;
  }


  // Analisis halaman: kalimat + skor + bobot kata dasar.
  // knownCount(w) = berapa kali Lexarach pernah memakan kata itu (dari memorinya).
  function analyze(knownCount = () => 0) {
    const root = mainRoot();
    const blocks = [...root.querySelectorAll('p, li, blockquote, dd, h2, h3')]
      .filter(el => !el.closest(SKIP) && el.offsetParent !== null && el.innerText.trim().length > 40);

    // 1. Kumpulkan kalimat
    const sentences = [];
    blocks.forEach((el, bi) => {
      const map = textMap(el);
      for (const m of map.text.matchAll(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g)) {
        const raw = m[0];
        const lead = raw.length - raw.trimStart().length;
        const text = raw.trim();
        if (text.length < 40 || text.length > 400) continue;
        const terms = LexarachLang.terms(text);
        if (terms.length < 5) continue;
        sentences.push({ text, terms, block: bi, map, start: m.index + lead, end: m.index + lead + text.length });
      }
    });

    // 2. TF per KATA DASAR ("membaca" & "dibaca" dihitung sama) + bentuk kata yang paling sering muncul
    const tf = {}, surface = {}, stemsOf = {};
    for (const st of sentences) {
      for (const t of st.terms) {
        tf[t.stem] = (tf[t.stem] ?? 0) + 1;
        (surface[t.stem] ??= {})[t.word] = (surface[t.stem][t.word] ?? 0) + 1;
        stemsOf[t.stem] = t.stems;
      }
    }
    const shown = st => Object.entries(surface[st]).sort((a, b) => b[1] - a[1])[0][0];
    const maxTf = Math.max(1, ...Object.values(tf));
    // IDF: kata yang sudah sangat sering Lexarach lihat di mana-mana dianggap umum.
    const weight = st => (tf[st] / maxTf) * (1 / (1 + Math.log1p(knownCount(shown(st))) * 0.3));

    // 3. Skor tiap kalimat
    const total = blocks.length || 1;
    for (const st of sentences) {
      const uniq = [...new Set(st.terms.map(t => t.stem))];
      st.score = uniq.reduce((sum, k) => sum + weight(k), 0) / Math.sqrt(st.terms.length);
      st.score *= 1 + 0.25 * (1 - st.block / total); // kalimat di awal sedikit lebih penting
    }
    const ranked = Object.keys(tf).filter(k => shown(k).length >= 4).sort((a, b) => weight(b) - weight(a));
    return { sentences, ranked, weight, shown, stemsOf };
  }

  const cut = t => (t.length > 220 ? t.slice(0, 217) + '…' : t);

  function summarize(knownCount) {
    const a = analyze(knownCount);
    if (!a.sentences.length) return { title: document.title, keywords: [], sentences: [] };
    // Ambil 3–5 kalimat terbaik, urutkan kembali sesuai urutan di halaman
    const n = Math.max(3, Math.min(5, Math.round(a.sentences.length / 12)));
    const best = [...a.sentences].sort((x, y) => y.score - x.score).slice(0, n)
      .sort((x, y) => x.block - y.block || x.start - y.start);
    lastBest = best;
    return { title: document.title, keywords: a.ranked.slice(0, 8).map(a.shown), sentences: best.map(x => cut(x.text)) };
  }

  // Untuk ingatan: 30 kata kunci (bentuk tampil + kata dasar + bobot) dan 6 kalimat inti.
  function indexPage(knownCount) {
    const a = analyze(knownCount);
    const top = a.ranked.slice(0, 30);
    const maxW = top.length ? a.weight(top[0]) : 1;
    return {
      terms: top.map(k => ({ w: a.shown(k), s: a.stemsOf[k], k: +(a.weight(k) / maxW).toFixed(2) })),
      snippets: [...a.sentences].sort((x, y) => y.score - x.score).slice(0, 6)
        .sort((x, y) => x.block - y.block || x.start - y.start)
        .map(x => cut(x.text))
    };
  }

  let lastBest = [];

  // Tandai kalimat inti di halaman tanpa mengubah HTML-nya.
  function highlight(color = '#00e5ff') {
    if (!window.CSS?.highlights || !window.Highlight) return false;
    if (!lastBest.length) summarize();
    const ranges = lastBest.map(s => rangeFor(s.map, s.start, s.end));
    CSS.highlights.set('lexarach-key', new Highlight(...ranges));
    let st = document.getElementById('lexarach-highlight-style');
    if (!st) { st = document.createElement('style'); st.id = 'lexarach-highlight-style'; document.head.appendChild(st); }
    const tint = /^#[0-9a-f]{6}$/i.test(color) ? color + '55' : 'rgba(0,229,255,.33)';
    st.textContent = `::highlight(lexarach-key){ background-color:${tint}; color:inherit; }`;
    ranges[0]?.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return ranges.length > 0;
  }

  function clearHighlight() {
    window.CSS?.highlights?.delete('lexarach-key');
  }

  // Cari sepotong teks (cuplikan hasil pencarian atau isi catatan) di halaman lalu sorot.
  //
  // Teks yang Anda blok disalin browser dengan spasi & baris baru yang sudah "dirapikan",
  // sedangkan di HTML halaman spasinya bisa berbeda (indentasi, baris baru di tengah
  // paragraf, atau tanpa spasi sama sekali di antara dua paragraf). Karena itu kita
  // membandingkan teks TANPA SPASI SAMA SEKALI, lalu memetakan posisinya kembali
  // ke teks asli supaya bisa dibuat Range yang tepat, termasuk lintas paragraf.
  function highlightText(text, color = '#00e5ff') {
    if (!window.CSS?.highlights || !window.Highlight || !text) return false;
    const map = textMap(document.body, 'script,style,noscript,template');
    if (!map.nodes.length) return false;

    // Versi tanpa spasi + peta posisi ke teks asli
    const raw = map.text, keep = [];
    let compact = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (!/\s/.test(ch)) { compact += ch; keep.push(i); }
    }
    const want = text.replace(/…$/, '').replace(/\s+/g, '');
    if (!want) return false;

    // Coba seluruh teks dulu, lalu potongan awal; terakhir tanpa membedakan huruf besar/kecil.
    let pos = -1, len = 0;
    for (const [hay, needle] of [
      [compact, want],
      [compact, want.slice(0, 60)],
      [compact.toLowerCase(), want.toLowerCase()],
      [compact.toLowerCase(), want.slice(0, 60).toLowerCase()]
    ]) {
      pos = hay.indexOf(needle);
      if (pos >= 0) { len = needle.length; break; }
    }
    if (pos < 0) return false;

    const range = rangeFor(map, keep[pos], keep[pos + len - 1] + 1);
    CSS.highlights.set('lexarach-key', new Highlight(range));
    let st = document.getElementById('lexarach-highlight-style');
    if (!st) { st = document.createElement('style'); st.id = 'lexarach-highlight-style'; document.head.appendChild(st); }
    const tint = /^#[0-9a-f]{6}$/i.test(color) ? color + '55' : 'rgba(0,229,255,.33)';
    st.textContent = `::highlight(lexarach-key){ background-color:${tint}; color:inherit; }`;
    const el = range.startContainer.parentElement;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  return { summarize, indexPage, highlight, clearHighlight, highlightText };
})();
