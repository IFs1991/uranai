import { describe, it, expect } from 'vitest';

// 仮のユーティリティ関数 (src/js/utils.js からインポートすることを想定)
const Utils = {
  // 例: 日付フォーマット関数 (実際の utils.js の実装に合わせる)
  formatDate: (date) => {
    if (!date || !(date instanceof Date)) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },
  // 例: 文字列を安全にエスケープする関数 (仮)
  escapeHtml: (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"/]/g, (match) => {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        };
        return escapeMap[match];
    });
  }
};

// テストスイート
describe('Utils', () => {
  // formatDate 関数のテスト
  describe('formatDate', () => {
    it('should format date object correctly', () => {
      const date = new Date(2024, 3, 2); // 2024年4月2日 (月は0始まり)
      expect(Utils.formatDate(date)).toBe('2024-04-02');
    });

    it('should return empty string for invalid input', () => {
      expect(Utils.formatDate(null)).toBe('');
      expect(Utils.formatDate(undefined)).toBe('');
      expect(Utils.formatDate('2024-04-02')).toBe('');
    });
  });

  // escapeHtml 関数のテスト
  describe('escapeHtml', () => {
    it('should escape special HTML characters', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;';
      expect(Utils.escapeHtml(input)).toBe(expected);
    });

    it('should return empty string for non-string input', () => {
      expect(Utils.escapeHtml(123)).toBe('');
      expect(Utils.escapeHtml(null)).toBe('');
      expect(Utils.escapeHtml({})).toBe('');
    });

    it('should not change string without special characters', () => {
      const input = 'Hello World';
      expect(Utils.escapeHtml(input)).toBe(input);
    });
  });
});