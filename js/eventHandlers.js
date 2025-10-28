import * as DOM from './domElements.js';
import * as State from './state.js';
import * as UI from './ui.js';
import { applyFiltersAndSearch, processTeamHpCombinations, processSimulateRedeploy, processAwakeningGaugeCalculation } from './app.js';
import { MAX_TEAM_COST } from '../data.js';
import * as Sharing from './sharing.js'; 
import { accordionManager } from './accordion.js';

let isComposing = false;
let searchTimeoutLocal;

function handleCharacterSearchInput() {
    if (!isComposing) {
        clearTimeout(searchTimeoutLocal);
        searchTimeoutLocal = setTimeout(applyFiltersAndSearch, 300);
    }
}

function handleCharacterSearchComposition(event) {
    isComposing = event.type === 'compositionstart';
    if (event.type === 'compositionend') {
        clearTimeout(searchTimeoutLocal);
        applyFiltersAndSearch(); 
    }
}

function handleCharacterSearchBlur() {
    if (!isComposing) {
        clearTimeout(searchTimeoutLocal);
        applyFiltersAndSearch();
    }
}

function handleFilterButtonClick(event, filterType) {
    const button = event.target.closest('.filter-button');
    if (!button) return;

    const groupSelector = filterType === 'cost' ? '#costFilter .filter-button' : '#sortFilter .filter-button';
    document.querySelectorAll(groupSelector).forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    applyFiltersAndSearch();
}

// 新規追加: 不足している関数を追加
function handleCharacterCardClick(event) {
    const clickedElement = event.target;
    const card = clickedElement.closest('.character-card');
    if (!card) return;

    const originalHp = parseFloat(card.dataset.originalHp);
    const clickedRedeployCell = clickedElement.closest('.cost-table td[data-redeploy-hp]');

    if (clickedRedeployCell && clickedRedeployCell.dataset.redeployHp) {
        UI.animateHpDisplayOnCard(card, parseFloat(clickedRedeployCell.dataset.redeployHp));
    } else if (clickedElement.classList.contains('character-hp')) {
        UI.animateHpDisplayOnCard(card, originalHp);
    }
}

function handlePlayerCharSelectChange(event) {
    State.setSelectedPlayerChar(event.target.value);
    UI.syncCharacterPickerSelection('player');
    UI.updateTeamCostDisplay(MAX_TEAM_COST);
    UI.updateSelectedCharactersDisplay();
    UI.resetSimulationResultsUI();
    processTeamHpCombinations();
}

function handlePartnerCharSelectChange(event) {
    State.setSelectedPartnerChar(event.target.value);
    UI.syncCharacterPickerSelection('partner');
    UI.updateTeamCostDisplay(MAX_TEAM_COST);
    UI.updateSelectedCharactersDisplay();
    UI.resetSimulationResultsUI();
    processTeamHpCombinations();
}

function handleAwakeningInputChange() {
    processAwakeningGaugeCalculation();
}

function handleDamageDealtCheckboxChange(event) {
    if (DOM.damageDealtOptionsContainer) {
        DOM.damageDealtOptionsContainer.style.display = event.target.checked ? 'block' : 'none';
    }
    if (!event.target.checked && DOM.damageDealtAwakeningBonusSelect) {
        DOM.damageDealtAwakeningBonusSelect.value = "0";
    }
    processAwakeningGaugeCalculation();
}

function handleShieldSuccessCheckboxChange(event) {
    if (DOM.shieldSuccessOptionsContainer) {
        DOM.shieldSuccessOptionsContainer.style.display = event.target.checked ? 'block' : 'none';
    }
    if (!event.target.checked && DOM.shieldSuccessAwakeningBonusSelect) {
        DOM.shieldSuccessAwakeningBonusSelect.value = "0";
    }
    processAwakeningGaugeCalculation();
}

function handleShareRedeployResult() {
    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    const redeployCharName = DOM.redeployCharNameSpan.textContent;
    const redeployCalculatedHp = DOM.redeployCalculatedHpSpan.textContent;
    const predictedAwakeningGauge = DOM.predictedAwakeningGaugeSpan.textContent;
    const awakeningAvailability = DOM.awakeningAvailabilitySpan.textContent;

    if (redeployCharName === '--' || !playerChar || !partnerChar) {
        alert('共有するシミュレーション結果がありません。先にシミュレーションを実行してください。');
        return;
    }
    
    let summaryText = `【星の翼 耐久シミュ】\n自機: ${playerChar.name}(コスト${playerChar.cost.toFixed(1)})\n相方: ${partnerChar.name}(コスト${partnerChar.cost.toFixed(1)})\n`;
    summaryText += `残りコスト${DOM.remainingTeamCostInput.value}で ${redeployCharName} が再出撃 → HP ${redeployCalculatedHp}！\n`;
    if (predictedAwakeningGauge !== '--') {
        summaryText += `覚醒予測: ${predictedAwakeningGauge}% (${awakeningAvailability})\n`;
    }
    summaryText += "\n詳細はこちらでチェック！";

    const shareUrl = Sharing.generateShareUrlForRedeploy();
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(summaryText)}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent('星の翼,耐久シミュレーター')}`;
    window.open(twitterIntentUrl, '_blank');
}

function handleShareTotalHpResult() {
    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();

    if (!playerChar || !partnerChar || DOM.idealGainedHpSpan.textContent === '--') {
        alert('共有するチーム合計耐久予測がありません。自機と相方を選択してください。');
        return;
    }

    let summaryText = `【星の翼 チーム耐久予測】\n自機: ${playerChar.name}(コスト${playerChar.cost.toFixed(1)})\n相方: ${partnerChar.name}(コスト${partnerChar.cost.toFixed(1)})\n\n`;
    summaryText += `理想耐久: ${DOM.idealGainedHpSpan.textContent}\n`;
    summaryText += `妥協耐久: ${DOM.minGainedHpSpan.textContent}\n`;
    summaryText += `爆弾耐久: ${DOM.bombGainedHpSpan.textContent}\n`;
    summaryText += `最低耐久: ${DOM.lowestGainedHpSpan.textContent}\n`;
    summaryText += "\n詳細はこちらでチェック！";
    
    const shareUrl = Sharing.generateShareUrlForTotalHp();
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(summaryText)}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent('星の翼,耐久シミュレーター')}`;
    window.open(twitterIntentUrl, '_blank');
}

function handleCopyRedeployUrl(event) {
    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    if (DOM.redeployCharNameSpan.textContent === '--' || !playerChar || !partnerChar) {
        alert('URLを生成するためのシミュレーション結果がありません。');
        return;
    }
    const urlToCopy = Sharing.generateShareUrlForRedeploy();
    Sharing.copyUrlToClipboard(urlToCopy, event.currentTarget); 
}

function handleCopyTotalHpUrl(event) {
    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    if (!playerChar || !partnerChar || DOM.idealGainedHpSpan.textContent === '--') {
        alert('URLを生成するためのチーム合計耐久予測がありません。');
        return;
    }
    const urlToCopy = Sharing.generateShareUrlForTotalHp();
    Sharing.copyUrlToClipboard(urlToCopy, event.currentTarget); 
}

function setupCharacterPickerEventListeners() {
    const pickerTypes = ['player', 'partner'];

    pickerTypes.forEach(type => {
        const refs = UI.getCharacterPickerRefs(type);
        if (!refs) return;

        if (refs.toggle) {
            refs.toggle.addEventListener('click', () => {
                UI.toggleCharacterPicker(type);
                if (UI.isCharacterPickerOpen(type)) {
                    UI.focusCharacterPickerSearch(type);
                }
            });
        }

        if (refs.searchInput) {
            refs.searchInput.addEventListener('input', event => {
                UI.setCharacterPickerSearchTerm(type, event.target.value);
            });

            refs.searchInput.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    const firstIndex = UI.getFirstFilteredCharacterIndex(type);
                    if (firstIndex !== null && firstIndex !== undefined) {
                        UI.selectCharacterFromPicker(type, firstIndex);
                    }
                    event.preventDefault();
                } else if (event.key === 'Escape') {
                    UI.closeCharacterPicker(type);
                    refs.toggle?.focus();
                }
            });
        }

        if (refs.costButtons && refs.costButtons.length > 0) {
            refs.costButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const costValue = button.dataset.cost || 'all';
                    UI.setCharacterPickerCostFilter(type, costValue);
                });
            });
        }

        if (refs.list) {
            refs.list.addEventListener('click', event => {
                const item = event.target.closest('.character-picker-item');
                if (!item) return;

                const dataIndex = item.dataset.index;
                if (typeof dataIndex === 'undefined') return;

                if (dataIndex === '') {
                    UI.selectCharacterFromPicker(type, null);
                    return;
                }

                const parsedIndex = parseInt(dataIndex, 10);
                if (Number.isNaN(parsedIndex) || parsedIndex < 0) return;
                UI.selectCharacterFromPicker(type, parsedIndex);
            });
        }

        if (refs.container) {
            refs.container.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    UI.closeCharacterPicker(type);
                    refs.toggle?.focus();
                }
            });
        }
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('.character-picker')) {
            UI.closeAllCharacterPickers();
        }
    });
}

export function setupEventListeners() {
    // Search and Filters
    if (DOM.characterSearchInput) {
        DOM.characterSearchInput.addEventListener('compositionstart', handleCharacterSearchComposition);
        DOM.characterSearchInput.addEventListener('compositionend', handleCharacterSearchComposition);
        DOM.characterSearchInput.addEventListener('input', handleCharacterSearchInput);
        DOM.characterSearchInput.addEventListener('blur', handleCharacterSearchBlur);
    }
    if (DOM.costFilterButtons) DOM.costFilterButtons.forEach(button => button.addEventListener('click', (e) => handleFilterButtonClick(e, 'cost')));
    if (DOM.sortFilterButtons) DOM.sortFilterButtons.forEach(button => button.addEventListener('click', (e) => handleFilterButtonClick(e, 'sort')));

    // Accordions
    accordionManager.init();
    accordionManager.setInitialState();

    // Character Grid
    if (DOM.characterGrid) DOM.characterGrid.addEventListener('click', handleCharacterCardClick);

    setupCharacterPickerEventListeners();

    // New: Redeploy Simulation Selected Characters Grid
    if (DOM.redeploySimulationSelectedCharactersGrid) DOM.redeploySimulationSelectedCharactersGrid.addEventListener('click', handleCharacterCardClick);

    // Redeploy Simulation
    if (DOM.playerCharSelect) DOM.playerCharSelect.addEventListener('change', handlePlayerCharSelectChange);
    if (DOM.partnerCharSelect) DOM.partnerCharSelect.addEventListener('change', handlePartnerCharSelectChange);
    if (DOM.simulatePlayerRedeployBtn) DOM.simulatePlayerRedeployBtn.addEventListener('click', () => processSimulateRedeploy('player'));
    if (DOM.simulatePartnerRedeployBtn) DOM.simulatePartnerRedeployBtn.addEventListener('click', () => processSimulateRedeploy('partner'));

    // Awakening Gauge Inputs
    const awakeningInputs = [
        DOM.beforeShotdownAwakeningGaugeInput,
        DOM.beforeShotdownHpInput,
        DOM.damageDealtAwakeningBonusSelect,
        DOM.shieldSuccessAwakeningBonusSelect,
        DOM.considerOwnDownCheckbox,
        DOM.considerPartnerDownCheckbox
    ];
    awakeningInputs.forEach(el => {
        if (el) {
            const eventType = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
            el.addEventListener(eventType, handleAwakeningInputChange);
        }
    });
    if (DOM.considerDamageDealtCheckbox) DOM.considerDamageDealtCheckbox.addEventListener('change', handleDamageDealtCheckboxChange);
    if (DOM.considerShieldSuccessCheckbox) DOM.considerShieldSuccessCheckbox.addEventListener('change', handleShieldSuccessCheckboxChange);
    if (DOM.shieldSuccessOptionsContainer && (!DOM.considerShieldSuccessCheckbox || !DOM.considerShieldSuccessCheckbox.checked)) {
        DOM.shieldSuccessOptionsContainer.style.display = 'none';
    }

    // Share Buttons
    if (DOM.shareRedeployResultBtn) DOM.shareRedeployResultBtn.addEventListener('click', handleShareRedeployResult);
    if (DOM.shareTotalHpResultBtn) DOM.shareTotalHpResultBtn.addEventListener('click', handleShareTotalHpResult);

    if (DOM.copyRedeployUrlBtn) DOM.copyRedeployUrlBtn.addEventListener('click', handleCopyRedeployUrl);
    if (DOM.copyTotalHpUrlBtn) DOM.copyTotalHpUrlBtn.addEventListener('click', handleCopyTotalHpUrl);

}