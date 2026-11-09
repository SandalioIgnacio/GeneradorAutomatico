/* JeaDas.Insights v2 · Formulario dinámico a partir de la estructura de `campos_plantilla`.
 *
 * Entrada: la respuesta de la acción `formulario` de GAS: { plantilla, campos[] }.
 * Cada fila de campo (solo se usa lo que existe; todo lo demás se ignora):
 *   nombre_marcador  texto del marcador ({{campo}} / <<campo>> / celda) — se valida con una lista blanca
 *   etiqueta         título visible (si falta, se "humaniza" el marcador)
 *   tipo_dato        TEXTO | FECHA | MONEDA | NUMERO | PARRAFO
 *   formato_fecha    p. ej. dd/mm/aaaa · dd/mmmm/aaaa · d de mmmm de aaaa            (solo FECHA)
 *   formato_numero   p. ej. 0,00 · #.##0,00                                         (solo MONEDA/NUMERO)
 *   moneda_tipo      BOB | USD                                                      (solo MONEDA)
 *   requiere_literal true => el servidor añade "(Tres Mil 25/100 Bolivianos)"        (solo MONEDA)
 *   requerido, orden, ayuda
 * Seguridad: todo se construye con createElement/textContent (nunca innerHTML) y el nombre del marcador debe cumplir
 * RE_MARCADOR; una fila que no lo cumpla se descarta. El servidor vuelve a validar todo: esto es comodidad, no seguridad.
 * Salida de leer(): { marcador: valor } con FECHA en ISO (yyyy-mm-dd) y MONEDA como número; GAS aplica los formatos.
 */
(() => {
'use strict';
const RE_MARCADOR = /^[A-Za-z0-9_ñÑ]{1,80}$/;
const TIPOS = ['TEXTO', 'FECHA', 'MONEDA', 'NUMERO', 'PARRAFO'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

const el = (tag, attrs = {}, ...hijos) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const h of hijos.flat()) if (h != null && h !== false) n.append(h.nodeType ? h : document.createTextNode(String(h)));
  return n;
};
const humanizar = (m) => { const t = String(m).replace(/_/g, ' ').trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
const dos = (n) => String(n).padStart(2, '0');

/* Muestra cómo quedará la fecha en el documento (misma máscara que usa el servidor). */
function fechaConMascara(iso, mascara) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return '';
  const y = +m[1], mo = +m[2], d = +m[3]; const f = new Date(Date.UTC(y, mo - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== mo - 1 || f.getUTCDate() !== d) return '';
  const mask = String(mascara || 'dd/mm/aaaa');
  return mask.replace(/(?<![A-Za-zÁÉÍÓÚáéíóúÑñ])(dddd|dd|d|mmmm|mmm|mm|aaaa|aa)(?![A-Za-zÁÉÍÓÚáéíóúÑñ])/g, (t) => ({
    dddd: DIAS[f.getUTCDay()], dd: dos(d), d: String(d), mmmm: MESES[mo - 1], mmm: MESES[mo - 1].slice(0, 3),
    mm: dos(mo), aaaa: String(y), aa: String(y).slice(-2) })[t]);
}

/* Monto en letras (misma lógica que el servidor, solo para la vista en vivo; el documento final lo escribe GAS). */
const U = ['', 'Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince', 'Dieciséis', 'Diecisiete', 'Dieciocho', 'Diecinueve', 'Veinte', 'Veintiuno', 'Veintidós', 'Veintitrés', 'Veinticuatro', 'Veinticinco', 'Veintiséis', 'Veintisiete', 'Veintiocho', 'Veintinueve'];
const D = ['', '', '', 'Treinta', 'Cuarenta', 'Cincuenta', 'Sesenta', 'Setenta', 'Ochenta', 'Noventa'];
const C = ['', 'Ciento', 'Doscientos', 'Trescientos', 'Cuatrocientos', 'Quinientos', 'Seiscientos', 'Setecientos', 'Ochocientos', 'Novecientos'];
function apocope(t) { return t.replace(/Veintiuno$/, 'Veintiún').replace(/Uno$/, 'Un'); }
function centenas(n) {
  if (n === 100) return 'Cien';
  var r = n % 100, t = C[Math.floor(n / 100)];
  if (r) t += (t ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : ''));
  return t;
}
function enteroALetras(n) {
  if (n === 0) return 'Cero';
  var t = [], mill = Math.floor(n / 1e6); n %= 1e6;
  if (mill) t.push(mill === 1 ? 'Un Millón' : apocope(enteroALetras(mill)) + ' Millones');
  var mil = Math.floor(n / 1e3); n %= 1e3;
  if (mil) t.push(mil === 1 ? 'Mil' : apocope(centenas(mil)) + ' Mil');
  if (n) t.push(centenas(n));
  return t.join(' ');
}
/** 3500.25 -> "Tres Mil Quinientos 25/100 Bolivianos"; 21 -> "Veintiún 00/100 Bolivianos" */
function montoEnLetras(monto, moneda) {
  var s = Math.abs(Number(monto)).toFixed(2).split('.'), entero = parseInt(s[0], 10);
  if (!isFinite(entero) || entero >= 1e12) return '';
  return apocope(enteroALetras(entero)) + ' ' + s[1] + '/100 ' + (moneda === 'USD' ? 'Dólares Americanos' : 'Bolivianos');
}
const simbolo = (c) => (c.moneda_tipo === 'USD' ? 'USD' : 'Bs');

/* Normaliza y filtra las filas de campos_plantilla. */
function normalizar(campos) {
  const vistos = new Set();
  return (Array.isArray(campos) ? campos : [])
    .filter((c) => c && typeof c.nombre_marcador === 'string' && RE_MARCADOR.test(c.nombre_marcador) && !vistos.has(c.nombre_marcador) && vistos.add(c.nombre_marcador))
    .map((c) => ({ ...c, tipo_dato: TIPOS.includes(String(c.tipo_dato).toUpperCase()) ? String(c.tipo_dato).toUpperCase() : 'TEXTO',
      etiqueta: (typeof c.etiqueta === 'string' && c.etiqueta.trim()) || humanizar(c.nombre_marcador), requerido: c.requerido !== false }))
    .sort((a, b) => (a.orden ?? 1e9) - (b.orden ?? 1e9));
}

function crear(respuesta, opciones = {}) {
  const campos = normalizar(respuesta && respuesta.campos);
  const plantilla = (respuesta && respuesta.plantilla) || {};
  const esExcel = String(plantilla.tipo_archivo || '').toUpperCase() === 'EXCEL';
  const entradas = new Map();            // marcador -> { campo, input, error }
  const raiz = el('form', { class: 'formdin', novalidate: true, autocomplete: 'off' });
  raiz.addEventListener('submit', (e) => e.preventDefault());

  if (!campos.length) raiz.append(el('p', { class: 'muted', text: 'Esta plantilla aún no tiene campos configurados. Avisa a tu administrador.' }));

  for (const c of campos) {
    const id = 'fd_' + c.nombre_marcador;
    let input, extra = null;
    switch (c.tipo_dato) {
      case 'FECHA': {
        input = el('input', { type: 'date', id });
        const vista = el('small', { class: 'hint', 'aria-live': 'polite' });
        input.addEventListener('input', () => { const t = fechaConMascara(input.value, c.formato_fecha); vista.textContent = t ? `En el documento: ${t}` : ''; });
        extra = vista; break;
      }
      case 'MONEDA': {
        input = el('input', { type: 'number', id, step: '0.01', min: '0', inputmode: 'decimal', placeholder: '0,00' });
        if (c.requiere_literal) {
          extra = el('small', { class: 'hint', 'aria-live': 'polite' });
          const inp = input; inp.addEventListener('input', () => { const t = inp.value === '' ? '' : montoEnLetras(inp.value, c.moneda_tipo); extra.textContent = t ? `En letras: (${t})` : ''; });
        }
        input = el('div', { class: 'moneda' }, el('span', { class: 'pref', text: simbolo(c) }), input);
        break;
      }
      case 'NUMERO': input = el('input', { type: 'number', id, step: 'any', inputmode: 'decimal' }); break;
      case 'PARRAFO': input = el('textarea', { id, rows: '4', maxlength: '4000' }); break;
      default: input = el('input', { type: 'text', id, maxlength: '500' });
    }
    const control = input.matches && input.matches('input,textarea') ? input : input.querySelector('input');
    if (c.requerido) control.setAttribute('aria-required', 'true');
    const error = el('small', { class: 'err', role: 'alert' });
    control.setAttribute('aria-describedby', id + '_e');
    error.id = id + '_e';
    raiz.append(el('div', { class: 'campo' + (c.tipo_dato === 'PARRAFO' ? ' ancho' : '') },
      el('label', { for: id }, c.etiqueta, c.requerido ? el('span', { class: 'req', 'aria-hidden': 'true', text: ' *' }) : el('span', { class: 'opc', text: ' (opcional)' })),
      input, c.ayuda ? el('small', { class: 'hint', text: String(c.ayuda) }) : null, extra, error));
    entradas.set(c.nombre_marcador, { campo: c, control, error });
  }

  /* Nombre opcional del archivo: el sistema antepone un número único (id_nombre). */
  const inNombre = el('input', { type: 'text', id: 'fd_nombre_archivo', maxlength: '60', placeholder: opciones.sugerencia || 'Ej.: Contrato Juan Pérez', autocomplete: 'off' });
  if (opciones.nombreArchivo !== false) raiz.append(el('div', { class: 'campo ancho' }, el('label', { for: 'fd_nombre_archivo' }, 'Nombre del archivo ', el('span', { class: 'opc', text: '(opcional)' })),
    inNombre, el('small', { class: 'hint', text: 'El archivo se guardará como «número_nombre». Si lo dejas vacío, se usa el nombre del documento.' })));

  /* Formatos de salida. Excel solo genera PDF (y se descarga el libro desde el servidor si el admin lo permite). */
  const chkWord = el('input', { type: 'checkbox', id: 'fd_f_docx', checked: !esExcel, disabled: esExcel });
  const chkPdf = el('input', { type: 'checkbox', id: 'fd_f_pdf', checked: true });
  const formatos = el('fieldset', { class: 'formatos' }, el('legend', { text: 'Archivos a generar' }),
    el('label', { class: 'chk' }, chkWord, esExcel ? ' Word (no disponible para Excel)' : ' Word (editable)'),
    el('label', { class: 'chk' }, chkPdf, ' PDF'));
  if (opciones.formatos !== false) raiz.append(formatos);

  const api = {
    el: raiz, campos,
    nombre: () => inNombre.value.trim(), ponerNombre(v) { inNombre.value = v || ''; },
    formatos: () => [chkWord.checked && !esExcel ? 'docx' : null, chkPdf.checked ? 'pdf' : null].filter(Boolean),
    leer() {
      const datos = {};
      for (const [m, { campo, control }] of entradas) {
        const v = control.value;
        if (v === '' || v == null) { datos[m] = ''; continue; }
        datos[m] = (campo.tipo_dato === 'MONEDA' || campo.tipo_dato === 'NUMERO') ? Number(v) : (campo.tipo_dato === 'TEXTO' || campo.tipo_dato === 'PARRAFO' ? v.trim() : v);
      }
      return datos;
    },
    poner(datos) { for (const [m, v] of Object.entries(datos || {})) { const e = entradas.get(m); if (e) { e.control.value = v ?? ''; e.control.dispatchEvent(new Event('input')); } } },
    /* Devuelve true si todo es válido; si no, marca los errores y enfoca el primero. */
    validar() {
      let primero = null;
      for (const [, { campo, control, error }] of entradas) {
        let msg = ''; const v = control.value.trim();
        if (!v) { if (campo.requerido) msg = 'Este campo es obligatorio.'; }
        else if (campo.tipo_dato === 'FECHA' && !fechaConMascara(v, 'dd/mm/aaaa')) msg = 'Escribe una fecha válida.';
        else if ((campo.tipo_dato === 'MONEDA' || campo.tipo_dato === 'NUMERO') && !Number.isFinite(Number(v))) msg = 'Escribe un número válido.';
        else if (campo.tipo_dato === 'MONEDA' && Number(v) < 0) msg = 'El monto no puede ser negativo.';
        else if (campo.tipo_dato === 'MONEDA' && Math.round(Number(v) * 100) / 100 !== Number(v)) msg = 'Usa como máximo 2 decimales.';
        else if (campo.tipo_dato === 'MONEDA' && Number(v) >= 1e12) msg = 'El monto es demasiado grande.';
        error.textContent = msg; control.toggleAttribute('aria-invalid', !!msg);
        if (msg && !primero) primero = control;
      }
      if (opciones.formatos !== false && !api.formatos().length) { primero = primero || chkPdf; }
      if (primero) primero.focus();
      return !primero;
    },
  };
  return api;
}
window.FormularioDinamico = { crear, montoEnLetras, normalizar, fechaConMascara, RE_MARCADOR };
})();
