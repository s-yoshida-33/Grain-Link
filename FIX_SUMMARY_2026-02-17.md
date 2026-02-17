# ビルドスクリプト修正概要（2026年2月17日）

## 修正内容

### 1. ❌ 修正前の問題

```
Push-Location : パス 'C:\dev\src-tauri' が存在しないため検出できません。
```

**原因:** PowerShell スクリプトのパス計算が誤っていた

```powershell
# 誤ったパス計算
$srcTauriDir = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "src-tauri"
# $PSScriptRoot = C:\dev\Grain-Link\build
# Split-Parent(Split-Parent()) = C:\dev ← 間違い！
```

### 2. ✅ 修正後

**sign-and-build.ps1:**

```powershell
# 正しいパス計算
$rootDir = Split-Path -Parent $PSScriptRoot
# $rootDir = C:\dev\Grain-Link ← 正しい！

$bundleDir = Join-Path $rootDir "src-tauri\target\release\bundle"
$srcTauriDir = Join-Path $rootDir "src-tauri"
```

**manage-release.ps1:**

```powershell
# 修正前
$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# 修正後
$rootDir = Split-Path -Parent $PSScriptRoot
```

## パスワード管理の改善

### 環境変数でのパスワード管理

修正されたスクリプトは以下の優先順位でパスワードを取得：

1. **コマンドラインパラメータ** `.\sign-and-build.ps1 -Password "xxxxx"`
2. **環境変数** `$env:TAURI_SIGNING_PASSWORD_OVERRIDE`
3. **ユーザー入力** インタラクティブプロンプト

### 新規スクリプト: setup-env.ps1

環境変数をセットアップするウィザード：

```bash
# 環境変数を設定
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1

# 現在の設定を確認
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1 -ShowCurrent

# パスワードをクリア
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1 -ClearPassword
```

## 新規ドキュメント

1. **BUILD_PASSWORD_GUIDE.md**
   - 3 つのパスワード入力方法の詳細
   - 環境変数設定の手順
   - GitHub Secrets の設定方法
   - セキュリティのベストプラクティス

2. **setup-env.ps1**
   - パスワード環境変数のセットアップウィザード
   - ワンコマンドでセットアップ完了

## 使用方法

### 方法 1: 毎回手動入力（デフォルト）

```bash
npm run tauri:release
```

### 方法 2: 環境変数設定（推奨）

```bash
# 初回のみ実行
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1

# その後は毎回パスワード入力不要
npm run tauri:release
```

### 方法 3: GitHub Actions で自動化

GitHub Secrets に以下を登録：
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## テスト実行

```bash
# 修正後のビルドテスト
npm run tauri:build:signed

# または完全なリリースビルド
npm run tauri:release
```

## ✅ チェックリスト

- [x] sign-and-build.ps1 のパス計算を修正
- [x] manage-release.ps1 のパス計算を修正
- [x] 環境変数によるパスワード管理を実装
- [x] setup-env.ps1 スクリプトを作成
- [x] BUILD_PASSWORD_GUIDE.md を作成
- [x] README を更新

## 次のステップ

```bash
# 1. 環境変数を設定
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1

# 2. テストビルド
npm run tauri:build:signed

# 3. 本番リリース
npm run tauri:release

# 4. release/ ディレクトリを確認
ls -la release/
```

