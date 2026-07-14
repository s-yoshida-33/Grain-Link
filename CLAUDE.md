# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Grain-Link は、商業施設の**大型非タッチ・飲食テナント向け**ディスプレイアプリ。Gidoと同系統のTauri2 + React19 + TypeScriptのWindows x64キオスクアプリ（フルスクリーン・常時最前面）で、店舗（テナント）の映像・画像サイネージと店舗一覧を表示する。GidoとUIコンポーネント構成（`GidoApp.tsx`, `VideoSignageView`, `ShopListView`等）が似ているが、**別コードベース**（gitのsubmodule/monorepoではない）。

WonderScreen CMSとの連携は無く、独自のメディア配信（S3的なCDN `dl.tti.ninja/grain-link/medias/`）を使う点がGido/Gido-Touchと異なる。

現バージョン: 1.1.24（`package.json`）。GidoやGido-Touch-Miniと同時期にElectronからTauriへ移行（`feature/migration-to-tauri`ブランチ履歴）。

## Repository layout

- `src/api/` — Bridge-Ground/メディアAPI向けクライアント（`useBridgeRegistration.ts`等）
- `src/screens/` — 画面（映像サイネージ、店舗一覧等）
- `src/components/` — UIコンポーネント
- `src/hooks/` — カスタムフック
- `src/config/` — 設定（`apiEndpoint`のデフォルトは`localhost:8090`、モールID等）
- `src/types/` — 型定義
- `bridgeState.ts` — Bridge-Ground接続状態の管理（循環importを避けるため専用ファイルに分離）
- `BUILD_EXECUTION_STEPS.md` / `BUILD_PASSWORD_GUIDE.md` / `BUILD_TROUBLESHOOTING.md` / `FILE_LOCK_ERROR_SOLUTION.md` / `QUICK_BUILD_GUIDE.md` — 署名付きビルドの手順・パスワード管理・トラブルシューティング集（他3アプリより充実したビルドドキュメント群）

## Development commands

Docker不使用。Node + Rust + Tauri CLIのローカル環境で直接実行する。

```bash
npm run dev            # Viteのみ
npm run tauri:dev / npm run desktop:dev   # Tauri込みの開発実行
npm run build          # tsc -b && vite build
npm run lint
```

リリースビルド（詳細は`BUILD_EXECUTION_STEPS.md`参照）:
```bash
npm run tauri:build:signed
npm run tauri:release
npm run bump:version
npm run optimize:media / npm run media:compress
```

署名キーのパスワード管理には3方式あり、`BUILD_PASSWORD_GUIDE.md`に手順がある（都度入力／環境変数／GitHub Secrets）。ローカル開発では環境変数方式が推奨されている。

## Known gotchas

- **`OS error 5`（ファイルロック）ビルド失敗**: 前回ビルドの成果物が掴まれたままだと発生する。`BUILD_TROUBLESHOOTING.md`に対処法（管理者権限PowerShell、`Remove-Item target -Recurse`、セキュリティソフトの干渉確認）がまとまっている。
- **Bridge-Groundとの連携がGido系より広い**: `/api/apps/register`・`/api/apps/{id}/heartbeat`・`/api/apps/{id}/screenshot`（WebSocket）を使い、リモート監視用のスクリーンショット取得にも対応している。
- **WonderScreen CMSとの連携は無い**。映像・メディアは`apiEndpoint`（既定`localhost:8090`、Bridge-Ground経由）と独自CDN（`dl.tti.ninja/grain-link/medias/{mallId}/videos/{hostname}/latest.json`）から取得する。GidoのCMS_API.mdに相当するドキュメントは存在しない。
- **GidoとUI構成が似ているが別コードベース**。Gido側の修正をそのまま持ち込めるとは限らない（差分は都度確認）。
- **署名鍵ファイル（`~/TAURI_KEY_PASSWORD.sh`・`.sh.pub`）は、コミット`a20e5c9`で誤ってgit管理下に追加され、Publicリポジトリの状態でpushされていた**（2026-07-14発覚、Gidoと同時に発覚した同種の問題）。`git-filter-repo`で全履歴・全ブランチ・全タグから完全に除去し、force pushで上書き済み（ローカルチェックアウトも再クローン済み）。`.gitignore`に`~/*`を追加し再混入を防止している。**鍵のローテーションは意図的に未実施**（現時点でこのリポジトリをcloneしているのは開発者本人のみのため優先度を下げている）。今後この鍵をコミットに含めないこと。ローテーションが必要になった場合、既存端末は現行の公開鍵しか信頼しないため、「旧鍵で署名しつつ新しい公開鍵を埋め込んだリリース」を経由する2段階の切り替えが必要になる点に注意。

## Branches & deploy flow

- 作業は `dev` を起点に `hotfix/<内容>` または `feature/<内容>` ブランチを作成して行う（git worktreeで作業ディレクトリを分けるのが基本、`C:\dev\floor-guide-Issue\#000.md`参照）
- 作業完了後はそのブランチをpushしてPRを作成し、`dev`へのマージが完了した時点で対応するIssueをクローズする
- 過去は`dev`に直接作業・pushする運用だったが、複数リポジトリ・複数タスクの並行作業に対応するため上記のブランチ運用に移行した
- **デフォルトブランチは`main`ではなく`release`**（2026-07-10にリネーム。旧`main`は初期セットアップ後ほぼ更新されずに放置されていた）。`release`への**push**がGitHub Actions（`.github/workflows/build-release.yml`）の本番リリーストリガーになっている。
- **本番リリース手順**:
  1. `dev`で`npm run bump:version`を実行し、`package.json`のバージョンを先に上げる（**これを忘れると次のステップでワークフローが失敗する**、4.のガード参照）
  2. `dev` → `release` へPRを作成・マージ（`gh pr create --base release --head dev` → `gh pr merge`）
  3. `release`へのpushをトリガーに、GitHub Actionsが署名付きビルド（`npm run tauri:release`）→ S3アップロード（`dl.tti.ninja/public/grain-link/releases/`、`.exe`/`.exe.sig`/`latest.json`）→ タグ`vX.Y.Z`作成 → GitHub Release作成、まで自動実行する
  4. ワークフロー冒頭の「Check version not already released」ステップが、同名タグ（`vX.Y.Z`）が既に存在する場合はジョブを失敗させる（1.のバージョン上げ忘れによる既存リリース・S3成果物の無言上書きを防ぐガード）
- **2026-07-10以前はタグ（`v*`）のpushがリリーストリガーだった**（`git tag vX.Y.Z && git push origin vX.Y.Z`、デフォルトブランチは当時`main`）。「デフォルトブランチへのpushでリリース」という一般的な形に統一するため変更した。
- `BUILD_EXECUTION_STEPS.md`は上記変更前の、CI連携もない完全手動フロー（ローカルビルド→GitHub Releaseへの手動アップロード）を記した古いドキュメントで、現状のCI自動アップロードフローとは一致していない（要更新、未対応）。

## Architecture

```
Bridge-Ground（同一STB、:8090）──shops/mediaステータス + apps register/heartbeat/screenshot──► 店舗一覧・監視
dl.tti.ninja（CDN）──────────────────────────────────映像/画像メディア───────────────────────► サイネージ枠
```

- WonderScreen CMSは介さず、Bridge-Ground（ローカル）とCDN（メディア配信）の2系統でデータを取得する。

## Code conventions

- ESLint（`npm run lint`）に従う。
- コミットメッセージは変更内容が明確に伝わるものにする。複数ファイルの変更を1コミットにまとめても構わない。

## Project context

Grain-Linkは「フロアガイド」製品群のうち、飲食テナント向けの大型非タッチ版。Gidoと構造は似ているが独立したコードベースで、WonderScreen CMSは使わず独自CDNでメディアを配信する点が特徴。他の4リポジトリ（Gido/Gido-Touch/Gido-Touch-Mini/Bridge-Ground/portal-cms）と合わせて`s-yoshida-33`配下でホストされている姉妹プロジェクト。ワークフロー運用ルールは`C:\dev\floor-guide-Issue\#000.md`を参照。
