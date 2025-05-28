import * as DOM from './domElements.js';
import * as State from './state.js';
// import * as Calculator from './calculator.js'; // Not directly used in handlers, app.js calls calculator
import * as UI from './ui.js';
import { applyFiltersAndSearch, processTeamHpCombinations, processSimulateRedeploy, processAwakeningGaugeCalculation } from './app.js';
import { MAX_TEAM_COST } from '../data.js';

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
        applyFiltersAndSearch(); // Apply search after composition ends
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

function handleAccordionToggle(event, isSubAccordion = false, isTotalHpAccordion = false) {
    const header = event.currentTarget;
    const content = header.nextElementSibling;
    if (isTotalHpAccordion) {
        UI.toggleTotalHpAccordion(header, content);
    } else {
        UI.toggleAccordion(header, content, isSubAccordion);
    }
}


function handleCharacterCardClick(event) {
    const clickedElement = event.target;
    const card = clickedElement.closest('.character-card');
    if (!card) return;

    const originalHp = parseFloat(card.dataset.originalHp);
    const clickedRedeployCell = clickedElement.closest('.cost-table td[data-redeploy-hp]');

    if (clickedRedeployCell) {
        UI.animateHpDisplayOnCard(card, parseFloat(clickedRedeployCell.dataset.redeployHp));
    } else if (clickedElement.classList.contains('character-hp')) {
        UI.animateHpDisplayOnCard(card, originalHp);
    }
}

function handlePlayerCharSelectChange(event) {
    State.setSelectedPlayerChar(event.target.value); // Pass index or ""
    UI.updateTeamCostDisplay(MAX_TEAM_COST);
    UI.updateSelectedCharactersDisplay();
    UI.resetSimulationResultsUI();
    processTeamHpCombinations(); // This will call UI.displayTotalTeamHpResults
}

function handlePartnerCharSelectChange(event) {
    State.setSelectedPartnerChar(event.target.value); // Pass index or ""
    UI.updateTeamCostDisplay(MAX_TEAM_COST);
    UI.updateSelectedCharactersDisplay();
    UI.resetSimulationResultsUI();
    processTeamHpCombinations(); // This will call UI.displayTotalTeamHpResults
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
    if (DOM.mainAccordionHeaders) DOM.mainAccordionHeaders.forEach(header => header.addEventListener('click', (e) => handleAccordionToggle(e, false, false)));
    if (DOM.subAccordionHeaders) DOM.subAccordionHeaders.forEach(header => header.addEventListener('click', (e) => handleAccordionToggle(e, true, false)));
    if (DOM.totalHpAccordionHeaders) DOM.totalHpAccordionHeaders.forEach(header => header.addEventListener('click', (e) => handleAccordionToggle(e, false, true)));

    // Character Grid
    if (DOM.characterGrid) DOM.characterGrid.addEventListener('click', handleCharacterCardClick);

    // Redeploy Simulation
    if (DOM.playerCharSelect) DOM.playerCharSelect.addEventListener('change', handlePlayerCharSelectChange);
    if (DOM.partnerCharSelect) DOM.partnerCharSelect.addEventListener('change', handlePartnerCharSelectChange);
    if (DOM.simulatePlayerRedeployBtn) DOM.simulatePlayerRedeployBtn.addEventListener('click', () => processSimulateRedeploy('player'));
    if (DOM.simulatePartnerRedeployBtn) DOM.simulatePartnerRedeployBtn.addEventListener('click', () => processSimulateRedeploy('partner'));

    // Awakening Gauge Inputs
    const awakeningInputs = [
        DOM.beforeShotdownAwakeningGaugeInput,
        DOM.beforeShotdownHpInput_damageTakenInput,
        DOM.damageDealtAwakeningBonusSelect,
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
}