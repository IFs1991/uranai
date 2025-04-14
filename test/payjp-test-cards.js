/**
 * Pay.jpのテストカード情報を提供するユーティリティ
 *
 * これらのカード情報はテスト環境でのみ使用可能で、実際の課金は発生しません。
 * 参照元: https://pay.jp/docs/testcard
 */

/**
 * トークン作成が可能なテストカード（正常系）
 */
export const VALID_TEST_CARDS = {
  VISA_1: {
    number: '4242424242424242',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    description: '正常に決済が完了するテストカード (Visa)'
  },
  VISA_2: {
    number: '4012888888881881',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    description: '正常に決済が完了するテストカード (Visa 2)'
  },
  MASTERCARD_1: {
    number: '5555555555554444',
    brand: 'Mastercard',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    description: '正常に決済が完了するテストカード (Mastercard)'
  },
  MASTERCARD_2: {
    number: '5105105105105100',
    brand: 'Mastercard',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    description: '正常に決済が完了するテストカード (Mastercard 2)'
  },
  JCB_1: {
    number: '3530111333300000',
    brand: 'JCB',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    description: '正常に決済が完了するテストカード (JCB)'
  },
  JCB_2: {
    number: '3566002020360505',
    brand: 'JCB',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    description: '正常に決済が完了するテストカード (JCB 2)'
  },
  AMEX_1: {
    number: '378282246310005',
    brand: 'American Express',
    exp_month: '12',
    exp_year: '2030',
    cvc: '1234', // AMEXは4桁
    description: '正常に決済が完了するテストカード (American Express)'
  },
  AMEX_2: {
    number: '371449635398431',
    brand: 'American Express',
    exp_month: '12',
    exp_year: '2030',
    cvc: '1234', // AMEXは4桁
    description: '正常に決済が完了するテストカード (American Express 2)'
  },
  DINERS_1: {
    number: '38520000023237',
    brand: 'Diners Club',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    description: '正常に決済が完了するテストカード (Diners Club)'
  },
  DINERS_2: {
    number: '30569309025904',
    brand: 'Diners Club',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    description: '正常に決済が完了するテストカード (Diners Club 2)'
  },
  DISCOVER_1: {
    number: '6011111111111117',
    brand: 'Discover',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    description: '正常に決済が完了するテストカード (Discover)'
  },
  DISCOVER_2: {
    number: '6011000990139424',
    brand: 'Discover',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    description: '正常に決済が完了するテストカード (Discover 2)'
  }
};

/**
 * トークン作成時にエラーを返すテストカード
 */
export const TOKEN_ERROR_CARDS = {
  CARD_DECLINED: {
    number: '4000000000000002',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'card_declined',
    description: 'トークン作成時に「利用不可能」エラーが発生するテストカード'
  },
  EXPIRED_CARD: {
    number: '4000000000000069',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2020',
    cvc: '123',
    error_code: 'expired_card',
    description: 'トークン作成時に「有効期限切れ」エラーが発生するテストカード'
  },
  INVALID_CVC: {
    number: '4000000000000127',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'invalid_cvc',
    description: 'トークン作成時に「不正なセキュリティコード」エラーが発生するテストカード'
  },
  PROCESSING_ERROR: {
    number: '4000000000000119',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'processing_error',
    description: 'トークン作成時に「決済サーバーエラー」が発生するテストカード'
  },
  INVALID_EXPIRY_DATE_1: {
    number: '4000000000003720',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'invalid_expiration_date',
    description: 'トークン作成時に「不正な有効期限」エラーが発生するテストカード'
  },
  INVALID_EXPIRY_DATE_2: {
    number: '4000000000001110',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'invalid_expiration_date',
    description: 'トークン作成時に「不正な有効期限」エラーが発生するテストカード（旧カード・非推奨）'
  },
  UNACCEPTABLE_BRAND: {
    number: '36227206271667',
    brand: 'unacceptable',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'unacceptable_brand',
    description: 'トークン作成時に「利用可能ブランド以外」エラーが発生するテストカード'
  }
};

/**
 * トークン作成は可能だが、支払い作成時にエラーを返すテストカード
 */
export const PAYMENT_ERROR_CARDS = {
  CARD_DECLINED: {
    number: '4000000000080319',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'card_declined',
    description: '支払い作成時に「支払い不可能」エラーが発生するテストカード'
  },
  EXPIRED_CARD: {
    number: '4000000000004012',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'expired_card',
    description: '支払い作成時に「有効期限切れ」エラーが発生するテストカード'
  },
  LIMIT_EXCEEDED: {
    number: '4000000000080202',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'card_declined',
    threshold: 10000,
    description: '支払い作成時に金額が10,000円を超えていると「与信枠超過」エラーが発生するテストカード'
  },
  INVALID_EXPIRY_DATE_1: {
    number: '4000000000000077',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'invalid_expiration_date',
    description: '支払い作成時に「不正な有効期限」エラーが発生するテストカード'
  },
  INVALID_EXPIRY_DATE_2: {
    number: '4000000000001111',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    error_code: 'invalid_expiration_date',
    description: '支払い作成時に「不正な有効期限」エラーが発生するテストカード（旧カード・非推奨）'
  }
};

/**
 * トークン作成は成功するが、特定のステータスを返すテストカード
 */
export const SPECIAL_STATUS_CARDS = {
  ADDRESS_ZIP_CHECK_FAILED: {
    number: '4000000000000036',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    status: 'address_zip_check=failed',
    description: '「郵便番号の確認に失敗」ステータスを返すテストカード'
  },
  CVC_CHECK_FAILED: {
    number: '4000000000000101',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    status: 'cvc_check=failed',
    description: '「セキュリティコードの確認に失敗」ステータスを返すテストカード'
  },
  CVC_CHECK_UNAVAILABLE: {
    number: '4000000000000044',
    brand: 'Visa',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    status: 'cvc_check=unavailable',
    description: '「セキュリティコードの確認ができない」ステータスを返すテストカード'
  }
};

/**
 * ブランド別のテストカード情報
 */
export const BRAND_TEST_CARDS = {
  VISA: {
    number: '4242424242424242',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    brand: 'Visa',
    description: 'Visaのテストカード'
  },
  MASTERCARD: {
    number: '5555555555554444',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    brand: 'MasterCard',
    description: 'MasterCardのテストカード'
  },
  JCB: {
    number: '3530111333300000',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    brand: 'JCB',
    description: 'JCBのテストカード'
  },
  AMEX: {
    number: '378282246310005',
    exp_month: '12',
    exp_year: '2030',
    cvc: '1234', // AMEXは4桁
    brand: 'American Express',
    description: 'American Expressのテストカード'
  },
  DINERS: {
    number: '30569309025904',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    brand: 'Diners Club',
    description: 'Diners Clubのテストカード'
  },
  DISCOVER: {
    number: '6011111111111117',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    brand: 'Discover',
    description: 'Discoverのテストカード'
  }
};

/**
 * 後方互換性のために残す旧テストカード構造
 */
export const TEST_CARDS = {
  VALID: VALID_TEST_CARDS.VISA_1,
  INVALID_CVC: TOKEN_ERROR_CARDS.INVALID_CVC,
  EXPIRED: TOKEN_ERROR_CARDS.EXPIRED_CARD,
  CARD_DECLINED: TOKEN_ERROR_CARDS.CARD_DECLINED,
  PROCESSING_ERROR: TOKEN_ERROR_CARDS.PROCESSING_ERROR
};

/**
 * テストカード情報をコンソールに出力する
 * 手動テスト時に便利です
 */
export const printTestCards = () => {
  console.group('=== Pay.jp テストカード情報 ===');
  console.log('※ これらのカードはテスト環境でのみ使用可能です');

  console.group('1. トークン作成が可能なテストカード');
  Object.keys(VALID_TEST_CARDS).forEach(key => {
    const card = VALID_TEST_CARDS[key];
    console.log(`${key}:`);
    console.log(`  カード番号: ${card.number}`);
    console.log(`  ブランド: ${card.brand}`);
    console.log(`  有効期限: ${card.exp_month}/${card.exp_year}`);
    console.log(`  CVC: ${card.cvc}`);
    console.log(`  説明: ${card.description}`);
    console.log('---');
  });
  console.groupEnd();

  console.group('2. トークン作成時にエラーを返すテストカード');
  Object.keys(TOKEN_ERROR_CARDS).forEach(key => {
    const card = TOKEN_ERROR_CARDS[key];
    console.log(`${key}:`);
    console.log(`  カード番号: ${card.number}`);
    console.log(`  エラーコード: ${card.error_code}`);
    console.log(`  説明: ${card.description}`);
    console.log('---');
  });
  console.groupEnd();

  console.group('3. 支払い作成時にエラーを返すテストカード');
  Object.keys(PAYMENT_ERROR_CARDS).forEach(key => {
    const card = PAYMENT_ERROR_CARDS[key];
    console.log(`${key}:`);
    console.log(`  カード番号: ${card.number}`);
    console.log(`  エラーコード: ${card.error_code}`);
    console.log(`  説明: ${card.description}`);
    console.log('---');
  });
  console.groupEnd();

  console.group('4. 特定のステータスを返すテストカード');
  Object.keys(SPECIAL_STATUS_CARDS).forEach(key => {
    const card = SPECIAL_STATUS_CARDS[key];
    console.log(`${key}:`);
    console.log(`  カード番号: ${card.number}`);
    console.log(`  ステータス: ${card.status}`);
    console.log(`  説明: ${card.description}`);
    console.log('---');
  });
  console.groupEnd();

  console.groupEnd();
};

/**
 * ユーティリティ関数: 与信枠テスト用のランダムな未来日付の有効期限を生成
 * @returns {{ exp_month: string, exp_year: string }} 有効期限オブジェクト
 */
export const generateRandomFutureExpiry = () => {
  const now = new Date();
  const futureYear = now.getFullYear() + Math.floor(Math.random() * 5) + 1; // 1〜5年後
  const futureMonth = Math.floor(Math.random() * 12) + 1; // 1〜12月

  return {
    exp_month: String(futureMonth).padStart(2, '0'),
    exp_year: String(futureYear)
  };
};

export default {
  VALID_TEST_CARDS,
  TOKEN_ERROR_CARDS,
  PAYMENT_ERROR_CARDS,
  SPECIAL_STATUS_CARDS,
  BRAND_TEST_CARDS,
  TEST_CARDS,
  printTestCards,
  generateRandomFutureExpiry
};