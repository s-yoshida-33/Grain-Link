# Grain Link アップデーター統合ガイド

## 概要

このドキュメントは、Grain Link アプリケーションで GitHub Releases を使用した自動アップデーター機能を統合するための完全なガイドです。

## システム構成図

```
┌─────────────────────────────────────────────────┐
│           Grain Link アプリ (クライアント)          │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌────────────────────────────────────────────┐ │
│  │  BootScreen (7段階初期化フロー)             │ │
│  │  1. アプリ起動                              │ │
│  │  2. アップデート確認                        │ │
│  │  3. アップデート実行 (スキップ可)           │ │
│  │  4. メディアチェック                        │ │
│  │  5. メディアダウンロード (スキップ可)       │ │
│  │  6. 90秒カウントダウン                      │ │
│  │  7. メイン画面起動                          │ │
│  └────────────────────────────────────────────┘ │
│              ↓                                    │
│  ┌────────────────────────────────────────────┐ │
│  │  useAutoUpdate Hook                         │ │
│  │  - アップデートチェック                     │ │
│  │  - 署名検証                                 │ │
│  │  - バイナリダウンロード                     │ │
│  │  - インストール                             │ │
│  └────────────────────────────────────────────┘ │
│              ↓                                    │
│  ┌────────────────────────────────────────────┐ │
│  │  Tauri Updater Plugin v2                   │ │
│  │  - GitHub API 連携                         │ │
│  │  - minisign 署名検証                       │ │
│  │  - ファイル管理                             │ │
│  └────────────────────────────────────────────┘ │
│              ↓                                    │
└─────────────────────────────────────────────────┘
                      ↓ HTTPS
┌─────────────────────────────────────────────────┐
│          GitHub Releases (リポジトリ)            │
├─────────────────────────────────────────────────┤
│                                                   │
│  latest.yml                                     │
│  ├─ version: 0.2.1                              │
│  ├─ files: [...]                                │
│  └─ signature: <Base64>                         │
│                                                   │
│  GrainLinkSetup-x64-0.2.1.exe                   │
│  GrainLinkSetup-x64-0.2.1.exe.sig               │
│                                                   │
│  grain-link_0.2.1_x64.msi (オプション)          │
│  grain-link_0.2.1_x64.msi.sig (オプション)      │
│                                                   │
└─────────────────────────────────────────────────┘
```

## フェーズ別実装チェックリスト

### フェーズ 1: ローカル開発環境セットアップ

- [ ] `~/TAURI_KEY_PASSWORD.sh` に秘密鍵が存在する
  ```bash
  # 秘密鍵がない場合は生成
  npx tauri signer generate -w ~/TAURI_KEY_PASSWORD.sh
  ```

- [ ] 秘密鍵を読み取り可能に設定（Linux/Mac の場合）
  ```bash
  chmod 600 ~/TAURI_KEY_PASSWORD.sh
  ```

- [ ] 秘密鍵のパスフレーズを安全に保管

- [ ] インストール済みパッケージ確認
  ```bash
  npm list tauri @tauri-apps/cli @tauri-apps/api
  ```

### フェーズ 2: Tauri 設定

- [ ] [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) の確認
  ```json
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["https://api.github.com/repos/s-yoshida-33/Grain-Link/releases/latest"],
      "dialog": false,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDox..."
    }
  }
  ```

- [ ] 公開鍵が正しく設定されている
  ```bash
  # 公開鍵を確認
  minisign -l -p ~/.minisign/default.pub
  ```

- [ ] `package.json` とバージョン確認（同期している）
  ```json
  "version": "0.2.1"
  ```

### フェーズ 3: アプリケーション実装

#### BootScreen コンポーネント
- [ ] [src/screens/BootScreen.tsx](src/screens/BootScreen.tsx) が実装されている
- [ ] 7段階のフロー遷移が正常
- [ ] スキップボタンが動作する

#### useAutoUpdate Hook
- [ ] [src/hooks/useAutoUpdate.ts](src/hooks/useAutoUpdate.ts) が実装されている
- [ ] Tauri updater プラグイン連携が正常

#### useMediaDownload Hook
- [ ] [src/hooks/useMediaDownload.ts](src/hooks/useMediaDownload.ts) が実装されている
- [ ] メディアリスト取得が動作する
- [ ] ダウンロード状態追跡が正常

#### GidoApp 統合
- [ ] [src/screens/GidoApp.tsx](src/screens/GidoApp.tsx) で BootScreen が使用されている
- [ ] `bootComplete` フラグで UI 制御されている

### フェーズ 4: ビルドプロセス

- [ ] PowerShell スクリプトが UTF-8 対応
  - [ ] [build/sign-and-build.ps1](build/sign-and-build.ps1)
  - [ ] [build/manage-release.ps1](build/manage-release.ps1)

- [ ] 署名ファイル生成スクリプト動作確認
  ```bash
  # ローカルテスト
  powershell -ExecutionPolicy Bypass -File ./build/sign-and-build.ps1
  ```

- [ ] release/ ディレクトリにファイルが出力される
  ```
  release/
  ├─ latest.yml
  ├─ GrainLinkSetup-x64-0.2.1.exe
  ├─ GrainLinkSetup-x64-0.2.1.exe.sig
  ├─ grain-link_0.2.1_x64.msi (オプション)
  └─ grain-link_0.2.1_x64.msi.sig (オプション)
  ```

### フェーズ 5: GitHub リポジトリ設定

#### リポジトリアクセス
- [ ] GitHub リポジトリへの write 権限がある
  ```
  https://github.com/s-yoshida-33/Grain-Link/settings
  ```

#### GitHub Secrets 登録
- [ ] `TAURI_SIGNING_PRIVATE_KEY` が登録されている
  ```
  Settings → Secrets and variables → Actions
  ```

- [ ] `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` が登録されている

- [ ] Workflow permissions が正しく設定されている
  ```
  Settings → Actions → General
  → Workflow permissions: "Read and write permissions"
  ```

#### ワークフロー設定
- [ ] [.github/workflows/build-release.yml](.github/workflows/build-release.yml) が存在する
- [ ] ワークフローが正常に実行可能
  ```
  https://github.com/s-yoshida-33/Grain-Link/actions
  ```

### フェーズ 6: リリースプロセス

#### 手動リリース
- [ ] パッケージバージョン更新
  ```bash
  $version = "0.2.2"
  # package.json と tauri.conf.json を更新
  ```

- [ ] ビルド実行
  ```bash
  npm run tauri:release
  ```

- [ ] リリースファイル確認
  ```
  release/ に latest.yml が存在することを確認
  ```

- [ ] GitHub Release 作成
  ```
  https://github.com/s-yoshida-33/Grain-Link/releases/new
  Tag: v0.2.2
  Files: release/ 内のすべてのファイルをアップロード
  ```

#### 自動リリース（GitHub Actions）
- [ ] タグをプッシュして自動ビルド
  ```bash
  git tag "v0.2.2"
  git push origin --tags
  ```

- [ ] ワークフロー実行確認
  ```
  https://github.com/s-yoshida-33/Grain-Link/actions
  ```

- [ ] リリースページ確認
  ```
  https://github.com/s-yoshida-33/Grain-Link/releases
  ```

### フェーズ 7: 統合テスト

#### クライアント検証
- [ ] 前バージョンのアプリを起動
- [ ] BootScreen で以下が表示される
  - 「アップデート確認中...」
  - 新しいバージョン検出

- [ ] 自動ダウンロード完了
- [ ] インストール確認ダイアログ表示
- [ ] インストール後にアプリが再起動
- [ ] 新しいバージョン番号を確認

#### latest.yml 検証
```bash
# latest.yml を直接ダウンロード
curl https://api.github.com/repos/s-yoshida-33/Grain-Link/releases/latest \
  | jq '.assets[] | select(.name=="latest.yml") | .browser_download_url'

# 内容確認
curl <URL> | jq .
```

#### 署名検証
```bash
# 署名ファイルが存在することを確認
ls -la release/*.sig

# 公開鍵で検証（Tauri が自動的に検証）
minisign -Vm <file> -p ~/.minisign/default.pub
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. latest.yml が release/ に生成されない

**症状:**
```
[!] latest.yml not found
```

**原因:**
- Tauri ビルドが失敗している可能性
- ビルド成果物がロックされている

**解決方法:**
```bash
# 1. 前回のビルド成果物をクリア
npm run tauri:build -- --clean

# 2. または手動でクリア
cargo clean
Remove-Item src-tauri\target -Recurse -Force

# 3. 再度ビルド
npm run tauri:release
```

#### 2. 署名検証エラー

**症状:**
```
Signature verification failed
```

**原因:**
- 公開鍵が古い
- 秘密鍵が異なる

**解決方法:**
```bash
# 1. 秘密鍵を確認
cat ~/TAURI_KEY_PASSWORD.sh

# 2. 公開鍵を抽出
minisign -l -p ~/.minisign/default.pub

# 3. tauri.conf.json の pubkey を更新
{
  "updater": {
    "pubkey": "<新しい公開鍵>"
  }
}
```

#### 3. GitHub API レート制限エラー

**症状:**
```
API rate limit exceeded
```

**原因:**
- ローカルテスト時に多数のリクエスト
- ユーザー認証なしの場合は制限が厳しい

**解決方法:**
```bash
# 1. GitHub Token をセット
export GITHUB_TOKEN=<your_token>

# 2. 1時間待機（レート制限リセット）
# または

# 3. ローカルテスト時は signature 検証をスキップ
# tauri.conf.json で pubkey を削除
```

#### 4. PowerShell 実行ポリシーエラー

**症状:**
```
File cannot be loaded because running scripts is disabled on this system
```

**解決方法:**
```bash
# スクリプト実行
powershell -ExecutionPolicy Bypass -File ./build/sign-and-build.ps1

# または管理者として PowerShell を起動してから
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## ドキュメント参照

各フェーズの詳細は個別ドキュメントを参照：

- **GitHub Releases セットアップ** → [GITHUB_RELEASES_SETUP.md](GITHUB_RELEASES_SETUP.md)
- **GitHub Actions 秘密設定** → [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)
- **メディアダウンロード機能** → [MEDIA_DOWNLOAD.md](MEDIA_DOWNLOAD.md)
- **署名ファイル生成・検証** → [SIGNATURE_GUIDE.md](SIGNATURE_GUIDE.md)
- **ビルド トラブルシューティング** → [BUILD_TROUBLESHOOTING.md](BUILD_TROUBLESHOOTING.md)

## コマンドクイックリファレンス

```bash
# ローカルビルド（署名付き）
npm run tauri:build:signed

# ローカルビルド（署名+リリース管理）
npm run tauri:release

# GitHub Actions テスト実行
gh act -j build -l ubuntu-latest

# リリース自動作成
git tag "v0.2.2"
git push origin --tags

# リリース手動作成
gh release create "v0.2.2" release/* --title "Version 0.2.2" --generate-notes

# 秘密鍵生成
npx tauri signer generate -w ~/TAURI_KEY_PASSWORD.sh
```

## チェックリスト（デプロイ直前）

本番環境へデプロイする前に全項目確認：

- [ ] ローカルでビルド成功
- [ ] release/ に latest.yml が存在
- [ ] 署名ファイル (.sig) が存在
- [ ] GitHub Secrets が登録済み
- [ ] GitHub Actions ワークフローが正常
- [ ] テストリリースで自動更新確認
- [ ] 本番リリース準備完了

## 次のステップ

1. **ローカルテスト**
   ```bash
   npm run tauri:release
   ```

2. **GitHub Secrets 登録**
   - TAURI_SIGNING_PRIVATE_KEY
   - TAURI_SIGNING_PRIVATE_KEY_PASSWORD

3. **テストリリース**
   ```bash
   git tag "v0.2.2"
   git push origin --tags
   ```

4. **クライアント検証**
   - 前バージョンでアップデート確認
   - 新バージョン自動インストール

5. **本番運用**
   - 定期的なセキュリティアップデート
   - リリースノート作成

## サポート情報

問題が発生した場合：

1. [GitHub Issues](https://github.com/s-yoshida-33/Grain-Link/issues) で既知の問題を確認
2. ドキュメント内の該当セクションを参照
3. ログファイルを確認
   ```
   %APPDATA%\grain-link\logs\
   ```
4. GitHub Actions ログを確認
   ```
   https://github.com/s-yoshida-33/Grain-Link/actions
   ```

## セキュリティ注意事項

⚠️ **重要:**

- ✅ 秘密鍵を絶対にリポジトリにコミットしない
- ✅ GitHub Secrets を定期的に更新
- ✅ 署名ファイルなしではリリースしない
- ✅ 本番環境では常に署名検証を有効にする
- ✅ アップデーター設定は .gitignore で保護

