import { rawCharacterData, kanjiNameReadings, MAX_TEAM_COST } from '../data.js';
import * as Utils from './utils.js';
import * as DOM from './domElements.js';
import * as State from './state.js';
import * as Calculator from './calculator.js';
import * as UI from './ui.js';
import * as EventHandlers from './eventHandlers.js';
import * as Sharing from './sharing.js';
import GameOCR from './imageProcessor.js';

function initializeCharacterData() {
    const processedData = rawCharacterData.map(char => {
        let yomi_hiragana, yomi_katakana;
        if (kanjiNameReadings[char.name]) {
            yomi_hiragana = kanjiNameReadings[char.name].hiragana;
            yomi_katakana = kanjiNameReadings[char.name].katakana;
        } else {
            yomi_hiragana = Utils.toHiragana(char.name);
            yomi_katakana = Utils.toKatakana(char.name);
        }
        return { ...char, yomi_hiragana, yomi_katakana };
    });
    State.initializeCharacterData(processedData);
}

export function applyFiltersAndSearch() {
    const searchTermInputVal = DOM.characterSearchInput.value.trim();
    const inputRawLower = searchTermInputVal.toLowerCase();
    const inputHiragana = Utils.toHiragana(inputRawLower);
    const inputKatakana = Utils.toKatakana(inputRawLower);

    const activeCostFilterEl = document.querySelector('#costFilter .active');
    const activeSortFilterEl = document.querySelector('#sortFilter .active');

    if (!activeCostFilterEl || !activeSortFilterEl) {
        // console.warn("Filter buttons not found, skipping filter application.");
        UI.generateCharacterCards(State.getCharacters()); // Show all if filters are missing
        return;
    }

    const activeCostFilter = activeCostFilterEl.dataset.cost;
    const activeSortFilter = activeSortFilterEl.dataset.sort;

    let filteredCharacters = [...State.getCharacters()];

    if (searchTermInputVal) {
        filteredCharacters = filteredCharacters.filter(c => {
            const nameLower = c.name.toLowerCase();
            const yomiHiraLower = c.yomi_hiragana.toLowerCase();
            const yomiKataLower = c.yomi_katakana.toLowerCase();
            return nameLower.includes(inputRawLower) || nameLower.includes(inputHiragana) || nameLower.includes(inputKatakana) ||
                   yomiHiraLower.includes(inputRawLower) || yomiHiraLower.includes(inputHiragana) || yomiHiraLower.includes(inputKatakana) ||
                   yomiKataLower.includes(inputRawLower) || yomiKataLower.includes(inputHiragana) || yomiKataLower.includes(inputKatakana);
        });
    }
    if (activeCostFilter !== 'all') {
        filteredCharacters = filteredCharacters.filter(c => c.cost.toString() === activeCostFilter);
    }
    switch (activeSortFilter) {
        case 'name': filteredCharacters.sort((a, b) => a.name.localeCompare(b.name, 'ja')); break;
        case 'hp-asc': filteredCharacters.sort((a, b) => a.hp - b.hp || a.name.localeCompare(b.name, 'ja')); break;
        case 'hp-desc': filteredCharacters.sort((a, b) => b.hp - a.hp || a.name.localeCompare(b.name, 'ja')); break;
        case 'cost-asc': filteredCharacters.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'ja')); break;
        case 'cost-desc': filteredCharacters.sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, 'ja')); break;
    }
    UI.generateCharacterCards(filteredCharacters);
}

export function processTeamHpCombinations() {
    const scenarios = Calculator.calculateTeamHpScenarios();
    UI.displayTotalTeamHpResults(scenarios);
}

export function processSimulateRedeploy(charType) {
    State.setCurrentlySimulatingCharType(charType);

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

function initializePage() {
    initializeCharacterData();

    UI.populateCharacterSelects();
    UI.populateRemainingCostSelect(MAX_TEAM_COST);
    UI.setAwakeningDetailsConstants();

    UI.updateTeamCostDisplay(MAX_TEAM_COST); 
    UI.updateSelectedCharactersDisplay();   

    EventHandlers.setupEventListeners();
    Sharing.parseUrlAndRestoreState(); 

    UI.initPageAnimations();
    applyFiltersAndSearch(); 

    // 初期キャラクター情報をカードに設定
    const player = State.getSelectedPlayerChar();
    const partner = State.getSelectedPartnerChar();
    if (player) UI.updateCharacterCard('player', player);
    if (partner) UI.updateCharacterCard('partner', partner);

    handleTeamChange();
    setupInitialEventListeners();
    initializeOcrModal();
}

function setupInitialEventListeners() {
    DOM.copyTotalHpUrlBtn.addEventListener('click', () => Sharing.copyToClipboard(Sharing.generateShareUrl('totalHp')));
}

function initializeOcrModal() {
    const ocrModal = document.getElementById('ocrModal');
    const openOcrBtn = document.querySelector('label[for="gameImageUpload"]');
    const closeOcrBtn = document.getElementById('closeOcrModal');
    const applyOcrResultBtn = document.getElementById('applyOcrResultBtn');
    let gameOcrInstance = null;

    const openModal = () => {
        ocrModal.style.display = 'flex';
        if (!gameOcrInstance) {
            gameOcrInstance = new GameOCR({
                onOcrComplete: (results) => {
                    console.log('OCR完了:', results);
                }
            });
        }
    };

    const closeModal = () => {
        ocrModal.style.display = 'none';
    };

    const applyResults = () => {
        if (gameOcrInstance && gameOcrInstance.lastOcrResult) {
            const { durability, awakening } = gameOcrInstance.lastOcrResult;
            if (durability && durability.value) {
                domElements.beforeShotdownHpInput.value = durability.value;
            }
            if (awakening && awakening.value) {
                domElements.beforeShotdownAwakeningGaugeInput.value = awakening.value;
            }
            handleAwakeningInputChange(); //手動で入力した場合と同じように更新
            closeModal();
        } else {
            alert('適用するOCR結果がありません。');
        }
    };

    openOcrBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent file input trigger
        openModal();
    });

    // Also trigger by clicking the file input itself
    domElements.gameImageUpload.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
    });

    closeOcrBtn.addEventListener('click', closeModal);
    applyOcrResultBtn.addEventListener('click', applyResults);

    window.addEventListener('click', (event) => {
        if (event.target == ocrModal) {
            closeModal();
        }
    });
}

function handleTeamChange() {
    const { playerChar, partnerChar } = State.getState();
    UI.updateTeamCost(playerChar, partnerChar);
    UI.updateSelectedCharactersDisplay(playerChar, partnerChar);
    UI.updateRemainingCostOptions(playerChar, partnerChar);

    if (playerChar && partnerChar) {
        handleTotalHpCalculation();
        UI.updateShareButtons('totalHp', true);
    } else {
        // チームが不完全な場合、合計耐久力表示をリセット
        const initialScenario = {
            gainedHp: 0,
            sequence: [],
            totalHp: 0
        };
        UI.updateTotalHpResult('highest', initialScenario, null, null);
        UI.updateTotalHpResult('compromise', initialScenario, null, null);
        UI.updateTotalHpResult('bomb', initialScenario, null, null);
        UI.updateTotalHpResult('lowest', initialScenario, null, null);
        UI.updateShareButtons('totalHp', false);
    }
}

function handleTotalHpCalculation() {
    const scenarios = Calculator.calculateTeamHpScenarios();
    UI.displayTotalTeamHpResults(scenarios);
}

document.addEventListener('DOMContentLoaded', initializePage);