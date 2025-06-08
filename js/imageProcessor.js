import * as DOM from './domElements.js';

// --- グローバル変数と設定 ---
let paddleOcr = null;
const STATUS_ELEMENT = DOM.imageUploadStatus; // DOMからステータス表示用のp要素を取得

// --- PaddleOCR の初期化 ---
async function initializeOcr() {
    if (paddleOcr) return; // 既に初期化済み
    
    if (STATUS_ELEMENT) STATUS_ELEMENT.textContent = 'OCRエンジンを初期化中...';
    
    try {
        paddleOcr = await PaddleocrBrowser.create({
            det: "ch_PP-OCRv4_det",
            rec: "en_number_v2.0",
            cls: false, // For text direction classification, not needed for numbers
        });
        if (STATUS_ELEMENT) STATUS_ELEMENT.textContent = 'OCRエンジン準備完了。画像を選択してください。';
    } catch (error) {
        console.error("PaddleOCRの初期化に失敗しました:", error);
        if (STATUS_ELEMENT) STATUS_ELEMENT.textContent = 'エラー: OCRエンジンの初期化に失敗しました。';
        paddleOcr = null; // 初期化失敗を明示
    }
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
                readGaugeFromRoi(ctx, roi)
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
    if (!ocrResult || ocrResult.length === 0) {
        return '';
    }
    // 信頼度の高い順にソートし、テキストを結合する
    return ocrResult
        .flatMap(line => line.text)
        .sort((a, b) => b[1] - a[1]) // 信頼度（confidence）で降順ソート
        .map(item => item[0]) // テキスト部分のみ抽出
        .join('');
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
 * @param {object} roi - プレイヤーUIの領域 (この関数では未使用)
 * @returns {Promise<number|null>} - ゲージの割合(%) or null
 */
async function readGaugeFromRoi(ctx, roi) { 
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