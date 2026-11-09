/* Gestor de apariencia. Cuatro modos (claro · oscuro · transparente · institucional) + acento de la empresa.
   El administrador los define en «Apariencia»; el servidor los entrega en tenant.tema y aquí se aplican.
   El último tema se recuerda en este navegador solo para que la pantalla de ingreso no parpadee. */
(() => {
'use strict';
const MODOS = ['claro', 'oscuro', 'transparente', 'institucional'];
const BARRA = { claro: '#F3F5FA', oscuro: '#0B0D12', transparente: '#0A1030', institucional: '#13235A' };
const K = 'jd_tema';
const leer = () => { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch { return null; } };
const guardar = (t) => { try { localStorage.setItem(K, JSON.stringify(t)); } catch { /* modo privado */ } };

function aplicar(tema, recordar) {
  const t = tema && typeof tema === 'object' ? tema : {};
  const modo = MODOS.includes(t.modo) ? t.modo : 'institucional';
  const raiz = document.documentElement;
  raiz.setAttribute('data-tema', modo);
  if (window.JDITheme) window.JDITheme.aplicar(raiz, t.primario, t.secundario);
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', BARRA[modo]);
  if (recordar !== false) guardar({ modo, primario: t.primario || null, secundario: t.secundario || null });
  return modo;
}
window.Tema = { MODOS, aplicar, recordado: leer, previsualizar: (t) => aplicar(t, false) };
aplicar(leer() || {}, false);   // lo antes posible: evita el parpadeo del tema por defecto
})();
