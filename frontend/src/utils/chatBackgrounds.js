/**
 * @file Fondos del chat
 * @description Opciones de fondo para la conversación. Cada una tiene versión clara y oscura,
 * para que en el tema oscuro ningún fondo encandile y las burbujas se sigan leyendo.
 */

// Dibujo sutil que se repite (SVG en línea, sin pedir archivos al servidor)
const pattern = (shapes, color) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' fill='${color}'>${shapes}</svg>`
  )}")`;

const DOTS = "<circle cx='8' cy='8' r='2'/><circle cx='40' cy='24' r='1.5'/><circle cx='24' cy='48' r='2.5'/><circle cx='56' cy='56' r='1.5'/>";
const BUBBLES = "<path d='M10 14h16a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-9l-5 4v-4h-2a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z' fill-opacity='.9'/><circle cx='48' cy='46' r='6' fill-opacity='.7'/>";
const HEARTS = "<path d='M16 26s-8-5-8-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-8 10-8 10z'/><path d='M46 54s-5-3-5-6a2.5 2.5 0 0 1 5-.6 2.5 2.5 0 0 1 5 .6c0 3-5 6-5 6z'/>";

/**
 * id: se guarda en el teléfono | light/dark: valor CSS de "background" (también se usa como muestra)
 */
export const CHAT_BACKGROUNDS = [
  // El de siempre: puntitos del color de la app
  {
    id: 'default',
    light: 'radial-gradient(rgba(var(--v-theme-primary), 0.06) 1px, transparent 1px) 0 0 / 22px 22px, var(--app-bg)',
    dark: 'radial-gradient(rgba(var(--v-theme-primary), 0.06) 1px, transparent 1px) 0 0 / 22px 22px, var(--app-bg)',
  },
  { id: 'sky', light: '#e3f2fd', dark: '#0d1b2a' },
  { id: 'mint', light: '#e0f2f1', dark: '#0b201d' },
  { id: 'sand', light: '#f5ecdc', dark: '#221c13' },
  { id: 'lavender', light: '#ede7f6', dark: '#1a1528' },
  { id: 'sunset', light: 'linear-gradient(160deg, #ffe0d1 0%, #fce4ec 50%, #ede7f6 100%)', dark: 'linear-gradient(160deg, #2a1712 0%, #26141c 50%, #1a1528 100%)' },
  { id: 'ocean', light: 'linear-gradient(160deg, #e0f7fa 0%, #e3f2fd 60%, #e8eaf6 100%)', dark: 'linear-gradient(160deg, #0a2226 0%, #0d1b2a 60%, #12152a 100%)' },
  { id: 'dots', light: `${pattern(DOTS, '#90a4ae55')}, #eceff1`, dark: `${pattern(DOTS, '#ffffff14')}, #121619` },
  { id: 'chat', light: `${pattern(BUBBLES, '#4db6ac33')}, #e8f5e9`, dark: `${pattern(BUBBLES, '#4db6ac1f')}, #0f1a14` },
  { id: 'hearts', light: `${pattern(HEARTS, '#f0629244')}, #fdecf2`, dark: `${pattern(HEARTS, '#f062921f')}, #1f1117` },
];

export const DEFAULT_BACKGROUND = 'default';

/**
 * @param {string} id
 * @param {boolean} isDark
 * @returns {string} Valor CSS para "background"
 */
export const getChatBackground = (id, isDark) => {
  const option = CHAT_BACKGROUNDS.find(item => item.id === id) || CHAT_BACKGROUNDS[0];
  return isDark ? option.dark : option.light;
};
