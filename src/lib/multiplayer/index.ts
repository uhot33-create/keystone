/**
 * 複数人プレイ用の再エクスポート。中身は p2p.ts。
 * 部屋の接続や STUN の待ち時間はそちら。今のメニュー機能からは使っていない。
 */
export { P2PRoom, defaultIceServers } from "./p2p";
export type {
  PeerInfo,
  P2PRoomOptions,
  SignalKind,
  PeerRow,
  SignalRow,
  RtcPollResponse,
} from "./p2p";
