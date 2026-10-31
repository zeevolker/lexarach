// ============================================================
// speech.js — CATATAN URUTAN KATA (bahan asosiasi saat bermimpi)
// ------------------------------------------------------------
// Dipakai oleh content scripts (mencatat) dan background.js (menyimpan & bermimpi).
//
// Setiap kali Lexarach makan kata, kalimat tempat kata itu berada dipecah
// jadi pasangan kata berurutan: "komodo adalah kadal" -> komodo→adalah, adalah→kadal.
//   chain = { "kata": { kata_berikutnya: jumlah } }
// Saat bermimpi, background.js membandingkan "tetangga" setiap kata di chain:
// kata yang punya tetangga sama dianggap mirip (mis. kadal ~ hewan),
// lalu hubungan itu dipakai untuk memperluas pencarian di menu Ingatan.
// ============================================================
var LexarachSpeech = globalThis.LexarachSpeech ?? (() => {
  const MAX_CHAIN = 1500; // batas jumlah kata di chain

  // Dari teks dan posisi kata yang dimakan, ambil kalimat di sekitarnya
  // lalu pecah jadi pasangan kata berurutan [a, b].
  function extract(text, idx) {
    let from = Math.max(0, idx - 120), to = Math.min(text.length, idx + 120);
    const before = text.slice(from, idx).search(/[.!?][^.!?]*$/);
    if (before >= 0) from += before + 1;
    const after = text.slice(idx, to).search(/[.!?]/);
    if (after >= 0) to = idx + after;
    const words = (text.slice(from, to).toLowerCase().match(/\p{L}{1,20}/gu) || []).slice(0, 24);
    const pairs = [];
    for (let i = 0; i < words.length - 1; i++) pairs.push([words[i], words[i + 1]]);
    return pairs;
  }

  // Masukkan pasangan kata ke state.chain; buang kata yang paling jarang kalau kebanyakan.
  function learn(state, pairs = []) {
    state.chain ??= {};
    for (const [a, b] of pairs) {
      const row = (state.chain[a] ??= {});
      row[b] = (row[b] ?? 0) + 1;
    }
    const keys = Object.keys(state.chain);
    if (keys.length > MAX_CHAIN) {
      const total = k => Object.values(state.chain[k]).reduce((s, n) => s + n, 0);
      keys.sort((x, y) => total(x) - total(y))
        .slice(0, keys.length - MAX_CHAIN + 150)
        .forEach(k => delete state.chain[k]);
    }
  }

  return { extract, learn };
})();
