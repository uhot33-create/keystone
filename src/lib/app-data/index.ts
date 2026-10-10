/**
 * コネクタ用の公開口。型とログイン補助だけをここから出す。
 * 実呼び出しは client.server.ts（サーバー専用）。ブラウザの部品から直接呼ばない。
 */
export {
  CONNECTOR_TOKEN_HEADER,
  ConnectorType,
  GoogleDriveTools,
} from "./types.ts";
export type {
  CallToolOptions,
  CallToolResult,
  ConnectorTypeName,
  ToolArgs,
} from "./types.ts";
export { isLoginRequired, redirectToLoginIfRequired } from "./login.ts";
export { classifyCallToolError } from "./errors.ts";
export type { CallToolErrorKind, CallToolErrorState } from "./errors.ts";
