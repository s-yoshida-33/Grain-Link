# ビルド実行手順

これらのステップでアプリケーションをビルドし、GitHub Releases にリリースができます。

## ステップ 1: 秘密鍵パスワード設定（初回のみ）

```bash
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1
```

**入力内容:**
```
[?] Enter password (leave blank to cancel):
zL9#pQ2$mN5&vX1*rT8@kY4!uB
```

**実行結果:**
```
[+] Complete!

[!] IMPORTANT: Close this PowerShell window and open a NEW one
    The environment variable becomes active in new windows.

Next step: Run in new PowerShell window
  npm run tauri:release
```

## ステップ 2: ビルド実行

修正後は、**新しいウィンドウを開く必要はありません。** 

同じウィンドウから以下コマンドを実行できます：

```bash
npm run tauri:release
```

（または、セットアップ後に新しいウィンドウで実行している場合はそちらで実行）

**正常な出力例:**
```
[*] Starting Tauri signed build...
[*] Root directory: C:\dev\Grain-Link
[+] Found private key: C:\dev\Grain-Link\build\..\~\TAURI_KEY_PASSWORD.sh
[+] Using password from environment variable (user-level)
[+] Environment variables set
[*] Cleaning previous build artifacts...
[*] Running cargo clean...
[*] Starting build...
[+] Build completed! Signature files (.sig) generated.
[+] Signed build completed!
```

## ステップ 3: リリースファイル確認

```bash
ls -la release/
```

**出力内容:**
```
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----        2/17/2026  10:00 AM           2084 latest.yml
-a----        2/17/2026  10:00 AM      150000000 GrainLinkSetup-x64-0.2.0.exe
-a----        2/17/2026  10:00 AM            128 GrainLinkSetup-x64-0.2.0.exe.sig
```

必須ファイル：
- ✅ `latest.yml` - アップデーター設定ファイル
- ✅ `GrainLinkSetup-x64-X.X.X.exe` - インストーラー
- ✅ `GrainLinkSetup-x64-X.X.X.exe.sig` - デジタル署名

## ステップ 4: GitHub Release にアップロード

### 手動アップロード

```
https://github.com/s-yoshida-33/Grain-Link/releases/new
```

1. **Create a new release** をクリック
2. Tag: `v0.2.0` (version と一致)
3. Release title: `Version 0.2.0`
4. Description: 更新内容を入力（例: 機能追加、バグ修正など）
5. **Add files** で `release/` 内のすべてのファイルをアップロード
6. **Publish Release** をクリック

### CLI でアップロード（GitHub CLI 必要）

```bash
gh release create v0.2.0 release/* --title "Version 0.2.0" --generate-notes
```

## トラブルシューティング

### パスワード認識エラーが発生する場合

**症状:**
```
[?] Enter private key password (or set TAURI_SIGNING_PASSWORD_OVERRIDE environment variable):
```

**原因**: setup-env.ps1 が実行されていない場合

**対策:**
```bash
# パスワード設定を初めから実行
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1

# 出力が以下で完了
# [+] Complete!
```

### 環境変数が設定済みか確認する

```bash
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1 -ShowCurrent
```

**出力例（設定済み）:**
```
[+] Environment variable TAURI_SIGNING_PASSWORD_OVERRIDE is set
[*] Active in current PowerShell session
```

**出力例（未設定）:**
```
[-] Environment variable TAURI_SIGNING_PASSWORD_OVERRIDE is not set
```

### ビルドエラー（ファイルロック）

```bash
# キャッシュをクリア
cargo clean

# 再度実行
npm run tauri:release
```

### パスワードリセット

```bash
# 古いパスワードをクリア
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1 -ClearPassword

# 新しいパスワードを設定
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1
```

## チェックリスト

本番リリース前に確認：

- [ ] `setup-env.ps1` で環境変数を設定
- [ ] 新しいウィンドウで `npm run tauri:release` を実行
- [ ] `release/` に `latest.yml` が存在
- [ ] すべての `.sig` ファイルが存在
- [ ] GitHub Release にアップロード完了
- [ ] 公開鍵が正しく設定されている（tauri.conf.json）

## 次のステップ

- ブートシーケンスのテスト実行
- 前バージョンの自動更新確認
- エラーハンドリングの検証
