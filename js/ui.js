import * as DOM from './domElements.js';
import { costRemainingMap, AVERAGE_GAUGE_COEFFICIENT, AWAKENING_BONUS_BY_COST, PARTNER_DOWN_AWAKENING_BONUS, AWAKENING_THRESHOLD } from '../data.js';
import { getCharacters, getSelectedPlayerChar, getSelectedPartnerChar } from './state.js';
import * as Utils from './utils.js';

export function showLoading() {
    if (DOM.loadingOverlay) DOM.loadingOverlay.classList.add('active');
}

export function hideLoading() {
    if (DOM.loadingOverlay) gsap.to(DOM.loadingOverlay, { opacity: 0, duration: 0.3, onComplete: () => DOM.loadingOverlay.classList.remove('active') });
}

const CHARACTER_PICKER_TYPES = ['player', 'partner'];

const characterPickerRefs = {
    player: buildCharacterPickerRefs('player'),
    partner: buildCharacterPickerRefs('partner')
};

const characterPickerState = {
    player: { cost: 'all', searchTerm: '', filteredIndices: [] },
    partner: { cost: 'all', searchTerm: '', filteredIndices: [] }
};

function buildCharacterPickerRefs(type) {
    const container = document.querySelector(`.character-picker[data-role="${type}"]`);
    if (!container) return null;
    const searchContainer = container.querySelector('.character-picker-search');
    const helperText = container.querySelector('.character-picker-search-helper');
    return {
        container,
        toggle: container.querySelector('.character-picker-toggle'),
        panel: container.querySelector('.character-picker-panel'),
        searchInput: container.querySelector('.character-picker-search-input'),
        searchContainer,
        costButtons: Array.from(container.querySelectorAll('.picker-filter-button')),
        list: container.querySelector('.character-picker-list'),
        selectedIcon: container.querySelector('.character-picker-selected-icon'),
        selectedName: container.querySelector('.character-picker-selected-name'),
        helperText,
        defaultHelperText: (helperText?.dataset?.defaultText ?? helperText?.textContent ?? '').trim()
    };
}

function getSelectElementByType(type) {
    if (type === 'player') return DOM.playerCharSelect;
    if (type === 'partner') return DOM.partnerCharSelect;
    return null;
}

function createCharacterAvatar(character, size = 'default') {
    const avatar = document.createElement('div');
    avatar.className = `character-picker-avatar${size === 'small' ? ' small' : ''}`;

    const img = document.createElement('img');
    img.alt = character.name;

    const fallback = document.createElement('span');
    fallback.className = 'character-icon-fallback';
    fallback.textContent = character.name ? character.name.charAt(0) : '?';

    if (character.image) {
        img.src = character.image;
        const markVisibleIfReady = () => {
            if (img.complete && img.naturalWidth > 0) avatar.classList.add('show-image');
        };
        img.onload = () => avatar.classList.add('show-image');
        img.onerror = () => avatar.classList.remove('show-image');
        markVisibleIfReady();
    }

    avatar.appendChild(img);
    avatar.appendChild(fallback);
    return avatar;
}

function updateCharacterPickerSelectionDisplay(type, character) {
    const refs = characterPickerRefs[type];
    if (!refs) return;

    if (refs.selectedIcon) {
        refs.selectedIcon.innerHTML = '';
        if (character) {
            refs.selectedIcon.classList.remove('is-placeholder');
            refs.selectedIcon.appendChild(createCharacterAvatar(character, 'small'));
        } else {
            refs.selectedIcon.classList.add('is-placeholder');
            refs.selectedIcon.textContent = '?';
        }
    }

    if (refs.selectedName) {
        refs.selectedName.textContent = character ? `${character.name} (コスト${character.cost.toFixed(1)})` : '未選択';
    }
}

function updateCharacterPickerCostButtonState(type) {
    const refs = characterPickerRefs[type];
    if (!refs || !refs.costButtons) return;
    const currentCost = characterPickerState[type]?.cost ?? 'all';
    refs.costButtons.forEach(button => {
        const buttonCost = button.dataset.cost || 'all';
        button.classList.toggle('active', buttonCost === currentCost);
    });
}

function getCurrentSelectedIndex(type) {
    const selectEl = getSelectElementByType(type);
    if (!selectEl || selectEl.value === '') return null;
    const parsed = parseInt(selectEl.value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function filterCharactersForPicker(type) {
    const characters = getCharacters();
    if (!Array.isArray(characters) || !characterPickerState[type]) return [];

    const { cost, searchTerm } = characterPickerState[type];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const hiraTerm = normalizedSearch ? Utils.toHiragana(normalizedSearch) : '';
    const kataTerm = normalizedSearch ? Utils.toKatakana(normalizedSearch) : '';

    return characters
        .map((char, index) => ({ char, index }))
        .filter(({ char }) => {
            if (cost && cost !== 'all' && char.cost.toFixed(1) !== cost) {
                return false;
            }

            if (!normalizedSearch) return true;

            const nameLower = (char.name || '').toLowerCase();
            const yomiHira = (char.yomi_hiragana || '').toLowerCase();
            const yomiKata = (char.yomi_katakana || '').toLowerCase();

            return nameLower.includes(normalizedSearch) || nameLower.includes(hiraTerm) || nameLower.includes(kataTerm) ||
                yomiHira.includes(normalizedSearch) || yomiHira.includes(hiraTerm) || yomiHira.includes(kataTerm) ||
                yomiKata.includes(normalizedSearch) || yomiKata.includes(hiraTerm) || yomiKata.includes(kataTerm);
        });
}

function updateCharacterPickerSearchFeedback(type, filteredCount) {
    const refs = characterPickerRefs[type];
    if (!refs) return;

    const state = characterPickerState[type];
    const searchTerm = state?.searchTerm ?? '';
    const trimmedTerm = searchTerm.trim();
    const hasSearchTerm = trimmedTerm.length > 0;
    const hasResults = filteredCount > 0;

    const helper = refs.helperText;
    if (helper) {
        const defaultText = refs.defaultHelperText || helper.dataset?.defaultText || '';
        if (!hasSearchTerm) {
            helper.textContent = defaultText;
        } else if (hasResults) {
            helper.textContent = `該当するキャラ: ${filteredCount}件`;
        } else {
            helper.textContent = '該当するキャラが見つかりません';
        }

        helper.classList.toggle('has-results', hasSearchTerm && hasResults);
        helper.classList.toggle('no-results', hasSearchTerm && !hasResults);
    }

    if (refs.searchContainer) {
        refs.searchContainer.classList.toggle('is-filtering', hasSearchTerm);
        refs.searchContainer.classList.toggle('has-results', hasSearchTerm && hasResults);
        refs.searchContainer.classList.toggle('no-results', hasSearchTerm && !hasResults);
    }
}

export function getCharacterPickerRefs(type) {
    return characterPickerRefs[type] || null;
}

export function renderCharacterPicker(type) {
    const refs = characterPickerRefs[type];
    if (!refs || !refs.list || !characterPickerState[type]) return;

    updateCharacterPickerCostButtonState(type);
    if (refs.searchInput && refs.searchInput.value !== characterPickerState[type].searchTerm) {
        refs.searchInput.value = characterPickerState[type].searchTerm;
    }

    const filtered = filterCharactersForPicker(type);
    characterPickerState[type].filteredIndices = filtered.map(item => item.index);
    updateCharacterPickerSearchFeedback(type, filtered.length);

    refs.list.innerHTML = '';

    const currentSelectedIndex = getCurrentSelectedIndex(type);
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'character-picker-item clear-option';
    clearButton.dataset.index = '';
    clearButton.setAttribute('role', 'option');
    clearButton.textContent = '未選択に戻す';
    if (currentSelectedIndex === null) {
        clearButton.classList.add('selected');
        clearButton.setAttribute('aria-selected', 'true');
    } else {
        clearButton.setAttribute('aria-selected', 'false');
    }
    refs.list.appendChild(clearButton);

    if (filtered.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'character-picker-empty';
        emptyMessage.textContent = '該当するキャラが見つかりません';
        refs.list.appendChild(emptyMessage);
        return;
    }

    filtered.forEach(({ char, index }) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'character-picker-item';
        item.dataset.index = index.toString();
        item.setAttribute('role', 'option');

        const avatar = createCharacterAvatar(char, 'small');
        item.appendChild(avatar);

        const info = document.createElement('div');
        info.className = 'character-picker-item-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'character-picker-item-name';
        nameSpan.textContent = char.name;

        const metaSpan = document.createElement('span');
        metaSpan.className = 'character-picker-item-meta';
        metaSpan.textContent = `コスト ${char.cost.toFixed(1)} / 耐久 ${char.hp.toLocaleString()}`;

        info.appendChild(nameSpan);
        info.appendChild(metaSpan);
        item.appendChild(info);

        if (currentSelectedIndex === index) {
            item.classList.add('selected');
            item.setAttribute('aria-selected', 'true');
        } else {
            item.setAttribute('aria-selected', 'false');
        }

        refs.list.appendChild(item);
    });
}

export function setCharacterPickerCostFilter(type, cost) {
    if (!characterPickerState[type]) return;
    const normalizedCost = cost || 'all';
    characterPickerState[type].cost = normalizedCost;
    renderCharacterPicker(type);
}

export function setCharacterPickerSearchTerm(type, term) {
    if (!characterPickerState[type]) return;
    characterPickerState[type].searchTerm = term ?? '';
    renderCharacterPicker(type);
}

export function getFirstFilteredCharacterIndex(type) {
    const indices = characterPickerState[type]?.filteredIndices || [];
    return indices.length > 0 ? indices[0] : null;
}

export function focusCharacterPickerSearch(type) {
    const refs = characterPickerRefs[type];
    if (!refs || !refs.searchInput) return;
    requestAnimationFrame(() => refs.searchInput.focus());
}

export function isCharacterPickerOpen(type) {
    const refs = characterPickerRefs[type];
    return !!(refs && refs.container && refs.container.classList.contains('open'));
}

export function openCharacterPicker(type) {
    const refs = characterPickerRefs[type];
    if (!refs || !refs.container) return;
    closeAllCharacterPickers(type);
    refs.container.classList.add('open');
    renderCharacterPicker(type);
}

export function closeCharacterPicker(type) {
    const refs = characterPickerRefs[type];
    if (!refs || !refs.container) return;
    refs.container.classList.remove('open');
}

export function closeAllCharacterPickers(exceptType = null) {
    CHARACTER_PICKER_TYPES.forEach(t => {
        if (exceptType && t === exceptType) return;
        closeCharacterPicker(t);
    });
}

export function toggleCharacterPicker(type) {
    if (isCharacterPickerOpen(type)) {
        closeCharacterPicker(type);
    } else {
        openCharacterPicker(type);
    }
}

export function selectCharacterFromPicker(type, characterIndex) {
    const selectEl = getSelectElementByType(type);
    if (!selectEl) return;

    if (characterPickerState[type]) {
        characterPickerState[type].searchTerm = '';
    }

    const newValue = characterIndex === null || typeof characterIndex === 'undefined' ? '' : characterIndex.toString();
    const hasChanged = selectEl.value !== newValue;
    selectEl.value = newValue;

    if (hasChanged) {
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        syncCharacterPickerSelection(type);
    }

    closeCharacterPicker(type);
}

export function syncCharacterPickerSelection(type) {
    const selectEl = getSelectElementByType(type);
    const characters = getCharacters();
    let selectedCharacter = null;

    if (selectEl && selectEl.value !== '') {
        const index = parseInt(selectEl.value, 10);
        if (!Number.isNaN(index) && characters && characters[index]) {
            selectedCharacter = characters[index];
        }
    }

    updateCharacterPickerSelectionDisplay(type, selectedCharacter);
    renderCharacterPicker(type);
}

function createTextElement(tag, className, textContent) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = textContent;
    return element;
}

export function generateCharacterCards(charactersToDisplay) {
    showLoading();
    gsap.to(Array.from(DOM.characterGrid.children), {
        opacity: 0, scale: 0.8, y: 50, duration: 0.2, stagger: 0.01, ease: "power2.in", overwrite: true,
        onComplete: () => {
            DOM.characterGrid.innerHTML = ''; // Clear previous cards
            if (charactersToDisplay.length === 0) {
                const noResultsMessage = createTextElement('p', 'no-results-message', 'ERROR: NO DATA FOUND');
                DOM.characterGrid.appendChild(noResultsMessage);
                gsap.fromTo(noResultsMessage, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out", delay: 0.1 });
                hideLoading();
                return;
            }

            charactersToDisplay.forEach((character, index) => {
                const card = document.createElement('div');
                card.className = 'character-card';
                card.dataset.originalHp = character.hp;

                // Header
                const header = document.createElement('div');
                header.className = 'character-header';
                const nameSpan = createTextElement('span', '', character.name);
                const costSpan = createTextElement('span', 'character-cost', `コスト: ${character.cost.toFixed(1)}`);
                header.appendChild(nameSpan);
                header.appendChild(costSpan);
                card.appendChild(header);

                // Body
                const body = document.createElement('div');
                body.className = 'character-body';

                // Image
                const imageContainer = document.createElement('div');
                imageContainer.className = 'character-image';
                const imgElement = document.createElement('img');
                imgElement.alt = character.name;
                imgElement.className = 'character-icon-img';
                const initialSpan = createTextElement('span', 'initial', character.name.charAt(0));
                
                if (character.image) {
                    imgElement.onload = () => { imgElement.style.display = 'block'; initialSpan.style.display = 'none'; };
                    imgElement.onerror = () => { imgElement.style.display = 'none'; initialSpan.style.display = 'flex'; };
                    imgElement.src = character.image;
                    if (imgElement.complete && imgElement.naturalWidth > 0) {
                        imgElement.style.display = 'block'; initialSpan.style.display = 'none';
                    } else if (!imgElement.complete) { // if not cached, default to initial until loaded
                         imgElement.style.display = 'none'; initialSpan.style.display = 'flex';
                    }
                } else {
                    imgElement.style.display = 'none'; initialSpan.style.display = 'flex';
                }
                imageContainer.appendChild(imgElement);
                imageContainer.appendChild(initialSpan);
                body.appendChild(imageContainer);

                // Stats
                const stats = document.createElement('div');
                stats.className = 'character-stats';
                stats.appendChild(createTextElement('span', 'character-stat-label', '本来の耐久値:'));
                stats.appendChild(createTextElement('span', 'character-hp', character.hp.toLocaleString()));
                body.appendChild(stats);

                // HP Bar
                const hpBarContainer = document.createElement('div');
                hpBarContainer.className = 'hp-bar-container';
                const hpBarFill = document.createElement('div');
                hpBarFill.className = 'hp-bar-fill';
                hpBarContainer.appendChild(hpBarFill);
                body.appendChild(hpBarContainer);
                body.appendChild(createTextElement('div', 'hp-percentage-display', ''));

                // Cost Table
                const table = document.createElement('table');
                table.className = 'cost-table';
                const applicableRemainingCosts = costRemainingMap[character.cost.toFixed(1)] || [];
                const costOverHPs = applicableRemainingCosts.map(remainingCost => {
                    let calculatedHpForDisplay;
                    if (character.cost <= 0) calculatedHpForDisplay = 0;
                    else if (remainingCost >= character.cost) calculatedHpForDisplay = character.hp;
                    else if (remainingCost > 0) calculatedHpForDisplay = Math.round(character.hp * (remainingCost / character.cost));
                    else calculatedHpForDisplay = 0;
                    return calculatedHpForDisplay;
                });

                const thead = document.createElement('thead');
                const trHead = document.createElement('tr');
                trHead.appendChild(createTextElement('th', '', '残コスト'));
                applicableRemainingCosts.forEach(cost => trHead.appendChild(createTextElement('th', '', cost.toFixed(1))));
                thead.appendChild(trHead);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                const trBody = document.createElement('tr');
                trBody.appendChild(createTextElement('td', '', '耐久値'));
                costOverHPs.forEach(hp => {
                    const td = createTextElement('td', '', hp.toLocaleString());
                    td.dataset.redeployHp = hp;
                    trBody.appendChild(td);
                });
                tbody.appendChild(trBody);
                table.appendChild(tbody);
                body.appendChild(table);

                card.appendChild(body);
                DOM.characterGrid.appendChild(card);
            });
            hideLoading();
        }
    });
}

export function animateHpDisplayOnCard(card, targetHp) {
    const hpBarFill = card.querySelector('.hp-bar-fill');
    const originalHp = parseFloat(card.dataset.originalHp);
    const currentHpSpan = card.querySelector('.character-hp');
    const hpPercentageDisplayElement = card.querySelector('.hp-percentage-display');
    const allRedeployCellsInCard = card.querySelectorAll('.cost-table td[data-redeploy-hp]');

    if (!hpBarFill || !currentHpSpan || !hpPercentageDisplayElement) return;

    gsap.killTweensOf(currentHpSpan); 
    gsap.set(currentHpSpan, { color: '#E74C3C', textShadow: '0 0 5px rgba(231, 76, 60, 0.3)' }); 
    currentHpSpan.textContent = originalHp.toLocaleString(); 
    currentHpSpan.classList.remove('animating'); 
    gsap.killTweensOf(hpBarFill); 

    if (targetHp === originalHp) {
        gsap.to(hpBarFill, { scaleX: 1, duration: 0.8, ease: "power3.out", transformOrigin: 'left center', overwrite: true });
        hpBarFill.classList.remove('hp-bar-low-pulse');
        allRedeployCellsInCard.forEach(cell => cell.classList.remove('active-hp-display'));
        currentHpSpan.classList.add('animating'); 
        gsap.delayedCall(0.8, () => currentHpSpan.classList.remove('animating'));
        hpPercentageDisplayElement.textContent = '100%';
        hpPercentageDisplayElement.classList.add('show');
    } else {
        const hpPercentage = (originalHp > 0 ? (targetHp / originalHp) : 0);
        gsap.to(hpBarFill, {
            scaleX: hpPercentage, duration: 0.8, ease: "power3.out", transformOrigin: 'left center', overwrite: true,
            onUpdate: () => { hpPercentageDisplayElement.textContent = `${Math.round(gsap.getProperty(hpBarFill, "scaleX") * 100)}%`; },
            onComplete: () => { hpPercentageDisplayElement.textContent = `${Math.round(hpPercentage * 100)}%`; }
        });
        if (hpPercentage <= 0.3) hpBarFill.classList.add('hp-bar-low-pulse'); else hpBarFill.classList.remove('hp-bar-low-pulse');
        currentHpSpan.classList.add('animating'); 
        gsap.delayedCall(0.8, () => currentHpSpan.classList.remove('animating'));
        
        hpPercentageDisplayElement.classList.add('show');
        hpPercentageDisplayElement.textContent = `${Math.round(hpPercentage * 100)}%`;
        
        allRedeployCellsInCard.forEach(cell => cell.classList.remove('active-hp-display'));
        const clickedCell = Array.from(allRedeployCellsInCard).find(cell => parseFloat(cell.dataset.redeployHp) === targetHp);
        if (clickedCell) clickedCell.classList.add('active-hp-display');
    }
}

let searchIconPulseTl;
export function initSearchIconPulseAnimation() {
    searchIconPulseTl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 1.8, ease: "power2.inOut", overwrite: true } });
    if (DOM.searchIcon) searchIconPulseTl.to(DOM.searchIcon, { scale: 1.08, opacity: 1 });
}

export function populateCharacterSelects() {
    const characters = getCharacters();
    const defaultOptionHTML = '<option value="">-- 選択してください --</option>';
    
    DOM.playerCharSelect.innerHTML = defaultOptionHTML; // Use innerHTML for simple default
    DOM.partnerCharSelect.innerHTML = defaultOptionHTML;
    
    characters.forEach((char, index) => {
        const option = document.createElement('option');
        option.value = index.toString();
        option.textContent = `${char.name} (コスト:${char.cost.toFixed(1)})`;
        DOM.playerCharSelect.appendChild(option.cloneNode(true));
        DOM.partnerCharSelect.appendChild(option);
    });

    CHARACTER_PICKER_TYPES.forEach(type => syncCharacterPickerSelection(type));
}

export function populateRemainingCostSelect(maxTeamCost) {
    DOM.remainingTeamCostInput.innerHTML = ''; // Clear previous options
    const zeroOption = document.createElement('option');
    zeroOption.value = "0.0";
    zeroOption.textContent = "0.0";
    DOM.remainingTeamCostInput.appendChild(zeroOption);
    for (let cost = 0.5; cost <= maxTeamCost; cost += 0.5) {
        const option = document.createElement('option');
        option.value = cost.toFixed(1);
        option.textContent = cost.toFixed(1);
        DOM.remainingTeamCostInput.appendChild(option);
    }
}

export function generateSelectedCharacterCards() {
    const playerChar = getSelectedPlayerChar();
    const partnerChar = getSelectedPartnerChar();
    DOM.redeploySimulationSelectedCharactersGrid.innerHTML = ''; // Clear previous cards

    const charactersToDisplay = [];
    if (playerChar) charactersToDisplay.push(playerChar);
    if (partnerChar) charactersToDisplay.push(partnerChar);

    if (charactersToDisplay.length === 0) {
        // No characters selected, display a message or leave empty
        DOM.redeploySimulationSelectedCharactersGrid.innerHTML = '<p class="no-results-message">選択されたキャラクターがいません</p>';
        return;
    }

    charactersToDisplay.forEach(character => {
        const card = document.createElement('div');
        card.className = 'character-card'; // Use existing character-card style
        card.dataset.originalHp = character.hp;

        // Header
        const header = document.createElement('div');
        header.className = 'character-header';
        const nameSpan = createTextElement('span', '', character.name);
        const costSpan = createTextElement('span', 'character-cost', `コスト: ${character.cost.toFixed(1)}`);
        header.appendChild(nameSpan);
        header.appendChild(costSpan);
        card.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'character-body';

        // Image
        const imageContainer = document.createElement('div');
        imageContainer.className = 'character-image';
        const imgElement = document.createElement('img');
        imgElement.alt = character.name;
        imgElement.className = 'character-icon-img';
        const initialSpan = createTextElement('span', 'initial', character.name.charAt(0));
        
        if (character.image) {
            imgElement.onload = () => { imgElement.style.display = 'block'; initialSpan.style.display = 'none'; };
            imgElement.onerror = () => { imgElement.style.display = 'none'; initialSpan.style.display = 'flex'; };
            imgElement.src = character.image;
            if (imgElement.complete && imgElement.naturalWidth > 0) {
                imgElement.style.display = 'block'; initialSpan.style.display = 'none';
            } else if (!imgElement.complete) { // if not cached, default to initial until loaded
                 imgElement.style.display = 'none'; initialSpan.style.display = 'flex';
            }
        } else {
            imgElement.style.display = 'none'; initialSpan.style.display = 'flex';
        }
        imageContainer.appendChild(imgElement);
        imageContainer.appendChild(initialSpan);
        body.appendChild(imageContainer);

        // Stats
        const stats = document.createElement('div');
        stats.className = 'character-stats';
        stats.appendChild(createTextElement('span', 'character-stat-label', '本来の耐久値:'));
        stats.appendChild(createTextElement('span', 'character-hp', character.hp.toLocaleString()));
        body.appendChild(stats);

        // HP Bar
        const hpBarContainer = document.createElement('div');
        hpBarContainer.className = 'hp-bar-container';
        const hpBarFill = document.createElement('div');
        hpBarFill.className = 'hp-bar-fill';
        hpBarContainer.appendChild(hpBarFill);
        body.appendChild(hpBarContainer);
        body.appendChild(createTextElement('div', 'hp-percentage-display', ''));

        // Cost Table
        const table = document.createElement('table');
        table.className = 'cost-table';
        const applicableRemainingCosts = costRemainingMap[character.cost.toFixed(1)] || [];
        const costOverHPs = applicableRemainingCosts.map(remainingCost => {
            let calculatedHpForDisplay;
            if (character.cost <= 0) calculatedHpForDisplay = 0;
            else if (remainingCost >= character.cost) calculatedHpForDisplay = character.hp;
            else if (remainingCost > 0) calculatedHpForDisplay = Math.round(character.hp * (remainingCost / character.cost));
            else calculatedHpForDisplay = 0;
            return calculatedHpForDisplay;
        });

        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        trHead.appendChild(createTextElement('th', '', '残コスト'));
        applicableRemainingCosts.forEach(cost => trHead.appendChild(createTextElement('th', '', cost.toFixed(1))));
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const trBody = document.createElement('tr');
        trBody.appendChild(createTextElement('td', '', '耐久値'));
        costOverHPs.forEach(hp => {
            const td = createTextElement('td', '', hp.toLocaleString());
            td.dataset.redeployHp = hp;
            trBody.appendChild(td);
        });
        tbody.appendChild(trBody);
        table.appendChild(tbody);
        body.appendChild(table);

        card.appendChild(body);
        DOM.redeploySimulationSelectedCharactersGrid.appendChild(card);

        // Apply HP bar animation on load (initially 100%)
        animateHpDisplayOnCard(card, character.hp);
    });
}

export function updateSelectedCharactersDisplay() {
    const selectedPlayerChar = getSelectedPlayerChar();
    const selectedPartnerChar = getSelectedPartnerChar();
    DOM.selectedCharsDisplay.innerHTML = ''; // Clear previous

    const createMiniCard = (character) => {
        const miniCard = document.createElement('div');
        miniCard.className = 'mini-character-card active';

        miniCard.appendChild(createTextElement('div', 'char-name', character.name));
        
        const imageDiv = document.createElement('div');
        imageDiv.className = 'char-image';
        const img = document.createElement('img');
        img.alt = character.name;
        img.className = 'mini-char-img';
        const initial = createTextElement('span', 'initial', character.name.charAt(0));

        if (character.image) {
            img.onload = () => { img.style.display = 'block'; initial.style.display = 'none'; };
            img.onerror = () => { img.style.display = 'none'; initial.style.display = 'flex'; };
            img.src = character.image; // Set src after handlers
            if (img.complete && img.naturalWidth > 0) { // Cached
                img.style.display = 'block'; initial.style.display = 'none';
            } else if (!img.complete) { // Not cached, not loaded yet
                 img.style.display = 'none'; initial.style.display = 'flex';
            }
        } else {
            img.style.display = 'none'; initial.style.display = 'flex';
        }
        imageDiv.appendChild(img);
        imageDiv.appendChild(initial);
        miniCard.appendChild(imageDiv);
        
        miniCard.appendChild(createTextElement('div', 'char-cost', `コスト: ${character.cost.toFixed(1)}`));
        return miniCard;
    };

    if (selectedPlayerChar) DOM.selectedCharsDisplay.appendChild(createMiniCard(selectedPlayerChar));
    if (selectedPartnerChar) DOM.selectedCharsDisplay.appendChild(createMiniCard(selectedPartnerChar));

    if (!selectedPlayerChar && !selectedPartnerChar) {
        const p = createTextElement('p', '', '自機と相方を選択してください。');
        p.style.color = 'var(--medium-grey)';
        p.style.fontStyle = 'italic';
        p.style.marginTop = '20px';
        DOM.selectedCharsDisplay.appendChild(p);
        gsap.set(DOM.selectedCharsDisplay, { minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' });
    } else {
        gsap.set(DOM.selectedCharsDisplay, { minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' });
    }

    // Call the new function to generate full character cards
    generateSelectedCharacterCards();
}

export function updateTeamCostDisplay(maxTeamCost) {
    const selectedPlayerChar = getSelectedPlayerChar();
    const selectedPartnerChar = getSelectedPartnerChar();
    const playerCost = selectedPlayerChar ? selectedPlayerChar.cost : 0;
    const partnerCost = selectedPartnerChar ? selectedPartnerChar.cost : 0;
    const currentTotalTeamCost = playerCost + partnerCost;
    if (DOM.totalTeamCostSpan) DOM.totalTeamCostSpan.textContent = currentTotalTeamCost.toFixed(1);

    let autoCalculatedRemainingCost = maxTeamCost - currentTotalTeamCost;
    autoCalculatedRemainingCost = Math.max(0.0, Math.round(autoCalculatedRemainingCost * 2) / 2);
    const targetValue = autoCalculatedRemainingCost.toFixed(1);

    if (Array.from(DOM.remainingTeamCostInput.options).some(opt => opt.value === targetValue)) {
        DOM.remainingTeamCostInput.value = targetValue;
    } else {
        DOM.remainingTeamCostInput.value = "0.0"; // Fallback if targetValue is not in options
    }
}

export function resetSimulationResultsUI() {
    gsap.to(DOM.simulationResultsDiv, {
        opacity: 0, y: 20, duration: 0.3, ease: "power2.in",
        onComplete: () => {
            if (DOM.simulationResultsDiv) DOM.simulationResultsDiv.classList.remove('active');
            if (DOM.redeployCharNameSpan) DOM.redeployCharNameSpan.textContent = '--';
            if (DOM.redeployCharCostSpan) DOM.redeployCharCostSpan.textContent = '--';
            if (DOM.redeployOriginalHpSpan) DOM.redeployOriginalHpSpan.textContent = '--';
            if (DOM.redeployCostConsumedSpan) DOM.redeployCostConsumedSpan.textContent = '--';
            if (DOM.redeployCalculatedHpSpan) DOM.redeployCalculatedHpSpan.textContent = '--';
            if (DOM.simulationHpBarFill) { DOM.simulationHpBarFill.style.transform = 'scaleX(0)'; DOM.simulationHpBarFill.classList.remove('hp-bar-low-pulse');}
            if (DOM.simulationHpPercentageDisplay) { DOM.simulationHpPercentageDisplay.classList.remove('show'); DOM.simulationHpPercentageDisplay.textContent = '';}
            if (DOM.redeployCalculatedHpSpan) { DOM.redeployCalculatedHpSpan.classList.remove('low-hp-value', 'red-value');}

            if (DOM.awakeningSimulationArea) DOM.awakeningSimulationArea.style.display = 'none';
            if (DOM.beforeShotdownAwakeningGaugeInput) DOM.beforeShotdownAwakeningGaugeInput.value = "0";
            if (DOM.beforeShotdownHpInput) { DOM.beforeShotdownHpInput.value = "0"; DOM.beforeShotdownHpInput.style.borderColor = '';}
            if(DOM.considerOwnDownCheckbox) DOM.considerOwnDownCheckbox.checked = false;
            if (DOM.considerDamageDealtCheckbox) {
                DOM.considerDamageDealtCheckbox.checked = false;
                if(DOM.damageDealtOptionsContainer) DOM.damageDealtOptionsContainer.style.display = 'none';
                if(DOM.damageDealtAwakeningBonusSelect) DOM.damageDealtAwakeningBonusSelect.value = "0";
            }
            if (DOM.considerShieldSuccessCheckbox) {
                DOM.considerShieldSuccessCheckbox.checked = false;
                if (DOM.shieldSuccessOptionsContainer) DOM.shieldSuccessOptionsContainer.style.display = 'none';
                if (DOM.shieldSuccessAwakeningBonusSelect) DOM.shieldSuccessAwakeningBonusSelect.value = "0";
            }
            if (DOM.considerPartnerDownCheckbox) DOM.considerPartnerDownCheckbox.checked = false;
            if (DOM.predictedAwakeningGaugeSpan) DOM.predictedAwakeningGaugeSpan.textContent = '--';
            if (DOM.awakeningAvailabilitySpan) { DOM.awakeningAvailabilitySpan.textContent = '--'; DOM.awakeningAvailabilitySpan.className = 'info-value';}
            
            if (DOM.shareRedeployResultBtn) DOM.shareRedeployResultBtn.style.display = 'none';
            if (DOM.copyRedeployUrlBtn) DOM.copyRedeployUrlBtn.style.display = 'none';
        }
    });
}

export function displayTotalTeamHpResults(scenarios) {
    const selectedPlayerChar = getSelectedPlayerChar();
    const selectedPartnerChar = getSelectedPartnerChar();

    if (!scenarios || !selectedPlayerChar || !selectedPartnerChar) { 
         gsap.to(DOM.totalHpDisplayArea, { opacity: 0, y: 20, duration: 0.3, ease: "power2.in", onComplete: () => {
            if(DOM.totalHpDisplayArea) DOM.totalHpDisplayArea.classList.remove('active'); 
            if (DOM.highestHpScenarioTitleSpan) DOM.highestHpScenarioTitleSpan.textContent = 'チーム合計耐久値(最高)';
            if (DOM.idealGainedHpSpan) DOM.idealGainedHpSpan.textContent = '--';
            if (DOM.idealSequenceList) DOM.idealSequenceList.innerHTML = '';
            if (DOM.compromiseHpScenarioTitleSpan) DOM.compromiseHpScenarioTitleSpan.textContent = 'チーム合計耐久値(妥協)';
            if (DOM.minGainedHpSpan) DOM.minGainedHpSpan.textContent = '--';
            if (DOM.minSequenceList) DOM.minSequenceList.innerHTML = '';
            if (DOM.bombHpScenarioTitleSpan) DOM.bombHpScenarioTitleSpan.textContent = 'チーム合計耐久値(爆弾)';
            if (DOM.bombGainedHpSpan) DOM.bombGainedHpSpan.textContent = '--';
            if (DOM.bombSequenceList) DOM.bombSequenceList.innerHTML = '';
            if (DOM.lowestHpScenarioTitleSpan) DOM.lowestHpScenarioTitleSpan.textContent = 'チーム合計耐久値(最低)';
            if (DOM.lowestGainedHpSpan) DOM.lowestGainedHpSpan.textContent = '--';
            if (DOM.lowestSequenceList) DOM.lowestSequenceList.innerHTML = '';
            
            if (DOM.shareTotalHpResultBtn) DOM.shareTotalHpResultBtn.style.display = 'none';
            if (DOM.copyTotalHpUrlBtn) DOM.copyTotalHpUrlBtn.style.display = 'none';
        }});
        return;
    }

    const { idealScenario, compromiseScenario, bombScenario, lowestScenario } = scenarios;

    if (DOM.selectedPlayerCharNameSummary && selectedPlayerChar) DOM.selectedPlayerCharNameSummary.textContent = selectedPlayerChar.name;
    if (DOM.selectedPartnerCharNameSummary && selectedPartnerChar) DOM.selectedPartnerCharNameSummary.textContent = selectedPartnerChar.name;

    if (DOM.totalHpDisplayArea) {
        DOM.totalHpDisplayArea.classList.add('active'); 
        gsap.fromTo(DOM.totalHpDisplayArea, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
        if (DOM.shareTotalHpResultBtn) DOM.shareTotalHpResultBtn.style.display = 'flex'; 
        if (DOM.copyTotalHpUrlBtn) DOM.copyTotalHpUrlBtn.style.display = 'flex';     
    } else return;

    const generateListItems = (sequence) => {
        const fragment = document.createDocumentFragment();
        sequence?.forEach(item => {
            const li = document.createElement('li');
            const charTypeDisplay = item.charType ? ` (${item.charType})` : '';
            let processedNote = item.note;
            const regexToReplace = /\((\d+\.\d+)コスト換算\), 消費後実質コストオーバー\((\d+\.\d+)換算\)/;
            processedNote = processedNote.replace(regexToReplace, `コストオーバー($2換算)`);
            const remainingCostDisplay = item.remainingCost !== undefined ? `, 残り: ${item.remainingCost}` : '';
            li.textContent = `${item.turn}落ち: ${item.charName}${charTypeDisplay} - ${item.hpGained.toLocaleString()} HP獲得 (${processedNote}${remainingCostDisplay})`;
            fragment.appendChild(li);
        });
        return fragment;
    };

    if(DOM.highestHpScenarioTitleSpan) DOM.highestHpScenarioTitleSpan.textContent = idealScenario.name;
    if(DOM.idealGainedHpSpan) DOM.idealGainedHpSpan.textContent = idealScenario.totalHp?.toLocaleString() || '--';
    if(DOM.idealSequenceList) { DOM.idealSequenceList.innerHTML = ''; DOM.idealSequenceList.appendChild(generateListItems(idealScenario.sequence));}

    if(DOM.compromiseHpScenarioTitleSpan) DOM.compromiseHpScenarioTitleSpan.textContent = compromiseScenario.name;
    if(DOM.minGainedHpSpan) DOM.minGainedHpSpan.textContent = compromiseScenario.totalHp?.toLocaleString() || '--';
    if(DOM.minSequenceList) { DOM.minSequenceList.innerHTML = ''; DOM.minSequenceList.appendChild(generateListItems(compromiseScenario.sequence));}

    if(DOM.bombHpScenarioTitleSpan) DOM.bombHpScenarioTitleSpan.textContent = bombScenario.name;
    if(DOM.bombGainedHpSpan) DOM.bombGainedHpSpan.textContent = bombScenario.totalHp?.toLocaleString() || '--';
    if(DOM.bombSequenceList) { DOM.bombSequenceList.innerHTML = ''; DOM.bombSequenceList.appendChild(generateListItems(bombScenario.sequence));}

    if(DOM.lowestHpScenarioTitleSpan) DOM.lowestHpScenarioTitleSpan.textContent = lowestScenario.name;
    if(DOM.lowestGainedHpSpan) DOM.lowestGainedHpSpan.textContent = lowestScenario.totalHp?.toLocaleString() || '--';
    if(DOM.lowestSequenceList) { DOM.lowestSequenceList.innerHTML = ''; DOM.lowestSequenceList.appendChild(generateListItems(lowestScenario.sequence));}
}


export function updateRedeploySimulationUI(charToRedeploy, calculatedHp, actualCostConsumed) {
    if (!charToRedeploy) return;
    
    DOM.redeployCharNameSpan.textContent = charToRedeploy.name;
    DOM.redeployCharCostSpan.textContent = charToRedeploy.cost.toFixed(1);
    DOM.redeployOriginalHpSpan.textContent = charToRedeploy.hp.toLocaleString();
    DOM.redeployCostConsumedSpan.textContent = actualCostConsumed.toFixed(1);
    DOM.redeployCalculatedHpSpan.textContent = calculatedHp.toLocaleString();

    const originalHpValue = charToRedeploy.hp;
    DOM.redeployCalculatedHpSpan.classList.remove('red-value', 'low-hp-value');
    if (originalHpValue > 0 && calculatedHp < originalHpValue && calculatedHp > 0) {
        DOM.redeployCalculatedHpSpan.classList.add('red-value');
    } else if (calculatedHp === 0 && originalHpValue > 0) {
        DOM.redeployCalculatedHpSpan.classList.add('red-value');
    }

    const hpPercentage = originalHpValue > 0 ? (calculatedHp / originalHpValue) : 0;
    if (DOM.simulationHpBarFill && DOM.simulationHpPercentageDisplay) {
        gsap.to(DOM.simulationHpBarFill, {
            scaleX: hpPercentage, duration: 0.8, ease: "power3.out", transformOrigin: 'left center', overwrite: true,
            onUpdate: () => { DOM.simulationHpPercentageDisplay.textContent = `${Math.round(gsap.getProperty(DOM.simulationHpBarFill, "scaleX") * 100)}%`; },
            onComplete: () => { DOM.simulationHpPercentageDisplay.textContent = `${Math.round(hpPercentage * 100)}%`; }
        });

        if (hpPercentage <= 0.3) DOM.simulationHpBarFill.classList.add('hp-bar-low-pulse');
        else DOM.simulationHpBarFill.classList.remove('hp-bar-low-pulse');

        DOM.simulationHpPercentageDisplay.classList.add('show');
    }

    if (DOM.simulationResultsDiv) { 
        DOM.simulationResultsDiv.classList.add('active'); 
        gsap.fromTo(DOM.simulationResultsDiv, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", onComplete: () => {
            if (DOM.awakeningSimulationArea) DOM.awakeningSimulationArea.style.display = 'block';
            if (DOM.shareRedeployResultBtn) DOM.shareRedeployResultBtn.style.display = 'flex'; 
            if (DOM.copyRedeployUrlBtn) DOM.copyRedeployUrlBtn.style.display = 'flex';     
        }});
    }
}

export function updateAwakeningGaugeUI(gaugeResult) {
    if (!gaugeResult || !DOM.predictedAwakeningGaugeSpan || !DOM.awakeningAvailabilitySpan) return;

    if (gaugeResult.error) {
        DOM.predictedAwakeningGaugeSpan.textContent = '---';
        DOM.awakeningAvailabilitySpan.textContent = '--';
        DOM.awakeningAvailabilitySpan.className = 'info-value';
        if(DOM.beforeShotdownHpInput) DOM.beforeShotdownHpInput.style.borderColor = 'red';
        return;
    }

    if(DOM.beforeShotdownHpInput) {
        DOM.beforeShotdownHpInput.style.borderColor = '';
        if (DOM.beforeShotdownHpInput.value !== gaugeResult.validatedDamageTaken.toString()) {
             DOM.beforeShotdownHpInput.value = gaugeResult.validatedDamageTaken;
        }
    }

    DOM.predictedAwakeningGaugeSpan.textContent = gaugeResult.finalPredictedGauge;
    DOM.awakeningAvailabilitySpan.classList.remove('awakening-possible', 'awakening-not-possible');
    if (gaugeResult.isThresholdMet) {
        DOM.awakeningAvailabilitySpan.textContent = '使用可能';
        DOM.awakeningAvailabilitySpan.classList.add('awakening-possible');
    } else {
        DOM.awakeningAvailabilitySpan.textContent = '使用不可';
        DOM.awakeningAvailabilitySpan.classList.add('awakening-not-possible');
    }
}

export function setAwakeningDetailsConstants() {
    if (DOM.avgGaugeCoeffValueSpan) DOM.avgGaugeCoeffValueSpan.textContent = AVERAGE_GAUGE_COEFFICIENT.toFixed(3);
    if (DOM.avgGaugeCoeffExampleValueSpan) DOM.avgGaugeCoeffExampleValueSpan.textContent = AVERAGE_GAUGE_COEFFICIENT.toFixed(3);
    if (DOM.ownDownBonus30Span) DOM.ownDownBonus30Span.textContent = AWAKENING_BONUS_BY_COST["3.0"].toString();
    if (DOM.ownDownBonus20Span) DOM.ownDownBonus20Span.textContent = AWAKENING_BONUS_BY_COST["2.0"].toString();
    if (DOM.ownDownBonus15Span) DOM.ownDownBonus15Span.textContent = AWAKENING_BONUS_BY_COST["1.5"].toString();
    if (DOM.partnerDownBonus30Span) DOM.partnerDownBonus30Span.textContent = PARTNER_DOWN_AWAKENING_BONUS["3.0"].toString();
    if (DOM.partnerDownBonus25Span) DOM.partnerDownBonus25Span.textContent = PARTNER_DOWN_AWAKENING_BONUS["2.5"].toString();
    if (DOM.partnerDownBonus20Span) DOM.partnerDownBonus20Span.textContent = PARTNER_DOWN_AWAKENING_BONUS["2.0"].toString();
    if (DOM.partnerDownBonus15Span) DOM.partnerDownBonus15Span.textContent = PARTNER_DOWN_AWAKENING_BONUS["1.5"].toString();
    if (DOM.awakeningThresholdValueSpan) DOM.awakeningThresholdValueSpan.textContent = AWAKENING_THRESHOLD.toString();
}