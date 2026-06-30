import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import type { AppSettings, GlobalSettings, MallSettings } from '../types/settings';
import { logError, logInfo } from '../logs/logging';

const GLOBAL_FILE = 'settings.json';
const mallFile = (mallId: string) => `${mallId}-settings.json`;

// ============================================================================
// デフォルト値
// ============================================================================

const DEFAULT_GLOBAL: GlobalSettings = {
  mallId: 'sakaikitahanada',
  appMode: 'VIDEO_AD',
  isMuted: false,
  sleepSettings: { enabled: false, startTime: '10:00', endTime: '21:00' },
};

const DEFAULT_MALL: MallSettings = {
  apiEndpoint: 'http://localhost:8090/api/events',
  shopListGrid: { rows: 4, cols: 3 },
};

// ============================================================================
// 内部ヘルパー
// ============================================================================

async function ensureAppLocalDataDir(): Promise<void> {
  const dirExists = await exists('', { baseDir: BaseDirectory.AppLocalData });
  if (!dirExists) {
    await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true });
  }
}

async function readJsonFile<T>(filename: string): Promise<T | null> {
  try {
    const fileExists = await exists(filename, { baseDir: BaseDirectory.AppLocalData });
    if (!fileExists) return null;
    const content = await readTextFile(filename, { baseDir: BaseDirectory.AppLocalData });
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filename: string, data: unknown): Promise<void> {
  await ensureAppLocalDataDir();
  const content = JSON.stringify(data, null, 2);
  await writeTextFile(filename, content, { baseDir: BaseDirectory.AppLocalData });
}

// ============================================================================
// グローバル設定（settings.json）
// ============================================================================

export async function loadGlobalSettings(): Promise<GlobalSettings> {
  const raw = await readJsonFile<Partial<GlobalSettings>>(GLOBAL_FILE);
  if (!raw) return { ...DEFAULT_GLOBAL };
  return {
    mallId: raw.mallId ?? DEFAULT_GLOBAL.mallId,
    appMode: raw.appMode ?? DEFAULT_GLOBAL.appMode,
    isMuted: raw.isMuted ?? DEFAULT_GLOBAL.isMuted,
    sleepSettings: raw.sleepSettings ?? DEFAULT_GLOBAL.sleepSettings,
    hostname: raw.hostname,
  };
}

export async function saveGlobalSettings(global: GlobalSettings): Promise<void> {
  await writeJsonFile(GLOBAL_FILE, global);
  logInfo('CONFIG', 'Global settings saved', { mallId: global.mallId });
}

// ============================================================================
// モール別設定（{mallId}-settings.json）
// ============================================================================

export async function loadMallSettings(mallId: string): Promise<MallSettings> {
  const raw = await readJsonFile<Partial<MallSettings>>(mallFile(mallId));
  if (!raw) return { ...DEFAULT_MALL };
  return {
    apiEndpoint: raw.apiEndpoint ?? DEFAULT_MALL.apiEndpoint,
    shopListGrid: raw.shopListGrid ?? DEFAULT_MALL.shopListGrid,
    videoDirectory: raw.videoDirectory,
    mediaDownloadSettings: raw.mediaDownloadSettings,
    genreSubFilter: raw.genreSubFilter,
  };
}

export async function saveMallSettings(mallId: string, mall: MallSettings): Promise<void> {
  await writeJsonFile(mallFile(mallId), mall);
  logInfo('CONFIG', 'Mall settings saved', { mallId });
}

// ============================================================================
// 統合 API（後方互換）
// ============================================================================

/**
 * 両ファイルを読み込んで AppSettings として返す。
 * 既存コードはこの関数を引き続き使用できる。
 */
export const loadSettings = async (): Promise<AppSettings> => {
  // 旧単一ファイル形式から移行（初回のみ実行）
  await migrateFromLegacyIfNeeded();

  const global = await loadGlobalSettings();
  const mall = await loadMallSettings(global.mallId);
  return { ...global, ...mall };
};

/**
 * AppSettings を global / mall に分けて保存する。
 * 既存コードはこの関数を引き続き使用できる。
 */
export const saveSettings = async (settings: AppSettings): Promise<void> => {
  const { mallId, hostname, appMode, isMuted, sleepSettings } = settings;
  const { apiEndpoint, shopListGrid, videoDirectory, mediaDownloadSettings, genreSubFilter } = settings;

  await saveGlobalSettings({ mallId, hostname, appMode, isMuted, sleepSettings });
  await saveMallSettings(mallId, { apiEndpoint, shopListGrid, videoDirectory, mediaDownloadSettings, genreSubFilter });
};

// ============================================================================
// 旧単一ファイル形式からの移行
// ============================================================================

async function migrateFromLegacyIfNeeded(): Promise<void> {
  try {
    // settings.json をそのまま読む（loadGlobalSettings を経由しない）
    const raw = await readJsonFile<Record<string, unknown>>(GLOBAL_FILE);
    if (!raw) return;

    // settings.json に apiEndpoint が含まれていれば旧形式
    if (!('apiEndpoint' in raw)) return;

    const mallId = (raw.mallId as string | undefined) ?? DEFAULT_GLOBAL.mallId;

    // すでにモール別ファイルが存在すれば移行済み
    const mallExists = await exists(mallFile(mallId), { baseDir: BaseDirectory.AppLocalData });
    if (mallExists) return;

    logInfo('CONFIG', 'Migrating from legacy single-file settings', { mallId });

    // モール別フィールドを {mallId}-settings.json に保存
    const mall: MallSettings = {
      apiEndpoint: (raw.apiEndpoint as string) ?? DEFAULT_MALL.apiEndpoint,
      shopListGrid: (raw.shopListGrid as MallSettings['shopListGrid']) ?? DEFAULT_MALL.shopListGrid,
      videoDirectory: raw.videoDirectory as string | undefined,
      mediaDownloadSettings: raw.mediaDownloadSettings as MallSettings['mediaDownloadSettings'],
      genreSubFilter: raw.genreSubFilter as string | undefined,
    };
    await saveMallSettings(mallId, mall);

    // settings.json をグローバルフィールドのみに書き直す
    const global: GlobalSettings = {
      mallId,
      appMode: (raw.appMode as GlobalSettings['appMode']) ?? DEFAULT_GLOBAL.appMode,
      isMuted: (raw.isMuted as boolean | undefined) ?? DEFAULT_GLOBAL.isMuted,
      sleepSettings: (raw.sleepSettings as GlobalSettings['sleepSettings']) ?? DEFAULT_GLOBAL.sleepSettings,
      hostname: raw.hostname as string | undefined,
    };
    await saveGlobalSettings(global);

    logInfo('CONFIG', 'Legacy settings migration completed', { mallId });
  } catch (error) {
    logError('CONFIG', 'Legacy settings migration failed (non-fatal)', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
