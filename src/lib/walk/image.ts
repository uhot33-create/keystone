export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function isAllowedImage(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type && ALLOWED_MIME.has(type)) return true;
  return ALLOWED_EXT.test(file.name);
}

export function assertImageFile(file: File): void {
  if (!isAllowedImage(file)) {
    throw new Error("jpeg / png / webp / heic の画像を選んでください");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("画像は 8MB 以下にしてください");
  }
}

export const IMAGE_HINT = "jpeg / png / webp / heic。8MB 以下。選んだファイルをそのまま保存します。";
