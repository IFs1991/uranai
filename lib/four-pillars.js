/**
 * 四柱推命計算ライブラリ
 * 生年月日時から四柱推命の命式を計算するためのライブラリ
 */

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

// 干支のサイクル（60干支）
const SEXAGENARY_CYCLE = [];
for (let i = 0; i < 60; i++) {
  const stemIndex = i % 10;
  const branchIndex = i % 12;
  SEXAGENARY_CYCLE.push(HEAVENLY_STEMS[stemIndex] + EARTHLY_BRANCHES[branchIndex]);
}

// キャッシュオブジェクト
const cache = new Map();

/**
 * 四柱推命計算クラス
 */
class FourPillars {
  /**
   * コンストラクタ
   * @param {Date} birthDate - 生年月日時のDateオブジェクト
   * @param {boolean} useChineseTime - 中国式の時間表記を使用するかどうか
   */
  constructor(birthDate, useChineseTime = true) {
    this.birthDate = new Date(birthDate);
    this.useChineseTime = useChineseTime;
    this.cacheKey = this.birthDate.toISOString() + useChineseTime;
    
    // キャッシュが存在する場合はそれを使用
    if (cache.has(this.cacheKey)) {
      const cachedResult = cache.get(this.cacheKey);
      Object.assign(this, cachedResult);
      return;
    }
    
    // 命式の計算
    this.calculatePillars();
  }
  
  /**
   * 四柱（年柱、月柱、日柱、時柱）を計算
   */
  calculatePillars() {
    const year = this.birthDate.getFullYear();
    const month = this.birthDate.getMonth() + 1; // JavaScript月は0始まり
    const day = this.birthDate.getDate();
    const hour = this.birthDate.getHours();
    
    // 四柱の計算
    this.yearPillar = this.calculateYearPillar(year);
    this.monthPillar = this.calculateMonthPillar(year, month);
    this.dayPillar = this.calculateDayPillar(year, month, day);
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
    cache.set(this.cacheKey, {
      yearPillar: this.yearPillar,
      monthPillar: this.monthPillar,
      dayPillar: this.dayPillar,
      hourPillar: this.hourPillar,
      dayMaster: this.dayMaster,
      fiveElementsBalance: this.fiveElementsBalance,
      transformations: this.transformations,
      majorFortunes: this.majorFortunes
    });
  }
  
  /**
   * 年柱を計算
   * @param {number} year - 西暦年
   * @returns {Object} 年柱（天干と地支）
   */
  calculateYearPillar(year) {
    // 1864年は甲子年（干支のサイクルの基準年）
    const baseYear = 1864;
    const yearOffset = (year - baseYear) % 60;
    const stemIndex = yearOffset % 10;
    const branchIndex = yearOffset % 12;
    
    return {
      stem: HEAVENLY_STEMS[stemIndex],
      branch: EARTHLY_BRANCHES[branchIndex],
      element: STEM_TO_ELEMENT[HEAVENLY_STEMS[stemIndex]],
      hiddenStems: HIDDEN_STEMS[EARTHLY_BRANCHES[branchIndex]]
    };
  }
  
  /**
   * 月柱を計算
   * @param {number} year - 西暦年
   * @param {number} month - 月（1-12）
   * @returns {Object} 月柱（天干と地支）
   */
  calculateMonthPillar(year, month) {
    // 年柱の天干に基づく月の天干の基準値
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
    
    // 月の地支
    // 寅月（立春前後）から始まる
    const branchIndex = (month + 1) % 12;
    const branch = EARTHLY_BRANCHES[branchIndex];
    
    // 月の天干
    const baseIndex = stemBaseIndex[yearStem];
    const stemIndex = (baseIndex + month - 1) % 10;
    const stem = HEAVENLY_STEMS[stemIndex];
    
    return {
      stem: stem,
      branch: branch,
      element: STEM_TO_ELEMENT[stem],
      hiddenStems: HIDDEN_STEMS[branch]
    };
  }
  
  /**
   * 日柱を計算
   * @param {number} year - 西暦年
   * @param {number} month - 月（1-12）
   * @param {number} day - 日
   * @returns {Object} 日柱（天干と地支）
   */
  calculateDayPillar(year, month, day) {
    // 1900年1月1日は庚子日
    const baseDate = new Date(1900, 0, 1); // JavaScript月は0始まり
    const targetDate = new Date(year, month - 1, day);
    
    // 日数差を計算
    const diffTime = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // 日の天干と地支のインデックスを計算
    const stemIndex = (diffDays + 9) % 10; // 1900/1/1は庚（9番目の天干）
    const branchIndex = (diffDays + 1) % 12; // 1900/1/1は子（1番目の地支）
    
    const stem = HEAVENLY_STEMS[stemIndex];
    const branch = EARTHLY_BRANCHES[branchIndex];
    
    return {
      stem: stem,
      branch: branch,
      element: STEM_TO_ELEMENT[stem],
      hiddenStems: HIDDEN_STEMS[branch]
    };
  }
  
  /**
   * 時柱を計算
   * @param {string} dayStem - 日柱の天干
   * @param {number} hour - 時間（0-23）
   * @returns {Object} 時柱（天干と地支）
   */
  calculateHourPillar(dayStem, hour) {
    // 時間から地支を決定
    let branchIndex;
    if (this.useChineseTime) {
      // 中国式時間区分（子の刻は23時〜1時、丑の刻は1時〜3時、...）
      branchIndex = Math.floor((hour + 1) / 2) % 12;
    } else {
      // 単純に時間から地支を決定（0時は子、2時は丑、...）
      branchIndex = Math.floor(hour / 2) % 12;
    }
    
    const branch = EARTHLY_BRANCHES[branchIndex];
    
    // 日の天干から時間の天干を決定
    // 日干と時干の関係表（日干が甲/己なら子刻は甲、丑刻は乙、...）
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
    
    return {
      stem: stem,
      branch: branch,
      element: STEM_TO_ELEMENT[stem],
      hiddenStems: HIDDEN_STEMS[branch]
    };
  }
  
  /**
   * 五行バランスを計算
   * @returns {Object} 五行ごとの強さを表すオブジェクト
   */
  calculateFiveElementsBalance() {
    const balance = {
      '木': 0, '火': 0, '土': 0, '金': 0, '水': 0
    };
    
    // 天干の五行を加算
    const pillars = [this.yearPillar, this.monthPillar, this.dayPillar, this.hourPillar];
    for (const pillar of pillars) {
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
    const result = {
      year: this.calculatePillarTransformation(this.yearPillar),
      month: this.calculatePillarTransformation(this.monthPillar),
      day: { stem: '日主', branch: this.calculateBranchTransformation(this.dayPillar.branch) },
      hour: this.calculatePillarTransformation(this.hourPillar)
    };
    
    return result;
  }
  
  /**
   * 柱の通変星を計算
   * @param {Object} pillar - 柱（天干と地支）
   * @returns {Object} 柱の天干と地支の通変星
   */
  calculatePillarTransformation(pillar) {
    return {
      stem: this.calculateStemTransformation(pillar.stem),
      branch: this.calculateBranchTransformation(pillar.branch)
    };
  }
  
  /**
   * 天干の通変星を計算
   * @param {string} stem - 天干
   * @returns {string} 通変星
   */
  calculateStemTransformation(stem) {
    const dayMasterElement = STEM_TO_ELEMENT[this.dayMaster];
    const stemElement = STEM_TO_ELEMENT[stem];
    const dayMasterYinYang = STEM_YIN_YANG[this.dayMaster];
    const stemYinYang = STEM_YIN_YANG[stem];
    
    // 日主と同じ干の場合
    if (stem === this.dayMaster) {
      return '比肩';
    }
    
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
   * @returns {Object} 蔵干ごとの通変星と比率
   */
  calculateBranchTransformation(branch) {
    const result = {};
    const hiddenStems = HIDDEN_STEMS[branch];
    
    for (const [hiddenStem, percentage] of hiddenStems) {
      result[hiddenStem] = {
        transformation: this.calculateStemTransformation(hiddenStem),
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
    const result = [];
    const gender = this.getGender(); // 性別の判定が必要
    
    // 月柱の干支
    const monthStem = this.monthPillar.stem;
    const monthBranch = this.monthPillar.branch;
    
    // 干支のインデックス
    const stemIndex = HEAVENLY_STEMS.indexOf(monthStem);
    const branchIndex = EARTHLY_BRANCHES.indexOf(monthBranch);
    
    // 順行または逆行の決定
    // 男性で陽干または女性で陰干なら順行、それ以外なら逆行
    const forward = (gender === 'male' && STEM_YIN_YANG[monthStem] === '陽') ||
                   (gender === 'female' && STEM_YIN_YANG[monthStem] === '陰');
    
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
        startAge: 10 * i + this.calculateFirstFortuneAge(),
        transformation: {
          stem: this.calculateStemTransformation(newStem),
          branch: this.calculateBranchTransformation(newBranch)
        }
      });
    }
    
    return result;
  }
  
  /**
   * 最初の大運の開始年齢を計算
   * @returns {number} 最初の大運開始年齢
   */
  calculateFirstFortuneAge() {
    // 実際の計算は複雑で、生まれた月の節気に依存します
    // ここでは簡略化して固定値を返しています
    return 3; // 通常、3歳か8歳ほどから始まることが多い
  }
  
  /**
   * 性別を取得（実際の実装では別途設定が必要）
   * @returns {string} 'male'または'female'
   */
  getGender() {
    // このメソッドは別途性別情報を設定する必要があります
    // ここではダミーとして'male'を返します
    return 'male';
  }
  
  /**
   * 年運を計算
   * @param {number} year - 西暦年
   * @returns {Object} 年運
   */
  calculateAnnualFortune(year) {
    // 年柱を計算
    const yearPillar = this.calculateYearPillar(year);
    
    // 通変星を計算
    const transformation = {
      stem: this.calculateStemTransformation(yearPillar.stem),
      branch: this.calculateBranchTransformation(yearPillar.branch)
    };
    
    return {
      year: year,
      ...yearPillar,
      transformation: transformation
    };
  }
  
  /**
   * 命式の全情報を取得
   * @returns {Object} 命式の全情報
   */
  getFullChart() {
    return {
      birthDate: this.birthDate,
      yearPillar: this.yearPillar,
      monthPillar: this.monthPillar,
      dayPillar: this.dayPillar,
      hourPillar: this.hourPillar,
      dayMaster: this.dayMaster,
      dayMasterElement: STEM_TO_ELEMENT[this.dayMaster],
      fiveElementsBalance: this.fiveElementsBalance,
      transformations: this.transformations,
      majorFortunes: this.majorFortunes
    };
  }
}

// エクスポート
module.exports = FourPillars;