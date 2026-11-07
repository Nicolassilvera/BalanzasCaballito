// Menú móvil
function openMenu() {
  var m = document.getElementById('menu');
  m.hidden = false;
  document.querySelector('.burger').setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  var m = document.getElementById('menu');
  m.hidden = true;
  document.querySelector('.burger').setAttribute('aria-expanded', 'false');
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

// Formulario: arma el mensaje y abre WhatsApp
function sendViaWA(e) {
  if (e) e.preventDefault();
  var v = function (id) { return document.getElementById(id).value.trim(); };
  var text = encodeURIComponent(
    'Hola! Me contacto desde la web.\n\n' +
    'Nombre: ' + (v('f-nombre') || '(sin nombre)') + '\n' +
    'Teléfono: ' + v('f-tel') + '\n' +
    'Empresa: ' + v('f-empresa') + '\n' +
    'Modelo de interés: ' + (v('f-modelo') || 'No especificado') + '\n' +
    'Mensaje: ' + v('f-msg')
  );
  window.open('https://wa.me/5491140591621?text=' + text, '_blank', 'noopener');
}

// Galería de la página de producto: las miniaturas cambian la foto grande
document.querySelectorAll('[data-gal]').forEach(function (g) {
  var link = g.querySelector('.gal-main');
  var img = link.querySelector('img');
  var thumbs = g.querySelectorAll('.gal-thumbs button');
  thumbs.forEach(function (b) {
    b.addEventListener('click', function () {
      img.src = b.dataset.src; img.alt = b.dataset.alt;
      img.width = +b.dataset.w; img.height = +b.dataset.h;
      link.href = b.dataset.src;
      thumbs.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });
});
