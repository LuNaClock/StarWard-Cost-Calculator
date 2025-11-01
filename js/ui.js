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
const MAX_RECENT_CHARACTER_CARDS = 3;
const MAX_SIMULATION_HISTORY_ITEMS = 3;

const characterPickerRefs = {
    player: buildCharacterPickerRefs('player'),
    partner: buildCharacterPickerRefs('partner')
};

const characterPickerState = {
    player: { cost: 'all', searchTerm: '', filteredIndices: [] },
    partner: { cost: 'all', searchTerm: '', filteredIndices: [] }
};

let teamHpDisplayRenderToken = 0;
let simulationResultsRenderToken = 0;
let simulationResultsResetTween = null;
let simulationResultsRevealTween = null;
let simulationResultsHpBarTween = null;

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

    const isEmpty = !character;
    if (refs.toggle) {
        refs.toggle.classList.toggle('is-empty', isEmpty);
    }
    if (refs.container) {
        refs.container.classList.toggle('is-empty', isEmpty);
    }

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

export function updateRedeployTargetButtons(activeType) {
    if (!Array.isArray(DOM.redeployTargetButtons) || DOM.redeployTargetButtons.length === 0) return;

    DOM.redeployTargetButtons.forEach(button => {
        const buttonType = button.dataset.redeployTarget;
        const isActive = buttonType === activeType;
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        button.classList.toggle('is-active', isActive);
    });
}

export function getActiveRedeployTargetType() {
    if (!Array.isArray(DOM.redeployTargetButtons) || DOM.redeployTargetButtons.length === 0) return null;
    const activeButton = DOM.redeployTargetButtons.find(button => button.getAttribute('aria-pressed') === 'true');
    return activeButton ? activeButton.dataset.redeployTarget || null : null;
}

function createTextElement(tag, className, textContent) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = textContent;
    return element;
}

function createCharacterImageSection(character) {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'character-image';

    const imgElement = document.createElement('img');
    imgElement.alt = character.name;
    imgElement.className = 'character-icon-img';

    const initialSpan = createTextElement('span', 'initial', character.name?.charAt(0) || '?');

    const showImage = () => {
        imgElement.style.display = 'block';
        initialSpan.style.display = 'none';
    };
    const showInitial = () => {
        imgElement.style.display = 'none';
        initialSpan.style.display = 'flex';
    };

    if (character.image) {
        imgElement.onload = showImage;
        imgElement.onerror = showInitial;
        imgElement.src = character.image;

        if (imgElement.complete && imgElement.naturalWidth > 0) {
            showImage();
        } else {
            showInitial();
        }
    } else {
        showInitial();
    }

    imageContainer.appendChild(imgElement);
    imageContainer.appendChild(initialSpan);
    return imageContainer;
}

function createStatsSection(character) {
    const stats = document.createElement('div');
    stats.className = 'character-stats';
    stats.appendChild(createTextElement('span', 'character-stat-label', '本来の体力:'));
    stats.appendChild(createTextElement('span', 'character-hp', character.hp.toLocaleString()));
    return stats;
}

function getApplicableRemainingCosts(character) {
    return costRemainingMap[character.cost.toFixed(1)] || [];
}

function calculateRedeployHpForDisplay(character, remainingCost) {
    if (character.cost <= 0) return 0;
    if (remainingCost >= character.cost) return character.hp;
    if (remainingCost > 0) return Math.round(character.hp * (remainingCost / character.cost));
    return 0;
}

function createCostTableSection(character, { tableLabel = '体力' } = {}) {
    const table = document.createElement('table');
    table.className = 'cost-table';

    const remainingCosts = getApplicableRemainingCosts(character);

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(createTextElement('th', '', '残コスト'));
    remainingCosts.forEach(cost => headerRow.appendChild(createTextElement('th', '', cost.toFixed(1))));
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const bodyRow = document.createElement('tr');
    bodyRow.appendChild(createTextElement('td', '', tableLabel));
    remainingCosts.forEach(remainingCost => {
        const hp = calculateRedeployHpForDisplay(character, remainingCost);
        const cell = createTextElement('td', '', hp.toLocaleString());
        cell.dataset.redeployHp = hp;
        bodyRow.appendChild(cell);
    });
    tbody.appendChild(bodyRow);
    table.appendChild(tbody);

    return table;
}

function createHpBarSection() {
    const fragment = document.createDocumentFragment();

    const hpBarContainer = document.createElement('div');
    hpBarContainer.className = 'hp-bar-container';

    const hpBarFill = document.createElement('div');
    hpBarFill.className = 'hp-bar-fill';
    hpBarContainer.appendChild(hpBarFill);

    fragment.appendChild(hpBarContainer);
    fragment.appendChild(createTextElement('div', 'hp-percentage-display', ''));

    return fragment;
}

function createCharacterCard(character, options = {}) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.dataset.originalHp = character.hp;

    const header = document.createElement('div');
    header.className = 'character-header';
    header.appendChild(createTextElement('span', '', character.name));
    header.appendChild(createTextElement('span', 'character-cost', `コスト: ${character.cost.toFixed(1)}`));
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'character-body';
    body.appendChild(createCharacterImageSection(character));
    body.appendChild(createStatsSection(character));
    body.appendChild(createHpBarSection());
    body.appendChild(createCostTableSection(character, options));

    card.appendChild(body);
    return card;
}

export function generateCharacterCards(charactersToDisplay, { emptyMessage = '表示できるキャラクターがいません' } = {}) {
    showLoading();
    gsap.to(Array.from(DOM.characterGrid.children), {
        opacity: 0, scale: 0.8, y: 50, duration: 0.2, stagger: 0.01, ease: "power2.in", overwrite: true,
        onComplete: () => {
            DOM.characterGrid.innerHTML = ''; // Clear previous cards
            if (charactersToDisplay.length === 0) {
                const noResultsMessage = createTextElement('p', 'no-results-message', emptyMessage);
                DOM.characterGrid.appendChild(noResultsMessage);
                gsap.fromTo(noResultsMessage, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out", delay: 0.1 });
                hideLoading();
                return;
            }

            charactersToDisplay.forEach(character => {
                const card = createCharacterCard(character);
                DOM.characterGrid.appendChild(card);
            });
            hideLoading();
        }
    });
}

function getHistoryEntryKey(entry) {
    if (!entry || typeof entry !== 'object') return '';
    if (entry.characterId !== null && entry.characterId !== undefined) {
        return `id:${entry.characterId}`;
    }
    if (entry.name) {
        return `name:${entry.name}`;
    }
    return `misc:${entry.role ?? ''}:${entry.timestamp ?? ''}`;
}

function formatHpValue(value) {
    if (!Number.isFinite(value)) {
        return '--';
    }
    return `${Math.round(value).toLocaleString()} HP`;
}

function formatCostValue(value) {
    if (!Number.isFinite(value)) {
        return '--';
    }
    return value.toFixed(1);
}

function createAvatarThumbnail(name, image, className) {
    const wrapper = document.createElement('div');
    wrapper.className = className;
    if (image) {
        const img = document.createElement('img');
        img.src = image;
        img.alt = name ? `${name}のアイコン` : 'キャラクターアイコン';
        img.loading = 'lazy';
        wrapper.appendChild(img);
    } else {
        const fallback = document.createElement('span');
        fallback.textContent = name ? name.charAt(0) : '?';
        wrapper.appendChild(fallback);
    }
    return wrapper;
}

function resolveHistoryCharacterInfo(entry, role) {
    const characters = getCharacters();
    const idKey = role === 'partner' ? 'partnerId' : 'playerId';
    const storedId = entry[idKey];
    let matched = null;

    if (typeof storedId === 'number') {
        matched = characters.find((char) => char.id === storedId) || null;
    }

    const nameCandidates = [];
    const nameKey = role === 'partner' ? 'partnerName' : 'playerName';
    if (!matched && typeof entry[nameKey] === 'string') {
        nameCandidates.push(entry[nameKey]);
    }
    if (!matched && entry.role === role && typeof entry.name === 'string') {
        nameCandidates.push(entry.name);
    }

    if (!matched) {
        matched = characters.find((char) => nameCandidates.includes(char.name)) || null;
    }

    return {
        id: matched?.id ?? null,
        name: matched?.name || nameCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim()) || '--',
        cost: matched?.cost ?? null,
        image: matched?.image || null
    };
}

function createHistoryCharacterBadge(label, info, roleKey, isActive) {
    const wrapper = document.createElement('div');
    wrapper.className = 'history-character';
    if (isActive) {
        wrapper.classList.add('history-character--active');
    }
    if (roleKey) {
        wrapper.dataset.role = roleKey;
    }

    const thumb = createAvatarThumbnail(info.name, info.image, 'history-character__thumb');
    const textWrapper = document.createElement('div');
    textWrapper.className = 'history-character__text';

    const roleLabel = document.createElement('span');
    roleLabel.className = 'history-character__role';
    roleLabel.textContent = label;

    const nameLabel = document.createElement('span');
    nameLabel.className = 'history-character__name';
    nameLabel.textContent = info.name || '--';

    textWrapper.append(roleLabel, nameLabel);

    if (isActive) {
        const activeTag = document.createElement('span');
        activeTag.className = 'history-character__result';
        activeTag.textContent = '再出撃対象';
        textWrapper.appendChild(activeTag);
    }

    wrapper.append(thumb, textWrapper);
    return wrapper;
}

function createHistoryEntryElement(entry, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-entry';
    button.dataset.historyIndex = index.toString();

    const charactersGrid = document.createElement('div');
    charactersGrid.className = 'history-entry__characters-grid';

    const playerInfo = resolveHistoryCharacterInfo(entry, 'player');
    const partnerInfo = resolveHistoryCharacterInfo(entry, 'partner');

    charactersGrid.append(
        createHistoryCharacterBadge('自機', playerInfo, 'player', entry.role !== 'partner'),
        createHistoryCharacterBadge('相方', partnerInfo, 'partner', entry.role === 'partner')
    );

    const cta = document.createElement('span');
    cta.className = 'history-entry__cta';
    cta.innerHTML = '<i class="fas fa-arrow-right"></i>';

    button.append(charactersGrid, cta);

    const roleLabel = entry.role === 'partner' ? '相方' : '自機';
    button.setAttribute('aria-label', `${roleLabel}の再出撃結果を再適用`);

    return button;
}

function createRecentCharacterCard(entry, index) {
    const targetRole = entry.role === 'partner' ? 'partner' : 'player';
    const roleLabel = targetRole === 'partner' ? '相方' : '自機';
    const info = resolveHistoryCharacterInfo(entry, targetRole);

    const card = document.createElement('article');
    card.className = 'recent-character-card';
    card.dataset.historyIndex = index.toString();

    const thumb = createAvatarThumbnail(info.name, info.image, 'recent-character-card__thumb');
    const body = document.createElement('div');
    body.className = 'recent-character-card__body';

    const name = document.createElement('h4');
    name.className = 'recent-character-card__name';
    name.textContent = info.name || '--';

    const meta = document.createElement('p');
    meta.className = 'recent-character-card__meta';
    const segments = [];
    if (Number.isFinite(info.cost)) {
        segments.push(`コスト ${info.cost.toFixed(1)}`);
    }
    segments.push(`${roleLabel}としてシミュレーション`);
    meta.textContent = segments.join(' / ');

    const statRow = document.createElement('div');
    statRow.className = 'recent-character-card__stat';
    const statLabel = document.createElement('span');
    statLabel.textContent = '直近の再出撃体力';
    const statValue = document.createElement('strong');
    statValue.textContent = formatHpValue(entry.hp);
    statRow.append(statLabel, statValue);

    const actions = document.createElement('div');
    actions.className = 'recent-character-card__actions';
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'recent-character-card__apply';
    applyButton.dataset.historyIndex = index.toString();
    applyButton.textContent = 'この条件を再適用';
    actions.appendChild(applyButton);

    body.append(name, meta, statRow, actions);
    card.append(thumb, body);

    return card;
}

export function renderSimulationHistory(historyEntries = []) {
    if (!DOM.historyList) {
        return;
    }

    DOM.historyList.innerHTML = '';

    if (!Array.isArray(historyEntries) || historyEntries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'history-empty';
        empty.textContent = 'まだ計算履歴がありません';
        DOM.historyList.appendChild(empty);
        if (DOM.clearHistoryButton) {
            DOM.clearHistoryButton.disabled = true;
        }
        return;
    }

    const renderableHistory = historyEntries.slice(0, MAX_SIMULATION_HISTORY_ITEMS);

    renderableHistory.forEach((entry, index) => {
        const item = createHistoryEntryElement(entry, index);
        DOM.historyList.appendChild(item);
    });

    if (DOM.clearHistoryButton) {
        DOM.clearHistoryButton.disabled = false;
    }
}

export function renderRecentCharacterCards(historyEntries = []) {
    if (!DOM.recentCharactersGrid) {
        return;
    }

    DOM.recentCharactersGrid.innerHTML = '';

    if (!Array.isArray(historyEntries) || historyEntries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'history-empty';
        empty.textContent = 'まだ計算履歴がありません';
        DOM.recentCharactersGrid.appendChild(empty);
        return;
    }

    let renderedCount = 0;
    for (let index = 0; index < historyEntries.length && renderedCount < MAX_RECENT_CHARACTER_CARDS; index += 1) {
        const entry = historyEntries[index];
        if (!entry || typeof entry !== 'object') {
            continue;
        }
        const card = createRecentCharacterCard(entry, index);
        DOM.recentCharactersGrid.appendChild(card);
        renderedCount += 1;
    }

    if (!renderedCount) {
        const empty = document.createElement('p');
        empty.className = 'history-empty';
        empty.textContent = '最近のシミュレーションに該当するキャラがありません';
        DOM.recentCharactersGrid.appendChild(empty);
    }
}

export function updateRecentCardScopeControls({ hasHistory, isRecentScope }) {
    if (DOM.showRecentCardsButton) {
        DOM.showRecentCardsButton.disabled = !hasHistory;
        DOM.showRecentCardsButton.setAttribute('aria-pressed', String(hasHistory && isRecentScope));
    }
    if (DOM.resetRecentFilterButton) {
        DOM.resetRecentFilterButton.toggleAttribute('hidden', !isRecentScope);
    }
    if (DOM.clearHistoryButton) {
        DOM.clearHistoryButton.disabled = !hasHistory;
    }
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

export function setRedeployTargetSelection(target) {
    if (!DOM.redeployTargetChips) return;
    const validTarget = target === 'partner' ? 'partner' : 'player';
    const buttons = DOM.redeployTargetChips.querySelectorAll('button[data-target]');
    buttons.forEach(button => {
        const isActive = button.dataset.target === validTarget;
        button.setAttribute('aria-pressed', String(isActive));
    });
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
        const card = createCharacterCard(character);
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

export function resetSimulationResultsUI({ animate = true } = {}) {
    const resetToken = ++simulationResultsRenderToken;

    const applyResetState = () => {
        if (resetToken !== simulationResultsRenderToken) return;

        simulationResultsResetTween = null;
        simulationResultsRevealTween = null;
        simulationResultsHpBarTween = null;

        if (DOM.simulationResultsDiv) DOM.simulationResultsDiv.classList.remove('active');
        if (DOM.redeployCharNameSpan) DOM.redeployCharNameSpan.textContent = '--';
        if (DOM.redeployCharCostSpan) DOM.redeployCharCostSpan.textContent = '--';
        if (DOM.redeployOriginalHpSpan) DOM.redeployOriginalHpSpan.textContent = '--';
        if (DOM.redeployCostConsumedSpan) DOM.redeployCostConsumedSpan.textContent = '--';
        if (DOM.redeployCalculatedHpSpan) DOM.redeployCalculatedHpSpan.textContent = '--';
        if (DOM.simulationHpBarFill) {
            DOM.simulationHpBarFill.style.transform = 'scaleX(0)';
            DOM.simulationHpBarFill.classList.remove('hp-bar-low-pulse');
        }
        if (DOM.redeployCalculatedHpSpan) {
            DOM.redeployCalculatedHpSpan.classList.remove('low-hp-value', 'red-value');
        }

        if (DOM.awakeningSimulationArea) DOM.awakeningSimulationArea.style.display = 'none';
        if (DOM.beforeShotdownAwakeningGaugeInput) DOM.beforeShotdownAwakeningGaugeInput.value = '';
        if (DOM.beforeShotdownHpInput) {
            DOM.beforeShotdownHpInput.value = '';
            DOM.beforeShotdownHpInput.style.borderColor = '';
        }
        if (DOM.considerOwnDownCheckbox) DOM.considerOwnDownCheckbox.checked = false;
        if (DOM.considerDamageDealtCheckbox) {
            DOM.considerDamageDealtCheckbox.checked = false;
            if (DOM.damageDealtOptionsContainer) DOM.damageDealtOptionsContainer.style.display = 'none';
            if (DOM.damageDealtAwakeningBonusSelect) DOM.damageDealtAwakeningBonusSelect.value = "0";
        }
        if (DOM.considerShieldSuccessCheckbox) {
            DOM.considerShieldSuccessCheckbox.checked = false;
            if (DOM.shieldSuccessOptionsContainer) DOM.shieldSuccessOptionsContainer.style.display = 'none';
            if (DOM.shieldSuccessAwakeningBonusSelect) DOM.shieldSuccessAwakeningBonusSelect.value = "0";
        }
        if (DOM.considerPartnerDownCheckbox) DOM.considerPartnerDownCheckbox.checked = false;
        if (DOM.predictedAwakeningGaugeSpan) DOM.predictedAwakeningGaugeSpan.textContent = '--';
        if (DOM.awakeningAvailabilitySpan) {
            DOM.awakeningAvailabilitySpan.textContent = '--';
            DOM.awakeningAvailabilitySpan.className = 'info-value';
        }

        if (DOM.shareRedeployResultBtn) DOM.shareRedeployResultBtn.style.display = 'none';
        if (DOM.copyRedeployUrlBtn) DOM.copyRedeployUrlBtn.style.display = 'none';
    };

    if (!DOM.simulationResultsDiv) {
        applyResetState();
        return;
    }

    if (simulationResultsResetTween) {
        simulationResultsResetTween.kill();
        simulationResultsResetTween = null;
    }
    if (simulationResultsRevealTween) {
        simulationResultsRevealTween.kill();
        simulationResultsRevealTween = null;
    }
    if (simulationResultsHpBarTween) {
        simulationResultsHpBarTween.kill();
        simulationResultsHpBarTween = null;
    }

    gsap.killTweensOf(DOM.simulationResultsDiv);
    if (DOM.simulationHpBarFill) gsap.killTweensOf(DOM.simulationHpBarFill);

    if (!animate) {
        applyResetState();
        return;
    }

    simulationResultsResetTween = gsap.to(DOM.simulationResultsDiv, {
        opacity: 0,
        y: 20,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
            simulationResultsResetTween = null;
            applyResetState();
        }
    });
}

export function displayTotalTeamHpResults(scenarios) {
    const selectedPlayerChar = getSelectedPlayerChar();
    const selectedPartnerChar = getSelectedPartnerChar();
    const renderToken = ++teamHpDisplayRenderToken;

    if (!scenarios || !selectedPlayerChar || !selectedPartnerChar) {
        if (!DOM.totalHpDisplayArea) return;

        gsap.to(DOM.totalHpDisplayArea, {
            opacity: 0,
            y: 20,
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => {
                if (renderToken !== teamHpDisplayRenderToken) return;
                if (DOM.totalHpDisplayArea) DOM.totalHpDisplayArea.classList.remove('active');
                if (DOM.highestHpScenarioTitleSpan) DOM.highestHpScenarioTitleSpan.textContent = 'チーム合計体力(最高)';
                if (DOM.idealGainedHpSpan) DOM.idealGainedHpSpan.textContent = '--';
                if (DOM.idealSequenceList) DOM.idealSequenceList.innerHTML = '';
                if (DOM.compromiseHpScenarioTitleSpan) DOM.compromiseHpScenarioTitleSpan.textContent = 'チーム合計体力(妥協)';
                if (DOM.minGainedHpSpan) DOM.minGainedHpSpan.textContent = '--';
                if (DOM.minSequenceList) DOM.minSequenceList.innerHTML = '';
                if (DOM.bombHpScenarioTitleSpan) DOM.bombHpScenarioTitleSpan.textContent = 'チーム合計体力(爆弾)';
                if (DOM.bombGainedHpSpan) DOM.bombGainedHpSpan.textContent = '--';
                if (DOM.bombSequenceList) DOM.bombSequenceList.innerHTML = '';
                if (DOM.lowestHpScenarioTitleSpan) DOM.lowestHpScenarioTitleSpan.textContent = 'チーム合計体力(最低)';
                if (DOM.lowestGainedHpSpan) DOM.lowestGainedHpSpan.textContent = '--';
                if (DOM.lowestSequenceList) DOM.lowestSequenceList.innerHTML = '';

                if (DOM.shareTotalHpResultBtn) DOM.shareTotalHpResultBtn.style.display = 'none';
                if (DOM.copyTotalHpUrlBtn) DOM.copyTotalHpUrlBtn.style.display = 'none';
            }
        });
        return;
    }

    const { idealScenario, compromiseScenario, bombScenario, lowestScenario } = scenarios;

    if (DOM.totalHpDisplayArea) {
        gsap.killTweensOf(DOM.totalHpDisplayArea);
    } else {
        return;
    }

    if (DOM.selectedPlayerCharNameSummary && selectedPlayerChar) DOM.selectedPlayerCharNameSummary.textContent = selectedPlayerChar.name;
    if (DOM.selectedPartnerCharNameSummary && selectedPartnerChar) DOM.selectedPartnerCharNameSummary.textContent = selectedPartnerChar.name;

    DOM.totalHpDisplayArea.classList.add('active');
    gsap.fromTo(DOM.totalHpDisplayArea, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
    if (DOM.shareTotalHpResultBtn) DOM.shareTotalHpResultBtn.style.display = 'flex';
    if (DOM.copyTotalHpUrlBtn) DOM.copyTotalHpUrlBtn.style.display = 'flex';

    const formatNote = (rawNote = '') => {
        if (!rawNote) return '';
        let processedNote = rawNote;
        const regexToReplace = /(\(\d+\.\d+コスト換算\), 消費後実質コストオーバー\((\d+\.\d+)換算\))/;
        processedNote = processedNote.replace(regexToReplace, (_, __, overCost) => `コストオーバー (${overCost}コスト換算)`);
        processedNote = processedNote.replace(/,\s*最終残りコスト0のためHP0/g, '、最終残りコスト0のためHP0');
        processedNote = processedNote.replace(/,\s*$/, '');
        return processedNote.trim();
    };

    const generateListItems = (sequence) => {
        const fragment = document.createDocumentFragment();
        sequence?.forEach(item => {
            const li = document.createElement('li');
            const remainingCostValue = (item.remainingCost !== undefined && item.remainingCost !== null)
                ? Number.parseFloat(item.remainingCost)
                : undefined;
            const hasValidRemainingCost = typeof remainingCostValue === 'number' && !Number.isNaN(remainingCostValue);
            const remainingCostDisplay = hasValidRemainingCost ? `残り: ${item.remainingCost}` : '';
            const processedNote = formatNote(item.note);

            if (item.turn === 0) {
                const details = [];
                if (processedNote) details.push(processedNote);
                if (remainingCostDisplay) details.push(remainingCostDisplay);
                const detailText = details.length ? ` (${details.join(', ')})` : '';
                li.textContent = `試合開始時: ${item.hpGained.toLocaleString()} HP加算${detailText}`;
            } else {
                const charNameDisplay = item.charName || '';
                const shouldShowCompletionMessage = (item.hpGained <= 0) && (
                    (hasValidRemainingCost && remainingCostValue <= 0) ||
                    processedNote.includes('最終残りコスト0のためHP0') ||
                    processedNote.includes('チームコスト0のため出撃不可')
                );

                if (shouldShowCompletionMessage) {
                    li.textContent = `${item.turn}落ち(${charNameDisplay}): 残りコストが0になる為、計算終了`;
                } else {
                    const details = [];
                    if (processedNote) details.push(processedNote);
                    if (remainingCostDisplay) details.push(remainingCostDisplay);
                    const detailText = details.length ? ` (${details.join(', ')})` : '';
                    li.textContent = `${item.turn}落ち(${charNameDisplay}): ${item.hpGained.toLocaleString()} HP加算${detailText}`;
                }
            }

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

    const renderToken = ++simulationResultsRenderToken;

    if (simulationResultsResetTween) {
        simulationResultsResetTween.kill();
        simulationResultsResetTween = null;
    }
    if (simulationResultsRevealTween) {
        simulationResultsRevealTween.kill();
        simulationResultsRevealTween = null;
    }
    if (simulationResultsHpBarTween) {
        simulationResultsHpBarTween.kill();
        simulationResultsHpBarTween = null;
    }

    if (DOM.simulationResultsDiv) {
        gsap.killTweensOf(DOM.simulationResultsDiv);
    }
    if (DOM.simulationHpBarFill) {
        gsap.killTweensOf(DOM.simulationHpBarFill);
    }

    DOM.redeployCharNameSpan.textContent = charToRedeploy.name;
    DOM.redeployCharCostSpan.textContent = charToRedeploy.cost.toFixed(1);
    DOM.redeployOriginalHpSpan.textContent = charToRedeploy.hp.toLocaleString();
    DOM.redeployCostConsumedSpan.textContent = actualCostConsumed.toFixed(1);

    const originalHpValue = charToRedeploy.hp;
    const hpPercentage = originalHpValue > 0 ? (calculatedHp / originalHpValue) : 0;
    const percentageLabel = Number.isFinite(hpPercentage) && originalHpValue > 0
        ? `${Math.round(hpPercentage * 100)}%`
        : (calculatedHp <= 0 ? '0%' : '--%');

    DOM.redeployCalculatedHpSpan.textContent = `${calculatedHp.toLocaleString()} (${percentageLabel})`;

    DOM.redeployCalculatedHpSpan.classList.remove('red-value', 'low-hp-value');
    if (originalHpValue > 0 && calculatedHp < originalHpValue && calculatedHp > 0) {
        DOM.redeployCalculatedHpSpan.classList.add('red-value');
    } else if (calculatedHp === 0 && originalHpValue > 0) {
        DOM.redeployCalculatedHpSpan.classList.add('red-value');
    }

    if (DOM.simulationHpBarFill) {
        simulationResultsHpBarTween = gsap.to(DOM.simulationHpBarFill, {
            scaleX: hpPercentage, duration: 0.8, ease: "power3.out", transformOrigin: 'left center', overwrite: true
        });
        simulationResultsHpBarTween.eventCallback('onComplete', () => {
            if (renderToken !== simulationResultsRenderToken) return;
            simulationResultsHpBarTween = null;
        });

        if (hpPercentage <= 0.3) DOM.simulationHpBarFill.classList.add('hp-bar-low-pulse');
        else DOM.simulationHpBarFill.classList.remove('hp-bar-low-pulse');
    }

    if (DOM.simulationResultsDiv) {
        DOM.simulationResultsDiv.classList.add('active');
        simulationResultsRevealTween = gsap.fromTo(
            DOM.simulationResultsDiv,
            { opacity: 0, y: 20 },
            {
                opacity: 1,
                y: 0,
                duration: 0.4,
                ease: "power2.out",
                onComplete: () => {
                    if (renderToken !== simulationResultsRenderToken) return;
                    simulationResultsRevealTween = null;
                    if (DOM.awakeningSimulationArea) DOM.awakeningSimulationArea.style.display = 'block';
                    if (DOM.shareRedeployResultBtn) DOM.shareRedeployResultBtn.style.display = 'flex';
                    if (DOM.copyRedeployUrlBtn) DOM.copyRedeployUrlBtn.style.display = 'flex';
                }
            }
        );
    }
}

export function updateAwakeningGaugeUI(gaugeResult) {
    if (!DOM.predictedAwakeningGaugeSpan || !DOM.awakeningAvailabilitySpan) return;

    const resetBreakdown = () => {
        if (DOM.awakeningBreakdownDetails) {
            DOM.awakeningBreakdownDetails.hidden = true;
            DOM.awakeningBreakdownDetails.open = false;
        }
        if (DOM.awakeningDetailPreGaugeValue) DOM.awakeningDetailPreGaugeValue.textContent = '--%';
        if (DOM.awakeningDetailDamageValue) DOM.awakeningDetailDamageValue.textContent = '+--%';
        if (DOM.awakeningDetailDamageNote) DOM.awakeningDetailDamageNote.textContent = '想定被ダメージ: --';
        if (DOM.awakeningDetailOwnDownValue) DOM.awakeningDetailOwnDownValue.textContent = '+--%';
        if (DOM.awakeningDetailOwnDownStatus) DOM.awakeningDetailOwnDownStatus.textContent = '未適用';
        if (DOM.awakeningDetailDamageBonusValue) DOM.awakeningDetailDamageBonusValue.textContent = '+--%';
        if (DOM.awakeningDetailDamageBonusStatus) DOM.awakeningDetailDamageBonusStatus.textContent = '未適用';
        if (DOM.awakeningDetailShieldBonusValue) DOM.awakeningDetailShieldBonusValue.textContent = '+--%';
        if (DOM.awakeningDetailShieldBonusStatus) DOM.awakeningDetailShieldBonusStatus.textContent = '未適用';
        if (DOM.awakeningDetailPartnerBonusValue) DOM.awakeningDetailPartnerBonusValue.textContent = '+--%';
        if (DOM.awakeningDetailPartnerBonusStatus) DOM.awakeningDetailPartnerBonusStatus.textContent = '未適用';
        if (DOM.awakeningDetailTotalValue) DOM.awakeningDetailTotalValue.textContent = '--%';
    };

    const formatSignedPercentage = (value) => {
        if (!Number.isFinite(value)) return '+--%';
        const rounded = Math.round(value);
        const sign = rounded >= 0 ? '+' : '';
        return `${sign}${rounded}%`;
    };

    const formatBasePercentage = (value) => {
        if (!Number.isFinite(value)) return '--%';
        return `${Math.round(value)}%`;
    };

    const applyBreakdown = (breakdown) => {
        if (!DOM.awakeningBreakdownDetails) return;
        if (!breakdown) {
            resetBreakdown();
            return;
        }
        DOM.awakeningBreakdownDetails.hidden = false;

        if (DOM.awakeningDetailPreGaugeValue) {
            DOM.awakeningDetailPreGaugeValue.textContent = formatBasePercentage(breakdown.baseGauge);
        }
        if (DOM.awakeningDetailDamageValue) {
            DOM.awakeningDetailDamageValue.textContent = formatSignedPercentage(breakdown.damageIncrease);
        }
        if (DOM.awakeningDetailDamageNote) {
            if (Number.isFinite(breakdown.validatedDamageTaken) && Number.isFinite(breakdown.originalMaxHp)) {
                const taken = Math.round(breakdown.validatedDamageTaken);
                const maxHp = Math.round(breakdown.originalMaxHp);
                const percent = maxHp > 0 ? Math.round((taken / maxHp) * 100) : 0;
                DOM.awakeningDetailDamageNote.textContent = `想定被ダメージ: ${taken.toLocaleString()} / ${maxHp.toLocaleString()} (${percent}%)`;
            } else {
                DOM.awakeningDetailDamageNote.textContent = '想定被ダメージ: --';
            }
        }
        if (DOM.awakeningDetailOwnDownValue) {
            DOM.awakeningDetailOwnDownValue.textContent = formatSignedPercentage(breakdown.ownDown?.value ?? 0);
        }
        if (DOM.awakeningDetailOwnDownStatus) {
            DOM.awakeningDetailOwnDownStatus.textContent = breakdown.ownDown?.enabled ? '適用' : '未適用';
        }
        if (DOM.awakeningDetailDamageBonusValue) {
            DOM.awakeningDetailDamageBonusValue.textContent = formatSignedPercentage(breakdown.damageBonus?.value ?? 0);
        }
        if (DOM.awakeningDetailDamageBonusStatus) {
            DOM.awakeningDetailDamageBonusStatus.textContent = breakdown.damageBonus?.enabled ? '適用' : '未適用';
        }
        if (DOM.awakeningDetailShieldBonusValue) {
            DOM.awakeningDetailShieldBonusValue.textContent = formatSignedPercentage(breakdown.shieldBonus?.value ?? 0);
        }
        if (DOM.awakeningDetailShieldBonusStatus) {
            DOM.awakeningDetailShieldBonusStatus.textContent = breakdown.shieldBonus?.enabled ? '適用' : '未適用';
        }
        if (DOM.awakeningDetailPartnerBonusValue) {
            DOM.awakeningDetailPartnerBonusValue.textContent = formatSignedPercentage(breakdown.partnerBonus?.value ?? 0);
        }
        if (DOM.awakeningDetailPartnerBonusStatus) {
            DOM.awakeningDetailPartnerBonusStatus.textContent = breakdown.partnerBonus?.enabled ? '適用' : '未適用';
        }
        if (DOM.awakeningDetailTotalValue) {
            DOM.awakeningDetailTotalValue.textContent = formatBasePercentage(breakdown.total);
        }
    };

    if (!gaugeResult) {
        DOM.predictedAwakeningGaugeSpan.textContent = '--';
        DOM.awakeningAvailabilitySpan.textContent = '--';
        DOM.awakeningAvailabilitySpan.className = 'info-value';
        resetBreakdown();
        return;
    }

    if (gaugeResult.error) {
        DOM.predictedAwakeningGaugeSpan.textContent = '---';
        DOM.awakeningAvailabilitySpan.textContent = '--';
        DOM.awakeningAvailabilitySpan.className = 'info-value';
        if(DOM.beforeShotdownHpInput) DOM.beforeShotdownHpInput.style.borderColor = 'red';
        resetBreakdown();
        return;
    }

    if(DOM.beforeShotdownHpInput) {
        DOM.beforeShotdownHpInput.style.borderColor = '';
        const currentValue = DOM.beforeShotdownHpInput.value;
        const nextValue = gaugeResult.validatedDamageTaken.toString();
        if (currentValue !== '' && currentValue !== nextValue) {
             DOM.beforeShotdownHpInput.value = gaugeResult.validatedDamageTaken;
        }
    }

    DOM.predictedAwakeningGaugeSpan.textContent = `${gaugeResult.finalPredictedGauge}`;
    DOM.awakeningAvailabilitySpan.classList.remove('awakening-possible', 'awakening-not-possible');
    if (gaugeResult.isThresholdMet) {
        DOM.awakeningAvailabilitySpan.textContent = '使用可能';
        DOM.awakeningAvailabilitySpan.classList.add('awakening-possible');
    } else {
        DOM.awakeningAvailabilitySpan.textContent = '使用不可';
        DOM.awakeningAvailabilitySpan.classList.add('awakening-not-possible');
    }

    applyBreakdown(gaugeResult.breakdown);
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