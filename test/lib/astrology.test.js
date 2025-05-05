/**
 * 西洋占星術ライブラリのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// astronomy-engineのモック
vi.mock('astronomy-engine', () => {
  return {
    // 惑星関連
    Sun: vi.fn().mockImplementation((date) => ({
      topocentricPosition: vi.fn().mockReturnValue({ lon: 30, lat: 0 }) // 牡牛座の0度
    })),
    Moon: vi.fn().mockImplementation((date) => ({
      topocentricPosition: vi.fn().mockReturnValue({ lon: 90, lat: 0 }) // 蟹座の0度
    })),
    Mercury: vi.fn().mockImplementation((date) => ({
      topocentricPosition: vi.fn().mockReturnValue({ lon: 60, lat: 0 }) // 双子座の0度
    })),
    Venus: vi.fn().mockImplementation((date) => ({
      topocentricPosition: vi.fn().mockReturnValue({ lon: 120, lat: 0 }) // 獅子座の0度
    })),
    Mars: vi.fn().mockImplementation((date) => ({
      topocentricPosition: vi.fn().mockReturnValue({ lon: 150, lat: 0 }) // 乙女座の0度
    })),
    Jupiter: vi.fn().mockImplementation((date) => ({
      topocentricPosition: vi.fn().mockReturnValue({ lon: 180, lat: 0 }) // 天秤座の0度
    })),
    Saturn: vi.fn().mockImplementation((date) => ({
      topocentricPosition: vi.fn().mockReturnValue({ lon: 210, lat: 0 }) // 蠍座の0度
    })),

    // ボディ定数
    Body: {
      Sun: 'Sun',
      Moon: 'Moon',
      Mercury: 'Mercury',
      Venus: 'Venus',
      Mars: 'Mars',
      Jupiter: 'Jupiter',
      Saturn: 'Saturn',
      Uranus: 'Uranus',
      Neptune: 'Neptune',
      Pluto: 'Pluto'
    },

    // 位置計算関連
    Observer: vi.fn().mockImplementation((latitude, longitude, height = 0) => ({
      latitude,
      longitude,
      height
    })),

    // 座標系変換
    Horizon: vi.fn().mockImplementation((date, observer, ra, dec) => ({
      azimuth: 180,
      altitude: 45
    })),

    Ecliptic: vi.fn().mockImplementation((date, ra, dec) => ({
      lon: 45, // 牡牛座の15度
      lat: 0
    })),

    // アセンダント計算
    Ascendant: vi.fn().mockImplementation((date, observer) => {
      // テスト用の固定値を返す
      return 15; // 牡羊座の15度
    }),

    // 時間オブジェクト作成
    MakeTime: vi.fn().mockImplementation((year, month, day, hour = 0) => ({
      year,
      month,
      day,
      hour,
      ut: new Date(year, month - 1, day, hour).getTime() / 1000,
      tt: 2459000.5 + (new Date(year, month - 1, day, hour).getTime() - new Date(2020, 0, 1).getTime()) / (1000 * 86400)
    })),

    // 追加機能
    SearchRiseSet: vi.fn().mockImplementation((body, observer, direction, startDate, limitDays) => ({
      date: new Date(startDate.ut + 12 * 3600) // 常に12時間後を返す
    })),

    NextPlanetApsis: vi.fn().mockImplementation((body, startDate) => ({
      time: { ut: startDate.ut + 30 * 86400 }, // 常に30日後を返す
      kind: 'perihelion' // 近日点
    })),

    SearchLunarEclipse: vi.fn().mockImplementation((startDate) => ({
      peak: { ut: startDate.ut + 15 * 86400 }, // 常に15日後を返す
      kind: 'partial' // 部分月食
    })),

    SearchSolarEclipse: vi.fn().mockImplementation((startDate) => ({
      peak: { ut: startDate.ut + 15 * 86400 }, // 常に15日後を返す
      kind: 'partial' // 部分日食
    }))
  };
});

// astrology.jsのインポート
import {
  getSunSign,
  calculateAscendant,
  getZodiacSignFromLongitude,
  getZodiacSign,
  calculatePlanetPositions
} from '../../lib/astrology.js';

describe('西洋占星術ライブラリ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getSunSign関数', () => {
    it('正確な太陽星座を返す - 牡羊座', () => {
      const result = getSunSign(3, 25); // 3月25日
      expect(result.name).toBe('牡羊座');
      expect(result.symbol).toBe('♈');
      expect(result.element).toBe('火');
    });

    it('正確な太陽星座を返す - 蟹座', () => {
      const result = getSunSign(7, 10); // 7月10日
      expect(result.name).toBe('蟹座');
      expect(result.symbol).toBe('♋');
      expect(result.element).toBe('水');
    });

    it('境界日の処理が正しい - 山羊座/水瓶座の境界', () => {
      const capricorn = getSunSign(1, 19); // 1月19日 - 山羊座の最終日
      expect(capricorn.name).toBe('山羊座');

      const aquarius = getSunSign(1, 20); // 1月20日 - 水瓶座の最初の日
      expect(aquarius.name).toBe('水瓶座');
    });
  });

  describe('getZodiacSignFromLongitude関数', () => {
    it('黄道度数から正しい星座を返す - 0度（牡羊座）', () => {
      const result = getZodiacSignFromLongitude(0);
      expect(result.name).toBe('牡羊座');
      expect(result.position).toBe(0); // 牡羊座の0度
    });

    it('黄道度数から正しい星座を返す - 45度（牡牛座）', () => {
      const result = getZodiacSignFromLongitude(45);
      expect(result.name).toBe('牡牛座');
      expect(result.position).toBe(15); // 牡牛座の15度
    });

    it('黄道度数から正しい星座を返す - 359度（魚座）', () => {
      const result = getZodiacSignFromLongitude(359);
      expect(result.name).toBe('魚座');
      expect(result.position).toBe(29); // 魚座の29度
    });

    it('360度を超える度数を正しく処理する', () => {
      const result = getZodiacSignFromLongitude(380);
      expect(result.name).toBe('牡牛座');
      expect(result.position).toBe(20); // 380度 = 360度 + 20度 = 牡牛座の20度
    });

    it('負の度数を正しく処理する', () => {
      const result = getZodiacSignFromLongitude(-30);
      expect(result.name).toBe('魚座');
      expect(result.position).toBe(0); // -30度 = 360度 - 30度 = 魚座の0度
    });
  });

  describe('getZodiacSign関数', () => {
    it('getZodiacSignFromLongitudeの別名として正しく動作する', () => {
      // 同じ入力に対して両方の関数が同じ結果を返すかテスト
      const longitude = 123.45;
      const result1 = getZodiacSignFromLongitude(longitude);
      const result2 = getZodiacSign(longitude);

      expect(result2).toEqual(result1);
    });
  });
});