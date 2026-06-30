export interface MallConfig {
  id: string;
  name: string;
}

export const MALL_LIST: MallConfig[] = [
  { id: 'sakaikitahanada', name: 'イオンモール堺北花田' },
  { id: 'development', name: '開発用' },
];

export const getMallName = (mallId: string): string =>
  MALL_LIST.find((m) => m.id === mallId)?.name ?? mallId;
