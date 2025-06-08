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
            const checkOpenCV = () => {
                return new Promise(resolve => {
                    const interval = setInterval(() => {
                        if (window.cv) {
                            clearInterval(interval);
                            resolve();
                        }
                    }, 100);
                });
            };

            console.log('OpenCVのロードを待っています...');
            await checkOpenCV();
            console.log('OpenCVのロードが完了しました。');
            
            console.log('PaddleOCRモデルを初期化しています...');
            const assetsPath = "https://cdn.jsdelivr.net/npm/paddleocr-browser/dist/";
            const res = await fetch(assetsPath + "ppocr_keys_v1.txt");
            const dic = await res.text();

            await window.Paddle.init({
                detPath: assetsPath + "ppocr_det.onnx",
                recPath: assetsPath + "ppocr_rec.onnx",
                dic: dic,
                ort: window.ort,
                cv: window.cv
            });
            
            this.ocrReady = true;
            console.log('PaddleOCRの初期化が完了しました。');
            this.analyzeBtn.disabled = false; // Enable button once ready
        } catch (error) {
            console.error('PaddleOCRの初期化に失敗しました:', error);
            alert('OCRエンジンの初期化に失敗しました。ページをリロードしてください。');
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
        
        // Result elements
        this.durabilityValue = document.getElementById('durabilityValue');
        this.durabilityConfidence = document.getElementById('durabilityConfidence');
        this.awakeningValue = document.getElementById('awakeningValue');
        this.awakeningConfidence = document.getElementById('awakeningConfidence');
        
        // Progress elements
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        
        // Region elements
        this.durabilityRegion = document.getElementById('durabilityRegion');
        this.awakeningRegion = document.getElementById('awakeningRegion');

        // Preview and preprocessing elements
        this.durabilityPreview = document.getElementById('durabilityPreview');
        this.awakeningPreview = document.getElementById('awakeningPreview');
        this.durabilityContrast = document.getElementById('durabilityContrast');
        this.durabilityZoom = document.getElementById('durabilityZoom');
        this.awakeningContrast = document.getElementById('awakeningContrast');
        this.awakeningZoom = document.getElementById('awakeningZoom');

        // Initial state
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
        this.awakeningContrast.addEventListener('input', () => this.updatePreview('awakening'));
        this.awakeningZoom.addEventListener('input', () => this.updatePreview('awakening'));
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
                this.displayImage(img);
                this.showImageSection();
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
        // This is a placeholder for a more complex detection logic.
        // For now, it sets a default position.
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
                zoom: this.durabilityZoom.value
            });
            this.updateProgress(20, '耐久値を認識中...');
            const durabilityResult = await this.performOCR(durabilityCanvas, '耐久値');

            this.updateProgress(50, '覚醒ゲージの領域を準備中...');
            const awakeningCanvas = this.preprocessRegion({
                regionElement: this.awakeningRegion,
                contrast: this.awakeningContrast.value,
                zoom: this.awakeningZoom.value
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
        return this.preprocessImage(extractedCanvas, params.contrast, params.zoom);
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

    preprocessImage(canvas, contrast, zoom) {
        if (!window.cv || !this.currentImage) return canvas;
        const numContrast = parseFloat(contrast);
        const numZoom = parseFloat(zoom);
        const dsize = new cv.Size(canvas.width * numZoom, canvas.height * numZoom);
        const src = cv.imread(canvas);
        const dst = new cv.Mat();
        cv.resize(src, dst, dsize, 0, 0, cv.INTER_CUBIC);
        cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);
        const noiseReduced = new cv.Mat();
        cv.medianBlur(dst, noiseReduced, 3);
        const contrasted = new cv.Mat();
        noiseReduced.convertTo(contrasted, -1, numContrast, 0); 
        const binarized = new cv.Mat();
        cv.adaptiveThreshold(contrasted, binarized, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
        cv.imshow(canvas, binarized);
        src.delete();
        dst.delete();
        noiseReduced.delete();
        binarized.delete();
        contrasted.delete();
        return canvas;
    }

    async performOCR(canvas, type) {
        if (!this.ocrReady) {
            alert('OCRエンジンがまだ準備できていません。少し待ってから再試行してください。');
            throw new Error('OCR not initialized');
        }
        try {
            const results = await window.Paddle.ocr(canvas);
            let value = '';
            let highestConfidence = 0;
            if (results && results.src && results.src.length > 0) {
                 const numbers = results.src.map(item => item.text.replace(/\D/g, '')).join('');
                 value = numbers;
                 highestConfidence = Math.max(...results.src.map(item => item.mean));
            }
            return { value, confidence: Math.round(highestConfidence * 100) };
        } catch (error) {
            console.error(`OCR処理エラー (${type}):`, error);
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
        this.detectActivePlayer(); // Reset region positions to default
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
        let regionElement, previewCanvas, contrast, zoom;
        if (regionName === 'durability') {
            regionElement = this.durabilityRegion;
            previewCanvas = this.durabilityPreview;
            contrast = this.durabilityContrast.value;
            zoom = this.durabilityZoom.value;
        } else {
            regionElement = this.awakeningRegion;
            previewCanvas = this.awakeningPreview;
            contrast = this.awakeningContrast.value;
            zoom = this.awakeningZoom.value;
        }
        const extractedCanvas = this.extractRegion(regionElement);
        const processedCanvas = this.preprocessImage(extractedCanvas, contrast, zoom);
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

export default GameOCR; 