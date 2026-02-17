# Tauri Signed Build トラブルシューティング

## エラー原因

```
failed to bundle project `アクセスが拒止されました。 (os error 5)`
```

これはファイルロックの問題です。以前のビルド成果物がまだロックされている状態です。

## 解決方法

### 方法 1: 管理者権限で実行（推奨）

1. PowerShell を**管理者権限**で開きます
2. 以下を実行：
   ```powershell
   cd C:\dev\Grain-Link
   npm run tauri:build:signed
   ```

### 方法 2: 完全クリーンアップ

```powershell
cd C:\dev\Grain-Link

# ターゲットディレクトリを完全削除
Remove-Item "src-tauri\target" -Recurse -Force

# 再度ビルド
npm run tauri:build:signed
```

### 方法 3: node_modules をキャッシュクリア

```powershell
# npm キャッシュクリア
npm cache clean --force

# 再度ビルド
npm run tauri:build:signed
```

## 改善されたスクリプト機能

修正されたスクリプトには以下の機能が追加されました：

1. **自動クリーンアップ**: ビルド前にバンドルディレクトリを削除
2. **cargo clean**: Rust のターゲットキャッシュをクリア
3. **管理者権限チェック**: 管理者権限の確認（警告表示）
4. **タイムアウト対策**: ファイルロック解放のための待機

## スクリプト実行フロー

```
1. 管理者権限確認 → 2. キー検証 → 3. パスワード入力
    ↓
4. バンドルディレクトリ削除 → 5. cargo clean 実行
    ↓
6. npm run tauri:build 実行 → 7. 署名ファイル処理
    ↓
8. latest.yml 確認 → 9. 完了表示
```

## 推奨される実行方法

```bash
# PowerShell (管理者権限) で実行
npm run tauri:build:signed

# または完全版
npm run tauri:release
```

## セキュリティソフトの確認

Windows Defender やサードパーティの antivirus が干渉している場合：

1. セキュリティソフトを一時的に無効化
2. ビルド実行
3. セキュリティソフトを有効化

## さらに詳しい情報

- [Tauri ビルド トラブルシューティング](https://tauri.app/develop/troubleshoot/)
- [Windows 権限設定](https://learn.microsoft.com/ja-jp/windows/security/identity-protection/user-account-control/user-account-control-overview)
