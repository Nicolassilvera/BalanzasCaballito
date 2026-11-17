// Balanzas Caballito — comportamiento compartido (vanilla, sin dependencias)
(function () {
  'use strict';

  // ---- Analítica (Vercel Analytics). Si no está activa, los eventos se descartan sin error.
  function track(name, data) {
    try { if (typeof window.va === 'function') window.va('event', { name: name, data: data || {} }); } catch (e) { /* sin analítica */ }
  }
  window.bcTrack = track; // lo usa el asistente (bot.js)

  document.addEventListener('click', function (e) {
    var wa = e.target.closest('[data-wa]');
    if (wa) track('whatsapp_click', { section: wa.getAttribute('data-wa') });
    var ficha = e.target.closest('[data-ficha]');
    if (ficha) track('ver_ficha', { modelo: ficha.getAttribute('data-ficha') });
  });

  // ---- Selector de rubro: marca la tarjeta recomendada. Tocar de nuevo deselecciona.
  var pills = document.querySelectorAll('.pill[data-rubro]');
  var cards = document.querySelectorAll('.card[data-model]');
  var live = document.getElementById('rubro-live');
  if (pills.length && cards.length) {
    var setRec = function (model) {
      cards.forEach(function (c) {
        var on = c.getAttribute('data-model') === model;
        c.classList.toggle('is-rec', on);
        // sin selección, la de 300 kg queda destacada por defecto
        c.classList.toggle('is-featured', !model && c.getAttribute('data-model') === '300');
        var tag = c.querySelector('.tag--rec');
        if (tag) tag.hidden = !on;
      });
      if (live) live.textContent = model ? 'Te recomendamos la balanza de ' + model + ' kg.' : '';
    };
    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        var was = p.getAttribute('aria-pressed') === 'true';
        pills.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        if (was) { setRec(null); return; }
        p.setAttribute('aria-pressed', 'true');
        setRec(p.getAttribute('data-rec'));
        track('rubro_select', { rubro: p.getAttribute('data-rubro') });
      });
    });
  }

  // ---- Galería de la ficha: las miniaturas cambian la foto grande
  document.querySelectorAll('[data-gal]').forEach(function (g) {
    var link = g.querySelector('.gal-main');
    var img = link.querySelector('img');
    var thumbs = g.querySelectorAll('.gal-thumbs button');
    thumbs.forEach(function (b) {
      b.addEventListener('click', function () {
        img.src = b.dataset.src; img.alt = b.dataset.alt;
        img.width = +b.dataset.w; img.height = +b.dataset.h;
        link.href = b.dataset.href || b.dataset.src;
        thumbs.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
    });
  });
})();
