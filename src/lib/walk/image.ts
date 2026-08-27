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

export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(file.name);
}

export function assertImageFile(file: File): void {
  if (!isAllowedImage(file)) {
    throw new Error("jpeg / png / webp / heic の画像を選んでください");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("画像は 8MB 以下にしてください");
  }
}

function toJpegFile(bitmap: ImageBitmap, name: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("画像を処理できませんでした"));
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const base = name.replace(/\.(heic|heif|jpe?g|png|webp)$/i, "") || "photo";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("画像を JPEG にできませんでした"));
          return;
        }
        resolve(new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

/** HEIC はブラウザから Blob へ直接送れないため、縮小せず JPEG にする。 */
export async function prepareImageFile(file: File): Promise<File> {
  assertImageFile(file);
  if (!isHeic(file)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    return await toJpegFile(bitmap, file.name);
  } catch {
    throw new Error("この端末では HEIC を送れません。写真アプリで「JPEG」や「最も互換性のある形式」にしてから選んでください");
  }
}

export function blobUploadName(file: File): string {
  const subtype = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const ext = ["jpg", "png", "webp"].includes(subtype) ? subtype : "jpg";
  return `walk/${crypto.randomUUID()}.${ext}`;
}

export function imageFileFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const file of Array.from(data.files)) {
    if (file.type.startsWith("image/")) return namedPaste(file);
  }
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const next = item.getAsFile();
      if (next) return namedPaste(next);
    }
  }
  return null;
}

function namedPaste(file: File): File {
  if (file.name && file.name !== "image.png" && file.name !== "image.jpg") return file;
  const subtype = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return new File([file], `paste.${subtype}`, { type: file.type, lastModified: Date.now() });
}

export const IMAGE_HINT =
  "ファイル選択、または貼り付け（Ctrl+V / ⌘V）。iPhone の HEIC は JPEG に変換して送ります。8MB 以下。";
