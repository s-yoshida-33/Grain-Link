# ファイルロックエラー: 解決方法

## 症状

```
error: failed to remove file `...\ctor-7b3b6dc3b93d5b85.dll`
Caused by: アクセスが拒否されました。 (os error 5)
```

および

```
LINK : fatal error LNK1104: ファイル '...\ctor-7b3b6dc3b93d5b85.dll' を開くことができません。
```

## 原因

1. 前回のビルド成果物がまだメモリにロードされている
2. Antivirus ソフトウェアがファイルをロックしている可能性
3. Visual Studio やその他の IDE がファイルを使用している

## 解決方法

### 方法 1: 管理者権限で実行（推奨）

**最も重要:** PowerShell を **管理者権限** で実行してください

```
Windows + X → Windows PowerShell (管理者)
```

その後：

```bash
cd c:\dev\Grain-Link
npm run tauri:release
```

### 方法 2: 手動クリーンアップ（管理者権限必須）

管理者権限の PowerShell で以下を実行：

```powershell
# プロセスを強制終了
taskkill /F /IM rustc.exe /T 2>$null
taskkill /F /IM cargo.exe /T 2>$null

# target ディレクトリを削除
cd c:\dev\Grain-Link\src-tauri
Remove-Item -Path .\target -Recurse -Force -ErrorAction SilentlyContinue
cargo clean

# ビルド再実行
cd c:\dev\Grain-Link
npm run tauri:release
```

### 方法 3: Antivirus 除外リスト設定

Antivirus ソフトウェアを使用している場合、以下を除外リストに追加してください：

```
C:\dev\Grain-Link\src-tauri\target\
C:\Users\<ユーザー名>\AppData\Local\Temp\rustc*
```

**Windows Defender の場合:**

```powershell
# 管理者権限で実行
Add-MpPreference -ExclusionPath "C:\dev\Grain-Link\src-tauri\target"
Add-MpPreference -ExclusionPath "C:\dev\Grain-Link"
```

## 改善されたスクリプト機能

修正後の `sign-and-build.ps1` は以下を自動実行します：

1. ✅ Rust プロセスの強制終了
2. ✅ Release target ディレクトリ全体削除
3. ✅ `cargo clean` 実行
4. ✅ タイミング遅延追加（DLL ロック解放待ち）

## チェックリスト

ビルド実行前に確認：

- [ ] PowerShell を **管理者権限** で実行
- [ ] Antivirus が一時的に無効か除外リスト設定されている
- [ ] Visual Studio など他の IDE が閉じている
- [ ] Node.js/npm プロセスのみが実行中

## デバッグコマンド

### ロックされているファイル一覧確認

```powershell
# Handle.exe（Sysinternals）が必要
.\handle64.exe -a ctor-7b3b6dc3b93d5b85.dll

# または
Get-Process | Where-Object { $_.Modules -Match "ctor-7b3b6dc3b93d5b85" }
```

### キャッシュ完全削除

```powershell
# Cargo キャッシュ削除
cargo cache --autoclean

# または
Remove-Item -Path $env:USERPROFILE\.cargo\registry\cache -Recurse -Force -ErrorAction SilentlyContinue
```

## 本番環境で推奨される設定

### .cargo/config.toml

```toml
[build]
# 平行ビルド数を制限
jobs = 2
```

### Cargo.toml の最適化

```toml
[profile.release]
# 最適化レベルを調整
opt-level = 2
# インクリメンタルコンパイル無効化
incremental = false
```

## 最後の手段

それでも失敗する場合：

```bash
# 1. プロジェクト全体をクリーンな状態に
git clean -fdx
git checkout .

# 2. Rust ツールチェーン更新
rustup update

# 3. 再度ビルド
npm run tauri:release
```

---

**重要:** ほとんどの場合、**管理者権限での実行** で解決します。
