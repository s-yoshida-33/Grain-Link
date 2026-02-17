# GitHub Actions 秘密設定ガイド

## 概要

CI/CD ビルドパイプラインが署名ファイルを安全に使用するために、秘密情報を GitHub Secrets に登録します。

## 秘密情報の登録手順

### 1. GitHub リポジトリ設定を開く

```
https://github.com/s-yoshida-33/Grain-Link/settings/secrets/actions
```

### 2. 新規秘密を作成

#### 秘密 #1: TAURI_SIGNING_PRIVATE_KEY

**内容:** minisign 秘密鍵ファイルの内容

1. ローカルマシンで秘密鍵を確認
   ```powershell
   # Windows
   Get-Content "$env:USERPROFILE\.minisign\default*" -Raw
   
   # または秘密鍵ファイルが保存されている場所で
   Get-Content "path/to/secret.key" -Raw
   ```

2. 内容をコピー（以下の形式）
   ```
   untrusted comment: minisign key ID XXXXXXXXXXXXXXXX
   RWS_BASE64_ENCODED_KEY...==
   ```

3. GitHub Secrets に貼り付け
   - Name: `TAURI_SIGNING_PRIVATE_KEY`
   - Value: （秘密鍵の内容を丸ごとペースト）

#### 秘密 #2: TAURI_SIGNING_PRIVATE_KEY_PASSWORD

**内容:** 秘密鍵のパスフレーズ

1. ローカルで設定したパスフレーズを入力
   - Name: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   - Value: （パスフレーズ）

## 秘密情報の確認

### リポジトリから定期的に確認

```
Settings → Secrets and variables → Actions
↓
以下の2つが登録されているか確認：
✅ TAURI_SIGNING_PRIVATE_KEY
✅ TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

### CLI で確認（削除のみ）

```powershell
# 登録されている秘密一覧を確認
gh secret list --repo s-yoshida-33/Grain-Link

# 秘密を削除（必要な場合）
gh secret delete TAURI_SIGNING_PRIVATE_KEY --repo s-yoshida-33/Grain-Link
gh secret delete TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo s-yoshida-33/Grain-Link
```

## ワークフロー実行手順

### 方法 1: タグをプッシュして自動実行

```bash
# ローカルでバージョン更新
$version = "0.2.2"

# package.json を更新
$json = Get-Content package.json | ConvertFrom-Json
$json.version = $version
$json | ConvertTo-Json -Depth 10 | Set-Content package.json

# tauri.conf.json を更新
$conf = Get-Content src-tauri/tauri.conf.json | ConvertFrom-Json
$conf.productVersion = $version
$conf | ConvertTo-Json -Depth 10 | Set-Content src-tauri/tauri.conf.json

# コミット
git add package.json src-tauri/tauri.conf.json
git commit -m "Bump version to v$version"

# タグを作成してプッシュ（ワークフローが自動実行）
git tag "v$version"
git push origin main
git push origin --tags
```

### 方法 2: 手動トリガー

GitHub Actions ページから手動実行：

```
https://github.com/s-yoshida-33/Grain-Link/actions/workflows/build-release.yml
↓
Run workflow ボタンをクリック
```

## ワークフロー実行時の監視

### リアルタイムビューア

```
https://github.com/s-yoshida-33/Grain-Link/actions
↓
最新ワークフロー実行を選択
↓
各ステップの進捗を監視
```

### よくあるステップ

```
1. [Setup Node.js]              - Node.js環境セットアップ
2. [Setup Rust]                 - Rust環境セットアップ
3. [Install dependencies]       - npm ci 実行
4. [Build signed release]       - npm run tauri:release 実行
5. [Upload artifacts to release]- ファイルを GitHub Release にアップロード
6. [Verify latest.yml in release]- latest.yml が正しくアップロードされている確認
```

## トラブルシューティング

### ビルドが失敗する

**原因：** 秘密情報が正しく設定されていない

**対策：**
```powershell
# 1. 秘密情報を再確認
https://github.com/s-yoshida-33/Grain-Link/settings/secrets/actions

# 2. 秘密情報を更新
# ← Settings で新しい秘密を作成

# 3. ワークフローを再実行
https://github.com/s-yoshida-33/Grain-Link/actions
```

### "Signature verification failed" エラー

**原因：** 公開鍵が 古い、または秘密鍵が新しい

**対策：**
```bash
# 現在の公開鍵を確認
minisign -l -p ~/.minisign/default.pub

# tauri.conf.json を更新
# "pubkey": "新しい公開鍵" として登録
```

### GitHub Release にファイルがアップロードされない

**原因：** ワークフロー実行権限がない、またはセクレットが設定されていない

**対策：**
```
Settings → Actions → General
↓
Workflow permissions: 「Read and write permissions」に設定
↓
Save
```

## セキュリティベストプラクティス

### ✅ やるべきこと

- ✅ 秘密情報は GitHub Secrets に保存
- ✅ ローカルマシンでもパスフレーズで保護
- ✅ 定期的に秘密ローテーション
- ✅ アクセスログを監視

### ❌ するべきではないこと

- ❌ 秘密鍵をリポジトリにコミット
- ❌ 秘密情報をログに出力
- ❌ ワークフロー出力に秘密情報が表示される構成
- ❌ 秘密を他のユーザーと共有

## リリース後の確認

### ステップ 1: リリースページを確認

```
https://github.com/s-yoshida-33/Grain-Link/releases
↓
最新リリースを選択
↓
以下を確認：
✅ latest.yml
✅ GrainLinkSetup-x64-X.X.X.exe
✅ GrainLinkSetup-x64-X.X.X.exe.sig
```

### ステップ 2: クライアント更新テスト

```powershell
# latest.yml をダウンロードして内容確認
curl https://api.github.com/repos/s-yoshida-33/Grain-Link/releases/latest `
  | jq '.assets[] | select(.name=="latest.yml") | .browser_download_url'
```

### ステップ 3: アプリで自動更新テスト

1. 前バージョンのアプリを起動
2. BootScreen で「アップデート確認中...」が表示される
3. 新しいバージョンが検出される
4. ダウンロード → インストールが実行される

## トラブル時の情報収集

ワークフロー失敗時に必要な情報：

1. **ワークフロー実行ログ**
   - 完全なエラーメッセージをコピー

2. **秘密情報の確認**
   ```powershell
   # ローカルで秘密鍵が存在するか確認
   Get-ChildItem "$env:USERPROFILE\.minisign"
   ```

3. **バージョン確認**
   ```powershell
   # Node.js バージョン
   node --version
   
   # Rust バージョン
   rustc --version
   
   # npm バージョン
   npm --version
   ```

## 参考リンク

- [GitHub Secrets ドキュメント](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [GitHub Actions Workflow 構文](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Tauri GitHub Actions 統合](https://tauri.app/develop/ci-cd/github-actions/)
