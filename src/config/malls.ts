export interface MallConfig {
  id: string;
  name: string;
}

export const MALL_LIST: MallConfig[] = [
  { id: 'sakaikitahanada', name: 'イオンモール堺北花田' },
];

export const getMallName = (mallId: string): string =>
  MALL_LIST.find((m) => m.id === mallId)?.name ?? mallId;
