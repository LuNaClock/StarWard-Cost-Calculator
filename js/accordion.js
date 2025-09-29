// アコーディオン専用モジュール - シンプル版
class AccordionManager {
    constructor() {
        this.initialized = false;
    }

    // 初期化
    init() {
        if (this.initialized) return;
        
        this.setupEventListeners();
        this.initialized = true;
        console.log('AccordionManager initialized');
    }

    // イベントリスナーの設定
    setupEventListeners() {
        // メインアコーディオン
        const mainHeaders = document.querySelectorAll('.accordion-header:not(.sub-accordion-header)');
        mainHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAccordion(header);
            });
        });

        // サブアコーディオン
        const subHeaders = document.querySelectorAll('.sub-accordion-header');
        subHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAccordion(header);
            });
        });

        // 総合HPアコーディオン
        const totalHpHeaders = document.querySelectorAll('.total-hp-accordion-header');
        totalHpHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAccordion(header);
            });
        });

        console.log(`Setup ${mainHeaders.length + subHeaders.length + totalHpHeaders.length} accordion listeners`);
    }

    // アコーディオンの切り替え
    toggleAccordion(header) {
        const content = header.nextElementSibling;
        if (!content || (!content.classList.contains('accordion-content') && !content.classList.contains('total-hp-accordion-content'))) {
            console.warn('Accordion content not found for header:', header);
            return;
        }

        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        
        if (isExpanded) {
            // 閉じる
            header.setAttribute('aria-expanded', 'false');
            header.classList.remove('active');
            content.classList.remove('show');
        } else {
            // 開く
            header.setAttribute('aria-expanded', 'true');
            header.classList.add('active');
            content.classList.add('show');
            
            // インラインスタイルを削除して確実に表示
            this.clearInlineStyles(content);
            
            // スクロールしてアコーディオンが見えるようにする
            setTimeout(() => {
                // サブアコーディオンの場合は、親アコーディオンも開いてからスクロール
                if (header.classList.contains('sub-accordion-header')) {
                    const parentAccordion = header.closest('.accordion');
                    if (parentAccordion) {
                        const parentHeader = parentAccordion.querySelector('.accordion-header');
                        if (parentHeader && parentHeader.getAttribute('aria-expanded') !== 'true') {
                            this.toggleAccordion(parentHeader);
                        }
                    }
                }
                header.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
        
        console.log(`Accordion toggled: ${header.textContent.trim()} - ${isExpanded ? 'closed' : 'opened'}`);
    }

    // インラインスタイルの削除
    clearInlineStyles(element) {
        const stylesToRemove = [
            'opacity', 'transform', 'max-height', 'padding-top', 
            'padding-bottom', 'margin-top', 'border-width', 
            'overflow', 'scale-y'
        ];
        
        stylesToRemove.forEach(style => {
            element.style.removeProperty(style);
        });
    }

    // 初期状態の設定
    setInitialState() {
        // 特定のアコーディオンを初期状態で閉じる
        const accordionsToClose = [
            '#total-hp-accordion .accordion-header',
            '#selected-characters-full-card-accordion .accordion-header'
        ];

        accordionsToClose.forEach(selector => {
            const header = document.querySelector(selector);
            if (header) {
                const content = header.nextElementSibling;
                if (content && (content.classList.contains('accordion-content') || content.classList.contains('total-hp-accordion-content'))) {
                    header.setAttribute('aria-expanded', 'false');
                    header.classList.remove('active');
                    content.classList.remove('show');
                }
            }
        });

        // 再出撃シミュレーションのアコーディオンを初期状態で開く
        const redeploySimulationHeader = document.querySelector('#redeploy-simulation-section .accordion-header');
        if (redeploySimulationHeader) {
            const content = redeploySimulationHeader.nextElementSibling;
            if (content && content.classList.contains('accordion-content')) {
                // HTMLでaria-expanded="true"が設定されている場合のみ開く
                if (redeploySimulationHeader.getAttribute('aria-expanded') === 'true') {
                    redeploySimulationHeader.classList.add('active');
                    content.classList.add('show');
                    this.clearInlineStyles(content);
                }
            }
        }
    }

    // 特定のアコーディオンを開く
    openAccordion(header) {
        if (!header) return;
        
        const content = header.nextElementSibling;
        if (!content || (!content.classList.contains('accordion-content') && !content.classList.contains('total-hp-accordion-content'))) {
            console.warn('Accordion content not found for header:', header);
            return;
        }

        // 既に開いている場合は何もしない
        if (header.getAttribute('aria-expanded') === 'true') {
            return;
        }

        // 開く
        header.setAttribute('aria-expanded', 'true');
        header.classList.add('active');
        content.classList.add('show');
        
        // インラインスタイルを削除して確実に表示
        this.clearInlineStyles(content);
        
        // スクロールしてアコーディオンが見えるようにする
        setTimeout(() => {
            // サブアコーディオンの場合は、親アコーディオンも開いてからスクロール
            if (header.classList.contains('sub-accordion-header')) {
                const parentAccordion = header.closest('.accordion');
                if (parentAccordion) {
                    const parentHeader = parentAccordion.querySelector('.accordion-header');
                    if (parentHeader && parentHeader.getAttribute('aria-expanded') !== 'true') {
                        this.openAccordion(parentHeader);
                    }
                }
            }
            header.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        
        console.log(`Accordion opened: ${header.textContent.trim()}`);
    }
}

// シングルトンインスタンス
export const accordionManager = new AccordionManager();

// 便利な関数をエクスポート
export function initAccordions() {
    accordionManager.init();
    accordionManager.setInitialState();
}

export function openAccordion(selector) {
    const header = document.querySelector(selector);
    if (header) {
        accordionManager.toggleAccordion(header);
    }
}

export function closeAccordion(selector) {
    const header = document.querySelector(selector);
    if (header) {
        const content = header.nextElementSibling;
        if (content && (content.classList.contains('accordion-content') || content.classList.contains('total-hp-accordion-content'))) {
            header.setAttribute('aria-expanded', 'false');
            header.classList.remove('active');
            content.classList.remove('show');
        }
    }
} 