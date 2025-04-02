// src/js/horoscope.js
const HoroscopeManager = (() => {
  // キャッシュストレージ
  const cache = new Map();
  
  // リトライ設定
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  
  // DOM要素の参照
  let formElement = null;
  let loadingElement = null;
  let resultElement = null;
  let errorElement = null;
  
  // 初期化関数
  const init = () => {
    formElement = document.getElementById('horoscope-form');
    loadingElement = document.getElementById('loading-animation');
    resultElement = document.getElementById('horoscope-result');
    errorElement = document.getElementById('error-message');
    
    if (formElement) {
      formElement.addEventListener('submit', handleFormSubmit);
    }
  };
  
  // フォーム送信ハンドラ
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    
    // バリデーション
    if (!validateForm()) {
      return;
    }
    
    // フォームデータ収集
    const formData = collectFormData();
    
    // キャッシュキーの生成
    const cacheKey = generateCacheKey(formData);
    
    // キャッシュ確認
    if (cache.has(cacheKey)) {
      displayResult(cache.get(cacheKey));
      return;
    }
    
    try {
      // ローディング表示開始
      showLoading();
      
      // APIリクエスト（リトライ機能付き）
      const result = await sendRequestWithRetry(formData);
      
      // キャッシュ保存
      cache.set(cacheKey, result);
      
      // 結果表示
      displayResult(result);
    } catch (error) {
      showError(error.message || '占い結果の取得中にエラーが発生しました。');
    } finally {
      hideLoading();
    }
  };
  
  // フォームバリデーション
  const validateForm = () => {
    const name = document.getElementById('user-name').value.trim();
    const birthdate = document.getElementById('birth-date').value;
    const birthtime = document.getElementById('birth-time').value;
    const birthplace = document.getElementById('birth-place').value.trim();
    
    if (!name) {
      showError('お名前を入力してください');
      return false;
    }
    
    if (!birthdate) {
      showError('生年月日を入力してください');
      return false;
    }
    
    if (!birthtime) {
      showError('出生時間を入力してください');
      return false;
    }
    
    if (!birthplace) {
      showError('出生地を入力してください');
      return false;
    }
    
    hideError();
    return true;
  };
  
  // フォームデータ収集
  const collectFormData = () => {
    const formData = new FormData(formElement);
    
    return {
      name: formData.get('name'),
      birthdate: formData.get('birthdate'),
      birthtime: formData.get('birthtime'),
      birthplace: formData.get('birthplace'),
      question: formData.get('specific-question') || ''
    };
  };
  
  // キャッシュキー生成
  const generateCacheKey = (data) => {
    return `${data.name}-${data.birthdate}-${data.birthtime}-${data.birthplace}-${data.question}`;
  };
  
  // リトライ機能付きリクエスト送信
  const sendRequestWithRetry = async (data, retryCount = 0) => {
    try {
      const response = await fetch('/api/generate-horoscope', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        // 待機してからリトライ
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return sendRequestWithRetry(data, retryCount + 1);
      }
      throw error;
    }
  };
  
  // ローディング表示
  const showLoading = () => {
    if (loadingElement) {
      loadingElement.classList.remove('hidden');
    }
    
    if (resultElement) {
      resultElement.classList.add('hidden');
    }
  };
  
  // ローディング非表示
  const hideLoading = () => {
    if (loadingElement) {
      loadingElement.classList.add('hidden');
    }
  };
  
  // エラー表示
  const showError = (message) => {
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    }
  };
  
  // エラー非表示
  const hideError = () => {
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.add('hidden');
    }
  };
  
  // 結果表示
  const displayResult = (result) => {
    if (!resultElement) return;
    
    // テンプレート生成
    const resultHtml = generateResultTemplate(result);
    
    // 結果表示領域に挿入
    resultElement.innerHTML = resultHtml;
    resultElement.classList.remove('hidden');
    
    // 結果領域までスクロール
    resultElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  // 結果表示用HTMLテンプレート生成
  const generateResultTemplate = (result) => {
    const { westernAstrology, fourPillars, specificQuestionResponse } = result;
    
    let template = `
      <div class="result-container">
        <h2 class="result-title">あなたの占い結果</h2>
        
        <div class="result-section western-section">
          <h3>西洋占星術からのメッセージ</h3>
          <div class="result-content">
            <p class="result-highlight">太陽星座: ${westernAstrology.sunSign}</p>
            <p class="result-highlight">月星座: ${westernAstrology.moonSign}</p>
            <p class="result-highlight">アセンダント: ${westernAstrology.ascendant}</p>
            <div class="result-interpretation">${westernAstrology.interpretation}</div>
          </div>
        </div>
        
        <div class="result-section eastern-section">
          <h3>四柱推命からのメッセージ</h3>
          <div class="result-content">
            <p class="result-highlight">日主(本命): ${fourPillars.dayMaster}</p>
            <p class="result-highlight">五行バランス: ${fourPillars.fiveElements}</p>
            <div class="result-interpretation">${fourPillars.interpretation}</div>
          </div>
        </div>
    `;
    
    // 特定質問がある場合のみ表示
    if (specificQuestionResponse && specificQuestionResponse.question && specificQuestionResponse.answer) {
      template += `
        <div class="result-section question-section">
          <h3>あなたの質問への回答</h3>
          <div class="result-content">
            <p class="question-text">質問: ${specificQuestionResponse.question}</p>
            <div class="answer-text">${specificQuestionResponse.answer}</div>
          </div>
        </div>
      `;
    }
    
    template += `
        <div class="result-section summary-section">
          <h3>総合鑑定</h3>
          <div class="result-content">
            <div class="summary-text">${result.summary}</div>
          </div>
        </div>
        
        <div class="result-cta">
          <p>より詳細な鑑定と365日の運勢をご希望の方は<br>プレミアム鑑定をお申し込みください</p>
          <button id="premium-button" class="premium-button">プレミアム鑑定を購入する（2,000円）</button>
        </div>
      </div>
    `;
    
    return template;
  };
  
  // 公開API
  return {
    init,
    generateHoroscope: handleFormSubmit
  };
})();

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', HoroscopeManager.init);

// 外部からの呼び出し用にエクスポート
export default HoroscopeManager;