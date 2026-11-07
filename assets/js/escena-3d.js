(function () {
  'use strict';
  var canvas = document.getElementById('gl');
  var kgEl = document.getElementById('kg');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var sm = function (a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

  function kf(o) {
    var d = { cam: [5, 3, 10], look: [0, 1.9, 0], rot: 0, ex: 0, hd: 0, f: [0, 0, 0, 0], spread: 0, sx: 0, sy: 0, fade: 1, dark: 0, ow: 4.6 };
    for (var k in o) d[k] = o[k];
    return d;
  }
  // One keyframe per chapter, in page order. ex: lid lifts off; hd: display head lifts off the mast;
  // f: focus on [lid, load cell, -, display]; ow: width the camera must keep in view.
  var K = [
    kf({ cam: [5.0, 3.6, 10.5], look: [0, 1.9, -0.3], rot: 0.6, sx: 0.22 }),
    kf({ cam: [4.6, 5.4, 10.2], look: [0, 0.9, -0.2], rot: -0.35, f: [1, 0, 0, 0], sx: -0.2, ow: 4.2 }),
    kf({ cam: [7.2, 3.6, 9.0], look: [0, 1.5, -0.2], rot: 0.15, ex: 1, f: [0, 1, 0, 0], sx: 0.2, dark: 1, ow: 4.6 }),
    kf({ cam: [-4.6, 4.4, 9.0], look: [0, 2.9, -0.3], rot: 0.35, hd: 1, f: [0, 0, 0, 1], sx: -0.2, dark: 1, ow: 3.6 }),
    kf({ cam: [2.8, 4.4, 5.6], look: [0, 3.45, -0.6], rot: -0.1, hd: 0.1, f: [0, 0, 0, 1], sx: 0.2, dark: 1, ow: 2.4 }),
    kf({ cam: [5.6, 3.8, 10.4], look: [0, 1.9, -0.3], rot: 1.3, sx: -0.2 }),
    kf({ cam: [0, 4.6, 17.5], look: [0, 1.9, 0], rot: -0.55, spread: 1, sy: 0.18, dark: 1, ow: 12.5 }),
    kf({ cam: [6.6, 4.0, 11.0], look: [0, 1.9, -0.3], rot: 2.0, sx: 0.24, fade: 0.55 }),
    kf({ cam: [5.0, 3.5, 12.0], look: [0, 1.9, 0], rot: 2.7, sx: 0.3, fade: 0.2 }),
    kf({ cam: [5.5, 3.2, 10.5], look: [0, 1.9, 0], rot: 0.7, sx: 0.0, fade: 0.8, dark: 1 })
  ];
  var chaps = Array.prototype.slice.call(document.querySelectorAll('.chap'));

  function mixState(a, b, t) {
    var o = {};
    for (var k in a) {
      var x = a[k], y = b[k];
      if (Array.isArray(x)) o[k] = x.map(function (v, i) { return lerp(v, y[i], t); });
      else o[k] = lerp(x, y, t);
    }
    return o;
  }
  function stepState(cur, tgt, k) {
    for (var key in tgt) {
      if (key === 'dark' || key === 'darkPick') continue;
      var x = tgt[key];
      if (Array.isArray(x)) { for (var i = 0; i < x.length; i++) cur[key][i] += (x[i] - cur[key][i]) * k; }
      else cur[key] += (x - cur[key]) * k;
    }
  }
  function currentTarget() {
    var line = window.innerHeight * 0.5, idx = 0, frac = 0;
    for (var n = 0; n < chaps.length; n++) {
      var r = chaps[n].getBoundingClientRect();
      if (r.top <= line) { idx = n; frac = clamp((line - r.top) / Math.max(1, r.height), 0, 1); }
    }
    var next = Math.min(chaps.length - 1, idx + 1);
    var e = sm(0.5, 1, frac);
    var st = mixState(K[idx], K[next], e);
    st.darkPick = (e > 0.5 ? K[next] : K[idx]).dark;
    return st;
  }
  var cur = JSON.parse(JSON.stringify(K[0]));

  function scrollProgress() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    return h > 0 ? clamp(window.scrollY / h, 0, 1) : 0;
  }

  if (typeof THREE === 'undefined') {
    document.documentElement.classList.add('nogl');
    document.addEventListener('scroll', function () {
      document.body.classList.toggle('is-dark', currentTarget().darkPick === 1);
      kgEl.textContent = (scrollProgress() * 500).toFixed(2).padStart(6, '0');
    }, { passive: true });
    return;
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    document.documentElement.classList.add('nogl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);

  // Studio reflections: a small room with soft boxes, prefiltered once.
  (function () {
    var pm = new THREE.PMREMGenerator(renderer);
    var s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x25282c, side: THREE.BackSide })));
    function box(w, h, pos, col, mul) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(mul), side: THREE.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); s.add(m);
    }
    box(9, 4, [0, 9, 3], 0xffffff, 7);
    box(3, 9, [-9, 2, 2], 0xffffff, 3.2);
    box(3, 9, [9, 2, -3], 0xdfe8ff, 2.6);
    box(7, 2, [0, -2, 9], 0xffffff, 0.9);
    scene.environment = pm.fromScene(s, 0.04).texture;
    pm.dispose();
  })();

  var key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(5, 12, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -13; key.shadow.camera.right = 13; key.shadow.camera.top = 13; key.shadow.camera.bottom = -13;
  key.shadow.camera.near = 1; key.shadow.camera.far = 40;
  key.shadow.bias = -0.0006;
  scene.add(key);
  var rim = new THREE.PointLight(0xff4f1f, 0.28, 34);
  rim.position.set(-7, 3, -6);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444a52, 0.4));

  var floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: 0.34 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- textures: hammertone speckle and diamond tread plate
  function noiseTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 5600; i++) {
      var v = (95 + Math.random() * 120) | 0;
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      var s = 1 + Math.random() * 2.2;
      g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  }
  function diamondTexture(base, loz) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    function lozenge(x, y, a) {
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = loz;
      g.beginPath(); g.ellipse(0, 0, 27, 7, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    lozenge(32, 32, Math.PI / 4); lozenge(96, 32, -Math.PI / 4); lozenge(32, 96, -Math.PI / 4); lozenge(96, 96, Math.PI / 4);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  }
  var noise = noiseTexture();
  var diaBump = diamondTexture('#2c2c2c', '#e0e0e0');
  var diaMap = diamondTexture('#9a9a9a', '#e6e6e6');
  noise.repeat.set(3, 3);

  // ---- display head texture (C1 panel: three LCD windows on the left, keypad on the right)
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  var SEG = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g' };
  function seg7(g, ch, x, y, w, h, on, off) {
    var t = w * 0.17, hh = h / 2 - t * 1.15;
    var R = {
      a: [x + t, y, w - 2 * t, t], b: [x + w - t, y + t, t, hh], c: [x + w - t, y + h / 2 + t * 0.15, t, hh],
      d: [x + t, y + h - t, w - 2 * t, t], e: [x, y + h / 2 + t * 0.15, t, hh], f: [x, y + t, t, hh], g: [x + t, y + h / 2 - t / 2, w - 2 * t, t]
    };
    var lit = SEG[ch] || '';
    g.save(); g.translate(x + w / 2, y + h / 2); g.transform(1, 0, -0.12, 1, 0, 0); g.translate(-(x + w / 2), -(y + h / 2));
    for (var k in R) { g.fillStyle = lit.indexOf(k) >= 0 ? on : off; g.fillRect(R[k][0], R[k][1], R[k][2], R[k][3]); }
    g.restore();
  }
  function drawNum(g, str, xRight, yTop, h) {
    var dw = h * 0.56, gap = h * 0.17, total = 0, i;
    for (i = 0; i < str.length; i++) total += str[i] === '.' ? 0 : dw + gap;
    var x = xRight - total + gap;
    for (i = 0; i < str.length; i++) {
      if (str[i] === '.') { var t = h * 0.11; g.fillStyle = '#10301a'; g.fillRect(x - gap * 0.9, yTop + h - t, t, t); continue; }
      seg7(g, str[i], x, yTop, dw, h, '#10301a', 'rgba(20,70,25,.13)');
      x += dw + gap;
    }
  }
  function buildPanel() {
    var c = document.createElement('canvas'); c.width = 1024; c.height = 640;
    var g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 1024, 640); gr.addColorStop(0, '#1d2236'); gr.addColorStop(1, '#0c0f18');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 640);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(560, 0); g.lineTo(0, 360); g.closePath(); g.fill();
    g.fillStyle = '#c9ccd2'; g.font = '600 30px Arial, sans-serif'; g.textAlign = 'left'; g.fillText('C1', 44, 612);
    roundRect(g, 36, 36, 452, 524, 26); g.fillStyle = '#d8dad6'; g.fill();
    var labels = ['WEIGHT (kg)', 'UNIT PRICE', 'TOTAL PRICE'];
    g.font = '600 17px Arial, sans-serif';
    for (var i = 0; i < 3; i++) {
      var ly = 82 + i * 166;
      g.fillStyle = '#4a4f55'; g.fillText(labels[i], 66, ly);
      roundRect(g, 66, ly + 10, 392, 104, 8); g.fillStyle = '#8fe27a'; g.fill();
      g.lineWidth = 3; g.strokeStyle = '#6a746a'; g.stroke();
    }
    g.fillStyle = '#6a6f75'; g.font = '13px Arial, sans-serif'; g.fillText('ZERO    STAB    TARE', 258, 62);
    g.fillStyle = '#2f9e4f'; g.beginPath(); g.arc(410, 542, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a4f55'; g.font = '600 15px Arial, sans-serif'; g.fillText('AC', 422, 547);
    var COL = { g: '#2a8a6a', o: '#e2722b', w: '#d9dad6' };
    var rows = [
      [['7', 'g'], ['8', 'g'], ['9', 'g'], ['C', 'o']],
      [['4', 'g'], ['5', 'g'], ['6', 'g'], ['ADD', 'o']],
      [['1', 'g'], ['2', 'g'], ['3', 'g'], ['TARE', 'o']],
      [['0', 'g'], ['.', 'g'], ['STORE', 'o'], ['ZERO', 'o']],
      [['M1', 'w'], ['M2', 'w'], ['M3', 'w'], ['M4', 'w']],
      [['M5', 'w'], ['M6', 'w'], ['M7', 'w'], ['*', 'o']]
    ];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    rows.forEach(function (row, r) {
      row.forEach(function (k, ci) {
        var x = 520 + ci * 122, y = 36 + r * 90;
        roundRect(g, x, y, 102, 74, 15); g.fillStyle = COL[k[1]]; g.fill();
        g.fillStyle = 'rgba(255,255,255,.18)'; roundRect(g, x + 4, y + 4, 94, 22, 11); g.fill();
        g.fillStyle = '#0d1a14';
        if (k[0] === '*') {
          g.strokeStyle = '#0d1a14'; g.lineWidth = 3;
          g.beginPath(); g.arc(x + 51, y + 34, 11, 0, Math.PI * 2); g.stroke();
          for (var a = 0; a < 8; a++) { var an = a * Math.PI / 4; g.beginPath(); g.moveTo(x + 51 + Math.cos(an) * 16, y + 34 + Math.sin(an) * 16); g.lineTo(x + 51 + Math.cos(an) * 22, y + 34 + Math.sin(an) * 22); g.stroke(); }
        } else {
          g.font = (k[0].length > 2 ? 'bold 22px' : 'bold 31px') + ' Arial, sans-serif';
          g.fillText(k[0], x + 51, y + 40);
        }
      });
    });
    g.textBaseline = 'alphabetic';
    return c;
  }
  var panelBase = buildPanel();

  function rrShape(w, h, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  var MAST_H = 2.3, MAST_Y0 = 0.62, MAST_TOP = MAST_Y0 + MAST_H;

  function makeScale(cfg) {
    var w = cfg.w, d = cfg.d;
    var grp = new THREE.Group();
    function tex(src, rx, ry) { var t = src.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t; }
    var hammer = new THREE.MeshStandardMaterial({ color: 0x4a4e54, metalness: 0.7, roughness: 0.5, bumpMap: tex(noise, 6, 6), bumpScale: 0.4 });
    var hammerDark = new THREE.MeshStandardMaterial({ color: 0x2c2f34, metalness: 0.6, roughness: 0.55, bumpMap: tex(noise, 3, 3), bumpScale: 0.35 });
    var hammerMast = new THREE.MeshStandardMaterial({ color: 0x4a4e54, metalness: 0.7, roughness: 0.5, bumpMap: tex(noise, 1, 10), bumpScale: 0.5 });
    var plateTop = new THREE.MeshStandardMaterial({ color: 0x5a5f66, map: tex(diaMap, w * 4.2, d * 4.2), bumpMap: tex(diaBump, w * 4.2, d * 4.2), bumpScale: 1.0, metalness: 0.7, roughness: 0.42 });
    var steel = new THREE.MeshStandardMaterial({ color: 0xbec3c8, metalness: 0.95, roughness: 0.32 });
    var alu = new THREE.MeshStandardMaterial({ color: 0xdadde0, metalness: 0.85, roughness: 0.4 });
    var black = new THREE.MeshStandardMaterial({ color: 0x121417, metalness: 0.3, roughness: 0.6 });
    var chrome = new THREE.MeshStandardMaterial({ color: 0xe3e6e9, metalness: 1, roughness: 0.14 });

    function mesh(geo, mat) { var m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }
    var P = {};

    // leveling feet
    P.feet = new THREE.Group();
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      var f = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 16), black);
      f.position.set(s[0] * (w / 2 - 0.3), 0.07, s[1] * (d / 2 - 0.3));
      P.feet.add(f);
    });

    // tube frame: outer rails, inner rails and two cross bars
    P.tray = new THREE.Group();
    [-1, 1].forEach(function (s) {
      var o = mesh(new THREE.BoxGeometry(0.18, 0.2, d), hammer); o.position.set(s * (w / 2 - 0.09), 0.24, 0); P.tray.add(o);
      var i = mesh(new THREE.BoxGeometry(0.18, 0.2, d - 0.36), hammer); i.position.set(s * w * 0.2, 0.24, 0); P.tray.add(i);
      var c = mesh(new THREE.BoxGeometry(w, 0.2, 0.18), hammer); c.position.set(0, 0.24, s * (d / 2 - 0.09)); P.tray.add(c);
    });

    // load cell: aluminium beam bolted to a mounting plate, with a thin cable
    P.sensor = new THREE.Group();
    var mount = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.32), hammerDark); mount.position.set(0, 0, d * 0.2); P.sensor.add(mount);
    [[-0.17, -0.09], [0.17, -0.09], [-0.17, 0.09], [0.17, 0.09]].forEach(function (b) {
      var bolt = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), black); bolt.position.set(b[0], 0.055, d * 0.2 + b[1]); P.sensor.add(bolt);
    });
    var cell = mesh(new THREE.BoxGeometry(0.3, 0.13, 0.9), alu); cell.position.set(0, 0.09, d * 0.2 - 0.5); P.sensor.add(cell);
    [-0.07, 0.07].forEach(function (x) {
      var sc = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 10), steel); sc.position.set(x, 0.16, d * 0.2 - 0.85); P.sensor.add(sc);
    });
    var cable = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.12, 0.1, d * 0.2 - 0.95), new THREE.Vector3(0.22, 0.05, d * 0.2 - 1.15), new THREE.Vector3(0.34, 0.03, -(d / 2) + 0.2)
    ]), 14, 0.014, 6, false), black);
    P.sensor.add(cable);
    P.sensor.position.y = 0.2;

    // lid: textured tread plate with a folded edge
    P.plate = new THREE.Group();
    var lid = mesh(new THREE.BoxGeometry(w + 0.08, 0.05, d + 0.08), [hammer, hammer, plateTop, hammer, hammer, hammer]);
    lid.position.y = 0.365; P.plate.add(lid);
    [[0, (d + 0.08) / 2 - 0.01, w + 0.08, 0.02], [0, -((d + 0.08) / 2 - 0.01), w + 0.08, 0.02]].forEach(function (r) {
      var s = mesh(new THREE.BoxGeometry(r[2], 0.14, r[3]), hammer); s.position.set(r[0], 0.28, r[1]); P.plate.add(s);
    });
    [(w + 0.08) / 2 - 0.01, -((w + 0.08) / 2 - 0.01)].forEach(function (x) {
      var s = mesh(new THREE.BoxGeometry(0.02, 0.14, d + 0.08), hammer); s.position.set(x, 0.28, 0); P.plate.add(s);
    });

    // hinged mast: flat strap from the rear cross bar, black clevis with a steel pin, square tube
    var mz = -(d / 2) - 0.5;
    P.mast = new THREE.Group();
    var strap = mesh(new THREE.BoxGeometry(0.2, 0.05, 0.66), steel); strap.position.set(0, 0.3, -(d / 2) - 0.2); P.mast.add(strap);
    var clevis = mesh(new THREE.BoxGeometry(0.34, 0.3, 0.22), black); clevis.position.set(0, 0.47, mz); P.mast.add(clevis);
    var pin = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 14), steel); pin.rotation.z = Math.PI / 2; pin.position.set(0, 0.47, mz); P.mast.add(pin);
    var tube = mesh(new THREE.BoxGeometry(0.22, MAST_H, 0.22), hammerMast); tube.position.set(0, MAST_Y0 + MAST_H / 2, mz); P.mast.add(tube);
    var bracket = mesh(new THREE.BoxGeometry(0.46, 0.7, 0.26), black); bracket.position.set(0, MAST_TOP + 0.15, mz); P.mast.add(bracket);

    // display head (C1): chrome rim, dark housing, panel texture
    P.head = new THREE.Group();
    var headBaseY = MAST_TOP + 0.9, headBaseZ = mz + 0.14;
    P.head.position.set(0, headBaseY, headBaseZ);
    P.tilt = new THREE.Group();
    P.head.add(P.tilt);
    var HW = 1.5, HH = 0.96;
    var rimM = mesh(new THREE.ExtrudeGeometry(rrShape(HW, HH, 0.14), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 10 }), chrome);
    P.tilt.add(rimM);
    var housing = mesh(new THREE.BoxGeometry(HW - 0.14, HH - 0.14, 0.3), black); housing.position.z = -0.15; P.tilt.add(housing);
    var fw = HW - 0.1, fh = HH - 0.1;
    var fg = new THREE.ShapeGeometry(rrShape(fw, fh, 0.1), 10);
    var pos = fg.attributes.position, uv = fg.attributes.uv;
    for (var vi = 0; vi < pos.count; vi++) uv.setXY(vi, (pos.getX(vi) + fw / 2) / fw, (pos.getY(vi) + fh / 2) / fh);
    var pc = document.createElement('canvas'); pc.width = 1024; pc.height = 640;
    var pg = pc.getContext('2d');
    var ptex = new THREE.CanvasTexture(pc); ptex.encoding = THREE.sRGBEncoding; ptex.anisotropy = 8;
    var face = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: ptex, toneMapped: false }));
    face.position.z = 0.1 + 0.025 + 0.002; P.tilt.add(face);
    P.tilt.position.set(0, 0, 0.1);
    P.tilt.rotation.x = -0.26;

    var lastTxt = '', lastAt = -1000;
    function draw(txt) {
      pg.drawImage(panelBase, 0, 0);
      drawNum(pg, txt, 440, 99, 78);
      drawNum(pg, '0.00', 440, 265, 78);
      drawNum(pg, '0.00', 440, 431, 78);
      ptex.needsUpdate = true;
    }

    var cellLight = null, headLight = null;
    if (cfg.light) {
      cellLight = new THREE.PointLight(0xff5a2a, 0, 6); cellLight.position.set(0, 1.0, 0); P.sensor.add(cellLight);
      headLight = new THREE.PointLight(0xffffff, 0, 6); headLight.position.set(0, 0.2, 1.4); P.tilt.add(headLight);
    }

    grp.add(P.feet, P.tray, P.sensor, P.plate, P.mast, P.head);

    return {
      group: grp,
      setValue: function (txt, now) {
        if (txt !== lastTxt && now - lastAt > 70) { lastTxt = txt; lastAt = now; draw(txt); }
      },
      apply: function (e, hd, f) {
        P.plate.position.y = 1.8 * e;
        P.sensor.position.y = 0.2 + 0.3 * e;
        P.feet.position.y = -0.3 * e;
        P.head.position.y = headBaseY + 1.0 * hd;
        P.head.rotation.y = 0.35 * hd;
        P.tilt.rotation.x = -0.26 - 0.18 * hd;
        if (cellLight) cellLight.intensity = 3.4 * f[1];
        if (headLight) headLight.intensity = 1.2 * f[3];
      }
    };
  }

  var CFG = [
    { cap: 150, w: 2.0, d: 1.5 },
    { cap: 300, w: 2.5, d: 2.0, light: true },
    { cap: 500, w: 3.0, d: 2.25 }
  ];
  var LX = [-4.2, 0, 4.2];
  var scales = CFG.map(function (c) { var s = makeScale(c); scene.add(s.group); return s; });

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  var px = 0, py = 0, spx = 0, spy = 0;
  if (finePointer) window.addEventListener('pointermove', function (e) {
    px = e.clientX / window.innerWidth * 2 - 1; py = e.clientY / window.innerHeight * 2 - 1;
  }, { passive: true });

  var introT = reduce ? 1 : 0, lastT = performance.now(), shown = 0, lookV = new THREE.Vector3();

  function frame(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    var tgt = currentTarget();
    stepState(cur, tgt, reduce ? 1 : 1 - Math.exp(-dt * 5));
    document.body.classList.toggle('is-dark', tgt.darkPick === 1);
    if (introT < 1) introT = Math.min(1, introT + dt / 2.4);
    var ie = reduce ? 0 : Math.pow(1 - introT, 3);

    var pr = scrollProgress();
    shown += (pr * 500 - shown) * (reduce ? 1 : 1 - Math.exp(-dt * 8));
    var kgTxt = shown.toFixed(2);
    kgEl.textContent = kgTxt.padStart(6, '0');

    var sp = cur.spread;
    scales.forEach(function (s, i) {
      var g = s.group;
      if (i === 1) {
        g.visible = true;
        g.position.x = LX[1] * sp;
        g.rotation.y = cur.rot + ie * 2.6 + (reduce ? 0 : Math.sin(now * 0.00035) * 0.05);
        s.apply(clamp(cur.ex + ie * 1.0, 0, 1.3), cur.hd, cur.f);
        s.setValue(sp > 0.5 ? String(CFG[1].cap) + '.00' : kgTxt, now);
      } else {
        g.visible = sp > 0.01;
        g.position.x = LX[i] * sp;
        var sc = clamp(sp, 0.001, 1); g.scale.set(sc, sc, sc);
        g.rotation.y = cur.rot;
        s.apply(0, 0, [0, 0, 0, 0]);
        s.setValue(String(CFG[i].cap) + '.00', now);
      }
    });

    var w = window.innerWidth, h = window.innerHeight, aspect = w / h;
    var dx = cur.cam[0] - cur.look[0], dy = cur.cam[1] - cur.look[1], dz = cur.cam[2] - cur.look[2];
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var fit = clamp((cur.ow / (0.574 * aspect)) / dist, 1, 4);
    spx += (px - spx) * 0.05; spy += (py - spy) * 0.05;
    lookV.set(cur.look[0], cur.look[1], cur.look[2]);
    camera.position.set(
      cur.look[0] + dx * fit + spx * 0.45,
      cur.look[1] + dy * fit - spy * 0.25,
      cur.look[2] + dz * fit
    );
    camera.lookAt(lookV);
    var desk = aspect > 1.1 ? 1 : 0;
    camera.setViewOffset(w, h, -cur.sx * desk * w, (desk ? cur.sy : 0.22) * h, w, h);

    canvas.style.opacity = cur.fade.toFixed(3);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
