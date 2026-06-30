# GitHub Releases を使用したアップデーター設定

## 概要

Grain Link は GitHub Releases を使用して `latest.yml` と署名ファイルを配布します。

## セットアップ手順

### 1. ビルド実行

```bash
npm run tauri:release
```

このコマンドは以下を実行：
- 署名付きビルド実行
- `release/` ディレクトリにビルド成果物を配置
- `latest.yml` を生成

### 2. GitHub Releases へのアップロード

#### 方法 A: 手動アップロード（推奨）

1. **GitHub リポジトリを開く**
   ```
   https://github.com/s-yoshida-33/Grain-Link/releases
   ```

2. **新規リリースを作成**
   - "Create a new release" をクリック
   - Tag を設定（例: `v0.2.1`）
   - Release title を入力（例: `Version 0.2.1`）

3. **ファイルをアップロード**
   ```
   release/ ディレクトリのファイルをすべてアップロード：
   - latest.yml                           ⭐ 必須
   - GrainLinkSetup-x64-0.2.1.exe        
   - GrainLinkSetup-x64-0.2.1.exe.sig    ⭐ 必須
   - grain-link_0.2.1_x64.msi            （存在する場合）
   - grain-link_0.2.1_x64.msi.sig        （存在する場合）
   ```

4. **Publish Release をクリック**

#### 方法 B: PowerShell スクリプト（自動）

以下のスクリプトで自動アップロード可能：

```powershell
# GitHub CLI をインストール
winget install GitHub.cli

# ログイン
gh auth login

# リリースを作成
cd C:\dev\Grain-Link
$version = "0.2.1"
gh release create "v$version" `
  release/latest.yml `
  release/GrainLinkSetup-x64-$version.exe `
  "release/GrainLinkSetup-x64-$version.exe.sig" `
  --title "Version $version" `
  --generate-notes
```

### 3. アップデーター検証

配置完了後、アプリは以下のエンドポイントから自動的に最新情報を取得：

```
https://api.github.com/repos/s-yoshida-33/Grain-Link/releases/latest
```

## ファイルの役割

### latest.yml

```yaml
version: 0.2.1
files:
  - url: GrainLinkSetup-x64-0.2.1.exe
    sha512: <256文字のハッシュ値>
    signature: <Base64署名>
path: GrainLinkSetup-x64-0.2.1.exe
sha512: <256文字のハッシュ値>
releaseDate: '2026-02-17T10:00:00.000Z'
```

**役割：**
- ✅ 最新バージョン番号を指定
- ✅ ダウンロードファイル URL を指定
- ✅ SHA512 ハッシュ値で整合性確認
- ✅ 暗号署名で改ざん検出

### 署名ファイル (.sig)

```
GrainLinkSetup-x64-0.2.1.exe.sig
```

**役割：**
- ✅ `latest.yml` 内の署名フィールドと対応
- ✅ クライアント側で公開鍵検証される
- ✅ バイナリの改ざん防止

## アップデーター動作フロー

```
アプリ起動
   ↓
GitHub API に問い合わせ
https://api.github.com/repos/.../releases/latest
   ↓
latest.yml をダウンロード
   ↓
署名検証（公開鍵で確認）
   ↓
新しいバージョンがあるか確認
   ↓
あれば：ユーザーに通知 → ダウンロード → インストール
なければ：アプリ起動継続
```

## トラブルシューティング

### アップデーターが動作しない

**確認リスト：**

1. **GitHub Releases に `latest.yml` があるか**
   ```
   https://github.com/s-yoshida-33/Grain-Link/releases
   ```

2. **ネットワーク接続を確認**
   ```powershell
   curl https://api.github.com/repos/s-yoshida-33/Grain-Link/releases/latest
   ```

3. **ローカル開発時は署名検証スキップ**
   - `tauri.conf.json` で `pubkey` を削除して一時的にテスト

### 署名検証エラー

原因：
- 秘密鍵で署名されていないバイナリ
- 公開鍵が古い

対策：
```bash
# 署名ファイルを確認
ls -la release/*.sig

# 必要ならファイルを再署名
npx tauri signer sign ./release/GrainLinkSetup-x64-0.2.1.exe
```

## セキュリティについて

### ✅ ベストプラクティス

- ✅ すべてのリリースに署名ファイルを含める
- ✅ `latest.yml` の署名情報を確認
- ✅ 秘密鍵をリポジトリに含めない
- ✅ GitHub Secrets に秘密鍵を登録（CI/CD用）

### ❌ やってはいけないこと

- ❌ 署名なしでファイルをアップロード
- ❌ `latest.yml` を手動編集
- ❌ 秘密鍵をリポジトリにコミット
- ❌ 過去のバージョンに署名ファイルを追加

## CI/CD 統合例（GitHub Actions）

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build signed release
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
        run: npm run tauri:release
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: release/*
```

## バージョン管理

### リリース時のバージョン更新

```bash
# package.json と tauri.conf.json を同時に更新
$version = "0.2.2"
(Get-Content package.json) -replace '"version": "[^"]*"', "`"version`": `"$version`"" | Set-Content package.json
(Get-Content src-tauri/tauri.conf.json) -replace '"version": "[^"]*"', "`"version`": `"$version`"" | Set-Content src-tauri/tauri.conf.json

# コミット
git add package.json src-tauri/tauri.conf.json
git commit -m "Bump version to $version"
git tag "v$version"
git push origin main --tags
```

## 参考リンク

- [Tauri Updater Documentation](https://tauri.app/develop/updater/)
- [GitHub Releases API](https://docs.github.com/en/rest/releases/releases)
- [minisign Protocol](https://jedisct1.github.io/minisign/)
