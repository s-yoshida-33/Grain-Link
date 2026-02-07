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

/**
 * 営業時間のラストオーダー部分を整形して抽出する
 * 例: "10:00～21:00【ラストオーダー20:30】" -> "ラストオーダー　20:30"
 */
export const formatLastOrder = (openTime: string): string => {
  if (!openTime) return "";
  const match = openTime.match(/[【（](.*?)[】）]/);
  if (!match) return "";
  
  let content = match[1];
  
  // "ラストオーダー"の直後のスペース（半角・全角問わず）を正規化して全角スペース1つにする
  // 他の箇所の半角スペースはそのまま維持する
  content = content.replace(/ラストオーダー[\s　]*/, "ラストオーダー　");
  
  return content;
};
