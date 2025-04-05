// payment.js - 決済処理を制御するJavaScript

// 依存モジュール（遅延読み込み）
let utils = null;
let generatePdf = null;

const PaymentController = (function() {
  // プライベート変数
  // 本番環境では実際の公開キーに置き換えること (pk_live_*)
  const PAYJP_PUBLIC_KEY = 'pk_test_0383a1b8f91e8a6e3ea0e2a9'; // テスト公開キー
  const PAYJP_SCRIPT_URL = 'https://js.pay.jp/v2/pay.js';

  let payjpInstance = null;
  let paymentForm = null;
  let paymentModal = null;
  let isProcessing = false;
  let userFormData = null;
  let horoscopeData = null;

  // プライベート関数
  const loadDependencies = async () => {
    if (!utils) {
      utils = await import('./utils.js').then(module => module.default);
    }
    if (!generatePdf) {
      generatePdf = await import('../api/generate-pdf.js').then(module => module.default);
    }
  };

  // Pay.jpのJavaScriptライブラリを動的に読み込む
  const loadPayJpSDK = () => {
    return new Promise((resolve, reject) => {
      if (window.Payjp) {
        payjpInstance = window.Payjp(PAYJP_PUBLIC_KEY);
        resolve(payjpInstance);
        return;
      }

      const script = document.createElement('script');
      script.src = PAYJP_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        payjpInstance = window.Payjp(PAYJP_PUBLIC_KEY);
        resolve(payjpInstance);
      };
      script.onerror = () => {
        reject(new Error('pay.jpの読み込みに失敗しました'));
      };
      document.head.appendChild(script);
    });
  };

  const createPaymentModal = () => {
    if (paymentModal) return paymentModal;

    paymentModal = document.createElement('div');
    paymentModal.className = 'payment-modal';
    paymentModal.innerHTML = `
      <div class="payment-modal-overlay"></div>
      <div class="payment-modal-content">
        <div class="payment-modal-header">
          <h2>詳細鑑定のご購入</h2>
          <button type="button" class="payment-modal-close">&times;</button>
        </div>
        <div class="payment-modal-body">
          <div class="payment-product-info">
            <h3>ライフサイクル・ポテンシャル詳細鑑定</h3>
            <p>あなただけの詳細な西洋占星術と四柱推命の統合鑑定結果と365日の日別運勢をPDFで提供します。</p>
            <div class="payment-price">¥10,000 <span class="payment-tax">(税込)</span></div>
          </div>
          <form id="payment-form" class="payment-form">
            <div class="form-row">
              <label for="card-number">カード番号</label>
              <div id="card-number" class="payjp-element"></div>
              <div class="payment-error card-number-error"></div>
            </div>
            <div class="form-row card-details">
              <div class="form-column">
                <label for="card-expiry">有効期限</label>
                <div id="card-expiry" class="payjp-element"></div>
                <div class="payment-error card-expiry-error"></div>
              </div>
              <div class="form-column">
                <label for="card-cvc">セキュリティコード</label>
                <div id="card-cvc" class="payjp-element"></div>
                <div class="payment-error card-cvc-error"></div>
              </div>
            </div>
            <div class="form-row">
              <button type="submit" id="payment-submit" class="payment-submit-button">
                <span class="button-text">購入する</span>
                <span class="button-loader hidden">
                  <span class="spinner"></span>
                </span>
              </button>
            </div>
            <div class="payment-error general-error"></div>
          </form>
        </div>
        <div class="payment-modal-footer">
          <p class="payment-security-info">
            <svg class="lock-icon" viewBox="0 0 24 24" width="16" height="16">
              <path d="M19 10h-1V7c0-4-3-7-7-7S4 3 4 7v3H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2zm-9 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm4-9H8V7c0-2.2 1.8-4 4-4s4 1.8 4 4v3z"></path>
            </svg>
            安全な決済処理。カード情報は保存されません。
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(paymentModal);

    // イベントリスナー設定
    const closeButton = paymentModal.querySelector('.payment-modal-close');
    const overlay = paymentModal.querySelector('.payment-modal-overlay');
    const form = paymentModal.querySelector('#payment-form');

    closeButton.addEventListener('click', () => {
      if (!isProcessing) hidePaymentModal();
    });

    overlay.addEventListener('click', () => {
      if (!isProcessing) hidePaymentModal();
    });

    form.addEventListener('submit', handlePaymentSubmit);

    return paymentModal;
  };

  const showPaymentModal = () => {
    const modal = createPaymentModal();
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    setupPaymentForm();
  };

  const hidePaymentModal = () => {
    if (paymentModal) {
      paymentModal.classList.remove('active');
      document.body.classList.remove('modal-open');

      // フォームリセット
      resetPaymentForm();
    }
  };

  const setupPaymentForm = async () => {
    if (!payjpInstance) {
      try {
        await loadPayJpSDK();
      } catch (error) {
        showError('general-error', 'pay.jpの読み込みに失敗しました。ネットワーク接続を確認してください。');
        return;
      }
    }

    const elements = payjpInstance.elements();

    const cardNumber = elements.create('cardNumber');
    const cardExpiry = elements.create('cardExpiry');
    const cardCvc = elements.create('cardCvc');

    cardNumber.mount('#card-number');
    cardExpiry.mount('#card-expiry');
    cardCvc.mount('#card-cvc');

    // 入力エラー監視
    cardNumber.on('change', (event) => {
      handleElementChange(event, 'card-number-error');
    });

    cardExpiry.on('change', (event) => {
      handleElementChange(event, 'card-expiry-error');
    });

    cardCvc.on('change', (event) => {
      handleElementChange(event, 'card-cvc-error');
    });

    paymentForm = {
      elements,
      cardNumber,
      cardExpiry,
      cardCvc
    };
  };

  const handleElementChange = (event, errorClass) => {
    const errorElement = paymentModal.querySelector(`.${errorClass}`);
    if (event.error) {
      errorElement.textContent = event.error.message;
    } else {
      errorElement.textContent = '';
    }
  };

  const resetPaymentForm = () => {
    if (paymentForm) {
      const form = paymentModal.querySelector('#payment-form');
      form.reset();

      // エラーメッセージをクリア
      const errorElements = paymentModal.querySelectorAll('.payment-error');
      errorElements.forEach(el => {
        el.textContent = '';
      });

      // ローディング状態をリセット
      setPaymentProcessing(false);
    }
  };

  const setPaymentProcessing = (processing) => {
    isProcessing = processing;

    const submitButton = paymentModal.querySelector('#payment-submit');
    const buttonText = submitButton.querySelector('.button-text');
    const buttonLoader = submitButton.querySelector('.button-loader');

    if (processing) {
      submitButton.disabled = true;
      buttonText.classList.add('hidden');
      buttonLoader.classList.remove('hidden');
    } else {
      submitButton.disabled = false;
      buttonText.classList.remove('hidden');
      buttonLoader.classList.add('hidden');
    }
  };

  const showError = (errorClass, message) => {
    const errorElement = paymentModal.querySelector(`.${errorClass}`);
    errorElement.textContent = message;

    // エラーが見えるようにスクロール
    errorElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // 支払い処理用のAPIエンドポイント
  const processPayment = async (paymentData) => {
    try {
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '決済処理に失敗しました');
      }

      return result;
    } catch (error) {
      console.error('決済API呼び出しエラー:', error);
      throw error;
    }
  };

  const handlePaymentSubmit = async (event) => {
    event.preventDefault();

    if (isProcessing) return;

    // エラーメッセージをクリア
    const errorElements = paymentModal.querySelectorAll('.payment-error');
    errorElements.forEach(el => {
      el.textContent = '';
    });

    setPaymentProcessing(true);

    try {
      // カード情報をトークン化
      const tokenResult = await payjpInstance.createToken(paymentForm.cardNumber);

      if (tokenResult.error) {
        throw new Error(tokenResult.error.message);
      }

      // 必須のユーザー情報の確認
      if (!userFormData || !userFormData.name || !userFormData.email || !userFormData.birthDate) {
        throw new Error('ユーザー情報が不完全です。入力内容をご確認ください。');
      }

      // サーバーへ決済リクエスト送信 (金額は固定10,000円)
      const paymentResult = await processPayment({
        token: tokenResult.id,
        userData: userFormData
      });

      // 決済成功
      if (paymentResult.success) {
        // PDF生成を開始
        startPdfGeneration(paymentResult.paymentId);
      } else {
        throw new Error(paymentResult.error || '決済処理に失敗しました');
      }

    } catch (error) {
      console.error('決済エラー:', error);
      setPaymentProcessing(false);

      // エラーメッセージの表示
      let errorMessage = error.message || '決済処理中にエラーが発生しました';

      // カード番号関連のエラーの場合
      if (errorMessage.includes('カード番号') || errorMessage.includes('card number')) {
        showError('card-number-error', errorMessage);
      }
      // 有効期限関連のエラーの場合
      else if (errorMessage.includes('有効期限') || errorMessage.includes('expiration')) {
        showError('card-expiry-error', errorMessage);
      }
      // セキュリティコード関連のエラーの場合
      else if (errorMessage.includes('セキュリティコード') || errorMessage.includes('security code') || errorMessage.includes('CVC')) {
        showError('card-cvc-error', errorMessage);
      }
      // その他の一般的なエラー
      else {
        showError('general-error', errorMessage);
      }
    }
  };

  const startPdfGeneration = async (paymentId) => {
    try {
      // PDF生成画面へ移行
      hidePaymentModal();
      showPdfGenerationProgress();

      // PDF生成リクエスト
      const pdfResult = await generatePdf({
        paymentId,
        userData: userFormData,
        horoscopeData: horoscopeData
      });

      if (pdfResult.success) {
        completePdfGeneration(pdfResult.pdfUrl);
      } else {
        throw new Error(pdfResult.message || 'PDF生成に失敗しました');
      }

    } catch (error) {
      console.error('PDF生成エラー:', error);
      showPdfGenerationError(error.message);
    }
  };

  const showPdfGenerationProgress = () => {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'pdf-progress-container';
    progressContainer.innerHTML = `
      <div class="pdf-progress-content">
        <h2>詳細鑑定書を生成中...</h2>
        <p>あなただけの鑑定書を作成しています。このプロセスには数分かかることがあります。</p>
        <div class="progress-bar-container">
          <div class="progress-bar"></div>
        </div>
        <div class="progress-stages">
          <div class="stage active">データ分析</div>
          <div class="stage">星座解析</div>
          <div class="stage">命式計算</div>
          <div class="stage">365日カレンダー</div>
          <div class="stage">PDF作成</div>
        </div>
      </div>
    `;

    document.body.appendChild(progressContainer);

    // プログレスバーアニメーション
    simulateProgressStages();
  };

  const simulateProgressStages = () => {
    const stages = document.querySelectorAll('.progress-stages .stage');
    const progressBar = document.querySelector('.progress-bar');
    const totalStages = stages.length;
    let currentStage = 0;

    const updateProgress = () => {
      // 前のステージを非アクティブに
      if (currentStage > 0) {
        stages[currentStage - 1].classList.remove('active');
        stages[currentStage - 1].classList.add('completed');
      }

      // 次のステージをアクティブに
      if (currentStage < totalStages) {
        stages[currentStage].classList.add('active');
        const progressPercent = (currentStage / (totalStages - 1)) * 100;
        progressBar.style.width = `${progressPercent}%`;
        currentStage++;

        // 次のステージへ
        if (currentStage < totalStages) {
          const delay = 3000 + Math.random() * 2000; // 3〜5秒のランダム
          setTimeout(updateProgress, delay);
        }
      }
    };

    // 進行開始
    updateProgress();
  };

  const completePdfGeneration = (pdfUrl) => {
    const progressContainer = document.getElementById('pdf-progress-container');
    if (progressContainer) {
      progressContainer.innerHTML = `
        <div class="pdf-complete-content">
          <h2>鑑定書の生成が完了しました！</h2>
          <p>あなただけの詳細な鑑定書が完成しました。以下のボタンからダウンロードできます。</p>
          <div class="pdf-success-icon">✓</div>
          <a href="${pdfUrl}" download="lifecycle_potential_horoscope.pdf" class="download-pdf-button">
            鑑定書をダウンロード
          </a>
          <p class="pdf-note">このリンクは24時間有効です。ダウンロードしてお使いのデバイスに保存してください。</p>
          <button class="close-button">閉じる</button>
        </div>
      `;

      const closeButton = progressContainer.querySelector('.close-button');
      closeButton.addEventListener('click', () => {
        progressContainer.remove();
      });
    }
  };

  const showPdfGenerationError = (errorMessage) => {
    const progressContainer = document.getElementById('pdf-progress-container');
    if (progressContainer) {
      progressContainer.innerHTML = `
        <div class="pdf-error-content">
          <h2>鑑定書の生成中にエラーが発生しました</h2>
          <p>${errorMessage || 'PDF生成中に問題が発生しました。お手数ですが、後ほど再度お試しください。'}</p>
          <div class="pdf-error-icon">!</div>
          <button class="retry-button">再試行</button>
          <button class="close-button">閉じる</button>
        </div>
      `;

      const retryButton = progressContainer.querySelector('.retry-button');
      retryButton.addEventListener('click', () => {
        progressContainer.remove();
        showPaymentModal();
      });

      const closeButton = progressContainer.querySelector('.close-button');
      closeButton.addEventListener('click', () => {
        progressContainer.remove();
      });
    }
  };

  // パブリックAPI
  return {
    // 初期化
    init: async function() {
      await loadDependencies();

      // 購入ボタンへのイベントリスナー設定
      document.addEventListener('click', (event) => {
        if (event.target.matches('#premium-purchase-button, .premium-purchase-button')) {
          this.showPaymentForm();
        }
      });

      return this;
    },

    // 支払いフォームを表示
    showPaymentForm: function(formData, resultData) {
      userFormData = formData;
      horoscopeData = resultData;
      showPaymentModal();
    },

    // デバッグ用PDFリクエスト
    requestPdfDirectly: async function(formData, resultData) {
      await loadDependencies();
      userFormData = formData;
      horoscopeData = resultData;

      // ダミーのpaymentIdでPDF生成を開始
      startPdfGeneration('debug_payment_id');
    }
  };
})();

// モジュールのエクスポート
export default PaymentController;