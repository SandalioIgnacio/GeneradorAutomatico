/* Panel del superadmin (proveedor de la plataforma): panel general, empresas y avisos de vencimiento. */
(() => {
'use strict';
const { S, V, el, toast, modal, campo, fechaCorta, fechaHora, msgError, ocupado } = UI;
const claveModal = (...a) => UI.modalClave(...a);

V.panel = async (cont, vivo) => {
  const d = await Api.plataforma.panel(); if (!vivo()) return; const k = d.kpis;
  const kpi = (t, v, c) => el('div', { class: 'kpi ' + (c || '') }, el('small', { text: t }), el('b', { text: String(v) }));
  UI.add(cont, el('h1', { class: 'titulo', text: 'Panel de la plataforma' }),
    el('div', { class: 'kpis' }, kpi('Empresas', k.empresas), kpi('Activas', k.activas, 'ok'), kpi('Suspendidas', k.suspendidas), kpi('Vencidas', k.vencidas, k.vencidas ? 'warn' : ''), kpi('Vencen en 30 días', k.por_vencer, k.por_vencer ? 'warn' : ''), kpi('Operadores activos', k.usuarios), kpi('Registros (30 días)', k.registros_30d)),
    el('section', { class: 'panel' }, el('h2', { text: 'Empresas' }), d.empresas.length ? el('div', { class: 'tabla-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Empresa', 'Estado', 'Vence', 'Operadores', 'Registros 30 d', 'Último registro', 'Drive'].map((c) => el('th', { text: c })))),
      el('tbody', {}, d.empresas.map((e) => { const dr = e.dias_restantes;
        return el('tr', {}, el('td', { 'data-label': 'Empresa' }, el('strong', { text: e.nombre_empresa }), el('small', { class: 'hint', text: e.codigo })),
          el('td', { 'data-label': 'Estado' }, el('span', { class: 'badge ' + (e.estado === 'activo' ? 'ok' : 'bad'), text: e.estado === 'activo' ? 'Activa' : 'Suspendida' })),
          el('td', { 'data-label': 'Vence' }, e.vence ? fechaCorta(e.vence) + ' ' : '—', dr != null ? el('span', { class: 'badge ' + (dr < 0 ? 'bad' : dr <= 30 ? 'warn' : 'ok'), text: dr < 0 ? `vencida hace ${-dr} d` : `${dr} d` }) : null),
          el('td', { 'data-label': 'Operadores', class: 'mono', text: String(e.usuarios) }), el('td', { 'data-label': 'Registros 30 d', class: 'mono', text: String(e.registros_30d) }),
          el('td', { 'data-label': 'Último registro', text: e.ultimo_registro ? fechaHora(e.ultimo_registro) : '—' }), el('td', { 'data-label': 'Drive' }, el('span', { class: 'badge ' + (e.drive_vinculado ? 'ok' : 'warn'), text: e.drive_vinculado ? 'Vinculado' : 'Pendiente' }))); })))) : el('p', { class: 'vacio', text: 'Aún no hay empresas.' })));
};

V.empresas = async (cont, vivo) => {
  const zona = el('div'); UI.add(cont, el('div', { class: 'barra' }, el('h1', { class: 'titulo', text: 'Empresas' }), el('button', { class: 'btn pri', type: 'button', onclick: () => modalNueva() }, 'Nueva empresa')), zona);
  let datos;
  const cargar = async () => { datos = await Api.empresas.listar(); if (vivo()) pintar(); };
  const pintar = () => { const es = datos.empresas || [];
    UI.rep(zona, el('section', { class: 'panel' }, es.length ? el('div', { class: 'tabla-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Empresa', 'Código', 'Responsable', 'Vence', 'Estado', ''].map((c) => el('th', { text: c })))),
      el('tbody', {}, es.map((e) => el('tr', {},
        el('td', { 'data-label': 'Empresa', text: e.nombre_empresa }), el('td', { 'data-label': 'Código', text: e.codigo || '—' }), el('td', { 'data-label': 'Responsable', text: e.responsable || '—' }),
        el('td', { 'data-label': 'Vence', text: e.vence ? fechaCorta(e.vence) : '—' }),
        el('td', { 'data-label': 'Estado' }, el('span', { class: 'badge ' + (e.estado === 'activo' ? 'ok' : 'bad'), text: e.estado === 'activo' ? 'Activa' : 'Suspendida' })),
        el('td', { class: 'acc' }, el('button', { class: 'btn xs', type: 'button', onclick: () => modalEditar(e) }, 'Editar'),
          el('button', { class: 'btn xs', type: 'button', onclick: () => modalExtender(e) }, 'Extender'),
          el('button', { class: 'btn xs', type: 'button', onclick: () => cambiarEstado(e) }, e.estado === 'activo' ? 'Suspender' : 'Activar'),
          el('button', { class: 'btn xs', type: 'button', onclick: () => reiniciarAdmin(e) }, 'Reiniciar admin')))))))
      : el('p', { class: 'vacio', text: 'Aún no hay empresas.' }))); };
  const cambiarEstado = (e) => ocupado([], async () => { await Api.empresas.actualizar(e.id, { estado: e.estado === 'activo' ? 'suspendido' : 'activo' }); await cargar(); });
  const reiniciarAdmin = (e) => modal({ titulo: 'Reiniciar acceso del administrador', cuerpo: el('p', { text: `Se generará una contraseña temporal nueva para el administrador de ${e.nombre_empresa}.` }),
    botones: [{ texto: 'Reiniciar', onclick: async (d) => { try { const r = await Api.empresas.reiniciarAdmin(e.id); d.close(); claveModal(r.usuario, r.clave_temporal); } catch (x) { toast(msgError(x), true); } } }] });
  const modalExtender = (e) => {
    const n = el('input', { id: 'x_n', type: 'number', class: 'ctl', min: '1', max: '3650', value: '365' }), f = el('input', { id: 'x_f', type: 'date', class: 'ctl', value: e.vence ? String(e.vence).slice(0, 10) : '' }), err = el('p', { class: 'error', role: 'alert' });
    modal({ titulo: `Vigencia de ${e.nombre_empresa}`, cuerpo: [el('p', { class: 'sub', text: e.vence ? 'Vence el ' + fechaCorta(e.vence) + '.' : 'Sin fecha de vencimiento.' }), campo('x_n', 'Extender (días desde el vencimiento actual)', n), campo('x_f', 'O fijar una fecha exacta', f), err],
      botones: [{ texto: 'Extender días', onclick: async (d) => { try { await Api.empresas.actualizar(e.id, { extender_dias: Number(n.value) }); d.close(); toast('Vigencia extendida.'); await cargar(); } catch (x) { err.textContent = msgError(x); } } },
        { texto: 'Fijar fecha', clase: 'ghost', onclick: async (d) => { if (!f.value) { err.textContent = 'Elige una fecha.'; return; } try { await Api.empresas.actualizar(e.id, { vence: f.value }); d.close(); toast('Fecha actualizada.'); await cargar(); } catch (x) { err.textContent = msgError(x); } } }] });
  };
  const modalEditar = (e) => {
    const n = el('input', { id: 'ed_n', class: 'ctl', maxlength: '120', value: e.nombre_empresa }), r = el('input', { id: 'ed_r', class: 'ctl', maxlength: '120', value: e.responsable || '' }), g = el('input', { id: 'ed_g', class: 'ctl', type: 'email', value: e.gmail || '' }), err = el('p', { class: 'error', role: 'alert' });
    modal({ titulo: 'Editar empresa', cuerpo: [campo('ed_n', 'Nombre de la empresa', n), campo('ed_r', 'Responsable', r), campo('ed_g', 'Gmail operativo', g, 'Cambiarlo solo es posible mientras la carpeta de Drive no esté vinculada a otra cuenta.'), err],
      botones: [{ texto: 'Guardar', onclick: async (d) => { err.textContent = ''; try { await Api.empresas.actualizar(e.id, { nombre_empresa: n.value.trim(), responsable: r.value.trim(), gmail: g.value.trim().toLowerCase() }); d.close(); toast('Empresa actualizada.'); await cargar(); } catch (x) { err.textContent = msgError(x); } } }] });
  };
  function modalNueva() {
    const n = el('input', { id: 'e_n', class: 'ctl', maxlength: '120' }), r = el('input', { id: 'e_r', class: 'ctl', maxlength: '120' }), g = el('input', { id: 'e_g', class: 'ctl', type: 'email', autocomplete: 'off', inputmode: 'email' }), err = el('p', { class: 'error', role: 'alert' });
    modal({ titulo: 'Nueva empresa', cuerpo: [campo('e_n', 'Nombre de la empresa', n), campo('e_r', 'Responsable', r), campo('e_g', 'Gmail operativo', g, 'Es la cuenta de Google dueña de las carpetas de Drive de la empresa.'), err],
      botones: [{ texto: 'Crear empresa', onclick: async (d) => { err.textContent = '';
        if (!n.value.trim() || !r.value.trim() || !/^[^\s@]+@gmail\.com$/i.test(g.value.trim())) { err.textContent = 'Completa los tres datos; el correo debe ser de Gmail.'; return; }
        try { const x = await Api.empresas.crear(n.value.trim(), r.value.trim(), g.value.trim().toLowerCase()); d.close(); claveModal(x.usuario, x.clave_temporal, `Empresa creada. Código: ${x.codigo}. Entrega estos datos a su administrador.`); await cargar(); } catch (y) { err.textContent = msgError(y); } } }] });
  }
  await cargar();
};

V.avisos = async (cont, vivo) => {
  const c = (await Api.plataforma.avisosObtener()).config; if (!vivo()) return;
  const act = el('input', { type: 'checkbox', checked: c.activos }), cop = el('input', { type: 'checkbox', checked: c.copia_superadmin }), dias = el('input', { id: 'av_d', class: 'ctl', value: c.dias.join(', '), inputmode: 'numeric', placeholder: '30, 15, 7, 1' });
  const err = el('p', { class: 'error', role: 'alert' }), res = el('div');
  const guardar = el('button', { class: 'btn pri', type: 'button' }, 'Guardar'), ejecutar = el('button', { class: 'btn', type: 'button' }, 'Ejecutar ahora');
  guardar.addEventListener('click', () => { err.textContent = ''; const ds = dias.value.split(/[,\s]+/).filter(Boolean).map(Number);
    if (ds.some((n) => !Number.isInteger(n) || n < 1 || n > 365) || ds.length > 6) { err.textContent = 'Escribe hasta 6 plazos entre 1 y 365 días, separados por comas.'; return; }
    ocupado(guardar, async () => { const r = await Api.plataforma.avisosGuardar({ activos: act.checked, dias: ds, copia_superadmin: cop.checked }); dias.value = r.config.dias.join(', '); toast('Configuración guardada.'); }); });
  ejecutar.addEventListener('click', () => ocupado(ejecutar, async () => { const r = await Api.plataforma.avisosEjecutar(); UI.rep(res, el('p', { class: 'okmsg', text: `Revisión terminada: ${r.revisadas} empresas revisadas, ${r.enviados} avisos enviados.` })); }));
  UI.add(cont, el('h1', { class: 'titulo', text: 'Avisos de vencimiento' }), el('section', { class: 'panel' },
    el('p', { class: 'sub', text: 'Cada día el sistema revisa las suscripciones y envía un correo al Gmail de la empresa (y a su correo de contacto) al cruzar cada plazo. Cada plazo se avisa una sola vez; al renovar, se reinicia.' }),
    el('label', { class: 'chk' }, act, ' Avisos automáticos activados'), el('div', { style: 'height:10px' }), campo('av_d', 'Avisar cuando falten (días)', dias, 'Ejemplo: 30, 15, 7, 1'),
    el('label', { class: 'chk' }, cop, ' Enviarme copia a mí (cuenta del sistema)'), err, el('div', { class: 'acciones' }, guardar, ejecutar), res),
    el('section', { class: 'panel' }, el('h2', { text: 'Disparador diario' }), el('p', { class: 'sub', text: 'Se instala una sola vez desde el editor de Apps Script: ejecuta la función «instalarDisparador». Mientras tanto puedes usar «Ejecutar ahora».' })));
};
})();
