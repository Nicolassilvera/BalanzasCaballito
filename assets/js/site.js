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

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Revelado suave al entrar en pantalla (sin JS o con "reducir movimiento", todo se ve igual)
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var sel = '.sec-head, #modelos h2, .rubros, .card, .pay-note, .feat li, .paso, .buy-note, .gbox, .fotos li, .duo > .box, .qgrid > div, .cbox, .p-sec > h2, .spec-list, .perks li, .faq, .doc-box, .cal-step, .legal-sec, .doc-cta, .doc-stat';
    var items = document.querySelectorAll(sel);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) {
      var sibs = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = Math.min(sibs, 4) * 70 + 'ms';
      el.classList.add('rv');
      io.observe(el);
    });
  }

  // ---- Fotos reales: se inclinan siguiendo el mouse (solo con mouse)
  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.fotos figure').forEach(function (f) {
      f.addEventListener('pointermove', function (e) {
        var r = f.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        f.style.transform = 'perspective(800px) rotateX(' + (-y * 7).toFixed(2) + 'deg) rotateY(' + (x * 9).toFixed(2) + 'deg) translateY(-4px)';
      });
      f.addEventListener('pointerleave', function () { f.style.transform = ''; });
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
