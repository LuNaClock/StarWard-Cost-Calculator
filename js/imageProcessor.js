import * as DOM from './domElements.js';

// --- グローバル変数と設定 ---
let tesseractWorker = null;
const STATUS_ELEMENT = DOM.imageUploadStatus; // DOMからステータス表示用のp要素を取得

// --- Tesseract.js ワーカーの初期化 ---
async function initializeWorker() {
    if (tesseractWorker) return; // 既に初期化済み
    
    if (STATUS_ELEMENT) STATUS_ELEMENT.textContent = 'OCRエンジンを初期化中...';

    // Safer, spec-compliant initialisation
    tesseractWorker = await Tesseract.createWorker('eng');

    await tesseractWorker.setParameters({
        tessedit_char_whitelist: '0123456789', // 認識対象を数字のみに限定し、精度を向上
    });
    if (STATUS_ELEMENT) STATUS_ELEMENT.textContent = 'OCRエンジン準備完了。画像を選択してください。';
}

// --- メインの画像処理関数 ---
export async function processImageFromFile(file) {
    if (!file) return;
    await initializeWorker(); // ワーカーが準備できていることを確認

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
            // デバッグ用に検出領域を赤枠で描画
            // ctx.strokeStyle = 'red';
            // ctx.lineWidth = 3;
            // ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
            // document.body.appendChild(canvas); // 画面に表示して確認

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

    // OCR精度向上のため、対象領域を拡大し、白黒反転・二値化する前処理
    const scaleFactor = 2;
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width = hpRoi.width * scaleFactor;
    hpCanvas.height = hpRoi.height * scaleFactor;
    const hpCtx = hpCanvas.getContext('2d');
    
    // Nearest-neighbor scaling to avoid anti-aliasing and keep pixels sharp
    hpCtx.imageSmoothingEnabled = false; 
    hpCtx.drawImage(ctx.canvas, hpRoi.x, hpRoi.y, hpRoi.width, hpRoi.height, 0, 0, hpCanvas.width, hpCanvas.height);
    
    const imageData = hpCtx.getImageData(0, 0, hpCanvas.width, hpCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // 輝度が高い(白っぽい)ピクセルを黒、それ以外を白にする。閾値を微調整。
        const color = brightness > 170 ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = color;
    }
    hpCtx.putImageData(imageData, 0, 0);

    // Tesseractで認識実行
    const { data: { text } } = await tesseractWorker.recognize(hpCanvas);
    const hpValue = parseInt(text.replace(/\D/g, ''), 10);
    return isNaN(hpValue) ? null : hpValue;
}

/**
 * ROIから覚醒ゲージの割合をピクセル解析で読み取る
 * @param {CanvasRenderingContext2D} ctx - 元画像のコンテキスト
 * @param {object} roi - プレイヤーUIの領域
 * @returns {Promise<number|null>} - ゲージの割合(%) or null
 */
async function readGaugeFromRoi(ctx, roi) {
    // 覚醒ゲージのバーがある領域をROIからさらに絞り込む
    const gaugeRoi = {
        x: roi.x + roi.width * 0.25,
        y: roi.y + roi.height * 0.65,
        width: roi.width * 0.7,
        height: roi.height * 0.2
    };

    const imageData = ctx.getImageData(gaugeRoi.x, gaugeRoi.y, gaugeRoi.width, gaugeRoi.height).data;
    let gaugePixels = 0;
    let backgroundPixels = 0;

    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2];
        const brightness = (r + g + b) / 3;

        // ゲージの色（白=高輝度）か、背景色（暗い色）かを明るさで判定する
        if (brightness > 150) { // 明るいピクセル (ゲージ)
            gaugePixels++;
        } else if (brightness < 80) { // 暗いピクセル (背景)
            backgroundPixels++;
        }
    }

    const totalPixels = gaugePixels + backgroundPixels;
    if (totalPixels < 10) return null; // ゲージがほとんど見つからない場合

    const percentage = Math.round((gaugePixels / totalPixels) * 100);
    return Math.max(0, Math.min(100, percentage));
} 