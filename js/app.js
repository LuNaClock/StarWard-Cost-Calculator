import { rawCharacterData, kanjiNameReadings, MAX_TEAM_COST } from '../data.js';
import * as Utils from './utils.js';
import * as DOM from './domElements.js';
import * as State from './state.js';
import * as Calculator from './calculator.js';
import * as UI from './ui.js';
import * as EventHandlers from './eventHandlers.js';
import * as Sharing from './sharing.js';

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

    const activeCostFilter = document.querySelector('#costFilter .active').dataset.cost;
    const activeSortFilter = document.querySelector('#sortFilter .active').dataset.sort;
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
        return;
    }

    const allocatedCostForThisRedeploy = parseFloat(DOM.remainingTeamCostInput.value);
    const currentSimulatingCharType = State.getCurrentlySimulatingCharType();
    let charToRedeploy;
    if (currentSimulatingCharType === 'player') {
        charToRedeploy = selectedPlayer;
    } else if (currentSimulatingCharType === 'partner') {
        charToRedeploy = selectedPartner;
    } else {
        console.error("processSimulateRedeploy: Invalid or unset currentlySimulatingCharType in state:", currentSimulatingCharType);
        UI.resetSimulationResultsUI();
        return;
    }

    if (!charToRedeploy) { 
        UI.resetSimulationResultsUI();
        return;
    }

    const { calculatedHp, actualCostConsumed } = Calculator.calculateSingleRedeployHp(charToRedeploy, allocatedCostForThisRedeploy);

    UI.updateRedeploySimulationUI(charToRedeploy, calculatedHp, actualCostConsumed);

    if (DOM.beforeShotdownAwakeningGaugeInput && DOM.beforeShotdownHpInput_damageTakenInput) {
        DOM.beforeShotdownAwakeningGaugeInput.dataset.originalCharacterHp = String(charToRedeploy.hp);
        DOM.beforeShotdownAwakeningGaugeInput.dataset.characterCost = charToRedeploy.cost.toFixed(1);
        DOM.beforeShotdownAwakeningGaugeInput.dataset.characterName = charToRedeploy.name;
        
        DOM.beforeShotdownHpInput_damageTakenInput.max = String(charToRedeploy.hp);
        DOM.beforeShotdownHpInput_damageTakenInput.dataset.originalCharacterHp = String(charToRedeploy.hp);
        DOM.beforeShotdownHpInput_damageTakenInput.dataset.characterCost = charToRedeploy.cost.toFixed(1);
        DOM.beforeShotdownHpInput_damageTakenInput.dataset.characterName = charToRedeploy.name;
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
        const originalHpFromDataset = DOM.beforeShotdownHpInput_damageTakenInput?.dataset.originalCharacterHp;
        const costFromDataset = DOM.beforeShotdownHpInput_damageTakenInput?.dataset.characterCost;
        const nameFromDataset = DOM.beforeShotdownHpInput_damageTakenInput?.dataset.characterName;

        if (originalHpFromDataset && costFromDataset && nameFromDataset) {
            charDataForAwakening = {
                hp: parseFloat(originalHpFromDataset),
                cost: parseFloat(costFromDataset),
                name: nameFromDataset
            };
        } else {
            UI.updateAwakeningGaugeUI({ error: true, validatedDamageTaken: parseFloat(DOM.beforeShotdownHpInput_damageTakenInput?.value) || 0 });
            return;
        }
    }
    
     if (!charDataForAwakening || typeof charDataForAwakening.hp === 'undefined' || typeof charDataForAwakening.cost === 'undefined') {
        UI.updateAwakeningGaugeUI({ error: true, validatedDamageTaken: parseFloat(DOM.beforeShotdownHpInput_damageTakenInput?.value) || 0 });
        return;
    }

    const inputs = {
        gaugeBeforeShotdown: parseFloat(DOM.beforeShotdownAwakeningGaugeInput.value) || 0,
        damageTakenInputValue: parseFloat(DOM.beforeShotdownHpInput_damageTakenInput.value) || 0,
        originalCharActualMaxHp: charDataForAwakening.hp,
        charCost: charDataForAwakening.cost,
        charName: charDataForAwakening.name,
        considerOwnDown: DOM.considerOwnDownCheckbox.checked,
        considerDamageDealt: DOM.considerDamageDealtCheckbox.checked,
        damageDealtBonus: DOM.damageDealtAwakeningBonusSelect.value,
        considerPartnerDown: DOM.considerPartnerDownCheckbox.checked
    };

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
}

document.addEventListener('DOMContentLoaded', initializePage);