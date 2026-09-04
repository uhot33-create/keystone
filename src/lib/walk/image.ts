export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** createServerFn の JSON が Vercel 4.5MB を超えないよう抑える */
export const MAX_UPLOAD_BYTES = 2.8 * 1024 * 1024;

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

function drawToJpeg(bitmap: ImageBitmap, name: string, quality: number, maxEdge: number): Promise<File> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("画像を処理できませんでした"));
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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
      quality,
    );
  });
}

async function toJpeg(file: File, quality: number, maxEdge: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    return await drawToJpeg(bitmap, file.name, quality, maxEdge);
  } finally {
    bitmap.close();
  }
}

/** HEIC は JPEG 化。Vercel の 4.5MB 制限を超えるときだけ縮小する。 */
export async function prepareImageFile(file: File): Promise<File> {
  assertImageFile(file);
  let next = file;
  if (isHeic(file)) {
    try {
      next = await toJpeg(file, 0.92, 4096);
    } catch {
      throw new Error(
        "この端末では HEIC を送れません。写真アプリで「JPEG」や「最も互換性のある形式」にしてから選んでください",
      );
    }
  }
  if (next.size <= MAX_UPLOAD_BYTES) return next;

  try {
    for (const [quality, edge] of [
      [0.84, 2048],
      [0.76, 1600],
      [0.7, 1280],
    ] as const) {
      next = await toJpeg(next, quality, edge);
      if (next.size <= MAX_UPLOAD_BYTES) return next;
    }
  } catch {
    throw new Error("画像を送れませんでした。別の写真を選んでください");
  }
  throw new Error("画像が大きすぎます。別の写真を選んでください");
}

export function imageContentType(file: File): "image/jpeg" | "image/png" | "image/webp" {
  if (file.type === "image/png") return "image/png";
  if (file.type === "image/webp") return "image/webp";
  return "image/jpeg";
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const comma = text.indexOf(",");
      const base64 = comma >= 0 ? text.slice(comma + 1) : text;
      if (!base64) {
        reject(new Error("画像を読み込めませんでした"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("画像を読み込めませんでした"));
    reader.readAsDataURL(file);
  });
}

export function imageFileFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const file of Array.from(data.files)) {
    if (file.type.startsWith("image/") || isAllowedImage(file)) return namedPaste(file);
  }
  for (const item of Array.from(data.items)) {
    const type = item.type.toLowerCase();
    if (item.kind === "file" && (type.startsWith("image/") || type.includes("png") || type.includes("jpeg") || type.includes("jpg") || type.includes("heic"))) {
      const picked = item.getAsFile();
      if (picked) return namedPaste(picked);
    }
  }
  return null;
}

export async function fileFromImageSrc(src: string): Promise<File | null> {
  if (!src.startsWith("data:") && !src.startsWith("blob:")) return null;
  const res = await fetch(src);
  const blob = await res.blob();
  if (!blob.size) return null;
  const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  return namedPaste(new File([blob], "paste.jpg", { type, lastModified: Date.now() }));
}

function namedPaste(file: File): File {
  if (file.name && file.name !== "image.png" && file.name !== "image.jpg") return file;
  const subtype = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return new File([file], `paste.${subtype}`, { type: file.type, lastModified: Date.now() });
}

export function walkMemoImageSrc(
  memo: { id: string; imageUrl?: string | null; images?: { url: string }[]; coverIndex?: number },
  index?: number,
): string | null {
  const count = memo.images?.length
    ? memo.images.length
    : memo.imageUrl
      ? 1
      : 0;
  if (count === 0) return null;
  const i = Math.min(Math.max(0, index ?? memo.coverIndex ?? 0), count - 1);
  return `/api/walk/image?id=${encodeURIComponent(memo.id)}&i=${i}`;
}

export const IMAGE_HINT =
  "1枚のカードに3枚まで。ファイル選択、または貼り付け。iPhone は写真をコピーしたあと、枠を長押しして「ペースト」。HEIC は JPEG にします。8MB 以下。";

