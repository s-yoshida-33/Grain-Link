## ✅ 署名ファイルの生成と利用 - 実装完了

Grain Link の `tauri:build:signed` コマンドで生成される署名ファイルの処理を整備しました。

### 📋 修正内容

#### 1. **PowerShell ビルドスクリプト** (`build/sign-and-build.ps1`)
- ✅ 秘密鍵の位置確認（複数のパスをサポート）
- ✅ ビルド実行時に自動署名
- ✅ 生成された `.sig` ファイルを検出
- ✅ `release/` ディレクトリにコピー
- ✅ `latest.yml` の署名情報を確認

#### 2. **リリース管理スクリプト** (`build/manage-release.ps1`)
- ✅ ビルド成果物から署名ファイルを自動抽出
- ✅ インストーラと署名ファイルを配布ディレクトリにコピー
- ✅ `latest.yml` に署名情報が含まれていることを検証
- ✅ リリース準備状況をレポート

#### 3. **npm スクリプト** (`package.json`)
```json
"tauri:build:signed": "powershell -ExecutionPolicy Bypass -File ./build/sign-and-build.ps1",
"tauri:release": "npm run tauri:build:signed && powershell -ExecutionPolicy Bypass -File ./build/manage-release.ps1"
```

#### 4. **アップデーター設定** (`src-tauri/tauri.conf.json`)
```json
"updater": {
  "active": true,
  "endpoints": ["https://updates.tauri.app/releases/latest"],
  "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDM0RDYyMjg5QjRFMTA5NDYKUldSR0NlRzBpU0xXTktBL0FJZzJVbFE0dm9MSUUzcGtaQk13N0hyWUJBNGJ5Y1RGUXVqYzN1bHQK"
}
```

### 🔄 ワークフロー

#### 開発フェーズ
```bash
# 1. 署名付きコンパイル
npm run tauri:build:signed
# パスワード入力 → ビルド実行 → .sig ファイル生成

# 2. 署名ファイルの配置と検証
npm run tauri:release
# バイナル/署名ファイルをrelease/にコピー
# latest.yml の署名情報を確認
```

#### 配布フェーズ
```
release/
├── GrainLinkSetup-x64-0.2.1.exe       ← インストーラ
├── GrainLinkSetup-x64-0.2.1.exe.sig   ← 署名ファイル
├── latest.yml                         ← メタデータ+署名情報
└── (その他のビルド成果物)
```

#### 検証フェーズ
```
クライアント側で自動実行:
1. latest.yml をダウンロード
2. 署名情報を抽出
3. 公開鍵（tauri.conf.json）で署名を検証
4. 署名が有効ならダウンロード/インストール
```

### 🔐 セキュリティ機能

- ✅ **秘密鍵保護**: パスワード保護された秘密鍵ファイル
- ✅ **署名検証**: 公開鍵による検証（改ざん防止）
- ✅ **自動化**: `latest.yml` に署名情報を自動記載
- ✅ **配布完全性**: `.sig` ファイルの自動配置

### 📚 ドキュメント

[SIGNATURE_GUIDE.md](SIGNATURE_GUIDE.md) を参照してください。内容：
- 秘密鍵/公開鍵の構成
- ビルドプロセス
- ファイル配置
- 署名検証メカニズム
- トラブルシューティング
- CI/CD 統合

### 🎯 次のステップ

```bash
# 実際に試してみる
npm run tauri:release

# GitHub Releases にアップロード
# release/ のすべてのファイルをアップロード
# （latest.yml と .sig ファイルを必ず含める）

# クライアントがアップデートを自動検証
```

### ✨ 動作確認

このスクリプトは以下を自動処理します：

1. **秘密鍵検出** - `~/TAURI_KEY_PASSWORD.sh` を探索
2. **パスワード入力** - セキュアに取得
3. **ビルド実行** - 秘密鍵で署名
4. **ファイル生成** - `.sig` ファイル が自動生成
5. **配置管理** - `release/` に整理
6. **検証ログ** - 最終チェック実行
