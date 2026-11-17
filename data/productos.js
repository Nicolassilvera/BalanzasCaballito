// ===== Datos oficiales de producto: fuente única =====
// Si cambia un precio o una medida, cambialo ACÁ y después en el HTML estático
// (que tiene que coincidir para SEO):
//   - index.html: tarjetas de #modelos + JSON-LD (Product)
//   - balanza-150.html, balanza-300.html, balanza-500.html: ficha, "Otros modelos" y JSON-LD
// El asistente de reservas (assets/js/bot.js) lee estos datos directamente.
window.BC_DATOS = {
  whatsapp: '5491140591621',
  whatsappVisible: '11 4059-1621',
  direccion: 'Acoyte 236, Caballito, CABA',
  horario: 'Lunes a sábado de 10 a 22 (retiros solo con cita confirmada)',
  mail: 'tecnofanelectronic@gmail.com',
  garantia: '60 días con uso correcto + atención postventa siempre',
  bateria: '12 a 16 h; también funciona conectada a 220 V',
  productos: [
    { id: '150', nombre: 'Balanza de plataforma 150 kg', uso: 'Uso comercial', plataforma: '40 × 30 cm', precision: '20 g', sensor: '180 kg', ef: 100000, tr: 105000 },
    { id: '300', nombre: 'Balanza de plataforma 300 kg', uso: 'Depósito y logística', plataforma: '50 × 40 cm', precision: '50 g', sensor: '350 kg', ef: 130000, tr: 135000 },
    { id: '500', nombre: 'Balanza de plataforma 500 kg', uso: 'Cargas pesadas', plataforma: '60 × 45 cm', precision: '100 g', sensor: '550 kg', ef: 180000, tr: 185000 }
  ]
};
