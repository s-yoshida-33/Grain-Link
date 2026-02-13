/**
 * Logging type definitions for Grain Link
 * Based on Gido's logging architecture
 */

/**
 * Log tags (scopes) for categorizing log messages
 * This helps identify the source and context of each log entry
 */
export type LogTag =
  // システム
  | 'SYS_INIT'           // アプリ起動・初期化
  | 'SYS_SHUTDOWN'       // アプリ終了

  // データ同期 (REST API)
  | 'DATA_SYNC'          // REST API からのショップデータ取得、SSE接続

  // メディア管理
  | 'MEDIA_UPDATE'       // メディア更新プロセス
  | 'LOCAL_VIDEO'        // ローカルビデオ再生、再生制御

  // 設定管理
  | 'CONFIG'             // アプリ設定の読み込み・保存

  // エラーハンドリング
  | 'RENDERER_ERROR'     // React/JavaScript エラー
  | 'IPC_ERROR'          // IPC 通信エラー

  // その他（既存コード互換性のため無制限許容）
  | string;

/**
 * Additional context information to include in log entries
 * Useful for providing additional metadata about the log
 */
export interface LogContext {
  [key: string]: any;
}
