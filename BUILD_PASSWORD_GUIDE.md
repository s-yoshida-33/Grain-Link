# Tauri ビルド パスワード設定ガイド

## 概要

Tauri ビルド時に秘密鍵のパスワードを入力する方法は 3 つあります：

1. **毎回手動入力**（デフォルト）
2. **環境変数に設定**（推奨：ローカル開発用）
3. **GitHub Actions で自動化**（本番環境推奨）

## 方法 1: 毎回手動入力（デフォルト）

```bash
npm run tauri:release
```

**利点：**
- セキュア（パスワードが記録されない）
- 最初のセットアップが不要

**欠点：**
- ビルド時に毎回入力が必要

## 方法 2: 環境変数に設定（推奨）

### Windows: PowerShell セットアップスクリプト使用

最も簡単な方法です：

```powershell
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1
```

**手順：**

1. PowerShell を開く
2. Grain-Link ディレクトリに移動
3. 上記コマンドを実行
4. パスワード入力プロンプトが出現
5. パスワードを入力
6. 完了画面が表示されたら、**ウィンドウを閉じて新しい PowerShell を開く**
7. `npm run tauri:release` で自動入力される

### Windows: 手動設定（GUI）

代替方法として GUI で設定することもできます：

```
Windows 設定 → システム → バージョン情報 → 高度なシステム設定
→ 環境変数 → 新規（ユーザー変数）

変数名: TAURI_SIGNING_PASSWORD_OVERRIDE
変数値: <パスワード>
```

### Windows: PowerShell 直接設定

```powershell
[Environment]::SetEnvironmentVariable("TAURI_SIGNING_PASSWORD_OVERRIDE", "zL9#pQ2$mN5&vX1*rT8@kY4!uB", "User")
```

### Linux/Mac: 環境変数設定

```bash
# ~/.bashrc または ~/.zshrc に追加
export TAURI_SIGNING_PASSWORD_OVERRIDE="zL9#pQ2$mN5&vX1*rT8@kY4!uB"

# 反映
source ~/.bashrc  # または source ~/.zshrc
```

## 方法 3: GitHub Actions で自動化（本番環境）

### GitHub Secrets に登録

```
https://github.com/s-yoshida-33/Grain-Link/settings/secrets/actions
```

1. **New repository secret をクリック**
2. **Name:** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. **Value:** パスワード「zL9#pQ2$mN5&vX1*rT8@kY4!uB」
4. **Add secret をクリック**

### ワークフローで使用

`.github/workflows/build-release.yml` に既に設定済み：

```yaml
env:
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

## セキュリティについて

### ⚠️ 警告

- ❌ **コードにパスワードを埋め込む**（リポジトリが侵害される危険性）

- ✅ **環境変数で管理**（ローカル開発環境用）
- ✅ **GitHub Secrets で管理**（CI/CD 用）
- ✅ **毎回手動入力**（最もセキュア）

### 推奨設定

| 環境 | 推奨方法 | 理由 |
|------|---------|------|
| ローカル開発 | 環境変数設定 | 開発効率と安全性のバランス |
| CI/CD（本番） | GitHub Secrets | 自動化されたセキュリティ管理 |
| テストビルド | 毎回手動入力 | 最高レベルのセキュリティ |

## パスワード管理コマンド

### クイックセット（推奨）

```bash
# 初回のみ実行 - PowerShell で環境変数設定ウィザードを起動
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1

# その後、新しいウィンドウで以下を実行
npm run tauri:release
```

### 現在の設定を確認

```bash
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1 -ShowCurrent
```

### パスワードをクリア

```bash
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1 -ClearPassword
```

### パスワードを更新

```bash
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1
# 新しいパスワードを入力
```

## トラブルシューティング

### 環境変数が反映されない

**症状:**
```
[?] Enter private key password:
```

**原因:** PowerShell ウィンドウが古い状態

**解決方法:**
```powershell
# 1. 現在のウィンドウを閉じる
exit

# 2. 新しく PowerShell を開く
# 3. 再度実行
npm run tauri:release
```

### パスワードが間違っている旨のエラー

**症状:**
```
signature verification failed
```

**原因:** 環境変数のパスワードが誤っている

**解決方法:**
```powershell
# 1. パスワードをクリア
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1 -ClearPassword

# 2. 新しく設定
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1

# 3. 正しいパスワードを入力
```

### 毎回環境変数を設定したくない

手動でパスワードをスクリプトに組み込むことはセキュリティ上推奨されません。以下の構成をお勧めします：

**ローカル開発時：**
```bash
# setup-env.ps1 で環境変数を設定（一度だけ）
npm run tauri:release  # 毎回この命令でビルド
```

**CI/CD 例（GitHub Actions）：**
```yaml
- name: Build signed release
  env:
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  run: npm run tauri:release
```

## 参考リンク

- [Tauri セキュリティガイド](https://tauri.app/develop/security/)
- [GitHub Secrets ドキュメント](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [PowerShell 環境変数](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables)
