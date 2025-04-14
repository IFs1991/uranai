import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PaymentController from '../js/payment';
import {
  VALID_TEST_CARDS,
  TOKEN_ERROR_CARDS,
  PAYMENT_ERROR_CARDS,
  SPECIAL_STATUS_CARDS
} from './payjp-test-cards';

// モックの設定
vi.mock('../js/utils', () => ({
  default: {
    // ユーティリティ関数のモック
  }
}));

vi.mock('../api/generate-pdf', () => ({
  default: vi.fn()
}));

// DOM操作のモック
document.createElement = vi.fn().mockImplementation((tag) => {
  const element = {
    appendChild: vi.fn(),
    addEventListener: vi.fn(),
    classList: {
      add: vi.fn(),
      remove: vi.fn()
    },
    querySelector: vi.fn().mockReturnValue({
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      },
      querySelector: vi.fn().mockReturnValue({
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        }
      })
    }),
    querySelectorAll: vi.fn().mockReturnValue([]),
    scrollIntoView: vi.fn(),
    remove: vi.fn(),
    reset: vi.fn(),
    // innerHTML設定用の特殊処理
    set innerHTML(value) {
      this._innerHTML = value;
    },
    get innerHTML() {
      return this._innerHTML || '';
    }
  };

  // scriptタグの場合、onloadイベントを追加
  if (tag === 'script') {
    setTimeout(() => {
      if (element.onload) element.onload();
    }, 10);
  }

  return element;
});

document.body = {
  appendChild: vi.fn(),
  classList: {
    add: vi.fn(),
    remove: vi.fn()
  }
};

document.getElementById = vi.fn().mockImplementation((id) => {
  return {
    innerHTML: '',
    querySelector: vi.fn().mockReturnValue({
      addEventListener: vi.fn()
    }),
    remove: vi.fn()
  };
});

// Pay.jpのSDKモック
global.Payjp = vi.fn().mockImplementation(() => {
  return {
    elements: vi.fn().mockReturnValue({
      create: vi.fn().mockReturnValue({
        mount: vi.fn(),
        on: vi.fn()
      })
    }),
    createToken: vi.fn().mockResolvedValue({
      id: `tok_${VALID_TEST_CARDS.VISA_1.number.substring(0, 6)}`
    })
  };
});

// fetch APIのモック
global.fetch = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      success: true,
      paymentId: 'pay_test_123',
      message: '決済が完了しました。PDF生成を開始します。'
    })
  });
});

describe('PaymentController', () => {
  let controller;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = PaymentController;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('初期化が正常に完了すること', async () => {
      document.addEventListener = vi.fn();

      await controller.init();

      expect(document.addEventListener).toHaveBeenCalled();
    });
  });

  describe('showPaymentForm', () => {
    it('支払いフォームが表示されること', async () => {
      // テスト用データ
      const formData = {
        name: 'テストユーザー',
        email: 'test@example.com',
        birthDate: '1990-01-01'
      };
      const resultData = { /* 占い結果データ */ };

      // 初期化（showPaymentFormを呼ぶ前にinitを呼ぶのが正しい流れ）
      await controller.init();

      // モック関数のスパイ
      const createModalSpy = vi.spyOn(document, 'createElement');

      // 支払いフォーム表示
      controller.showPaymentForm(formData, resultData);

      // モーダル作成が呼ばれたことを確認
      expect(createModalSpy).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
    });
  });

  describe('handlePaymentSubmit', () => {
    it('支払い処理が正常に実行されること', async () => {
      // 初期化
      await controller.init();

      // フォームデータとモックイベント
      const formData = {
        name: 'テストユーザー',
        email: 'test@example.com',
        birthDate: '1990-01-01'
      };
      const event = {
        preventDefault: vi.fn()
      };

      // 支払いフォーム表示
      controller.showPaymentForm(formData, {});

      // 成功するテストカードを使用
      const successCard = VALID_TEST_CARDS.VISA_1;
      // Pay.jpのモック
      global.Payjp().createToken.mockResolvedValueOnce({
        id: `tok_${successCard.number.substring(0, 6)}`
      });

      // fetchのモック
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          paymentId: 'pay_test_success',
          message: '決済が完了しました'
        })
      });

      // イベントハンドラを直接取得して実行（private関数なので工夫が必要）
      const form = document.createElement('form');
      const submitHandler = form.addEventListener.mock.calls[0][1];

      // イベントハンドラ実行（submitHandlerはhandlePaymentSubmit関数）
      await submitHandler(event);

      // アサーション
      expect(event.preventDefault).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith('/api/process-payment', expect.any(Object));
    });

    it('トークン作成時のカードエラーが適切に処理されること', async () => {
      // 初期化
      await controller.init();

      // フォームデータとモックイベント
      const formData = {
        name: 'テストユーザー',
        email: 'test@example.com',
        birthDate: '1990-01-01'
      };
      const event = {
        preventDefault: vi.fn()
      };

      // 支払いフォーム表示
      controller.showPaymentForm(formData, {});

      // エラーになるテストカードを使用
      const errorCard = TOKEN_ERROR_CARDS.INVALID_CVC;
      // Pay.jpのトークン化エラーをモック
      global.Payjp().createToken.mockResolvedValueOnce({
        error: {
          message: 'セキュリティコードが不正です',
          code: errorCard.error_code
        }
      });

      // イベントハンドラを直接取得して実行
      const form = document.createElement('form');
      const submitHandler = form.addEventListener.mock.calls[0][1];

      // コンソールエラーをスパイ
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // イベントハンドラ実行
      await submitHandler(event);

      // アサーション
      expect(event.preventDefault).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled(); // エラーの場合はfetchされない
    });

    it('与信枠超過エラーが適切に処理されること', async () => {
      // 初期化
      await controller.init();

      // フォームデータとモックイベント
      const formData = {
        name: 'テストユーザー',
        email: 'test@example.com',
        birthDate: '1990-01-01'
      };
      const event = {
        preventDefault: vi.fn()
      };

      // 支払いフォーム表示
      controller.showPaymentForm(formData, {});

      // 与信枠超過エラーのテストカードを使用
      const limitCard = PAYMENT_ERROR_CARDS.LIMIT_EXCEEDED;
      // Pay.jpのトークン化は成功するがその後の決済処理でエラー
      global.Payjp().createToken.mockResolvedValueOnce({
        id: `tok_${limitCard.number.substring(0, 6)}`
      });

      // APIエラーをモック
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          success: false,
          error: '与信枠を超過しています',
          code: limitCard.error_code
        })
      });

      // イベントハンドラを直接取得して実行
      const form = document.createElement('form');
      const submitHandler = form.addEventListener.mock.calls[0][1];

      // コンソールエラーをスパイ
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // イベントハンドラ実行
      await submitHandler(event);

      // アサーション
      expect(event.preventDefault).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('loadPayJpSDK', () => {
    it('SDKが正常に読み込まれること', async () => {
      // scriptのonloadをモック
      document.createElement.mockImplementationOnce((tag) => {
        const element = {
          async: false,
          src: '',
          onload: null,
          onerror: null,
          appendChild: vi.fn()
        };

        // 非同期でonloadをトリガー
        setTimeout(() => {
          if (element.onload) element.onload();
        }, 10);

        return element;
      });

      // テスト実行
      const result = controller.loadPayJpSDK();

      // Promiseが解決されることを確認
      await expect(result).resolves.toBeUndefined();
    });

    it('SDKの読み込みに失敗した場合はエラーを返すこと', async () => {
      // scriptのonerrorをモック
      document.createElement.mockImplementationOnce((tag) => {
        const element = {
          async: false,
          src: '',
          onload: null,
          onerror: null,
          appendChild: vi.fn()
        };

        // 非同期でonerrorをトリガー
        setTimeout(() => {
          if (element.onerror) element.onerror(new Error('Failed to load SDK'));
        }, 10);

        return element;
      });

      // テスト実行
      const result = controller.loadPayJpSDK();

      // Promiseが拒否されることを確認
      await expect(result).rejects.toThrow();
    });
  });
});