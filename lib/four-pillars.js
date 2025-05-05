/**
 * 四柱推命計算ライブラリ
 * 生年月日時から四柱推命の命式を計算するためのライブラリ
 */

// chinese-lunar-calendar パッケージをインポート
const chineseLunarCalendar = require('chinese-lunar-calendar');

// 十干（天干）
const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 十二支（地支）
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 五行
const FIVE_ELEMENTS = ['木', '火', '土', '金', '水'];

// 十干と五行の対応
const STEM_TO_ELEMENT = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
};

// 十二支と五行の対応
const BRANCH_TO_ELEMENT = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

// 蔵干（十二支に蔵される十干）
const HIDDEN_STEMS = {
  '子': [['癸', 100]],
  '丑': [['己', 60], ['癸', 30], ['辛', 10]],
  '寅': [['甲', 60], ['丙', 30], ['戊', 10]],
  '卯': [['乙', 100]],
  '辰': [['戊', 60], ['乙', 30], ['癸', 10]],
  '巳': [['丙', 60], ['庚', 30], ['戊', 10]],
  '午': [['丁', 60], ['己', 30], ['己', 10]],
  '未': [['己', 60], ['丁', 30], ['乙', 10]],
  '申': [['庚', 60], ['壬', 30], ['戊', 10]],
  '酉': [['辛', 100]],
  '戌': [['戊', 60], ['辛', 30], ['丁', 10]],
  '亥': [['壬', 60], ['甲', 30], ['戊', 10]]
};

// 十干の陰陽
const STEM_YIN_YANG = {
  '甲': '陽', '乙': '陰', '丙': '陽', '丁': '陰', '戊': '陽',
  '己': '陰', '庚': '陽', '辛': '陰', '壬': '陽', '癸': '陰'
};

// 十二支の陰陽
const BRANCH_YIN_YANG = {
  '子': '陽', '丑': '陰', '寅': '陽', '卯': '陰', '辰': '陽', '巳': '陰',
  '午': '陽', '未': '陰', '申': '陽', '酉': '陰', '戌': '陽', '亥': '陰'
};

// 相生関係（生じる関係）
const GENERATING_CYCLE = {
  '木': '火', '火': '土', '土': '金', '金': '水', '水': '木'
};

// 相剋関係（抑制する関係）
const CONTROLLING_CYCLE = {
  '木': '土', '土': '水', '水': '火', '火': '金', '金': '木'
};

// 通変星の判定表
const TRANSFORMATIONS = {
  // 日主の五行と干支の五行の関係による通変星
  '比肩': '同じ五行、同じ陰陽',
  '劫財': '同じ五行、異なる陰陽',
  '食神': '日主が生じる五行、同じ陰陽',
  '傷官': '日主が生じる五行、異なる陰陽',
  '偏財': '日主が抑制される五行、同じ陰陽',
  '正財': '日主が抑制される五行、異なる陰陽',
  '偏官': '日主を抑制する五行、同じ陰陽',
  '正官': '日主を抑制する五行、異なる陰陽',
  '偏印': '日主を生じる五行、同じ陰陽',
  '印綬': '日主を生じる五行、異なる陰陽'
};

// 干支のサイクル（60干支）- 事前計算で高速化
const SEXAGENARY_CYCLE = [];
for (let i = 0; i < 60; i++) {
  const stemIndex = i % 10;
  const branchIndex = i % 12;
  SEXAGENARY_CYCLE.push({
    stem: HEAVENLY_STEMS[stemIndex],
    branch: EARTHLY_BRANCHES[branchIndex],
    combined: HEAVENLY_STEMS[stemIndex] + EARTHLY_BRANCHES[branchIndex]
  });
}

// 干支年からインデックスへのマッピング（検索を高速化）
const YEAR_TO_SEXAGENARY_INDEX = {};
SEXAGENARY_CYCLE.forEach((item, index) => {
  YEAR_TO_SEXAGENARY_INDEX[item.combined] = index;
});

// キャッシュ設定
const MAX_CACHE_SIZE = 1000; // キャッシュの最大エントリ数
const cache = new Map();
const lunarDateCache = new Map(); // 旧暦変換専用キャッシュ
const cacheStats = { hits: 0, misses: 0, lunarHits: 0, lunarMisses: 0 };

// キャッシュサイズ管理関数
function addToCache(key, value, targetCache = cache) {
  if (targetCache.size >= MAX_CACHE_SIZE) {
    // LRU戦略: 最も古いエントリを削除
    const firstKey = targetCache.keys().next().value;
    targetCache.delete(firstKey);
  }
  targetCache.set(key, value);
}

// キャッシュからの値取得（統計付き）
function getFromCache(key, targetCache = cache, statsProperty = 'hits') {
  if (targetCache.has(key)) {
    cacheStats[statsProperty]++;
    return targetCache.get(key);
  }

  cacheStats[statsProperty === 'hits' ? 'misses' : 'lunarMisses']++;
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

/**
 * 新陽暦から旧暦に変換（キャッシュ最適化）
 * @param {Date} date - 新暦の日付
 * @returns {Object} 旧暦の日付情報
 */
function convertToLunarDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // キャッシュキー生成（日付のみ - 時間は旧暦に関係ない）
  const key = `${year}-${month}-${day}`;

  // キャッシュ確認
  const cachedResult = getFromCache(key, lunarDateCache, 'lunarHits');
  if (cachedResult) return cachedResult;

  // 旧暦への変換
  const lunarDate = chineseLunarCalendar.solarToLunar(year, month, day);

  // 必要なデータのみを抽出・整形
  const result = {
    year: lunarDate.lunarYear,
    month: lunarDate.lunarMonth,
    day: lunarDate.lunarDay,
    isLeapMonth: lunarDate.isLeap
  };

  // キャッシュに保存
  addToCache(key, result, lunarDateCache);
  return result;
}

/**
 * 四柱推命計算クラス
 */
class FourPillars {
  /**
   * コンストラクタ
   * @param {Date} birthDate - 生年月日時のDateオブジェクト
   * @param {boolean} useChineseTime - 中国式の時間表記を使用するかどうか
   * @param {string} gender - 性別 ('male'または'female')
   */
  constructor(birthDate, useChineseTime = true, gender = 'male') {
    this.birthDate = new Date(birthDate);
    this.useChineseTime = useChineseTime;
    this.gender = gender;

    // キャッシュキー生成（性別も含める）
    this.cacheKey = `${this.birthDate.toISOString()}_${useChineseTime}_${gender}`;

    // キャッシュが存在する場合はそれを使用
    const cachedResult = getFromCache(this.cacheKey);
    if (cachedResult) {
      Object.assign(this, cachedResult);
      return;
    }

    // 旧暦の生年月日情報を計算
    this.lunarBirthDate = convertToLunarDate(this.birthDate);

    // 命式の計算
    this.calculatePillars();
  }

  /**
   * 四柱（年柱、月柱、日柱、時柱）を計算
   */
  calculatePillars() {
    // 旧暦情報の取得（計算は一度だけ）
    const lunarYear = this.lunarBirthDate.year;
    const lunarMonth = this.lunarBirthDate.month;
    const lunarDay = this.lunarBirthDate.day;
    const hour = this.birthDate.getHours();

    // 四柱の計算（並行処理できる部分）
    this.yearPillar = this.calculateYearPillar(lunarYear);
    this.monthPillar = this.calculateMonthPillar(lunarYear, lunarMonth);
    this.dayPillar = this.calculateDayPillar(this.birthDate.getFullYear(), this.birthDate.getMonth() + 1, this.birthDate.getDate());
    this.hourPillar = this.calculateHourPillar(this.dayPillar.stem, hour);

    // 日主（日柱の天干）
    this.dayMaster = this.dayPillar.stem;

    // 五行バランスの計算
    this.fiveElementsBalance = this.calculateFiveElementsBalance();

    // 通変星の判定
    this.transformations = this.calculateTransformations();

    // 大運の計算
    this.majorFortunes = this.calculateMajorFortunes();

    // 命式のキャッシュ
    const cacheData = {
      yearPillar: this.yearPillar,
      monthPillar: this.monthPillar,
      dayPillar: this.dayPillar,
      hourPillar: this.hourPillar,
      dayMaster: this.dayMaster,
      fiveElementsBalance: this.fiveElementsBalance,
      transformations: this.transformations,
      majorFortunes: this.majorFortunes,
      lunarBirthDate: this.lunarBirthDate,
      gender: this.gender
    };

    addToCache(this.cacheKey, cacheData);
  }

  /**
   * 年柱を計算
   * @param {number} year - 西暦年
   * @returns {Object} 年柱（天干と地支）
   */
  calculateYearPillar(year) {
    // 高速計算用のキャッシュキー
    const cacheKey = `yearPillar_${year}`;

    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) return cachedResult;

    // 1864年は甲子年（干支のサイクルの基準年）
    const baseYear = 1864;
    const yearOffset = (year - baseYear) % 60;
    const stemIndex = yearOffset % 10;
    const branchIndex = yearOffset % 12;

    const result = {
      stem: HEAVENLY_STEMS[stemIndex],
      branch: EARTHLY_BRANCHES[branchIndex],
      element: STEM_TO_ELEMENT[HEAVENLY_STEMS[stemIndex]],
      hiddenStems: HIDDEN_STEMS[EARTHLY_BRANCHES[branchIndex]]
    };

    addToCache(cacheKey, result);
    return result;
  }

  /**
   * 月柱を計算
   * @param {number} year - 西暦年
   * @param {number} month - 月（1-12）
   * @returns {Object} 月柱（天干と地支）
   */
  calculateMonthPillar(year, month) {
    // 高速計算用のキャッシュキー
    const cacheKey = `monthPillar_${year}_${month}`;

    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) return cachedResult;

    // 年柱の天干に基づく月の天干の基準値（前計算したマップ）
    const stemBaseIndex = {
      '甲': 0, '己': 0,
      '乙': 2, '庚': 2,
      '丙': 4, '辛': 4,
      '丁': 6, '壬': 6,
      '戊': 8, '癸': 8
    };

    // 年柱を取得
    const yearPillar = this.calculateYearPillar(year);
    const yearStem = yearPillar.stem;

    // 月の地支（寅月から始まる）
    const branchIndex = (month + 1) % 12;
    const branch = EARTHLY_BRANCHES[branchIndex];

    // 月の天干
    const baseIndex = stemBaseIndex[yearStem];
    const stemIndex = (baseIndex + month - 1) % 10;
    const stem = HEAVENLY_STEMS[stemIndex];

    const result = {
      stem: stem,
      branch: branch,
      element: STEM_TO_ELEMENT[stem],
      hiddenStems: HIDDEN_STEMS[branch]
    };

    addToCache(cacheKey, result);
    return result;
  }

  /**
   * 日柱を計算
   * @param {number} year - 西暦年
   * @param {number} month - 月（1-12）
   * @param {number} day - 日
   * @returns {Object} 日柱（天干と地支）
   */
  calculateDayPillar(year, month, day) {
    // 高速計算用のキャッシュキー
    const cacheKey = `dayPillar_${year}_${month}_${day}`;

    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) return cachedResult;

    // 1900年1月1日は庚子日（基準日）
    const baseDate = new Date(1900, 0, 1); // JavaScript月は0始まり
    const targetDate = new Date(year, month - 1, day);

    // 日数差を計算（高速計算）- ミリ秒を日に変換
    const diffTime = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 日の天干と地支のインデックスを計算
    const stemIndex = (diffDays + 9) % 10; // 1900/1/1は庚（9番目の天干）
    const branchIndex = (diffDays + 1) % 12; // 1900/1/1は子（1番目の地支）

    const stem = HEAVENLY_STEMS[stemIndex];
    const branch = EARTHLY_BRANCHES[branchIndex];

    const result = {
      stem: stem,
      branch: branch,
      element: STEM_TO_ELEMENT[stem],
      hiddenStems: HIDDEN_STEMS[branch]
    };

    addToCache(cacheKey, result);
    return result;
  }

  /**
   * 時柱を計算
   * @param {string} dayStem - 日柱の天干
   * @param {number} hour - 時間（0-23）
   * @returns {Object} 時柱（天干と地支）
   */
  calculateHourPillar(dayStem, hour) {
    // キャッシュキー
    const cacheKey = `hourPillar_${dayStem}_${hour}_${this.useChineseTime ? 1 : 0}`;

    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) return cachedResult;

    // 時間から地支を決定（事前計算された配列を使用）
    let branchIndex;
    if (this.useChineseTime) {
      // 中国式時間区分（子の刻は23時〜1時、丑の刻は1時〜3時、...）
      branchIndex = Math.floor((hour + 1) / 2) % 12;
    } else {
      // 単純に時間から地支を決定（0時は子、2時は丑、...）
      branchIndex = Math.floor(hour / 2) % 12;
    }

    const branch = EARTHLY_BRANCHES[branchIndex];

    // 日の天干から時間の天干を決定（高速ルックアップテーブル）
    // 事前計算された天干時刻表
    const hourStemMap = {
      '甲': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1],
      '乙': [2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3],
      '丙': [4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5],
      '丁': [6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7],
      '戊': [8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      '己': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1],
      '庚': [2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3],
      '辛': [4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5],
      '壬': [6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7],
      '癸': [8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    };

    const stemIndex = hourStemMap[dayStem][branchIndex];
    const stem = HEAVENLY_STEMS[stemIndex];

    const result = {
      stem: stem,
      branch: branch,
      element: STEM_TO_ELEMENT[stem],
      hiddenStems: HIDDEN_STEMS[branch]
    };

    addToCache(cacheKey, result);
    return result;
  }

  /**
   * 五行バランスを計算
   * @returns {Object} 五行ごとの強さを表すオブジェクト
   */
  calculateFiveElementsBalance() {
    // 五行バランス初期化
    const balance = {
      '木': 0, '火': 0, '土': 0, '金': 0, '水': 0
    };

    // 天干の五行を加算（各柱の計算を一度にまとめる）
    const pillars = [this.yearPillar, this.monthPillar, this.dayPillar, this.hourPillar];
    for (const pillar of pillars) {
      // 天干の五行を加算
      balance[STEM_TO_ELEMENT[pillar.stem]] += 100;

      // 地支の蔵干の五行を加算（比率に応じて）
      for (const [hiddenStem, percentage] of pillar.hiddenStems) {
        balance[STEM_TO_ELEMENT[hiddenStem]] += percentage;
      }
    }

    return balance;
  }

  /**
   * 通変星を計算
   * @returns {Object} 四柱の各干支の通変星
   */
  calculateTransformations() {
    // 変換マップを事前計算（各計算は一度だけ）
    const stemTransformMap = {};

    // 日主の五行と陰陽を取得（一度だけ）
    const dayMasterElement = STEM_TO_ELEMENT[this.dayMaster];
    const dayMasterYinYang = STEM_YIN_YANG[this.dayMaster];

    // 変換テーブルを先に構築
    HEAVENLY_STEMS.forEach(stem => {
      if (!stemTransformMap[stem]) {
        stemTransformMap[stem] = this.calculateStemTransformation(stem, dayMasterElement, dayMasterYinYang);
      }
    });

    // 結果を生成
    const result = {
      year: {
        stem: stemTransformMap[this.yearPillar.stem],
        branch: this.calculateBranchTransformation(this.yearPillar.branch, stemTransformMap)
      },
      month: {
        stem: stemTransformMap[this.monthPillar.stem],
        branch: this.calculateBranchTransformation(this.monthPillar.branch, stemTransformMap)
      },
      day: {
        stem: '日主',
        branch: this.calculateBranchTransformation(this.dayPillar.branch, stemTransformMap)
      },
      hour: {
        stem: stemTransformMap[this.hourPillar.stem],
        branch: this.calculateBranchTransformation(this.hourPillar.branch, stemTransformMap)
      }
    };

    return result;
  }

  /**
   * 天干の通変星を計算
   * @param {string} stem - 天干
   * @param {string} dayMasterElement - 日主の五行（事前計算用）
   * @param {string} dayMasterYinYang - 日主の陰陽（事前計算用）
   * @returns {string} 通変星
   */
  calculateStemTransformation(stem, dayMasterElement = null, dayMasterYinYang = null) {
    // 日主のプロパティが渡されていない場合は取得
    if (!dayMasterElement) dayMasterElement = STEM_TO_ELEMENT[this.dayMaster];
    if (!dayMasterYinYang) dayMasterYinYang = STEM_YIN_YANG[this.dayMaster];

    // ステムのプロパティを取得
    const stemElement = STEM_TO_ELEMENT[stem];
    const stemYinYang = STEM_YIN_YANG[stem];

    // 日主と同じ干の場合
    if (stem === this.dayMaster) {
      return '比肩';
    }

    // 五行判定をシンプル化（条件分岐を整理）

    // 五行が同じ場合
    if (dayMasterElement === stemElement) {
      return stemYinYang === dayMasterYinYang ? '比肩' : '劫財';
    }

    // 日主が生じる五行の場合
    if (GENERATING_CYCLE[dayMasterElement] === stemElement) {
      return stemYinYang === dayMasterYinYang ? '食神' : '傷官';
    }

    // 日主が抑制される五行の場合
    if (CONTROLLING_CYCLE[dayMasterElement] === stemElement) {
      return stemYinYang === dayMasterYinYang ? '偏財' : '正財';
    }

    // 日主を抑制する五行の場合
    if (CONTROLLING_CYCLE[stemElement] === dayMasterElement) {
      return stemYinYang === dayMasterYinYang ? '偏官' : '正官';
    }

    // 日主を生じる五行の場合
    if (GENERATING_CYCLE[stemElement] === dayMasterElement) {
      return stemYinYang === dayMasterYinYang ? '偏印' : '印綬';
    }

    // 何も該当しない場合（通常はここに来ない）
    return '未分類';
  }

  /**
   * 地支の通変星を計算（蔵干に基づく）
   * @param {string} branch - 地支
   * @param {Object} stemTransformMap - 事前計算された天干変換マップ
   * @returns {Object} 蔵干ごとの通変星と比率
   */
  calculateBranchTransformation(branch, stemTransformMap = null) {
    const result = {};
    const hiddenStems = HIDDEN_STEMS[branch];

    for (const [hiddenStem, percentage] of hiddenStems) {
      // 事前計算された変換マップがあればそれを使用
      const transformation = stemTransformMap && stemTransformMap[hiddenStem]
        ? stemTransformMap[hiddenStem]
        : this.calculateStemTransformation(hiddenStem);

      result[hiddenStem] = {
        transformation: transformation,
        percentage: percentage
      };
    }

    return result;
  }

  /**
   * 大運を計算
   * @param {number} count - 計算する大運の数
   * @returns {Array} 大運の配列
   */
  calculateMajorFortunes(count = 8) {
    // キャッシュキー（大運計算は高コスト）
    const cacheKey = `majorFortunes_${this.monthPillar.stem}_${this.monthPillar.branch}_${this.gender}_${count}`;

    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) return cachedResult;

    const result = [];

    // 月柱の干支
    const monthStem = this.monthPillar.stem;
    const monthBranch = this.monthPillar.branch;

    // 干支のインデックス
    const stemIndex = HEAVENLY_STEMS.indexOf(monthStem);
    const branchIndex = EARTHLY_BRANCHES.indexOf(monthBranch);

    // 変換マップを事前計算
    const transformationMap = {};
    HEAVENLY_STEMS.forEach(stem => {
      transformationMap[stem] = this.calculateStemTransformation(stem);
    });

    // 順行または逆行の決定
    // 男性で陽干または女性で陰干なら順行、それ以外なら逆行
    const forward = (this.gender === 'male' && STEM_YIN_YANG[monthStem] === '陽') ||
                    (this.gender === 'female' && STEM_YIN_YANG[monthStem] === '陰');

    const firstFortuneAge = this.calculateFirstFortuneAge();

    for (let i = 0; i < count; i++) {
      let newStemIndex, newBranchIndex;

      if (forward) {
        newStemIndex = (stemIndex + i) % 10;
        newBranchIndex = (branchIndex + i) % 12;
      } else {
        newStemIndex = (stemIndex - i + 10) % 10;
        newBranchIndex = (branchIndex - i + 12) % 12;
      }

      const newStem = HEAVENLY_STEMS[newStemIndex];
      const newBranch = EARTHLY_BRANCHES[newBranchIndex];

      result.push({
        stem: newStem,
        branch: newBranch,
        element: STEM_TO_ELEMENT[newStem],
        startAge: 10 * i + firstFortuneAge,
        transformation: {
          stem: transformationMap[newStem],
          branch: this.calculateBranchTransformation(newBranch, transformationMap)
        }
      });
    }

    addToCache(cacheKey, result);
    return result;
  }

  /**
   * 最初の大運の開始年齢を計算
   * @returns {number} 最初の大運開始年齢
   */
  calculateFirstFortuneAge() {
    // 実際の計算は複雑で、生まれた月の節気や性別に依存
    // 本実装では簡易計算を行うが、実際には節気表や立春など考慮が必要

    // 性別で分岐
    if (this.gender === 'male') {
      return 3; // 男性の場合は3歳から
    } else {
      return 4; // 女性の場合は4歳から
    }

    // 注: 実際には、生まれた日の節気から次の節気までの日数で計算する
    // 正確な実装には、節気表や太陽の黄経などの計算が必要
  }

  /**
   * 年運を計算
   * @param {number} year - 西暦年
   * @returns {Object} 年運
   */
  calculateAnnualFortune(year) {
    // キャッシュキー
    const cacheKey = `annualFortune_${year}_${this.dayMaster}`;

    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) return cachedResult;

    // 旧暦の年を取得（キャッシュ最適化済み）
    const lunarDate = convertToLunarDate(new Date(year, 0, 1));
    const lunarYear = lunarDate.year;

    // 年柱を計算
    const yearPillar = this.calculateYearPillar(lunarYear);

    // 変換マップを事前計算
    const transformationMap = {};
    HEAVENLY_STEMS.forEach(stem => {
      transformationMap[stem] = this.calculateStemTransformation(stem);
    });

    // 通変星を計算
    const transformation = {
      stem: transformationMap[yearPillar.stem],
      branch: this.calculateBranchTransformation(yearPillar.branch, transformationMap)
    };

    const result = {
      year: year,
      lunarYear: lunarYear,
      ...yearPillar,
      transformation: transformation
    };

    addToCache(cacheKey, result);
    return result;
  }

  /**
   * 命式の全情報を取得
   * @returns {Object} 命式の全情報
   */
  getFullChart() {
    return {
      birthDate: this.birthDate,
      lunarBirthDate: this.lunarBirthDate,
      yearPillar: this.yearPillar,
      monthPillar: this.monthPillar,
      dayPillar: this.dayPillar,
      hourPillar: this.hourPillar,
      dayMaster: this.dayMaster,
      dayMasterElement: STEM_TO_ELEMENT[this.dayMaster],
      fiveElementsBalance: this.fiveElementsBalance,
      transformations: this.transformations,
      majorFortunes: this.majorFortunes,
      gender: this.gender
    };
  }

  /**
   * 性別を設定
   * @param {string} gender - 'male'または'female'
   */
  setGender(gender) {
    if (gender !== 'male' && gender !== 'female') {
      throw new Error('性別は"male"または"female"で指定してください');
    }

    // 性別が変更された場合はキャッシュを更新
    if (this.gender !== gender) {
      this.gender = gender;
      // 大運を再計算
      this.majorFortunes = this.calculateMajorFortunes();

      // キャッシュ更新
      const cacheData = {
        yearPillar: this.yearPillar,
        monthPillar: this.monthPillar,
        dayPillar: this.dayPillar,
        hourPillar: this.hourPillar,
        dayMaster: this.dayMaster,
        fiveElementsBalance: this.fiveElementsBalance,
        transformations: this.transformations,
        majorFortunes: this.majorFortunes,
        lunarBirthDate: this.lunarBirthDate,
        gender: this.gender
      };

      // 新しいキャッシュキーを生成
      this.cacheKey = `${this.birthDate.toISOString()}_${this.useChineseTime}_${gender}`;
      addToCache(this.cacheKey, cacheData);
    }
  }
}

/**
 * キャッシュをクリア
 * @param {string} prefix - クリアするキーのプレフィックス（省略時は全クリア）
 */
function clearCache(prefix) {
  if (!prefix) {
    cache.clear();
    lunarDateCache.clear();
    console.log('全てのキャッシュをクリアしました');
    return;
  }

  // プレフィックスが一致するエントリだけ削除
  const cacheKeysToDelete = [];
  const lunarKeysToDelete = [];

  cache.forEach((value, key) => {
    if (key.startsWith(prefix)) {
      cacheKeysToDelete.push(key);
    }
  });

  lunarDateCache.forEach((value, key) => {
    if (key.startsWith(prefix)) {
      lunarKeysToDelete.push(key);
    }
  });

  cacheKeysToDelete.forEach(key => cache.delete(key));
  lunarKeysToDelete.forEach(key => lunarDateCache.delete(key));

  console.log(`プレフィックス "${prefix}" のキャッシュエントリ ${cacheKeysToDelete.length + lunarKeysToDelete.length} 件をクリアしました`);
}

/**
 * キャッシュの統計情報を取得
 * @returns {Object} キャッシュの統計情報
 */
function getCacheStats() {
  return {
    ...cacheStats,
    cacheSize: cache.size,
    lunarCacheSize: lunarDateCache.size,
    cacheHitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100 || 0,
    lunarHitRate: cacheStats.lunarHits / (cacheStats.lunarHits + cacheStats.lunarMisses) * 100 || 0
  };
}

/**
 * 日主（日柱の天干）を計算する
 * @param {Date} birthDate - 生年月日時のDateオブジェクト
 * @param {boolean} useChineseTime - 中国式の時間表記を使用するかどうか
 * @returns {string} 日主（日柱の天干）
 */
function calculateDayMaster(birthDate, useChineseTime = true) {
  const fourPillars = new FourPillars(birthDate, useChineseTime);
  return fourPillars.dayMaster;
}

/**
 * 年柱を計算する（オリジナル関数をエクスポート用）
 * @param {number} year - 旧暦の年
 * @returns {Object} 年柱の情報
 */
function originalCalculateYearPillar(year) {
  const sexagenaryIndex = (year - 4) % 60; // 甲子からの干支サイクル
  const stemIndex = (year - 4) % 10;
  const branchIndex = (year - 4) % 12;

  return {
    stem: HEAVENLY_STEMS[stemIndex],
    branch: EARTHLY_BRANCHES[branchIndex],
    element: STEM_TO_ELEMENT[HEAVENLY_STEMS[stemIndex]],
    branchElement: BRANCH_TO_ELEMENT[EARTHLY_BRANCHES[branchIndex]],
    hiddenStems: HIDDEN_STEMS[EARTHLY_BRANCHES[branchIndex]]
  };
}

/**
 * 月柱を計算する（オリジナル関数をエクスポート用）
 * @param {number} year - 旧暦の年
 * @param {number} month - 旧暦の月
 * @returns {Object} 月柱の情報
 */
function originalCalculateMonthPillar(year, month) {
  const yearStemIndex = (year - 4) % 10;
  const baseMonth = (month + 2) % 12 || 12; // 節気に基づく変換

  // 節気月の干支計算
  let monthStemIndex = (yearStemIndex * 2 + baseMonth) % 10;
  if (monthStemIndex === 0) monthStemIndex = 10;

  // 月の地支
  let monthBranchIndex = baseMonth - 1;
  if (monthBranchIndex < 0) monthBranchIndex = 11;

  return {
    stem: HEAVENLY_STEMS[monthStemIndex - 1],
    branch: EARTHLY_BRANCHES[monthBranchIndex],
    element: STEM_TO_ELEMENT[HEAVENLY_STEMS[monthStemIndex - 1]],
    branchElement: BRANCH_TO_ELEMENT[EARTHLY_BRANCHES[monthBranchIndex]],
    hiddenStems: HIDDEN_STEMS[EARTHLY_BRANCHES[monthBranchIndex]]
  };
}

/**
 * 日柱を計算する（オリジナル関数をエクスポート用）
 * @param {number} year - 西暦年
 * @param {number} month - 月(1-12)
 * @param {number} day - 日
 * @returns {Object} 日柱の情報
 */
function originalCalculateDayPillar(year, month, day) {
  // 基準日: 1900年1月1日は甲子
  const baseDate = new Date(1900, 0, 1);
  const targetDate = new Date(year, month - 1, day);

  // 日数差を計算
  const diffTime = targetDate.getTime() - baseDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // 干支サイクルに基づく計算
  const stemIndex = (diffDays % 10 + 10) % 10;
  const branchIndex = (diffDays % 12 + 12) % 12;

  return {
    stem: HEAVENLY_STEMS[stemIndex],
    branch: EARTHLY_BRANCHES[branchIndex],
    element: STEM_TO_ELEMENT[HEAVENLY_STEMS[stemIndex]],
    branchElement: BRANCH_TO_ELEMENT[EARTHLY_BRANCHES[branchIndex]],
    hiddenStems: HIDDEN_STEMS[EARTHLY_BRANCHES[branchIndex]]
  };
}

// エクスポート
module.exports = {
  FourPillars,
  convertToLunarDate,
  clearCache,
  getCacheStats,
  measurePerformance,
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  FIVE_ELEMENTS,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
  calculateDayMaster,
  originalCalculateYearPillar,
  originalCalculateMonthPillar,
  originalCalculateDayPillar
};