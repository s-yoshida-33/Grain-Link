# アップデーター署名ファイル利用ガイド

## 概要

Grain Link では Tauri v2 のアップデーター機能に署名検証を実装しています。このドキュメントでは、署名ファイルの生成と利用方法について説明します。

## 署名ファイルの構成

### 秘密鍵と公開鍵

- **秘密鍵**: `~/.ssh/TAURI_KEY_PASSWORD.sh` (パスワード保護)
- **公開鍵**: `~/.ssh/TAURI_KEY_PASSWORD.sh.pub` (公開)

### 署名ファイル

- **拡張子**: `.sig`
- **場所**: ビルド成果物の同じディレクトリ内
- **例**: 
  - `GrainLinkSetup-x64-0.2.1.exe.sig`
  - `grain-link_0.2.1_x64.msi.sig`

## ビルドと署名プロセス

### 1. 署名付きビルド実行

```bash
npm run tauri:build:signed
```

このコマンドは以下を実行します：
1. 秘密鍵のパスワード入力を求めます
2. Tauri ビルドを実行
3. バイナリに自動的に署名
4. `.sig` ファイルを生成
5. `latest.yml` に署名情報を記載

### 2. リリースファイル管理

```bash
npm run tauri:release
```

このコマンドは以下を実行します：
1. 署名付きビルド実行
2. バイナリと署名ファイルを `release/` ディレクトリにコピー
3. `latest.yml` の署名情報を確認
4. リリースの準備完了

## ファイル構成

ビルド後のディレクトリ構成：

```
release/
├── GrainLinkSetup-x64-0.2.1.exe      (インストーラ)
├── GrainLinkSetup-x64-0.2.1.exe.sig  (署名ファイル) ⭐
├── latest.yml                        (メタデータ + 署名情報)
└── ...
```

### latest.yml の例

```yaml
version: 0.2.1
files:
  - url: GrainLinkSetup-x64-0.2.1.exe
    sha512: <ハッシュ値>
    signature: <Base64形式の署名>  # 署名検証用
path: GrainLinkSetup-x64-0.2.1.exe
sha512: <ハッシュ値>
releaseDate: '2026-02-17T10:30:00.000Z'
```

## 設定（tauri.conf.json）

### アップデーター設定

```json
"plugins": {
  "updater": {
    "active": true,
    "endpoints": ["https://updates.tauri.app/releases/latest"],
    "dialog": false,
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDM..."
  }
}
```

**設定項目:**
- `active`: アップデーター機能を有効化
- `endpoints`: アップデートメタデータの取得先（複数指定可）
- `dialog`: ユーザーに更新確認ダイアログを表示するかどうか
- `pubkey`: 公開鍵（署名検証用） ⭐

## フロントエンド実装

### useAutoUpdate フック

```typescript
import { useAutoUpdate } from '../hooks/useAutoUpdate';

export const MyApp = () => {
  const { updateStatus, installUpdate } = useAutoUpdate();
  // useAutoUpdate は自動的に tauri.conf.json の設定を使用
  // 公開鍵による署名検証も自動実行
};
```

## 署名検証のフロー

```
1. クライアント: latest.yml をダウンロード
           ↓
2. クライアント: 署名情報を抽出
           ↓
3. クライアント: 公開鍵（tauri.conf.json に設定）で署名を検証
           ↓
4.署名が有効な場合のみダウンロード/インストールを続行
           ↓
5. 署名が無効な場合はエラーを返す
```

## 配布とアップデート

### 推奨フロー

1. **ローカルビルド**
   ```bash
   npm run tauri:build:signed
   ```

2. **リリースの準備**
   ```bash
   npm run tauri:release
   ```

3. **GitHub Releases にアップロード**
   - `release/` ディレクトリのすべてのファイル
   - `latest.yml` と `.sig` ファイル を必ず含める

4. **アップデート検証**
   - クライアントが自動的に署名を検証
   - 有効な署名のみダウンロード可能

## セキュリティベストプラクティス

### ✅ すること

- ✅ 秘密鍵を安全に保管
- ✅ 秘密鍵のパスワードを強力に設定
- ✅ パスワードは環境変数で管理（CI/CD）
- ✅ すべてのビルドに署名を付与
- ✅ `latest.yml` と `.sig` ファイルを一緒に配布

### ❌ しないこと

- ❌ 秘密鍵を public リポジトリにコミット
- ❌ 秘密鍵のパスワードをコード内に含める
- ❌ 署名なしのバイナリを配布
- ❌ `.sig` ファイル なしで `latest.yml` を配布

## トラブルシューティング

### 署名ファイルが生成されない

原因：
- 秘密鍵が見つからない
- パスワードが間違っている
- Tauri のバージョンが古い

対策：
```bash
# 秘密鍵の確認
ls -la ~/ | grep TAURI_KEY

# 鍵を再生成
npx tauri signer generate -w ~/TAURI_KEY_PASSWORD.sh

# npm パッケージを更新
npm update @tauri-apps/cli
```

### 署名検証エラー

原因：
- 公開鍵が古い
- バイナリが改ざんされている
- ネットワーク接続エラー

対策：
- `tauri.conf.json` の `pubkey` を最新の公開鍵に更新
- ビルドを再実行
- `latest.yml` の署名情報を確認

### アップデートが自動実行されない

原因：
- アップデーター設定が無効
- エンドポイント URL が誤り
- ネットワーク接続エラー

対策：
```typescript
// useAutoUpdate のログを確認
logWarn('UPDATER', 'Checking for app updates');
// ブラウザの開発者ツールで ネットワークエラーを確認
```

## 環境変数（CI/CD 用）

GitHub Actions など CI/CD システムで署名付きビルドを自動化する場合：

```bash
# 秘密鍵をファイルから環境変数に設定
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content ~/TAURI_KEY_PASSWORD.sh -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $PASSWORD

# ビルド実行
npm run tauri:build
```

## 参考リンク

- [Tauri Updater ドキュメント](https://tauri.app/develop/updater/)
- [Tauri 署名ツール](https://tauri.app/cli/signer/)
- [minisign](https://jedisct1.github.io/minisign/) - 署名フォーマット
