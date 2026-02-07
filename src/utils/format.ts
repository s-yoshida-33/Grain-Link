// テキスト整形ユーティリティ

/**
 * 店舗名を整形する
 * 例: "丸亀製麺【マルガメセイメン】" -> "丸亀製麺"
 */
export const formatShopName = (name: string): string => {
  if (!name) return "";
  // 【】とその中身、およびそれ以降を削除する場合
  // 要件: "丸亀製麺【マルガメセイメン】" -> "丸亀製麺"
  return name.replace(/【.*$/, "");
};

/**
 * ジャンルメモを整形する
 * 例: "たこ焼き・焼きそば" -> "たこ焼き / 焼きそば"
 */
export const formatGenreMemo = (genre: string): string => {
  if (!genre) return "";
  return genre.replace(/・/g, " / ");
};
