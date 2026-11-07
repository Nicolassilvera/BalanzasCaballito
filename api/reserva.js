// Vercel Serverless Function: recibe los checkpoints del asistente y avisa por mail con Resend.
// Variables de entorno (Vercel > Settings > Environment Variables):
//   RESEND_API_KEY  (obligatoria)  clave de https://resend.com/api-keys
//   RESEND_TO       (opcional)     a quién llega el aviso. Default: tecnofanelectronic@gmail.com
//   RESEND_FROM     (opcional)     remitente. Default: onboarding@resend.dev (solo envía al mail dueño de la cuenta
//                                  de Resend; para otro destino hay que verificar un dominio en Resend)

const STAGES = {
  seleccion: 'Armó un pedido en el asistente',
  contacto: 'Dejó sus datos para reservar',
  whatsapp: 'Tocó "Enviar pedido por WhatsApp"'
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n) : 0; };
const money = (n) => '$' + num(n).toLocaleString('es-AR');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).json({ ok: false });

  // Honeypot anti-bots: si viene completo, respondemos ok y no mandamos nada.
  if (b.website) return res.status(200).json({ ok: true });

  if (!STAGES[b.stage]) return res.status(400).json({ ok: false });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ ok: false, error: 'RESEND_API_KEY no configurada' });

  const id = clip(b.id, 8).replace(/[^A-Z0-9]/gi, '') || 'S/N';
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 10).map((i) => ({
    name: clip(i && i.name, 60), plat: clip(i && i.plat, 20), qty: Math.min(99, num(i && i.qty)), ef: num(i && i.ef)
  })).filter((i) => i.qty > 0);
  const t = b.totals || {};
  const nombre = clip(b.nombre, 60).trim();
  const tel = clip(b.telefono, 30).trim();
  const entrega = clip(b.entrega, 60);
  const localidad = clip(b.localidad, 80).trim();
  const waLink = tel ? 'https://wa.me/' + tel.replace(/\D/g, '').replace(/^0?(?:54)?9?/, '549') : '';

  const rows = items.map((i) => `<tr><td style="padding:4px 12px 4px 0">${i.qty}× ${esc(i.name)} <span style="color:#666">(${esc(i.plat)})</span></td><td style="text-align:right">${money(i.ef)}</td></tr>`).join('');
  const html = `
  <div style="font-family:Arial,sans-serif;font-size:15px;color:#14161A;max-width:560px">
    <p style="margin:0 0 4px;color:#D24E08;font-weight:700">Pedido #${esc(id)} · ${esc(STAGES[b.stage])}</p>
    <h2 style="margin:0 0 14px">${nombre ? esc(nombre) : 'Visitante sin nombre todavía'}</h2>
    <table style="border-collapse:collapse;width:100%">${rows || '<tr><td>Sin productos</td></tr>'}</table>
    <p style="margin:14px 0 4px"><b>Total contado:</b> ${money(t.ef)}<br><b>Total transferencia:</b> ${money(t.tr)}</p>
    ${entrega ? `<p style="margin:4px 0"><b>Entrega:</b> ${esc(entrega)}</p>` : ''}
    ${localidad ? `<p style="margin:4px 0"><b>Localidad:</b> ${esc(localidad)}</p>` : ''}
    ${tel ? `<p style="margin:4px 0"><b>WhatsApp:</b> ${esc(tel)}${waLink ? ` · <a href="${esc(waLink)}">escribirle</a>` : ''}</p>` : ''}
    <p style="margin:16px 0 0;color:#666;font-size:13px">Aviso automático del asistente de reservas de la web.</p>
  </div>`;
  const text = [
    `Pedido #${id} · ${STAGES[b.stage]}`,
    nombre && `Nombre: ${nombre}`,
    ...items.map((i) => `${i.qty}x ${i.name} (${i.plat}) ${money(i.ef)}`),
    `Total contado: ${money(t.ef)}`, `Total transferencia: ${money(t.tr)}`,
    entrega && `Entrega: ${entrega}`, localidad && `Localidad: ${localidad}`, tel && `WhatsApp: ${tel}`
  ].filter(Boolean).join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Balanzas Caballito <onboarding@resend.dev>',
        to: [process.env.RESEND_TO || 'tecnofanelectronic@gmail.com'],
        subject: `[Reserva web #${id}] ${STAGES[b.stage]}${nombre ? ' · ' + nombre : ''}`,
        html, text
      })
    });
    if (!r.ok) {
      // El detalle va a los logs de Vercel; al navegador solo el código de Resend.
      console.error('Resend rechazó el envío', r.status, await r.text());
      return res.status(502).json({ ok: false, resend: r.status });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('No se pudo contactar a Resend', e);
    return res.status(502).json({ ok: false, resend: 0 });
  }
};
