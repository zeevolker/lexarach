// ============================================================
// lang.js — PENGOLAH BAHASA Lexarach
// ------------------------------------------------------------
// Dipakai bersama oleh insight.js (indeks & ringkasan) dan popup.js (pencarian).
//   STOP     : kata umum yang tidak dianggap "isi" (stopword)
//   stem(w)  : ubah kata ke bentuk dasarnya, supaya
//              "membaca", "dibaca", "bacaan", "bacanya" -> "baca"
//   terms(t) : pecah teks jadi daftar kata dasar penting
//
// Stemmer ini versi sederhana dari algoritma Nazief–Adriani:
// buang partikel (-lah, -kah), kata ganti (-ku, -mu, -nya),
// akhiran (-kan, -an, -i), lalu awalan (di-, ke-, se-, ter-, ber-, me-, pe-, per-).
// Tanpa kamus, jadi kadang memotong terlalu banyak. Tidak masalah untuk pencarian,
// karena kata yang dicari dan kata di halaman dipotong dengan cara yang SAMA.
// ============================================================
var LexarachLang = globalThis.LexarachLang ?? (() => {
  const STOP = new Set((
    'yang untuk dengan dari pada dalam adalah akan atau juga tidak sudah lebih oleh karena ' +
    'bisa dapat saat kami kita mereka anda saya kamu harus masih seperti sebagai telah antara ' +
    'setelah tersebut hanya bahwa hari tahun ini itu ada para bagi agar namun tetapi jika ' +
    'serta hingga sampai lalu kini pun maka sangat banyak beberapa semua setiap secara ' +
    'merupakan menjadi yaitu yakni dia ia nya kalau ketika sedang belum lagi pula sementara ' +
    'the and for with that this from have will your what when which their there they ' +
    'about would been were into more than them then some only also just here these those ' +
    'over such very most other like make made are was has had not but can its our you'
  ).split(' '));

  // ---------- Bahasa Indonesia ----------
  // Urutan: partikel -> kata ganti -> AWALAN -> akhiran.
  // Beberapa awalan ambigu tanpa kamus, mis. "memakan" (makan) vs "memukul" (pukul),
  // jadi fungsi ini bisa mengembalikan DUA kemungkinan kata dasar.
  function stemsId(word) {
    let w = word;
    if (w.length <= 4) return [w];
    for (const re of [/(lah|kah|tah|pun)$/, /(ku|mu|nya)$/]) {
      const t = w.replace(re, '');
      if (t !== w && t.length >= 4) w = t;
    }

    // Awalan: tiap aturan memberi satu atau dua kandidat
    const prefixOnce = x => {
      let m;
      if ((m = x.match(/^(di|ke|se)(.{4,})$/))) return [m[2]];
      if ((m = x.match(/^ter(.{4,})$/))) return [m[1]];
      if ((m = x.match(/^per(.{4,})$/))) return [m[1]];
      if ((m = x.match(/^ber?(.{4,})$/))) return [m[1]];
      if ((m = x.match(/^(?:me|pe)ny([aiueo].+)$/))) return ['s' + m[1]];                 // menyapu -> sapu
      if ((m = x.match(/^(?:me|pe)ng([aiueo].+)$/))) return [m[1], 'k' + m[1]];          // mengambil -> ambil / mengirim -> kirim
      if ((m = x.match(/^(?:me|pe)ng([gkh].+)$/))) return [m[1]];                        // menggali -> gali
      if ((m = x.match(/^(?:me|pe)m([aiueo].+)$/))) return ['p' + m[1], 'm' + m[1]];     // memukul -> pukul / memakan -> makan
      if ((m = x.match(/^(?:me|pe)m([bfv].+)$/))) return [m[1]];                         // membaca -> baca
      if ((m = x.match(/^(?:me|pe)n([aiueo].+)$/))) return ['t' + m[1], 'n' + m[1]];     // menulis -> tulis / menikah -> nikah
      if ((m = x.match(/^(?:me|pe)n([cdjz].+)$/))) return [m[1]];                        // mencari -> cari
      if ((m = x.match(/^(?:me|pe)([lmnrwy].{3,})$/))) return [m[1]];                    // melihat -> lihat
      return null;
    };
    let cands = [w], prefixed = false;
    for (let round = 0; round < 2; round++) {
      const next = [];
      let changed = false;
      for (const c of cands) {
        const r = c.length > 4 ? prefixOnce(c) : null;
        if (r) { next.push(...r); changed = true; } else next.push(c);
      }
      if (!changed) break;
      cands = next;
      prefixed = true;
    }

    // Akhiran: -kan/-an (sisa minimal 4 huruf). "-i" hanya kalau ada awalan (kata kerja: me-…-i, di-…-i).
    const suffix = c => {
      let t = c.replace(/(kan|an)$/, '');
      if (t !== c && t.length >= 4) return t;
      if (prefixed && /i$/.test(c) && c.length >= 5) return c.slice(0, -1);
      return c;
    };
    return [...new Set(cands.map(suffix))];
  }

  // ---------- Bahasa Inggris: cukup buang akhiran umum ----------
  function stemEn(w) {
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !/(ss|us|is|as)$/.test(w)) return w.slice(0, -1);
    return w;
  }
  // Tebakan bahasa per kata: akhiran khas Inggris -> Inggris, selain itu Indonesia.
  const isEnglish = w => (w.length > 5 && /(ing|ed)$/.test(w)) || (w.length > 3 && /s$/.test(w) && !/(as|is|us|ss)$/.test(w));

  const cache = new Map();
  // Semua kemungkinan kata dasar (1 atau 2).
  function stems(word) {
    const w = word.toLowerCase();
    let r = cache.get(w);
    if (!r) {
      r = isEnglish(w) ? [stemEn(w)] : stemsId(w);
      if (cache.size > 20000) cache.clear();
      cache.set(w, r);
    }
    return r;
  }
  // Kata dasar utama (kemungkinan pertama).
  const stem = word => stems(word)[0];

  // Kata-kata penting dari teks: [{ word, stem }]
  function terms(text) {
    return (text.toLowerCase().match(/\p{L}{3,}/gu) || [])
      .filter(w => !STOP.has(w))
      .map(word => ({ word, stem: stem(word), stems: stems(word) }));
  }

  return { STOP, stem, stems, terms };
})();
