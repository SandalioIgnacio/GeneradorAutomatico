/* Utilidades compartidas de la interfaz. Todo texto externo se inserta con textContent (nunca innerHTML). */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const S = { perfil: null, tenant: null, susc: null, plantillas: [], gen: 0 };
const V = {};   // registro de vistas: cada módulo agrega las suyas

function el(tag, attrs, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'value') n.value = v;
    else if (k === 'style') n.style.cssText = String(v);   // vía CSSOM: la CSP no admite atributos style en línea
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const h of hijos.flat()) if (h != null && h !== false) n.append(h.nodeType ? h : document.createTextNode(String(h)));
  return n;
}
const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, ...hijos) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') n.textContent = v; else n.setAttribute(k, String(v)); }
  for (const h of hijos.flat()) if (h) n.append(h);
  return n;
}
const add = (nodo, ...hijos) => nodo.append(...hijos.flat().filter((x) => x != null && x !== false));
const rep = (nodo, ...hijos) => nodo.replaceChildren(...hijos.flat().filter((x) => x != null && x !== false));
const toast = (msg, mal) => { const t = el('div', { class: 'toast' + (mal ? ' mal' : ''), text: msg }); $('toasts').append(t); setTimeout(() => t.remove(), 6500); };
function modal({ titulo, cuerpo, botones, cerrarTexto = 'Cancelar', ancho }) {
  const d = el('dialog', { class: 'modal' + (ancho ? ' ancho' : '') }), pie = el('div', { class: 'pie-m' });
  if (cerrarTexto) pie.append(el('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, cerrarTexto));
  for (const b of botones || []) {
    const btn = el('button', { class: 'btn ' + (b.clase || 'pri'), type: 'button' }, b.texto);
    btn.addEventListener('click', async () => { btn.disabled = true; try { await b.onclick(d, btn); } finally { btn.disabled = false; } });
    pie.append(btn);
  }
  d.append(el('div', { class: 'cab-m' }, el('h2', { text: titulo })), el('div', { class: 'cuerpo' }, cuerpo), pie);
  d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal(); return d;
}
const campo = (id, etq, ctl, ayuda, clase) => el('div', { class: 'campo' + (clase ? ' ' + clase : '') }, el('label', { for: id }, etq), ctl, ayuda ? el('small', { class: 'hint', text: ayuda }) : null);
const fechaCorta = (iso) => { const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso); return isNaN(d) ? '—' : d.toLocaleDateString('es-BO'); };
const fechaHora = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' }); };
const msgError = (e) => (e && e.message) || 'Ocurrió un error.';
const rol = () => S.perfil && S.perfil.rol;
const esAdmin = () => rol() === 'admin_cliente';
const esSuper = () => rol() === 'superadmin';
const bs = (n) => Number(n || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function descargarBase64(b64, mime, nombre) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  descargarBlob(new Blob([bytes], { type: mime }), nombre);
}
function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob), a = el('a', { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf' };

/* Ejecuta una acción deshabilitando botones y mostrando errores como aviso. */
async function ocupado(botones, fn) {
  const bs_ = [].concat(botones); bs_.forEach((b) => { b.disabled = true; });
  try { return await fn(); } catch (x) { if (x.codigo !== 'SESION') toast(msgError(x), true); } finally { bs_.forEach((b) => { b.disabled = false; }); }
}

/* CSV seguro: comillas dobles escapadas y neutralización de fórmulas (=, +, -, @, tab, retorno) para que Excel no las ejecute. */
function celdaCsv(v) {
  let t = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}
const csv = (filas) => '﻿' + filas.map((f) => f.map(celdaCsv).join(';')).join('\r\n');

/* Gráficos SVG sin librerías */
function barrasH(items, max) {
  const m = max || Math.max(1, ...items.map((i) => i.total));
  if (!items.length) return el('p', { class: 'vacio', text: 'Sin datos en el período.' });
  return el('div', {}, items.slice(0, 8).map((i) => el('div', { class: 'hbar' }, el('span', { text: i.nombre, title: i.nombre }),
    el('div', { class: 'pista' }, el('i', { style: `width:${Math.max(3, Math.round(i.total / m * 100))}%` })), el('b', { text: String(i.total) }))));
}
function lineas(serie) {
  const W = 480, H = 220, pl = 34, pb = 22, pt = 10, pr = 10, n = serie.length, max = Math.max(1, ...serie.map((p) => p.total));
  const x = (i) => pl + (n === 1 ? 0 : i * (W - pl - pr) / (n - 1)), y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const g = svg('svg', { class: 'lineas', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Registros por día' });
  for (let k = 0; k <= 4; k++) { const v = Math.round(max * k / 4), yy = y(v); g.append(svg('line', { class: k ? 'rej' : 'eje', x1: pl, x2: W - pr, y1: yy, y2: yy }), svg('text', { x: pl - 5, y: yy + 5, 'text-anchor': 'end', text: String(v) })); }
  const pts = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ');
  g.append(svg('polygon', { class: 'area', points: `${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}` }), svg('polyline', { class: 'linea', points: pts }));
  const paso = Math.max(1, Math.ceil(n / 7));
  serie.forEach((p, i) => { if (i % paso === 0 || i === n - 1) g.append(svg('text', { x: x(i), y: H - 5, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', text: p.dia.slice(n > 12 && p.dia.length > 7 ? 5 : p.dia.length > 7 ? 5 : 2) })); if (n <= 40) g.append(svg('circle', { class: 'pt', cx: x(i), cy: y(p.total), r: 2.5 })); });
  return g;
}
function dona(partes) {   // partes: [{clase, valor}]
  const tot = partes.reduce((a, p) => a + p.valor, 0), R = 42, C = 2 * Math.PI * R;
  const g = svg('svg', { viewBox: '0 0 120 120', width: 130, height: 130, role: 'img', 'aria-label': 'Reparto por tipo de archivo' });
  g.append(svg('circle', { cx: 60, cy: 60, r: R, fill: 'none', stroke: 'var(--s3)', 'stroke-width': 16 }));
  let acum = 0;
  if (tot) for (const p of partes) { if (!p.valor) continue; const l = p.valor / tot * C; g.append(svg('circle', { class: p.clase, cx: 60, cy: 60, r: R, fill: 'none', 'stroke-width': 16, 'stroke-dasharray': `${l} ${C - l}`, 'stroke-dashoffset': -acum, transform: 'rotate(-90 60 60)' })); acum += l; }
  g.append(svg('text', { x: 60, y: 66, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: 'currentColor', text: String(tot) }));
  return g;
}

window.UI = { $, S, V, add, rep, el, svg, toast, modal, campo, fechaCorta, fechaHora, msgError, rol, esAdmin, esSuper, bs, descargarBase64, descargarBlob, MIME, ocupado, csv, barrasH, lineas, dona };
})();
