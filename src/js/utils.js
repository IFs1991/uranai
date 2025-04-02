/**
 * ユーティリティ関数ライブラリ
 */

// ===== 日付操作関数 =====

/**
 * 日付をYYYY-MM-DD形式に変換
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 時刻をHH:MM形式に変換
 */
export const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * 生年月日と時刻から標準形式のDateオブジェクトを生成
 */
export const createDateFromBirthInfo = (year, month, day, hour = 0, minute = 0) => {
  return new Date(year, month - 1, day, hour, minute);
};

// ===== フォームデータ処理 =====

/**
 * 必須入力チェック
 */
export const isRequired = (value) => {
  return value !== undefined && value !== null && value.toString().trim() !== '';
};

/**
 * 日付の有効性チェック
 */
export const isValidDate = (year, month, day) => {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === Number(year) && 
         d.getMonth() === Number(month) - 1 && 
         d.getDate() === Number(day);
};

/**
 * フォームデータオブジェクトからクエリパラメータを生成
 */
export const buildQueryParams = (data) => {
  return Object.keys(data)
    .filter(key => data[key] !== undefined && data[key] !== null && data[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
};

// メモ化関数 (パフォーマンス最適化用)
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

// ===== APIリクエスト共通処理 =====

/**
 * fetch APIラッパー (リトライ, タイムアウト処理付き)
 */
export const fetchWithRetry = async (url, options = {}, retries = 3, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  options.signal = controller.signal;
  
  try {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, options);
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') {
          throw new Error('リクエストがタイムアウトしました');
        }
        
        // 最後の試行以外は遅延を入れてリトライ
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastError;
  } finally {
    clearTimeout(timeoutId);
  }
};

// ===== DOM操作ヘルパー =====

/**
 * 要素の表示/非表示を切り替え
 */
export const toggleElement = (elementId, show = null) => {
  const element = document.getElementById(elementId);
  if (!element) return false;
  
  if (show === null) {
    element.classList.toggle('hidden');
  } else if (show) {
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
  }
  return true;
};

/**
 * 要素にクラスを追加
 */
export const addClass = (element, className) => {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) element.classList.add(className);
};

/**
 * 要素からクラスを削除
 */
export const removeClass = (element, className) => {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) element.classList.remove(className);
};

/**
 * HTML文字列からDOMノードを作成
 */
export const createNodeFromHTML = (htmlString) => {
  const div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return div.firstChild;
};

// ===== アニメーション制御 =====

/**
 * デバウンス関数 (連続呼び出しを制御)
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * スロットル関数 (一定間隔での実行を制御)
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * 要素をフェードイン表示
 */
export const fadeIn = (element, duration = 300) => {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (!element) return;
  
  element.style.opacity = 0;
  element.style.display = 'block';
  
  let start = null;
  const animate = (timestamp) => {
    if (!start) start = timestamp;
    const progress = timestamp - start;
    const opacity = Math.min(progress / duration, 1);
    element.style.opacity = opacity;
    
    if (progress < duration) {
      window.requestAnimationFrame(animate);
    }
  };
  
  window.requestAnimationFrame(animate);
};

// ===== エラーハンドリング =====

/**
 * エラーメッセージテンプレート生成
 */
export const createErrorMessage = (error, defaultMessage = '処理中にエラーが発生しました') => {
  if (!error) return defaultMessage;
  
  // APIエラーの場合
  if (error.response && error.response.data && error.response.data.message) {
    return error.response.data.message;
  }
  
  // 通常のエラーオブジェクト
  if (error.message) {
    return error.message;
  }
  
  // その他の場合
  return defaultMessage;
};

/**
 * フォームバリデーションエラーの表示
 */
export const showValidationError = (elementId, message) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // エラーメッセージ表示用の要素を作成
  let errorElement = element.nextElementSibling;
  if (!errorElement || !errorElement.classList.contains('error-message')) {
    errorElement = document.createElement('div');
    errorElement.classList.add('error-message');
    errorElement.style.color = '#e74c3c';
    errorElement.style.fontSize = '0.85rem';
    errorElement.style.marginTop = '0.25rem';
    element.parentNode.insertBefore(errorElement, element.nextSibling);
  }
  
  errorElement.textContent = message;
  element.classList.add('error-input');
};

/**
 * フォームバリデーションエラーの消去
 */
export const clearValidationError = (elementId) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.classList.remove('error-input');
  
  const errorElement = element.nextElementSibling;
  if (errorElement && errorElement.classList.contains('error-message')) {
    errorElement.textContent = '';
  }
};

/**
 * ページロード中表示の切り替え
 */
export const toggleLoading = (show = true) => {
  const loadingElement = document.getElementById('loading-overlay');
  if (!loadingElement) return;
  
  if (show) {
    loadingElement.style.display = 'flex';
  } else {
    loadingElement.style.display = 'none';
  }
};

// ライブラリのエクスポート
export default {
  formatDate,
  formatTime,
  createDateFromBirthInfo,
  isRequired,
  isValidDate,
  buildQueryParams,
  fetchWithRetry,
  toggleElement,
  addClass,
  removeClass,
  createNodeFromHTML,
  debounce,
  throttle,
  fadeIn,
  createErrorMessage,
  showValidationError,
  clearValidationError,
  toggleLoading
};