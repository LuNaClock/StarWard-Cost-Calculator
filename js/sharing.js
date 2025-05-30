import * as State from './state.js';
import * as DOM from './domElements.js';
import { getCharacters } from './state.js';
import { processSimulateRedeploy, processAwakeningGaugeCalculation, processTeamHpCombinations } from './app.js';
import * as UI from './ui.js';
import { MAX_TEAM_COST } from '../data.js';

const BASE_URL = window.location.origin + window.location.pathname;

export function generateShareUrlForRedeploy() {
    const simCharType = State.getCurrentlySimulatingCharType();

    const params = new URLSearchParams();
    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    const characters = getCharacters();

    if (playerChar) params.set('p', characters.findIndex(c => c.name === playerChar.name).toString());
    if (partnerChar) params.set('pt', characters.findIndex(c => c.name === partnerChar.name).toString());
    
    params.set('rc', DOM.remainingTeamCostInput.value);
    
    if (simCharType) {
        params.set('sim', simCharType);
    } else {
        // This case should ideally not be reached if share buttons are enabled only after a simulation.
        console.warn("generateShareUrlForRedeploy: currentlySimulatingCharType is null when trying to generate share URL.");
    }

    let hasAwakeningParams = false;
    if (DOM.beforeShotdownAwakeningGaugeInput.value !== "0") {
        params.set('ag', DOM.beforeShotdownAwakeningGaugeInput.value);
        hasAwakeningParams = true;
    }
    // Always include 'ah' if it's not "0", or if 'ag' is set (even if 'ah' is "0")
    // This ensures that if a user intentionally sets 'ah' to 0 with other awakening params, it's preserved.
    if (DOM.beforeShotdownHpInput_damageTakenInput.value !== "0") {
        params.set('ah', DOM.beforeShotdownHpInput_damageTakenInput.value);
        hasAwakeningParams = true;
    } else if (hasAwakeningParams) { // If other awakening params are present, include ah=0 if it's 0
         params.set('ah', "0");
    }


    if (DOM.considerOwnDownCheckbox.checked) {
        params.set('od', '1');
        hasAwakeningParams = true;
    }
    if (DOM.considerDamageDealtCheckbox.checked) {
        params.set('dd', '1');
        hasAwakeningParams = true;
        if (DOM.damageDealtAwakeningBonusSelect.value !== "0") {
            params.set('ddb', DOM.damageDealtAwakeningBonusSelect.value);
        }
    }
    if (DOM.considerPartnerDownCheckbox.checked) {
        params.set('pd', '1');
        hasAwakeningParams = true;
    }

    if (hasAwakeningParams && simCharType) {
        params.set('anchor', 'awakening');
    }
    
    return `${BASE_URL}?${params.toString()}`;
}

export function generateShareUrlForTotalHp() {
    const params = new URLSearchParams();
    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    const characters = getCharacters();

    if (playerChar) params.set('p', characters.findIndex(c => c.name === playerChar.name).toString());
    if (partnerChar) params.set('pt', characters.findIndex(c => c.name === partnerChar.name).toString());
    params.set('view', 'totalhp'); 
    params.set('anchor', 'totalhp_area');


    return `${BASE_URL}?${params.toString()}`;
}

export function parseUrlAndRestoreState() {
    const params = new URLSearchParams(window.location.search);
    const characters = getCharacters(); 

    if (!characters || characters.length === 0) {
        // console.warn("Characters not loaded when parseUrlAndRestoreState was called. State restoration might be incomplete.");
        return;
    }

    const playerIndexStr = params.get('p');
    const partnerIndexStr = params.get('pt');

    if (playerIndexStr !== null) {
        const playerIndex = parseInt(playerIndexStr);
        if (!isNaN(playerIndex) && playerIndex >= 0 && playerIndex < characters.length) {
            DOM.playerCharSelect.value = playerIndexStr; 
            State.setSelectedPlayerChar(playerIndexStr); 
        }
    }
    if (partnerIndexStr !== null) {
        const partnerIndex = parseInt(partnerIndexStr);
        if (!isNaN(partnerIndex) && partnerIndex >= 0 && partnerIndex < characters.length) {
            DOM.partnerCharSelect.value = partnerIndexStr;
            State.setSelectedPartnerChar(partnerIndexStr);
        }
    }
    
    UI.updateTeamCostDisplay(MAX_TEAM_COST); 
    UI.updateSelectedCharactersDisplay();

    if (params.has('rc')) {
        DOM.remainingTeamCostInput.value = params.get('rc');
    }

    if (params.has('ag')) {
        DOM.beforeShotdownAwakeningGaugeInput.value = params.get('ag');
    } else {
        DOM.beforeShotdownAwakeningGaugeInput.value = "0";
    }
    
    if (params.has('ah')) {
        DOM.beforeShotdownHpInput_damageTakenInput.value = params.get('ah');
    } else {
        DOM.beforeShotdownHpInput_damageTakenInput.value = (DOM.beforeShotdownAwakeningGaugeInput.value === "0") ? "0" : "0"; 
    }
    
    DOM.considerOwnDownCheckbox.checked = params.get('od') === '1';
    DOM.considerDamageDealtCheckbox.checked = params.get('dd') === '1';
    if (DOM.considerDamageDealtCheckbox.checked) {
        if (DOM.damageDealtOptionsContainer) DOM.damageDealtOptionsContainer.style.display = 'block';
        if (params.has('ddb')) DOM.damageDealtAwakeningBonusSelect.value = params.get('ddb');
    } else {
        if (DOM.damageDealtOptionsContainer) DOM.damageDealtOptionsContainer.style.display = 'none';
        DOM.damageDealtAwakeningBonusSelect.value = "0"; 
    }
    DOM.considerPartnerDownCheckbox.checked = params.get('pd') === '1';

    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    const simTypeFromUrl = params.get('sim');
    const viewTypeFromUrl = params.get('view');
    const anchorTo = params.get('anchor');

    let simulationRan = false;

    if (simTypeFromUrl && playerChar && partnerChar) {
        if (['player', 'partner'].includes(simTypeFromUrl)) {
            State.setCurrentlySimulatingCharType(simTypeFromUrl); 
            processSimulateRedeploy(simTypeFromUrl);
            simulationRan = true; 
            if (anchorTo === 'awakening' && DOM.awakeningSimulationArea) {
                setTimeout(() => {
                    if (DOM.awakeningSimulationArea.offsetParent !== null) { // Check if visible
                        DOM.awakeningSimulationArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 300); 
            }
        } else {
            UI.resetSimulationResultsUI();
            // console.warn(`Invalid 'sim' parameter in URL: ${simTypeFromUrl}`);
        }
    } else if (viewTypeFromUrl === 'totalhp' && playerChar && partnerChar) {
        processTeamHpCombinations();
        simulationRan = true;
        if (anchorTo === 'totalhp_area' && DOM.totalHpDisplayArea && DOM.totalHpDisplayArea.classList.contains('active')) {
            setTimeout(() => {
                 if (DOM.totalHpDisplayArea.offsetParent !== null) { // Check if visible
                    DOM.totalHpDisplayArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
            }, 100);
        }
    } else if (playerChar && partnerChar) { 
        processTeamHpCombinations();
        simulationRan = true; // Team HP is a form of result display
        if(params.has('ag') || params.has('ah') || params.has('od') || params.has('dd') || params.has('pd')) {
            // console.warn("Awakening parameters found in URL, but 'sim' parameter is missing. Awakening simulation will not run automatically for specific character.");
            // No explicit reset here, as team HP is shown. Individual sim results area is naturally not shown.
        }
    }
    
    if (!simulationRan) {
        UI.resetSimulationResultsUI();
        UI.displayTotalTeamHpResults(null); 
    }
}

/**
 * Copies the given text to the clipboard and provides feedback on the button.
 * @param {string} textToCopy - The text to be copied.
 * @param {HTMLElement} buttonElement - The button element that was clicked.
 */
export async function copyUrlToClipboard(textToCopy, buttonElement) {
    if (!navigator.clipboard) {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            textArea.style.position = "fixed";
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.width = "2em";
            textArea.style.height = "2em";
            textArea.style.padding = "0";
            textArea.style.border = "none";
            textArea.style.outline = "none";
            textArea.style.boxShadow = "none";
            textArea.style.background = "transparent";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful && buttonElement) {
                const originalText = buttonElement.innerHTML;
                buttonElement.innerHTML = '<i class="fas fa-check"></i> コピー完了!';
                buttonElement.disabled = true;
                setTimeout(() => {
                    buttonElement.innerHTML = originalText;
                    buttonElement.disabled = false;
                }, 2000);
            } else {
                alert('URLのコピーに失敗しました。手動でコピーしてください。');
                // console.error('Fallback: クリップボードへのコピーに失敗しました。');
            }
        } catch (err) {
            alert('URLのコピーに失敗しました。手動でコピーしてください。');
            // console.error('Fallback: クリップボードへのコピー中にエラーが発生しました:', err);
        }
        return;
    }

    try {
        await navigator.clipboard.writeText(textToCopy);
        if (buttonElement) {
            const originalText = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="fas fa-check"></i> コピー完了!';
            buttonElement.disabled = true;
            setTimeout(() => {
                buttonElement.innerHTML = originalText;
                buttonElement.disabled = false;
            }, 2000);
        }
    } catch (err) {
        // console.error('クリップボードへのコピーに失敗しました:', err);
        alert('URLのコピーに失敗しました。手動でコピーしてください。');
    }
}