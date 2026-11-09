/* Plantillas (administrador): subir Word/Excel, escanear marcadores y definir tipo y formato de cada campo. */
(() => {
'use strict';
const { S, V, el, toast, campo, msgError } = UI;
const FormularioDinamico = window.FormularioDinamico;
/* ---------- Plantillas (admin_cliente): subir Word/Excel, escanear marcadores y asignar tipo y formato ---------- */
const FMT_FECHA = ['dd/mm/aaaa', 'dd/mm/aa', 'dd/mmmm/aaaa', 'd de mmmm de aaaa', 'dd de mmmm de aaaa', 'dddd, d de mmmm de aaaa'];
const FMT_NUM = [['#.##0,00', '1.234,56'], ['0,00', '1234,56'], ['#,##0.00', '1,234.56'], ['0.00', '1234.56'], ['0', '1234']];
const TIPOS_CAMPO = [['TEXTO', 'Texto'], ['FECHA', 'Fecha'], ['MONEDA', 'Moneda'], ['NUMERO', 'Número'], ['PARRAFO', 'Párrafo (texto largo)']];

/** Editor del mapeo: una tarjeta por marcador con etiqueta, tipo y su formato. valores() devuelve la configuración lista para enviar. */
function editorCampos(campos) {
  const filas = campos.map((c) => {
    const est = { nombre_marcador: c.nombre_marcador, etiqueta: c.etiqueta || '', tipo_dato: c.tipo_dato || 'TEXTO', formato_fecha: c.formato_fecha || 'dd/mm/aaaa',
      formato_numero: c.formato_numero || (c.tipo_dato === 'NUMERO' ? '0' : '#.##0,00'), moneda_tipo: c.moneda_tipo || 'BOB', requiere_literal: !!c.requiere_literal, requerido: c.requerido !== false };
    const extra = el('div', { class: 'cfg-extra' }), id = 'cf_' + c.nombre_marcador;
    const pintar = () => {
      const t = est.tipo_dato, partes = [];
      if (t === 'FECHA') {
        const prede = FMT_FECHA.includes(est.formato_fecha), sel = el('select', { class: 'ctl', 'aria-label': 'Formato de fecha' }, FMT_FECHA.map((f) => el('option', { value: f, text: f, selected: f === est.formato_fecha })), el('option', { value: '__otro', text: 'Otro…', selected: !prede }));
        const otro = el('input', { class: 'ctl', value: prede ? '' : est.formato_fecha, placeholder: 'ej.: dd-mm-aaaa', maxlength: '40', hidden: prede, 'aria-label': 'Formato de fecha personalizado' });
        const ej = el('small', { class: 'ej' }), ver = () => { ej.textContent = 'Ejemplo: ' + (FormularioDinamico.fechaConMascara('2026-04-21', est.formato_fecha) || '—'); };
        sel.addEventListener('change', () => { if (sel.value === '__otro') { otro.hidden = false; otro.focus(); est.formato_fecha = otro.value || 'dd/mm/aaaa'; } else { otro.hidden = true; est.formato_fecha = sel.value; } ver(); });
        otro.addEventListener('input', () => { est.formato_fecha = otro.value.trim() || 'dd/mm/aaaa'; ver(); }); ver();
        partes.push(el('label', {}, 'Formato de la fecha en el documento', sel), otro, ej);
      }
      if (t === 'MONEDA' || t === 'NUMERO') {
        const prede = FMT_NUM.some(([f]) => f === est.formato_numero);
        const sel = el('select', { class: 'ctl', 'aria-label': 'Formato numérico' }, FMT_NUM.map(([f, e]) => el('option', { value: f, text: `${f}  (${e})`, selected: f === est.formato_numero })));
        if (!prede) sel.append(el('option', { value: est.formato_numero, text: est.formato_numero, selected: true }));
        sel.addEventListener('change', () => { est.formato_numero = sel.value; });
        partes.push(el('label', {}, 'Formato numérico', sel));
      }
      if (t === 'MONEDA') {
        const mon = el('select', { class: 'ctl', 'aria-label': 'Moneda' }, [['BOB', 'Bolivianos (Bs)'], ['USD', 'Dólares americanos (USD)']].map(([v, tx]) => el('option', { value: v, text: tx, selected: v === est.moneda_tipo })));
        mon.addEventListener('change', () => { est.moneda_tipo = mon.value; });
        const lit = el('input', { type: 'checkbox', checked: est.requiere_literal }); lit.addEventListener('change', () => { est.requiere_literal = lit.checked; });
        partes.push(el('label', {}, 'Moneda', mon), el('label', { class: 'chk' }, lit, ' Escribir también el monto en letras (ej.: Bs3.500,25 (Tres Mil Quinientos 25/100 Bolivianos))'));
      }
      extra.replaceChildren(...partes);
    };
    const tipo = el('select', { class: 'ctl', id: id + '_t', 'aria-label': 'Tipo de dato de ' + c.nombre_marcador }, TIPOS_CAMPO.map(([v, t]) => el('option', { value: v, text: t, selected: v === est.tipo_dato })));
    tipo.addEventListener('change', () => { est.tipo_dato = tipo.value; pintar(); });
    const etq = el('input', { class: 'ctl', id: id + '_e', value: est.etiqueta, maxlength: '80', placeholder: 'Nombre que verá el usuario' }); etq.addEventListener('input', () => { est.etiqueta = etq.value; });
    const req = el('input', { type: 'checkbox', checked: est.requerido }); req.addEventListener('change', () => { est.requerido = req.checked; });
    pintar();
    const info = [c.apariciones ? `${c.apariciones} ${c.apariciones === 1 ? 'aparición' : 'apariciones'}` : null, c.celdas && c.celdas.length ? 'celda ' + c.celdas.join(', ') : null].filter(Boolean).join(' · ');
    const nodo = el('fieldset', { class: 'cfg' }, el('legend', {}, el('code', { text: c.nombre_marcador }), info ? el('small', { text: '  ' + info }) : null),
      el('div', { class: 'cfg-fila' }, el('label', { for: id + '_e' }, 'Etiqueta', etq), el('label', { for: id + '_t' }, 'Tipo', tipo), el('label', { class: 'chk' }, req, ' Obligatorio')), extra);
    return { est, nodo };
  });
  return { nodo: el('div', { class: 'cfg-lista' }, filas.map((f) => f.nodo)), valores: () => filas.map(({ est }) => {
    const o = { nombre_marcador: est.nombre_marcador, etiqueta: est.etiqueta.trim(), tipo_dato: est.tipo_dato, requerido: est.requerido };
    if (est.tipo_dato === 'FECHA') o.formato_fecha = est.formato_fecha;
    if (est.tipo_dato === 'MONEDA' || est.tipo_dato === 'NUMERO') o.formato_numero = est.formato_numero;
    if (est.tipo_dato === 'MONEDA') { o.moneda_tipo = est.moneda_tipo; o.requiere_literal = est.requiere_literal; }
    return o;
  }) };
}
const leerBase64 = (archivo) => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => mal(new Error('No se pudo leer el archivo.')); r.readAsDataURL(archivo); });

async function vPlantillas(cont, vivo) {
  const zona = el('div');
  UI.add(cont, el('div', { class: 'filtros' }, el('h1', { class: 'titulo', text: 'Plantillas' }), el('a', { class: 'btn pri', href: '#/plantillas/nueva', text: 'Nueva plantilla' })), zona);
  const cargar = async () => { const d = await Api.plantillas.listar(); if (vivo()) pintar(d.plantillas || []); };
  const pintar = (ps) => UI.rep(zona, el('section', { class: 'panel' }, ps.length ? el('div', { class: 'tabla-wrap' }, el('table', {},
    el('thead', {}, el('tr', {}, ['Plantilla', 'Categoría', 'Origen', 'Campos', 'Estado', ''].map((c) => el('th', { text: c })))),
    el('tbody', {}, ps.map((p) => el('tr', {},
      el('td', { 'data-label': 'Plantilla', text: p.nombre }), el('td', { 'data-label': 'Categoría', text: p.categoria }),
      el('td', { 'data-label': 'Origen', text: p.tipo_archivo === 'EXCEL' ? `Excel · hoja ${p.hoja || ''}` : 'Word' }), el('td', { 'data-label': 'Campos', text: String(p.n_campos) }),
      el('td', { 'data-label': 'Estado' }, el('span', { class: 'badge ' + (p.activa ? 'ok' : 'warn'), text: p.activa ? 'Activa' : 'Archivada' })),
      el('td', { class: 'acc' }, el('a', { class: 'btn xs', href: '#/plantillas/' + encodeURIComponent(p.id), text: 'Editar campos' }),
        el('button', { class: 'btn xs', type: 'button', onclick: async () => { try { await Api.plantillas.actualizar(p.id, { activa: !p.activa }); await cargar(); } catch (x) { toast(msgError(x), true); } } }, p.activa ? 'Archivar' : 'Reactivar')))))))
    : el('p', { class: 'vacio', text: 'Aún no tienes plantillas. Sube un Word o un Excel con marcadores {{campo}} o <<campo>>.' })));
  await cargar();
}

async function vNuevaPlantilla(cont, vivo) {
  const zona = el('div'), estado = { borrador: null };
  UI.add(cont, el('a', { class: 'enlace', href: '#/plantillas', text: '← Plantillas' }), el('h1', { class: 'titulo', text: 'Nueva plantilla' }), zona);
  const ocupar = async (btn, fn) => { btn.disabled = true; const t = btn.textContent; btn.textContent = 'Procesando…'; try { await fn(); } catch (x) { if (x.codigo !== 'SESION') toast(msgError(x), true); } finally { btn.disabled = false; btn.textContent = t; } };

  const paso1 = () => {
    const f = el('input', { type: 'file', id: 'pl_f', accept: '.docx,.xlsx', class: 'ctl' }), err = el('p', { class: 'error', role: 'alert' });
    const b = el('button', { class: 'btn pri', type: 'button' }, 'Subir y analizar');
    b.addEventListener('click', () => ocupar(b, async () => {
      err.textContent = ''; const a = f.files[0];
      if (!a) { err.textContent = 'Elige un archivo .docx o .xlsx.'; return; }
      if (!/\.(docx|xlsx)$/i.test(a.name) || a.size > 6 * 1024 * 1024) { err.textContent = 'Solo se admiten archivos .docx o .xlsx de hasta 6 MB.'; return; }
      const r = await Api.plantillas.analizar(a.name, await leerBase64(a)); if (!vivo()) return;
      estado.borrador = r.borrador_id; estado.nombreSugerido = a.name.replace(/\.(docx|xlsx)$/i, '');
      r.tipo_archivo === 'EXCEL' ? paso2(r) : paso3(r);
    }));
    UI.rep(zona, el('section', { class: 'panel' }, el('h2', { text: '1. Sube tu archivo' }),
      el('p', { class: 'sub', text: 'Word (.docx) o Excel (.xlsx). Escribe en él los campos variables como {{nombre_cliente}} o <<nombre_cliente>> (solo letras, números y guion bajo, sin espacios). Se guarda en tu Google Drive.' }),
      campo('pl_f', 'Archivo', f), err, el('div', { class: 'acciones' }, b)));
  };
  const paso2 = (r) => {
    const sel = el('select', { id: 'pl_h', class: 'ctl' }, r.hojas.map((h) => el('option', { value: h, text: h })));
    const b = el('button', { class: 'btn pri', type: 'button' }, 'Escanear esta hoja');
    b.addEventListener('click', () => ocupar(b, async () => { const x = await Api.plantillas.reanalizar(estado.borrador, sel.value); if (vivo()) paso3(x); }));
    UI.rep(zona, el('section', { class: 'panel' }, el('h2', { text: '2. ¿De qué hoja se extraen los campos?' }),
      el('p', { class: 'sub', text: 'Se leen solo las celdas de esa hoja que contengan {{campo}} o <<campo>>. El documento final es un PDF de esa hoja.' }), campo('pl_h', 'Hoja de Excel', sel), el('div', { class: 'acciones' }, b)));
  };
  const paso3 = (r) => {
    const nombre = el('input', { id: 'pl_n', class: 'ctl', maxlength: '80', value: estado.nombreSugerido || '' }), cat = el('input', { id: 'pl_c', class: 'ctl', maxlength: '40', value: 'General' });
    const desc = el('input', { id: 'pl_d', class: 'ctl', maxlength: '300' }), err = el('p', { class: 'error', role: 'alert' });
    const ed = editorCampos(r.marcadores.map((m) => Object.assign({ nombre_marcador: m.nombre, apariciones: m.apariciones, celdas: m.celdas }, m.sugerido)));
    const b = el('button', { class: 'btn pri', type: 'button' }, 'Guardar plantilla');
    b.addEventListener('click', () => ocupar(b, async () => {
      err.textContent = ''; if (!nombre.value.trim()) { err.textContent = 'Escribe un nombre para la plantilla.'; return; }
      if (!r.marcadores.length) { err.textContent = 'No hay campos que guardar. Revisa tu archivo.'; return; }
      await Api.plantillas.guardar({ borrador_id: estado.borrador, nombre: nombre.value.trim(), categoria: cat.value.trim() || 'General', descripcion: desc.value.trim() || undefined, hoja: r.hoja || undefined, campos: ed.valores() });
      toast('Plantilla guardada.'); location.hash = '#/plantillas';
    }));
    UI.rep(zona, el('section', { class: 'panel' }, el('h2', { text: (r.tipo_archivo === 'EXCEL' ? '3' : '2') + '. Define los campos' }),
      ...(r.avisos || []).map((t) => el('p', { class: 'aviso', role: 'status', text: t })),
      el('div', { class: 'formdin' }, campo('pl_n', 'Nombre de la plantilla', nombre, 'Rotula la tarjeta que abre este formulario y es la base del nombre de los archivos.'), campo('pl_c', 'Categoría', cat), el('div', { class: 'campo ancho' }, el('label', { for: 'pl_d' }, 'Descripción (opcional)'), desc)),
      el('p', { class: 'sub', text: `Se encontraron ${r.marcadores.length} campos. Elige cómo se llenará cada uno.` }), ed.nodo, err, el('div', { class: 'acciones' }, b)));
  };
  paso1();
}

async function vEditarPlantilla(cont, id, vivo) {
  const d = await Api.plantillas.detalle(id); if (!vivo()) return;
  const p = d.plantilla, nombre = el('input', { id: 'pe_n', class: 'ctl', maxlength: '80', value: p.nombre }), cat = el('input', { id: 'pe_c', class: 'ctl', maxlength: '40', value: p.categoria });
  const desc = el('input', { id: 'pe_d', class: 'ctl', maxlength: '300', value: p.descripcion || '' }), err = el('p', { class: 'error', role: 'alert' }), ed = editorCampos(d.campos);
  const b = el('button', { class: 'btn pri', type: 'button' }, 'Guardar cambios');
  b.addEventListener('click', async () => {
    err.textContent = ''; b.disabled = true;
    try { await Api.plantillas.actualizar(p.id, { nombre: nombre.value.trim(), categoria: cat.value.trim() || 'General', descripcion: desc.value.trim(), campos: ed.valores() }); toast('Cambios guardados.'); location.hash = '#/plantillas'; }
    catch (x) { if (x.codigo !== 'SESION') err.textContent = msgError(x); } finally { b.disabled = false; }
  });
  UI.add(cont, el('a', { class: 'enlace', href: '#/plantillas', text: '← Plantillas' }), el('h1', { class: 'titulo', text: 'Editar plantilla' }),
    el('section', { class: 'panel' }, el('div', { class: 'formdin' }, campo('pe_n', 'Nombre', nombre, 'Rotula la tarjeta del formulario. Al cambiarlo se renombra el archivo de la plantilla en Drive.'), campo('pe_c', 'Categoría', cat), el('div', { class: 'campo ancho' }, el('label', { for: 'pe_d' }, 'Descripción'), desc)),
      el('p', { class: 'sub', text: 'Para agregar o quitar campos, sube un archivo nuevo como otra plantilla y archiva esta.' }), ed.nodo, err, el('div', { class: 'acciones' }, b)));
}


V.plantillas = async (cont, vivo, arg) => arg === 'nueva' ? vNuevaPlantilla(cont, vivo) : arg ? vEditarPlantilla(cont, decodeURIComponent(arg), vivo) : vPlantillas(cont, vivo);
})();
