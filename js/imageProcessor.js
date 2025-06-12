import * as DOM from './domElements.js';
// import { getState, updateState, setCharacters } from './state.js';

// --- グローバル変数と設定 ---
let paddleOcr = null;
const STATUS_ELEMENT = DOM.imageUploadStatus; // DOMからステータス表示用のp要素を取得

// --- PaddleOCR の初期化 ---
let initializationPromise = null;

async function initializeOcr() {
    if (paddleOcr) return paddleOcr; // 既に初期化済み
    
    // 初期化が進行中の場合は、既存のPromiseを返す
    if (initializationPromise) return initializationPromise;
     
    if (STATUS_ELEMENT) STATUS_ELEMENT.textContent = 'OCRエンジンを初期化中...';
     
    initializationPromise = (async () => {
        try {
            paddleOcr = await PaddleocrBrowser.create({
                det: "db_lite",        // or "db" / "db_mv3" for higher accuracy
                rec: "en_number_v2.0",  // English number model
                cls: false,             // text direction classification not needed
            });
            if (STATUS_ELEMENT) STATUS_ELEMENT.textContent = 'OCRエンジン準備完了。画像を選択してください。';
            return paddleOcr;
        } catch (error) {
            console.error("PaddleOCRの初期化に失敗しました:", error);
            if (STATUS_ELEMENT) STATUS_ELEMENT.textContent = 'エラー: OCRエンジンの初期化に失敗しました。';
            paddleOcr = null; // 初期化失敗を明示
            initializationPromise = null; // 再試行を可能にする
            throw error;
        }
    })();
    
    return initializationPromise;
}

// --- メインの画像処理関数 ---
export async function processImageFromFile(file) {
    if (!file) return;
    await initializeOcr(); // OCRが準備できていることを確認
    if (!paddleOcr) {
        alert("OCRエンジンが利用できません。ページをリロードして再度お試しください。");
        return;
    }

    const imageUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
        try {
            STATUS_ELEMENT.textContent = '画像を解析中...';
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // 1. 操作中のプレイヤーUI領域を探す
            const roi = findActivePlayerRegion(ctx, canvas.width, canvas.height);
            if (!roi) {
                STATUS_ELEMENT.textContent = 'エラー: 操作中のプレイヤー(オレンジ枠)が見つかりませんでした。';
                alert('操作中のプレイヤー(オレンジ枠)が見つかりませんでした。\n解像度やUIサイズが異なると認識できない場合があります。');
                return;
            }

            // 2. HPとゲージを並行して読み取る
            STATUS_ELEMENT.textContent = 'HPとゲージの値を読み取り中...';
            const [hp, gauge] = await Promise.all([
                readHpFromRoi(ctx, roi),
                readGaugeFromRoi(ctx)
            ]);

            // 3. 結果をUIに反映
            let resultMessage = '自動入力完了！';
            if (hp !== null) {
                DOM.beforeShotdownHpInput.value = hp;
            } else {
                resultMessage += ' (HP認識失敗)';
            }
            if (gauge !== null) {
                DOM.beforeShotdownAwakeningGaugeInput.value = gauge;
            } else {
                resultMessage += ' (ゲージ認識失敗)';
            }
            STATUS_ELEMENT.textContent = resultMessage;

            // inputイベントを発火させて、関連する計算をトリガー
            DOM.beforeShotdownHpInput.dispatchEvent(new Event('input', { bubbles: true }));
            DOM.beforeShotdownAwakeningGaugeInput.dispatchEvent(new Event('input', { bubbles: true }));

        } catch (error) {
            console.error("画像処理中にエラー:", error);
            STATUS_ELEMENT.textContent = 'エラー: 画像処理に失敗しました。';
        } finally {
            URL.revokeObjectURL(imageUrl); // メモリリーク防止
            setTimeout(() => { if(STATUS_ELEMENT) STATUS_ELEMENT.textContent = ''; }, 5000);
        }
    };
    img.onerror = () => {
        STATUS_ELEMENT.textContent = 'エラー: 画像ファイルの読み込みに失敗しました。';
        URL.revokeObjectURL(imageUrl);
    };
    img.src = imageUrl;
}

// --- ヘルパー関数群 ---

/**
  * PaddleOCRの実行結果からテキストを抽出する
  * @param {Array} ocrResult - paddleOcr.ocr()の実行結果
  * @returns {string} - 抽出されたテキスト
  */
function extractTextFromOcrResult(ocrResult) {
    if (!Array.isArray(ocrResult) || ocrResult.length === 0) {
        return '';
    }
    
    try {
        // 信頼度の高い順にソートし、テキストを結合する
        return ocrResult
            .filter(line => line?.text && Array.isArray(line.text)) // データ構造を検証
            .flatMap(line => line.text)
            .filter(item => Array.isArray(item) && item.length >= 2) // [text, confidence]の形式を確認
            .sort((a, b) => b[1] - a[1]) // 信頼度（confidence）で降順ソート
            .map(item => item[0]) // テキスト部分のみ抽出
            .join('');
    } catch (error) {
        console.error('OCR結果の解析中にエラー:', error);
        return '';
    }
}

/**
 * オレンジ枠のUI領域を検出する
 * @param {CanvasRenderingContext2D} ctx - キャンバスのコンテキスト
 * @param {number} width - キャンバスの幅
 * @param {number} height - キャンバスの高さ
 * @returns {object|null} - {x, y, width, height} のオブジェクト or null
 */
function findActivePlayerRegion(ctx, width, height) {
    const scale = width / 1920;

    // 1920x1080レイアウトを基準に、4つのプレイヤーUIカードの候補領域を定義
    const potentialRois = [
        { x: 45, y: 105, width: 310, height: 90 }, // 左上
        { x: 45, y: 200, width: 310, height: 90 }, // 左下
        { x: 1565, y: 105, width: 310, height: 90 }, // 右上
        { x: 1565, y: 200, width: 310, height: 90 }  // 右下
    ];

    for (const roi of potentialRois) {
        const scaledRoi = {
            x: Math.round(roi.x * scale),
            y: Math.round(roi.y * scale),
            width: Math.round(roi.width * scale),
            height: Math.round(roi.height * scale)
        };

        // ROIがキャンバスの範囲外に出ていないかチェック
        if (scaledRoi.x < 0 || scaledRoi.y < 0 || scaledRoi.x + scaledRoi.width > width || scaledRoi.y + scaledRoi.height > height) {
            continue;
        }

        const imageData = ctx.getImageData(scaledRoi.x, scaledRoi.y, scaledRoi.width, scaledRoi.height).data;
        let orangePixelCount = 0;

        // 各候補領域の5px幅の縁をスキャンしてオレンジ色のピクセルを探す
        for (let y = 0; y < scaledRoi.height; y++) {
            for (let x = 0; x < scaledRoi.width; x++) {
                if (x < 5 || x >= scaledRoi.width - 5 || y < 5 || y >= scaledRoi.height - 5) {
                    const i = (y * scaledRoi.width + x) * 4;
                    if (isOrange(imageData[i], imageData[i + 1], imageData[i + 2])) {
                        orangePixelCount++;
                    }
                }
            }
        }

        // オレンジ色のピクセルが一定数以上見つかれば、アクティブなプレイヤー領域だと判断
        if (orangePixelCount > 50) {
            return scaledRoi;
        }
    }

    return null; // アクティブな領域が見つからなかった
}

function isOrange(r, g, b) {
    // オレンジ色・黄色系の色を認識できるよう、判定をより緩やかにする
    // 赤が強く、緑が中程度、青が弱いことをチェック
    return r > 180 && g > 90 && b < 120;
}

/**
 * 認識されたHPの値を後処理で補正する
 * @param {string} rawText - OCRで認識された生のテキスト
 * @returns {number|null} - 補正後のHP値 or null
 */
function postProcessHp(rawText) {
    // 典型的な誤認識を補正（例: '7' -> '1', 'B' -> '8'など）
    let text = rawText.replace(/Z/g, '2').replace(/S/g, '5').replace(/B/g, '8');
    
    // Remove non-digits after character replacements
    text = text.replace(/\D/g, '');
    if (text.length === 0) return null;
 
    let hpValue = parseInt(text, 10);
    if (isNaN(hpValue)) return null;
    
    // パターン補正: 耐久値は最大4桁で、1桁目は「1」か「2」になることが多い
    if (text.length === 4 && !['1', '2'].includes(text[0])) {
        // 例えば、先頭が '7' なら '1' に補正するなど
        if (text[0] === '7') {
            text = '1' + text.substring(1);
            hpValue = parseInt(text, 10);
        }
    }
    
    // 値が非現実的な場合はnullを返す（例: 3000以上など）
    if (hpValue > 3000) return null;

    return hpValue;
}

/**
 * 認識された覚醒ゲージの値を後処理で補正する
 * @param {string} rawText - OCRで認識された生のテキスト
 * @returns {number|null} - 補正後のゲージ値 or null
 */
function postProcessGauge(rawText) {
    // 典型的な誤認識を補正
    let text = rawText.replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5');
    
    // Remove non-digits after character replacements
    text = text.replace(/\D/g, '');
    if (text.length === 0) return null;
 
    let gaugeValue = parseInt(text, 10);
    if (isNaN(gaugeValue)) return null;

    // パターン補正: 覚醒ゲージは1から100まで
    if (gaugeValue > 100) {
        // '100'を'108'などと誤認識するケースを考慮
        if (text.startsWith('10') && text.length === 3) {
            return 100;
        }
        return null; // 100を超える値は無効とする
    }
    
    return gaugeValue;
}

/**
 * ROIからHP数値をOCRで読み取る
 * @param {CanvasRenderingContext2D} ctx - 元画像のコンテキスト
 * @param {object} roi - プレイヤーUIの領域
 * @returns {Promise<number|null>} - 認識したHP or null
 */
async function readHpFromRoi(ctx, roi) {
    // HPが表示されている領域をROIからさらに絞り込む
    const hpRoi = {
        x: roi.x + roi.width * 0.55,
        y: roi.y + roi.height * 0.1,
        width: roi.width * 0.4,
        height: roi.height * 0.5
    };

    // OCR精度向上のため、対象領域を拡大し、前処理を行う
    const scaleFactor = 3;
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width = hpRoi.width * scaleFactor;
    hpCanvas.height = hpRoi.height * scaleFactor;
    const hpCtx = hpCanvas.getContext('2d');
    
    // Nearest-neighbor scaling to avoid anti-aliasing and keep pixels sharp
    hpCtx.imageSmoothingEnabled = false; 
    hpCtx.drawImage(ctx.canvas, hpRoi.x, hpRoi.y, hpRoi.width, hpRoi.height, 0, 0, hpCanvas.width, hpCanvas.height);
    
    // PaddleOCRで認識実行
    const result = await paddleOcr.ocr(hpCanvas);
    const text = extractTextFromOcrResult(result);
    
    // 後処理とパターン補正
    const hpValue = postProcessHp(text);
    return hpValue;
}

/**
 * ROIから覚醒ゲージの割合をOCRで読み取る
 * @param {CanvasRenderingContext2D} ctx - 元画像のコンテキスト
 * @returns {Promise<number|null>} - ゲージの割合(%) or null
 */
async function readGaugeFromRoi(ctx) { 
    const width = ctx.canvas.width;
    const scale = width / 1920;

    // 覚醒値(中央下の数字)の領域を定義
    const awakeningValueRoi = {
        x: Math.round(930 * scale),
        y: Math.round(875 * scale),
        width: Math.round(60 * scale),
        height: Math.round(50 * scale)
    };

    // OCR用のキャンバスを作成し、前処理を行う
    const scaleFactor = 3;
    const awakeningCanvas = document.createElement('canvas');
    awakeningCanvas.width = awakeningValueRoi.width * scaleFactor;
    awakeningCanvas.height = awakeningValueRoi.height * scaleFactor;
    const awakeningCtx = awakeningCanvas.getContext('2d');

    awakeningCtx.imageSmoothingEnabled = false;
    awakeningCtx.drawImage(ctx.canvas, awakeningValueRoi.x, awakeningValueRoi.y, awakeningValueRoi.width, awakeningValueRoi.height, 0, 0, awakeningCanvas.width, awakeningCanvas.height);

    // PaddleOCRで認識実行
    const result = await paddleOcr.ocr(awakeningCanvas);
    const text = extractTextFromOcrResult(result);

    // 後処理とパターン補正
    const awakeningValue = postProcessGauge(text);
    
    return awakeningValue;
}

function processImageForOCR(file, progressCallback) {
    return new Promise(async (resolve, reject) => {
        if (!file) {
            return reject('ファイルが選択されていません。');
        }

        const imageBitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageBitmap, 0, 0);

        try {
            const worker = new Tesseract.TesseractWorker();
            
            const processAndRecognize = (region, lang, options) => {
                return new Promise((res, rej) => {
                    const tempCanvas = document.createElement('canvas');
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCanvas.width = region.width;
                    tempCanvas.height = region.height;
            
                    const imageData = ctx.getImageData(region.x, region.y, region.width, region.height);
                    const processedData = preprocessForTesseract(imageData);
                    tempCtx.putImageData(processedData, 0, 0);

                    worker.recognize(tempCanvas, lang, options)
                        .progress(p => {
                            if (progressCallback) {
                                progressCallback(p);
                            }
                        })
                        .then(result => res(result.text.trim()))
                        .catch(err => rej(err));
                });
            };

            const hpPromise = processAndRecognize(
                { x: canvas.width * 0.05, y: canvas.height * 0.2, width: canvas.width * 0.1, height: canvas.height * 0.05 },
                'eng',
                { 'tessedit_char_whitelist': '0123456789' }
            );

            const awakeningPromise = processAndRecognize(
                 { x: canvas.width * 0.4, y: canvas.height * 0.85, width: canvas.width * 0.05, height: canvas.height * 0.05 },
                'eng',
                { 'tessedit_char_whitelist': '0123456789' }
            );

            const [hp, awakening] = await Promise.all([hpPromise, awakeningPromise]);
            
            worker.terminate();
            resolve({ hp, awakening });

        } catch (error) {
            console.error("OCR処理中にエラーが発生しました:", error);
            reject(error);
        }
    });
}

function preprocessForTesseract(imageData) {
    const data = imageData.data;
    applyGrayscale(data);
    // You can add more preprocessing steps here if needed
    // e.g., applyContrast(data, 50);
    // applyMonochrome(data, 128); 
    return imageData;
}

function applyGrayscale(data) {
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg; 
        data[i + 1] = avg;
        data[i + 2] = avg;
    }
}

class GameOCR {
    constructor(callbacks) {
        this.callbacks = callbacks; // { onOcrComplete: function(results) }
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.currentImage = null;
        this.isProcessing = false;
        this.ocrReady = false; // Flag for OCR readiness
        this.lastOcrResult = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupRegionInteraction(this.durabilityRegion, 'durability');
        this.setupRegionInteraction(this.awakeningRegion, 'awakening');
        this.initializeOCR(); // Start loading OCR model
    }

    async initializeOCR() {
        try {
            // Wait for opencv.js to be ready
            const checkOpenCV = () => new Promise(resolve => {
                const interval = setInterval(() => {
                    if (window.cv) {
                        console.log('OpenCV is ready.');
                        clearInterval(interval);
                            resolve();
                        }
                    }, 100);
                });

            console.log('Waiting for OpenCV to load...');
            await checkOpenCV();
            
            // Wait for paddle to be ready (it's loaded via module script)
            const checkPaddle = () => new Promise(resolve => {
                 const interval = setInterval(() => {
                    if (window.paddle) {
                        console.log('Paddle module is ready.');
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            });

            console.log('Waiting for Paddle module to load...');
            await checkPaddle();

            console.log('Initializing PaddleOCR model...');
            const assetsPath = "https://cdn.jsdelivr.net/npm/paddleocr-browser/dist/";
            const res = await fetch(assetsPath + "ppocr_keys_v1.txt");
            const dic = await res.text();

            await window.paddle.init({
                detPath: assetsPath + "ppocr_det.onnx",
                recPath: assetsPath + "ppocr_rec.onnx",
                dic: dic,
                ort: window.ort,
                cv: window.cv
            });
            
            this.ocrReady = true;
            console.log('PaddleOCR initialization complete.');
            if (this.analyzeBtn) this.analyzeBtn.disabled = false;

        } catch (error) {
            console.error('Failed to initialize PaddleOCR:', error);
            alert('OCR engine failed to initialize. Please reload the page.');
        }
    }

    initializeElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.imageSection = document.getElementById('imageSection');
        this.resultsSection = document.getElementById('resultsSection');
        this.progressSection = document.getElementById('progressSection');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.resetBtn = document.getElementById('resetBtn');
        
        this.durabilityValue = document.getElementById('durabilityValue');
        this.durabilityConfidence = document.getElementById('durabilityConfidence');
        this.awakeningValue = document.getElementById('awakeningValue');
        this.awakeningConfidence = document.getElementById('awakeningConfidence');
        
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        
        this.durabilityRegion = document.getElementById('durabilityRegion');
        this.awakeningRegion = document.getElementById('awakeningRegion');

        this.durabilityPreview = document.getElementById('durabilityPreview');
        this.awakeningPreview = document.getElementById('awakeningPreview');
        this.durabilityContrast = document.getElementById('durabilityContrast');
        this.durabilityContrastValue = document.getElementById('durabilityContrastValue');
        this.durabilityZoom = document.getElementById('durabilityZoom');
        this.durabilityZoomValue = document.getElementById('durabilityZoomValue');
        this.durabilityErosion = document.getElementById('durabilityErosion');
        this.durabilityErosionValue = document.getElementById('durabilityErosionValue');
        this.awakeningContrast = document.getElementById('awakeningContrast');
        this.awakeningContrastValue = document.getElementById('awakeningContrastValue');
        this.awakeningZoom = document.getElementById('awakeningZoom');
        this.awakeningZoomValue = document.getElementById('awakeningZoomValue');
        this.awakeningErosion = document.getElementById('awakeningErosion');
        this.awakeningErosionValue = document.getElementById('awakeningErosionValue');

        this.analyzeBtn.disabled = true;
    }

    setupEventListeners() {
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        this.analyzeBtn.addEventListener('click', () => this.analyzeImage());
        this.resetBtn.addEventListener('click', () => this.reset());

        this.durabilityContrast.addEventListener('input', () => this.updatePreview('durability'));
        this.durabilityZoom.addEventListener('input', () => this.updatePreview('durability'));
        this.durabilityErosion.addEventListener('input', () => this.updatePreview('durability'));
        this.awakeningContrast.addEventListener('input', () => this.updatePreview('awakening'));
        this.awakeningZoom.addEventListener('input', () => this.updatePreview('awakening'));
        this.awakeningErosion.addEventListener('input', () => this.updatePreview('awakening'));
    }

    setupRegionInteraction(element, regionName) {
        const initDrag = (e) => {
            if (e.target.classList.contains('resizer')) return;
            e.preventDefault();
            const isTouchEvent = e.type === 'touchstart';
            const startX = isTouchEvent ? e.touches[0].clientX : e.clientX;
            const startY = isTouchEvent ? e.touches[0].clientY : e.clientY;
            const startLeft = element.offsetLeft;
            const startTop = element.offsetTop;
            element.style.cursor = 'grabbing';
            
            const doDrag = (moveEvent) => {
                if (isTouchEvent) moveEvent.preventDefault();
                const moveX = isTouchEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const moveY = isTouchEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
                const dx = moveX - startX;
                const dy = moveY - startY;
                let newLeft = startLeft + dx;
                let newTop = startTop + dy;
                
                const parentWidth = this.canvas.offsetWidth;
                const parentHeight = this.canvas.offsetHeight;
                const elementWidth = element.offsetWidth;
                const elementHeight = element.offsetHeight;
    
                newLeft = Math.max(0, Math.min(newLeft, parentWidth - elementWidth));
                newTop = Math.max(0, Math.min(newTop, parentHeight - elementHeight));
    
                element.style.left = (newLeft / parentWidth) * 100 + '%';
                element.style.top = (newTop / parentHeight) * 100 + '%';
                this.updatePreview(regionName);
            };
    
            const stopDrag = () => {
                element.style.cursor = 'move';
                document.removeEventListener(isTouchEvent ? 'touchmove' : 'mousemove', doDrag);
                document.removeEventListener(isTouchEvent ? 'touchend' : 'mouseup', stopDrag);
            };
    
            document.addEventListener(isTouchEvent ? 'touchmove' : 'mousemove', doDrag, { passive: false });
            document.addEventListener(isTouchEvent ? 'touchend' : 'mouseup', stopDrag);
        };
    
        element.addEventListener('mousedown', initDrag);
        element.addEventListener('touchstart', initDrag, { passive: false });
    
        const resizers = element.querySelectorAll('.resizer');
        resizers.forEach(resizer => {
            const initResize = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isTouchEvent = e.type === 'touchstart';
                let original_width = element.offsetWidth;
                let original_height = element.offsetHeight;
                let original_x = element.offsetLeft;
                let original_y = element.offsetTop;
                let original_mouse_x = isTouchEvent ? e.touches[0].clientX : e.clientX;
                let original_mouse_y = isTouchEvent ? e.touches[0].clientY : e.clientY;
                
                const doResize = (moveEvent) => {
                    if (isTouchEvent) moveEvent.preventDefault();
                    const moveX = isTouchEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
                    const moveY = isTouchEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
                    const dx = moveX - original_mouse_x;
                    const dy = moveY - original_mouse_y;
                    const parentWidth = this.canvas.offsetWidth;
                    const parentHeight = this.canvas.offsetHeight;
                    
                    if (resizer.classList.contains('se')) {
                        const width = original_width + dx;
                        const height = original_height + dy;
                        if (width > 20) element.style.width = (width / parentWidth * 100) + '%';
                        if (height > 20) element.style.height = (height / parentHeight * 100) + '%';
                    } else if (resizer.classList.contains('sw')) {
                        const width = original_width - dx;
                        const height = original_height + dy;
                        const left = original_x + dx;
                        if (width > 20) {
                            element.style.width = (width / parentWidth * 100) + '%';
                            element.style.left = (left / parentWidth * 100) + '%';
                        }
                        if (height > 20) element.style.height = (height / parentHeight * 100) + '%';
                    } else if (resizer.classList.contains('ne')) {
                        const width = original_width + dx;
                        const height = original_height - dy;
                        const top = original_y + dy;
                        if (width > 20) element.style.width = (width / parentWidth * 100) + '%';
                        if (height > 20) {
                            element.style.height = (height / parentHeight * 100) + '%';
                            element.style.top = (top / parentHeight * 100) + '%';
                        }
                    } else { // nw
                        const width = original_width - dx;
                        const height = original_height - dy;
                        const left = original_x + dx;
                        const top = original_y + dy;
                        if (width > 20) {
                            element.style.width = (width / parentWidth * 100) + '%';
                            element.style.left = (left / parentWidth * 100) + '%';
                        }
                        if (height > 20) {
                            element.style.height = (height / parentHeight * 100) + '%';
                            element.style.top = (top / parentHeight * 100) + '%';
                        }
                    }
                    this.updatePreview(regionName);
                };
                
                const stopResize = () => {
                    document.removeEventListener(isTouchEvent ? 'touchmove' : 'mousemove', doResize);
                    document.removeEventListener(isTouchEvent ? 'touchend' : 'mouseup', stopResize);
                };
    
                document.addEventListener(isTouchEvent ? 'touchmove' : 'mousemove', doResize, { passive: false });
                document.addEventListener(isTouchEvent ? 'touchend' : 'mouseup', stopResize);
            };
    
            resizer.addEventListener('mousedown', initResize);
            resizer.addEventListener('touchstart', initResize, { passive: false });
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) this.loadImage(files[0]);
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) this.loadImage(file);
    }

    loadImage(file) {
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください。');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                this.showImageSection();
                this.displayImage(img);
                this.detectActivePlayer();
                this.updateAllPreviews();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    displayImage(img) {
        const maxWidth = this.canvas.parentElement.clientWidth;
        const maxHeight = window.innerHeight * 0.6;
        let { width, height } = img;
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.drawImage(img, 0, 0, width, height);
    }

    showImageSection() {
        this.imageSection.style.display = 'block';
        this.resultsSection.style.display = 'block';
        this.imageSection.classList.add('fade-in');
        this.resultsSection.classList.add('fade-in');
    }

    detectActivePlayer() {
        this.durabilityRegion.style.top = '28%';
        this.durabilityRegion.style.left = '10%';
        this.durabilityRegion.style.width = '4%';
        this.durabilityRegion.style.height = '4%';
    
        this.awakeningRegion.style.top = '88%';
        this.awakeningRegion.style.left = '40%';
        this.awakeningRegion.style.width = '3%';
        this.awakeningRegion.style.height = '5%';
    }

    async analyzeImage() {
        if (!this.currentImage || this.isProcessing) return;
        this.isProcessing = true;
        this.analyzeBtn.disabled = true;
        this.showProgress();
        try {
            this.updateProgress(10, '耐久値の領域を準備中...');
            const durabilityCanvas = this.preprocessRegion({
                regionElement: this.durabilityRegion,
                contrast: this.durabilityContrast.value,
                zoom: this.durabilityZoom.value,
                erosion: this.durabilityErosion.value
            });
            this.updateProgress(20, '耐久値を認識中...');
            const durabilityResult = await this.performOCR(durabilityCanvas, '耐久値');

            this.updateProgress(50, '覚醒ゲージの領域を準備中...');
            const awakeningCanvas = this.preprocessRegion({
                regionElement: this.awakeningRegion,
                contrast: this.awakeningContrast.value,
                zoom: this.awakeningZoom.value,
                erosion: this.awakeningErosion.value
            });
            this.updateProgress(60, '覚醒ゲージを認識中...');
            const awakeningResult = await this.performOCR(awakeningCanvas, '覚醒ゲージ');

            this.updateProgress(95, '結果を表示しています...');
            this.displayResults(durabilityResult, awakeningResult);
            this.lastOcrResult = { durability: durabilityResult, awakening: awakeningResult };
            if (this.callbacks.onOcrComplete) {
                this.callbacks.onOcrComplete(this.lastOcrResult);
            }
        } catch (error) {
            console.error('OCR処理エラー:', error);
            if (error.message !== 'OCR not initialized') {
                 alert('OCR処理中にエラーが発生しました。詳細はコンソールを確認してください。');
            }
        } finally {
            this.isProcessing = false;
            this.analyzeBtn.disabled = !this.ocrReady;
            this.hideProgress();
        }
    }

    preprocessRegion(params) {
        const extractedCanvas = this.extractRegion(params.regionElement);
        return this.preprocessImage(extractedCanvas, params.contrast, params.zoom, params.erosion);
    }

    extractRegion(regionElement) {
        const rect = regionElement.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = ((rect.left - canvasRect.left) / canvasRect.width) * this.canvas.width;
        const y = ((rect.top - canvasRect.top) / canvasRect.height) * this.canvas.height;
        const width = (rect.width / canvasRect.width) * this.canvas.width;
        const height = (rect.height / canvasRect.height) * this.canvas.height;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCtx.drawImage(this.canvas, x, y, width, height, 0, 0, width, height);
        return tempCanvas;
    }

    preprocessImage(canvas, contrast, zoom, numOpening) {
        if (!window.cv || !this.currentImage) return canvas;
        const numContrast = parseFloat(contrast);
        const numZoom = parseFloat(zoom);
        const numOpeningValue = parseInt(numOpening, 10); // スライダーの値を取得

        const dsize = new cv.Size(canvas.width * numZoom, canvas.height * numZoom);
        let src = cv.imread(canvas);
        let dst = new cv.Mat();
        
        // 元の処理
        cv.resize(src, dst, dsize, 0, 0, cv.INTER_CUBIC);
        cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);
        
        let noiseReduced = new cv.Mat();
        cv.medianBlur(dst, noiseReduced, 3);
        
        let contrasted = new cv.Mat();
        noiseReduced.convertTo(contrasted, -1, numContrast, 0);
        
        let binarized = new cv.Mat();
        cv.adaptiveThreshold(contrasted, binarized, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

        let imageToDisplay = new cv.Mat();

        if (numOpeningValue > 0) {
            // Opening処理（cv.MORPH_OPEN）を実行
            // カーネルサイズをスライダーの値に基づいて動的に設定
            let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(numOpeningValue + 1, numOpeningValue + 1));
            cv.morphologyEx(binarized, imageToDisplay, cv.MORPH_OPEN, kernel);
            kernel.delete(); // カーネルはここで解放
        } else {
            // スライダーが0の場合は二値化された画像をそのまま表示
            binarized.copyTo(imageToDisplay);
        }

        cv.imshow(canvas, imageToDisplay); // 最終的に表示するのはOpening後の画像

        // メモリ解放
        src.delete();
        dst.delete();
        noiseReduced.delete();
        binarized.delete();
        contrasted.delete();
        imageToDisplay.delete();

        return canvas;
    }

    async performOCR(canvas, type) {
        if (!this.ocrReady) {
            alert('OCR engine is not ready. Please wait a moment and try again.');
            throw new Error('OCR not initialized');
        }
        try {
            // The result format from esearch-ocr is { src: [{text, mean, box}, ...] }
            const results = await window.paddle.ocr(canvas);
            let value = '';
            let highestConfidence = 0;

            if (results && results.src && results.src.length > 0) {
                 const numbers = results.src
                     .map(item => item.text.replace(/\D/g, '')) // Get only digits
                     .join('');
                 value = numbers;
                 // 'mean' is the confidence score (0-1) in this library
                 highestConfidence = Math.max(...results.src.map(item => item.mean));
            }
            return { value, confidence: Math.round(highestConfidence * 100) };
            
        } catch (error) {
            console.error(`OCR processing error (${type}):`, error);
            return { value: '', confidence: 0 };
        }
    }

    displayResults(durabilityResult, awakeningResult) {
        this.durabilityValue.textContent = durabilityResult.value || '-';
        this.durabilityConfidence.textContent = durabilityResult.value ? `(信頼度: ${durabilityResult.confidence}%)` : '';
        this.awakeningValue.textContent = awakeningResult.value || '-';
        this.awakeningConfidence.textContent = awakeningResult.value ? `(信頼度: ${awakeningResult.confidence}%)` : '';
        this.resultsSection.classList.add('pulse');
        setTimeout(() => this.resultsSection.classList.remove('pulse'), 2000);
    }

    showProgress() {
        this.progressSection.style.display = 'block';
        this.updateProgress(0, '処理を開始しています...');
    }

    hideProgress() {
        this.progressSection.style.display = 'none';
    }

    updateProgress(percent, text) {
        this.progressFill.style.width = percent + '%';
        this.progressText.textContent = text;
    }

    reset() {
        this.currentImage = null;
        this.imageSection.style.display = 'none';
        this.resultsSection.style.display = 'none';
        this.hideProgress();
        this.durabilityValue.textContent = '-';
        this.durabilityConfidence.textContent = '';
        this.awakeningValue.textContent = '-';
        this.awakeningConfidence.textContent = '';
        this.fileInput.value = '';
        this.detectActivePlayer();
        this.updateAllPreviews();
        this.lastOcrResult = null;
    }

    updateAllPreviews() {
        if (!this.currentImage) return;
        this.updatePreview('durability');
        this.updatePreview('awakening');
    }

    updatePreview(regionName) {
        if (!this.currentImage) return;
        let regionElement, previewCanvas, contrast, zoom, erosion;
        if (regionName === 'durability') {
            regionElement = this.durabilityRegion;
            previewCanvas = this.durabilityPreview;
            contrast = this.durabilityContrast.value;
            zoom = this.durabilityZoom.value;
            erosion = this.durabilityErosion.value;
            
            this.durabilityContrastValue.textContent = parseFloat(contrast).toFixed(1);
            this.durabilityZoomValue.textContent = parseFloat(zoom).toFixed(1);
            this.durabilityErosionValue.textContent = erosion;
        } else {
            regionElement = this.awakeningRegion;
            previewCanvas = this.awakeningPreview;
            contrast = this.awakeningContrast.value;
            zoom = this.awakeningZoom.value;
            erosion = this.awakeningErosion.value;
            
            this.awakeningContrastValue.textContent = parseFloat(contrast).toFixed(1);
            this.awakeningZoomValue.textContent = parseFloat(zoom).toFixed(1);
            this.awakeningErosionValue.textContent = erosion;
        }
        const extractedCanvas = this.extractRegion(regionElement);
        const processedCanvas = this.preprocessImage(extractedCanvas, contrast, zoom, erosion);
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        const hRatio = previewCanvas.width / processedCanvas.width;
        const vRatio = previewCanvas.height / processedCanvas.height;
        const ratio = Math.min(hRatio, vRatio) * 0.9;
        const centerShiftX = (previewCanvas.width - processedCanvas.width * ratio) / 2;
        const centerShiftY = (previewCanvas.height - processedCanvas.height * ratio) / 2;
        previewCtx.drawImage(processedCanvas, 0, 0, processedCanvas.width, processedCanvas.height,
            centerShiftX, centerShiftY, processedCanvas.width * ratio, processedCanvas.height * ratio);
    }
}

export { processImageForOCR, GameOCR }; 