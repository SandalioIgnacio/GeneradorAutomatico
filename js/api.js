/* JeaDas.Insights v2 · cliente del Apps Script (GAS).
 *
 * El frontend es PASIVO y no tiene secretos: su único contacto es la URL /exec de GAS (URL en tenants.json).
 * GAS autentica (hash de contraseñas), valida permisos y sesión, procesa Drive/Docs y lee/escribe en Supabase por REST.
 * Aquí no hay claves de base de datos ni se llama a Supabase.
 *
 * CONTRATO (POST text/plain con JSON; respuesta { ok:true, ... } o { ok:false, codigo, error, detalles? }):
 *   login            { usuario, clave }                    -> { token, perfil:{usuario,nombre,rol,debe_cambiar_clave} }
 *   cambiar_clave    { clave_nueva, clave_actual? }        -> { token, perfil }
 *   iniciar          {}                                    -> { perfil, tenant:{nombre,tema,drive_vinculado,cuenta_gas}, suscripcion:{vence,vigente},
 *                                                              plantillas:[{id,nombre,categoria,tipo_archivo,permisos:{registrar,generar,reportes}}] }
 *   drive_guardar    { enlace }                            -> { drive_vinculado:true }          (admin_cliente; GAS extrae el ID de la carpeta)
 *   formulario       { plantilla_id }                      -> { plantilla, campos:[fila de campos_plantilla], permisos }
 *   previsualizar    { plantilla_id, datos }               -> { base64 (PDF) }
 *   enviar           { plantilla_id, datos, formatos }     -> { registro_id, archivos:[{formato,nombre,mime,base64,drive_url?}] }
 *                      (GAS guarda en registros_datos y, si el permiso `generar` lo permite, crea el documento en el Drive de la empresa)
 *   plantilla_analizar { archivo, base64 } | { borrador_id, hoja? } -> { borrador_id, tipo_archivo:'DOC'|'EXCEL', hojas?, hoja?, avisos:[], marcadores:[{nombre,apariciones,celdas?,sugerido}] }   (admin_cliente)
 *   plantilla_guardar { borrador_id, nombre, categoria?, descripcion?, hoja?, campos:[{nombre_marcador,etiqueta,tipo_dato,formato_fecha?,formato_numero?,moneda_tipo?,requiere_literal?,requerido}] } -> { id }
 *   plantilla_listar {} -> { plantillas:[{id,nombre,categoria,descripcion,tipo_archivo,hoja,activa,n_campos}] }   plantilla_detalle { id } -> { plantilla, campos }
 *   plantilla_actualizar { id, nombre?, categoria?, descripcion?, activa?, campos? } -> {}
 *   usuarios_listar  {}                                    -> { usuarios:[{id,usuario,nombre,activo,debe_cambiar_clave,permisos:[{plantilla_id,registrar,generar,reportes}]}], plantillas:[{id,nombre}] }
 *   usuario_crear    { nombre, permisos }                  -> { usuario, clave_temporal }
 *   usuario_actualizar { id, nombre?, activo?, permisos? } -> {}
 *   usuario_reiniciar_clave { id }                         -> { usuario, clave_temporal }
 *   empresas_listar  {}                                    -> { empresas:[…] }                                  (superadmin)
 *   empresa_crear    { nombre_empresa, responsable, gmail }-> { codigo, usuario, clave_temporal }               (superadmin)
 *   empresa_actualizar { id, estado?, vence? }             -> {}                                                (superadmin)
 *   empresa_reiniciar_admin { id }                         -> { usuario, clave_temporal }                       (superadmin)
 *   logout           {}                                    -> {}
 * Códigos de error: SESION · CAMBIAR_CLAVE · CREDENCIALES · BLOQUEADO · SIN_PERMISO · SUSCRIPCION · VALIDACION · CONFIG · RED · ERROR.
 * El token vive solo en sessionStorage y va en el cuerpo del POST, nunca en la URL.
 */
(() => {
'use strict';
const RE_GAS = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
const K_TOKEN = 'jd_token';

const memoria = {};
const guardar = (almacen) => ({
  get(k) { try { return window[almacen].getItem(k); } catch { return memoria[k] ?? null; } },
  set(k, v) { try { window[almacen].setItem(k, v); } catch { memoria[k] = v; } },
  del(k) { try { window[almacen].removeItem(k); } catch { delete memoria[k]; } },
});
const ses = guardar('sessionStorage'), loc = guardar('localStorage');

class ApiError extends Error {
  constructor(codigo, mensaje, detalles) { super(mensaje); this.name = 'ApiError'; this.codigo = codigo; this.detalles = detalles || null; }
}
const oyentes = {};
const on = (evento, fn) => { (oyentes[evento] ||= []).push(fn); };
const emitir = (evento, dato) => (oyentes[evento] || []).forEach((fn) => { try { fn(dato); } catch (e) { console.error(e); } });

const E = { gas: null };

/* Un solo Apps Script atiende a todas las empresas: el usuario ("<empresa>-op01") ya identifica a su empresa en el servidor.
   Solo hay que indicar la URL /exec en config.json. Solo se aceptan URLs de Apps Script. */
async function configurar() {
  if (E.gas) return E.gas;
  let r; try { r = await fetch('tenants.json', { cache: 'no-store' }); } catch { r = null; }
  if (!r || !r.ok) throw new ApiError('CONFIG', 'No se pudo cargar la configuración del sistema.');
  const url = (await r.json()).gas;
  if (typeof url !== 'string' || !RE_GAS.test(url)) throw new ApiError('CONFIG', 'El sistema aún no está configurado (falta la URL del servidor en tenants.json).');
  return (E.gas = url);
}

async function llamar(accion, datos = {}, opc = {}) {
  await configurar();
  const control = new AbortController(), reloj = setTimeout(() => control.abort(), opc.espera || 60000);
  let r;
  try {
    const resp = await fetch(E.gas, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: control.signal,
      body: JSON.stringify({ ...datos, accion, token: ses.get(K_TOKEN) || undefined }) });   // accion y token no los puede pisar `datos`
    r = await resp.json();
  } catch (e) {
    throw new ApiError('RED', e && e.name === 'AbortError' ? 'La operación tardó demasiado. Inténtalo de nuevo.' : 'No hay conexión con el servidor de tu empresa.');
  } finally { clearTimeout(reloj); }
  if (!r || r.ok !== true) {
    const codigo = (r && r.codigo) || 'ERROR';
    if (codigo === 'SESION') { ses.del(K_TOKEN); emitir('sesion-vencida'); }
    if (codigo === 'CAMBIAR_CLAVE') emitir('cambiar-clave');
    throw new ApiError(codigo, (r && r.error) || 'No se pudo completar la operación.', r && r.detalles);
  }
  return r;
}
const recibirToken = (r) => { if (typeof r.token === 'string' && r.token) ses.set(K_TOKEN, r.token); return r; };

window.Api = {
  ApiError, on, configurar,
  haySesion: () => !!ses.get(K_TOKEN),
  login: async (usuario, clave) => recibirToken(await llamar('login', { usuario: String(usuario || '').trim(), clave: String(clave || '') })),
  cambiarClave: async (claveNueva, claveActual) => recibirToken(await llamar('cambiar_clave', { clave_nueva: claveNueva, ...(claveActual ? { clave_actual: claveActual } : {}) })),
  iniciar: () => llamar('iniciar'),
  formulario: (plantillaId) => llamar('formulario', { plantilla_id: plantillaId }),
  vistaPrevia: (plantillaId, datos) => llamar('previsualizar', { plantilla_id: plantillaId, datos }, { espera: 120000 }),
  guardarDrive: (enlace) => llamar('drive_guardar', { enlace: String(enlace || '').trim() }),
  enviar: (plantillaId, datos, formatos, nombreArchivo, lote) => llamar('enviar', { plantilla_id: plantillaId, datos, formatos, ...(nombreArchivo ? { nombre_archivo: nombreArchivo } : {}), ...(lote ? { lote: true } : {}) }, { espera: 180000 }),
  registros: {
    listar: (f) => llamar('registro_listar', f || {}),
    detalle: (id) => llamar('registro_detalle', { id }),
    modificar: (id, datos, nombreArchivo) => llamar('registro_modificar', { id, datos, ...(nombreArchivo !== undefined ? { nombre_archivo: nombreArchivo } : {}) }, { espera: 180000 }),
    generar: (id, formatos) => llamar('registro_generar', { id, formatos }, { espera: 180000 }),
    descargar: (id, formato) => llamar('registro_descargar', { id, formato }, { espera: 120000 }),
    archivar: (id, motivo) => llamar('registro_archivar', { id, motivo }),
    recuperar: (id) => llamar('registro_recuperar', { id }),
  },
  reportes: {
    dashboard: (dias) => llamar('dashboard_admin', { dias }),
    plantillas: () => llamar('reporte_plantillas'),
    datos: (f) => llamar('reporte_datos', f),
  },
  auditoria: (f) => llamar('auditoria_listar', f || {}),
  guardarTema: (tema) => llamar('tema_guardar', tema),
  guardarMiEmpresa: (correoContacto) => llamar('mi_empresa_guardar', { correo_contacto: correoContacto }),
  plataforma: {
    panel: () => llamar('plataforma_panel'),
    avisosObtener: () => llamar('avisos_config_obtener'),
    avisosGuardar: (cfg) => llamar('avisos_config_guardar', cfg),
    avisosEjecutar: () => llamar('avisos_ejecutar', {}, { espera: 120000 }),
  },
  plantillas: {
    analizar: (archivo, base64) => llamar('plantilla_analizar', { archivo, base64 }, { espera: 120000 }),
    reanalizar: (borradorId, hoja) => llamar('plantilla_analizar', { borrador_id: borradorId, hoja }, { espera: 120000 }),
    guardar: (datos) => llamar('plantilla_guardar', datos, { espera: 120000 }),
    listar: () => llamar('plantilla_listar'),
    detalle: (id) => llamar('plantilla_detalle', { id }),
    actualizar: (id, cambios) => llamar('plantilla_actualizar', { id, ...cambios }),
  },
  usuarios: {
    listar: () => llamar('usuarios_listar'),
    crear: (nombre, permisos) => llamar('usuario_crear', { nombre, permisos }),
    actualizar: (id, cambios) => llamar('usuario_actualizar', { id, ...cambios }),
    reiniciarClave: (id) => llamar('usuario_reiniciar_clave', { id }),
  },
  empresas: {
    listar: () => llamar('empresas_listar'),
    crear: (nombreEmpresa, responsable, gmail) => llamar('empresa_crear', { nombre_empresa: nombreEmpresa, responsable, gmail }),
    actualizar: (id, cambios) => llamar('empresa_actualizar', { id, ...cambios }),
    reiniciarAdmin: (id) => llamar('empresa_reiniciar_admin', { id }),
  },
  salir: async () => { try { if (ses.get(K_TOKEN) && E.gas) await llamar('logout'); } catch { /* da igual: se borra localmente */ } ses.del(K_TOKEN); },
};
})();
