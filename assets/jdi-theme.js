/* JeaDas.Insights — motor de tema (Design Tokens semánticos).
 *
 * Principio: el código nunca cambia "azul" por "rojo". Cambia el valor del token
 * --color-primary-accent y todo lo demás se DERIVA de él con matemática:
 *
 *   --color-primary-accent   color de acento elegido (por defecto, el de la paleta JeaDas)
 *   --color-on-accent        texto sobre el acento: #111215 si el acento es claro, #FFFFFF si es oscuro
 *                            (se elige el de mayor contraste WCAG; así un amarillo mantequilla lleva texto negro)
 *   --color-primary-hover    acento 10 % más oscuro (luminosidad HSL × 0,90)
 *   --color-primary-focus    acento 10 % más claro (mezcla con blanco) con 45 % de opacidad: anillo de enfoque
 *   --color-accent-text      variante del acento legible COMO TEXTO sobre el fondo (contraste ≥ 4,5:1)
 *   --color-secondary-accent / --color-on-secondary-accent   lo mismo para el color secundario
 *
 * Los fondos (--color-bg…) y los textos (--color-text-main…) viven en shell.css, en su propia escala de
 * contraste, y NO cambian cuando el usuario elige otro acento.
 *
 * Alias heredados para los módulos: --jdi-primary, --jdi-secondary, --jdi-on-primary, --jdi-primary-hover,
 * --jdi-primary-focus, --jdi-on-secondary.
 */
(function (root) {
  'use strict';

  var PALETA = {            // paleta de identidad de la app
    marino: '#1C337E', cian: '#19B9DF', cobalto: '#214EC2',
    purpura: '#8A3DA6', electrico: '#1E5BC6', profundo: '#13235A'
  };
  var DEFECTO = { primario: PALETA.cobalto, secundario: PALETA.purpura };
  var TEXTO_OSCURO = '#111215', TEXTO_CLARO = '#FFFFFF';
  var FONDO_BASE = '#13235A';      // --color-bg del modo de identidad (para validar el acento como texto)

  function esHex(h) { return /^#[0-9a-f]{6}$/i.test(String(h || '')); }
  function aRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function aHex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('').toUpperCase(); }

  function aHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) {
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function deHsl(a) {
    var h = a[0], s = a[1], l = a[2];
    if (!s) return [l * 255, l * 255, l * 255];
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
    var q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
  }

  /* Luminancia relativa y contraste WCAG 2.x */
  function luminancia(hex) {
    var c = aRgb(hex).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  function contraste(a, b) { var x = luminancia(a), y = luminancia(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }

  /* Texto sobre un color interactivo: el de mayor contraste (claro → #111215, oscuro → #FFFFFF). */
  function colorSobre(hex) { return contraste(hex, TEXTO_OSCURO) > contraste(hex, TEXTO_CLARO) ? TEXTO_OSCURO : TEXTO_CLARO; }

  /* Hover: 10 % más oscuro (luminosidad × 0,90). */
  function hover(hex) { var a = aHsl(aRgb(hex)); a[2] = a[2] * .90; return aHex(deHsl(a)); }

  /* Enfoque: 10 % más claro (mezcla con blanco) y opacidad .45. */
  function enfoque(hex, alfa) {
    var c = aRgb(hex).map(function (v) { return v + (255 - v) * .10; });
    return 'rgba(' + c.map(Math.round).join(',') + ',' + (alfa == null ? .45 : alfa) + ')';
  }

  /* Acento utilizable como texto sobre un fondo: se aclara por pasos hasta alcanzar el contraste mínimo. */
  function legibleSobre(hex, fondo, min) {
    min = min || 4.5; fondo = fondo || FONDO_BASE;
    var a = aHsl(aRgb(hex)), h = hex, i = 0;
    while (contraste(h, fondo) < min && i++ < 40) { a[2] = Math.min(.97, a[2] + .02); h = aHex(deHsl(a)); }
    return h;
  }

  function derivar(primario, secundario) {
    var p = esHex(primario) ? primario.toUpperCase() : DEFECTO.primario;
    var s = esHex(secundario) ? secundario.toUpperCase() : DEFECTO.secundario;
    return {
      '--color-primary-accent': p,
      '--color-on-accent': colorSobre(p),
      '--color-primary-hover': hover(p),
      '--color-primary-focus': enfoque(p),
      '--color-accent-text': legibleSobre(p),
      '--color-secondary-accent': s,
      '--color-on-secondary-accent': colorSobre(s),
      '--color-secondary-hover': hover(s),
      // alias para los módulos
      '--jdi-primary': p, '--jdi-secondary': s, '--jdi-on-primary': colorSobre(p), '--jdi-on-secondary': colorSobre(s),
      '--jdi-primary-hover': hover(p), '--jdi-primary-focus': enfoque(p), '--jdi-accent-text': legibleSobre(p)
    };
  }

  /* Aplica los tokens al elemento raíz (document.documentElement). Sin colores válidos, usa la paleta JeaDas. */
  function aplicar(el, primario, secundario) {
    var t = derivar(primario, secundario);
    Object.keys(t).forEach(function (k) { el.style.setProperty(k, t[k]); });
    return t;
  }

  root.JDITheme = { PALETA: PALETA, DEFECTO: DEFECTO, TEXTO_OSCURO: TEXTO_OSCURO, TEXTO_CLARO: TEXTO_CLARO,
    esHex: esHex, luminancia: luminancia, contraste: contraste, colorSobre: colorSobre, hover: hover, enfoque: enfoque,
    legibleSobre: legibleSobre, derivar: derivar, aplicar: aplicar };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.JDITheme;
})(typeof window !== 'undefined' ? window : globalThis);
