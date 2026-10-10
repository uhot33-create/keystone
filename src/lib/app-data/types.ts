/**
 * コネクタ呼び出しの型と定数。
 * ヘッダー名、対応サービス、Google ドライブのツール名を変えるときはここ。
 * 認証の環境変数（VITE_AUTH_ENABLED など）は lib/auth/server.ts。
 */
/** ゲートが付けるアクセストークンのヘッダー名。 */
export const CONNECTOR_TOKEN_HEADER = "x-connector-access-token";

/** このアプリが呼べるコネクタの種類。値はゲート側の名前と一致させる。 */
export const ConnectorType = {
  GoogleDrive: "GoogleDrive",
  Gmail: "Gmail",
  GoogleCalendar: "GoogleCalendar",
  Outlook: "Outlook",
  OutlookCalendar: "OutlookCalendar",
  MicrosoftTeams: "MicrosoftTeams",
  Mcp: "Mcp",
} as const;

/** ConnectorType の値の型。 */
export type ConnectorTypeName =
  (typeof ConnectorType)[keyof typeof ConnectorType];

/** Google ドライブで使うツール名。ゲートのツール id を変えたときここも変える。 */
export const GoogleDriveTools = {
  search: "google_drive_search",
  readFile: "google_drive_read_file",
  listFolder: "google_drive_list_folder",
  createFolder: "google_drive_create_folder",
  trashFile: "google_drive_trash_file",
} as const;

/** ツール呼び出しの結果。loginRequired のときは loginUrl でログインへ誘導する。 */
export type CallToolResult<T = unknown> = {
  ok: boolean;
  data: T | null;
  errorMessage?: string;
  loginRequired?: boolean;
  loginUrl?: string;
};

/** callTool のオプション。connectorType は必須。 */
export type CallToolOptions = {
  connectorType: ConnectorTypeName;
  connectorCatalogId?: string;
  token?: string | null;
};

/** ツールに渡す引数。キーはツールごとに違う。 */
export type ToolArgs = Record<string, unknown>;
