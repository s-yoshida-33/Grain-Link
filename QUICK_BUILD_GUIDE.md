# ビルド実行 - クイックガイド

## 🚀 最速の実行方法（5 分）

### ステップ 1: PowerShell を管理者権限で開く

```
Windows + X → Windows PowerShell (管理者)
```

### ステップ 2: プロジェクトディレクトリに移動

```bash
cd c:\dev\Grain-Link
```

### ステップ 3: パスワード設定（初回のみ）

```bash
powershell -ExecutionPolicy Bypass -File ./build/setup-env.ps1
```

パスワードを入力：
```
zL9#pQ2$mN5&vX1*rT8@kY4!uB
```

### ステップ 4: ビルド実行

```bash
npm run tauri:release
```

**完了！** ✅

リリースファイルが `release/` に生成されます。

---

## 📊 進捗確認

### 正常な出力シーン

```
[+] Using password from environment variable (user-level)
[+] Environment variables set
[*] Starting build...
```

**このメッセージが出たら成功です** 🎉

### エラーが出た場合

| エラー | 対応 |
|--------|------|
| `os error 5` | 管理者権限で実行してください |
| `LNK1104` | ファイルロックエラー → ステップ 1 に戻る |
| パスワード入力プロンプト | ステップ 3 をもう一度実行 |

---

## 📦 出力ファイル確認

```bash
ls release/
```

**必須ファイル:**
- ✅ `latest.yml` - アップデーター設定
- ✅ `GrainLinkSetup-x64-0.2.0.exe` - インストーラー
- ✅ `GrainLinkSetup-x64-0.2.0.exe.sig` - デジタル署名

## 🔗 GitHub Release にアップロード

```bash
gh release create v0.2.0 release/* --title "Version 0.2.0" --generate-notes
```

（GitHub CLI がない場合は手動で [GitHub Release ページ](https://github.com/s-yoshida-33/Grain-Link/releases) にアップロード）

---

## ❓ トラブルシューティング

詳細は以下を参照：

- [FILE_LOCK_ERROR_SOLUTION.md](FILE_LOCK_ERROR_SOLUTION.md) - ファイルロックエラー
- [BUILD_PASSWORD_GUIDE.md](BUILD_PASSWORD_GUIDE.md) - パスワード問題
- [BUILD_EXECUTION_STEPS.md](BUILD_EXECUTION_STEPS.md) - 詳細な実行手順

---

**準備完了です！** 🚀

上記 4 ステップでビルドが完了します。
