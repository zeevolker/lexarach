// ============================================================
// src/content/01-body.js — Tubuh & delapan kaki (inverse kinematics, irama langkah)
// Bagian dari tubuh Lexarach. Semua file di src/content/ berbagi variabel yang sama
// (urutan dimuat diatur di manifest.json). Listener baru dipasang di main().
// ============================================================

// ==========================================================
// 4. TUBUH LABA-LABA
// ==========================================================
// Tubuhnya satu benda kaku: posisi tengah + arah hadap.
// Bagian depan (cephalothorax) di depan titik tengah,
// perut (abdomen) di belakang.
const body = {
  x: Math.random() < 0.5 ? 90 : innerWidth - 90,
  y: innerHeight * (0.3 + Math.random() * 0.5)
};
let heading = -Math.PI / 2; // arah hadap (radian), awalnya ke atas
const vel = { x: 0, y: 0 }; // kecepatan (px/detik). Tubuh bergerak sesuai ini,
                            // arah hadap hanya MENGIKUTI pelan-pelan -> tidak mengorbit.
let speedNow = 0;           // besar kecepatan, dipakai kaki
let digestUntil = 0;        // sedang mengunyah sampai waktu ini
const MOUTH = 13;           // jarak titik tengah ke mulut

// Ubah koordinat "lokal tubuh" (f = maju, s = ke kanan) ke koordinat layar.
function toWorld(f, s) {
  const c = Math.cos(heading), n = Math.sin(heading);
  return { x: body.x + c * f - n * s, y: body.y + n * f + c * s };
}
const mouth = () => toWorld(MOUTH, 0);
// Selisih dua sudut, selalu di antara -π dan π.
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// ==========================================================
// 5. DELAPAN KAKI: Inverse Kinematics 2 ruas
// ==========================================================
const L1 = 32, L2 = 36;                      // paha & betis
const size = 1;                              // skala tubuh (tetap)
// Kaki depan menjulur ke depan, kaki belakang ke belakang (seperti laba-laba asli).
// Hanya pasangan pertama yang menjulur ke depan; pasangan ke-2, 3, 4 mengarah ke belakang.
const LEG_ANGLE = [0.38, 1.85, 2.3, 2.8];    // arah tapak tiap kaki, diukur dari depan (radian)
const LEG_REACH = [60, 50, 46, 58];          // jarak tapak ideal dari tubuh
const HIP_ANGLE = [0.6, 1.2, 1.9, 2.5];      // posisi pangkal kaki melingkari dada
const legs = [];
for (let i = 0; i < 4; i++) {
  for (const side of [-1, 1]) {
    // Pola "tetrapod" laba-laba asli:
    // kiri-1, kanan-2, kiri-3, kanan-4 melangkah bersamaan, lalu empat sisanya.
    const group = (i + (side > 0 ? 1 : 0)) % 2;
    legs.push({ i, side, group, foot: null, from: null, to: null, t: 1, dur: 0.15, lastWindow: -1 });
  }
}

// Pangkal kaki melingkar di sekitar dada (titik pusat dada di x=3).
const hipOf = leg => {
  const a = HIP_ANGLE[leg.i];
  return toWorld((3 + Math.cos(a) * 5) * size, Math.sin(a) * 5 * leg.side * size);
};

// Posisi tapak "netral" kaki ini relatif terhadap tubuh, ditambah tebakan ke depan.
function idealFoot(leg, lead = 0) {
  const ang = heading + leg.side * LEG_ANGLE[leg.i];
  return {
    x: body.x + Math.cos(ang) * LEG_REACH[leg.i] * size + vel.x * lead,
    y: body.y + Math.sin(ang) * LEG_REACH[leg.i] * size + vel.y * lead
  };
}

// ---------- Irama langkah (gait) ----------
// gaitPhase bertambah sesuai JARAK yang ditempuh (dan putaran badan),
// bukan waktu. Jadi saat diam, kaki ikut diam; saat lari, kaki berlari.
// Satu siklus dibagi 2 "jendela": jendela 0 untuk kelompok A, jendela 1 untuk kelompok B.
const STRIDE = 34;        // jarak tempuh (px) untuk satu siklus penuh A+B
const MAX_STRETCH = 30;   // kaki yang tertinggal sejauh ini langsung melangkah
let gaitPhase = 0;
let lastHeading = heading;

function startStep(leg, swingTime) {
  leg.from = { ...leg.foot };
  leg.dur = swingTime;
  leg.t = 0;
}

function updateLegs(dt) {
  // Jarak "efektif": maju + putaran badan (berputar di tempat juga butuh melangkah).
  const turn = Math.abs(angleDiff(heading, lastHeading));
  lastHeading = heading;
  gaitPhase += (speedNow * dt + turn * 40) / STRIDE;

  // Lama kaki di udara: setengah siklus, dibatasi supaya tidak terlalu lambat/cepat.
  const swingTime = Math.max(0.07, Math.min(0.2, (STRIDE / 2) / Math.max(speedNow, 1) * 0.8));

  for (const leg of legs) {
    if (!leg.foot) leg.foot = idealFoot(leg);
    // Gelombang kecil dari depan ke belakang (kaki depan sedikit duluan).
    const p = gaitPhase + leg.i * 0.06;
    const windowId = Math.floor(p * 2);            // nomor jendela ke-berapa
    const myTurn = windowId % 2 === leg.group;     // jendela ini milik kelompokku?
    const ideal = idealFoot(leg);
    const miss = Math.hypot(ideal.x - leg.foot.x, ideal.y - leg.foot.y);

    if (leg.t >= 1) {
      if (myTurn && windowId !== leg.lastWindow && miss > 3) {
        leg.lastWindow = windowId;
        startStep(leg, swingTime);
      } else if (miss > MAX_STRETCH) {
        startStep(leg, swingTime); // darurat
      }
    }

    if (leg.t < 1) {
      leg.t = Math.min(1, leg.t + dt / leg.dur);
      // Tapak mendarat DI DEPAN posisi netral, supaya saat menapak
      // tubuh "lewat" di atasnya -> langkah panjang seperti laba-laba.
      const to = idealFoot(leg, leg.dur * 1.3);
      // Jangan pernah menapak lebih jauh dari panjang kaki (94% dari paha+betis).
      // Tanpa batas ini, saat berlari kencang kaki depan "lurus kaku" & memanjang sesaat.
      const hip = hipOf(leg), maxR = (L1 + L2) * 0.94;
      const tdx = to.x - hip.x, tdy = to.y - hip.y, tdd = Math.hypot(tdx, tdy);
      if (tdd > maxR) { to.x = hip.x + (tdx / tdd) * maxR; to.y = hip.y + (tdy / tdd) * maxR; }
      const e = leg.t < 0.5 ? 2 * leg.t * leg.t : 1 - Math.pow(-2 * leg.t + 2, 2) / 2;
      leg.foot.x = leg.from.x + (to.x - leg.from.x) * e;
      leg.foot.y = leg.from.y + (to.y - leg.from.y) * e;
    }
  }
}

// Hukum cosinus: dari pinggul & tapak, cari lutut.
// Selalu ada 2 kemungkinan posisi lutut (menekuk ke satu sisi garis pinggul–tapak, atau sisi lainnya).
// Arah tekukan DITETAPKAN per kaki, seperti anatomi laba-laba asli:
//   - kaki yang menjulur ke DEPAN (arah < 90°)    -> lutut menekuk ke arah side
//   - kaki yang menjulur ke BELAKANG (arah > 90°) -> menekuk ke arah sebaliknya
// Hasilnya lutut selalu mengarah ke luar tubuh dan TIDAK PERNAH pindah sisi.
// (Versi lama memilih "yang paling jauh dari tubuh", jadi kaki depan sering glitch
//  karena kedua pilihannya hampir sama jauh.)
function solveKnee(hip, foot, lift, leg) {
  const dx = foot.x - hip.x, dy = foot.y - hip.y;
  const d = Math.max(1, Math.min(Math.hypot(dx, dy), L1 + L2 - 0.01));
  const base = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const bend = LEG_ANGLE[leg.i] < Math.PI / 2 ? leg.side : -leg.side;
  const ang = base + bend * a;
  const k = { x: hip.x + Math.cos(ang) * L1, y: hip.y + Math.sin(ang) * L1 };
  // Saat kaki diangkat, lutut terdorong sedikit ke samping luar (ilusi 3D).
  const outX = -Math.sin(heading) * leg.side, outY = Math.cos(heading) * leg.side;
  return { x: k.x + outX * lift * 7, y: k.y + outY * lift * 7 };
}
