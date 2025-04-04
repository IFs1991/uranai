/**
 * 西洋占星術計算ライブラリ
 * 生年月日時と出生地から星座・惑星位置を計算し、占星術チャート生成のためのデータを準備する
 */

// astronomy-engine パッケージのインポート
const astronomyEngine = require('astronomy-engine');

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

// キャッシュ設定
const MAX_CACHE_SIZE = 1000; // キャッシュの最大エントリ数
const cache = new Map();
const cacheStats = { hits: 0, misses: 0 };

// キャッシュサイズ管理関数
function addToCache(key, value) {
  if (cache.size >= MAX_CACHE_SIZE) {
    // LRU戦略: 最も古いエントリを削除
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, value);
}

// キャッシュからの値取得（統計付き）
function getFromCache(key) {
  if (cache.has(key)) {
    cacheStats.hits++;
    return cache.get(key);
  }
  cacheStats.misses++;
  return null;
}

// パフォーマンス測定関数
function measurePerformance(fn, ...args) {
  const start = performance.now();
  const result = fn(...args);
  const end = performance.now();
  console.log(`${fn.name}: ${end - start}ms`);
  return result;
}

// 惑星名をastronomy-engine用にマッピング（事前計算して高速化）
const PLANET_BODY_MAP = {
  '太陽': astronomyEngine.Body.Sun,
  '月': astronomyEngine.Body.Moon,
  '水星': astronomyEngine.Body.Mercury,
  '金星': astronomyEngine.Body.Venus,
  '火星': astronomyEngine.Body.Mars,
  '木星': astronomyEngine.Body.Jupiter,
  '土星': astronomyEngine.Body.Saturn,
  '天王星': astronomyEngine.Body.Uranus,
  '海王星': astronomyEngine.Body.Neptune,
  '冥王星': astronomyEngine.Body.Pluto
};

/**
 * 生年月日からその日の太陽星座を取得
 * @param {number} month - 月 (1-12)
 * @param {number} day - 日 (1-31)
 * @returns {Object} 星座情報
 */
function getSunSign(month, day) {
  const cacheKey = `sunSign_${month}_${day}`;

  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) return cachedResult;

  for (const sign of ZODIAC_SIGNS) {
    const [startMonth, startDay] = sign.start;
    const [endMonth, endDay] = sign.end;

    if (
      (month === startMonth && day >= startDay) ||
      (month === endMonth && day <= endDay)
    ) {
      addToCache(cacheKey, sign);
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

  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) return cachedResult;

  // 経度から時差を概算（正確な計算には、実際のタイムゾーンデータが必要）
  const hourOffset = longitude / 15;
  const millisOffset = hourOffset * 60 * 60 * 1000;

  const localTime = new Date(utcDateTime.getTime() + millisOffset);
  addToCache(cacheKey, localTime);

  return localTime;
}

/**
 * astronomy-engine用の時間オブジェクトを作成（再利用可能）
 * @param {Date} date - 日時
 * @returns {Object} astronomy-engineの時間オブジェクト
 */
function createAstronomyTime(date) {
  return astronomyEngine.MakeTime(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours() + date.getMinutes()/60 + date.getSeconds()/3600
  );
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

  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) return cachedResult;

  // astronomy-engine を使用したアセンダント計算
  const date = createAstronomyTime(birthDateTime);

  // 地理座標を設定
  const observer = new astronomyEngine.Observer(latitude, longitude, 0);

  // アセンダント（上昇点）の計算
  const ascendantLongitude = astronomyEngine.Ascendant(date, observer);

  // 黄道座標から星座を求める
  const ascendantSign = getZodiacSignFromLongitude(ascendantLongitude);

  addToCache(cacheKey, ascendantSign);
  return ascendantSign;
}

/**
 * ユリウス日を計算
 * @param {Date} date - 日時
 * @returns {number} ユリウス日
 */
function getJulianDate(date) {
  const cacheKey = `julianDate_${date.toISOString()}`;

  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) return cachedResult;

  // astronomy-engine を使用
  const astronomyTime = createAstronomyTime(date);
  const julianDate = astronomyTime.tt;

  addToCache(cacheKey, julianDate);
  return julianDate;
}

/**
 * 黄道座標から星座を取得
 * @param {number} longitude - 黄道座標（0-360度）
 * @returns {Object} 星座情報
 */
function getZodiacSignFromLongitude(longitude) {
  const cacheKey = `zodiacFromLong_${Math.floor(longitude * 100) / 100}`; // 小数点2桁まで考慮

  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) return cachedResult;

  // 正規化
  const normalizedLongitude = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalizedLongitude / 30);
  const position = normalizedLongitude % 30;

  const result = {
    ...ZODIAC_SIGNS[signIndex],
    position: position
  };

  addToCache(cacheKey, result);
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
 * 惑星位置を並列計算（非同期）
 * @param {Date} birthDateTime - 出生日時
 * @param {Array} planetsToCalculate - 計算する惑星の配列
 * @param {Object} astronomyTime - 事前計算された時間オブジェクト
 * @returns {Promise<Array>} 惑星位置の配列
 */
async function calculatePlanetPositionsParallel(birthDateTime, planetsToCalculate, astronomyTime) {
  const date = astronomyTime || createAstronomyTime(birthDateTime);

  // 並列計算（Promiseベース）
  const promises = planetsToCalculate.map(planet => {
    return new Promise(resolve => {
      const bodyName = PLANET_BODY_MAP[planet.name] || astronomyEngine.Body.Sun;
      const ecliptic = astronomyEngine.Ecliptic(bodyName, date);
      const longitude = ecliptic.lon;

      resolve({
        planet: planet,
        longitude: longitude,
        sign: getZodiacSignFromLongitude(longitude),
        position: longitude % 30
      });
    });
  });

  return Promise.all(promises);
}

/**
 * 惑星位置を一括計算（同期）
 * @param {Date} birthDateTime - 出生日時
 * @param {number} latitude - 出生地の緯度
 * @param {number} longitude - 出生地の経度
 * @param {Array} planetsToCalculate - 計算する惑星の配列
 * @returns {Array} 惑星位置の配列
 */
function calculatePlanetPositions(birthDateTime, latitude, longitude, planetsToCalculate = PLANETS) {
  const cacheKey = `planetPos_${birthDateTime.toISOString()}_${latitude}_${longitude}_${planetsToCalculate.map(p => p.name).join('_')}`;

  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) return cachedResult;

  // astronomy-engine 用の時間オブジェクトと観測者位置を1回だけ初期化
  const date = createAstronomyTime(birthDateTime);
  const observer = new astronomyEngine.Observer(latitude, longitude, 0);

  // 惑星を一括計算
  const bodyArray = planetsToCalculate.map(planet => PLANET_BODY_MAP[planet.name]);

  // 各惑星の位置を計算
  const planetPositions = planetsToCalculate.map((planet, index) => {
    const bodyName = PLANET_BODY_MAP[planet.name] || astronomyEngine.Body.Sun;
    const ecliptic = astronomyEngine.Ecliptic(bodyName, date);
    const longitude = ecliptic.lon;

    return {
      planet: planet,
      longitude: longitude,
      sign: getZodiacSignFromLongitude(longitude),
      position: longitude % 30
    };
  });

  addToCache(cacheKey, planetPositions);
  return planetPositions;
}

/**
 * アスペクト（惑星間の角度関係）を計算
 * @param {Array} planetPositions - 惑星位置の配列
 * @returns {Array} アスペクトの配列
 */
function calculateAspects(planetPositions) {
  const cacheKey = `aspects_${planetPositions.map(p => `${p.planet.name}_${Math.floor(p.longitude * 10) / 10}`).join('_')}`;

  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) return cachedResult;

  const aspects = [];
  const planetCount = planetPositions.length;

  // 計算を最適化（半分の計算量で済む）
  for (let i = 0; i < planetCount; i++) {
    for (let j = i + 1; j < planetCount; j++) {
      const planet1 = planetPositions[i];
      const planet2 = planetPositions[j];

      // 二つの惑星間の角度差を計算（高速化）
      let angleDiff = Math.abs(planet1.longitude - planet2.longitude);
      if (angleDiff > 180) angleDiff = 360 - angleDiff;

      // 各アスペクトタイプについて検査（中断条件を追加して高速化）
      let aspectFound = false;

      for (const aspect of ASPECTS) {
        if (aspectFound) break;

        const orb = Math.min(planet1.planet.orb, planet2.planet.orb, aspect.orb);
        const diff = Math.abs(angleDiff - aspect.angle);

        if (diff <= orb) {
          aspects.push({
            planet1: planet1.planet,
            planet2: planet2.planet,
            aspect: aspect,
            angle: angleDiff,
            orb: diff,
            exact: diff < 1
          });
          aspectFound = true; // 一つのアスペクトが見つかったら中断
        }
      }
    }
  }

  addToCache(cacheKey, aspects);
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

  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) return cachedResult;

  // 時間と観測者の位置を1回だけ初期化
  const date = createAstronomyTime(birthDateTime);
  const observer = new astronomyEngine.Observer(latitude, longitude, 0);

  // アセンダント（第1ハウスカスプ）を取得
  const asc = astronomyEngine.Ascendant(date, observer);

  // ミッドヘブン（MC）も取得
  const mc = astronomyEngine.Horizon(date, observer, 0, 90, 'ecliptic').lon;

  // ハウスを計算
  const houses = [];
  let houseAngles;

  if (houseSystem === 'equal') {
    // 等分ハウスシステム - アセンダントから30度ずつ
    houseAngles = Array.from({length: 12}, (_, i) => (asc + i * 30) % 360);
  } else {
    // 他のハウスシステム（プラシダス等）
    // アセンダント、MC、IC、DSCを基準に計算
    const ascDegrees = asc;
    const mcDegrees = mc;
    const icDegrees = (mc + 180) % 360;
    const dscDegrees = (asc + 180) % 360;

    if (houseSystem === 'placidus') {
      // プラシダスハウスシステムの近似計算
      houseAngles = [
        ascDegrees,                                   // 1ハウス
        (ascDegrees + (mcDegrees - ascDegrees) / 3),  // 2ハウス
        (ascDegrees + (mcDegrees - ascDegrees) * 2/3),// 3ハウス
        mcDegrees,                                    // 4ハウス (MC)
        (mcDegrees + (dscDegrees - mcDegrees) / 3),   // 5ハウス
        (mcDegrees + (dscDegrees - mcDegrees) * 2/3), // 6ハウス
        dscDegrees,                                   // 7ハウス (DSC)
        (dscDegrees + (icDegrees - dscDegrees) / 3),  // 8ハウス
        (dscDegrees + (icDegrees - dscDegrees) * 2/3),// 9ハウス
        icDegrees,                                    // 10ハウス (IC)
        (icDegrees + (ascDegrees - icDegrees) / 3),   // 11ハウス
        (icDegrees + (ascDegrees - icDegrees) * 2/3)  // 12ハウス
      ];
    } else {
      // デフォルトは等分ハウス
      houseAngles = Array.from({length: 12}, (_, i) => (asc + i * 30) % 360);
    }
  }

  // ハウスオブジェクトを構築
  for (let i = 0; i < 12; i++) {
    houses.push({
      number: i + 1,
      cusp: houseAngles[i],
      sign: getZodiacSignFromLongitude(houseAngles[i])
    });
  }

  addToCache(cacheKey, houses);
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

  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) return cachedResult;

  // 実際に計算する惑星を決定
  const planetsToCalculate = planetsToInclude
    ? PLANETS.filter(planet => planetsToInclude.includes(planet.name))
    : PLANETS;

  // 時間オブジェクトを1回だけ初期化して再利用
  const astronomyTime = createAstronomyTime(birthDateTime);

  // 並行計算できる部分を同時に実行
  const sunSign = getSunSign(birthDateTime.getMonth() + 1, birthDateTime.getDate());
  const ascendant = calculateAscendant(birthDateTime, latitude, longitude);
  const planetPositions = calculatePlanetPositions(birthDateTime, latitude, longitude, planetsToCalculate);

  // 計算に依存関係のある部分を順次実行
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

  addToCache(cacheKey, chartData);
  return chartData;
}

/**
 * キャッシュを部分的にクリア
 * @param {string} prefix - クリアするキーのプレフィックス（省略時は全クリア）
 */
function clearCache(prefix) {
  if (!prefix) {
    cache.clear();
    console.log('キャッシュを完全にクリアしました');
    return;
  }

  // プレフィックスが一致するエントリだけ削除
  const keysToDelete = [];
  cache.forEach((value, key) => {
    if (key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => cache.delete(key));
  console.log(`プレフィックス "${prefix}" のキャッシュエントリ ${keysToDelete.length} 件をクリアしました`);
}

/**
 * キャッシュの統計情報を取得
 * @returns {Object} キャッシュの統計情報
 */
function getCacheStats() {
  return {
    ...cacheStats,
    size: cache.size,
    hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100 || 0
  };
}

// エクスポート
module.exports = {
  getSunSign,
  calculateAscendant,
  calculatePlanetPositions,
  calculatePlanetPositionsParallel,
  calculateAspects,
  calculateHouses,
  generateHoroscopeChart,
  clearCache,
  getCacheStats,
  measurePerformance,
  ZODIAC_SIGNS,
  PLANETS,
  ASPECTS
};