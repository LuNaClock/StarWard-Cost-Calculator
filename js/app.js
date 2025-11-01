import { rawCharacterData, kanjiNameReadings, MAX_TEAM_COST } from '../data.js';
import * as Utils from './utils.js';
import * as DOM from './domElements.js';
import * as State from './state.js';
import * as Calculator from './calculator.js';
import * as UI from './ui.js';
import * as EventHandlers from './eventHandlers.js';
import * as Sharing from './sharing.js';
import { initAccordions, accordionManager } from './accordion.js';

function initializeCharacterData() {
    const processedData = rawCharacterData.map((char, index) => {
        let yomi_hiragana;
        let yomi_katakana;

        if (kanjiNameReadings[char.name]) {
            yomi_hiragana = kanjiNameReadings[char.name].hiragana;
            yomi_katakana = kanjiNameReadings[char.name].katakana;
        } else {
            yomi_hiragana = Utils.toHiragana(char.name);
            yomi_katakana = Utils.toKatakana(char.name);
        }

        const costValue = Number(char.cost) || 0;
        const costKey = costValue.toFixed(1);

        return {
            ...char,
            id: index,
            cost: costValue,
            costKey,
            yomi_hiragana,
            yomi_katakana,
            hira: yomi_hiragana.toLowerCase(),
            kata: yomi_katakana
        };
    });

    State.initializeCharacterData(processedData);
}

function syncHistoryUI() {
    const history = State.getHistory();
    UI.renderSimulationHistory(history);
    UI.renderRecentCharacterCards(history);
    UI.updateRecentCardScopeControls({
        hasHistory: history.length > 0,
        isRecentScope: State.getCardScope() === 'recent'
    });
}

export function applyFiltersAndSearch() {
    const searchTermInputVal = DOM.characterSearchInput.value.trim();
    const inputRawLower = searchTermInputVal.toLowerCase();
    const inputHiragana = Utils.toHiragana(inputRawLower);
    const inputKatakana = Utils.toKatakana(inputRawLower);

    const activeCostFilterEl = document.querySelector('#costFilter .active');
    const activeSortFilterEl = document.querySelector('#sortFilter .active');

    const activeCostFilter = activeCostFilterEl?.dataset.cost ?? 'all';
    const activeSortFilter = activeSortFilterEl?.dataset.sort ?? 'name';

    const scope = State.getCardScope();
    const historyIdentifiers = scope === 'recent' ? State.getRecentCharacterIdentifiers() : { ids: null, names: null };
    const hasRecentFilterTargets = scope !== 'recent' || (historyIdentifiers.ids?.size || historyIdentifiers.names?.size);

    let filteredCharacters = [...State.getCharacters()];

    if (searchTermInputVal) {
        filteredCharacters = filteredCharacters.filter((character) => {
            const nameLower = character.name.toLowerCase();
            const hiraLower = character.yomi_hiragana.toLowerCase();
            const kataLower = character.yomi_katakana.toLowerCase();
            return (
                nameLower.includes(inputRawLower) ||
                nameLower.includes(inputHiragana) ||
                nameLower.includes(inputKatakana) ||
                hiraLower.includes(inputRawLower) ||
                hiraLower.includes(inputHiragana) ||
                hiraLower.includes(inputKatakana) ||
                kataLower.includes(inputRawLower) ||
                kataLower.includes(inputHiragana) ||
                kataLower.includes(inputKatakana)
            );
        });
    }

    if (activeCostFilter !== 'all') {
        filteredCharacters = filteredCharacters.filter((character) => character.costKey === activeCostFilter);
    }

    if (scope === 'recent') {
        filteredCharacters = filteredCharacters.filter((character) => {
            if (!hasRecentFilterTargets) {
                return false;
            }
            const matchById = typeof character.id === 'number' && historyIdentifiers.ids?.has(character.id);
            const matchByName = historyIdentifiers.names?.has(character.name);
            return matchById || matchByName;
        });
    }

    switch (activeSortFilter) {
        case 'name':
            filteredCharacters.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            break;
        case 'hp-asc':
            filteredCharacters.sort((a, b) => a.hp - b.hp || a.name.localeCompare(b.name, 'ja'));
            break;
        case 'hp-desc':
            filteredCharacters.sort((a, b) => b.hp - a.hp || a.name.localeCompare(b.name, 'ja'));
            break;
        case 'cost-asc':
            filteredCharacters.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'ja'));
            break;
        case 'cost-desc':
            filteredCharacters.sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, 'ja'));
            break;
        default:
            break;
    }

    let emptyMessage = '該当するキャラクターが見つかりません';
    if (scope === 'recent') {
        emptyMessage = State.hasHistory()
            ? '最近のシミュレーションに該当するキャラが見つかりません'
            : '最近のシミュレーション履歴がまだありません';
    } else if (searchTermInputVal) {
        emptyMessage = '検索条件に一致するキャラが見つかりません';
    }

    UI.generateCharacterCards(filteredCharacters, { emptyMessage });
}

export function processTeamHpCombinations() {
    const scenarios = Calculator.calculateTeamHpScenarios();
    UI.displayTotalTeamHpResults(scenarios);
}

export function processSimulateRedeploy(charType) {
    State.setCurrentlySimulatingCharType(charType);
    State.setRedeployTarget(charType);
    UI.setRedeployTargetSelection(charType);

    if (charType === 'player' || charType === 'partner') {
        UI.updateRedeployTargetButtons(charType);
    }

    const selectedPlayer = State.getSelectedPlayerChar();
    const selectedPartner = State.getSelectedPartnerChar();

    if (!selectedPlayer || !selectedPartner) {
        // console.warn("Player or partner not selected for redeploy simulation.");
        UI.resetSimulationResultsUI();
        return;
    }

    const allocatedCostForThisRedeploy = parseFloat(DOM.remainingTeamCostInput.value);
    if (isNaN(allocatedCostForThisRedeploy)) {
        // console.warn("Invalid remaining team cost input for redeploy simulation.");
        UI.resetSimulationResultsUI();
        return;
    }

    const currentSimulatingCharType = State.getCurrentlySimulatingCharType();
    let charToRedeploy;
    if (currentSimulatingCharType === 'player') {
        charToRedeploy = selectedPlayer;
    } else if (currentSimulatingCharType === 'partner') {
        charToRedeploy = selectedPartner;
    } else {
        // console.error("processSimulateRedeploy: Invalid or unset currentlySimulatingCharType in state:", currentSimulatingCharType);
        UI.resetSimulationResultsUI();
        return;
    }

    if (!charToRedeploy) { 
        // console.warn("Character to redeploy not found.");
        UI.resetSimulationResultsUI();
        return;
    }

    const { calculatedHp, actualCostConsumed } = Calculator.calculateSingleRedeployHp(charToRedeploy, allocatedCostForThisRedeploy);

    UI.updateRedeploySimulationUI(charToRedeploy, calculatedHp, actualCostConsumed);

    if (DOM.beforeShotdownAwakeningGaugeInput && DOM.beforeShotdownHpInput) {
        DOM.beforeShotdownAwakeningGaugeInput.dataset.originalCharacterHp = String(charToRedeploy.hp);
        DOM.beforeShotdownAwakeningGaugeInput.dataset.characterCost = charToRedeploy.cost.toFixed(1);
        DOM.beforeShotdownAwakeningGaugeInput.dataset.characterName = charToRedeploy.name;
        
        DOM.beforeShotdownHpInput.max = String(charToRedeploy.hp);
        DOM.beforeShotdownHpInput.dataset.originalCharacterHp = String(charToRedeploy.hp);
        DOM.beforeShotdownHpInput.dataset.characterCost = charToRedeploy.cost.toFixed(1);
        DOM.beforeShotdownHpInput.dataset.characterName = charToRedeploy.name;
    }

    processAwakeningGaugeCalculation();

    if (Number.isFinite(calculatedHp)) {
        const normalizedRemainingCost = Number.isFinite(allocatedCostForThisRedeploy)
            ? Math.max(0, Math.min(MAX_TEAM_COST, allocatedCostForThisRedeploy))
            : null;

        const historyEntry = {
            role: currentSimulatingCharType === 'partner' ? 'partner' : 'player',
            characterId: typeof charToRedeploy.id === 'number' ? charToRedeploy.id : null,
            name: charToRedeploy.name,
            timestamp: new Date().toISOString(),
            hp: calculatedHp,
            cost: actualCostConsumed,
            remainingCost: normalizedRemainingCost,
            playerId: typeof selectedPlayer.id === 'number' ? selectedPlayer.id : null,
            playerName: selectedPlayer.name,
            partnerId: typeof selectedPartner.id === 'number' ? selectedPartner.id : null,
            partnerName: selectedPartner.name
        };

        State.addHistoryEntry(historyEntry);
    }

    syncHistoryUI();

    // シミュレーション実行後、関連するアコーディオンを開く
    if (DOM.totalHpMainAccordionHeader && DOM.totalHpMainAccordionContent) {
        accordionManager.openAccordion(DOM.totalHpMainAccordionHeader);
        // 「チーム合計体力予測」のアコーディオンが完全に開いた後に更新
        UI.updateTeamCostDisplay(MAX_TEAM_COST); // シミュレーション結果を元に更新
        processTeamHpCombinations(); // シミュレーション結果を元に更新
        
        // 再出撃予測結果にスクロール
        setTimeout(() => {
            if (DOM.redeployPredictionResultsSection) {
                DOM.redeployPredictionResultsSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
            }
        }, 300);
    }
    if (DOM.selectedCharactersFullCardAccordionHeader && DOM.selectedCharactersFullCardAccordionContent) {
        accordionManager.openAccordion(DOM.selectedCharactersFullCardAccordionHeader);
        // 「選択キャラクター詳細」のアコーディオンが完全に開いた後に更新
        UI.updateSelectedCharactersDisplay();   // シミュレーション結果を元に更新
    }
}

export function processAwakeningGaugeCalculation() {
    const charType = State.getCurrentlySimulatingCharType();
    let charDataForAwakening;

    if (charType === 'player' && State.getSelectedPlayerChar()) {
        charDataForAwakening = State.getSelectedPlayerChar();
    } else if (charType === 'partner' && State.getSelectedPartnerChar()) {
        charDataForAwakening = State.getSelectedPartnerChar();
    } else {
        const originalHpFromDataset = DOM.beforeShotdownHpInput?.dataset.originalCharacterHp;
        const costFromDataset = DOM.beforeShotdownHpInput?.dataset.characterCost;
        const nameFromDataset = DOM.beforeShotdownHpInput?.dataset.characterName;

        if (originalHpFromDataset && costFromDataset && nameFromDataset) {
            charDataForAwakening = {
                hp: parseFloat(originalHpFromDataset),
                cost: parseFloat(costFromDataset),
                name: nameFromDataset
            };
        } else {
            // console.warn("Awakening calculation skipped: Character data not available from dataset.");
            UI.updateAwakeningGaugeUI({ error: true, validatedDamageTaken: parseFloat(DOM.beforeShotdownHpInput?.value) || 0 });
            return;
        }
    }
    
     if (!charDataForAwakening || typeof charDataForAwakening.hp === 'undefined' || typeof charDataForAwakening.cost === 'undefined') {
        // console.warn("Awakening calculation skipped: Invalid character data.");
        UI.updateAwakeningGaugeUI({ error: true, validatedDamageTaken: parseFloat(DOM.beforeShotdownHpInput?.value) || 0 });
        return;
    }

    const inputs = {
        gaugeBeforeShotdown: (DOM.beforeShotdownAwakeningGaugeInput && parseFloat(DOM.beforeShotdownAwakeningGaugeInput.value)) || 0,
        damageTakenInputValue: (DOM.beforeShotdownHpInput && parseFloat(DOM.beforeShotdownHpInput.value)) || 0,
        originalCharActualMaxHp: charDataForAwakening.hp,
        charCost: charDataForAwakening.cost,
        charName: charDataForAwakening.name,
        considerOwnDown: DOM.considerOwnDownCheckbox && DOM.considerOwnDownCheckbox.checked,
        considerDamageDealt: DOM.considerDamageDealtCheckbox && DOM.considerDamageDealtCheckbox.checked,
        damageDealtBonus: (DOM.damageDealtAwakeningBonusSelect && DOM.damageDealtAwakeningBonusSelect.value) || "0",
        considerShieldSuccess: DOM.considerShieldSuccessCheckbox && DOM.considerShieldSuccessCheckbox.checked,
        shieldSuccessBonus: (DOM.shieldSuccessAwakeningBonusSelect && DOM.shieldSuccessAwakeningBonusSelect.value) || "0",
        considerPartnerDown: DOM.considerPartnerDownCheckbox && DOM.considerPartnerDownCheckbox.checked
    };

    // Basic validation for gaugeBeforeShotdown and damageTakenInputValue
    if (isNaN(inputs.gaugeBeforeShotdown) || inputs.gaugeBeforeShotdown < 0 || inputs.gaugeBeforeShotdown > 100) {
        // console.warn("Invalid gaugeBeforeShotdown value for awakening calculation.");
        inputs.gaugeBeforeShotdown = 0; // Fallback or handle error
    }
    if (isNaN(inputs.damageTakenInputValue) || inputs.damageTakenInputValue < 0) {
        // console.warn("Invalid damageTakenInputValue for awakening calculation.");
        inputs.damageTakenInputValue = 0; // Fallback or handle error
    }


    const result = Calculator.calculateAwakeningGauge(inputs);
    UI.updateAwakeningGaugeUI(result);
}

export function showRecentCharacterScope({ focusCards = true } = {}) {
    if (!State.hasHistory()) {
        syncHistoryUI();
        return;
    }

    State.setCardScope('recent');
    applyFiltersAndSearch();
    syncHistoryUI();

    if (focusCards && DOM.characterGrid) {
        DOM.characterGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function resetCharacterScope({ focusCards = false } = {}) {
    State.setCardScope('all');
    applyFiltersAndSearch();
    syncHistoryUI();

    if (focusCards && DOM.characterGrid) {
        DOM.characterGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function clearSimulationHistory() {
    const cleared = State.clearHistory();
    if (State.getCardScope() === 'recent' && cleared) {
        State.setCardScope('all');
    }

    applyFiltersAndSearch();
    syncHistoryUI();
}

export function applyHistoryEntryByIndex(index) {
    const history = State.getHistory();
    const entry = history[index];
    if (!entry) {
        return;
    }

    const playerIndex = typeof entry.playerId === 'number'
        ? State.findCharacterIndexById(entry.playerId)
        : State.findCharacterIndexByName(entry.playerName);
    if (playerIndex >= 0) {
        UI.selectCharacterFromPicker('player', playerIndex);
    }

    const partnerIndex = typeof entry.partnerId === 'number'
        ? State.findCharacterIndexById(entry.partnerId)
        : State.findCharacterIndexByName(entry.partnerName);
    if (partnerIndex >= 0) {
        UI.selectCharacterFromPicker('partner', partnerIndex);
    }

    const target = entry.role === 'partner' ? 'partner' : 'player';
    State.setRedeployTarget(target);
    UI.setRedeployTargetSelection(target);
    UI.updateRedeployTargetButtons(target);

    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    if (playerChar && partnerChar) {
        UI.updateTeamCostDisplay(MAX_TEAM_COST);
        UI.updateSelectedCharactersDisplay();
        processTeamHpCombinations();
    }

    const costValue = typeof entry.remainingCost === 'number'
        ? entry.remainingCost
        : typeof entry.cost === 'number'
            ? entry.cost
            : null;

    if (DOM.remainingTeamCostInput && costValue !== null && Number.isFinite(costValue)) {
        const clamped = Math.max(0, Math.min(MAX_TEAM_COST, costValue));
        DOM.remainingTeamCostInput.value = clamped.toFixed(1);
        DOM.remainingTeamCostInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        processSimulateRedeploy(target);
    }

    if (DOM.redeploySimulationSection) {
        DOM.redeploySimulationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function initializePage() {
    // アコーディオンを最初に初期化
    initAccordions();

    initializeCharacterData();
    State.loadHistoryFromStorage();
    syncHistoryUI();
    UI.populateCharacterSelects();
    UI.populateRemainingCostSelect(MAX_TEAM_COST);
    UI.setAwakeningDetailsConstants();

    EventHandlers.setupEventListeners();
    Sharing.parseUrlAndRestoreState();

    // ページアニメーションは無効化したまま
    // UI.initPageAnimations();
    applyFiltersAndSearch();

    // 初期キャラクター情報をカードに設定
    const player = State.getSelectedPlayerChar();
    const partner = State.getSelectedPartnerChar();
    if (player) UI.updateCharacterCard('player', player);
    if (partner) UI.updateCharacterCard('partner', partner);

    // 初期表示を更新
    UI.updateSelectedCharactersDisplay();
    UI.updateTeamCostDisplay(MAX_TEAM_COST);

    // 再出撃シミュレーションのアコーディオンを確実に開く
    setTimeout(() => {
        const redeploySimulationHeader = document.querySelector('#redeploy-simulation-section .accordion-header');
        if (redeploySimulationHeader && redeploySimulationHeader.getAttribute('aria-expanded') === 'true') {
            accordionManager.openAccordion(redeploySimulationHeader);
        }
    }, 100);

    setupInitialEventListeners();
}

function setupInitialEventListeners() {
    DOM.copyTotalHpUrlBtn.addEventListener('click', () => Sharing.copyToClipboard(Sharing.generateShareUrl('totalHp')));
}

function handleTeamChange() {
    UI.updateTeamCostDisplay();
    UI.updateSelectedCharactersDisplay();
    processTeamHpCombinations(); // チーム変更時に合計体力も再計算・表示
}

function handleTotalHpCalculation() {
    const scenarios = Calculator.calculateTeamHpScenarios();
    UI.displayTotalTeamHpResults(scenarios);
}

// デバッグ用: グローバル関数を追加
window.debugState = {
    getSelectedPlayerChar: () => State.getSelectedPlayerChar(),
    getSelectedPartnerChar: () => State.getSelectedPartnerChar(),
    getCharacters: () => State.getCharacters(),
    updateSelectedCharactersDisplay: () => UI.updateSelectedCharactersDisplay(),
    updateTeamCostDisplay: () => UI.updateTeamCostDisplay(MAX_TEAM_COST)
};

document.addEventListener('DOMContentLoaded', initializePage);