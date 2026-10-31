// ============================================================
// src/content/05-activity.js — Aktivitas: rasa lapar, istirahat, lompat, jaring, gelantung
// Bagian dari tubuh Lexarach. Semua file di src/content/ berbagi variabel yang sama
// (urutan dimuat diatur di manifest.json). Listener baru dipasang di main().
// ============================================================

// ==========================================================
// 8e. AKTIVITAS — supaya Lexarach tidak makan terus, tapi hidup seperti laba-laba
// ==========================================================
// Rasa lapar naik pelan-pelan dan turun saat makan.
//   lapar  -> 'forage' : mencari & memakan kata
//   kenyang -> kegiatan lain, dipilih acak (dipengaruhi kepribadian):
//     'rest'   istirahat        'groom' membersihkan diri   'look' mengamati sekitar
//     'wander' jalan-jalan      'jump'  melompat            'web'  merajut jaring
//     'hang'   bergelantungan di benang
// Perintah Anda ("Beri makan Lexarach") selalu didahulukan.
let hunger = 0.6;
let act = { kind: 'forage', t0: 0, until: 0, data: {} };
const webs = [];        // jaring yang sudah/sedang dibuat di halaman ini
const threads = [];     // benang pengaman bekas melompat (memudar)
const AIRBORNE = new Set(['jump', 'hang']);
const rand = (a, b) => a + Math.random() * (b - a);

function newAct(kind, now, data = {}) {
  const dur = { forage: 25000, rest: rand(4000, 9000), groom: rand(2000, 3500), look: rand(2500, 4000),
                wander: rand(4000, 8000), web: 60000, jump: 5000, hang: 20000 }[kind] ?? 5000;
  return { kind, t0: now, until: now + dur, data };
}

function pickActivity(now) {
  target = null;
  if (hunger > 0.45 && candidates.length) { act = newAct('forage', now); return; }
  const p = memory.personality;
  const options = [
    ['rest', 3 - p.energy * 1.5],
    ['look', 2],
    ['groom', 1.6],
    ['wander', 1 + p.energy * 1.5],
    ['jump', 0.6 + p.energy * 1.6],
    ['web', webs.length < 2 ? 1.2 : 0.15],
    ['hang', 1.1]
  ];
  let r = Math.random() * options.reduce((n, [, w]) => n + w, 0);
  let kind = 'rest';
  for (const [k, w] of options) { r -= w; if (r <= 0) { kind = k; break; } }
  if (kind === 'jump') return startJump(now);
  if (kind === 'web' && startWeb(now)) return;
  if (kind === 'hang' && startHang(now)) return;
  act = newAct(kind === 'web' || kind === 'hang' ? 'rest' : kind, now, kind === 'look' ? { base: heading } : {});
}

// Dipanggil tiap frame saat Lexarach di tanah.
function updateActivity(dt, now) {
  hunger = Math.min(1, hunger + dt * 0.009); // ±50 detik dari kenyang sampai lapar lagi
  if (feedTarget || entering) return;
  const d = act.data;
  switch (act.kind) {
    case 'forage': {
      if (hunger < 0.08 || now > act.until || (!candidates.length && now - act.t0 > 6000)) return pickActivity(now);
      // Kata incaran jauh? Kadang ia melompat ke sana.
      const tr = target && targetRect();
      if (tr && memory.personality.energy > 0.35 && Math.random() < dt * 0.5) {
        const tp = { x: tr.x + tr.width / 2, y: tr.y + tr.height / 2 };
        const dd = Math.hypot(tp.x - body.x, tp.y - body.y);
        if (dd > 240) startJump(now, { x: tp.x - (tp.x - body.x) / dd * 40, y: tp.y - (tp.y - body.y) / dd * 40 }, true);
      }
      break;
    }
    case 'web': {
      if (d.phase === 'spin') {
        const prog = Math.min(1, (now - d.t0) / d.dur);
        d.web.progress = prog;
        d.pt = webPoint(d.web, prog);
        if (prog >= 1) {
          d.web.built = true;
          d.phase = 'rest';
          d.restUntil = now + rand(5000, 9000);
          if (Math.random() < 0.5) say(T('webDone'), { key: 'web' });
        }
      } else if (d.phase === 'rest' && now > d.restUntil) pickActivity(now);
      else if (now > act.until) pickActivity(now);
      break;
    }
    default:
      if (now > act.until) pickActivity(now);
  }
}

// ---------- Pose kaki khusus (saat melompat / bergelantungan / bersih diri) ----------
function poseFeet(reach, spread = 1, wiggle = 0, now = 0) {
  for (const leg of legs) {
    const w = wiggle ? Math.sin(now / 160 + leg.i * 1.3 + leg.side) * wiggle : 0;
    const ang = heading + leg.side * (LEG_ANGLE[leg.i] * spread + w);
    const r = LEG_REACH[leg.i] * reach;
    leg.foot = { x: body.x + Math.cos(ang) * r, y: body.y + Math.sin(ang) * r };
    leg.t = 1;
  }
}
// Kembali menapak dengan mulus (setiap kaki "melangkah" ke posisi normalnya).
function landLegs() {
  for (const leg of legs) {
    if (!leg.foot) continue;
    leg.from = { ...leg.foot };
    leg.dur = 0.12 + leg.i * 0.025;
    leg.t = 0;
  }
}
// Membersihkan diri: sepasang kaki depan digosokkan di depan mulut.
function groomLegs(now) {
  const m = mouth(), c = Math.cos(heading), n = Math.sin(heading);
  for (const leg of legs) {
    if (leg.i !== 0) continue;
    const rub = Math.sin(now / 85 + (leg.side > 0 ? 0 : Math.PI));
    const f = 5 + rub * 3, sd = (5 + rub * 2) * leg.side;
    leg.foot = { x: m.x + c * f - n * sd, y: m.y + n * f + c * sd };
    leg.t = 1;
  }
}

// ---------- MELOMPAT ----------
// Jongkok sebentar, lalu terbang dengan lintasan parabola (tinggi "z" digambar
// sebagai tubuh naik + bayangan di tanah), meninggalkan benang pengaman.
function startJump(now, to = null, keepForaging = false) {
  if (!to) {
    const ang = rand(0, Math.PI * 2), dist = rand(120, 230);
    to = { x: body.x + Math.cos(ang) * dist, y: body.y + Math.sin(ang) * dist };
  }
  to.x = Math.max(90, Math.min(innerWidth - 90, to.x));
  to.y = Math.max(90, Math.min(innerHeight - 90, to.y));
  const dist = Math.hypot(to.x - body.x, to.y - body.y);
  act = newAct('jump', now, {
    phase: 'crouch', t0: now, from: { x: body.x, y: body.y }, to,
    dur: 380 + dist * 0.9, h: Math.min(60, 22 + dist * 0.12), z: 0, crouch: 0, keepForaging
  });
}

// ---------- MERAJUT JARING ----------
function startWeb(now) {
  if (webs.filter(w => !w.dead).length >= 2) return false;
  for (let tries = 0; tries < 8; tries++) {
    const cx = Math.max(140, Math.min(innerWidth - 140, body.x + rand(-220, 220)));
    const cy = Math.max(140, Math.min(innerHeight - 140, body.y + rand(-180, 180)));
    if (webs.some(w => Math.hypot(w.cx - cx, w.cy - cy) < 200)) continue;
    const n = Math.round(rand(9, 12));
    const web = {
      cx, cy, R: rand(70, 100), born: now, progress: 0, built: false,
      spokes: Array.from({ length: n }, (_, k) => (k / n) * Math.PI * 2 + rand(-0.12, 0.12)),
      turns: rand(3.5, 5)
    };
    act = newAct('web', now, { phase: 'go', cx, cy, web, dur: rand(14000, 17000) });
    return true;
  }
  return false;
}
// Tahap merajut (kemajuan 0–1):
//   0    – 0.30 : jari-jari, dipasang satu per satu dari tengah
//   0.30 – 0.48 : bingkai luar, berjalan mengelilingi ujung-ujung jari-jari
//   0.48 – 1    : spiral dari luar ke dalam
const SPOKE_END = 0.30, FRAME_END = 0.48;
const spokeEnd = (w, k) => ({ x: w.cx + Math.cos(w.spokes[k]) * w.R, y: w.cy + Math.sin(w.spokes[k]) * w.R });

// Titik yang sedang "dirajut" pada kemajuan prog.
function webPoint(w, prog) {
  if (prog < SPOKE_END) {
    const f = prog / SPOKE_END * w.spokes.length;
    const k = Math.min(w.spokes.length - 1, Math.floor(f)), frac = f - k;
    const out = frac < 0.5 ? frac * 2 : 2 - frac * 2; // keluar lalu kembali ke pusat
    return { x: w.cx + Math.cos(w.spokes[k]) * w.R * out, y: w.cy + Math.sin(w.spokes[k]) * w.R * out };
  }
  if (prog < FRAME_END) {
    const n = w.spokes.length, f = (prog - SPOKE_END) / (FRAME_END - SPOKE_END) * n;
    const k = Math.min(n - 1, Math.floor(f)), frac = f - k;
    const a = spokeEnd(w, k), b = spokeEnd(w, (k + 1) % n);
    return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
  }
  const t = (prog - FRAME_END) / (1 - FRAME_END);
  const a = t * w.turns * Math.PI * 2 + w.spokes[0], r = w.R * (0.95 - 0.75 * t);
  return { x: w.cx + Math.cos(a) * r, y: w.cy + Math.sin(a) * r };
}
function beginSpin(now) {
  const d = act.data;
  d.phase = 'spin';
  d.t0 = now;
  d.pt = { x: d.cx, y: d.cy };
  webs.push(d.web);
}

// ---------- BERGELANTUNG ----------
// Turun dari benang, berayun seperti bandul, lalu memanjat kembali.
//   posisi = jangkar + (sin θ, cos θ) × panjang benang
//   θ'' = −(g/L)·sin θ − redaman·θ'
function startHang(now) {
  const room = innerHeight - 80 - body.y;
  if (room < 90) return false;
  act = newAct('hang', now, {
    phase: 'drop', t0: now, anchor: { x: body.x, y: body.y }, L: 0,
    Lmax: Math.min(rand(110, 200), room), theta: rand(-0.05, 0.05), omega: rand(-0.6, 0.6),
    swingUntil: 0, nextKick: now + 1500, startHeading: heading
  });
  return true;
}

// Dipanggil tiap frame. true = Lexarach sedang di udara & tubuhnya diatur di sini.
function updateAirborne(dt, now) {
  if (!AIRBORNE.has(act.kind)) return false;
  const d = act.data;
  speedNow = 0; vel.x = vel.y = 0;
  for (const leg of legs) if (!leg.foot) leg.foot = idealFoot(leg); // kaki yang baru diatur ulang

  if (act.kind === 'jump') {
    mode = 'JUMP';
    if (d.phase === 'crouch') {
      d.crouch = Math.min(1, (now - d.t0) / 220);
      heading += angleDiff(Math.atan2(d.to.y - body.y, d.to.x - body.x), heading) * Math.min(1, dt * 12);
      if (d.crouch >= 1) {
        d.phase = 'fly'; d.t1 = now;
        threads.push({ x: d.from.x, y: d.from.y, born: now, live: true });
      }
      return true;
    }
    const p = Math.min(1, (now - d.t1) / d.dur);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // pelan di awal & akhir
    d.ground = { x: d.from.x + (d.to.x - d.from.x) * e, y: d.from.y + (d.to.y - d.from.y) * e };
    d.z = 4 * d.h * p * (1 - p);
    d.crouch = Math.max(0, 1 - p * 4);
    body.x = d.ground.x;
    body.y = d.ground.y - d.z;
    poseFeet(0.5, 0.85);
    if (p >= 1) {
      body.y = d.to.y; d.z = 0;
      const t = threads.find(x => x.live);
      if (t) { t.live = false; t.ex = body.x; t.ey = body.y; t.born = now; }
      landLegs();
      digestUntil = now + 250; // mendarat: diam sebentar
      if (d.keepForaging) act = newAct('forage', now); else pickActivity(now);
    }
    return true;
  }

  // ---- bergelantung ----
  const a = d.anchor;
  const interrupt = feedTarget || entering;
  if (d.phase === 'drop') {
    mode = 'HANG';
    d.L = Math.min(d.Lmax, d.L + dt * (60 + d.L * 2.2));       // jatuh makin cepat
    if (d.L >= d.Lmax) { d.phase = 'swing'; d.swingUntil = now + rand(3500, 6500); }
  } else if (d.phase === 'swing') {
    mode = 'HANG';
    d.omega += (-(900 / d.L) * Math.sin(d.theta) - 0.35 * d.omega) * dt;
    if (now > d.nextKick) { d.omega += rand(-0.5, 0.5); d.nextKick = now + rand(1200, 2200); } // sesekali mengayun
    // Pointer yang lewat di dekatnya ikut "mendorong" ayunan.
    const mdist = Math.hypot(mouse.x - body.x, mouse.y - body.y);
    if (mdist < 60 && now - lastMouseMove < 120) d.omega += Math.sign(body.x - mouse.x) * 1.2 * dt * 10;
    if (now > d.swingUntil || interrupt) d.phase = 'climb';
  } else {
    mode = 'CLIMB';
    d.omega *= Math.pow(0.05, dt);
    d.omega += -(900 / Math.max(20, d.L)) * Math.sin(d.theta) * dt * 0.5;
    d.L = Math.max(0, d.L - dt * (interrupt ? 260 : 75));
    if (d.L <= 0.5) {
      body.x = a.x; body.y = a.y;
      heading = d.startHeading;
      landLegs();
      pickActivity(now);
      return true;
    }
  }
  d.theta += d.omega * dt;
  d.theta = Math.max(-1.1, Math.min(1.1, d.theta));
  body.x = a.x + Math.sin(d.theta) * d.L;
  body.y = a.y + Math.cos(d.theta) * d.L;
  // Kepala menghadap ke bawah (pemintal di punggung menghadap ke jangkar).
  const down = Math.atan2(body.y - a.y, body.x - a.x);
  heading += angleDiff(d.L < 8 ? d.startHeading : down, heading) * Math.min(1, dt * 6);
  poseFeet(0.72, 1.05, 0.18, now);
  return true;
}
