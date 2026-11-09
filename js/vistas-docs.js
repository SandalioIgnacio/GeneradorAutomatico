/* Vistas de trabajo diario: Inicio, Documentos, Formulario, Historial, Modificar, Lotes y Reportes. */
(() => {
'use strict';
const { S, V, el, toast, modal, campo, fechaCorta, fechaHora, msgError, esAdmin, descargarBase64, descargarBlob, MIME, ocupado, csv, barrasH, lineas, dona, bs } = UI;
const FD = window.FormularioDinamico;
const tipoTxt = (t) => (t === 'EXCEL' ? 'Basado en Excel' : 'Basado en Word');
const aviso = () => S.susc && S.susc.vigente === false ? el('p', { class: 'alerta bad', role: 'alert', text: 'La suscripción de tu empresa está vencida: solo puedes consultar. Contacta a tu proveedor para renovarla.' }) : null;

/* ---------- Inicio ---------- */
V.inicio = async (cont, vivo) => {
  const nombre = (S.perfil.nombre || '').split(' ')[0] || 'bienvenido';
  UI.add(cont, el('h1', { class: 'titulo', text: `Hola, ${nombre}` }), aviso());
  if (!esAdmin()) {
    UI.add(cont, el('div', { class: 'tarjetas' },
      el('a', { class: 'tarjeta', href: '#/documentos' }, el('span', { class: 'ico', text: '＋' }), el('h3', { text: 'Nuevo documento' }), el('small', { text: `${S.plantillas.length} disponibles` })),
      el('a', { class: 'tarjeta', href: '#/historial' }, el('span', { class: 'ico', text: '☰' }), el('h3', { text: 'Mi historial' }), el('small', { text: 'Descarga o corrige lo que ya registraste' }))));
    const r = await Api.registros.listar({}); if (!vivo()) return;
    UI.add(cont, el('section', { class: 'panel' }, el('h2', { text: 'Tus últimos registros' }), r.registros.length ? listaHistorial(r.registros.slice(0, 5), () => {}) : el('p', { class: 'vacio', text: 'Aún no registraste documentos.' })));
    return;
  }
  const zona = el('div'), sel = el('select', { class: 'ctl', 'aria-label': 'Período' }, [[7, 'Últimos 7 días'], [30, 'Últimos 30 días'], [90, 'Últimos 90 días'], [365, 'Último año']].map(([v, t]) => el('option', { value: v, text: t, selected: v === 30 })));
  UI.add(cont, el('div', { class: 'barra' }, el('p', { class: 'mut', text: 'Resumen de la actividad de tu empresa' }), el('div', { style: 'min-width:190px' }, sel)), zona);
  const cargar = async () => {
    const d = await Api.reportes.dashboard(Number(sel.value)); if (!vivo()) return;
    const k = d.kpis, sus = d.suscripcion || {};
    const kpi = (t, v, c) => el('div', { class: 'kpi ' + (c || '') }, el('small', { text: t }), el('b', { text: String(v) }));
    UI.rep(zona, 
      sus.vence ? el('p', { class: 'aviso', text: `Suscripción ${sus.vigente ? 'vigente hasta' : 'vencida el'} ${fechaCorta(sus.vence)}.` }) : null,
      el('div', { class: 'kpis' }, kpi('Registros', k.registros), kpi('Documentos Word', k.word), kpi('Documentos PDF', k.pdf), kpi('Sin documento', k.sin_documento, k.sin_documento ? 'warn' : ''), kpi('Archivados', k.archivados), kpi('Operadores activos', k.usuarios_activos), kpi('Plantillas activas', k.plantillas_activas)),
      d.truncado ? el('p', { class: 'aviso mal', text: 'El período tiene demasiados registros; el resumen considera los más recientes.' }) : null,
      el('div', { class: 'charts' },
        el('div', { class: 'chart' }, el('h3', { text: d.dias > 90 ? 'Registros por mes' : 'Registros por día' }), lineas(d.por_dia)),
        el('div', { class: 'chart' }, el('h3', { text: 'Por tipo de archivo' }), el('div', { class: 'donut-fila' },
          dona([{ clase: 'seg-w', valor: k.word }, { clase: 'seg-p', valor: k.pdf }, { clase: 'seg-s', valor: k.sin_documento }]),
          el('div', { class: 'leyenda' }, el('span', {}, el('i', { class: 'w' }), `Word · ${k.word}`), el('span', {}, el('i', { class: 'p' }), `PDF · ${k.pdf}`), el('span', {}, el('i', { class: 's' }), `Solo datos · ${k.sin_documento}`)))),
        el('div', { class: 'chart' }, el('h3', { text: 'Por tipo de documento (plantilla)' }), barrasH(d.por_plantilla)),
        el('div', { class: 'chart' }, el('h3', { text: 'Por usuario' }), barrasH(d.por_usuario))));
  };
  sel.addEventListener('change', () => ocupado(sel, cargar)); await cargar();
};

/* ---------- Documentos: una tarjeta por plantilla, rotulada con el nombre que le dio la empresa ---------- */
V.documentos = async (cont, vivo, arg) => {
  if (arg) return V.formulario(cont, vivo, arg);
  UI.add(cont, el('h1', { class: 'titulo', text: 'Documentos' }), aviso());
  if (!S.plantillas.length) { UI.add(cont, el('section', { class: 'panel' }, el('p', { class: 'vacio', text: esAdmin() ? 'Aún no hay plantillas. Súbelas desde «Plantillas».' : 'No tienes documentos habilitados. Pide acceso a tu administrador.' }))); return; }
  const grupos = {}; for (const p of S.plantillas) (grupos[p.categoria || 'General'] ||= []).push(p);
  for (const [cat, items] of Object.entries(grupos)) {
    UI.add(cont, el('h2', { text: cat, style: 'margin:6px 0 10px' }), el('div', { class: 'tarjetas' }, items.map((p) =>
      el('button', { class: 'tarjeta', type: 'button', onclick: () => { location.hash = '#/documentos/' + encodeURIComponent(p.id); } },
        el('span', { class: 'ico', text: (p.nombre.trim()[0] || '?').toUpperCase() }), el('h3', { text: p.nombre }),
        el('small', { text: tipoTxt(p.tipo_archivo) + (p.descripcion ? ' · ' + p.descripcion : '') })))));
  }
};

/* ---------- Formulario dinámico ---------- */
V.formulario = async (cont, vivo, id) => {
  const pid = decodeURIComponent(id), pl0 = S.plantillas.find((p) => String(p.id) === pid);
  if (!pl0) throw new Error('No tienes acceso a este documento.');
  const r = await Api.formulario(pid); if (!vivo()) return;
  const pm = pl0.permisos || r.permisos || {}, puedeGenerar = pm.generar !== false, puedeRegistrar = pm.registrar !== false;
  const form = FD.crear(r, { sugerencia: 'Ej.: ' + pl0.nombre + ' – cliente' });
  if (!puedeGenerar) form.el.querySelector('.formatos')?.remove();
  const btnVer = el('button', { class: 'btn ghost', type: 'button' }, 'Vista previa');
  const btnGen = el('button', { class: 'btn pri', type: 'button' }, puedeGenerar ? 'Registrar y generar documento' : 'Registrar datos');
  const salida = el('div', { class: 'acciones' });
  btnVer.addEventListener('click', () => { if (!form.validar()) return; ocupado([btnVer, btnGen], async () => {
    const p = await Api.vistaPrevia(pid, form.leer());
    const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(p.base64), (c) => c.charCodeAt(0))], { type: 'application/pdf' }));
    const d = modal({ titulo: 'Vista previa', cerrarTexto: 'Cerrar', ancho: true, cuerpo: el('iframe', { src: url, title: 'Vista previa del documento', class: 'visor' }), botones: [] });
    d.addEventListener('close', () => URL.revokeObjectURL(url));
  }); });
  btnGen.addEventListener('click', () => { if (!form.validar()) return; ocupado([btnVer, btnGen], async () => {
    const g = await Api.enviar(pid, form.leer(), puedeGenerar ? form.formatos() : [], form.nombre());
    UI.rep(salida, el('p', { class: 'okmsg', style: 'width:100%', text: `Registro n.º ${g.num} guardado.${(g.archivos || []).length ? ' Los archivos se descargaron en tu equipo.' : ''}` }));
    for (const a of g.archivos || []) {
      if (a.base64) descargarBase64(a.base64, a.mime, a.nombre);
      salida.append(el('button', { class: 'chip ' + a.formato, type: 'button', title: 'Descargar otra vez', onclick: () => a.base64 && descargarBase64(a.base64, a.mime, a.nombre) }, '⬇ ' + a.nombre));
      if (a.drive_url && esAdmin()) salida.append(el('a', { class: 'btn xs', href: a.drive_url, target: '_blank', rel: 'noopener noreferrer', text: 'Abrir en Drive' }));
    }
    salida.append(el('a', { class: 'btn xs ghost', href: '#/historial', text: 'Ver historial' }));
    toast(puedeGenerar ? 'Registro guardado y documento generado.' : 'Registro guardado.');
  }); });
  UI.add(cont, el('a', { class: 'enlace', href: '#/documentos', text: '← Documentos' }), el('h1', { class: 'titulo', text: pl0.nombre }),
    r.plantilla && r.plantilla.descripcion ? el('p', { class: 'sub', text: r.plantilla.descripcion }) : null, aviso(),
    el('section', { class: 'panel' }, form.el, el('div', { class: 'acciones' }, btnVer, puedeRegistrar || puedeGenerar ? btnGen : null), salida));
};

/* ---------- Historial ---------- */
function chipsArchivos(r, alCambiar) {
  return el('div', { class: 'chips' }, r.archivos.length ? r.archivos.map((a) => {
    const fmt = a.formato.toUpperCase() + (a.desactualizado ? ' · desactualizado' : '');
    const descargar = el('button', { class: 'chip ' + a.formato + (a.desactualizado ? ' viejo' : ''), type: 'button', title: 'Descargar', onclick: (e) => ocupado(e.currentTarget, async () => { const d = await Api.registros.descargar(r.id, a.formato); descargarBase64(d.base64, d.mime, d.nombre); }) }, '⬇ ' + fmt);
    return esAdmin() && a.url ? el('span', { class: 'chips' }, descargar, el('a', { class: 'chip', href: a.url, target: '_blank', rel: 'noopener noreferrer', title: 'Abrir en Drive' }, '↗ Abrir ' + a.formato.toUpperCase())) : descargar;
  }) : el('span', { class: 'badge', text: 'Solo datos' }));
}
function modalGenerar(r, alCambiar) {
  const w = el('input', { type: 'checkbox', checked: r.tipo_archivo !== 'EXCEL', disabled: r.tipo_archivo === 'EXCEL' }), p = el('input', { type: 'checkbox', checked: true });
  modal({ titulo: `Generar documentos · n.º ${r.num}`, cuerpo: [el('p', { class: 'sub', text: r.archivos.length ? 'Si ya existe un archivo del mismo formato se reemplaza (mismo enlace), no se duplica.' : 'Se creará en el Drive de la empresa.' }),
    el('label', { class: 'chk' }, w, ' Word'), el('label', { class: 'chk' }, p, ' PDF')],
    botones: [{ texto: 'Generar', onclick: async (d) => { const f = [w.checked && 'docx', p.checked && 'pdf'].filter(Boolean); if (!f.length) return toast('Elige al menos un formato.', true);
      try { const g = await Api.registros.generar(r.id, f); for (const a of g.archivos || []) if (a.base64) descargarBase64(a.base64, a.mime, a.nombre); d.close(); toast('Documentos generados.'); await alCambiar(); } catch (x) { toast(msgError(x), true); } } }] });
}
function modalArchivar(r, alCambiar) {
  const m = el('textarea', { id: 'ar_m', maxlength: '300', rows: '3', placeholder: 'Ej.: el cliente desistió' }), err = el('p', { class: 'error', role: 'alert' });
  modal({ titulo: `Archivar registro n.º ${r.num}`, cuerpo: [el('p', { class: 'sub', text: 'El registro no se elimina: sale del historial activo, conserva sus archivos y la acción queda en la auditoría. Un administrador puede recuperarlo.' }), campo('ar_m', 'Motivo (obligatorio)', m), err],
    botones: [{ texto: 'Archivar', clase: 'bad', onclick: async (d) => { err.textContent = ''; if (m.value.trim().length < 3) { err.textContent = 'Escribe el motivo (mínimo 3 caracteres).'; return; }
      try { await Api.registros.archivar(r.id, m.value.trim()); d.close(); toast('Registro archivado.'); await alCambiar(); } catch (x) { err.textContent = msgError(x); } } }] });
}
function listaHistorial(filas, alCambiar) {
  return el('div', { class: 'lista-hist' }, filas.map((r) => {
    const acc = el('div', { class: 'acc' });
    if (!r.archivado) {
      if (r.puede.modificar) acc.append(el('a', { class: 'btn xs', href: '#/historial/editar/' + encodeURIComponent(r.id), text: 'Modificar' }));
      if (r.puede.generar) acc.append(el('button', { class: 'btn xs', type: 'button', onclick: () => modalGenerar(r, alCambiar) }, r.archivos.length ? 'Regenerar' : 'Generar'));
      if (r.puede.archivar) acc.append(el('button', { class: 'btn xs bad', type: 'button', onclick: () => modalArchivar(r, alCambiar) }, 'Archivar'));
    } else if (r.puede.recuperar) acc.append(el('button', { class: 'btn xs', type: 'button', onclick: () => ocupado([], async () => { await Api.registros.recuperar(r.id); toast('Registro recuperado.'); await alCambiar(); }) }, 'Recuperar'));
    return el('div', { class: 'fila-hist' + (r.archivado ? ' archivado' : '') },
      el('span', { class: 'num', text: '#' + r.num }),
      el('div', {}, el('div', { class: 'tit', text: r.nombre_archivo || r.plantilla }),
        el('div', { class: 'meta', text: `${r.plantilla} · ${r.usuario} · ${fechaHora(r.creado_el)}${r.revision > 1 ? ' · modificado ' + (r.revision - 1) + (r.revision === 2 ? ' vez' : ' veces') : ''}` }),
        r.archivado ? el('div', { class: 'meta', text: 'Archivado: ' + (r.archivado_motivo || '') }) : null),
      acc, chipsArchivos(r, alCambiar));
  }));
}
V.historial = async (cont, vivo, arg, arg2) => {
  if (arg === 'editar') return vModificar(cont, vivo, decodeURIComponent(arg2 || ''));
  const admin = esAdmin(), est = { pagina: 0 }, lista = el('div'), mas = el('div', { class: 'paginar' });
  let usuarios = [];
  if (admin) { try { usuarios = (await Api.usuarios.listar()).usuarios || []; } catch { /* sin filtro por usuario */ } if (!vivo()) return; }
  const f = {
    pl: el('select', { id: 'h_pl', class: 'ctl' }, el('option', { value: '', text: 'Todos' }), S.plantillas.map((p) => el('option', { value: p.id, text: p.nombre }))),
    us: admin ? el('select', { id: 'h_us', class: 'ctl' }, el('option', { value: '', text: 'Todos' }), usuarios.map((u) => el('option', { value: u.id, text: u.nombre || u.usuario }))) : null,
    q: el('input', { id: 'h_q', type: 'search', class: 'ctl', maxlength: '60', placeholder: 'Nombre o número' }),
    d: el('input', { id: 'h_d', type: 'date', class: 'ctl' }), h: el('input', { id: 'h_h', type: 'date', class: 'ctl' }),
    a: el('select', { id: 'h_a', class: 'ctl' }, el('option', { value: '0', text: 'Activos' }), el('option', { value: '1', text: 'Archivados' })),
  };
  const filtros = () => ({ pagina: est.pagina, ...(f.pl.value ? { plantilla_id: f.pl.value } : {}), ...(f.us && f.us.value ? { usuario_id: f.us.value } : {}), ...(f.q.value.trim() ? { buscar: f.q.value.trim() } : {}),
    ...(f.d.value ? { desde: f.d.value } : {}), ...(f.h.value ? { hasta: f.h.value } : {}), ...(f.a.value === '1' ? { archivados: true } : {}) });
  const cargar = async (acumular) => {
    if (!acumular) { est.pagina = 0; UI.rep(lista, ); }
    const r = await Api.registros.listar(filtros()); if (!vivo()) return;
    if (!acumular && !r.registros.length) UI.rep(lista, el('p', { class: 'vacio', text: 'No hay registros con esos filtros.' }));
    else { const nodo = listaHistorial(r.registros, () => cargar(false)); lista.append(...nodo.children.length ? [nodo] : []); }
    mas.replaceChildren(r.hay_mas ? el('button', { class: 'btn', type: 'button', onclick: (e) => ocupado(e.currentTarget, async () => { est.pagina++; await cargar(true); }) }, 'Cargar más') : '');
  };
  const buscar = el('button', { class: 'btn pri', type: 'button' }, 'Buscar'); buscar.addEventListener('click', () => ocupado(buscar, () => cargar(false)));
  f.q.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar.click(); });
  UI.add(cont, el('h1', { class: 'titulo', text: admin ? 'Historial de la empresa' : 'Mi historial' }), aviso(),
    el('div', { class: 'filtros' }, campo('h_pl', 'Documento', f.pl), f.us ? campo('h_us', 'Usuario', f.us) : null, campo('h_q', 'Buscar', f.q), campo('h_d', 'Desde', f.d, null, 'chico'), campo('h_h', 'Hasta', f.h, null, 'chico'), campo('h_a', 'Estado', f.a, null, 'chico'), buscar), lista, mas);
  await cargar(false);
};

/* ---------- Modificar un registro: reemplaza los archivos ya generados (no crea duplicados) ---------- */
async function vModificar(cont, vivo, id) {
  const d = await Api.registros.detalle(id); if (!vivo()) return;
  if (d.registro.archivado) throw new Error('Este registro está archivado. Pide que lo recuperen para modificarlo.');
  const form = FD.crear({ plantilla: d.plantilla, campos: d.campos }, { formatos: false });
  form.poner(d.registro.datos); form.ponerNombre(d.registro.nombre_archivo);
  const regeneran = d.registro.archivos.length && (esAdmin() || (d.permisos && d.permisos.generar));
  const b = el('button', { class: 'btn pri', type: 'button' }, 'Guardar cambios'), out = el('div');
  b.addEventListener('click', () => { if (!form.validar()) return; ocupado(b, async () => {
    const r = await Api.registros.modificar(id, form.leer(), form.nombre());
    if (r.sin_cambios) { UI.rep(out, el('p', { class: 'aviso', text: 'No hay cambios que guardar.' })); return; }
    toast(r.desactualizados ? 'Datos guardados. El documento quedó marcado como desactualizado.' : r.reemplazados.length ? 'Datos guardados y archivos reemplazados.' : 'Datos guardados.');
    location.hash = '#/historial';
  }); });
  UI.add(cont, el('a', { class: 'enlace', href: '#/historial', text: '← Historial' }), el('h1', { class: 'titulo', text: `Modificar n.º ${d.registro.num} · ${d.plantilla.nombre}` }),
    el('p', { class: regeneran ? 'aviso' : 'aviso mal', text: !d.registro.archivos.length ? 'Este registro todavía no tiene documentos; al guardar solo se actualizan los datos.' : regeneran ? 'Al guardar, los archivos Word/PDF existentes se reemplazan con los datos nuevos (mismo enlace). La modificación queda en la auditoría.' : 'No tienes permiso para generar documentos: se guardan los datos y los archivos quedan marcados como desactualizados hasta que alguien los regenere.' }),
    el('section', { class: 'panel' }, form.el, el('div', { class: 'acciones' }, b), out));
}

/* ---------- Lotes: pega filas desde Excel; un documento por fila (nunca se unen) ---------- */
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();
function leerNumero(t) {
  let s = String(t).trim().replace(/\s|Bs\.?|USD|\$/gi, ''); if (!s) return '';
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');   // 1.500 = mil quinientos (uso boliviano)
  const n = Number(s); return Number.isFinite(n) ? n : NaN;
}
function leerFecha(t) {
  const s = String(t).trim(); if (!s) return '';
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (m) return s;
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/.exec(s); if (!m) return null;
  const a = m[3].length === 2 ? '20' + m[3] : m[3]; return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
V.lotes = async (cont, vivo) => {
  const elegibles = S.plantillas.filter((p) => (p.permisos || {}).registrar !== false);
  UI.add(cont, el('h1', { class: 'titulo', text: 'Carga por lotes' }), aviso());
  if (!elegibles.length) { UI.add(cont, el('section', { class: 'panel' }, el('p', { class: 'vacio', text: 'No tienes documentos habilitados para registrar.' }))); return; }
  const sel = el('select', { id: 'l_pl', class: 'ctl' }, elegibles.map((p) => el('option', { value: p.id, text: p.nombre })));
  const caja = el('textarea', { id: 'l_t', class: 'pegar', spellcheck: 'false', placeholder: 'Pega aquí desde Excel: la primera fila son los títulos de las columnas.' });
  const w = el('input', { type: 'checkbox', checked: true }), p = el('input', { type: 'checkbox', checked: true });
  const guia = el('div'), prev = el('div'), prog = el('div'), est = { campos: null, filas: [] };
  const btnLeer = el('button', { class: 'btn', type: 'button' }, 'Revisar datos'), btnIr = el('button', { class: 'btn pri', type: 'button', disabled: true }, 'Generar documentos');
  const cargarCampos = async () => {
    const r = await Api.formulario(sel.value); if (!vivo()) return; est.campos = FD.normalizar(r.campos); est.excel = r.plantilla && r.plantilla.tipo_archivo === 'EXCEL';
    w.checked = !est.excel; w.disabled = est.excel; UI.rep(prev, ); btnIr.disabled = true; est.filas = [];
    UI.rep(guia, el('p', { class: 'sub' }, 'Columnas esperadas (en cualquier orden): ', est.campos.map((c, i) => [i ? ', ' : '', el('strong', { text: c.etiqueta }), c.requerido ? '*' : '']), '. Opcional: ', el('strong', { text: 'Nombre del archivo' }), '. Fechas como 21/04/2026 y montos como 1.500,50.'));
  };
  sel.addEventListener('change', () => ocupado(sel, cargarCampos));
  const analizar = () => {
    const lineas_ = caja.value.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
    if (lineas_.length < 2) { UI.rep(prev, el('p', { class: 'error', text: 'Pega al menos la fila de títulos y una fila de datos.' })); btnIr.disabled = true; return; }
    if (lineas_.length > 301) { UI.rep(prev, el('p', { class: 'error', text: 'Máximo 300 filas por lote.' })); btnIr.disabled = true; return; }
    const cab = lineas_[0].split('\t').map(norm), col = {}, faltan = [];
    for (const c of est.campos) { const i = cab.findIndex((h) => h === norm(c.etiqueta) || h === norm(c.nombre_marcador)); if (i < 0) { if (c.requerido) faltan.push(c.etiqueta); } else col[c.nombre_marcador] = i; }
    const iNombre = cab.findIndex((h) => ['nombre del archivo', 'nombre archivo', 'nombre'].includes(h));
    if (faltan.length) { UI.rep(prev, el('p', { class: 'error', text: 'Faltan columnas obligatorias: ' + faltan.join(', ') + '.' })); btnIr.disabled = true; return; }
    est.filas = lineas_.slice(1).map((l, n) => {
      const v = l.split('\t'), datos = {}, errs = [];
      for (const c of est.campos) {
        const i = col[c.nombre_marcador], crudo = i === undefined ? '' : (v[i] || '').trim();
        if (!crudo) { datos[c.nombre_marcador] = ''; if (c.requerido) errs.push(`${c.etiqueta} vacío`); continue; }
        if (c.tipo_dato === 'FECHA') { const f = leerFecha(crudo); if (!f) errs.push(`${c.etiqueta}: fecha inválida`); datos[c.nombre_marcador] = f || ''; }
        else if (c.tipo_dato === 'MONEDA' || c.tipo_dato === 'NUMERO') { const x = leerNumero(crudo); if (Number.isNaN(x)) errs.push(`${c.etiqueta}: número inválido`); datos[c.nombre_marcador] = Number.isNaN(x) ? '' : x; }
        else datos[c.nombre_marcador] = crudo;
      }
      return { n: n + 2, datos, nombre: iNombre >= 0 ? (v[iNombre] || '').trim() : '', errs };
    });
    const malas = est.filas.filter((f) => f.errs.length), buenas = est.filas.length - malas.length;
    UI.rep(prev, el('p', { class: malas.length ? 'aviso mal' : 'okmsg', text: `${est.filas.length} filas leídas: ${buenas} listas${malas.length ? ` y ${malas.length} con errores (se omitirán)` : ''}. Se creará un documento independiente por cada fila lista.` }),
      malas.length ? el('div', { class: 'log' }, malas.slice(0, 30).map((f) => el('div', { class: 'mal', text: `Fila ${f.n}: ${f.errs.join('; ')}` }))) : null);
    btnIr.disabled = buenas === 0;
  };
  btnLeer.addEventListener('click', analizar);
  btnIr.addEventListener('click', () => ocupado([btnIr, btnLeer, sel], async () => {
    const formatos = [w.checked && !est.excel && 'docx', p.checked && 'pdf'].filter(Boolean);
    if (!formatos.length) return toast('Elige al menos un formato.', true);
    const buenas = est.filas.filter((f) => !f.errs.length), barra = el('i'), log = el('div', { class: 'log' }), txt = el('p', { class: 'mut' });
    UI.rep(prog, el('div', { class: 'progreso' }, barra), txt, log); let ok = 0; const fallos = [];
    for (let i = 0; i < buenas.length; i++) {
      if (!vivo()) return; const f = buenas[i]; txt.textContent = `Procesando ${i + 1} de ${buenas.length}…`;
      for (let intento = 0; intento < 4; intento++) {
        try { const r = await Api.enviar(sel.value, f.datos, formatos, f.nombre || undefined, true); ok++; log.append(el('div', { text: `Fila ${f.n}: registro n.º ${r.num} ✓` })); break; }
        catch (x) {
          if (x.codigo === 'BLOQUEADO' && intento < 3) { txt.textContent = 'Pausa breve por límite de velocidad…'; await new Promise((s) => setTimeout(s, 20000)); continue; }
          fallos.push(f); log.append(el('div', { class: 'mal', text: `Fila ${f.n}: ${msgError(x)}` })); if (x.codigo === 'SESION' || x.codigo === 'SUSCRIPCION') return; break;
        }
      }
      barra.style.width = Math.round((i + 1) / buenas.length * 100) + '%'; log.scrollTop = log.scrollHeight;
    }
    txt.textContent = `Terminado: ${ok} documentos generados${fallos.length ? `, ${fallos.length} con error` : ''}. Los archivos están en el historial y en el Drive de la empresa.`;
    prog.append(el('div', { class: 'acciones' }, el('a', { class: 'btn', href: '#/historial', text: 'Ir al historial' })));
    toast(`Lote terminado: ${ok} generados.`, fallos.length > 0);
  }));
  UI.add(cont, el('section', { class: 'panel' }, el('div', { class: 'filtros' }, campo('l_pl', 'Documento', sel)), guia, campo('l_t', 'Datos copiados de Excel', caja),
    el('div', { class: 'row' }, el('label', { class: 'chk' }, w, ' Word'), el('label', { class: 'chk' }, p, ' PDF')), el('div', { class: 'acciones' }, btnLeer, btnIr), prev, prog));
  await cargarCampos();
};

/* ---------- Reportes ---------- */
V.reportes = async (cont, vivo) => {
  const pls = (await Api.reportes.plantillas()).plantillas || []; if (!vivo()) return;
  UI.add(cont, el('h1', { class: 'titulo', text: 'Reportes' }));
  if (!pls.length) { UI.add(cont, el('section', { class: 'panel' }, el('p', { class: 'vacio', text: 'No tienes reportes habilitados. El administrador debe darte el permiso «Reportes» en un documento.' }))); return; }
  let usuarios = []; if (esAdmin()) { try { usuarios = (await Api.usuarios.listar()).usuarios || []; } catch { /* sin filtro */ } if (!vivo()) return; }
  const sel = el('select', { id: 'r_pl', class: 'ctl' }, pls.map((p) => el('option', { value: p.id, text: p.nombre + (p.activa === false ? ' (archivada)' : '') })));
  const us = esAdmin() ? el('select', { id: 'r_us', class: 'ctl' }, el('option', { value: '', text: 'Todos' }), usuarios.map((u) => el('option', { value: u.id, text: u.nombre || u.usuario }))) : null;
  const d = el('input', { id: 'r_d', type: 'date', class: 'ctl' }), h = el('input', { id: 'r_h', type: 'date', class: 'ctl' }), arch = el('input', { type: 'checkbox' });
  const zona = el('div'), btn = el('button', { class: 'btn pri', type: 'button' }, 'Ver reporte'), btnCsv = el('button', { class: 'btn', type: 'button', disabled: true }, 'Exportar CSV');
  let ultimo = null;
  const valor = (c, v) => v === '' || v == null ? '' : c.tipo_dato === 'FECHA' ? fechaCorta(v) : c.tipo_dato === 'MONEDA' ? bs(v) : String(v);
  const ver = () => ocupado([btn, btnCsv], async () => {
    const r = await Api.reportes.datos({ plantilla_id: sel.value, ...(us && us.value ? { usuario_id: us.value } : {}), ...(d.value ? { desde: d.value } : {}), ...(h.value ? { hasta: h.value } : {}), ...(arch.checked ? { incluir_archivados: true } : {}) }); if (!vivo()) return;
    ultimo = r; btnCsv.disabled = !r.filas.length;
    const tot = Object.entries(r.totales || {}); const campo_ = (m) => r.campos.find((c) => c.nombre_marcador === m);
    UI.rep(zona, 
      el('div', { class: 'kpis' }, el('div', { class: 'kpi' }, el('small', { text: 'Registros' }), el('b', { text: String(r.total) })),
        tot.map(([m, t]) => el('div', { class: 'kpi' }, el('small', { text: 'Suma · ' + ((campo_(m) || {}).etiqueta || m) }), el('b', { text: (t.moneda ? (t.moneda === 'USD' ? 'USD ' : 'Bs ') : '') + bs(t.suma) })))),
      r.truncado ? el('p', { class: 'aviso mal', text: 'Se muestran solo los registros más recientes; acota las fechas para ver el resto.' }) : null,
      r.filas.length ? el('section', { class: 'panel' }, el('div', { class: 'tabla-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, el('th', { text: 'N.º' }), el('th', { text: 'Fecha' }), el('th', { text: 'Usuario' }), r.campos.map((c) => el('th', { text: c.etiqueta, class: c.tipo_dato === 'MONEDA' || c.tipo_dato === 'NUMERO' ? 'der' : '' })))),
        el('tbody', {}, r.filas.map((f) => el('tr', { class: f.archivado ? 'archivado' : '' }, el('td', { 'data-label': 'N.º', text: '#' + f.num }), el('td', { 'data-label': 'Fecha', text: fechaCorta(f.creado_el) }), el('td', { 'data-label': 'Usuario', text: f.usuario }),
          r.campos.map((c) => el('td', { 'data-label': c.etiqueta, class: c.tipo_dato === 'MONEDA' || c.tipo_dato === 'NUMERO' ? 'der mono' : '', text: valor(c, (f.datos || {})[c.nombre_marcador]) }))))))))
        : el('p', { class: 'vacio', text: 'No hay registros con esos filtros.' }));
  });
  btn.addEventListener('click', ver);
  btnCsv.addEventListener('click', () => { if (!ultimo) return; const r = ultimo;
    const filas = [['N.º', 'Fecha', 'Usuario', ...r.campos.map((c) => c.etiqueta)], ...r.filas.map((f) => [f.num, f.creado_el.slice(0, 10), f.usuario, ...r.campos.map((c) => (f.datos || {})[c.nombre_marcador] ?? '')])];
    descargarBlob(new Blob([csv(filas)], { type: 'text/csv;charset=utf-8' }), 'reporte_' + new Date().toISOString().slice(0, 10) + '.csv'); });
  UI.add(cont, el('div', { class: 'filtros' }, campo('r_pl', 'Documento', sel), us ? campo('r_us', 'Usuario', us) : null, campo('r_d', 'Desde', d, null, 'chico'), campo('r_h', 'Hasta', h, null, 'chico'),
    el('label', { class: 'chk' }, arch, ' Incluir archivados'), btn, btnCsv), zona);
  await ver();
};
})();
