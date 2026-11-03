/**
 * @file Compresión de fotos antes de enviarlas
 * @description Una foto de la cámara del teléfono pesa 3-8 MB: se achica a 1600 px de lado
 * mayor en JPEG (~200-500 KB), así sube rápido con datos móviles y entra en el límite del servidor.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.82;
// Por debajo de esto no vale la pena recomprimir
const MIN_BYTES_TO_COMPRESS = 400 * 1024;
// GIF se mandaría sin animación; HEIC la mayoría de los navegadores no lo puede dibujar
const COMPRESSIBLE = ['image/jpeg', 'image/png', 'image/webp'];

const loadImage = async (file) => {
  // createImageBitmap aplica la rotación EXIF (fotos del teléfono "acostadas")
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * @param {File} file
 * @returns {Promise<File>} La foto achicada, o el mismo archivo si no hace falta o no se puede
 */
export const compressImage = async (file) => {
  if (!COMPRESSIBLE.includes(file.type) || file.size < MIN_BYTES_TO_COMPRESS) return file;

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    // Fondo blanco: un PNG con transparencia no queda negro al pasarlo a JPEG
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    image.close?.();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (error) {
    console.warn('No se pudo comprimir la imagen, se envía original:', error);
    return file;
  }
};

/**
 * Foto de perfil: recorte cuadrado desde el centro, 512 px, JPEG.
 * Así entra justa en el círculo del avatar y pesa ~30-80 KB.
 * @param {File} file
 * @param {number} [size=512]
 * @returns {Promise<File>}
 */
export const cropSquareImage = async (file, size = 512) => {
  const image = await loadImage(file);
  const side = Math.min(image.width, image.height);
  const target = Math.min(size, side);

  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, target, target);
  context.drawImage(
    image,
    (image.width - side) / 2, (image.height - side) / 2, side, side,
    0, 0, target, target
  );
  image.close?.();

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('No se pudo procesar la imagen');
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg', lastModified: Date.now() });
};
