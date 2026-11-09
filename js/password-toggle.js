/* =========================================
   VISOR DE CONTRASEÑAS
   JeaDas.Insights
   ========================================= */

(function () {
  'use strict';

  function inicializarVisor() {

    document.querySelectorAll('[data-toggle-password]')
      .forEach(function (boton) {

        // Evitar registrar eventos duplicados
        if (boton.dataset.visorInicializado === 'true') {
          return;
        }

        boton.dataset.visorInicializado = 'true';

        boton.addEventListener('click', function (event) {

          event.preventDefault();
          event.stopPropagation();

          const idCampo = boton.getAttribute('data-toggle-password');
          const campo = document.getElementById(idCampo);

          if (!campo) {
            console.error('No se encontró el campo:', idCampo);
            return;
          }

          // Alternar visibilidad
          const mostrar = campo.type === 'password';

          campo.type = mostrar ? 'text' : 'password';

          boton.setAttribute('aria-pressed', String(mostrar));
          boton.setAttribute(
            'aria-label',
            mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'
          );

          boton.setAttribute(
            'title',
            mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'
          );

        });

      });
  }

  // Inicializar cuando el documento esté disponible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarVisor);
  } else {
    inicializarVisor();
  }

})();
