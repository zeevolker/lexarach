// ============================================================
// src/content/07-draw.js — Menggambar: robot laba-laba, jaring, HUD
// Bagian dari tubuh Lexarach. Semua file di src/content/ berbagi variabel yang sama
// (urutan dimuat diatur di manifest.json). Listener baru dipasang di main().
// ============================================================

// ==========================================================
// 10. MENGGAMBAR — gaya HUD / sci-fi
// ==========================================================
// Warna bisa diatur dari popup (disimpan di storage dengan kunci "renikStyle").
// auto = true -> warna mengikuti kepribadian.
const DEFAULT_STYLE = { auto: false, body: '#ff2bd6', joint: '#c6ff00', accent: '#00f0ff', glow: 8 };
let style = { ...DEFAULT_STYLE };
chrome.storage.local.get('renikStyle').then(r => { style = { ...DEFAULT_STYLE, ...r.renikStyle }; });

function palette(p) {
  if (!style.auto) return { body: style.body, joint: style.joint, accent: style.accent };
  const hue = (270 + p.curiosity * 110) % 360;
  return {
    body: `hsl(${hue}, 100%, 60%)`,
    joint: `hsl(${(hue + 70) % 360}, 100%, 58%)`,
    accent: `hsl(${(hue + 180) % 360}, 100%, 55%)`
  };
}

let hudSide = 1;
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
const TAU = Math.PI * 2;
const GLYPHS = '01<>/\\#*+=:%$';

// Segi-n beraturan (dipakai untuk segienam, segidelapan, belah ketupat).
function poly(x, y, r, n, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

// Jaring: jari-jari, bingkai luar, lalu spiral — semuanya muncul sesuai kemajuan rajutan.
// Jaring bertahan 90 detik lalu memudar selama 30 detik.
function drawWebs(c, now) {
  for (let i = webs.length - 1; i >= 0; i--) {
    const w = webs[i];
    const age = (now - w.born) / 1000;
    if (age > 120) { webs.splice(i, 1); continue; }
    const fade = age > 90 ? 1 - (age - 90) / 30 : 1;
    const p = w.progress;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.55 * fade;
    // jari-jari
    const n = w.spokes.length;
    const spokeDone = Math.min(n, (p / SPOKE_END) * n);
    w.spokes.forEach((a, k) => {
      const f = Math.max(0, Math.min(1, spokeDone - k));
      if (f > 0) line(w.cx, w.cy, w.cx + Math.cos(a) * w.R * f, w.cy + Math.sin(a) * w.R * f);
    });
    // bingkai luar: tersambung sedikit demi sedikit, mengikuti Lexarach yang mengelilinginya
    if (p > SPOKE_END) {
      const f = Math.min(1, (p - SPOKE_END) / (FRAME_END - SPOKE_END)) * n;
      const full = Math.floor(f);
      ctx.beginPath();
      const s0 = spokeEnd(w, 0);
      ctx.moveTo(s0.x, s0.y);
      for (let k = 1; k <= Math.min(full, n); k++) { const q = spokeEnd(w, k % n); ctx.lineTo(q.x, q.y); }
      if (full < n) {
        const a = spokeEnd(w, full), b = spokeEnd(w, (full + 1) % n), fr = f - full;
        ctx.lineTo(a.x + (b.x - a.x) * fr, a.y + (b.y - a.y) * fr);
      }
      ctx.stroke();
    }
    // spiral
    if (p > FRAME_END) {
      const tEnd = (p - FRAME_END) / (1 - FRAME_END);
      ctx.globalAlpha = 0.4 * fade;
      ctx.beginPath();
      for (let t = 0; t <= tEnd; t += 0.004) {
        const a = t * w.turns * TAU + w.spokes[0], r = w.R * (0.95 - 0.75 * t);
        const x = w.cx + Math.cos(a) * r, y = w.cy + Math.sin(a) * r;
        t ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // benang yang sedang ditarik dari pemintal ke titik rajutan
    if (!w.built && act.kind === 'web' && act.data.web === w && act.data.phase === 'spin') {
      const sp = toWorld(-36, 0), pt = act.data.pt;
      ctx.globalAlpha = 0.9;
      line(sp.x, sp.y, pt.x, pt.y);
    }
    ctx.globalAlpha = 1;
  }
}

// Benang pengaman bekas melompat: menempel saat terbang, lalu memudar 1,6 detik.
function drawThreads(c, now) {
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 0.7;
  for (let i = threads.length - 1; i >= 0; i--) {
    const t = threads[i];
    let ex = t.ex, ey = t.ey, alpha = 0.7;
    if (t.live) { const sp = toWorld(-36, 0); ex = sp.x; ey = sp.y; }
    else {
      alpha = 0.7 * (1 - (now - t.born) / 1600);
      if (alpha <= 0) { threads.splice(i, 1); continue; }
    }
    ctx.globalAlpha = alpha;
    ctx.setLineDash([4, 3]);
    line(t.x, t.y, ex, ey);
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

function draw(dt, now) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const p = memory.personality;
  const c = palette(p);
  const glowOn = col => { ctx.shadowColor = col; ctx.shadowBlur = style.glow; };
  const glowOff = () => { ctx.shadowBlur = 0; };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ---------- Bidikan pada kata incaran ----------
  const tr = targetRect();
  if (tr) {
    const m = mouth();
    const cx = tr.x + tr.width / 2, cy = tr.y + tr.height / 2;
    // Kurung siku rapat di 4 sudut kata + titik bidik di tengah.
    const pad = 4, k = 6;
    const x0 = tr.left - pad, y0 = tr.top - pad, x1 = tr.right + pad, y1 = tr.bottom + pad;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1;
    glowOn(c.accent);
    ctx.beginPath();
    ctx.moveTo(x0, y0 + k); ctx.lineTo(x0, y0); ctx.lineTo(x0 + k, y0);
    ctx.moveTo(x1 - k, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + k);
    ctx.moveTo(x1, y1 - k); ctx.lineTo(x1, y1); ctx.lineTo(x1 - k, y1);
    ctx.moveTo(x0 + k, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - k);
    ctx.stroke();
    line(cx - 3, y1 + 4, cx + 3, y1 + 4); // garis kecil di bawah kata
    glowOff();
    ctx.setLineDash([1, 5]);                 // tali putus-putus dari mulut
    ctx.globalAlpha = 0.7;
    line(m.x, m.y, cx, cy);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.accent;
    ctx.font = `9px ${MONO}`;
    const d = Math.hypot(cx - m.x, cy - m.y) | 0;
    ctx.fillText(`${target.novel ? T('newSignal') : T('known', knownCount(target.word))} · ${d}px`, x0, y0 - 4);
  }

  // ---------- Jaring, benang, & bayangan (digambar di bawah tubuh) ----------
  drawWebs(c, now);
  drawThreads(c, now);
  const jz = act.kind === 'jump' ? act.data.z ?? 0 : 0;
  if (act.kind === 'jump' && act.data.ground && jz > 0.5) {
    // bayangan di tanah, makin kecil saat makin tinggi
    ctx.fillStyle = c.body;
    ctx.globalAlpha = 0.16 * (1 - jz / 90);
    ctx.beginPath();
    ctx.ellipse(act.data.ground.x, act.data.ground.y, 26 - jz * 0.15, 10 - jz * 0.06, heading, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (act.kind === 'hang') {
    // benang dari jangkar ke pemintal di punggung
    const sp = toWorld(-36, 0), an = act.data.anchor;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.8;
    line(an.x, an.y, sp.x, sp.y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.accent;
    ctx.fillRect(an.x - 2, an.y - 2, 4, 4);
  }

  // ---------- Kaki robot: tabung berongga + sendi servo + cakar ----------
  const core = 'rgba(8,10,16,0.88)'; // rongga tabung
  for (const leg of legs) {
    if (!leg.foot) continue; // belum punya posisi (baru diatur ulang)
    const hip = hipOf(leg);
    const lift = leg.t < 1 ? Math.sin(leg.t * Math.PI) : 0;
    const knee = solveKnee(hip, leg.foot, lift, leg);

    // Tabung: garis tebal bercahaya lalu garis gelap di tengah -> tampak berongga
    ctx.strokeStyle = c.body;
    ctx.lineWidth = 3.4;
    glowOn(c.body);
    ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(leg.foot.x, leg.foot.y); ctx.stroke();
    glowOff();
    ctx.strokeStyle = core;
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(leg.foot.x, leg.foot.y); ctx.stroke();

    // Piston di sisi paha
    const fx = knee.x - hip.x, fy = knee.y - hip.y, fl = Math.hypot(fx, fy) || 1;
    const nx = -fy / fl * 3.2 * leg.side, ny = fx / fl * 3.2 * leg.side;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1;
    line(hip.x + fx * 0.25 + nx, hip.y + fy * 0.25 + ny, hip.x + fx * 0.7 + nx, hip.y + fy * 0.7 + ny);

    // Sendi servo di lutut & pangkal
    ctx.fillStyle = core;
    ctx.strokeStyle = c.joint;
    ctx.lineWidth = 1.2;
    glowOn(c.joint);
    ctx.beginPath(); ctx.arc(knee.x, knee.y, 3.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(hip.x, hip.y, 2.2, 0, TAU); ctx.fill(); ctx.stroke();
    glowOff();
    ctx.fillStyle = c.joint;
    ctx.fillRect(knee.x - 0.8, knee.y - 0.8, 1.6, 1.6);

    // Cakar: dua jari, membuka saat kaki terangkat
    const sx = leg.foot.x - knee.x, sy = leg.foot.y - knee.y, sa = Math.atan2(sy, sx);
    const open = 0.45 + lift * 0.5;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1.1;
    for (const k of [-1, 1]) {
      const ca = sa + Math.PI + k * open;
      line(leg.foot.x, leg.foot.y, leg.foot.x + Math.cos(ca) * 4.5, leg.foot.y + Math.sin(ca) * 4.5);
    }
    if (lift > 0.05) {
      glowOn(c.accent);
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(leg.foot.x, leg.foot.y, 1.4, 0, TAU); ctx.fill();
      glowOff();
    }
  }

  // ---------- Tubuh robot (koordinat lokal: x = depan) ----------
  const sway = Math.sin(gaitPhase * TAU) * 1.3 * Math.min(1, speedNow / 40);
  // Menyambar: tubuh terdorong ±7 px ke depan lalu kembali (±0,22 detik).
  const lp = (now - lungeAt) / 220;
  const lunge = lp >= 0 && lp < 1 ? Math.sin(lp * Math.PI) * 7 : 0;
  const crouch = act.kind === 'jump' ? act.data.crouch ?? 0 : 0;
  const breathe = mode === 'REST' ? 1 + Math.sin(now / 600) * 0.035 : 1; // "bernapas" saat istirahat
  ctx.save();
  ctx.translate(body.x - Math.sin(heading) * sway + Math.cos(heading) * lunge,
                body.y + Math.cos(heading) * sway + Math.sin(heading) * lunge);
  ctx.rotate(heading);
  const bs = size * (1 - crouch * 0.07 + jz / 260); // jongkok sebelum melompat, membesar saat di udara
  ctx.scale(bs, bs);

  // --- Perut: kapsul berlapis
  ctx.save();
  ctx.translate(-20, 0);
  ctx.scale(breathe, breathe);
  ctx.translate(20, 0);
  ctx.beginPath();
  for (const [x, y] of [[-6, -6], [-12, -10], [-25, -10], [-32, -6], [-35, 0], [-32, 6], [-25, 10], [-12, 10], [-6, 6]]) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = c.body;
  ctx.globalAlpha = 0.14; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = c.body;
  ctx.lineWidth = 1.5;
  glowOn(c.body);
  ctx.stroke();
  glowOff();
  // rusuk pelat
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 0.8;
  for (const x of [-13, -27]) {
    ctx.beginPath(); ctx.moveTo(x + 1.5, -9); ctx.quadraticCurveTo(x - 1.5, 0, x + 1.5, 9); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // inti energi: kecerahannya bernapas pelan, cincin luarnya berputar
  ctx.fillStyle = c.joint;
  ctx.globalAlpha = 0.65 + Math.sin(now / 420) * 0.35;
  glowOn(c.joint);
  ctx.beginPath(); ctx.arc(-20, 0, 3.6, 0, TAU); ctx.fill();
  glowOff();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 1;
  const spin = now / 700;
  for (const k of [0, Math.PI]) { ctx.beginPath(); ctx.arc(-20, 0, 6, spin + k, spin + k + 1.6); ctx.stroke(); }
  // ventilasi & nosel pemintal
  ctx.lineWidth = 0.9;
  for (const y of [-4, 4]) line(-32, y * 0.9, -29, y);
  ctx.strokeRect(-38.5, -1.6, 3.2, 3.2);
  ctx.restore();

  // --- Pinggang: dua batang penghubung
  ctx.strokeStyle = c.body;
  ctx.lineWidth = 1;
  line(-6, -2.2, -2, -2.2);
  line(-6, 2.2, -2, 2.2);

  // --- Dada: pelat baja bersudut
  ctx.beginPath();
  for (const [x, y] of [[13, 0], [9, -6.5], [2, -8.5], [-3.5, -6], [-3.5, 6], [2, 8.5], [9, 6.5]]) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = c.body;
  ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = c.body;
  ctx.lineWidth = 1.5;
  glowOn(c.body);
  ctx.stroke();
  glowOff();
  // garis panel
  ctx.strokeStyle = c.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(8, -4.5); ctx.lineTo(2, -5.8); ctx.lineTo(-1, -3.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, 4.5); ctx.lineTo(2, 5.8); ctx.lineTo(-1, 3.5); ctx.stroke();
  ctx.globalAlpha = 1;
  // visor sensor dengan titik cahaya yang menyapu
  ctx.fillStyle = core;
  ctx.fillRect(7.2, -4.2, 3.6, 8.4);
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 0.9;
  ctx.strokeRect(7.2, -4.2, 3.6, 8.4);
  const scanSpeed = mode === 'LOOK' || mode === 'HUNT' || mode === 'SNEAK' ? 140 : 380;
  const scanY = Math.sin(now / scanSpeed) * 3.1;
  ctx.fillStyle = c.joint;
  glowOn(c.joint);
  ctx.fillRect(7.6, scanY - 1, 2.8, 2);
  glowOff();

  // --- Lengan depan (pedipalpus mekanis): membuka saat menyambar / mengunyah / bersih diri
  const chew = lunge > 0 ? 3.5
    : mode === 'GROOM' ? 1.5 + Math.sin(now / 70) * 1.5
    : now < digestUntil ? 1.5 + Math.sin(now / 45) * 1.5 : 0.5;
  ctx.strokeStyle = c.joint;
  ctx.lineWidth = 1.2;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(12, sd * 2.5);
    ctx.lineTo(15.5, sd * (3.5 + chew * 0.6));
    ctx.lineTo(18, sd * (2 + chew * 0.4));
    ctx.stroke();
  }
  ctx.restore();
  glowOff();

  // ---------- Kata yang ditelan: "terurai" jadi glyph saat masuk mulut ----------
  const m = mouth();
  ctx.font = `10px ${MONO}`;
  for (let i = crumbs.length - 1; i >= 0; i--) {
    const cr = crumbs[i];
    cr.t += dt * 1.6;
    cr.x += (m.x - cr.x) * 0.12;
    cr.y += (m.y - cr.y) * 0.12;
    const txt = [...cr.word].map(ch => (Math.random() < cr.t ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : ch)).join('');
    ctx.globalAlpha = Math.max(0, 1 - cr.t);
    ctx.fillStyle = cr.novel ? c.accent : c.body;
    ctx.fillText(txt, cr.x, cr.y);
    if (cr.t >= 1) crumbs.splice(i, 1);
  }
  ctx.globalAlpha = 1;

  // ---------- Panel HUD ----------
  // Belum terlihat (masih di luar layar)? Panel jangan muncul dulu.
  if (body.x < -10 || body.x > innerWidth + 10) return;
  hudSide += ((body.x > innerWidth - 240 ? -1 : 1) - hudSide) * Math.min(1, dt * 4);
  // Kalimat yang sedang diucapkan dipecah per baris (maks 30 huruf), diketik pelan.
  const lines = [];
  if (speech) {
    const typed = speech.text.slice(0, Math.floor((now - speech.start) / 35));
    let cur = '';
    for (const w of typed.split(' ')) {
      if ((cur + ' ' + w).trim().length > 30) { lines.push(cur); cur = w; }
      else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
  }
  const W = Math.max(118, (memory.species ?? 'Lexarach').length * 6 + 14, ...lines.map(l => l.length * 5.6 + 24));
  const H = 32 + (lines.length ? lines.length * 12 + 8 : 0);
  const hx = body.x + hudSide * 50, hy = body.y - 70 - (H - 32);
  const left = hudSide >= 0 ? hx : hx - W;
  // garis penghubung bersiku
  ctx.strokeStyle = c.body;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(body.x + hudSide * 10, body.y - 10);
  ctx.lineTo(hx, hy + H);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // latar panel semi-transparan supaya teks tetap terbaca di atas tulisan halaman
  ctx.fillStyle = darkPage ? 'rgba(8,10,16,0.72)' : 'rgba(250,250,255,0.78)';
  ctx.fillRect(left, hy, W, H);
  // bingkai sudut
  ctx.strokeStyle = c.accent;
  const k = 6;
  ctx.beginPath();
  ctx.moveTo(left, hy + k); ctx.lineTo(left, hy); ctx.lineTo(left + k, hy);
  ctx.moveTo(left + W - k, hy + H); ctx.lineTo(left + W, hy + H); ctx.lineTo(left + W, hy + H - k);
  ctx.stroke();
  // teks
  ctx.fillStyle = c.body;
  ctx.font = `italic 10px ${MONO}`;
  const spName = memory.species ?? 'Lexarach';
  ctx.fillText(spName, left + 6, hy + 13);
  ctx.fillStyle = c.accent;
  ctx.font = `9px ${MONO}`;
  const cursor = now % 1000 < 500 ? '_' : ' ';
  ctx.fillText(`> ${modeLabel(asleep ? mode : speech ? 'TX' : mode)}${cursor}`, left + 6, hy + 25);
  // transmisi (kalimat yang diucapkan)
  if (lines.length) {
    ctx.fillStyle = c.joint;
    ctx.font = `10px ${MONO}`;
    lines.forEach((l, i) => ctx.fillText(l, left + 12, hy + 41 + i * 12));
    ctx.strokeStyle = c.joint;
    ctx.globalAlpha = 0.6;
    line(left + 6, hy + 33, left + 6, hy + 33 + lines.length * 12); // garis tepi kutipan
    ctx.globalAlpha = 1;
  }
}
