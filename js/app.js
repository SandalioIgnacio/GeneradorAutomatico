/* JeaDas.Insights v2 · núcleo: ingreso, sesión, navegación por rol, splash y despedida.
   Frontend pasivo: todo dato viene del Apps Script central vía window.Api. Las vistas viven en vistas-*.js. */
(() => {
'use strict';
const { $, S, V, el, toast, modal, campo, msgError, rol, esAdmin, esSuper } = UI;

/* ---------- pantallas ---------- */
function mostrar(id) { for (const e of document.querySelectorAll('[data-escena]')) e.hidden = e.id !== id; $('app').hidden = id !== 'app'; }
function mostrarLogin(msg) {
  S.perfil = null; S.gen++; Tema.aplicar(Tema.recordado() || {}, false); mostrar('pantallaLogin'); $('clave').value = '';
  $('errLogin').textContent = msg || ''; $('usuario').focus({ preventScroll: true });
}
function mostrarCambio() { mostrar('pantallaCambio'); $('nueva').value = ''; $('nueva2').value = ''; $('errCambio').textContent = ''; pintarReglas(); $('nueva').focus({ preventScroll: true }); }

const reglasClave = (a, b) => ({ largo: a.length >= 10, mezcla: /[A-Za-z]/.test(a) && /\d/.test(a), igual: a.length > 0 && a === b });
function pintarReglas() {
  const r = reglasClave($('nueva').value, $('nueva2').value);
  for (const li of $('reglas').children) li.classList.toggle('ok', !!r[li.dataset.r]);
  return r.largo && r.mezcla && r.igual;
}

/* ---------- splash y despedida (identidad de la Suite) ---------- */
function ocultarSplash() { const s = $('splash-screen'); if (s) s.classList.add('oculto'); }
function despedida() {
  return new Promise((fin) => {
    const s = $('splash-screen'); if (!s) return fin();
    $('splash-titulo').textContent = '¡Hasta pronto!'; const m = $('splash-mensaje'); m.textContent = 'Que tengas una hermosa jornada'; m.classList.add('fin');
    const bar = $('splash-progress-bar'); bar.replaceChildren(el('div', { class: 'sp-barra fin' }));
    s.classList.remove('oculto'); s.classList.add('forzar-despedida');
    setTimeout(() => {
      s.classList.remove('forzar-despedida'); s.classList.add('oculto');
      $('splash-titulo').replaceChildren('JeaDas', el('span', { text: '.Insights' })); m.textContent = 'Gestor automático documental'; m.classList.remove('fin');
      fin();
    }, 1900);
  });
}

/* ---------- ingreso ---------- */
async function enviarLogin(e) {
  e.preventDefault(); const err = $('errLogin'); err.textContent = '';
  const usuario = $('usuario').value.trim(), clave = $('clave').value;
  if (!usuario || !clave) { err.textContent = 'Escribe tu usuario y contraseña.'; return; }
  $('btnLogin').disabled = true;
  try {
    const r = await Api.login(usuario, clave); $('clave').value = '';
    if (r.perfil && r.perfil.debe_cambiar_clave) mostrarCambio(); else await entrar();
  } catch (x) { err.textContent = msgError(x); } finally { $('btnLogin').disabled = false; }
}

const passwordInput = document.getElementById('password');
const togglePasswordButton = document.getElementById('togglePassword');
let timeoutId = null; // Guarda el temporizador activo

togglePasswordButton.addEventListener('click', () => {
  // Si ya hay un temporizador corriendo, lo cancelamos para reiniciar el conteo
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  // Alternar el tipo de input
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    togglePasswordButton.textContent = '🙈'; // Cambia el icono a "ocultar"

    // Ocultar automáticamente después de 4 segundos (4000 milisegundos)
    timeoutId = setTimeout(() => {
      passwordInput.type = 'password';
      togglePasswordButton.textContent = '👁️';
    }, 4000);

  } else {
    // Si el usuario hace clic manualmente antes de que termine el tiempo
    passwordInput.type = 'password';
    togglePasswordButton.textContent = '👁️';
  }
});

async function enviarCambio(e) {
  e.preventDefault(); const err = $('errCambio'); err.textContent = '';
  if (!pintarReglas()) { err.textContent = 'La contraseña no cumple los requisitos.'; return; }
  $('btnCambio').disabled = true;
  try { await Api.cambiarClave($('nueva').value); $('nueva').value = $('nueva2').value = ''; toast('Contraseña actualizada.'); await entrar(); }
  catch (x) { err.textContent = msgError(x); } finally { $('btnCambio').disabled = false; }
}
async function salir() {
  const fin = despedida(); await Api.salir(); location.hash = ''; S.perfil = null; S.gen++; await fin; mostrarLogin();
}

/* ---------- menú por rol ---------- */
function secciones() {
  if (esSuper()) return [['panel', 'Panel'], ['empresas', 'Empresas'], ['avisos', 'Avisos'], ['auditoria', 'Auditoría']];
  const pm = (k) => S.plantillas.some((p) => (p.permisos || {})[k]);
  const t = [['inicio', 'Inicio'], ['documentos', 'Documentos'], ['historial', 'Historial']];
  if (pm('registrar') || esAdmin()) t.push(['lotes', 'Lotes']);
  if (pm('reportes') || esAdmin()) t.push(['reportes', 'Reportes']);
  if (esAdmin()) t.push(['plantillas', 'Plantillas'], ['usuarios', 'Usuarios'], ['auditoria', 'Auditoría'], ['apariencia', 'Apariencia'], ['empresa', 'Mi empresa']);
  return t;
}

async function entrar() {
  const d = await Api.iniciar();
  S.perfil = d.perfil; S.tenant = d.tenant || {}; S.susc = d.suscripcion || null; S.plantillas = d.plantillas || [];
  if (S.perfil.debe_cambiar_clave) { mostrarCambio(); return; }
  Tema.aplicar(S.tenant.tema || {});
  const nombre = S.perfil.nombre || S.perfil.usuario || '';
  $('quienNombre').textContent = nombre; $('quienUsuario').textContent = S.perfil.usuario || ''; $('avatar').textContent = (nombre.trim()[0] || '?').toUpperCase();
  $('empNombre').textContent = S.tenant.nombre || 'Plataforma'; $('empRol').textContent = esSuper() ? 'Superadministrador' : esAdmin() ? 'Administrador' : 'Operador';
  const tabs = secciones(); S.tabs = tabs.map(([k]) => k);
  $('tabs').replaceChildren(...tabs.map(([k, t]) => el('a', { href: '#/' + k, text: t })));
  mostrar('app');
  if (!location.hash || !S.tabs.includes(location.hash.split('/')[1])) location.hash = '#/' + S.tabs[0]; else await ruta();
}

/* ---------- router ---------- */
async function ruta() {
  if (!S.perfil || $('app').hidden) return;
  const gen = ++S.gen, vivo = () => gen === S.gen;
  const [, seccion, arg, arg2] = location.hash.split('/');
  if (!S.tabs.includes(seccion) || !V[seccion]) { location.hash = '#/' + S.tabs[0]; return; }
  for (const a of $('tabs').children) a.toggleAttribute('aria-current', a.getAttribute('href') === '#/' + seccion);
  const act = $('tabs').querySelector('[aria-current]'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' });
  const cont = $('vista'); cont.replaceChildren(el('p', { class: 'vacio', text: 'Cargando…' }));
  try {
    const nuevo = el('div'); await V[seccion](nuevo, vivo, arg, arg2);
    if (vivo()) { cont.replaceChildren(nuevo); cont.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  } catch (x) { if (vivo() && x.codigo !== 'SESION') cont.replaceChildren(el('p', { class: 'alerta bad', role: 'alert', text: msgError(x) })); }
}

/* ---------- cambio voluntario de contraseña ---------- */
function modalMiClave() {
  const a = el('input', { id: 'mcA', type: 'password', autocomplete: 'current-password', class: 'ctl' });
  const n1 = el('input', { id: 'mcN', type: 'password', autocomplete: 'new-password', class: 'ctl' });
  const n2 = el('input', { id: 'mcN2', type: 'password', autocomplete: 'new-password', class: 'ctl' }), err = el('p', { class: 'error', role: 'alert' });
  modal({ titulo: 'Cambiar contraseña', cuerpo: [campo('mcA', 'Contraseña actual', a), campo('mcN', 'Contraseña nueva', n1, '10 caracteres o más, con letras y números.'), campo('mcN2', 'Repite la contraseña nueva', n2), err],
    botones: [{ texto: 'Guardar contraseña', onclick: async (d) => {
      err.textContent = ''; const r = reglasClave(n1.value, n2.value);
      if (!a.value) { err.textContent = 'Escribe tu contraseña actual.'; return; }
      if (!(r.largo && r.mezcla && r.igual)) { err.textContent = 'La contraseña nueva no cumple los requisitos o no coincide.'; return; }
      try { await Api.cambiarClave(n1.value, a.value); d.close(); toast('Contraseña actualizada.'); } catch (x) { err.textContent = msgError(x); } } }] });
}


/* ---------- arranque ---------- */
function iniciar() {
  $('anio').textContent = new Date().getFullYear();
  $('formLogin').addEventListener('submit', enviarLogin); $('formCambio').addEventListener('submit', enviarCambio);
  $('nueva').addEventListener('input', pintarReglas); $('nueva2').addEventListener('input', pintarReglas);
  $('btnCambioSalir').addEventListener('click', salir); $('miSalir').addEventListener('click', () => { $('menuCuenta').hidden = true; salir(); }); $('miClave').addEventListener('click', () => { $('menuCuenta').hidden = true; modalMiClave(); });
  $('btnCuenta').addEventListener('click', () => { const h = $('menuCuenta').hidden; $('menuCuenta').hidden = !h; $('btnCuenta').setAttribute('aria-expanded', String(h)); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.cuenta')) { $('menuCuenta').hidden = true; $('btnCuenta').setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('menuCuenta').hidden = true; } });
  addEventListener('hashchange', ruta);
  Api.on('sesion-vencida', () => { if (S.perfil || !$('pantallaCambio').hidden) { location.hash = ''; mostrarLogin('Tu sesión expiró. Vuelve a ingresar.'); } });
  Api.on('cambiar-clave', () => { if (S.perfil) S.perfil.debe_cambiar_clave = true; mostrarCambio(); });
  setTimeout(ocultarSplash, 1600);
  (async () => {
    if (Api.haySesion()) { try { await entrar(); return; } catch (x) { if (x.codigo === 'CAMBIAR_CLAVE') return; } }
    mostrarLogin();
  })();
  if ('serviceWorker' in navigator && location.protocol === 'https:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
iniciar();
})();
