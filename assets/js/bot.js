// ===== Asistente de reservas =====
// Precios: si cambian, actualizarlos acá Y en las tarjetas del catálogo (HTML).
(function () {
  'use strict';
  var WA = 'https://wa.me/5491140591621';
  var PRODS = [
    { id: '150', name: 'Báscula 150 kg', plat: '40x30 cm', ef: 100000, tr: 105000 },
    { id: '300', name: 'Báscula 300 kg', plat: '50x40 cm', ef: 130000, tr: 135000 },
    { id: '500', name: 'Báscula 500 kg', plat: '60x45 cm', ef: 180000, tr: 185000 }
  ];
  var ENTREGAS = {
    retiro: 'Retiro en Caballito',
    caba: 'Envío en CABA y alrededores',
    interior: 'Envío al interior (Vía Cargo)'
  };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // El panel se arma acá: cada página solo necesita incluir este archivo
  if (!document.getElementById('bot')) document.body.insertAdjacentHTML('beforeend', "<div class=\"bot\" id=\"bot\" role=\"dialog\" aria-labelledby=\"bot-title\" hidden>\n  <div class=\"bot-head\">\n    <img src=\"assets/img/nicolas.jpg\" alt=\"\" width=\"40\" height=\"40\">\n    <div><b id=\"bot-title\">Asistente de reservas</b><small><span class=\"on-dot\"></span>Te conecta con Nicolás</small></div>\n    <button class=\"bot-x\" type=\"button\" aria-label=\"Cerrar asistente\" data-bot-close>✕</button>\n  </div>\n  <div class=\"bot-log\" id=\"bot-log\" aria-live=\"polite\"></div>\n  <div class=\"bot-act\" id=\"bot-act\"></div>\n  <div class=\"bot-foot\">\n    <button type=\"button\" data-bot-compare>Ver fotos y comparar</button>\n    <a class=\"bot-direct\" href=\"https://wa.me/5491140591621?text=Hola%21%20Vengo%20de%20la%20web%2C%20estaba%20buscando%20una%20balanza%20y%20quer%C3%ADa%20hablar%20con%20alguien.\" target=\"_blank\" rel=\"noopener\">Hablar con alguien ya →</a>\n  </div>\n</div>");
  var panel = document.getElementById('bot');
  var log = document.getElementById('bot-log');
  var act = document.getElementById('bot-act');
  var opener = null;

  // phase: 'off' (sin abrir) | 'intro' (saludando) | 'pick' (selector activo) | 'after' (ya calculó)
  var st = { qty: {}, entrega: null, nombre: '', tel: '', localidad: '', hp: '', id: Math.random().toString(36).slice(2, 7).toUpperCase(), phase: 'off', mailOk: false };
  var pickUpd = {}; // funciones para refrescar cada fila del selector activo
  PRODS.forEach(function (p) { st.qty[p.id] = 0; });

  var fmt = function (n) { return '$' + n.toLocaleString('es-AR'); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function scroll() { log.scrollTop = log.scrollHeight; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }

  function totals() {
    var t = { ef: 0, tr: 0, items: [] };
    PRODS.forEach(function (p) {
      var q = st.qty[p.id];
      if (q > 0) { t.ef += q * p.ef; t.tr += q * p.tr; t.items.push({ name: p.name, plat: p.plat, qty: q, ef: q * p.ef, tr: q * p.tr }); }
    });
    return t;
  }

  // Mensaje del bot con "escribiendo..." antes
  // Los mensajes del bot salen de a uno, en orden, aunque se pidan a la vez
  var queue = Promise.resolve();
  function bot(content, wide) {
    queue = queue.then(function () { return say(content, wide); });
    return queue;
  }
  function say(content, wide) {
    var typing = el('div', 'msg msg--bot', '<span class="typing" aria-label="Escribiendo"><i></i><i></i><i></i></span>');
    log.appendChild(typing); scroll();
    return wait(520).then(function () {
      log.removeChild(typing);
      var m = el('div', 'msg msg--bot' + (wide ? ' msg--wide' : ''));
      if (typeof content === 'string') m.innerHTML = content; else m.appendChild(content);
      log.appendChild(m); scroll();
      return m;
    });
  }
  function me(text) { var m = el('div', 'msg msg--me'); m.textContent = text; log.appendChild(m); scroll(); }
  var lastActions = [], comparing = false;
  function actions(nodes) { lastActions = nodes; act.innerHTML = ''; nodes.forEach(function (n) { act.appendChild(n); }); }

  // Fotos reales para ver y comparar, en cualquier momento de la charla
  function compare() {
    if (comparing) return;
    comparing = true;
    act.innerHTML = '';
    me('Quiero verlas y compararlas');
    var fig = el('figure', 'bot-fig');
    fig.innerHTML = '<a href="assets/img/comparativa.jpg" target="_blank" rel="noopener"><img src="assets/img/comparativa.jpg" alt="Las tres balanzas juntas: 500 kg azul a la izquierda, 300 kg al medio y 150 kg a la derecha" width="944" height="1000"></a>' +
      '<figcaption>De izquierda a derecha: <strong>500 kg</strong> (azul, base 60×45), <strong>300 kg</strong> (50×40) y <strong>150 kg</strong> (40×30).</figcaption>';
    var g = el('div', 'bot-gal');
    PRODS.forEach(function (p) {
      g.innerHTML += '<a href="assets/img/balanza-' + p.id + '.jpg" target="_blank" rel="noopener"><img src="assets/img/balanza-' + p.id + '.jpg" alt="' + p.name + '" loading="lazy"><span>' + p.id + ' kg</span></a>';
    });
    bot('Acá las tenés juntas, son fotos reales nuestras:');
    bot(fig, true);
    bot(g, true);
    bot('Tocá cualquier foto para verla grande. Si querés, Nicolás te manda un video del stock con la hora del momento.').then(function () {
        comparing = false;
        actions(lastActions);
      });
  }
  function chip(label, fn) { var b = el('button', 'chip'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); return b; }

  // Checkpoints por mail (Resend). Si falla (o no hay backend), el flujo sigue igual.
  function checkpoint(stage) {
    var t = totals();
    var body = {
      stage: stage, id: st.id, items: t.items, totals: { ef: t.ef, tr: t.tr },
      entrega: st.entrega ? ENTREGAS[st.entrega] : '', localidad: st.localidad, nombre: st.nombre, telefono: st.tel, website: st.hp
    };
    try {
      return fetch('api/reserva', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
        .then(function (r) { return r.ok; }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  // ---- 1. elegir modelos y cantidades
  function picker() {
    var box = el('div', 'pick');
    var live = el('p', 'pick-live');
    var calcBtn = el('button', 'btn', 'Calcular total'); calcBtn.type = 'button';
    function refresh() {
      var t = totals();
      live.innerHTML = t.items.length ? 'Contado <strong>' + fmt(t.ef) + '</strong> · Transferencia <strong>' + fmt(t.tr) + '</strong>' : 'Sumá al menos una balanza.';
      calcBtn.disabled = !t.items.length;
      calcBtn.style.opacity = t.items.length ? '' : '.5';
    }
    PRODS.forEach(function (p) {
      var row = el('div', 'pick-row');
      row.appendChild(el('div', '', '<b>' + p.name + '</b><small>Base ' + p.plat + '<br>' + fmt(p.ef) + ' contado · ' + fmt(p.tr) + ' transf.</small>'));
      var q = el('div', 'qty');
      var minus = el('button', '', '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'Quitar una ' + p.name);
      var out = el('output'); out.setAttribute('aria-label', 'Cantidad ' + p.name);
      var plus = el('button', '', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'Sumar una ' + p.name);
      function upd() { out.textContent = st.qty[p.id]; minus.disabled = st.qty[p.id] === 0; refresh(); }
      minus.addEventListener('click', function () { st.qty[p.id] = Math.max(0, st.qty[p.id] - 1); upd(); });
      plus.addEventListener('click', function () { st.qty[p.id] = Math.min(50, st.qty[p.id] + 1); upd(); });
      q.appendChild(minus); q.appendChild(out); q.appendChild(plus);
      row.appendChild(q); box.appendChild(row);
      pickUpd[p.id] = upd;
      upd();
    });
    box.appendChild(live);
    refresh();
    st.phase = 'pick';
    calcBtn.addEventListener('click', function () {
      box.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      st.phase = 'after'; pickUpd = {};
      calc();
    });
    return bot(box, true).then(function () { actions([calcBtn]); });
  }

  // "Reservar" desde una tarjeta: suma esa balanza al carrito en cualquier momento
  function addProduct(id) {
    var p = PRODS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    st.qty[id] = Math.min(50, st.qty[id] + 1);
    if (st.phase === 'pick' && pickUpd[id]) { pickUpd[id](); return; }
    if (st.phase === 'after') {
      st.phase = 'intro';
      actions([]);
      me('Sumame una báscula de ' + p.id + ' kg');
      picker();
    }
    // en 'intro' el selector todavía no apareció: va a salir con la cantidad ya sumada
  }

  // ---- 2. resumen con efectivo, transferencia y diferencia
  function calc() {
    var t = totals();
    actions([]);
    me(t.items.map(function (i) { return i.qty + '× ' + i.name.replace('Báscula ', ''); }).join(', '));
    var lines = t.items.map(function (i) {
      return '<div><span>' + i.qty + '× ' + i.name + '</span><span>' + fmt(i.ef) + '</span></div>';
    }).join('');
    var html = '<div class="sum"><div class="sum-lines">' + lines + '</div>' +
      'En efectivo: <strong>' + fmt(t.ef) + '</strong><br>' +
      'Por transferencia: <strong>' + fmt(t.tr) + '</strong><br>' +
      'Pagando en efectivo te ahorrás <span class="save">' + fmt(t.tr - t.ef) + '</span>.</div>';
    checkpoint('seleccion');
    bot(html, true);
    bot('¿Cómo la querés recibir?').then(function () {
        actions([
          chip('Retiro en Caballito', function () { entrega('retiro'); }),
          chip('Envío en CABA y alrededores', function () { entrega('caba'); }),
          chip('Envío al interior', function () { entrega('interior'); }),
          chip('Cambiar cantidades', function () { st.phase = 'intro'; actions([]); me('Quiero cambiar las cantidades'); picker(); })
        ]);
      });
  }

  // ---- 3. entrega + tranquilidad
  function entrega(tipo) {
    st.entrega = tipo;
    actions([]);
    me(ENTREGAS[tipo]);
    var txt = {
      retiro: 'Perfecto, retirás en <strong>Acoyte 236, Caballito</strong>. <strong>No cobramos nada por adelantado</strong>: pagás todo en el momento, después de probar las balanzas.',
      caba: 'Hacemos envíos <strong>en el día</strong> en CABA y alrededores. <strong>No cobramos nada por adelantado</strong>: pagás al recibir, después de probarla.',
      interior: 'Al interior despachamos por <strong>Vía Cargo</strong>: como atendemos retiros en el local, no podemos viajar lejos. Para el envío te conecto con <strong>Nicolás</strong>, que te cotiza el flete. Generalmente se le abona directo a Vía Cargo.'
    }[tipo];
    var ask = tipo === 'interior'
      ? 'Para que te quedes tranquilo, Nico te muestra un <strong>video del stock con la hora del momento</strong> y <strong>comprobantes de despachos por Vía Cargo</strong>. Después cierran todo con él. ¿Te conecto?'
      : '¿La reservamos? Te conecto con <strong>Nicolás</strong> para confirmar: te manda un <strong>video del stock con la hora del momento</strong>, donde se ven las balanzas, y cerrás todo con él.';
    var yes = tipo === 'interior' ? 'Sí, conectame con Nico' : 'Sí, quiero reservar';
    bot(txt);
    bot(ask).then(function () {
        actions([
          chip(yes, function () { datos(yes); }),
          chip('Solo quería saber el precio', function () {
            actions([]); me('Solo quería saber el precio');
            bot('Dale, sin problema. Cuando quieras reservar, volvé a tocar <strong>Reservar Balanza YA</strong> o escribinos.').then(function () {
              actions([chip('Ahora sí, reservar', function () { datos('Ahora sí, reservar'); })]);
            });
          })
        ]);
      });
  }

  // ---- 4. datos mínimos
  function datos(label) {
    var interior = st.entrega === 'interior';
    actions([]);
    me(typeof label === 'string' ? label : 'Sí, quiero reservar');
    bot('Genial. ¿Cómo te llamás?' + (interior ? ' Contame también a qué localidad va, así Nico te cotiza el envío.' : '') + ' Si me dejás tu WhatsApp, te escribimos nosotros por si el mensaje no llega.').then(function () {
      var f = el('form', 'bot-form');
      f.innerHTML =
        '<label>Nombre<input name="nombre" autocomplete="name" required maxlength="60" placeholder="Tu nombre"></label>' +
        (interior ? '<label>Localidad y provincia<input name="localidad" autocomplete="address-level2" maxlength="80" placeholder="Ej: Rosario, Santa Fe"></label>' : '') +
        '<label>WhatsApp (opcional)<input name="tel" type="tel" autocomplete="tel" maxlength="30" placeholder="11 1234-5678"></label>' +
        '<label class="hp" aria-hidden="true">Web<input name="website" tabindex="-1" autocomplete="off"></label>' +
        '<p class="bot-err" hidden>Poné tu nombre así Nicolás sabe con quién habla.</p>' +
        '<button class="btn" type="submit">Continuar</button>';
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var n = f.nombre.value.trim();
        if (!n) { f.querySelector('.bot-err').hidden = false; f.nombre.focus(); return; }
        st.nombre = n; st.tel = f.tel.value.trim(); st.hp = f.website.value;
        st.localidad = f.localidad ? f.localidad.value.trim() : '';
        enviar();
      });
      actions([f]);
      f.nombre.focus();
    });
  }

  // ---- 5. conectar por WhatsApp (+ mail de respaldo)
  function waText() {
    var t = totals();
    var m = 'Hola Nicolás! Vengo del asistente de la web. Pedido #' + st.id + '\n\n';
    t.items.forEach(function (i) { m += i.qty + 'x ' + i.name + ' (' + i.plat + ')\n'; });
    m += '\nTotal contado: ' + fmt(t.ef) + '\nTotal transferencia: ' + fmt(t.tr) + '\n';
    m += 'Entrega: ' + ENTREGAS[st.entrega] + '\n';
    if (st.localidad) m += 'Localidad: ' + st.localidad + '\n';
    m += 'Nombre: ' + st.nombre + '\n';
    if (st.tel) m += 'WhatsApp: ' + st.tel + '\n';
    m += st.entrega === 'interior'
      ? '\nQuiero reservar y cotizar el envío por Vía Cargo. ¿Me pasás el video del stock y los comprobantes de despacho?'
      : '\nQuiero reservar. ¿Me pasás el video del stock de hoy?';
    return m;
  }
  function enviar() {
    actions([]);
    me([st.nombre, st.localidad, st.tel].filter(Boolean).join(' · '));
    checkpoint('contacto').then(function (ok) { st.mailOk = ok; });
    bot('Listo, <strong>' + esc(st.nombre) + '</strong>. Tocá el botón y tu pedido le llega a Nicolás por WhatsApp.').then(function () {
      var a = el('a', 'btn', 'Enviar pedido por WhatsApp');
      a.href = WA + '?text=' + encodeURIComponent(waText());
      a.target = '_blank'; a.rel = 'noopener';
      a.addEventListener('click', function () {
        checkpoint('whatsapp');
        setTimeout(function () {
          var extra = st.mailOk && st.tel ? ' Si WhatsApp no se abrió, tranqui: tu pedido ya nos llegó y te escribimos nosotros al ' + esc(st.tel) + '.' : '';
          var fin = st.entrega === 'interior'
            ? 'Ya está. Nico te responde con el <strong>video del stock con la hora del momento</strong>, los <strong>comprobantes de despacho</strong> y la cotización del envío por Vía Cargo.'
            : 'Ya está. Nicolás te responde con el <strong>video del stock con la hora del momento</strong> y cierran la reserva. Recordá: <strong>no se cobra nada por adelantado</strong>.';
          bot(fin + extra).then(function () {
            actions([a, chip('Armar otro pedido', reiniciar)]);
          });
        }, 400);
      });
      actions([a]);
    });
  }

  function reiniciar() {
    PRODS.forEach(function (p) { st.qty[p.id] = 0; });
    st.entrega = null; st.id = Math.random().toString(36).slice(2, 7).toUpperCase();
    log.innerHTML = ''; actions([]); start();
  }

  function start(pre) {
    st.phase = 'intro';
    if (pre && st.qty[pre] !== undefined) st.qty[pre] = Math.max(1, st.qty[pre]);
    bot('¡Hola! Soy el asistente de <strong>Balanzas Caballito</strong>.');
    bot('Elegí los modelos y las cantidades que quieras, una sola o varias. Te calculo el total al toque.');
    picker();
  }

  function open(pre, from) {
    opener = from || document.activeElement;
    panel.hidden = false;
    document.documentElement.classList.add('bot-open');
    if (st.phase === 'off') start(pre);
    else if (pre) addProduct(pre);
    panel.querySelector('.bot-x').focus();
  }
  function close() {
    panel.hidden = true;
    document.documentElement.classList.remove('bot-open');
    if (opener && opener.focus) opener.focus();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-bot]');
    if (t) { e.preventDefault(); open(t.getAttribute('data-bot'), t); return; }
    if (e.target.closest('[data-bot-close]')) close();
    if (e.target.closest('[data-bot-compare]')) { if (st.phase === 'off') start(); compare(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
})();
