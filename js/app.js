/**
 * ライフサイクル・ポテンシャル占術サービス
 * メインアプリケーションコントローラー
 *
 * パフォーマンス最適化済みバージョン
 */

const AppController = (() => {
    // プライベート変数
    let _isInitialized = false;
    let _isFullyInitialized = false;
    let _userData = null;
    let _resultData = null;

    // DOM要素の参照を保持
    const elements = {};

    // ローディング状態の追跡
    const _loadingStates = {
        form: false,
        api: false,
        pdf: false
    };

    /**
     * DOM要素の参照を初期化（マップを使用して効率化）
     */
    const _initDOMReferences = () => {
        // 要素IDのマップ
        const elementIds = {
            form: 'horoscope-form',
            loadingIndicator: 'loading',
            resultArea: 'result-area',
            basicResult: 'basic-result',
            questionResultArea: 'question-result-area',
            questionResult: 'question-result',
            premiumButton: 'premium-purchase-button',
            svgModal: 'svg-modal',
            showSvgButton: 'show-sample-pdf-btn'
        };

        // 効率的に要素を取得
        for (const [key, id] of Object.entries(elementIds)) {
            elements[key] = document.getElementById(id);
        }

        // クローズボタンは一括取得
        elements.closeButtons = document.querySelectorAll('[data-close-modal]');
    };

    /**
     * イベントリスナーを設定（基本的なものだけ初期化時に設定）
     */
    const _setupEventListeners = () => {
        // フォーム送信イベント
        elements.form?.addEventListener('submit', _handleFormSubmit);

        // SVG表示ボタン
        elements.showSvgButton?.addEventListener('click', () => {
            _toggleModal(elements.svgModal, true);
        });

        // イベント委任を使用してモーダルのクローズを処理
        document.addEventListener('click', (event) => {
            const closeElement = event.target.closest('[data-close-modal]');
            if (closeElement || event.target.hasAttribute('data-close-modal')) {
                _closeAllModals();
            }
        });

        // Escキーでモーダルクローズ
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                _closeAllModals();
            }
        });
    };

    /**
     * 追加の複雑なリスナーの遅延初期化
     */
    const _setupAdvancedFeatures = () => {
        if (_isFullyInitialized) return;

        // IntersectionObserverを使用した効率的なスクロール検出
        _setupScrollObserver();

        // ここに必要に応じて追加の高度な機能を初期化

        _isFullyInitialized = true;
    };

    /**
     * スクロール検出のためのIntersectionObserver設定
     */
    const _setupScrollObserver = () => {
        if (!('IntersectionObserver' in window)) return null;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // 必要に応じてビューポート内の要素に対する処理
                if (entry.isIntersecting) {
                    // 例: 遅延読み込み処理など
                }
            });
        }, {
            rootMargin: '0px',
            threshold: 0.1
        });

        // 監視したい要素をここで追加

        return () => observer.disconnect();
    };

    /**
     * フォーム送信処理
     * @param {Event} event - 送信イベント
     */
    const _handleFormSubmit = async (event) => {
        event.preventDefault();

        try {
            // 高度な機能を遅延初期化
            _setupAdvancedFeatures();

            // フォームデータの取得とバリデーション
            const formData = new FormData(event.target);
            const formObject = Object.fromEntries(formData.entries());

            if (!_validateFormData(formObject)) {
                return;
            }

            // ユーザーデータ保存
            _userData = formObject;

            // ローディング表示
            _updateLoadingState('form', true);

            // 占い結果を取得 (horoscope.jsに実装)
            if (typeof HoroscopeService !== 'undefined') {
                _resultData = await HoroscopeService.generateReading(formObject);

                // 結果表示
                _displayResults(_resultData);

                // 無料鑑定完了イベント発火
                _dispatchReadingCompleteEvent();

                // プレミアムボタンの有効化
                _enablePremiumButton();
            } else {
                _showError('占い計算モジュールの読み込みに失敗しました。ページを再読み込みしてください。');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            _showError('処理中にエラーが発生しました。しばらく経ってから再度お試しください。');
        } finally {
            _updateLoadingState('form', false);
        }
    };

    /**
     * フォームデータのバリデーション
     * @param {Object} data - フォームデータ
     * @returns {boolean} バリデーション結果
     */
    const _validateFormData = (data) => {
        if (!data.name?.trim()) {
            _showError('お名前を入力してください');
            return false;
        }

        if (!data.birthdate) {
            _showError('生年月日を入力してください');
            return false;
        }

        // 生年月日の妥当性チェック
        const birthDate = new Date(data.birthdate);
        const now = new Date();
        if (isNaN(birthDate) || birthDate > now || birthDate.getFullYear() < 1900) {
            _showError('有効な生年月日を入力してください');
            return false;
        }

        return true;
    };

    /**
     * 占い結果の表示
     * @param {Object} resultData - 占い結果データ
     */
    const _displayResults = (resultData) => {
        if (!resultData) return;

        // 基本結果表示（オプショナルチェイニングを使用）
        elements.basicResult.innerHTML = resultData?.basicReading || '';

        // 質問への回答表示（あれば）
        if (resultData?.questionReading) {
            elements.questionResult.innerHTML = resultData.questionReading;
            _toggleVisibility(elements.questionResultArea, true);
        } else {
            _toggleVisibility(elements.questionResultArea, false);
        }

        // 結果エリアを表示してスクロール
        _toggleVisibility(elements.resultArea, true);
        _scrollToElement(elements.resultArea);
    };

    /**
     * 要素へのスムーズスクロール
     * @param {HTMLElement} element - スクロール先の要素
     */
    const _scrollToElement = (element) => {
        if (!element) return;

        // requestAnimationFrameを使用してレンダリングと同期
        requestAnimationFrame(() => {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    };

    /**
     * 無料鑑定完了イベントの発火
     */
    const _dispatchReadingCompleteEvent = () => {
        const event = new CustomEvent('free-reading-complete', {
            detail: {
                formData: _userData,
                resultData: _resultData
            }
        });
        document.dispatchEvent(event);
    };

    /**
     * プレミアムボタンの有効化
     */
    const _enablePremiumButton = () => {
        if (!elements.premiumButton) return;

        elements.premiumButton.disabled = false;
        elements.premiumButton.textContent = '詳細鑑定を購入する（¥10,000 税込）';
    };

    /**
     * 要素の表示・非表示を切り替える汎用関数
     * @param {HTMLElement} element - 対象要素
     * @param {boolean} isVisible - 表示状態
     */
    const _toggleVisibility = (element, isVisible) => {
        if (element) {
            element.style.display = isVisible ? 'block' : 'none';
        }
    };

    /**
     * ローディング状態の更新と表示制御
     * @param {string} key - ローディング状態のキー
     * @param {boolean} isLoading - ローディング中かどうか
     */
    const _updateLoadingState = (key, isLoading) => {
        _loadingStates[key] = isLoading;

        // いずれかがロード中ならローディング表示
        const isAnyLoading = Object.values(_loadingStates).some(state => state);
        _toggleVisibility(elements.loadingIndicator, isAnyLoading);
    };

    /**
     * エラーメッセージの表示
     * @param {string} message - エラーメッセージ
     */
    const _showError = (message) => {
        alert(message); // シンプルな実装。後でカスタムエラー表示に変更可能
    };

    /**
     * モーダルの表示/非表示を切り替え
     * @param {HTMLElement} modal - モーダル要素
     * @param {boolean} isVisible - 表示状態
     */
    const _toggleModal = (modal, isVisible) => {
        if (!modal) return;

        if (isVisible) {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
        } else {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    };

    /**
     * すべてのモーダルを閉じる
     */
    const _closeAllModals = () => {
        // SVGモーダル
        _toggleModal(elements.svgModal, false);

        // 決済モーダル（payment.jsで定義されている可能性がある）
        const paymentModal = document.querySelector('.payment-modal');
        _toggleModal(paymentModal, false);

        // body からモーダルオープンクラスを削除
        document.body.classList.remove('modal-open');
    };

    /**
     * APIリクエスト送信の共通関数
     * @param {string} url - エンドポイントURL
     * @param {Object} data - リクエストデータ
     * @param {Object} options - リクエストオプション
     * @returns {Promise} レスポンス
     */
    const _apiRequest = async (url, data = {}, options = {}) => {
        const defaultOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };

        const fetchOptions = { ...defaultOptions, ...options };
        _updateLoadingState('api', true);

        try {
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                throw new Error(`サーバーエラー: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        } finally {
            _updateLoadingState('api', false);
        }
    };

    /**
     * PDF生成進捗監視のためのEventSourceセットアップ
     * @param {string} jobId - PDF生成ジョブID
     * @param {Function} progressCallback - 進捗コールバック
     * @param {Function} completeCallback - 完了コールバック
     * @param {Function} errorCallback - エラーコールバック
     * @returns {Function} クリーンアップ関数
     */
    const _setupProgressMonitor = (jobId, progressCallback, completeCallback, errorCallback) => {
        if (!jobId) return null;

        const eventSource = new EventSource(`/api/pdf-progress/${jobId}`);
        _updateLoadingState('pdf', true);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.status === 'completed') {
                    _updateLoadingState('pdf', false);
                    if (completeCallback) completeCallback(data);
                    eventSource.close();
                } else if (data.status === 'error') {
                    _updateLoadingState('pdf', false);
                    if (errorCallback) errorCallback(data.error || 'PDF生成中にエラーが発生しました');
                    eventSource.close();
                } else if (data.status === 'progress' && progressCallback) {
                    progressCallback(data.progress, data.stage);
                }
            } catch (error) {
                console.error('Progress event parse error:', error);
            }
        };

        eventSource.onerror = () => {
            _updateLoadingState('pdf', false);
            if (errorCallback) errorCallback('進捗状況の監視中にエラーが発生しました');
            eventSource.close();
        };

        // クリーンアップ関数を返す
        return () => {
            if (eventSource && eventSource.readyState !== 2) { // 2 = CLOSED
                eventSource.close();
                _updateLoadingState('pdf', false);
            }
        };
    };

    // 公開メソッド
    return {
        /**
         * アプリケーションの初期化
         */
        init: async () => {
            if (_isInitialized) return;

            try {
                // 基本初期化
                _initDOMReferences();
                _setupEventListeners();

                _isInitialized = true;
                // 高度な機能は遅延初期化（最初のユーザーアクションで）
            } catch (error) {
                console.error('Initialization error:', error);
            }

            return _isInitialized;
        },

        /**
         * APIリクエスト送信（外部からアクセス可能なラッパー）
         */
        apiRequest: _apiRequest,

        /**
         * PDF生成進捗監視（外部からアクセス可能なラッパー）
         */
        setupProgressMonitor: _setupProgressMonitor,

        /**
         * モーダル表示（外部からアクセス可能なラッパー）
         */
        showModal: (modal) => _toggleModal(modal, true),

        /**
         * モーダルクローズ（外部からアクセス可能なラッパー）
         */
        closeAllModals: _closeAllModals,

        /**
         * ローディング表示（外部からアクセス可能なラッパー）
         */
        showLoading: (key, isLoading) => _updateLoadingState(key, isLoading),

        /**
         * エラー表示（外部からアクセス可能なラッパー）
         */
        showError: _showError,

        /**
         * 現在のユーザーデータを取得
         */
        getUserData: () => _userData,

        /**
         * 現在の結果データを取得
         */
        getResultData: () => _resultData,

        /**
         * 高度な機能の初期化（必要に応じて手動で呼び出し可能）
         */
        initAdvancedFeatures: _setupAdvancedFeatures
    };
})();

// DOMが読み込まれたら自動初期化（エラーシナリオを考慮）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        AppController.init().catch(console.error);
    });
} else {
    // すでにDOMが読み込まれている場合は即時実行
    AppController.init().catch(console.error);
}