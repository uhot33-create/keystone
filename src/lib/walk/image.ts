/**
 * お散歩カードの画像。選択・HEIC 変換・縮小・サムネ・一覧の画像 URL。
 * 画面はカード一覧のサムネと、新規・編集フォームの貼り付け。
 * 選べる上限は MAX_IMAGE_BYTES（8MB）。送信前に縮小する上限は MAX_UPLOAD_BYTES。
 * 一覧の本画像は /api/walk/image。サムネは thumbData か公開 thumbUrl。
 * 案内文は IMAGE_HINT。枚数は types.ts の MAX_MEMO_IMAGES。
 */

/**
 * 選べるファイルの上限。超えると「8MB 以下」になる。その文言は assertImageFile。
 * 画面は新規・編集の選択。送信サイズとは別（そちらは MAX_UPLOAD_BYTES）。
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/**
 * createServerFn の JSON が Vercel 4.5MB を超えないよう抑える。
 * 画面は画像の保存。サーバー側の対応は api.ts の MAX_B64。両方揃える。
 */
export const MAX_UPLOAD_BYTES = 2.8 * 1024 * 1024;

/**
 * 許可する拡張子。MIME が空のファイルはこれで通す。
 * 形式を増やすなら ALLOWED_MIME と、案内文 IMAGE_HINT も合わせる。
 */
const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
/**
 * 許可する MIME。空の type は ALLOWED_EXT に任せる。
 * 形式を増やすなら両方と、assertImageFile のエラー文、IMAGE_HINT。
 */
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * jpeg / png / webp / heic / heif。MIME か拡張子のどちらかで通す。
 * 画面は新規・編集の画像選択・貼り付け。上限の前にここで形式を見る。
 * 形式を増やすなら ALLOWED_MIME と ALLOWED_EXT。
 */
export function isAllowedImage(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type && ALLOWED_MIME.has(type)) return true;
  return ALLOWED_EXT.test(file.name);
}

/**
 * iPhone の HEIC / HEIF か。true なら prepareImageFile が JPEG にする。
 * 画面は新規・編集。MIME か拡張子。変換できない端末は prepareImageFile が案内する。
 * 判定を広げるならこの type と正規表現。
 */
export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(file.name);
}

/**
 * 形式と 8MB を確認する。ダメなら日本語の Error。画面はその message を出す。
 * 画面は新規・編集の選択・貼り付け。上限は MAX_IMAGE_BYTES。
 * 文言や上限を変えるならここ。送信前の縮小は prepareImageFile。
 */
export function assertImageFile(file: File): void {
  if (!isAllowedImage(file)) {
    throw new Error("jpeg / png / webp / heic の画像を選んでください");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("画像は 8MB 以下にしてください");
  }
}

/**
 * ビットマップを長辺 maxEdge 以内の JPEG にする。品質は quality。
 * HEIC 変換も、アップロード縮小も、一覧サムネもここを通る。画面は新規・編集。
 * 画質や辺の長さを変えるなら呼び出し側の引数（prepareImageFile / makeListThumb）。
 */
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

/**
 * createImageBitmap して drawToJpeg し、必ず bitmap を閉じる。
 * 画面は新規・編集の画像処理。失敗したら呼び出し側が日本語の Error にする。
 * サーバー側のサムネは api.ts の sharp。大きさを揃えるなら両方。
 */
async function toJpeg(file: File, quality: number, maxEdge: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    return await drawToJpeg(bitmap, file.name, quality, maxEdge);
  } finally {
    bitmap.close();
  }
}

/**
 * HEIC は JPEG 化。Vercel の 4.5MB 制限を超えるときだけ縮小する。
 * 画面は新規・編集。選べる上限は assertImageFile（8MB）。送る上限は MAX_UPLOAD_BYTES。
 * 縮小の段（品質と長辺）を変えるなら下の for。
 */
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

/**
 * 保存 API に渡す Content-Type。png / webp 以外は jpeg。
 * 画面は新規・編集の uploadWalkImage。HEIC は prepare 済みで jpeg になっている。
 * 形式を増やすなら api.ts の upload の zod enum も合わせる。
 */
export function imageContentType(file: File): "image/jpeg" | "image/png" | "image/webp" {
  if (file.type === "image/png") return "image/png";
  if (file.type === "image/webp") return "image/webp";
  return "image/jpeg";
}

/**
 * File を data URL から base64 部分だけ取る。アップロードの中身。
 * 画面は新規・編集の保存。長さの上限は api.ts の MAX_B64。
 * 失敗文言を変えるならここの Error。
 */
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

/**
 * クリップボードの DataTransfer から画像を 1 枚取る。フォームの貼り付け用。
 * 画面は新規・編集の空枠。画像でなければ null（文字のペーストは呼び出し側が通す）。
 * 取る形式を変えるならここと isAllowedImage。
 */
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

/**
 * 貼り付けで入った data: や blob: を File に戻す。通常の http URL は null。
 * 画面は新規・編集。contentEditable が img を挿入したときの受け口。
 * http の画像まで取り込むなら、ここの startsWith を広げる。
 */
export async function fileFromImageSrc(src: string): Promise<File | null> {
  if (!src.startsWith("data:") && !src.startsWith("blob:")) return null;
  const res = await fetch(src);
  const blob = await res.blob();
  if (!blob.size) return null;
  const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  return namedPaste(new File([blob], "paste.jpg", { type, lastModified: Date.now() }));
}

/**
 * クリップボード由来の無名ファイルに paste.拡張子 を付ける。すでに名前があるものはそのまま。
 * 画面は新規・編集の貼り付け。image.png / image.jpg は無名扱いで付け替える。
 * 既定の名前を変えるならここの paste。
 */
function namedPaste(file: File): File {
  if (file.name && file.name !== "image.png" && file.name !== "image.jpg") return file;
  const subtype = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return new File([file], `paste.${subtype}`, { type: file.type, lastModified: Date.now() });
}

/**
 * 一覧用の小さい JPEG。長辺 128px、品質 0.72。大きさを変えるならこの引数。
 * 画面は /dogfriend のサムネ。保存時に uploadWalkImage へ thumbBase64 で渡す。
 * サーバーが作り直すときの大きさは api.ts の sharp（128, quality 72）。両方揃える。
 */
export async function makeListThumb(file: File): Promise<File> {
  return toJpeg(file, 0.72, 128);
}

/**
 * カードに画像 URL が 1 枚でもあるか。一覧のサムネ枠を出すかどうか。
 * 画面は /dogfriend の MemoCard。古い1枚だけの imageUrl も真。
 * 枠を出す条件を変えるならここ。URL の作りは walkMemoImageSrc。
 */
export function walkMemoHasPhoto(memo: {
  imageUrl?: string | null;
  images?: { url?: string | null }[];
}): boolean {
  if (memo.images?.some((image) => Boolean(image.url))) return true;
  return Boolean(memo.imageUrl);
}

/**
 * 一覧・拡大用の画像 URL。
 * thumb は base64 か公開サムネだけ。無ければ null（一覧は「作成中」）。
 * full は /api/walk/image?id=&i= 。ログイン後に本画像を取る。
 */
export function walkMemoImageSrc(
  memo: {
    id: string;
    imageUrl?: string | null;
    updatedAt?: string | null;
    images?: {
      url: string;
      pathname?: string | null;
      thumbUrl?: string | null;
      thumbPublic?: boolean;
      thumbData?: string | null;
    }[];
    coverIndex?: number;
  },
  index?: number,
  kind: "full" | "thumb" = "full",
): string | null {
  const images = memo.images?.length
    ? memo.images
    : memo.imageUrl
      ? [{ url: memo.imageUrl, thumbUrl: null as string | null, thumbPublic: false, thumbData: null as string | null }]
      : [];
  if (images.length === 0) return null;
  const i = Math.min(Math.max(0, index ?? memo.coverIndex ?? 0), images.length - 1);
  const slot = images[i];
  if (kind === "thumb") {
    if (slot?.thumbData && slot.thumbData.length > 100) return `data:image/jpeg;base64,${slot.thumbData}`;
    if (slot?.thumbPublic && slot.thumbUrl && slot.thumbUrl !== slot.url) return slot.thumbUrl;
    return null;
  }
  const version = encodeURIComponent(
    (slot?.pathname || slot?.url || memo.updatedAt || String(i)).split("/").pop()?.slice(-40) || String(i),
  );
  return `/api/walk/image?id=${encodeURIComponent(memo.id)}&i=${i}&v=${version}`;
}

/**
 * フォームの画像欄の説明。枚数・貼り付け方・8MB の案内文面はここ。
 * 画面は新規・編集。ユーザーに見える文字列なので、変えると表示が変わる。
 * 枚数の実上限は types.ts の MAX_MEMO_IMAGES。ここは案内だけ。
 */
export const IMAGE_HINT =
  "1枚のカードに3枚まで。ファイル選択、または貼り付け。iPhone は写真をコピーしたあと、枠を長押しして「ペースト」。HEIC は JPEG にします。8MB 以下。";

