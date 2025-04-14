/**
 * 占星術計算ライブラリのテスト
 */
import { describe, it, expect, vi } from 'vitest';
import {
  calculatePlanetPositions,
  getZodiacSign,
  calculateHouses,
  interpretAspects,
  generateNatalChart
} from '../../lib/astrology';

// 天文計算ライブラリのモック
vi.mock('astronomy-engine', () => ({
  Sun: vi.fn(),
  Moon: vi.fn(),
  Mercury: vi.fn(),
  Venus: vi.fn(),
  Mars: vi.fn(),
  Jupiter: vi.fn(),
  Saturn: vi.fn(),
  Uranus: vi.fn(),
  Neptune: vi.fn(),
  Pluto: vi.fn(),
  Equator: vi.fn(),
  Ecliptic: vi.fn(),
  Observer: vi.fn(),
  Horizon: vi.fn(),
  CalcMoon: vi.fn(),
  SearchMoonPhase: vi.fn(),
}));

describe('astrology.js - 占星術計算ライブラリ', () => {
  describe('calculatePlanetPositions', () => {
    it('正常系: 日時から惑星位置を正確に計算する', () => {
      // モックの設定
      const mockPositions = {
        sun: { longitude: 30.5, latitude: 0, distance: 1.0 },
        moon: { longitude: 215.3, latitude: 5.1, distance: 0.002 },
        mercury: { longitude: 45.2, latitude: 1.2, distance: 0.8 },
        venus: { longitude: 78.9, latitude: 2.3, distance: 0.7 },
        mars: { longitude: 120.5, latitude: 1.7, distance: 1.5 },
        jupiter: { longitude: 210.3, latitude: 1.3, distance: 5.2 },
        saturn: { longitude: 270.1, latitude: 2.1, distance: 9.5 },
        uranus: { longitude: 320.7, latitude: 0.7, distance: 19.2 },
        neptune: { longitude: 345.6, latitude: 1.3, distance: 30.1 },
        pluto: { longitude: 290.2, latitude: 17.1, distance: 39.5 }
      };

      // 天文エンジンの関数をモック
      const mockSunFunc = vi.fn().mockReturnValue(mockPositions.sun);
      const mockMoonFunc = vi.fn().mockReturnValue(mockPositions.moon);
      const mockMercuryFunc = vi.fn().mockReturnValue(mockPositions.mercury);
      const mockVenusFunc = vi.fn().mockReturnValue(mockPositions.venus);
      const mockMarsFunc = vi.fn().mockReturnValue(mockPositions.mars);
      const mockJupiterFunc = vi.fn().mockReturnValue(mockPositions.jupiter);
      const mockSaturnFunc = vi.fn().mockReturnValue(mockPositions.saturn);
      const mockUranusFunc = vi.fn().mockReturnValue(mockPositions.uranus);
      const mockNeptuneFunc = vi.fn().mockReturnValue(mockPositions.neptune);
      const mockPlutoFunc = vi.fn().mockReturnValue(mockPositions.pluto);

      require('astronomy-engine').Sun.mockImplementation(() => mockSunFunc);
      require('astronomy-engine').Moon.mockImplementation(() => mockMoonFunc);
      require('astronomy-engine').Mercury.mockImplementation(() => mockMercuryFunc);
      require('astronomy-engine').Venus.mockImplementation(() => mockVenusFunc);
      require('astronomy-engine').Mars.mockImplementation(() => mockMarsFunc);
      require('astronomy-engine').Jupiter.mockImplementation(() => mockJupiterFunc);
      require('astronomy-engine').Saturn.mockImplementation(() => mockSaturnFunc);
      require('astronomy-engine').Uranus.mockImplementation(() => mockUranusFunc);
      require('astronomy-engine').Neptune.mockImplementation(() => mockNeptuneFunc);
      require('astronomy-engine').Pluto.mockImplementation(() => mockPlutoFunc);

      // テスト用のパラメータ
      const birthDate = new Date('1990-04-15T12:30:00Z');
      const coordinates = { latitude: 35.6895, longitude: 139.6917 }; // 東京の座標

      // テスト対象の関数を実行
      const result = calculatePlanetPositions(birthDate, coordinates);

      // 結果の検証
      expect(result).toEqual(mockPositions);

      // 各惑星計算関数が適切に呼び出されたことを検証
      expect(mockSunFunc).toHaveBeenCalledWith(birthDate, coordinates);
      expect(mockMoonFunc).toHaveBeenCalledWith(birthDate, coordinates);
      expect(mockMercuryFunc).toHaveBeenCalledWith(birthDate, coordinates);
      expect(mockVenusFunc).toHaveBeenCalledWith(birthDate, coordinates);
      expect(mockMarsFunc).toHaveBeenCalledWith(birthDate, coordinates);
      expect(mockJupiterFunc).toHaveBeenCalledWith(birthDate, coordinates);
      expect(mockSaturnFunc).toHaveBeenCalledWith(birthDate, coordinates);
      expect(mockUranusFunc).toHaveBeenCalledWith(birthDate, coordinates);
      expect(mockNeptuneFunc).toHaveBeenCalledWith(birthDate, coordinates);
      expect(mockPlutoFunc).toHaveBeenCalledWith(birthDate, coordinates);
    });

    it('エラー処理: 無効な日付の場合はエラーをスローする', () => {
      // 無効な日付
      const invalidDate = 'invalid-date';
      const coordinates = { latitude: 35.6895, longitude: 139.6917 };

      // エラーをスローすることを検証
      expect(() => calculatePlanetPositions(invalidDate, coordinates))
        .toThrow('有効な日付を指定してください');
    });
  });

  describe('getZodiacSign', () => {
    it('正常系: 黄経から正しい星座を返す', () => {
      // 各星座の黄経の境界値をテスト
      const testCases = [
        { longitude: 15, expected: '牡羊座' },
        { longitude: 45, expected: '牡牛座' },
        { longitude: 75, expected: '双子座' },
        { longitude: 105, expected: '蟹座' },
        { longitude: 135, expected: '獅子座' },
        { longitude: 165, expected: '乙女座' },
        { longitude: 195, expected: '天秤座' },
        { longitude: 225, expected: '蠍座' },
        { longitude: 255, expected: '射手座' },
        { longitude: 285, expected: '山羊座' },
        { longitude: 315, expected: '水瓶座' },
        { longitude: 345, expected: '魚座' },
        { longitude: 359.9, expected: '魚座' },
        { longitude: 0, expected: '牡羊座' },
        { longitude: 30, expected: '牡牛座' }
      ];

      // 各テストケースを実行
      testCases.forEach(testCase => {
        const result = getZodiacSign(testCase.longitude);
        expect(result).toBe(testCase.expected);
      });
    });

    it('エラー処理: 範囲外の黄経の場合は正規化して計算する', () => {
      // 360度を超える黄経
      expect(getZodiacSign(380)).toBe('牡牛座'); // 380 % 360 = 20 -> 牡羊座

      // 負の黄経
      expect(getZodiacSign(-10)).toBe('魚座'); // -10 + 360 = 350 -> 魚座

      // 非常に大きな値や小さな値
      expect(getZodiacSign(1080)).toBe('牡牛座'); // 1080 % 360 = 0 -> 牡羊座
      expect(getZodiacSign(-370)).toBe('魚座'); // -370 + 720 = 350 -> 魚座
    });
  });

  describe('calculateHouses', () => {
    it('正常系: 出生日時と場所からハウスを正確に計算する', () => {
      // モックの設定
      const mockHouses = [
        { startLongitude: 0, endLongitude: 30, houseNumber: 1 },
        { startLongitude: 30, endLongitude: 60, houseNumber: 2 },
        { startLongitude: 60, endLongitude: 90, houseNumber: 3 },
        { startLongitude: 90, endLongitude: 120, houseNumber: 4 },
        { startLongitude: 120, endLongitude: 150, houseNumber: 5 },
        { startLongitude: 150, endLongitude: 180, houseNumber: 6 },
        { startLongitude: 180, endLongitude: 210, houseNumber: 7 },
        { startLongitude: 210, endLongitude: 240, houseNumber: 8 },
        { startLongitude: 240, endLongitude: 270, houseNumber: 9 },
        { startLongitude: 270, endLongitude: 300, houseNumber: 10 },
        { startLongitude: 300, endLongitude: 330, houseNumber: 11 },
        { startLongitude: 330, endLongitude: 360, houseNumber: 12 }
      ];

      // 天文エンジンのモック関数
      const mockObserver = vi.fn();
      const mockHorizon = vi.fn();
      require('astronomy-engine').Observer.mockImplementation(() => mockObserver);
      require('astronomy-engine').Horizon.mockImplementation(() => mockHorizon);

      // テスト用のパラメータ
      const birthDate = new Date('1990-04-15T12:30:00Z');
      const coordinates = { latitude: 35.6895, longitude: 139.6917 }; // 東京

      // テスト対象の関数をモック
      vi.spyOn(global.Math, 'random').mockReturnValue(0.5); // 乱数を固定

      // 内部関数をモック（実装に応じて調整が必要かも）
      const originalCalculateHouses = calculateHouses;
      const mockedCalculateHouses = vi.fn().mockReturnValue(mockHouses);
      global.calculateHouses = mockedCalculateHouses;

      // テスト実行
      const result = originalCalculateHouses(birthDate, coordinates);

      // 結果の検証
      expect(result).toEqual(mockHouses);

      // モック関数の後片付け
      global.calculateHouses = originalCalculateHouses;
      vi.spyOn(global.Math, 'random').mockRestore();
    });
  });

  describe('interpretAspects', () => {
    it('正常系: 惑星間のアスペクトを正確に解釈する', () => {
      // モックの設定 - 惑星位置
      const planetPositions = {
        sun: { longitude: 30 },
        moon: { longitude: 120 },
        mercury: { longitude: 35 },
        venus: { longitude: 90 },
        mars: { longitude: 210 }
      };

      // 期待される結果 - アスペクト解釈
      const expectedAspects = [
        { aspect: 'トライン', planet1: 'sun', planet2: 'moon', angle: 90, orb: 0, interpretation: '調和的なエネルギーがあります' },
        { aspect: 'コンジャンクション', planet1: 'sun', planet2: 'mercury', angle: 5, orb: 0, interpretation: '強い結合力があります' },
        { aspect: 'スクエア', planet1: 'sun', planet2: 'venus', angle: 60, orb: 0, interpretation: '緊張感があります' },
        { aspect: 'オポジション', planet1: 'sun', planet2: 'mars', angle: 180, orb: 0, interpretation: '対立するエネルギーがあります' }
      ];

      // 内部関数をモック
      const originalInterpretAspects = interpretAspects;
      const mockedInterpretAspects = vi.fn().mockReturnValue(expectedAspects);
      global.interpretAspects = mockedInterpretAspects;

      // テスト実行
      const result = originalInterpretAspects(planetPositions);

      // 結果の検証
      expect(result).toEqual(expectedAspects);

      // モック関数の後片付け
      global.interpretAspects = originalInterpretAspects;
    });
  });

  describe('generateNatalChart', () => {
    it('正常系: 正確なネイタルチャートを生成する', () => {
      // モックの設定
      const mockPlanetPositions = {
        sun: { longitude: 30, latitude: 0, distance: 1.0 },
        moon: { longitude: 120, latitude: 5.1, distance: 0.002 }
      };

      const mockHouses = [
        { startLongitude: 0, endLongitude: 30, houseNumber: 1 },
        { startLongitude: 30, endLongitude: 60, houseNumber: 2 }
      ];

      const mockAspects = [
        { aspect: 'トライン', planet1: 'sun', planet2: 'moon', angle: 90, orb: 0, interpretation: '調和的なエネルギーがあります' }
      ];

      // 内部関数をモック
      vi.spyOn(global, 'calculatePlanetPositions').mockReturnValue(mockPlanetPositions);
      vi.spyOn(global, 'calculateHouses').mockReturnValue(mockHouses);
      vi.spyOn(global, 'interpretAspects').mockReturnValue(mockAspects);

      // テスト用のパラメータ
      const birthDate = new Date('1990-04-15T12:30:00Z');
      const birthPlace = { latitude: 35.6895, longitude: 139.6917 }; // 東京

      // 期待される結果
      const expectedChart = {
        planets: mockPlanetPositions,
        houses: mockHouses,
        aspects: mockAspects,
        ascendant: expect.any(Number),
        midheaven: expect.any(Number),
        birthData: {
          date: birthDate,
          place: birthPlace
        }
      };

      // テスト実行
      const result = generateNatalChart(birthDate, birthPlace);

      // 結果の検証
      expect(result).toMatchObject(expectedChart);

      // 各モック関数が適切に呼び出されたことを検証
      expect(global.calculatePlanetPositions).toHaveBeenCalledWith(birthDate, birthPlace);
      expect(global.calculateHouses).toHaveBeenCalledWith(birthDate, birthPlace);
      expect(global.interpretAspects).toHaveBeenCalledWith(mockPlanetPositions);
    });

    it('エラー処理: 無効な入力の場合はエラーをスローする', () => {
      // 無効な日付
      const invalidDate = 'invalid-date';
      const validPlace = { latitude: 35.6895, longitude: 139.6917 };

      // エラーをスローすることを検証
      expect(() => generateNatalChart(invalidDate, validPlace))
        .toThrow('有効な日付を指定してください');

      // 無効な場所（緯度がない）
      const validDate = new Date('1990-04-15T12:30:00Z');
      const invalidPlace = { longitude: 139.6917 };

      expect(() => generateNatalChart(validDate, invalidPlace))
        .toThrow('有効な出生地を指定してください');
    });
  });
});