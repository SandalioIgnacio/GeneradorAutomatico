/* Vistas del administrador de la empresa: Usuarios, Auditoría, Apariencia y Mi empresa. */
(() => {
'use strict';
const { S, V, el, toast, modal, campo, fechaCorta, fechaHora, msgError, ocupado } = UI;

/* ---------- Usuarios (admin_cliente): crear llenadores y asignar permisos por plantilla ---------- */
function modalClave(usuario, clave, extra) {
  const inp = el('input', { class: 'ctl', readonly: true, value: clave, 'aria-label': 'Contraseña temporal' });
  const copiar = el('button', { class: 'btn xs', type: 'button', text: 'Copiar' });
  copiar.addEventListener('click', async () => { try { await navigator.clipboard.writeText(clave); toast('Contraseña copiada.'); } catch { inp.select(); toast('Selecciona y copia la contraseña.'); } });
  modal({ titulo: `Acceso de ${usuario}`, cerrarTexto: 'Listo', botones: [], cuerpo: [extra ? el('p', { text: extra }) : null,
    el('p', {}, 'Usuario: ', el('strong', { text: usuario })), el('div', { class: 'clave-caja' }, inp, copiar),
    el('p', { class: 'sub', text: 'Esta contraseña se muestra una sola vez. Compártela por un canal seguro: deberá cambiarla en su primer ingreso.' })] });
}
const PERMISOS = [['registrar', 'Registrar'], ['generar', 'Generar'], ['reportes', 'Reportes']];
function selectorPlantillas(plantillas, actuales) {
  const caja = el('div', { class: 'matriz', role: 'group', 'aria-label': 'Permisos por documento' }), filas = [];
  const por = new Map((actuales || []).map((p) => [String(p.plantilla_id), p]));
  for (const p of plantillas) {
    const previo = por.get(String(p.id)) || {}, cbs = {};
    const fila = el('div', { class: 'fila-perm' }, el('strong', { text: p.nombre }), ...PERMISOS.map(([k, t]) => {
      cbs[k] = el('input', { type: 'checkbox', checked: !!previo[k], 'aria-label': `${t}: ${p.nombre}` }); return el('label', { class: 'chk' }, cbs[k], ' ' + t); }));
    filas.push([p.id, cbs]); caja.append(fila);
  }
  if (!plantillas.length) caja.append(el('p', { class: 'vacio', text: 'La empresa aún no tiene plantillas.' }));
  return { nodo: caja, valores: () => filas.map(([id, c]) => ({ plantilla_id: id, registrar: c.registrar.checked, generar: c.generar.checked, reportes: c.reportes.checked }))
    .filter((p) => p.registrar || p.generar || p.reportes) };
}
V.usuarios = async (cont, vivo) => {
  const zona = el('div'); UI.add(cont, el('div', { class: 'filtros' }, el('h1', { class: 'titulo', text: 'Usuarios' }),
    el('button', { class: 'btn pri', type: 'button', onclick: () => modalUsuario(null) }, 'Nuevo usuario')), zona);
  let datos;
  const cargar = async () => { datos = await Api.usuarios.listar(); if (vivo()) pintar(); };
  const pintar = () => {
    const us = datos.usuarios || [];
    UI.rep(zona, el('section', { class: 'panel' }, us.length ? el('div', { class: 'tabla-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Usuario', 'Nombre', 'Documentos', 'Estado', ''].map((c) => el('th', { text: c })))),
      el('tbody', {}, us.map((u) => el('tr', {},
        el('td', { 'data-label': 'Usuario', text: u.usuario }), el('td', { 'data-label': 'Nombre', text: u.nombre || '—' }),
        el('td', { 'data-label': 'Documentos', text: String((u.permisos || []).length) }),
        el('td', { 'data-label': 'Estado' }, el('span', { class: 'badge ' + (u.activo ? 'ok' : 'bad'), text: u.activo ? 'Activo' : 'Desactivado' }), u.debe_cambiar_clave ? el('small', { text: ' · clave temporal' }) : null),
        el('td', { class: 'acc' }, el('button', { class: 'btn xs', type: 'button', onclick: () => modalUsuario(u) }, 'Permisos'),
          el('button', { class: 'btn xs', type: 'button', onclick: () => alternar(u) }, u.activo ? 'Desactivar' : 'Activar'),
          el('button', { class: 'btn xs', type: 'button', onclick: () => reiniciar(u) }, 'Reiniciar clave')))))))
      : el('p', { class: 'vacio', text: 'Todavía no creaste usuarios.' })));
  };
  const alternar = async (u) => { try { await Api.usuarios.actualizar(u.id, { activo: !u.activo }); await cargar(); } catch (x) { toast(msgError(x), true); } };
  const reiniciar = (u) => modal({ titulo: 'Reiniciar contraseña', cuerpo: el('p', { text: `Se generará una contraseña temporal nueva para ${u.usuario}. La actual dejará de funcionar.` }),
    botones: [{ texto: 'Reiniciar', onclick: async (d) => { try { const r = await Api.usuarios.reiniciarClave(u.id); d.close(); modalClave(r.usuario, r.clave_temporal); await cargar(); } catch (x) { toast(msgError(x), true); } } }] });
  const modalUsuario = (u) => {
    const nombre = el('input', { id: 'u_n', class: 'ctl', maxlength: '80', value: u ? (u.nombre || '') : '' });
    const sel = selectorPlantillas(datos.plantillas || [], u ? u.permisos : []);
    const err = el('p', { class: 'error', role: 'alert' });
    modal({ titulo: u ? `Permisos de ${u.usuario}` : 'Nuevo usuario', cuerpo: [campo('u_n', 'Nombre de la persona', nombre, u ? null : 'El sistema asigna el usuario y una contraseña temporal. No necesita correo.'), el('p', { class: 'etq', text: 'Permisos por documento' }), sel.nodo, err],
      botones: [{ texto: u ? 'Guardar' : 'Crear usuario', onclick: async (d) => {
        err.textContent = ''; if (!nombre.value.trim()) { err.textContent = 'Escribe el nombre.'; return; }
        try {
          if (u) { await Api.usuarios.actualizar(u.id, { nombre: nombre.value.trim(), permisos: sel.valores() }); d.close(); toast('Permisos guardados.'); }
          else { const r = await Api.usuarios.crear(nombre.value.trim(), sel.valores()); d.close(); modalClave(r.usuario, r.clave_temporal); }
          await cargar();
        } catch (x) { err.textContent = msgError(x); } } }] });
  };
  await cargar();
};
/* ---------- Auditoría: quién hizo qué (solo lectura) ---------- */
const ETQ = { registro_creado: 'Registro creado', documento_generado: 'Documento generado', registro_modificado: 'Registro modificado', registro_archivado: 'Registro archivado', registro_recuperado: 'Registro recuperado',
  usuario_creado: 'Usuario creado', usuario_actualizado: 'Usuario actualizado', usuario_clave_reiniciada: 'Clave reiniciada', plantilla_creada: 'Plantilla creada', plantilla_actualizada: 'Plantilla actualizada', plantilla_archivada: 'Plantilla archivada',
  plantilla_reactivada: 'Plantilla reactivada', campos_editados: 'Campos editados', drive_vinculado: 'Drive vinculado', tema_cambiado: 'Apariencia cambiada', empresa_creada: 'Empresa creada', empresa_actualizada: 'Empresa actualizada',
  avisos_configurados: 'Avisos configurados', avisos_ejecutados: 'Avisos ejecutados', aviso_vencimiento: 'Aviso de vencimiento', contacto_actualizado: 'Contacto actualizado', empresa_admin_reiniciado: 'Admin reiniciado' };
const TIPOS = [['', 'Todo'], ['registro_', 'Registros'], ['documento_', 'Documentos generados'], ['usuario_', 'Usuarios'], ['plantilla_', 'Plantillas'], ['empresa_', 'Empresas'], ['tema_', 'Apariencia']];
function resumen(a) {
  const d = a.detalle || {}, p = [];
  if (d.registro != null) p.push('registro n.º ' + d.registro); if (d.plantilla) p.push(String(d.plantilla)); if (d.nombre) p.push(String(d.nombre)); if (d.usuario) p.push(String(d.usuario)); if (d.motivo) p.push('motivo: ' + d.motivo);
  if (d.revision) p.push('revisión ' + d.revision);
  if (d.cambios && typeof d.cambios === 'object') p.push(Object.entries(d.cambios).map(([k, v]) => v && 'antes' in v ? `${k}: «${v.antes}» → «${v.despues}»` : k).join(' · '));
  return p.join(' · ');
}
UI.tablaAuditoria = function tablaAuditoria(vivo, { global } = {}) {
  const lista = el('div'), mas = el('div', { class: 'paginar' }), est = { pagina: 0 };
  const tipo = el('select', { id: 'au_t', class: 'ctl' }, TIPOS.map(([v, t]) => el('option', { value: v, text: t })));
  const d = el('input', { id: 'au_d', type: 'date', class: 'ctl' }), h = el('input', { id: 'au_h', type: 'date', class: 'ctl' });
  const cargar = async (acum) => {
    if (!acum) { est.pagina = 0; UI.rep(lista, ); }
    const r = await Api.auditoria({ pagina: est.pagina, ...(tipo.value ? { tipo: tipo.value } : {}), ...(d.value ? { desde: d.value } : {}), ...(h.value ? { hasta: h.value } : {}) }); if (!vivo()) return;
    if (!acum && !r.entradas.length) UI.rep(lista, el('p', { class: 'vacio', text: 'No hay movimientos con esos filtros.' }));
    else if (r.entradas.length) { const cols = ['Fecha', 'Quién', global ? 'Empresa' : null, 'Acción', 'Detalle'].filter(Boolean);
      const t = el('table', {}, el('thead', {}, el('tr', {}, cols.map((c) => el('th', { text: c })))), el('tbody', {}, r.entradas.map((a) => el('tr', {},
        el('td', { 'data-label': 'Fecha', text: fechaHora(a.creado_el) }), el('td', { 'data-label': 'Quién', text: a.usuario }), global ? el('td', { 'data-label': 'Empresa', text: a.empresa || '—' }) : null,
        el('td', { 'data-label': 'Acción' }, el('span', { class: 'badge', text: ETQ[a.accion] || a.accion })), el('td', { 'data-label': 'Detalle', text: resumen(a) || '—' })))));
      if (acum && lista.querySelector('tbody')) lista.querySelector('tbody').append(...t.querySelectorAll('tbody tr')); else lista.append(el('div', { class: 'tabla-wrap' }, t)); }
    mas.replaceChildren(r.hay_mas ? el('button', { class: 'btn', type: 'button', onclick: (e) => ocupado(e.currentTarget, async () => { est.pagina++; await cargar(true); }) }, 'Cargar más') : '');
  };
  const b = el('button', { class: 'btn pri', type: 'button' }, 'Filtrar'); b.addEventListener('click', () => ocupado(b, () => cargar(false)));
  return { nodo: el('div', {}, el('div', { class: 'filtros' }, campo('au_t', 'Tipo', tipo), campo('au_d', 'Desde', d, null, 'chico'), campo('au_h', 'Hasta', h, null, 'chico'), b), el('section', { class: 'panel' }, lista, mas)), cargar: () => cargar(false) };
};
V.auditoria = async (cont, vivo) => {
  UI.add(cont, el('h1', { class: 'titulo', text: 'Auditoría' }), el('p', { class: 'sub', text: 'Registro permanente de quién registró, modificó o archivó qué. Solo se puede consultar; nadie puede borrarlo.' }));
  const t = UI.tablaAuditoria(vivo, { global: UI.esSuper() }); UI.add(cont, t.nodo); await t.cargar();
};

/* ---------- Apariencia: 4 modos + colores de la empresa ---------- */
const MODOS = [['claro', 'Claro', 'Fondo luminoso, ideal para oficina'], ['oscuro', 'Oscuro', 'Reduce el brillo, cómodo de noche'], ['transparente', 'Transparente', 'Cristal translúcido (glassmorphism)'], ['institucional', 'Institucional', 'Azul marino de la identidad JeaDas']];
V.apariencia = async (cont) => {
  const t0 = S.tenant.tema || {}, est = { modo: t0.modo || 'institucional', primario: t0.primario || JDITheme.DEFECTO.primario, secundario: t0.secundario || JDITheme.DEFECTO.secundario };
  const botones = [], pr = el('input', { id: 'ap_p', type: 'color', value: est.primario }), se = el('input', { id: 'ap_s', type: 'color', value: est.secundario }), info = el('p', { class: 'hint' });
  const aplicar = () => { Tema.previsualizar(est); botones.forEach(([m, b]) => b.setAttribute('aria-pressed', String(m === est.modo)));
    const c = JDITheme.contraste(JDITheme.colorSobre(est.primario), est.primario); info.textContent = `El texto sobre el color principal se elige solo (${JDITheme.colorSobre(est.primario) === '#FFFFFF' ? 'blanco' : 'negro'}, contraste ${c.toFixed(1)}:1).`; };
  const grid = el('div', { class: 'modos', role: 'group', 'aria-label': 'Modo de apariencia' }, MODOS.map(([m, n, desc]) => {
    const b = el('button', { class: 'modo m-' + m, type: 'button', 'aria-pressed': 'false', onclick: () => { est.modo = m; aplicar(); } },
      el('div', { class: 'vista' }, el('i', { class: 'cabm' }), el('div', { class: 'cuerpom' }, el('b'), el('b'), el('b'))), el('div', { class: 'nom' }, n, el('small', { text: desc }))); botones.push([m, b]); return b; }));
  pr.addEventListener('input', () => { est.primario = pr.value.toUpperCase(); aplicar(); }); se.addEventListener('input', () => { est.secundario = se.value.toUpperCase(); aplicar(); });
  const guardar = el('button', { class: 'btn pri', type: 'button' }, 'Guardar para toda la empresa');
  guardar.addEventListener('click', () => ocupado(guardar, async () => { await Api.guardarTema({ modo: est.modo, primario: est.primario, secundario: est.secundario }); S.tenant.tema = { ...est }; Tema.aplicar(est); toast('Apariencia guardada. Todos los usuarios la verán.'); }));
  const restablecer = el('button', { class: 'btn ghost', type: 'button' }, 'Colores de JeaDas'); restablecer.addEventListener('click', () => { est.primario = JDITheme.DEFECTO.primario; est.secundario = JDITheme.DEFECTO.secundario; pr.value = est.primario; se.value = est.secundario; aplicar(); });
  UI.add(cont, el('h1', { class: 'titulo', text: 'Apariencia' }), el('p', { class: 'sub', text: 'Elige cómo se ve el sistema para todos los usuarios de tu empresa. La vista previa es inmediata; no se aplica a los demás hasta que guardes.' }), grid,
    el('section', { class: 'panel' }, el('h2', { text: 'Colores de tu empresa' }), el('div', { class: 'acentos' }, campo('ap_p', 'Color principal (botones, acentos)', pr), campo('ap_s', 'Color secundario', se)), info,
      el('div', { class: 'muestra' }, el('button', { class: 'btn pri', type: 'button' }, 'Botón principal'), el('button', { class: 'btn', type: 'button' }, 'Botón normal'), el('span', { class: 'badge ok', text: 'Activo' }), el('span', { class: 'badge warn', text: 'Atención' }), el('span', { class: 'badge bad', text: 'Error' })),
      el('div', { class: 'acciones' }, guardar, restablecer)));
  aplicar();
};

/* ---------- Mi empresa: carpeta de Drive y correo de contacto ---------- */
V.empresa = async (cont) => {
  const t = S.tenant, enlace = el('input', { id: 'dr', class: 'ctl', type: 'url', placeholder: 'https://drive.google.com/drive/folders/…', autocomplete: 'off', spellcheck: 'false' });
  const err = el('p', { class: 'error', role: 'alert' }), estado = el('span', { class: 'badge ' + (t.drive_vinculado ? 'ok' : 'warn'), text: t.drive_vinculado ? 'Carpeta de Drive vinculada' : 'Aún no vinculaste tu carpeta de Drive' });
  const btn = el('button', { class: 'btn pri', type: 'button' }, t.drive_vinculado ? 'Cambiar carpeta' : 'Vincular carpeta');
  btn.addEventListener('click', () => {
    err.textContent = '';
    if (!/^https:\/\/drive\.google\.com\/(drive\/(u\/\d+\/)?folders\/|folderview\?id=|open\?id=)[A-Za-z0-9_-]{10,}/.test(enlace.value.trim())) { err.textContent = 'Pega el enlace de una carpeta de Google Drive.'; return; }
    ocupado(btn, async () => { await Api.guardarDrive(enlace.value); t.drive_vinculado = true; enlace.value = ''; estado.className = 'badge ok'; estado.textContent = 'Carpeta de Drive vinculada'; toast('Carpeta vinculada.'); });
  });
  const correo = el('input', { id: 'mc_c', class: 'ctl', type: 'email', value: t.correo_contacto || '', placeholder: 'correo@ejemplo.com', autocomplete: 'off', inputmode: 'email' });
  const bc = el('button', { class: 'btn pri', type: 'button' }, 'Guardar correo');
  bc.addEventListener('click', () => ocupado(bc, async () => { await Api.guardarMiEmpresa(correo.value.trim()); t.correo_contacto = correo.value.trim(); toast('Correo de contacto guardado.'); }));
  UI.add(cont, el('h1', { class: 'titulo', text: 'Mi empresa' }),
    el('section', { class: 'panel' }, el('h2', { text: 'Carpeta de Google Drive' }), estado,
      el('ol', {}, el('li', { text: 'Crea una carpeta en tu Google Drive para los documentos de tu empresa.' }),
        el('li', {}, 'Compártela como ', el('strong', { text: 'Editor' }), ' con la cuenta: ', el('strong', { text: t.cuenta_gas || '(la indica tu proveedor)' }), '.'),
        el('li', { text: 'Pega aquí el enlace de esa carpeta. El sistema crea dentro las subcarpetas de plantillas y de documentos generados.' })),
      campo('dr', 'Enlace de la carpeta raíz', enlace), err, el('div', { class: 'acciones' }, btn)),
    el('section', { class: 'panel' }, el('h2', { text: 'Avisos de vencimiento' }), el('p', { class: 'sub', text: 'Te avisamos por correo antes de que venza la suscripción. Además se envían al Gmail de tu cuenta; aquí puedes agregar un correo extra (por ejemplo, de contabilidad).' }),
      campo('mc_c', 'Correo de contacto adicional', correo), el('div', { class: 'acciones' }, bc)));
};

UI.modalClave = modalClave;
})();
