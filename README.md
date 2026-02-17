# Grain-Link

デジタルサイネージアプリケーション - Tauri + React + TypeScript

## 概要

Grain Link は、複数の店舗のデジタル掲示板を管理・更新するための高性能デスクトップアプリケーションです。

### 主な機能

- ✅ **自動アップデーター** - GitHub Releases ベースの安全な自動更新
- ✅ **メディア管理** - 画像・動画の自動ダウンロードと同期
- ✅ **リアルタイム配信** - WebSocket/SSE による動的コンテンツ更新
- ✅ **シグネチャ検証** - minisign による暗号的署名の検証
- ✅ **マルチプラットフォーム** - Windows のみサポート（v0.2.1 以降予定）

## クイックスタート

### 前提条件

- Node.js 20+
- Rust 1.70+（Tauri ビルド用）
- npm または yarn
- Windows 10 以降

### ローカルセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/s-yoshida-33/Grain-Link.git
cd Grain-Link

# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run tauri:build:signed
```

## アップデーター機能

### セットアップ

自動アップデーター機能の完全セットアップガイド：

1. **統合ガイド** - [UPDATER_INTEGRATION_GUIDE.md](UPDATER_INTEGRATION_GUIDE.md)
   - システム構成、実装チェックリスト、トラブルシューティング

2. **GitHub Releases** - [GITHUB_RELEASES_SETUP.md](GITHUB_RELEASES_SETUP.md)
   - リリース作成、ファイルアップロード、検証方法

3. **GitHub Actions** - [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)
   - CI/CD パイプライン、秘密情報設定、自動ビルド

4. **署名・検証** - [SIGNATURE_GUIDE.md](SIGNATURE_GUIDE.md)
   - minisign キー生成、署名検証、セキュリティ

### ブートシーケンス

アプリケーションは起動時に以下の 7 段階を実行：

```
1. アプリ起動
   ↓
2. アップデート確認（GitHub Releases から latest.yml 取得）
   ↓
3. アップデート実行（新バージョンあれば 📥 ダウンロード+インストール）
   またはスキップ
   ↓
4. メディアチェック（コンテンツリストから必要なファイル判定）
   ↓
5. メディアダウンロード（欠落ファイルを自動ダウンロード）
   またはスキップ
   ↓
6. 90 秒カウントダウン（準備完了を待機）
   ↓
7. メイン画面起動
```

**ブートスクリーンコンポーネント:** [src/screens/BootScreen.tsx](src/screens/BootScreen.tsx)

## メディアダウンロード

### 機能

- 画像・動画の自動ダウンロード
- 進捗表示とファイルレベルの追跡
- エラーリカバリーと再試行
- スキップ可能な UI

詳細: [MEDIA_DOWNLOAD.md](MEDIA_DOWNLOAD.md)

## ビルド

### コマンド

```bash
# 開発モード
npm run dev

# 署名付きビルド
npm run tauri:build:signed

# リリース（署名+ファイル管理）
npm run tauri:release
```

### パスワード管理

秘密鍵のパスワード入力方法：

- **毎回手動入力**（デフォルト）
- **環境変数に設定**（推奨：ローカル開発用）
- **GitHub Actions で自動化**（本番環境用）

詳細: [BUILD_PASSWORD_GUIDE.md](BUILD_PASSWORD_GUIDE.md)

### 快速セットアップ（パスワード自動設定）

```bash
# 環境変数にパスワードを設定（初回のみ）
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1
```

その後は `npm run tauri:release` でパスワード入力不要になります。

トラブルシューティング: [BUILD_TROUBLESHOOTING.md](BUILD_TROUBLESHOOTING.md)

## プロジェクト構成

```
Grain-Link/
├── src/                          # React フロントエンド
│   ├── screens/                  # ページコンポーネント
│   │   ├── BootScreen.tsx        # ⭐ ブートシーケンス (7段階)
│   │   ├── GidoApp.tsx           # メインアプリケーション
│   │   ├── ShopListView.tsx      # 店舗リスト表示
│   │   └── VideoSignageView.tsx  # 動画表示
│   ├── components/               # UI コンポーネント
│   │   ├── UpdateDialog.tsx      # アップデートダイアログ
│   │   ├── ShopCard.tsx          # 店舗カード
│   │   └── ...
│   ├── hooks/                    # React カスタムフック
│   │   ├── useAutoUpdate.ts      # ⭐ アップデーター管理
│   │   ├── useMediaDownload.ts   # ⭐ メディアダウンロード
│   │   └── useAppSettings.ts     # アプリ設定
│   ├── api/                      # API クライアント
│   │   ├── restClient.ts         # REST エンドポイント
│   │   └── sseClient.ts          # WebSocket 接続
│   └── types/                    # TypeScript 型定義
│
├── src-tauri/                    # Rust/Tauri バックエンド
│   ├── src/main.rs               # Tauri メインプロセス
│   ├── tauri.conf.json           # ⭐ Tauri 設定（更新設定含む）
│   └── Cargo.toml                # Rust 依存関係
│
├── build/                        # ビルドスクリプト
│   ├── sign-and-build.ps1        # ⭐ 署名付きビルド (改善版)
│   ├── manage-release.ps1        # リリースファイル管理
│   └── ...
│
├── .github/workflows/
│   └── build-release.yml         # ⭐ GitHub Actions パイプライン
│
└── docs/
    ├── UPDATER_INTEGRATION_GUIDE.md  # 統合ガイド
    ├── GITHUB_RELEASES_SETUP.md      # リリースセットアップ
    ├── GITHUB_ACTIONS_SETUP.md       # Actions 設定
    ├── SIGNATURE_GUIDE.md            # 署名ガイド
    └── MEDIA_DOWNLOAD.md             # メディアダウンロード
```

## 重要な改善内容

### ✨ v0.2.1 でのアップデーター実装

| 機能 | 詳細 |
|------|------|
| **GitHub Releases 統合** | GitHub API エンドポイント経由で latest.yml 取得 |
| **暗号署名検証** | minisign で全バイナリを検証 |
| **7段階ブートシーケンス** | 初期化中の詳細な進捗表示 |
| **メディア自動同期** | 起動時に必要なファイルを自動ダウンロード |
| **GitHub Actions パイプライン** | タグプッシュで自動ビルド・リリース |
| **PowerShell 自動化** | UTF-8 対応済みのビルドスクリプト |

## データベース・API

### エンドポイント

- `GET /api/shops` - 店舗一覧
- `GET /api/shops/{mallId}` - 店舗詳細
- `GET /api/media/list?mallId={mallId}` - メディアリスト
- `GET /api/media/status` - メディアダウンロード状態
- `WebSocket /ws/events` - リアルタイムイベント

## トラブルシューティング

よくある問題と解決方法:

| 問題 | 原因 | 解決策 |
|------|------|--------|
| `latest.yml` が生成されない | ビルド失敗またはロック | `cargo clean` 実行後に再度ビルド |
| 署名検証エラー | 古い公開鍵 | `tauri.conf.json` の pubkey を更新 |
| GitHub API rate limit | 多数のリクエスト | 1 時間待機するか Token を使用 |
| 更新が実行されない | ブートスクリーンスキップ | ブートスクリーン完全実行を確認 |

詳細は [BUILD_TROUBLESHOOTING.md](BUILD_TROUBLESHOOTING.md) を参照。

## パフォーマンス

### ブートシーケンス

- ⚡ アップデート確認: 平均 2-3 秒
- ⚡ メディアチェック: 平均 1-2 秒
- ⚡ メディアダウンロード: ネットワーク速度に依存
- ⚡ メイン画面表示: 1 秒以内

## セキュリティ

### 🔒 実装済みのセキュリティ対策

- ✅ 全バイナリに暗号署名
- ✅ GitHub Secrets で秘密鍵を保護
- ✅ HTTPS のみで通信
- ✅ ClI / SDK での手動署名をサポート
- ✅ GitHub Actions での自動 CI/CD

### ⚠️ セキュリティチェックリスト

デプロイ前に以下を確認:

- [ ] 秘密鍵を .gitignore で除外
- [ ] GitHub Secrets が登録済み
- [ ] 公開鍵が正しく設定
- [ ] すべてのリリースに .sig ファイルがある
- [ ] latest.yml に署名情報が含まれている

## ライセンス

[LICENSE](LICENSE) ファイルを参照。

## サポート

問題が発生した場合:

1. [GitHub Issues](https://github.com/s-yoshida-33/Grain-Link/issues) を確認
2. ドキュメント内の該当セクションを参照
3. ログファイルを確認: `%APPDATA%\grain-link\logs\`

### よくあるビルドエラー

#### ファイルロックエラー

```
error: failed to remove file ... (os error 5)
LINK : fatal error LNK1104: ファイルを開くことができません
```

**解決:** [FILE_LOCK_ERROR_SOLUTION.md](FILE_LOCK_ERROR_SOLUTION.md) を参照

**最初に試す:**
- PowerShell を **管理者権限** で実行
- パスワード設定: `powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1`
- ビルド実行: `npm run tauri:release`

#### パスワード入力エラー

```
[?] Enter private key password (or set TAURI_SIGNING_PASSWORD_OVERRIDE environment variable):
```

**解決:** [BUILD_PASSWORD_GUIDE.md](BUILD_PASSWORD_GUIDE.md) を参照

## ドキュメント一覧

### 初回セットアップ

- [UPDATER_INTEGRATION_GUIDE.md](UPDATER_INTEGRATION_GUIDE.md) - 全体的な統合ガイド
- [BUILD_PASSWORD_GUIDE.md](BUILD_PASSWORD_GUIDE.md) - パスワード環境変数設定

### ビルド実行

- [BUILD_EXECUTION_STEPS.md](BUILD_EXECUTION_STEPS.md) - ステップバイステップ実行ガイド
- [SETUP_COMPLETE.md](SETUP_COMPLETE.md) - 環境設定完了確認
- [FILE_LOCK_ERROR_SOLUTION.md](FILE_LOCK_ERROR_SOLUTION.md) - ファイルロックエラー解決方法

### リリース・デプロイ

- [GITHUB_RELEASES_SETUP.md](GITHUB_RELEASES_SETUP.md) - GitHub Releases セットアップ
- [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) - GitHub Actions パイプライン
- [SIGNATURE_GUIDE.md](SIGNATURE_GUIDE.md) - 暗号署名ガイド

### 機能・実装

- [MEDIA_DOWNLOAD.md](MEDIA_DOWNLOAD.md) - メディアダウンロード機能
- [BUILD_TROUBLESHOOTING.md](BUILD_TROUBLESHOOTING.md) - 一般的なトラブルシューティング

## 関連リンク

- [Tauri 公式ドキュメント](https://tauri.app/)
- [React ドキュメント](https://react.dev/)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [minisign - 暗号署名](https://jedisct1.github.io/minisign/)