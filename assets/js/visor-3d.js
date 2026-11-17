// Balanzas Caballito — visor 3D de la balanza (three.js r128, cargado a demanda).
// Escritorio: visor en el hero, se gira arrastrando con el mouse.
// Celular: burbuja "Tocá para ver en 3D" que abre una ventana a pantalla completa; se gira con el dedo.
// Escala: 1 unidad = 20 cm. Las plataformas usan las medidas oficiales de data/productos.js;
// mástil y tablero son iguales en los tres modelos, así la diferencia de tamaño se ve real.
(function () {
  'use strict';
  var root = document.querySelector('[data-v3d]');
  if (!root) return;

  var THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var D = window.BC_DATOS || {};
  var PRODS = D.productos || [
    { id: '150', plataforma: '40 × 30 cm', precision: '20 g' },
    { id: '300', plataforma: '50 × 40 cm', precision: '50 g' },
    { id: '500', plataforma: '60 × 45 cm', precision: '100 g' }
  ];
  var CM = 20; // centímetros por unidad 3D
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INLINE = window.matchMedia('(pointer: fine) and (min-width: 761px)').matches;
  var track = function (n, d) { if (window.bcTrack) window.bcTrack(n, d); };

  var stage = root.querySelector('.v3d-stage');
  var bar = root.querySelector('.v3d-bar');
  var hint = root.querySelector('.v3d-hint');
  var openBtn = root.querySelector('.v3d-open');
  var modal = document.getElementById('v3d-modal');
  var mstage = modal && modal.querySelector('.v3d-mstage');
  var current = '300';
  var viewers = [];

  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  var threeP = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve();
    if (threeP) return threeP;
    threeP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = THREE_SRC; s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return threeP;
  }

  // ---- interfaz compartida (barra del hero y de la ventana del celular)
  function dims(p) {
    var m = String(p.plataforma).match(/(\d+)\s*[×x]\s*(\d+)/);
    return m ? [+m[1], +m[2]] : [50, 40];
  }
  function syncUI() {
    var p = PRODS.filter(function (x) { return x.id === current; })[0] || PRODS[1];
    document.querySelectorAll('[data-v3d-model]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-v3d-model') === current));
    });
    document.querySelectorAll('[data-v3d-info]').forEach(function (el) {
      el.textContent = 'Plataforma ' + p.plataforma + ' · Precisión ' + p.precision;
    });
    document.querySelectorAll('[data-v3d-spec]').forEach(function (a) {
      a.href = 'balanza-' + current + '.html';
      a.setAttribute('data-ficha', current);
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-v3d-model]');
    if (!b) return;
    current = b.getAttribute('data-v3d-model');
    syncUI();
    viewers.forEach(function (v) { v.setModel(current); });
    track('visor_3d', { accion: 'modelo', modelo: current });
  });
  syncUI();

  // ---- motor 3D
  function createViewer(host) {
    var THREE = window.THREE;
    var canvas = document.createElement('canvas');
    canvas.className = 'v3d-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Vista 3D de la balanza. Arrastrá para girarla; con las flechas del teclado también gira.');
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'default' });
    } catch (e) { return null; }
    if (!renderer.getContext()) return null;
    host.appendChild(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, INLINE ? 2 : 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    // reflejos de estudio, calculados una sola vez
    (function () {
      var pm = new THREE.PMREMGenerator(renderer);
      var s = new THREE.Scene();
      s.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x2a2d31, side: THREE.BackSide })));
      function box(w, h, pos, mul) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(mul), side: THREE.DoubleSide }));
        m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); s.add(m);
      }
      box(9, 4, [0, 9, 3], 7); box(3, 9, [-9, 2, 2], 3.2); box(3, 9, [9, 2, -3], 2.6); box(7, 2, [0, -2, 9], 0.9);
      scene.environment = pm.fromScene(s, 0.04).texture;
      pm.dispose();
    })();
    var key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(5, 12, 8); scene.add(key);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4f55, 0.45));

    // texturas: martillado y chapa semillada
    function noiseTexture() {
      var c = document.createElement('canvas'); c.width = c.height = 256;
      var g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 5600; i++) {
        var v = (95 + Math.random() * 120) | 0, sz = 1 + Math.random() * 2.2;
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, sz, sz);
      }
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
    }
    function diamondTexture(base, loz) {
      var c = document.createElement('canvas'); c.width = c.height = 128;
      var g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
      function lz(x, y, a) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = loz; g.beginPath(); g.ellipse(0, 0, 27, 7, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      lz(32, 32, Math.PI / 4); lz(96, 32, -Math.PI / 4); lz(32, 96, -Math.PI / 4); lz(96, 96, Math.PI / 4);
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
    }
    var noise = noiseTexture(), diaBump = diamondTexture('#2c2c2c', '#e0e0e0'), diaMap = diamondTexture('#9a9a9a', '#e6e6e6');

    // panel del tablero C1: tres visores y teclado
    function roundRect(g, x, y, w, h, r) {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    var SEG = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };
    function seg7(g, ch, x, y, w, h) {
      var t = w * 0.17, hh = h / 2 - t * 1.15;
      var R = { a: [x + t, y, w - 2 * t, t], b: [x + w - t, y + t, t, hh], c: [x + w - t, y + h / 2 + t * 0.15, t, hh], d: [x + t, y + h - t, w - 2 * t, t], e: [x, y + h / 2 + t * 0.15, t, hh], f: [x, y + t, t, hh], g: [x + t, y + h / 2 - t / 2, w - 2 * t, t] };
      var lit = SEG[ch] || '';
      g.save(); g.translate(x + w / 2, y + h / 2); g.transform(1, 0, -0.12, 1, 0, 0); g.translate(-(x + w / 2), -(y + h / 2));
      for (var k in R) { g.fillStyle = lit.indexOf(k) >= 0 ? '#10301a' : 'rgba(20,70,25,.13)'; g.fillRect(R[k][0], R[k][1], R[k][2], R[k][3]); }
      g.restore();
    }
    function drawNum(g, str, xRight, yTop, h) {
      var dw = h * 0.56, gap = h * 0.17, total = 0, i;
      for (i = 0; i < str.length; i++) total += str[i] === '.' ? 0 : dw + gap;
      var x = xRight - total + gap;
      for (i = 0; i < str.length; i++) {
        if (str[i] === '.') { var t = h * 0.11; g.fillStyle = '#10301a'; g.fillRect(x - gap * 0.9, yTop + h - t, t, t); continue; }
        seg7(g, str[i], x, yTop, dw, h); x += dw + gap;
      }
    }
    var panelTex = (function () {
      var c = document.createElement('canvas'); c.width = 1024; c.height = 640;
      var g = c.getContext('2d');
      var gr = g.createLinearGradient(0, 0, 1024, 640); gr.addColorStop(0, '#1d2236'); gr.addColorStop(1, '#0c0f18');
      g.fillStyle = gr; g.fillRect(0, 0, 1024, 640);
      roundRect(g, 36, 36, 452, 524, 26); g.fillStyle = '#d8dad6'; g.fill();
      var labels = ['WEIGHT (kg)', 'UNIT PRICE', 'TOTAL PRICE'];
      g.font = '600 17px Arial, sans-serif';
      for (var i = 0; i < 3; i++) {
        var ly = 82 + i * 166;
        g.fillStyle = '#4a4f55'; g.fillText(labels[i], 66, ly);
        roundRect(g, 66, ly + 10, 392, 104, 8); g.fillStyle = '#8fe27a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#6a746a'; g.stroke();
        drawNum(g, '0.00', 440, ly + 23, 78);
      }
      var COL = { g: '#2a8a6a', o: '#e2722b', w: '#d9dad6' };
      var rows = [[['7', 'g'], ['8', 'g'], ['9', 'g'], ['C', 'o']], [['4', 'g'], ['5', 'g'], ['6', 'g'], ['ADD', 'o']], [['1', 'g'], ['2', 'g'], ['3', 'g'], ['TARE', 'o']],
        [['0', 'g'], ['.', 'g'], ['STORE', 'o'], ['ZERO', 'o']], [['M1', 'w'], ['M2', 'w'], ['M3', 'w'], ['M4', 'w']], [['M5', 'w'], ['M6', 'w'], ['M7', 'w'], ['', 'o']]];
      g.textAlign = 'center'; g.textBaseline = 'middle';
      rows.forEach(function (row, r) {
        row.forEach(function (k, ci) {
          var x = 520 + ci * 122, y = 36 + r * 90;
          roundRect(g, x, y, 102, 74, 15); g.fillStyle = COL[k[1]]; g.fill();
          g.fillStyle = 'rgba(255,255,255,.18)'; roundRect(g, x + 4, y + 4, 94, 22, 11); g.fill();
          g.fillStyle = '#0d1a14'; g.font = (k[0].length > 2 ? 'bold 22px' : 'bold 31px') + ' Arial, sans-serif'; g.fillText(k[0], x + 51, y + 40);
        });
      });
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
    })();

    function rrShape(w, h, r) {
      var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    }

    // la balanza: mástil y tablero fijos, plataforma según el modelo
    var MAST_H = 2.3, MAST_Y0 = 0.62, MAST_TOP = MAST_Y0 + MAST_H;
    function makeScale(w, d, blue) {
      var grp = new THREE.Group();
      function tex(src, rx, ry) { var t = src.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t; }
      var frameCol = blue ? 0x23409a : 0x4a4e54;
      var hammer = new THREE.MeshStandardMaterial({ color: frameCol, metalness: 0.6, roughness: 0.5, bumpMap: tex(noise, 6, 6), bumpScale: 0.18 });
      var hammerMast = new THREE.MeshStandardMaterial({ color: frameCol, metalness: 0.55, roughness: 0.45 });
      var plateTop = new THREE.MeshStandardMaterial({ color: blue ? 0x2f56c4 : 0x5a5f66, map: tex(diaMap, w * 2.8, d * 2.8), bumpMap: tex(diaBump, w * 2.8, d * 2.8), bumpScale: 0.6, metalness: 0.65, roughness: 0.42 });
      var steel = new THREE.MeshStandardMaterial({ color: 0xbec3c8, metalness: 0.95, roughness: 0.32 });
      var black = new THREE.MeshStandardMaterial({ color: 0x121417, metalness: 0.3, roughness: 0.6 });
      var chrome = new THREE.MeshStandardMaterial({ color: 0xe3e6e9, metalness: 1, roughness: 0.14 });
      function add(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); grp.add(m); return m; }

      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { add(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 16), black, s[0] * (w / 2 - 0.3), 0.07, s[1] * (d / 2 - 0.3)); });
      [-1, 1].forEach(function (s) {
        add(new THREE.BoxGeometry(0.18, 0.2, d), hammer, s * (w / 2 - 0.09), 0.24, 0);
        add(new THREE.BoxGeometry(w, 0.2, 0.18), hammer, 0, 0.24, s * (d / 2 - 0.09));
      });
      add(new THREE.BoxGeometry(w + 0.08, 0.05, d + 0.08), [hammer, hammer, plateTop, hammer, hammer, hammer], 0, 0.365, 0);
      add(new THREE.BoxGeometry(w + 0.08, 0.14, 0.02), hammer, 0, 0.28, (d + 0.08) / 2 - 0.01);
      add(new THREE.BoxGeometry(w + 0.08, 0.14, 0.02), hammer, 0, 0.28, -((d + 0.08) / 2 - 0.01));
      add(new THREE.BoxGeometry(0.02, 0.14, d + 0.08), hammer, (w + 0.08) / 2 - 0.01, 0.28, 0);
      add(new THREE.BoxGeometry(0.02, 0.14, d + 0.08), hammer, -((w + 0.08) / 2 - 0.01), 0.28, 0);

      var mz = -(d / 2) - 0.5;
      add(new THREE.BoxGeometry(0.2, 0.05, 0.66), steel, 0, 0.3, -(d / 2) - 0.2);
      add(new THREE.BoxGeometry(0.34, 0.3, 0.22), black, 0, 0.47, mz);
      var pin = add(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 14), steel, 0, 0.47, mz); pin.rotation.z = Math.PI / 2;
      add(new THREE.BoxGeometry(0.22, MAST_H, 0.22), hammerMast, 0, MAST_Y0 + MAST_H / 2, mz);
      add(new THREE.BoxGeometry(0.46, 0.7, 0.26), black, 0, MAST_TOP + 0.15, mz);

      var head = new THREE.Group(); head.position.set(0, MAST_TOP + 0.9, mz + 0.24); head.rotation.x = -0.26; grp.add(head);
      var HW = 1.5, HH = 0.96;
      head.add(new THREE.Mesh(new THREE.ExtrudeGeometry(rrShape(HW, HH, 0.14), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 10 }), chrome));
      var housing = new THREE.Mesh(new THREE.BoxGeometry(HW - 0.14, HH - 0.14, 0.3), black); housing.position.z = -0.15; head.add(housing);
      var fw = HW - 0.1, fh = HH - 0.1, fg = new THREE.ShapeGeometry(rrShape(fw, fh, 0.1), 10);
      var pos = fg.attributes.position, uv = fg.attributes.uv;
      for (var i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + fw / 2) / fw, (pos.getY(i) + fh / 2) / fh);
      var face = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: panelTex, toneMapped: false })); face.position.z = 0.127; head.add(face);
      return grp;
    }

    // plato giratorio + sombra de contacto
    var turn = new THREE.Group(); scene.add(turn);
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.08, 72), new THREE.MeshStandardMaterial({ color: 0xe6e7e3, roughness: 0.85, metalness: 0 }));
    disc.position.y = -0.045; turn.add(disc);
    var sc = document.createElement('canvas'); sc.width = sc.height = 128;
    var sg = sc.getContext('2d'), rg = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
    rg.addColorStop(0, 'rgba(0,0,0,.42)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
    var shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false });

    var models = {};
    PRODS.forEach(function (p) {
      var dm = dims(p), w = dm[0] / CM, d = dm[1] / CM;
      var g = new THREE.Group();
      g.add(makeScale(w, d, p.id === '500'));
      var sh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, d * 1.6), shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.002; g.add(sh);
      g.visible = p.id === current;
      turn.add(g); models[p.id] = g;
    });

    // cámara orbital: arrastre horizontal = giro del plato, vertical = inclinación
    var target = new THREE.Vector3(0, 1.75, -0.3);
    var yaw = 0.7, el = 0.3, vYaw = 0, dist = 11, lastTouch = -1e9, dragging = false, lx = 0, ly = 0;
    var swapT = 1, visible = true, running = false, lastT = 0, needs = true;
    function place() {
      camera.position.set(target.x, target.y + Math.sin(el) * dist, target.z + Math.cos(el) * dist);
      camera.lookAt(target);
      turn.rotation.y = yaw;
    }
    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      var tan = Math.tan(camera.fov * Math.PI / 360);
      dist = Math.max(3.15 / tan, 3.25 / (tan * camera.aspect));
      needs = true;
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
    resize();

    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; lx = e.clientX; ly = e.clientY; vYaw = 0; lastTouch = performance.now();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      canvas.classList.add('is-drag');
      if (hint) hint.classList.add('is-hidden');
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      var k = INLINE ? 0.009 : 0.011;
      yaw += dx * k; vYaw = dx * k;
      el = Math.min(1.15, Math.max(-0.05, el + dy * 0.006));
      lastTouch = performance.now(); needs = true;
    });
    function up() { dragging = false; canvas.classList.remove('is-drag'); lastTouch = performance.now(); }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('keydown', function (e) {
      var used = true;
      if (e.key === 'ArrowLeft') yaw -= 0.3; else if (e.key === 'ArrowRight') yaw += 0.3;
      else if (e.key === 'ArrowUp') el = Math.max(-0.05, el - 0.12); else if (e.key === 'ArrowDown') el = Math.min(1.15, el + 0.12);
      else used = false;
      if (used) { e.preventDefault(); lastTouch = performance.now(); needs = true; }
    });

    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - (lastT || now)) / 1000); lastT = now;
      var idle = now - lastTouch > 3500;
      if (!dragging) {
        if (Math.abs(vYaw) > 0.0002) { yaw += vYaw; vYaw *= 0.92; needs = true; }
        else if (idle && !reduce) { yaw += dt * 0.35; needs = true; }
      }
      if (swapT < 1) {
        swapT = Math.min(1, swapT + dt / 0.35);
        var e2 = 1 - Math.pow(1 - swapT, 3), s = 0.86 + 0.14 * e2;
        models[current].scale.set(s, s, s); needs = true;
      }
      if (!needs) return;
      needs = false;
      place();
      renderer.render(scene, camera);
    }
    function start() { if (running || !visible) return; running = true; lastT = 0; needs = true; requestAnimationFrame(frame); }
    function stop() { running = false; }

    place(); renderer.render(scene, camera);
    return {
      canvas: canvas,
      setModel: function (id) {
        if (!models[id]) return;
        Object.keys(models).forEach(function (k) { models[k].visible = k === id; });
        swapT = reduce ? 1 : 0;
        if (reduce) models[id].scale.set(1, 1, 1);
        needs = true; start();
      },
      setVisible: function (v) { visible = v; if (v) start(); else stop(); },
      resize: resize
    };
  }

  // ---- escritorio: visor dentro del hero
  function bootInline() {
    if (!webglOK()) return;
    loadThree().then(function () {
      var v = createViewer(stage);
      if (!v) return;
      viewers.push(v);
      root.classList.add('is-3d');
      if (bar) bar.hidden = false;
      if (hint) hint.hidden = false;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { v.setVisible(en[0].isIntersecting); }).observe(stage);
      } else v.setVisible(true);
    }).catch(function () { /* sin red o sin CDN: queda el dibujo */ });
  }

  // ---- celular: burbuja + ventana emergente
  var mViewer = null, isOpen = false, opener = null;
  function openModal() {
    if (!modal) return;
    opener = document.activeElement;
    modal.hidden = false; isOpen = true;
    document.documentElement.classList.add('v3d-lock');
    try { history.pushState({ v3d: 1 }, ''); } catch (e) { /* sin historial */ }
    modal.querySelector('.v3d-x').focus();
    track('visor_3d', { accion: 'abrir', modelo: current });
    var msg = modal.querySelector('.v3d-msg');
    if (mViewer) { mViewer.resize(); mViewer.setVisible(true); return; }
    if (!webglOK()) { msg.textContent = 'Tu celular no permite ver el 3D. Podés ver las fotos en cada ficha.'; msg.hidden = false; return; }
    msg.textContent = 'Cargando 3D…'; msg.hidden = false;
    loadThree().then(function () {
      mViewer = createViewer(mstage);
      if (!mViewer) { msg.textContent = 'Tu celular no permite ver el 3D. Podés ver las fotos en cada ficha.'; return; }
      msg.hidden = true;
      viewers.push(mViewer);
      mViewer.setModel(current);
      mViewer.setVisible(isOpen);
    }).catch(function () { msg.textContent = 'No se pudo cargar el 3D. Revisá la conexión y probá de nuevo.'; });
  }
  function hideModal() {
    if (!isOpen) return;
    isOpen = false; modal.hidden = true;
    document.documentElement.classList.remove('v3d-lock');
    if (mViewer) mViewer.setVisible(false);
    if (opener && opener.focus) opener.focus();
  }
  function closeModal() {
    if (history.state && history.state.v3d) history.back(); // el popstate la cierra
    else hideModal();
  }
  if (modal) {
    modal.querySelector('.v3d-x').addEventListener('click', closeModal);
    window.addEventListener('popstate', hideModal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) closeModal(); });
    // al ir a la ficha desde la ventana, primero se cierra
    modal.querySelectorAll('[data-v3d-spec]').forEach(function (a) {
      a.addEventListener('click', function () { isOpen = false; document.documentElement.classList.remove('v3d-lock'); });
    });
  }

  if (INLINE) {
    var go = function () {
      if ('requestIdleCallback' in window) requestIdleCallback(bootInline, { timeout: 2500 }); else setTimeout(bootInline, 1200);
    };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  } else if (openBtn) {
    openBtn.hidden = false;
    openBtn.addEventListener('click', openModal);
  }
})();
