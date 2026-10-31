// ============================================================
// src/content/06-motion.js — Gerak: kemudi, reaksi pointer, kepribadian (kaget/elus)
// Bagian dari tubuh Lexarach. Semua file di src/content/ berbagi variabel yang sama
// (urutan dimuat diatur di manifest.json). Listener baru dipasang di main().
// ============================================================

// ==========================================================
// 9. GERAK: ke mana tubuh pergi?
// ==========================================================
let mouse = { x: -9999, y: -9999 };
let lastMouseMove = 0; // kapan pointer terakhir bergerak
let mouseVel = { x: 0, y: 0 }, mouseSpeed = 0, lastMouseEvt = null;
function initPointer() {
  addEventListener('mousemove', e => {
    const t = performance.now();
    if (lastMouseEvt) {
      const dtm = Math.max(8, t - lastMouseEvt.t);
      mouseVel = { x: (e.clientX - lastMouseEvt.x) / dtm * 1000, y: (e.clientY - lastMouseEvt.y) / dtm * 1000 };
      mouseSpeed = Math.hypot(mouseVel.x, mouseVel.y); // px/detik
    }
    lastMouseEvt = { x: e.clientX, y: e.clientY, t };
    mouse = { x: e.clientX, y: e.clientY };
    lastMouseMove = t;
  }, { passive: true });
}

// ---------- Keberanian bisa naik & turun karena cara Anda memperlakukannya ----------
//   dikagetkan : pointer bergerak CEPAT menuju Lexarach      -> kabur, keberanian −0,006 (jeda 4 dtk)
//   dielus     : pointer PELAN di dekatnya ±2,5 detik     -> tenang, keberanian +0,003 (jeda 10 dtk)
//   (diseret saat tidur juga membuatnya sedikit kurang berani, lihat endDrag)
let lastStartle = -1e9, lastPet = -1e9, petTime = 0;
function changeMood(trait, delta) {
  if (memory?.personality) memory.personality[trait] = Math.max(0.05, Math.min(0.95, memory.personality[trait] + delta));
  chrome.runtime.sendMessage({ type: 'MOOD', trait, delta }).catch(() => {});
}
function checkMood(dt, now) {
  if (AIRBORNE.has(act.kind) || feedTarget || entering) { petTime = 0; return; }
  if (now - lastMouseMove > 120) mouseSpeed = 0; // pointer berhenti
  const dx = body.x - mouse.x, dy = body.y - mouse.y, d = Math.hypot(dx, dy) || 1;
  // Dikagetkan: cepat & mengarah ke tubuhnya
  if (now - lastStartle > 4000 && mouseSpeed > 1400 && d < 130 &&
      (mouseVel.x * dx + mouseVel.y * dy) / (d * mouseSpeed) > 0.6) {
    lastStartle = now;
    petTime = 0;
    retreatUntil = now + 500;
    target = null;
    changeMood('boldness', -0.006);
    say(T('startled'), { force: true });
    return;
  }
  // Dielus: pelan & dekat
  if (d < 75 && mouseSpeed < 250 && now - lastMouseMove < 400) petTime += dt; else petTime = 0;
  if (petTime > 2.5 && now - lastPet > 10000) {
    lastPet = now;
    petTime = 0;
    changeMood('boldness', 0.003);
    say(T('petted'), { force: true });
  }
}

// Makan di dekat pointer:
//   - pemberani   : tetap makan, mengabaikan pointer
//   - pemalu      : pointer bergerak -> menunggu di jarak aman (RAGU)
//                   pointer diam     -> mengendap pelan (MENGENDAP), menyambar, lalu lari sambil mengunyah
let retreatUntil = 0;     // sedang lari setelah menyambar
let lungeAt = -1e9;       // kapan terakhir menerjang (animasi menyambar)
let waitTime = 0;         // sudah berapa lama ragu-ragu di target ini


let wanderAngle = Math.random() * Math.PI * 2; // arah jalan-jalan yang berubah pelan
// Laba-laba berjalan dengan gaya "lari sebentar, berhenti, lari lagi".
let burstOn = true, burstUntil = 0;

// "Steering" ala Craig Reynolds:
//   kecepatan_yang_diinginkan - kecepatan_sekarang = gaya kemudi
// Gaya kemudi dibatasi (maxForce), jadi perubahan arah selalu halus,
// tapi tubuh tetap bisa bergerak ke samping/mundur sedikit (tidak mengorbit).
function updateBody(dt, now) {
  const p = memory.personality;
  const m = mouth();
  const maxSpeed = 35 + p.energy * 100;    // px/detik
  const maxForce = 320 + p.energy * 320;   // px/detik² — laba-laba cepat mulai & cepat berhenti
  let desired = { x: 0, y: 0 };
  let faceTo = null; // titik yang ingin ia tatap

  // Menuju titik (tx,ty) dan melambat saat sudah dekat ("arrive").
  const arrive = (tx, ty, fx, fy, slowRadius, speed = maxSpeed) => {
    const dx = tx - fx, dy = ty - fy, d = Math.hypot(dx, dy) || 1;
    const s = speed * Math.min(1, d / slowRadius);
    return { x: (dx / d) * s, y: (dy / d) * s, d };
  };

  const md = Math.hypot(mouse.x - body.x, mouse.y - body.y);
  const tr = targetRect();
  const pointerIdle = now - lastMouseMove > 700;
  const shy = p.boldness <= 0.5;
  const tp = tr ? { x: tr.x + tr.width / 2, y: tr.y + tr.height / 2 } : null;
  const nearPointer = pt => pt && Math.hypot(mouse.x - pt.x, mouse.y - pt.y) < 130;
  // Pointer yang diam dianggap tidak terlalu mengancam.
  const reactRadius = pointerIdle ? 90 : 160;

  if (feedTarget && !entering) {
    // Diberi makan: merayap ke teks yang Anda blok, lalu memakannya.
    const r = feedTarget.range?.getBoundingClientRect();
    if (!r || r.width === 0 || r.bottom < 0 || r.top > innerHeight) {
      finishFeed(null); // teksnya tidak terlihat: langsung "ditelan"
    } else {
      mode = 'FEED';
      const fp = { x: r.left + Math.min(r.width, 160) / 2, y: r.top + Math.min(r.height, 40) / 2 };
      faceTo = fp;
      // Dekat pointer: Anda yang menyuruh, jadi tetap datang, tapi pelan & hati-hati.
      desired = arrive(fp.x, fp.y, m.x, m.y, 70, nearPointer(fp) ? maxSpeed * 0.55 : maxSpeed);
      if (desired.d < 14) {
        lungeAt = now;
        finishFeed(fp);
        if (shy && nearPointer(fp)) retreatUntil = now + 600;
      }
    }
  } else if (entering && now < enterDelayUntil) {
    // Masih "dalam perjalanan" ke tab ini: tunggu di luar layar.
    mode = 'ENTER';
    vel.x = vel.y = 0;
  } else if (entering) {
    // Baru pindah tab: merayap masuk dari tepi layar.
    mode = 'ENTER';
    faceTo = entering;
    desired = arrive(entering.x, entering.y, body.x, body.y, 90, maxSpeed * 0.8); // masuk dengan hati-hati
    if (desired.d < 14) entering = null;
  } else if (now < retreatUntil) {
    // Baru menyambar kata di dekat pointer: lari menjauh sambil mengunyah.
    mode = 'FLEE';
    const d = md || 1;
    desired = { x: ((body.x - mouse.x) / d) * maxSpeed * 1.3, y: ((body.y - mouse.y) / d) * maxSpeed * 1.3 };
  } else if (now < digestUntil) {
    // a) Sedang mengunyah: diam di tempat.
    mode = 'DIGEST';
  } else if (['web', 'rest', 'groom', 'look'].includes(act.kind)) {
    // Kegiatan di tempat. Lexarach pemalu tetap kabur kalau pointer bergerak terlalu dekat.
    if (shy && !pointerIdle && md < 110 && act.kind !== 'web') {
      mode = 'FLEE';
      const d = md || 1;
      desired = { x: ((body.x - mouse.x) / d) * maxSpeed * 1.4, y: ((body.y - mouse.y) / d) * maxSpeed * 1.4 };
      act = newAct('wander', now);
    } else if (act.kind === 'web') {
      const d = act.data;
      mode = d.phase === 'rest' ? 'REST' : 'WEB';
      if (d.phase === 'go') {
        desired = arrive(d.cx, d.cy, body.x, body.y, 60, maxSpeed * 0.8);
        faceTo = { x: d.cx, y: d.cy };
        if (desired.d < 10) beginSpin(now);
      } else if (d.phase === 'spin' && d.web.progress < SPOKE_END) {
        // Memasang jari-jari: tetap di tengah, memutar badan supaya benang memancar dari pemintal.
        desired = arrive(d.cx, d.cy, body.x, body.y, 20, maxSpeed * 0.6);
        faceTo = { x: 2 * d.cx - d.pt.x, y: 2 * d.cy - d.pt.y };
      } else if (d.phase === 'spin' && d.web.progress < FRAME_END) {
        desired = arrive(d.pt.x, d.pt.y, body.x, body.y, 20, maxSpeed * 1.9); // mengelilingi bingkai luar
      } else if (d.phase === 'spin') {
        desired = arrive(d.pt.x, d.pt.y, body.x, body.y, 25, maxSpeed * 1.5); // berjalan mengikuti spiral
      } else {
        desired = arrive(d.cx, d.cy, body.x, body.y, 30, maxSpeed * 0.4);   // istirahat di tengah jaring
      }
    } else if (act.kind === 'look') {
      mode = 'LOOK';
      const a = act.data.base + Math.sin((now - act.t0) / 650) * 0.9;     // menoleh kiri-kanan
      faceTo = { x: body.x + Math.cos(a) * 60, y: body.y + Math.sin(a) * 60 };
    } else {
      mode = act.kind === 'rest' ? 'REST' : 'GROOM';
    }
  } else if (tp && nearPointer(tp)) {
    // Kata incaran ada di dekat pointer.
    faceTo = tp;
    if (!shy) {
      mode = 'HUNT';                                   // pemberani: tetap makan
      desired = arrive(tp.x, tp.y, m.x, m.y, 70, maxSpeed * 0.8);
      if (desired.d < 10) eat(tp);
    } else if (!pointerIdle) {
      mode = 'WAIT';                                   // pemalu, pointer bergerak: tunggu di jarak aman
      waitTime += dt;
      const dx = body.x - mouse.x, dy = body.y - mouse.y, d = Math.hypot(dx, dy) || 1;
      const safe = { x: mouse.x + (dx / d) * 150, y: mouse.y + (dy / d) * 150 };
      desired = arrive(safe.x, safe.y, body.x, body.y, 60, maxSpeed * 0.7);
      if (waitTime > 8) { ignoredHere.add(target.word); target = null; waitTime = 0; } // terlalu lama: cari kata lain
    } else {
      mode = 'SNEAK';                                  // pemalu, pointer diam: mengendap pelan
      desired = arrive(tp.x, tp.y, m.x, m.y, 30, maxSpeed * 0.5);
      if (desired.d < 10) { eat(tp); retreatUntil = now + 650; digestUntil = Math.max(digestUntil, retreatUntil + 400); }
    }
  } else if (md < reactRadius) {
    // b) Reaksi terhadap kursor: berani -> mendekat, pemalu -> kabur.
    if (p.boldness > 0.5) {
      mode = 'APPROACH';
      faceTo = mouse;
      if (md > 70) desired = arrive(mouse.x, mouse.y, body.x, body.y, 140, maxSpeed * 0.6);
    } else {
      mode = 'FLEE';
      const d = md || 1;
      desired = { x: ((body.x - mouse.x) / d) * maxSpeed * 1.5, y: ((body.y - mouse.y) / d) * maxSpeed * 1.5 };
    }
  } else if (tr) {
    // c) Mengejar kata: MULUT yang diarahkan ke kata.
    mode = 'HUNT';
    waitTime = 0;
    faceTo = tp;
    desired = arrive(tp.x, tp.y, m.x, m.y, 70);
    huntTime += dt;
    if (desired.d < 10) eat(tp);
    else if (huntTime > 6) {
      // Terlalu lama tidak sampai: menyerah, cari kata lain.
      ignoredHere.add(target.word);
      target = null;
    }
  } else {
    // d) Tidak ada tujuan: berkeliaran.
    mode = 'WANDER';
    wanderAngle += (Math.random() - 0.5) * dt * 3;
    desired = { x: Math.cos(wanderAngle) * maxSpeed * 0.45, y: Math.sin(wanderAngle) * maxSpeed * 0.45 };
  }

  // Lari-berhenti: hanya saat berkeliaran atau targetnya masih jauh.
  if (mode === 'WANDER' || (mode === 'HUNT' && desired.d > 60)) {
    if (now > burstUntil) {
      burstOn = !burstOn;
      burstUntil = now + (burstOn
        ? 400 + Math.random() * 1000                         // lama berlari
        : 120 + Math.random() * 600 * (1 - p.energy));       // lama berhenti (yang lesu berhenti lebih lama)
    }
    if (!burstOn) { desired.x *= 0.03; desired.y *= 0.03; }
  }

  // e) Dinding tak terlihat: dorongan lembut menjauhi tepi layar.
  const e = 80;
  const push = (v, lo, hi) => (v < lo ? lo - v : v > hi ? hi - v : 0);
  const px = push(body.x, e, innerWidth - e), py = push(body.y, e, innerHeight - e);
  if ((px || py) && !entering) {
    desired.x += px * 4;
    desired.y += py * 4;
    if (mode === 'WANDER') wanderAngle = Math.atan2(desired.y, desired.x);
  }

  // Terapkan gaya kemudi (dibatasi supaya halus).
  let sx = desired.x - vel.x, sy = desired.y - vel.y;
  const sl = Math.hypot(sx, sy), lim = maxForce * dt;
  if (sl > lim) { sx *= lim / sl; sy *= lim / sl; }
  vel.x += sx;
  vel.y += sy;
  body.x += vel.x * dt;
  body.y += vel.y * dt;
  speedNow = Math.hypot(vel.x, vel.y);

  // Arah hadap: menatap target kalau ada, kalau tidak ikut arah jalan.
  let face = null;
  if (faceTo && mode !== 'FLEE') face = Math.atan2(faceTo.y - body.y, faceTo.x - body.x);
  else if (speedNow > 4) face = Math.atan2(vel.y, vel.x);
  // Belok dengan "redaman" eksponensial: cepat saat beda jauh, halus saat hampir sama.
  if (face !== null) heading += angleDiff(face, heading) * (1 - Math.exp(-dt * 5));
}
