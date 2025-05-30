import * as State from './state.js';
import * as DOM from './domElements.js';
import { getCharacters } from './state.js';
import { processSimulateRedeploy, processAwakeningGaugeCalculation, processTeamHpCombinations } from './app.js';
import * as UI from './ui.js';
import { MAX_TEAM_COST } from '../data.js';

const BASE_URL = window.location.origin + window.location.pathname;

export function generateShareUrlForRedeploy() {
    const params = new URLSearchParams();
    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    const characters = getCharacters();

    if (playerChar) params.set('p', characters.findIndex(c => c.name === playerChar.name).toString());
    if (partnerChar) params.set('pt', characters.findIndex(c => c.name === partnerChar.name).toString());
    
    params.set('rc', DOM.remainingTeamCostInput.value);
    
    const simCharType = State.getCurrentlySimulatingCharType();
    if (simCharType) params.set('sim', simCharType);

    // Awakening params
    if (DOM.beforeShotdownAwakeningGaugeInput.value !== "0") params.set('ag', DOM.beforeShotdownAwakeningGaugeInput.value);
    if (DOM.beforeShotdownHpInput_damageTakenInput.value !== "0") params.set('ah', DOM.beforeShotdownHpInput_damageTakenInput.value);
    if (DOM.considerOwnDownCheckbox.checked) params.set('od', '1');
    if (DOM.considerDamageDealtCheckbox.checked) {
        params.set('dd', '1');
        if (DOM.damageDealtAwakeningBonusSelect.value !== "0") params.set('ddb', DOM.damageDealtAwakeningBonusSelect.value);
    }
    if (DOM.considerPartnerDownCheckbox.checked) params.set('pd', '1');
    
    return `${BASE_URL}?${params.toString()}`;
}

export function generateShareUrlForTotalHp() {
    const params = new URLSearchParams();
    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    const characters = getCharacters();

    if (playerChar) params.set('p', characters.findIndex(c => c.name === playerChar.name).toString());
    if (partnerChar) params.set('pt', characters.findIndex(c => c.name === partnerChar.name).toString());
    params.set('view', 'totalhp'); // To distinguish this share type

    return `${BASE_URL}?${params.toString()}`;
}

export function parseUrlAndRestoreState() {
    const params = new URLSearchParams(window.location.search);
    const characters = getCharacters(); 

    if (!characters || characters.length === 0) {
        console.warn("Characters not loaded when parseUrlAndRestoreState was called. State restoration might be incomplete.");
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

    if (params.has('ag')) DOM.beforeShotdownAwakeningGaugeInput.value = params.get('ag');
    if (params.has('ah')) DOM.beforeShotdownHpInput_damageTakenInput.value = params.get('ah');
    
    DOM.considerOwnDownCheckbox.checked = params.get('od') === '1';
    DOM.considerDamageDealtCheckbox.checked = params.get('dd') === '1';
    if (DOM.considerDamageDealtCheckbox.checked) {
        if (DOM.damageDealtOptionsContainer) DOM.damageDealtOptionsContainer.style.display = 'block';
        if (params.has('ddb')) DOM.damageDealtAwakeningBonusSelect.value = params.get('ddb');
    } else {
        if (DOM.damageDealtOptionsContainer) DOM.damageDealtOptionsContainer.style.display = 'none';
    }
    DOM.considerPartnerDownCheckbox.checked = params.get('pd') === '1';

    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();

    if (params.has('sim') && playerChar && partnerChar) {
        const simType = params.get('sim');
        // Ensure values are valid before processing
        if (['player', 'partner'].includes(simType)) {
            processSimulateRedeploy(simType); 
        }
    } else if (params.get('view') === 'totalhp' && playerChar && partnerChar) {
        processTeamHpCombinations();
        if (DOM.totalHpDisplayArea && DOM.totalHpDisplayArea.classList.contains('active')) {
            setTimeout(() => DOM.totalHpDisplayArea.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    } else if (playerChar && partnerChar) { 
        processTeamHpCombinations();
    } else {
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
        // Fallback for older browsers or insecure contexts (http)
        try {
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            textArea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
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
                console.error('Fallback: クリップボードへのコピーに失敗しました。');
            }
        } catch (err) {
            alert('URLのコピーに失敗しました。手動でコピーしてください。');
            console.error('Fallback: クリップボードへのコピー中にエラーが発生しました:', err);
        }
        return;
    }

    try {
        await navigator.clipboard.writeText(textToCopy);
        if (buttonElement) {
            const originalText = buttonElement.innerHTML;
            // It's good practice to store the original icon if it exists, to restore it.
            // For now, we assume the icon is part of the originalText if it's an <i> tag.
            buttonElement.innerHTML = '<i class="fas fa-check"></i> コピー完了!';
            buttonElement.disabled = true;
            setTimeout(() => {
                buttonElement.innerHTML = originalText;
                buttonElement.disabled = false;
            }, 2000);
        }
    } catch (err) {
        console.error('クリップボードへのコピーに失敗しました:', err);
        alert('URLのコピーに失敗しました。手動でコピーしてください。');
    }
}