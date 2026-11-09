
/* =========================================
   VISOR DE CONTRASEÑAS - JeaDas.Insights
   ========================================= */

(() => {
  'use strict';

  document.addEventListener('click', (event) => {
    const boton = event.target.closest('[data-toggle-password]');

    if (!boton) return;

    const id = boton.dataset.togglePassword;
    const campo = document.getElementById(id);

    if (!campo || campo.disabled) return;

    const mostrar = campo.type === 'password';

    campo.type = mostrar ? 'text' : 'password';

    boton.setAttribute(
      'aria-pressed',
      String(mostrar)
    );

    boton.setAttribute(
      'aria-label',
      mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'
    );

    boton.setAttribute(
      'title',
      mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'
    );

    campo.focus({ preventScroll: true });
  });

})();
