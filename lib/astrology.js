/**
 * 西洋占星術計算ライブラリ
 * 生年月日時と出生地から星座・惑星位置を計算し、占星術チャート生成のためのデータを準備する
 */

// 定数定義
const ZODIAC_SIGNS = [
  { name: '牡羊座', symbol: '♈', element: '火', start: [3, 21], end: [4, 19] },
  { name: '牡牛座', symbol: '♉', element: '地', start: [4, 20], end: [5, 20] },
  { name: '双子座', symbol: '♊', element: '風', start: [5, 21], end: [6, 20] },
  { name: '蟹座', symbol: '♋', element: '水', start: [6, 21], end: [7, 22] },
  { name: '獅子座', symbol: '♌', element: '火', start: [7, 23], end: [8, 22] },
  { name: '乙女座', symbol: '♍', element: '地', start: [8, 23], end: [9, 22] },
  { name: '天秤座', symbol: '♎', element: '風', start: [9, 23], end: [10, 22] },
  { name: '蠍座', symbol: '♏', element: '水', start: [10, 23], end: [11, 21] },
  { name: '射手座', symbol: '♐', element: '火', start: [11, 22], end: [12, 21] },
  { name: '山羊座', symbol: '♑', element: '地', start: [12, 22], end: [1, 19] },
  { name: '水瓶座', symbol: '♒', element: '風', start: [1, 20], end: [2, 18] },
  { name: '魚座', symbol: '♓', element: '水', start: [2, 19], end: [3, 20] }
];

const PLANETS = [
  { name: '太陽', symbol: '☉', keywords: ['自己', '本質', 'アイデンティティ'], orb: 8 },
  { name: '月', symbol: '☽', keywords: ['感情', '無意識', '母性'], orb: 8 },
  { name: '水星', symbol: '☿', keywords: ['知性', 'コミュニケーション', '論理'], orb: 7 },
  { name: '金星', symbol: '♀', keywords: ['愛', '美', '調和'], orb: 7 },
  { name: '火星', symbol: '♂', keywords: ['行動', 'エネルギー', '情熱'], orb: 7 },
  { name: '木星', symbol: '♃', keywords: ['拡大', '成長', '幸運'], orb: 9 },
  { name: '土星', symbol: '♄', keywords: ['制限', '責任', '忍耐'], orb: 9 },
  { name: '天王星', symbol: '♅', keywords: ['革新', '独立', '突発'], orb: 5 },
  { name: '海王星', symbol: '♆', keywords: ['霊性', '幻想', '溶解'], orb: 5 },
  { name: '冥王星', symbol: '♇', keywords: ['変容', '再生', '力'], orb: 5 }
];

const ASPECTS = [
  { name: '合', angle: 0, orb: 8, type: '主要', nature: '結合' },
  { name: '衝', angle: 180, orb: 8, type: '主要', nature: '緊張' },
  { name: '三分', angle: 120, orb: 8, type: '主要', nature: '調和' },
  { name: '矩', angle: 90, orb: 6, type: '主要', nature: '緊張' },
  { name: '六分', angle: 60, orb: 6, type: '副次', nature: '調和' },
  { name: '半六分', angle: 30, orb: 2, type: '副次', nature: '緊張' },
  { name: '半矩', angle: 45, orb: 2, type: '副次', nature: '緊張' },
  { name: '五分', angle: 150, orb: 3, type: '副次', nature: '緊張' }
];

// キャッシュストア
const cache = new Map();

/**
 * 生年月日からその日の太陽星座を取得
 * @param {number} month - 月 (1-12)
 * @param {number} day - 日 (1-31)
 * @returns {Object} 星座情報
 */
function getSunSign(month, day) {
  const cacheKey = `sunSign_${month}_${day}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  for (const sign of ZODIAC_SIGNS) {
    const [startMonth, startDay] = sign.start;
    const [endMonth, endDay] = sign.end;
    
    if (
      (month === startMonth && day >= startDay) || 
      (month === endMonth && day <= endDay)
    ) {
      cache.set(cacheKey, sign);
      return sign;
    }
  }
  
  return null;
}

/**
 * 出生地の緯度経度から現地時間を計算
 * @param {Date} utcDateTime - UTC日時
 * @param {number} longitude - 経度
 * @returns {Date} 現地時間
 */
function calculateLocalTime(utcDateTime, longitude) {
  const cacheKey = `localTime_${utcDateTime.toISOString()}_${longitude}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // 経度から時差を概算（正確な計算には、実際のタイムゾーンデータが必要）
  const hourOffset = longitude / 15;
  const millisOffset = hourOffset * 60 * 60 * 1000;
  
  const localTime = new Date(utcDateTime.getTime() + millisOffset);
  cache.set(cacheKey, localTime);
  
  return localTime;
}

/**
 * アセンダント（上昇宮）を計算
 * @param {Date} birthDateTime - 出生日時
 * @param {number} latitude - 出生地の緯度
 * @param {number} longitude - 出生地の経度
 * @returns {Object} アセンダント情報
 */
function calculateAscendant(birthDateTime, latitude, longitude) {
  const cacheKey = `ascendant_${birthDateTime.toISOString()}_${latitude}_${longitude}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // 現地時間の計算
  const localTime = calculateLocalTime(birthDateTime, longitude);
  
  // 恒星時（サイデリアルタイム）の計算
  // 簡略化した計算。実際には複雑な天文計算が必要
  const year = localTime.getFullYear();
  const month = localTime.getMonth() + 1;
  const day = localTime.getDate();
  const hour = localTime.getHours();
  const minute = localTime.getMinutes();
  
  // 簡易的なアセンダント計算（実際にはもっと複雑な天文計算が必要）
  const birthJulianDate = getJulianDate(year, month, day, hour, minute);
  const T = (birthJulianDate - 2451545.0) / 36525;
  
  // 恒星時（Greenwich Sidereal Time）を簡易計算
  let GST = 280.46061837 + 360.98564736629 * (birthJulianDate - 2451545.0) + 
            0.000387933 * T * T - T * T * T / 38710000;
  GST = GST % 360;
  if (GST < 0) GST += 360;
  
  // 現地恒星時（Local Sidereal Time）
  let LST = GST + longitude;
  LST = LST % 360;
  if (LST < 0) LST += 360;
  
  // 簡易的なアセンダント計算
  let ascendantLongitude = LST + Math.atan2(Math.cos(toRadians(LST)) * Math.tan(toRadians(latitude)), Math.sin(toRadians(LST))) * 180 / Math.PI;
  ascendantLongitude = ascendantLongitude % 360;
  if (ascendantLongitude < 0) ascendantLongitude += 360;
  
  // 黄道座標から星座を求める
  const ascendantSign = getZodiacSignFromLongitude(ascendantLongitude);
  
  cache.set(cacheKey, ascendantSign);
  return ascendantSign;
}

/**
 * ユリウス日を計算
 * @param {number} year - 年
 * @param {number} month - 月 (1-12)
 * @param {number} day - 日
 * @param {number} hour - 時
 * @param {number} minute - 分
 * @returns {number} ユリウス日
 */
function getJulianDate(year, month, day, hour, minute) {
  const cacheKey = `julianDate_${year}_${month}_${day}_${hour}_${minute}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jd = Math.floor(365.25 * (year + 4716)) + 
             Math.floor(30.6001 * (month + 1)) + 
             day + b - 1524.5 + 
             (hour + minute / 60) / 24;
  
  cache.set(cacheKey, jd);
  return jd;
}

/**
 * 黄道座標から星座を取得
 * @param {number} longitude - 黄道座標（0-360度）
 * @returns {Object} 星座情報
 */
function getZodiacSignFromLongitude(longitude) {
  const cacheKey = `zodiacFromLong_${longitude}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const signIndex = Math.floor(longitude / 30);
  const result = ZODIAC_SIGNS[signIndex % 12];
  
  cache.set(cacheKey, result);
  return result;
}

/**
 * 度数をラジアンに変換
 * @param {number} degrees - 度数
 * @returns {number} ラジアン
 */
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

/**
 * 惑星位置を計算
 * @param {Date} birthDateTime - 出生日時
 * @param {number} latitude - 出生地の緯度
 * @param {number} longitude - 出生地の経度
 * @param {Array} planetsToCalculate - 計算する惑星の配列（省略時は全惑星）
 * @returns {Array} 惑星位置の配列
 */
function calculatePlanetPositions(birthDateTime, latitude, longitude, planetsToCalculate = PLANETS) {
  const cacheKey = `planetPos_${birthDateTime.toISOString()}_${latitude}_${longitude}_${planetsToCalculate.map(p => p.name).join('_')}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // 現実の計算では、惑星位置の計算は複雑な天文計算が必要
  // ここでは簡略化した擬似計算を行う
  const year = birthDateTime.getFullYear();
  const month = birthDateTime.getMonth() + 1;
  const day = birthDateTime.getDate();
  const hour = birthDateTime.getHours();
  const minute = birthDateTime.getMinutes();
  
  const jd = getJulianDate(year, month, day, hour, minute);
  
  // 各惑星の位置を計算（実際はもっと複雑な天文計算が必要）
  const planetPositions = planetsToCalculate.map(planet => {
    // 簡易的な擬似計算（実際の占星術計算ではこのような単純な計算は使わない）
    const seed = (jd * planet.name.length) % 360;
    const position = (seed + jd / 10) % 360;
    
    return {
      planet: planet,
      longitude: position,
      sign: getZodiacSignFromLongitude(position),
      position: position % 30, // 星座内の度数
    };
  });
  
  cache.set(cacheKey, planetPositions);
  return planetPositions;
}

/**
 * アスペクト（惑星間の角度関係）を計算
 * @param {Array} planetPositions - 惑星位置の配列
 * @returns {Array} アスペクトの配列
 */
function calculateAspects(planetPositions) {
  const cacheKey = `aspects_${planetPositions.map(p => `${p.planet.name}_${p.longitude.toFixed(2)}`).join('_')}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const aspects = [];
  
  // すべての惑星ペアについてアスペクトを検査
  for (let i = 0; i < planetPositions.length; i++) {
    for (let j = i + 1; j < planetPositions.length; j++) {
      const planet1 = planetPositions[i];
      const planet2 = planetPositions[j];
      
      // 二つの惑星間の角度差を計算
      let angleDiff = Math.abs(planet1.longitude - planet2.longitude);
      if (angleDiff > 180) angleDiff = 360 - angleDiff;
      
      // 各アスペクトタイプについて検査
      for (const aspect of ASPECTS) {
        const orb = Math.min(planet1.planet.orb, planet2.planet.orb, aspect.orb);
        
        if (Math.abs(angleDiff - aspect.angle) <= orb) {
          aspects.push({
            planet1: planet1.planet,
            planet2: planet2.planet,
            aspect: aspect,
            angle: angleDiff,
            orb: Math.abs(angleDiff - aspect.angle),
            exact: Math.abs(angleDiff - aspect.angle) < 1
          });
          break; // 一つのアスペクトが見つかったら次のペアへ
        }
      }
    }
  }
  
  cache.set(cacheKey, aspects);
  return aspects;
}

/**
 * ハウス（ハウスシステム）を計算
 * @param {Date} birthDateTime - 出生日時
 * @param {number} latitude - 出生地の緯度
 * @param {number} longitude - 出生地の経度
 * @param {string} houseSystem - ハウスシステム（'placidus', 'koch', 'equal'など）
 * @returns {Array} ハウスの配列
 */
function calculateHouses(birthDateTime, latitude, longitude, houseSystem = 'placidus') {
  const cacheKey = `houses_${birthDateTime.toISOString()}_${latitude}_${longitude}_${houseSystem}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // アセンダントの計算
  const ascendant = calculateAscendant(birthDateTime, latitude, longitude);
  
  // 現実のハウス計算は複雑な数学計算が必要
  // ここでは簡易的な等分ハウスシステムを使用
  const houses = [];
  const ascendantLongitude = ZODIAC_SIGNS.findIndex(sign => sign.name === ascendant.name) * 30 + (ascendant.position || 0);
  
  for (let i = 0; i < 12; i++) {
    let cusp;
    
    if (houseSystem === 'equal') {
      // 等分ハウスシステム - 最も単純で、アセンダントから30度ずつ
      cusp = (ascendantLongitude + i * 30) % 360;
    } else {
      // 他のハウスシステムでは複雑な計算が必要
      // ここでは簡易的な擬似計算
      const offset = i * 30 + (Math.sin(i * Math.PI / 6) * 5);
      cusp = (ascendantLongitude + offset) % 360;
    }
    
    houses.push({
      number: i + 1,
      cusp: cusp,
      sign: getZodiacSignFromLongitude(cusp)
    });
  }
  
  cache.set(cacheKey, houses);
  return houses;
}

/**
 * 占星術チャートの完全なデータセットを生成
 * @param {Date} birthDateTime - 出生日時
 * @param {number} latitude - 出生地の緯度
 * @param {number} longitude - 出生地の経度
 * @param {Array} planetsToInclude - 含める惑星（省略時は全惑星）
 * @param {string} houseSystem - ハウスシステム
 * @returns {Object} 占星術チャートデータ
 */
function generateHoroscopeChart(birthDateTime, latitude, longitude, planetsToInclude, houseSystem = 'placidus') {
  const cacheKey = `chart_${birthDateTime.toISOString()}_${latitude}_${longitude}_${planetsToInclude?.join('_') || 'all'}_${houseSystem}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // 実際に計算する惑星を決定
  const planetsToCalculate = planetsToInclude 
    ? PLANETS.filter(planet => planetsToInclude.includes(planet.name))
    : PLANETS;
  
  // 各種計算を実行
  const sunSign = getSunSign(birthDateTime.getMonth() + 1, birthDateTime.getDate());
  const ascendant = calculateAscendant(birthDateTime, latitude, longitude);
  const planetPositions = calculatePlanetPositions(birthDateTime, latitude, longitude, planetsToCalculate);
  const aspects = calculateAspects(planetPositions);
  const houses = calculateHouses(birthDateTime, latitude, longitude, houseSystem);
  
  // 月星座を取得
  const moonPosition = planetPositions.find(p => p.planet.name === '月');
  const moonSign = moonPosition ? moonPosition.sign : null;
  
  // チャートデータを構築
  const chartData = {
    birthInfo: {
      dateTime: birthDateTime,
      latitude,
      longitude
    },
    sunSign,
    moonSign,
    ascendant,
    planetPositions,
    houses,
    aspects
  };
  
  cache.set(cacheKey, chartData);
  return chartData;
}

/**
 * キャッシュをクリア
 */
function clearCache() {
  cache.clear();
}

// エクスポート
module.exports = {
  getSunSign,
  calculateAscendant,
  calculatePlanetPositions,
  calculateAspects,
  calculateHouses,
  generateHoroscopeChart,
  clearCache,
  ZODIAC_SIGNS,
  PLANETS,
  ASPECTS
};