/* =========================================================
   Autumn heart — scene timeline for Angel (မီး)
   Timeline follows the reference video (card opens at t=0):
   0.0 splash · 1.5 seed · 2.0 ground · 2.2 trunk · 3.5 bloom
   5.3 heart complete · 5.7 shift right · 6.3 typewriter
   ========================================================= */
(function () {
  "use strict";

  /* ✏️ The day you two became friends (local time).
     Default: one year before this gift's first opening. */
  var FRIENDSHIP_START = new Date(2026, 2, 24, 7, 22, 0);

  var NS = "http://www.w3.org/2000/svg";
  var reduced = false;
  try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var card, svg, treeRoot, sway, canopyGroup, backLeaves, frontLeaves, canopyGlow;
  var groundLine, story, tTitle, tP1, tP2, tSign, counter, cDays, cHours, cMins, cSecs;
  var uDays, uHours, uMins, uSecs;
  var prelude, openBtn, splash, splashWords, splashEmblem, replayBtn, leafField;
  var growRect, twigsGroup, hitArea;
  var smallScreen = window.matchMedia("(max-width: 720px)").matches;

  var geo = null;
  var runId = 0;
  var opened = false;
  var phase = "idle";            // idle | opening | growing | bloomed | final
  var growRAF = 0;
  var counterTimer = null;
  var lastCounterSec = -1;
  var milestoneFired = false;
  var milestoneTimer = null;
  var fallTimer = null;
  var falling = [];
  var fallRAF = 0;
  var swayRAF = 0;
  var swayBoost = 0;
  var visualAnims = [];
  var pendingResize = false;
  var seedEl = null;

  var TEXT = {
    title: "မီးရေအချိနိတွေကုန်တာအရမ်းမြန်တာဘဲ.",
    p1: "If you have something to say, U can tell me",
    p2: "ဆောင်ဦရဲ့ အလှတရားလိုပြောရလောက်တဲ့ အင်ဂျယ်လေးနဲ့ ဖရန့်ဖြစ်နေတာ ဂုဏ်ယူစရာပါ",
    sign: "— You are safe in my အသုပ်"
  };

  var LEAF_PATHS = [
    /* 0 · pointed leaf */
    "M0 -0.53C0.17 -0.31 0.25 0.06 0.13 0.34C0.04 0.53 -0.17 0.61 -0.31 0.46C-0.49 0.28 -0.47 -0.2 -0.16 -0.45C-0.08 -0.5 -0.02 -0.54 0 -0.53Z",
    /* 1 · elm leaf */
    "M0.02 -0.5C0.3 -0.27 0.46 0.12 0.22 0.4C0 0.62 -0.32 0.54 -0.4 0.26C-0.47 -0.05 -0.26 -0.3 0.02 -0.5Z",
    /* 2 · little maple */
    "M0 -0.55 L0.12 -0.22 L0.34 -0.34 L0.28 -0.08 L0.5 0.02 L0.3 0.16 L0.36 0.38 L0.12 0.3 L0.02 0.56 L-0.08 0.3 L-0.32 0.38 L-0.26 0.16 L-0.46 0.02 L-0.24 -0.08 L-0.3 -0.34 L-0.1 -0.22 Z",
    /* 3 · round leaf */
    "M0 -0.5C0.3 -0.4 0.44 0 0.3 0.3C0.16 0.56 -0.2 0.56 -0.34 0.3C-0.46 0.02 -0.3 -0.4 0 -0.5Z"
  ];

  var PALETTE = [
    ["#f3c34f", 18], ["#eab543", 13], ["#f6d478", 7], ["#e5a23b", 12],
    ["#dd8733", 12], ["#cb6c2d", 11], ["#b9532f", 10], ["#a0432c", 8],
    ["#81332c", 6], ["#622826", 3]
  ];
  var BACK_PALETTE = ["#7c3127", "#8f3b2b", "#5f2823", "#9d482c", "#6d2b25"];

  /* -------------------------------------------------------
     DOM refs
     ------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }

  function cache() {
    card = $("card");
    svg = $("treeSvg");
    groundLine = $("groundLine");
    story = $("story");
    tTitle = $("tTitle");
    tP1 = $("tP1");
    tP2 = $("tP2");
    tSign = $("tSign");
    counter = $("counter");
    cDays = $("cDays"); cHours = $("cHours"); cMins = $("cMins"); cSecs = $("cSecs");
    uDays = $("uDays"); uHours = $("uHours"); uMins = $("uMins"); uSecs = $("uSecs");
    prelude = $("prelude");
    openBtn = $("openGift");
    splash = $("splash");
    splashWords = splash.querySelector(".splash__words");
    splashEmblem = $("splashEmblem");
    replayBtn = $("replay");
    leafField = $("leafField");
    treeRoot = $("treeRoot");
    sway = $("sway");
    canopyGroup = $("canopyGroup");
    backLeaves = $("backLeaves");
    frontLeaves = $("frontLeaves");
    canopyGlow = $("canopyGlow");
    growRect = $("growRect");
    twigsGroup = $("twigsGroup");
    hitArea = $("treeHit");
  }

  /* -------------------------------------------------------
     Small utilities
     ------------------------------------------------------- */
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }

  function sleep(ms, run) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(run === runId); }, ms);
    });
  }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function weightedColor() {
    var total = 0, i;
    for (i = 0; i < PALETTE.length; i++) total += PALETTE[i][1];
    var r = Math.random() * total;
    for (i = 0; i < PALETTE.length; i++) {
      r -= PALETTE[i][1];
      if (r <= 0) return PALETTE[i][0];
    }
    return PALETTE[0][0];
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function trackAnim(a) { if (a) visualAnims.push(a); return a; }

  function cancelAnims() {
    visualAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    visualAnims = [];
  }

  /* -------------------------------------------------------
     Heart geometry
     ------------------------------------------------------- */
  var HEART_W = 287, HEART_H = 279, HEART_BOTTOM = -45;
  var HEART_CX = 0, HEART_CY = HEART_BOTTOM - HEART_H / 2;

  function heartOutline(n) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var t = (i / n) * Math.PI * 2;
      var xr = 16 * Math.pow(Math.sin(t), 3);
      var yr = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([xr * (HEART_W / 32), HEART_BOTTOM - (yr + 17) * (HEART_H / 29)]);
    }
    return pts;
  }

  function inPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1];
      var xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  var heartPoly = heartOutline(260);
  var heartWidePoly = heartPoly.map(function (p) {
    return [HEART_CX + (p[0] - HEART_CX) * 1.06, HEART_CY + (p[1] - HEART_CY) * 1.05];
  });

  /* make sure the canopy touches the trunk with a few clusters */
  function sampleHeartPoint(nearEdge) {
    for (var tries = 0; tries < 60; tries++) {
      var x = rand(-HEART_W * 0.54, HEART_W * 0.54);
      var y = rand(HEART_BOTTOM - HEART_H * 1.03, HEART_BOTTOM + 4);
      var inside = inPoly(x, y, heartPoly);
      if (nearEdge) {
        if (!inside && inPoly(x, y, heartWidePoly)) return [x, y];
      } else if (inside) {
        return [x, y];
      }
    }
    return [rand(-HEART_W * 0.3, HEART_W * 0.3), HEART_CY];
  }

  /* -------------------------------------------------------
     Tree construction
     ------------------------------------------------------- */
  var TRUNK_PATH =
    "M -16 6 " +
    "C -15 -48 -11 -96 -8 -140 " +
    "C -6 -172 -3 -198 -5 -228 " +
    "C -8 -256 -7 -286 -14 -311 " +
    "L -10 -314 " +
    "C -2 -288 4 -260 6 -235 " +
    "C 9 -260 15 -281 24 -296 " +
    "L 26 -291 " +
    "C 18 -273 12 -250 10 -229 " +
    "C 13 -213 20 -198 30 -185 " +
    "L 27 -181 " +
    "C 17 -191 10 -204 7 -218 " +
    "C 6 -188 8 -158 10 -132 " +
    "C 14 -94 19 -50 21 6 Z";

  var MAIN_BRANCHES = [
    "M -8 -181 C -36 -191 -57 -199 -76 -211 L -72 -214 C -55 -200 -33 -190 -10 -176 Z",
    "M -11 -120 C -33 -126 -52 -133 -67 -142 L -64 -137 C -46 -127 -29 -119 -12 -112 Z",
    "M 8 -148 C 29 -150 46 -158 60 -169 L 58 -164 C 44 -152 26 -143 9 -138 Z",
    "M 5 -206 C 21 -211 34 -220 44 -231 L 43 -226 C 34 -213 20 -202 7 -198 Z",
    "M -6 -243 C -25 -256 -40 -271 -49 -285 L -46 -282 C -36 -266 -22 -251 -3 -238 Z"
  ];

  var TWIGS = [
    "M -2 -228 C -24 -252 -48 -262 -74 -266",
    "M 6 -238 C 32 -266 56 -277 80 -281",
    "M -4 -258 C -14 -282 -11 -299 -2 -308",
    "M 4 -250 C 37 -253 67 -246 92 -235",
    "M -9 -205 C -42 -218 -65 -234 -84 -252",
    "M 8 -195 C 42 -202 69 -214 88 -230",
    "M 0 -272 C 22 -287 42 -297 56 -304",
    "M -6 -160 C -34 -169 -55 -182 -70 -196"
  ];

  function buildTree(instant) {
    if (!card) return;
    var W = card.clientWidth || 1;
    var H = card.clientHeight || 1;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";

    var scale = (W * 0.49) / HEART_W;
    var baseX = W * 0.487;
    var groundY = H * 0.908;
    geo = { W: W, H: H, scale: scale, baseX: baseX, groundY: groundY, shiftX: W * (0.69 - 0.487) };

    var defs = svgEl("defs", {}, svg);

    var trunkGrad = svgEl("linearGradient", { id: "trunkGrad", x1: "0", y1: "0", x2: "1", y2: "0" }, defs);
    [["0%", "#8b4f20"], ["38%", "#753e16"], ["72%", "#5e3010"], ["100%", "#4b250b"]].forEach(function (s) {
      svgEl("stop", { offset: s[0], "stop-color": s[1] }, trunkGrad);
    });

    var glow = svgEl("radialGradient", { id: "canopyGradient" }, defs);
    [["0%", "#ffc478", ".30"], ["45%", "#f0a050", ".16"], ["100%", "#dc823c", "0"]].forEach(function (s) {
      svgEl("stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] }, glow);
    });

    var lip = svgEl("radialGradient", { id: "leafGlow" }, defs);
    svgEl("stop", { offset: "0%", "stop-color": "#ffd08a", "stop-opacity": ".55" }, lip);
    svgEl("stop", { offset: "100%", "stop-color": "#ffb35f", "stop-opacity": "0" }, lip);

    var clip = svgEl("clipPath", { id: "growClip" }, defs);
    growRect = svgEl("rect", { id: "growRect", x: "-260", y: "-340", width: "520", height: "0" }, clip);

    LEAF_PATHS.forEach(function (d, i) {
      var g = svgEl("g", { id: "leafShape" + i }, defs);
      svgEl("path", { d: d }, g);
      svgEl("path", {
        d: "M0 -0.36 L0 0.44",
        fill: "none", stroke: "rgba(74,28,10,.32)", "stroke-width": "0.045",
        "stroke-linecap": "round"
      }, g);
    });

    treeRoot = svgEl("g", {
      id: "treeRoot",
      transform: "translate(" + baseX + " " + groundY + ") scale(" + scale + ")"
    }, svg);

    sway = svgEl("g", { id: "sway" }, treeRoot);

    canopyGlow = svgEl("ellipse", {
      id: "canopyGlow", cx: 0, cy: HEART_CY - 10,
      rx: 180, ry: 172, fill: "url(#canopyGradient)", opacity: 0
    }, sway);

    canopyGroup = svgEl("g", { id: "canopyGroup" }, sway);

    backLeaves = svgEl("g", { id: "backLeaves" }, canopyGroup);

    var clipG = svgEl("g", { id: "branchesClip", "clip-path": "url(#growClip)" }, sway);
    var trunk = svgEl("path", { d: TRUNK_PATH, fill: "url(#trunkGrad)" }, clipG);
    trunk.style.opacity = ".98";
    var branchPath = MAIN_BRANCHES.join(" ");
    svgEl("path", { d: branchPath, fill: "url(#trunkGrad)" }, clipG);
    /* bark light */
    svgEl("path", {
      d: "M -14 0 C -13 -50 -9 -98 -6 -142 C -4 -174 -1 -202 -3 -228",
      fill: "none", stroke: "rgba(255,205,150,.16)", "stroke-width": "2.4", "stroke-linecap": "round"
    }, clipG);

    twigsGroup = svgEl("g", { id: "twigsGroup" }, sway);
    twigsGroup.style.opacity = "0";
    TWIGS.forEach(function (d) {
      var p = svgEl("path", {
        d: d, fill: "none", stroke: "#5b3418", "stroke-width": "2.1",
        "stroke-linecap": "round", opacity: ".62"
      }, twigsGroup);
      if (!instant) {
        try {
          var len = p.getTotalLength();
          p.style.strokeDasharray = len + " px";
          p.style.strokeDashoffset = len + " px";
        } catch (e) {}
      }
    });

    frontLeaves = svgEl("g", { id: "frontLeaves" }, canopyGroup);

    hitArea = svgEl("circle", {
      id: "treeHit", cx: 0, cy: HEART_CY, r: 152, fill: "transparent",
      "pointer-events": "none"
    }, sway);

    var glows = svgEl("g", { id: "leafGlows", opacity: 0 }, canopyGroup);
    canopyGroup.insertBefore(glows, frontLeaves);

    createLeaves(instant, glows);

    hitArea.addEventListener("pointerdown", function (e) {
      if (phase !== "final" && phase !== "typing") return;
      e.preventDefault();
      swayBoost = Math.min(1.6, swayBoost + 1.15);
      if (window.AutumnAudio) window.AutumnAudio.tapTree();
      spawnBurst(7);
    });

    /* branches live behind the blooming leaves; the trunk base stays visible below */
    sway.insertBefore(clipG, canopyGroup);
    sway.insertBefore(twigsGroup, canopyGroup);

    if (instant) {
      growRect.setAttribute("y", "-340");
      growRect.setAttribute("height", "340");
      canopyGlow.setAttribute("opacity", ".9");
      twigsGroup.style.opacity = "1";
      glows.setAttribute("opacity", ".85");
    } else {
      growRect.setAttribute("y", "0");
      growRect.setAttribute("height", "0");
    }
  }

  function createLeaves(instant, glows) {
    var clusters = 218;
    var placed = 0;
    var tries = 0;

    function addLeaf(x, y, back) {
      var shape = Math.random() < 0.44 ? 0 : (Math.random() < 0.62 ? 1 : (Math.random() < 0.5 ? 3 : 2));
      var size = back ? rand(22, 32) : rand(17, 28);
      var rot = rand(0, 360);
      var color = back ? pick(BACK_PALETTE) : weightedColor();
      var op = back ? rand(0.82, 0.96) : rand(0.84, 1);

      var holder = svgEl("g", { transform: "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + rot.toFixed(0) + ")" }, back ? backLeaves : frontLeaves);
      var pop = svgEl("g", { "class": "leaf-pop" }, holder);
      pop.dataset.y = y.toFixed(1);
      pop.dataset.back = back ? "1" : "0";
      svgEl("use", {
        href: "#leafShape" + shape,
        transform: "scale(" + size.toFixed(1) + ")",
        fill: color,
        opacity: op
      }, pop);

      if (!back && Math.random() < 0.1 && glows) {
        svgEl("circle", {
          cx: x, cy: y, r: size * 0.9, fill: "url(#leafGlow)", opacity: ".5"
        }, glows);
      }

      if (instant) {
        pop.style.opacity = "1";
        pop.style.transform = "scale(1)";
      } else {
        pop.style.opacity = "0";
        pop.style.transform = "scale(.04)";
      }
    }

    /* shade layer, slightly larger and deeper */
    for (var b = 0; b < 64; b++) {
      var pb = sampleHeartPoint(false);
      if (!pb) continue;
      addLeaf(pb[0] + rand(-4, 4), pb[1] + rand(-4, 4), true);
    }

    /* main clusters */
    while (placed < clusters && tries < 5200) {
      tries++;
      var pt = sampleHeartPoint(Math.random() < 0.16);
      var nearTrunk = pt[1] > HEART_BOTTOM - 26 && Math.abs(pt[0]) < 34;
      if (nearTrunk) continue;
      var n = Math.random() < 0.62 ? 1 : 2;
      for (var k = 0; k < n; k++) {
        addLeaf(
          pt[0] + rand(-9, 9) * (k ? 1.6 : 1),
          pt[1] + rand(-9, 9) * (k ? 1.6 : 1),
          false
        );
      }
      placed++;
    }

    /* a few leaves spill over the lower heart edge (organic silhouette) */
    for (var s = 0; s < 8; s++) {
      var ps = sampleHeartPoint(true);
      addLeaf(ps[0], ps[1], false);
    }
  }

  function startBloom() {
    [backLeaves, frontLeaves].forEach(function (layer) {
      if (!layer) return;
      layer.querySelectorAll(".leaf-pop").forEach(function (pop) {
        var y = Number(pop.dataset.y) || HEART_CY;
        var back = pop.dataset.back === "1";
        var progress = Math.min(1, Math.max(0, (HEART_BOTTOM - y) / HEART_H));
        var delay = (progress * 950 + Math.random() * 450) * (back ? 0.8 : 1);
        var a = pop.animate(
          [
            { opacity: 0, transform: "scale(.03) rotate(-24deg)" },
            { opacity: 1, transform: "scale(1.14) rotate(6deg)", offset: 0.72 },
            { opacity: 1, transform: "scale(1) rotate(0deg)" }
          ],
          {
            duration: back ? 700 : 620,
            delay: delay,
            easing: "cubic-bezier(.2,.85,.3,1.25)",
            fill: "both"
          }
        );
        trackAnim(a);
      });
    });
  }

  /* -------------------------------------------------------
     Splash + seed
     ------------------------------------------------------- */
  function resetSplash() {
    splash.style.display = "";
    splash.style.opacity = "";
    splash.classList.remove("is-hidden");
    splashWords.classList.remove("is-on");
    splashEmblem.style.transform = "";
    splashEmblem.style.opacity = "";
  }

  async function introSequence(run) {
    await sleep(100, run);
    if (run !== runId) return false;
    splashWords.classList.add("is-on");

    await sleep(840, run);
    if (run !== runId) return false;

    var wa = splashWords.animate(
      [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(-8px)" }],
      { duration: 320, easing: "ease-in", fill: "forwards" }
    );
    trackAnim(wa);
    await sleep(260, run);
    if (run !== runId) return false;

    /* shrink the emblem toward the center as the seed drops */
    var r = splashEmblem.getBoundingClientRect();
    var cr = card.getBoundingClientRect();
    var dx = cr.left + cr.width / 2 - (r.left + r.width / 2);
    var dy = cr.top + cr.height * 0.47 - (r.top + r.height / 2);
    var shrink = splashEmblem.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: "translate(" + dx + "px," + dy + "px) scale(.14)", opacity: .85 }
      ],
      { duration: 420, easing: "cubic-bezier(.5,0,.7,.3)", fill: "forwards" }
    );
    trackAnim(shrink);
    await sleep(40, run);
    if (run !== runId) return false;

    var seedPromise = dropSeed(run);
    await sleep(430, run);
    if (run !== runId) return false;
    splash.classList.add("is-hidden");
    return await seedPromise;
  }

  function dropSeed(run) {
    return new Promise(function (resolve) {
      var W = card.clientWidth, H = card.clientHeight;
      var startY = H * 0.47;
      var fall = Math.max(12, H * 0.908 - startY - 4);
      seedEl = document.createElement("div");
      seedEl.className = "seed";
      seedEl.style.position = "absolute";
      seedEl.style.left = (W / 2) + "px";
      seedEl.style.top = startY + "px";
      seedEl.style.width = Math.max(9, W * 0.018) + "px";
      seedEl.style.height = seedEl.style.width;
      seedEl.style.zIndex = "10";
      seedEl.style.pointerEvents = "none";
      seedEl.style.willChange = "transform, opacity";
      seedEl.innerHTML =
        '<svg viewBox="-0.7 -0.7 1.4 1.4" style="width:100%;height:100%;display:block;overflow:visible">' +
        '<path d="' + LEAF_PATHS[1] + '" fill="#e7ae3f"/>' +
        '<path d="M0 -0.5 C0.06 0.05 0.03 0.28 0 0.55" fill="none" stroke="#7c3a14" stroke-width="0.06" stroke-linecap="round"/>' +
        '</svg>';
      card.appendChild(seedEl);

      var a = seedEl.animate(
        [
          { transform: "translate(-50%,-50%) translateY(0) scale(.55)", opacity: 0 },
          { transform: "translate(-50%,-50%) translateY(0) scale(1)", opacity: 1, offset: 0.16 },
          { transform: "translate(-50%,-50%) translateY(" + fall + "px) scale(1)", opacity: 1, offset: 0.9 },
          { transform: "translate(-50%,-50%) translateY(" + fall + "px) scale(1.3,.55)", opacity: 1 }
        ],
        { duration: 520, easing: "cubic-bezier(.4,.02,.75,.9)" }
      );
      trackAnim(a);

      var done = false;
      function land() {
        if (done) return;
        done = true;
        if (run !== runId) { resolve(false); return; }
        if (window.AutumnAudio) window.AutumnAudio.seed();
        var fade = seedEl.animate(
          [{ opacity: 1, offset: 0 }, { opacity: 1, offset: .45 }, { opacity: 0 }],
          { duration: 360, fill: "forwards" }
        );
        trackAnim(fade);
        resolve(true);
        setTimeout(function () {
          if (seedEl) { seedEl.remove(); seedEl = null; }
        }, 380);
      }
      a.onfinish = land;
      setTimeout(land, 700);
    });
  }

  /* -------------------------------------------------------
     Ground, trunk, branches
     ------------------------------------------------------- */
  function drawGround() {
    if (window.AutumnAudio) window.AutumnAudio.ground();
    groundLine.classList.remove("is-on");
    void groundLine.offsetWidth;
    groundLine.classList.add("is-on");
  }

  function animateTrunk(run) {
    return new Promise(function (resolve) {
      var dur = 1000;
      var start = performance.now();
      if (window.AutumnAudio) window.AutumnAudio.trunk();
      function frame(now) {
        if (run !== runId) { resolve(false); return; }
        var p = Math.max(0, Math.min(1, (now - start) / dur));
        var e = easeOutCubic(p);
        var h = 340 * e;
        growRect.setAttribute("y", (-h).toFixed(2));
        growRect.setAttribute("height", h.toFixed(2));
        if (p < 1) growRAF = requestAnimationFrame(frame);
        else resolve(true);
      }
      growRAF = requestAnimationFrame(frame);
    });
  }

  function revealTwigs(run) {
    return new Promise(function (resolve) {
      twigsGroup.style.transition = "opacity .4s ease";
      twigsGroup.style.opacity = "1";
      var paths = twigsGroup.querySelectorAll("path");
      paths.forEach(function (p, i) {
        p.style.transition = "stroke-dashoffset " + (520 + i * 40) + "ms cubic-bezier(.3,.7,.3,1) " + (i * 55) + "ms";
        p.style.strokeDashoffset = "0";
      });
      setTimeout(function () { resolve(run === runId); }, 700);
    });
  }

  /* -------------------------------------------------------
     Bloom
     ------------------------------------------------------- */
  function bloomCanopy(run) {
    return new Promise(function (resolve) {
      startBloom();
      var glowEl = card.querySelector("#leafGlows");
      if (glowEl) {
        trackAnim(glowEl.animate([{ opacity: 0 }, { opacity: .9 }], { duration: 1500, fill: "forwards", delay: 250 }));
      }
      if (canopyGlow) {
        trackAnim(canopyGlow.animate([{ opacity: 0 }, { opacity: .95 }], { duration: 1600, fill: "forwards", delay: 350 }));
      }
      [250, 780, 1250, 1650].forEach(function (d, i) {
        setTimeout(function () {
          if (run === runId && window.AutumnAudio) window.AutumnAudio.leafWave(i);
        }, d);
      });
      setTimeout(function () { resolve(run === runId); }, 1850);
    });
  }

  function completionFlash() {
    var W = card.clientWidth, H = card.clientHeight;
    var d = document.createElement("div");
    d.style.cssText = "position:absolute;left:50%;top:" + (H * 0.47) + "px;width:" + (W * 0.9) + "px;height:" + (W * 0.9) + "px;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;z-index:3;background:radial-gradient(closest-side, rgba(255,205,130,.32), rgba(255,170,80,0) 70%);opacity:0";
    card.appendChild(d);
    var a = d.animate(
      [{ opacity: 0, transform: "translate(-50%,-50%) scale(.72)" },
       { opacity: 1, transform: "translate(-50%,-50%) scale(.95)", offset: .35 },
       { opacity: 0, transform: "translate(-50%,-50%) scale(1.1)" }],
      { duration: 1700, easing: "ease-out" }
    );
    trackAnim(a);
    setTimeout(function () { d.remove(); }, 1800);
  }

  /* -------------------------------------------------------
     Layout shift + counter
     ------------------------------------------------------- */
  function shiftTree(run) {
    if (window.AutumnAudio) window.AutumnAudio.shift();
    var fromX = geo.baseX;
    var toX = geo.baseX + geo.shiftX;
    var start = performance.now();
    function step(now) {
      if (run !== runId) return;
      var p = Math.max(0, Math.min(1, (now - start) / 620));
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      var x = fromX + (toX - fromX) * e;
      treeRoot.setAttribute("transform", "translate(" + x + " " + geo.groundY + ") scale(" + geo.scale + ")");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    if (hitArea) {
      hitArea.setAttribute("pointer-events", "all");
      hitArea.style.cursor = "pointer";
    }
    setTimeout(function () {
      if (run !== runId) return;
      story.classList.add("is-on");
    }, 130);
  }

  function setCounter(startDate) {
    var nowMs = Date.now();
    var secs = Math.max(0, Math.floor((nowMs - startDate.getTime()) / 1000));
    var days = Math.floor(secs / 86400);
    var h = Math.floor((secs % 86400) / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;
    cDays.textContent = String(days);
    cHours.textContent = (h < 10 ? "0" : "") + h;
    cMins.textContent = (m < 10 ? "0" : "") + m;
    cSecs.textContent = (s < 10 ? "0" : "") + s;
    uDays.textContent = days === 1 ? "day" : "days";
    uHours.textContent = "h";
    uMins.textContent = "m";
    uSecs.textContent = "s";

    if (!milestoneFired) {
      var today = new Date();
      var anniversary = today.getMonth() === startDate.getMonth()
        && today.getDate() === startDate.getDate()
        && today.getFullYear() > startDate.getFullYear();
      if (days === 365 || anniversary) {
        milestoneFired = true;
        counter.classList.add("is-milestone");
        if (window.AutumnAudio) window.AutumnAudio.milestone();
        milestoneTimer = setTimeout(function () { counter.classList.remove("is-milestone"); }, 6000);
      }
    }
    return secs;
  }

  function startCounter() {
    if (counterTimer) clearInterval(counterTimer);
    lastCounterSec = -1;
    setCounter(FRIENDSHIP_START);
    counterTimer = setInterval(function () {
      var secs = setCounter(FRIENDSHIP_START);
      lastCounterSec = secs;
    }, 1000);
  }

  /* -------------------------------------------------------
     Typewriter
     ------------------------------------------------------- */
  function makeCaret() {
    var c = document.createElement("span");
    c.className = "caret";
    c.textContent = "_";
    c.setAttribute("aria-hidden", "true");
    return c;
  }

  async function typeBlock(el, text, run, keepCaret) {
    el.textContent = "";
    var caret = makeCaret();
    el.appendChild(caret);
    for (var i = 0; i < text.length; i++) {
      if (run !== runId) return false;
      caret.insertAdjacentText("beforebegin", text.charAt(i));
      var ch = text.charAt(i);
      var delay = 30;
      if (ch === "," || ch === ":" || ch === "—") delay = 150;
      if (ch === "." || ch === "!") delay = 220;
      if (i % 4 === 2 && window.AutumnAudio) window.AutumnAudio.typeTick();
      await sleep(delay, run);
      if (run !== runId) return false;
    }
    if (!keepCaret) { try { caret.remove(); } catch (e) {} }
    return true;
  }

  async function tellStory(run) {
    if (!await typeBlock(tTitle, TEXT.title, run, false)) return;
    await sleep(420, run);
    if (run !== runId) return;
    if (!await typeBlock(tP1, TEXT.p1, run, false)) return;
    await sleep(380, run);
    if (run !== runId) return;
    if (!await typeBlock(tP2, TEXT.p2, run, false)) return;
    await sleep(440, run);
    if (run !== runId) return;
    await typeBlock(tSign, TEXT.sign, run, true);
    phase = "final";
    await sleep(520, run);
    if (run !== runId) return;
    counter.classList.add("is-on");
    startCounter();
    settleResize();
  }

  /* -------------------------------------------------------
     Falling leaves
     ------------------------------------------------------- */
  function makeFallingEl(size, color) {
    var el = document.createElementNS(NS, "svg");
    el.setAttribute("viewBox", "-0.7 -0.7 1.4 1.4");
    el.setAttribute("class", "falling-leaf");
    el.style.setProperty("--s", size.toFixed(1) + "px");
    el.style.setProperty("--c", color);
    el.innerHTML =
      '<path d="' + LEAF_PATHS[Math.floor(Math.random() * LEAF_PATHS.length)] + '" fill="currentColor"/>' +
      '<path d="M0 -0.36 L0 0.44" fill="none" stroke="rgba(70,26,10,.32)" stroke-width="0.05" stroke-linecap="round"/>';
    return el;
  }

  function spawnLeaf(x, y, burst) {
    if (falling.length > 16) return;
    var size = rand(9, 16) * (smallScreen ? 0.92 : 1);
    var el = makeFallingEl(size, weightedColor());
    el.style.opacity = "0";
    leafField.appendChild(el);
    var state = {
      el: el,
      x: x, y: y,
      vy: burst ? rand(26, 46) : rand(16, 32),
      drift: rand(-10, 22),
      amp: rand(8, 26),
      freq: rand(0.0007, 0.0016),
      phase: rand(0, 6.28),
      rot: rand(0, 360),
      vr: rand(-40, 60),
      life: 0,
      alpha: rand(0.72, 1)
    };
    el.style.transform = "translate(" + x + "px," + y + "px) rotate(" + state.rot + "deg)";
    falling.push(state);
    if (!fallRAF) fallRAF = requestAnimationFrame(fallTick);
  }

  function fallTick(now) {
    if (!falling.length) { fallRAF = 0; return; }
    var dt = Math.min(0.05, (now - (fallTick.last || now)) / 1000);
    fallTick.last = now;
    if (!dt) dt = 0.016;
    var groundY = (geo ? geo.groundY : card.clientHeight * 0.9);
    for (var i = falling.length - 1; i >= 0; i--) {
      var l = falling[i];
      l.life += dt;
      l.vy += 6 * dt;
      l.y += l.vy * dt;
      l.x += (Math.sin(now * l.freq + l.phase) * l.amp + l.drift) * dt;
      l.rot += l.vr * dt;
      var fadeStart = groundY - 34;
      var alpha = l.alpha;
      if (l.y > fadeStart) alpha *= Math.max(0, 1 - (l.y - fadeStart) / 34);
      if (l.life < 0.3) alpha *= l.life / 0.3;
      l.el.style.opacity = alpha.toFixed(2);
      l.el.style.transform =
        "translate(" + l.x.toFixed(1) + "px," + l.y.toFixed(1) + "px) rotate(" + l.rot.toFixed(1) + "deg)";
      if (l.y > groundY + 6 || alpha <= 0.01) {
        l.el.remove();
        falling.splice(i, 1);
      }
    }
    fallRAF = requestAnimationFrame(fallTick);
  }

  function startFalling(run) {
    stopFalling();
    var cx = geo.baseX + geo.shiftX;
    var halfW = HEART_W * geo.scale * 0.46;
    var top = HEART_CY * geo.scale;
    function spawnOne(burst) {
      if (run !== runId) return;
      var x = cx + rand(-halfW, halfW);
      var y = geo.groundY + top + rand(-40, 70) * geo.scale;
      spawnLeaf(Math.min(card.clientWidth - 18, Math.max(18, x)), Math.max(card.clientHeight * 0.28, y), burst);
    }
    for (var i = 0; i < 4; i++) setTimeout(function () { spawnOne(true); }, 240 * i);
    fallTimer = setInterval(function () { spawnOne(false); }, 1050);
  }

  function stopFalling() {
    if (fallTimer) { clearInterval(fallTimer); fallTimer = null; }
    falling.forEach(function (l) { l.el.remove(); });
    falling = [];
    if (fallRAF) { cancelAnimationFrame(fallRAF); fallRAF = 0; }
  }

  function spawnBurst(n) {
    if (!geo) return;
    var cx = geo.baseX + geo.shiftX;
    var halfW = HEART_W * geo.scale * 0.4;
    for (var i = 0; i < n; i++) {
      setTimeout(function () {
        spawnLeaf(cx + rand(-halfW, halfW), geo.groundY + HEART_CY * geo.scale + rand(-40, 30), true);
      }, i * 60);
    }
  }

  /* -------------------------------------------------------
     Sway loop
     ------------------------------------------------------- */
  function startSway() {
    if (swayRAF) return;
    var t0 = performance.now();
    function frame(now) {
      var t = (now - t0) / 1000;
      swayBoost *= 0.991;
      if (reduced) {
        sway.setAttribute("transform", "rotate(0 0 0)");
        canopyGroup.setAttribute("transform", "rotate(0 0 -70)");
      } else {
        var a = Math.sin(t * 0.55) * 0.5 + Math.sin(t * 1.6 + 1) * 0.08 + Math.sin(t * 2.4) * swayBoost * 0.6;
        sway.setAttribute("transform", "rotate(" + a.toFixed(3) + " 0 0)");
        var b = Math.sin(t * 0.8 + 0.6) * 0.34 + Math.sin(t * 1.9) * 0.05;
        canopyGroup.setAttribute("transform", "rotate(" + b.toFixed(3) + " 0 -70)");
      }
      swayRAF = requestAnimationFrame(frame);
    }
    swayRAF = requestAnimationFrame(frame);
  }

  /* -------------------------------------------------------
     Reset & final states
     ------------------------------------------------------- */
  function clearStory() {
    [tTitle, tP1, tP2, tSign].forEach(function (el) { el.textContent = ""; });
    story.classList.remove("is-on");
    counter.classList.remove("is-on", "is-milestone");
  }

  function resetScene() {
    runId++;
    phase = "idle";
    if (growRAF) { cancelAnimationFrame(growRAF); growRAF = 0; }
    cancelAnims();
    stopFalling();
    if (counterTimer) { clearInterval(counterTimer); counterTimer = null; }
    if (milestoneTimer) { clearTimeout(milestoneTimer); milestoneTimer = null; }
    milestoneFired = false;
    if (seedEl) { seedEl.remove(); seedEl = null; }
    clearStory();
    resetSplash();
    groundLine.classList.remove("is-on");
    if (replayBtn) replayBtn.disabled = !opened;
    buildTree(false);
    swayBoost = 0;
    var glows = card.querySelector("#leafGlows");
    if (glows) glows.setAttribute("opacity", "0");
    if (canopyGlow) canopyGlow.setAttribute("opacity", "0");
    if (twigsGroup) {
      twigsGroup.style.opacity = "0";
      twigsGroup.querySelectorAll("path").forEach(function (p) {
        p.style.transition = "none";
        try { p.style.strokeDashoffset = p.getTotalLength() + "px"; } catch (e) {}
      });
    }
    if (hitArea) {
      hitArea.setAttribute("pointer-events", "none");
      hitArea.style.cursor = "";
    }
    if (treeRoot) {
      treeRoot.setAttribute("transform", "translate(" + geo.baseX + " " + geo.groundY + ") scale(" + geo.scale + ")");
    }
  }

  function finishInstantly() {
    runId++;
    cancelAnims();
    if (growRAF) { cancelAnimationFrame(growRAF); growRAF = 0; }
    splash.classList.add("is-hidden");
    if (seedEl) { seedEl.remove(); seedEl = null; }
    buildTree(true);
    groundLine.classList.add("is-on");
    twigsGroup.style.opacity = "1";
    treeRoot.setAttribute("transform", "translate(" + (geo.baseX + geo.shiftX) + " " + geo.groundY + ") scale(" + geo.scale + ")");
    tTitle.textContent = TEXT.title;
    tP1.textContent = TEXT.p1;
    tP2.textContent = TEXT.p2;
    tSign.textContent = TEXT.sign;
    var c = makeCaret(); c.style.animation = "none"; tSign.appendChild(c);
    story.classList.add("is-on");
    counter.classList.add("is-on");
    startCounter();
    if (hitArea) {
      hitArea.setAttribute("pointer-events", "all");
      hitArea.style.cursor = "pointer";
    }
    phase = "final";
    pendingResize = false;
  }

  function settleResize() {
    if (!pendingResize) return;
    pendingResize = false;
    if (phase === "final") finishInstantly();
  }

  /* -------------------------------------------------------
     Main timeline
     ------------------------------------------------------- */
  async function runTimeline() {
    var run = ++runId;
    phase = "opening";
    if (reduced) {
      await sleep(240, run);
      if (run !== runId) return;
      finishInstantly();
      return;
    }
    if (!await introSequence(run)) return;
    phase = "growing";
    drawGround();
    await sleep(240, run);
    if (run !== runId) return;
    if (!await animateTrunk(run)) return;
    await revealTwigs(run);
    if (run !== runId) return;
    await sleep(300, run);
    if (run !== runId) return;

    phase = "bloomed";
    var bloomP = bloomCanopy(run);
    await bloomP;
    if (run !== runId) return;
    if (window.AutumnAudio) window.AutumnAudio.completion();
    completionFlash();
    startSway();
    startFalling(run);

    await sleep(380, run);
    if (run !== runId) return;
    shiftTree(run);
    await sleep(640, run);
    if (run !== runId) return;
    phase = "typing";
    await tellStory(run);
  }

  /* -------------------------------------------------------
     Open / replay
     ------------------------------------------------------- */
  function openGift() {
    if (opened) return;
    opened = true;
    prelude.classList.add("is-gone");
    setTimeout(function () { prelude.style.display = "none"; }, 420);
    card.classList.remove("is-closed");
    card.setAttribute("tabindex", "-1");
    try { card.focus({ preventScroll: true }); } catch (e) {}
    if (replayBtn) replayBtn.disabled = false;
    if (window.AutumnAudio) window.AutumnAudio.open();
    setTimeout(function () {
      if (!opened) return;
      runTimeline();
    }, 300);
  }

  function replay() {
    if (!opened) return;
    resetScene();
    if (window.AutumnAudio) window.AutumnAudio.open();
    setTimeout(function () { runTimeline(); }, 200);
  }

  /* -------------------------------------------------------
     Ambient background
     ------------------------------------------------------- */
  function buildAmbient() {
    var bokeh = $("bokeh");
    var bgLeaves = $("bgLeaves");
    if (!bokeh || !bgLeaves) return;
    var colors = [
      ["#ffe0ae", "#d97b3f"], ["#ffc58a", "#c65b34"],
      ["#f7b97e", "#a9412c"], ["#ffdfbd", "#e08c4a"]
    ];
    var n = reduced ? 4 : 17;
    for (var i = 0; i < n; i++) {
      var d = document.createElement("span");
      d.className = "bokeh-dot";
      var size = rand(6, 46);
      var c = pick(colors);
      d.style.width = size.toFixed(0) + "px";
      d.style.height = size.toFixed(0) + "px";
      d.style.left = rand(0, 100).toFixed(1) + "%";
      d.style.top = (i < 4 ? rand(0, 26) : rand(0, 92)).toFixed(1) + "%";
      d.style.setProperty("--c1", c[0]);
      d.style.setProperty("--c2", c[1]);
      d.style.setProperty("--o", rand(0.08, 0.4).toFixed(2));
      d.style.setProperty("--blur", rand(1, 6).toFixed(1) + "px");
      d.style.setProperty("--dx", rand(-26, 26).toFixed(0) + "px");
      d.style.setProperty("--dy", rand(-34, 8).toFixed(0) + "px");
      d.style.setProperty("--dur", rand(7, 16).toFixed(1) + "s");
      d.style.setProperty("--delay", rand(-8, 0).toFixed(1) + "s");
      bokeh.appendChild(d);
    }

    if (!reduced) {
      for (var j = 0; j < 12; j++) {
        var s = document.createElementNS(NS, "svg");
        s.setAttribute("viewBox", "-0.7 -0.7 1.4 1.4");
        s.setAttribute("class", "bg-leaf");
        var col = pick(["#f3b46a", "#dd8a46", "#b55a37", "#e7a254"]);
        s.style.setProperty("--x", rand(2, 96).toFixed(1) + "%");
        s.style.setProperty("--s", rand(16, 40).toFixed(0) + "px");
        s.style.setProperty("--o", rand(0.07, 0.2).toFixed(2));
        s.style.setProperty("--c", col);
        s.style.setProperty("--dx", rand(-40, 70).toFixed(0) + "px");
        s.style.setProperty("--rot", rand(140, 380).toFixed(0) + "deg");
        s.style.setProperty("--dur", rand(22, 42).toFixed(1) + "s");
        s.style.setProperty("--delay", rand(-40, 0).toFixed(1) + "s");
        s.style.setProperty("--blur", rand(0, 1.6).toFixed(1) + "px");
        s.innerHTML = '<path d="' + LEAF_PATHS[j % LEAF_PATHS.length] + '" fill="currentColor"/>';
        bgLeaves.appendChild(s);
      }
    }
  }

  /* -------------------------------------------------------
     Resize
     ------------------------------------------------------- */
  var resizeTO = 0;
  function onResize() {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(function () {
      smallScreen = window.matchMedia("(max-width: 720px)").matches;
      if (phase === "idle") {
        buildTree(false);
      } else if (phase === "final") {
        var full = tSign.textContent.length > 0;
        buildTree(true);
        if (full) {
          treeRoot.setAttribute("transform", "translate(" + (geo.baseX + geo.shiftX) + " " + geo.groundY + ") scale(" + geo.scale + ")");
          if (hitArea) {
            hitArea.setAttribute("pointer-events", "all");
            hitArea.style.cursor = "pointer";
          }
        }
      } else {
        pendingResize = true;
      }
    }, 220);
  }

  /* -------------------------------------------------------
     Boot
     ------------------------------------------------------- */
  function boot() {
    cache();
    buildAmbient();
    resetScene();
    openBtn.addEventListener("click", openGift);
    replayBtn.addEventListener("click", replay);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();