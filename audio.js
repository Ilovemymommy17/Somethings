/* =========================================================
   Autumn heart — original sound engine
   Everything is synthesized with WebAudio, so the gift works
   with zero audio files. You may optionally drop local files
   into assets/audio/ and fill in the paths below.
   Audio always starts OFF. Nothing plays until a switch is on.
   ========================================================= */
(function () {
  "use strict";

  /* --- optional local audio files (leave "" to use synth) --- */
  var FILES = {
    music: "",      // e.g. "assets/audio/music.mp3"  (loops)
    wind: "",       // e.g. "assets/audio/wind.mp3"   (loops)
    chime: "",      // e.g. "assets/audio/chime.mp3"
    whoosh: "",     // e.g. "assets/audio/whoosh.mp3"
    rustle: "",     // e.g. "assets/audio/leaves.mp3"
    click: ""       // e.g. "assets/audio/click.mp3"
  };

  var ctx = null;
  var master, comp, musicGain, sfxGain, ambienceGain, reverb, reverbGain;
  var noiseBuf = null;
  var windNodes = null;
  var musicTimer = null;
  var musicPlaying = false;
  var musicBar = 0;
  var nextBarTime = 0;
  var barDur = 60 / 72 * 4;       // 72 bpm, 4/4
  var fileCache = {};
  var status = { music: false, sfx: false, musicVol: 0.55, sfxVol: 0.65 };
  var reduced = false;
  try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var els = {};

  /* -------------------------------------------------------
     Tiny helpers
     ------------------------------------------------------- */
  function now() { return ctx ? ctx.currentTime : 0; }
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function store(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (e) {}
  }
  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : Number(v);
    } catch (e) { return fallback; }
  }

  function loadFile(url) {
    return new Promise(function (resolve, reject) {
      if (!url) { reject(new Error("no file")); return; }
      if (fileCache[url]) { resolve(fileCache[url]); return; }
      var a = new Audio();
      a.preload = "auto";
      a.src = url;
      var done = false;
      function ok() { if (done) return; done = true; fileCache[url] = a; resolve(a); }
      function bad() { if (done) return; done = true; reject(new Error("audio file missing")); }
      a.addEventListener("canplaythrough", ok, { once: true });
      a.addEventListener("error", bad, { once: true });
      setTimeout(function () { if (!done && a.readyState >= 2) ok(); }, 1200);
      setTimeout(bad, 3200);
      try { a.load(); } catch (e) {}
    });
  }

  function makeNoise(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;   // soft pinkish noise
      d[i] = last * 3.5;
    }
    return buf;
  }

  function makeReverb(seconds, decay) {
    var rate = ctx.sampleRate;
    var len = Math.floor(rate * seconds);
    var buf = ctx.createBuffer(2, len, rate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /* -------------------------------------------------------
     Graph
     ------------------------------------------------------- */
  function init() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 24;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.35;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = makeReverb(2.6, 2.6);
    reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.5;
    reverb.connect(reverbGain);
    reverbGain.connect(master);

    musicGain = ctx.createGain(); musicGain.gain.value = 0;
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0;
    ambienceGain = ctx.createGain(); ambienceGain.gain.value = 0;
    musicGain.connect(master);
    sfxGain.connect(master);
    ambienceGain.connect(sfxGain);

    var musicSend = ctx.createGain(); musicSend.gain.value = 0.34;
    musicGain.connect(musicSend); musicSend.connect(reverb);
    var sfxSend = ctx.createGain(); sfxSend.gain.value = 0.45;
    sfxGain.connect(sfxSend); sfxSend.connect(reverb);

    noiseBuf = makeNoise(4);
    buildWind();

    status.musicVol = clamp(read("autumn.musicVol", 55) / 100, 0, 1);
    status.sfxVol = clamp(read("autumn.sfxVol", 65) / 100, 0, 1);

    document.addEventListener("visibilitychange", function () {
      if (!ctx) return;
      if (document.hidden) {
        ctx.suspend().catch(function () {});
      } else if (status.music || status.sfx) {
        ctx.resume().catch(function () {});
      }
    });
    return true;
  }

  function unlock() {
    if (!init()) return false;
    if (ctx.state === "suspended") ctx.resume().catch(function () {});
    return true;
  }

  /* -------------------------------------------------------
     Wind & leaves (ambience)
     ------------------------------------------------------- */
  function buildWind() {
    var loop = ctx.createBufferSource();
    loop.buffer = noiseBuf;
    loop.loop = true;

    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 430;
    lp.Q.value = 0.35;

    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 820;
    bp.Q.value = 0.55;

    var g = ctx.createGain();
    g.gain.value = 0.055;

    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.055;
    var lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 0.028;
    lfo.connect(lfoAmt);
    lfoAmt.connect(g.gain);

    var g2 = ctx.createGain();
    g2.gain.value = 0.016;

    loop.connect(lp); lp.connect(g); g.connect(ambienceGain);
    loop.connect(bp); bp.connect(g2); g2.connect(ambienceGain);
    loop.start();
    lfo.start();

    windNodes = { loop: loop, lp: lp, bp: bp, g: g, lfo: lfo };
  }

  function scheduleRustle() {
    if (!ctx) return;
    if (!status.sfx) return;
    var delay = 4200 + Math.random() * 5200;
    setTimeout(function () {
      if (!status.sfx) { scheduleRustle(); return; }
      sfxRustle(0.55 + Math.random() * 0.25, 0.025);
      scheduleRustle();
    }, delay);
  }

  /* -------------------------------------------------------
     One-shot synth voices
     ------------------------------------------------------- */
  function bell(freq, time, gain, dur, dest) {
    var t = time || now();
    var d = dur || 2.2;
    var out = dest || sfxGain;
    var parts = [
      { r: 1, g: 1, d: 1 },
      { r: 2.001, g: 0.28, d: 0.55 },
      { r: 2.98, g: 0.14, d: 0.34 },
      { r: 4.1, g: 0.06, d: 0.2 }
    ];
    parts.forEach(function (p) {
      var o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * p.r;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * p.g), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d * p.d);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + d * p.d + 0.05);
    });
  }

  function pluck(freq, time, gain, dur, dest) {
    var t = time || now();
    var d = dur || 0.9;
    var out = dest || sfxGain;
    var o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t);
    var o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(freq * 2.004, t);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    var g2 = ctx.createGain();
    g2.gain.value = 0.22;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(out);
    o.start(t); o.stop(t + d + 0.05);
    o2.start(t); o2.stop(t + d + 0.05);
  }

  function noiseBurst(opts) {
    if (!ctx) return;
    var o = opts || {};
    var t = o.time || now();
    var d = o.dur || 0.4;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 1;
    var f = ctx.createBiquadFilter();
    f.type = o.type || "bandpass";
    f.frequency.setValueAtTime(o.f0 || 1400, t);
    f.Q.value = o.q || 0.8;
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + d);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain || 0.05, t + (o.attack || 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t, Math.random() * 2); src.stop(t + d + 0.08);
  }

  /* -------------------------------------------------------
     Music — an original little music-box theme (A major)
     ------------------------------------------------------- */
  var PROG = [
    { bass: 45, chord: [57, 61, 64], high: [69, 73, 76, 81] },   // A
    { bass: 40, chord: [52, 56, 59], high: [64, 68, 71, 76] },   // E
    { bass: 42, chord: [54, 57, 61], high: [66, 69, 73, 78] },   // F#m
    { bass: 38, chord: [50, 54, 57], high: [62, 66, 69, 74] }    // D
  ];
  var MELODY = [0, 2, 1, 3, 2, 1, 0, 2, 3, 1, 2, 0];

  function scheduleBar(t, index) {
    var p = PROG[index % PROG.length];
    var chordGain = 0.028 + (index % 4 === 0 ? 0.006 : 0);
    /* felt-piano chord on beats 1 and 3 */
    [0, 2].forEach(function (beat) {
      p.chord.forEach(function (n, i) {
        var time = t + beat * barDur / 4 + 0.012 + i * 0.03;
        var o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = midi(n);
        var o2 = ctx.createOscillator();
        o2.type = "sine";
        o2.frequency.value = midi(n) * 2.002;
        var lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 1500;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(chordGain * (beat === 0 ? 1 : 0.72), time + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 2.4);
        o.connect(lp); lp.connect(g);
        var g2 = ctx.createGain(); g2.gain.value = 0.16;
        o2.connect(g2); g2.connect(g);
        g.connect(musicGain);
        o.start(time); o.stop(time + 2.5);
        o2.start(time); o2.stop(time + 2.5);
      });
    });

    /* warm bass */
    var bassTime = t + 0.02;
    var bo = ctx.createOscillator();
    bo.type = "sine";
    bo.frequency.value = midi(p.bass);
    var bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, bassTime);
    bg.gain.exponentialRampToValueAtTime(0.075, bassTime + 0.25);
    bg.gain.exponentialRampToValueAtTime(0.0001, bassTime + 3.1);
    bo.connect(bg); bg.connect(musicGain);
    bo.start(bassTime); bo.stop(bassTime + 3.2);

    /* soft pad */
    [0, 1].forEach(function (i) {
      var po = ctx.createOscillator();
      po.type = "triangle";
      po.frequency.value = midi(p.chord[i === 0 ? 0 : 2]) + (i ? 0.35 : -0.25);
      var plp = ctx.createBiquadFilter();
      plp.type = "lowpass";
      plp.frequency.value = 760;
      var pg = ctx.createGain();
      var pt = t + 0.05;
      pg.gain.setValueAtTime(0.0001, pt);
      pg.gain.linearRampToValueAtTime(0.022, pt + 1.4);
      pg.gain.linearRampToValueAtTime(0.0001, pt + barDur + 0.2);
      po.connect(plp); plp.connect(pg); pg.connect(musicGain);
      po.start(pt); po.stop(pt + barDur + 0.4);
    });

    /* music-box arpeggio */
    var eighth = barDur / 8;
    for (var k = 0; k < 6; k++) {
      var slot = [0, 1, 2, 3, 4, 5][k];
      var noteIdx = MELODY[(index * 6 + k) % MELODY.length];
      var note = p.high[noteIdx];
      var vel = k === 0 ? 0.043 : 0.028 + (k % 3 === 1 ? 0.006 : 0);
      var nt = t + slot * 1.16 * eighth + (k % 2 ? 0.02 : 0);
      bell(midi(note + 12), nt, vel, 1.9, musicGain);
    }

    /* a sparse high sparkle */
    if (index % 2 === 1) {
      bell(midi(p.high[3] + 12), t + barDur * 0.72, 0.016, 2.6, musicGain);
    }
  }

  function startMusic() {
    if (!ctx) return;
    if (musicPlaying) return;
    if (!status.music) return;
    musicPlaying = true;
    nextBarTime = ctx.currentTime + 0.18;
    musicBar = 0;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(status.musicVol * 0.95, ctx.currentTime + 1.6);
    scheduleMusic();
    musicTimer = setInterval(scheduleMusic, 240);
  }

  var fileMusicEl = null;
  var musicFileMode = false;

  function scheduleMusic() {
    if (!ctx || !status.music) return;
    if (musicFileMode) return;
    while (nextBarTime < ctx.currentTime + 1.1) {
      scheduleBar(nextBarTime, musicBar++);
      nextBarTime += barDur;
    }
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    musicPlaying = false;
    if (!ctx) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), ctx.currentTime);
    musicGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    if (fileMusicEl) { try { fileMusicEl.pause(); } catch (e) {} }
  }

  function setMusic(on) {
    if (on && !unlock()) { on = false; }
    status.music = !!on;
    if (on) {
      if (FILES.music) {
        loadFile(FILES.music).then(function (el) {
          if (!status.music) return;
          fileMusicEl = el;
          el.loop = true;
          el.volume = clamp(status.musicVol * 0.9, 0, 1);
          musicFileMode = true;
          el.play().catch(function () { musicFileMode = false; startMusic(); });
        }).catch(function () {
          musicFileMode = false;
          startMusic();
        });
      } else {
        musicFileMode = false;
        startMusic();
      }
      if (fileMusicEl) {
        fileMusicEl.volume = clamp(status.musicVol * 0.9, 0, 1);
        fileMusicEl.play().catch(function () {});
      }
    } else {
      stopMusic();
    }
    paintUI();
  }

  function buildSfxFiles() {
    Object.keys(FILES).forEach(function (k) {
      if (!FILES[k]) return;
      loadFile(FILES[k]).catch(function () {});
    });
  }

  function setAmbience(on) {
    if (on && !unlock()) { on = false; }
    status.sfx = !!on;
    if (!ctx) { paintUI(); return; }
    var t = ctx.currentTime;
    ambienceGain.gain.cancelScheduledValues(t);
    ambienceGain.gain.setValueAtTime(Math.max(0.0001, ambienceGain.gain.value), t);
    ambienceGain.gain.linearRampToValueAtTime(on ? clamp(status.sfxVol, 0, 1) : 0.0001, t + 1.2);
    sfxGain.gain.cancelScheduledValues(t);
    sfxGain.gain.setValueAtTime(Math.max(0.0001, sfxGain.gain.value), t);
    sfxGain.gain.linearRampToValueAtTime(on ? clamp(status.sfxVol, 0, 1) : 0.0001, t + 0.7);
    if (on) {
      buildSfxFiles();
      scheduleRustle();
    }
    paintUI();
  }

  function setVolume(kind, value) {
    var v = clamp(value, 0, 1);
    if (kind === "music") {
      status.musicVol = v;
      store("autumn.musicVol", Math.round(v * 100));
      if (fileMusicEl) fileMusicEl.volume = clamp(v * 0.9, 0, 1);
      if (ctx && status.music) {
        musicGain.gain.cancelScheduledValues(ctx.currentTime);
        musicGain.gain.setTargetAtTime(v * 0.95, ctx.currentTime, 0.1);
      }
    } else {
      status.sfxVol = v;
      store("autumn.sfxVol", Math.round(v * 100));
      if (ctx && status.sfx) {
        ambienceGain.gain.setTargetAtTime(v, ctx.currentTime, 0.12);
        sfxGain.gain.setTargetAtTime(v, ctx.currentTime, 0.12);
      }
    }
    paintUI();
  }

  /* -------------------------------------------------------
     Public sound effects
     ------------------------------------------------------- */
  function ready() { return ctx && status.sfx && ctx.state === "running"; }

  function playLittleFile(key, gain) {
    if (!FILES[key]) return false;
    var el = fileCache[FILES[key]];
    if (!el || !el.duration) return false;
    try {
      var c = el.cloneNode();
      c.volume = clamp(status.sfxVol * (gain || 0.8), 0, 1);
      c.play().catch(function () {});
      return true;
    } catch (e) { return false; }
  }

  var api = {
    setMusic: setMusic,
    setSfx: setAmbience,
    setVolume: setVolume,
    status: status,

    uiClick: function () {
      if (!ready()) return;
      if (playLittleFile("click", 0.6)) return;
      noiseBurst({ f0: 2400, f1: 1400, dur: 0.09, gain: 0.02, attack: 0.004, q: 1.2 });
      pluck(880, now(), 0.018, 0.12);
    },

    open: function () {
      if (!ready()) return;
      if (playLittleFile("whoosh", 0.8)) return;
      noiseBurst({ f0: 320, f1: 2400, dur: 0.5, gain: 0.028, attack: 0.18, q: 0.6 });
      bell(midi(81), now() + 0.1, 0.03, 2.4);
      bell(midi(88), now() + 0.28, 0.018, 2.8);
    },

    seed: function () {
      if (!ready()) return;
      pluck(midi(84), now(), 0.028, 0.5);
      pluck(midi(91), now() + 0.06, 0.012, 0.7);
    },

    ground: function () {
      if (!ready()) return;
      noiseBurst({ f0: 700, f1: 380, dur: 0.55, gain: 0.024, attack: 0.06, q: 0.7 });
    },

    trunk: function () {
      if (!ready()) return;
      var t = now();
      var o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(96, t);
      o.frequency.linearRampToValueAtTime(72, t + 1.1);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      o.connect(g); g.connect(sfxGain);
      o.start(t); o.stop(t + 1.6);
      noiseBurst({ f0: 220, f1: 520, dur: 1.1, gain: 0.018, attack: 0.3, type: "lowpass", q: 0.4 });
    },

    leafPop: function (step) {
      if (!ready()) return;
      var scale = [81, 83, 85, 88, 90, 93, 95, 97]; // A major pentatonic-ish sparkle
      var n = scale[(step || 0) % scale.length];
      bell(midi(n + 12), now(), 0.014, 1.4);
    },

    leafWave: function (step) {
      if (!ready()) return;
      var notes = [81, 85, 88, 90];
      var t = now();
      bell(midi(notes[step % notes.length]), t, 0.022, 2.6);
      bell(midi(notes[(step + 1) % notes.length] + 12), t + 0.11, 0.01, 2.2);
    },

    completion: function () {
      if (!ready()) return;
      if (playLittleFile("chime", 0.9)) return;
      var t = now();
      [81, 85, 88, 93].forEach(function (n, i) {
        bell(midi(n), t + i * 0.16, 0.038 - i * 0.003, 3.4);
        bell(midi(n + 12), t + i * 0.16 + 0.03, 0.008, 2.4);
      });
      noiseBurst({ f0: 5200, f1: 7600, dur: 1.2, gain: 0.008, attack: 0.35, q: 0.9 });
    },

    shift: function () {
      if (!ready()) return;
      noiseBurst({ f0: 1600, f1: 500, dur: 0.5, gain: 0.018, attack: 0.12, q: 0.5 });
    },

    typeTick: function () {
      if (!ready()) return;
      if (Math.random() < 0.55) return;
      noiseBurst({ f0: 2800 + Math.random() * 900, dur: 0.035, gain: 0.0075, attack: 0.002, q: 1.4 });
    },

    milestone: function () {
      if (!ready()) return;
      var t = now();
      [88, 93, 97].forEach(function (n, i) {
        bell(midi(n), t + i * 0.18, 0.02, 3.2);
      });
    },

    tapTree: function () {
      if (!ready()) return;
      if (playLittleFile("rustle", 0.8)) {
        bell(midi(93), now() + 0.12, 0.014, 2);
        return;
      }
      noiseBurst({ f0: 2100, f1: 3600, dur: 0.55, gain: 0.026, attack: 0.05, q: 0.8 });
      noiseBurst({ f0: 3600, f1: 1800, dur: 0.8, gain: 0.012, attack: 0.12, q: 0.6 });
      bell(midi(93), now() + 0.16, 0.012, 2.4);
    },

    sfxRustle: sfxRustle
  };

  function sfxRustle(scale, gain) {
    if (!ready()) return;
    if (playLittleFile("rustle", (gain || 0.03) * 12)) return;
    noiseBurst({ f0: 2600 + Math.random() * 1200, f1: 1600, dur: 0.7, gain: gain || 0.024, attack: 0.16, q: 0.7 });
  }

  /* -------------------------------------------------------
     Controls UI
     ------------------------------------------------------- */
  function paintUI() {
    if (!els.musicToggle) return;
    els.musicToggle.setAttribute("aria-checked", String(status.music));
    els.ambToggle.setAttribute("aria-checked", String(status.sfx));
    var live = status.music || status.sfx;
    els.panel.classList.toggle("is-live", live);
    els.status.textContent = live ? "on" : "off";
    els.musicVol.value = Math.round(status.musicVol * 100);
    els.ambVol.value = Math.round(status.sfxVol * 100);
    paintRange(els.musicVol);
    paintRange(els.ambVol);
    els.musicVol.disabled = false;
    els.ambVol.disabled = false;
    els.musicToggle.setAttribute("aria-label", status.music ? "Turn music off" : "Turn music on");
    els.ambToggle.setAttribute("aria-label", status.sfx ? "Turn wind and chimes off" : "Turn wind and chimes on");
    if (els.note) els.note.textContent = live ? "tap the tree for a little flutter" : "sound is off until you switch it on";
  }

  function paintRange(input) {
    var v = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty("--fill", v.toFixed(1) + "%");
  }

  function initUI() {
    els.panel = document.getElementById("soundPanel");
    els.status = document.getElementById("soundStatus");
    els.musicToggle = document.getElementById("musicToggle");
    els.ambToggle = document.getElementById("ambToggle");
    els.musicVol = document.getElementById("musicVol");
    els.ambVol = document.getElementById("ambVol");
    els.note = document.querySelector(".sound__note");
    if (!els.panel) return;

    status.musicVol = clamp(read("autumn.musicVol", 55) / 100, 0, 1);
    status.sfxVol = clamp(read("autumn.sfxVol", 65) / 100, 0, 1);
    paintUI();

    els.musicToggle.addEventListener("click", function () {
      ui2Click();
      setMusic(!status.music);
      if (status.music) api.open(); // a gentle welcome chord the first time
    });
    els.ambToggle.addEventListener("click", function () {
      ui2Click();
      setAmbience(!status.sfx);
    });
    els.musicVol.addEventListener("input", function () {
      setVolume("music", Number(this.value) / 100);
    });
    els.ambVol.addEventListener("input", function () {
      setVolume("sfx", Number(this.value) / 100);
    });
    [els.musicVol, els.ambVol].forEach(function (el) {
      el.addEventListener("change", function () { ui2Click(); });
    });
  }

  function ui2Click() {
    if (!unlock()) return;
    if (!status.sfx) {
      /* tiny confirmation even while chimes are off, only after a click */
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 1320;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.012, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.1);
    }
  }

  document.addEventListener("DOMContentLoaded", initUI);

  window.AutumnAudio = api;
})();