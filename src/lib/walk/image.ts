const MAX_EDGE = 800;
const TARGET_BYTES = 200 * 1024;
const MAX_BYTES = 400 * 1024;
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

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(file.name);
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    if (isHeic(file)) {
      throw new Error("この端末では HEIC を変換できません。JPEG または PNG にしてください");
    }
    throw new Error("画像を読み込めませんでした");
  }
}

function draw(bitmap: ImageBitmap, edge: number): HTMLCanvasElement {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を処理できませんでした");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("画像の圧縮に失敗しました"));
      },
      mime,
      quality,
    );
  });
}

async function encodeBest(canvas: HTMLCanvasElement): Promise<Blob> {
  let mime = "image/webp";
  let quality = 0.84;
  let blob = await toBlob(canvas, mime, quality);
  if (blob.type !== "image/webp" || blob.size === 0) {
    mime = "image/jpeg";
    blob = await toBlob(canvas, mime, quality);
  }

  while (blob.size > MAX_BYTES && quality > 0.5) {
    quality -= 0.08;
    blob = await toBlob(canvas, mime, quality);
  }
  return blob;
}

export async function compressImage(file: File): Promise<File> {
  if (!isAllowedImage(file)) {
    throw new Error("jpeg / png / webp / heic の画像を選んでください");
  }

  const bitmap = await loadBitmap(file);
  let edge = MAX_EDGE;
  let canvas = draw(bitmap, edge);
  let blob = await encodeBest(canvas);

  while (blob.size > MAX_BYTES && edge > 480) {
    edge = Math.round(edge * 0.82);
    canvas = draw(bitmap, edge);
    blob = await encodeBest(canvas);
  }
  bitmap.close();

  if (blob.size > MAX_BYTES) {
    throw new Error("画像を 400KB 以下にできませんでした。別の写真を選んでください");
  }

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `photo.${ext}`, { type: blob.type, lastModified: Date.now() });
}

export const IMAGE_TARGET_HINT = `最大辺 ${MAX_EDGE}px・目安 ${Math.round(TARGET_BYTES / 1024)}KB`;
