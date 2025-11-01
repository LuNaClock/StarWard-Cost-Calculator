import {
  rawCharacterData,
  characterSequence,
  kanjiNameReadings,
  costRemainingMap,
  MAX_TEAM_COST,
  AVERAGE_GAUGE_COEFFICIENT,
  AWAKENING_THRESHOLD,
  AWAKENING_BONUS_BY_COST,
  PARTNER_DOWN_AWAKENING_BONUS
} from '../data.js';
import { toHiragana } from './utils.js';
import { calculateTeamHpScenariosForCharacters } from './calculator.js';

const HISTORY_KEY = 'starward-mobile-history-v1';
const HISTORY_LIMIT = 3;
const HISTORY_DUPLICATE_LIMIT = 3;
const appRoot = document.querySelector('.mobile-app');

const state = {
  characters: [],
  search: '',
  costFilter: 'all',
  sort: 'hp-desc',
  redeployTarget: 'player',
  history: [],
  cardScope: 'all',
  selected: {
    playerId: null,
    partnerId: null
  },
  pickerFilters: {
    player: { search: '', cost: 'all' },
    partner: { search: '', cost: 'all' }
  },
  activePicker: null
};

const dom = {
  screens: Array.from(document.querySelectorAll('.screen')),
  tabs: Array.from(document.querySelectorAll('.tab-button')),
  heroButtons: document.querySelectorAll('[data-nav-target]'),
  collapseToggles: document.querySelectorAll('.section-toggle'),
  remainingCost: document.getElementById('remainingCost'),
  teamTotal: document.querySelector('[data-bind="team-total"]'),
  playerCost: document.querySelector('[data-bind="player-cost"]'),
  playerHp: document.querySelector('[data-bind="player-hp"]'),
  partnerCost: document.querySelector('[data-bind="partner-cost"]'),
  partnerHp: document.querySelector('[data-bind="partner-hp"]'),
  redeployChips: document.getElementById('redeployChips'),
  preGauge: document.getElementById('preGauge'),
  damageTaken: document.getElementById('damageTaken'),
  ownDown: document.getElementById('ownDown'),
  damageBonus: document.getElementById('damageBonus'),
  bonusSelectField: document.querySelector('[data-field="bonus-select"]'),
  bonusSelect: document.getElementById('bonusSelect'),
  shieldBonus: document.getElementById('shieldBonus'),
  shieldBonusField: document.querySelector('[data-field="shield-bonus-select"]'),
  shieldBonusSelect: document.getElementById('shieldBonusSelect'),
  partnerDown: document.getElementById('partnerDown'),
  simResults: document.getElementById('simResults'),
  teamSummaryPanel: document.getElementById('teamSummaryPanel'),
  teamSummaryEmpty: document.querySelector('[data-role="team-summary-empty"]'),
  teamSummaryGrid: document.querySelector('[data-role="team-summary-grid"]'),
  selectedCharactersPanel: document.getElementById('selectedCharactersPanel'),
  selectedCharactersEmpty: document.querySelector('[data-role="selected-empty"]'),
  selectedCharacterGrid: document.getElementById('selectedCharacterGrid'),
  resultHp: document.querySelector('[data-bind="result-hp"]'),
  resultCost: document.querySelector('[data-bind="result-cost"]'),
  resultUnit: document.querySelector('[data-bind="result-unit"]'),
  resultBaseCost: document.querySelector('[data-bind="result-base-cost"]'),
  resultOriginalHp: document.querySelector('[data-bind="result-original-hp"]'),
  resultCostDetail: document.querySelector('[data-bind="result-cost-detail"]'),
  resultHpDetail: document.querySelector('[data-bind="result-hp-detail"]'),
  resultGauge: document.querySelector('[data-bind="result-gauge"]'),
  resultAwaken: document.querySelector('[data-bind="result-awaken"]'),
  resultHpBar: document.querySelector('[data-bind="result-hp-bar"]'),
  inlineAwakeningResults: document.getElementById('awakeningInlineResults'),
  inlineAwakeningGauge: document.querySelector('[data-inline="gauge"]'),
  inlineAwakeningStatus: document.querySelector('[data-inline="awaken"]'),
  awakeningBreakdown: document.getElementById('awakeningBreakdownMobile'),
  awakeningBreakdownPreGauge: document.querySelector('[data-awakening-mobile="pre-gauge"]'),
  awakeningBreakdownDamage: document.querySelector('[data-awakening-mobile="damage"]'),
  awakeningBreakdownDamageNote: document.querySelector('[data-awakening-mobile="damage-note"]'),
  awakeningBreakdownOwnDown: document.querySelector('[data-awakening-mobile="own-down"]'),
  awakeningBreakdownOwnDownStatus: document.querySelector('[data-awakening-mobile-status="own-down"]'),
  awakeningBreakdownDamageBonus: document.querySelector('[data-awakening-mobile="damage-bonus"]'),
  awakeningBreakdownDamageBonusStatus: document.querySelector('[data-awakening-mobile-status="damage-bonus"]'),
  awakeningBreakdownShieldBonus: document.querySelector('[data-awakening-mobile="shield-bonus"]'),
  awakeningBreakdownShieldBonusStatus: document.querySelector('[data-awakening-mobile-status="shield-bonus"]'),
  awakeningBreakdownPartnerBonus: document.querySelector('[data-awakening-mobile="partner-bonus"]'),
  awakeningBreakdownPartnerBonusStatus: document.querySelector('[data-awakening-mobile-status="partner-bonus"]'),
  awakeningBreakdownTotal: document.querySelector('[data-awakening-mobile="total"]'),
  recentList: document.getElementById('recentList'),
  clearHistory: document.querySelector('[data-action="clear-history"]'),
  cardSearch: document.getElementById('cardSearch'),
  costFilters: document.getElementById('costFilters'),
  sortButtons: document.querySelectorAll('.sort-select'),
  cardGrid: document.getElementById('cardGrid'),
  recentFilterNotice: document.getElementById('recentFilterNotice'),
  recentFilterText: document.querySelector('[data-role="recent-notice-text"]'),
  resetCardScope: document.querySelector('[data-action="reset-card-scope"]')
};

const scenarioBindings = initializeScenarioBindings();

const pickerTypes = ['player', 'partner'];
const pickerRefs = {
  player: null,
  partner: null
};

function initializeScenarioBindings() {
  const cards = Array.from(document.querySelectorAll('.team-summary-card[data-scenario]'));
  return cards.reduce((acc, card) => {
    const key = card.dataset.scenario;
    if (!key) {
      return acc;
    }
    const title = card.querySelector('[data-role="title"]');
    const value = card.querySelector('[data-role="value"]');
    acc[key] = {
      card,
      title,
      value,
      list: card.querySelector('[data-role="list"]'),
      details: card.querySelector('details'),
      defaultTitle: title ? title.textContent : '',
      defaultValue: value ? value.textContent : ''
    };
    return acc;
  }, {});
}

function buildPickerRefs(type) {
  const container = document.querySelector(`.character-picker[data-picker-role="${type}"]`);
  if (!container) {
    return null;
  }
  const helper = container.querySelector('.character-picker-search-helper');
  const helperDefaultText = (helper?.dataset?.defaultText ?? helper?.textContent ?? '').trim();
  const refs = {
    container,
    toggle: container.querySelector(`[data-picker-toggle="${type}"]`),
    panel: container.querySelector(`[data-picker-panel="${type}"]`),
    search: container.querySelector(`[data-picker-search="${type}"]`),
    searchContainer: container.querySelector('.character-picker-search'),
    list: container.querySelector(`[data-picker-list="${type}"]`),
    selectedIcon: container.querySelector(`[data-picker-selected-icon="${type}"]`),
    selectedName: container.querySelector(`[data-picker-selected-name="${type}"]`),
    costButtons: Array.from(container.querySelectorAll('[data-picker-cost]')),
    helper,
    helperDefaultText
  };
  if (refs.panel) {
    refs.panel.hidden = true;
  }
  return refs;
}

function initializePickerRefs() {
  pickerTypes.forEach((type) => {
    pickerRefs[type] = buildPickerRefs(type);
  });
}

function hasNativeLazyLoadingSupport() {
  return typeof HTMLImageElement !== 'undefined'
    && 'loading' in HTMLImageElement.prototype;
}

function isIosSafari() {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return false;
  }
  const ua = navigator.userAgent;
  const isIosDevice = /iPad|iPhone|iPod/.test(ua);
  if (!isIosDevice) {
    return false;
  }
  const isSafari = /Safari/.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(ua);
  return isSafari;
}

function isIosChromium() {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return false;
  }
  const ua = navigator.userAgent;
  const isIosDevice = /iPad|iPhone|iPod/.test(ua);
  if (!isIosDevice) {
    return false;
  }
  return /(CriOS|EdgiOS|OPiOS)/.test(ua);
}

function createCharacterAvatar(character, size = 'default') {
  const avatar = document.createElement('div');
  const isSmall = size === 'small';
  avatar.className = `character-picker-avatar${isSmall ? ' small' : ''}`;

  const img = document.createElement('img');
  img.alt = `${character.name}のアイコン`;
  const desiredLoading = isSmall ? 'eager' : 'lazy';
  if (hasNativeLazyLoadingSupport() && !isIosSafari()) {
    img.loading = desiredLoading;
  } else if (isSmall && isIosChromium()) {
    img.setAttribute('loading', 'eager');
  }

  const fallback = document.createElement('span');
  fallback.className = 'character-icon-fallback';
  fallback.textContent = character.name.charAt(0);

  if (character.image) {
    img.src = character.image;
    const markVisibleIfReady = () => {
      if (img.complete && img.naturalWidth > 0) {
        avatar.classList.add('show-image');
      }
    };
    img.addEventListener('load', () => {
      avatar.classList.add('show-image');
    });
    img.addEventListener('error', () => {
      avatar.classList.remove('show-image');
    });
    markVisibleIfReady();
  }

  avatar.appendChild(img);
  avatar.appendChild(fallback);
  return avatar;
}

function updatePickerDisplay(type) {
  const refs = pickerRefs[type];
  if (!refs) {
    return;
  }
  const selectedCharacter = getSelectedCharacterByRole(type);
  const isEmpty = !selectedCharacter;
  if (refs.toggle) {
    refs.toggle.classList.toggle('is-empty', isEmpty);
  }
  if (refs.container) {
    refs.container.classList.toggle('is-empty', isEmpty);
  }
  if (refs.selectedIcon) {
    refs.selectedIcon.innerHTML = '';
    if (selectedCharacter) {
      refs.selectedIcon.classList.remove('is-placeholder');
      refs.selectedIcon.appendChild(createCharacterAvatar(selectedCharacter, 'small'));
    } else {
      refs.selectedIcon.classList.add('is-placeholder');
      refs.selectedIcon.textContent = '?';
    }
  }
  if (refs.selectedName) {
    refs.selectedName.textContent = selectedCharacter
      ? `${selectedCharacter.name} (コスト${selectedCharacter.cost.toFixed(1)})`
      : '未選択';
  }
}

function updatePickerCostButtons(type) {
  const refs = pickerRefs[type];
  if (!refs || !refs.costButtons) {
    return;
  }
  const currentCost = state.pickerFilters[type]?.cost ?? 'all';
  refs.costButtons.forEach((button) => {
    const buttonCost = button.dataset.pickerCost || 'all';
    const isActive = buttonCost === currentCost;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function updatePickerSearchFeedback(type, filteredCount) {
  const refs = pickerRefs[type];
  if (!refs) {
    return;
  }

  const filters = state.pickerFilters[type] || { search: '', cost: 'all' };
  const searchTerm = (filters.search || '').trim();
  const hasSearchTerm = searchTerm.length > 0;
  const hasResults = filteredCount > 0;

  if (refs.helper) {
    const defaultText = refs.helperDefaultText || refs.helper.dataset?.defaultText || refs.helper.textContent || '';
    if (!hasSearchTerm) {
      refs.helper.textContent = defaultText;
    } else if (hasResults) {
      refs.helper.textContent = `該当するキャラ: ${filteredCount}件`;
    } else {
      refs.helper.textContent = '該当するキャラクターが見つかりません';
    }
    refs.helper.classList.toggle('has-results', hasSearchTerm && hasResults);
    refs.helper.classList.toggle('no-results', hasSearchTerm && !hasResults);
  }

  if (refs.searchContainer) {
    refs.searchContainer.classList.toggle('is-filtering', hasSearchTerm);
    refs.searchContainer.classList.toggle('has-results', hasSearchTerm && hasResults);
    refs.searchContainer.classList.toggle('no-results', hasSearchTerm && !hasResults);
  }
}

function renderPickerList(type) {
  const refs = pickerRefs[type];
  if (!refs || !refs.list) {
    return;
  }

  updatePickerCostButtons(type);

  const filters = state.pickerFilters[type] || { search: '', cost: 'all' };
  const query = filters.search.trim().toLowerCase();
  const hiraQuery = toHiragana(query);
  const filtered = state.characters.filter((char) => {
    if (filters.cost !== 'all' && char.costKey !== filters.cost) {
      return false;
    }
    if (!query) {
      return true;
    }
    const nameLower = char.name.toLowerCase();
    const kataLower = (char.kata || '').toLowerCase();
    return (
      nameLower.includes(query) ||
      (char.hira || '').includes(hiraQuery) ||
      kataLower.includes(query)
    );
  });

  updatePickerSearchFeedback(type, filtered.length);

  const sorted = filtered.sort((a, b) => sortCharacters(a, b, state.sort));
  const list = refs.list;
  list.innerHTML = '';

  const selectedKey = type === 'partner' ? 'partnerId' : 'playerId';
  const selectedId = state.selected[selectedKey];
  if (selectedId !== null && typeof selectedId !== 'undefined') {
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'character-picker-item clear-option';
    clearButton.dataset.pickerClear = 'true';
    clearButton.textContent = '選択を解除';
    clearButton.setAttribute('role', 'option');
    clearButton.setAttribute('aria-selected', 'false');
    list.appendChild(clearButton);
  }

  if (!sorted.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'character-picker-empty';
    emptyMessage.textContent = '該当するキャラクターが見つかりません';
    list.appendChild(emptyMessage);
    return;
  }

  sorted.forEach((char) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'character-picker-item';
    const isSelected = selectedId === char.id;
    if (isSelected) {
      item.classList.add('selected');
    }
    item.dataset.characterId = String(char.id);
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(isSelected));
    item.appendChild(createCharacterAvatar(char, 'small'));

    const info = document.createElement('div');
    info.className = 'character-picker-item-info';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'character-picker-item-name';
    nameSpan.textContent = char.name;
    const metaSpan = document.createElement('span');
    metaSpan.className = 'character-picker-item-meta';
    metaSpan.textContent = `${char.cost.toFixed(1)} COST / ${char.hp.toLocaleString()} HP`;
    info.append(nameSpan, metaSpan);

    item.appendChild(info);
    list.appendChild(item);
  });
}

function closePicker(type) {
  const refs = pickerRefs[type];
  if (!refs || !refs.container) {
    return;
  }
  refs.container.classList.remove('open');
  if (refs.toggle) {
    refs.toggle.setAttribute('aria-expanded', 'false');
  }
  if (refs.panel) {
    refs.panel.hidden = true;
  }
  if (state.activePicker === type) {
    state.activePicker = null;
  }
}

function closeAllPickers(exceptType = null) {
  pickerTypes.forEach((type) => {
    if (exceptType && type === exceptType) {
      return;
    }
    closePicker(type);
  });
}

function openPicker(type) {
  const refs = pickerRefs[type];
  if (!refs || !refs.container) {
    return;
  }
  closeAllPickers(type);
  refs.container.classList.add('open');
  if (refs.toggle) {
    refs.toggle.setAttribute('aria-expanded', 'true');
  }
  if (refs.panel) {
    refs.panel.hidden = false;
  }
  state.activePicker = type;
  const filters = state.pickerFilters[type] || { search: '', cost: 'all' };
  if (refs.search) {
    refs.search.value = filters.search;
    requestAnimationFrame(() => {
      try {
        refs.search.focus({ preventScroll: true });
        refs.search.select();
      } catch (error) {
        refs.search.focus();
      }
    });
  }
  renderPickerList(type);
}

function togglePicker(type) {
  if (state.activePicker === type) {
    closePicker(type);
  } else {
    openPicker(type);
  }
}

function resetPickerSearch(type) {
  const refs = pickerRefs[type];
  if (!state.pickerFilters[type]) {
    state.pickerFilters[type] = { search: '', cost: 'all' };
  }
  state.pickerFilters[type].search = '';
  if (refs?.search) {
    refs.search.value = '';
  }
}

function setSelectedCharacter(type, characterId) {
  const key = type === 'partner' ? 'partnerId' : 'playerId';
  if (characterId === null || characterId === undefined) {
    state.selected[key] = null;
  } else {
    const parsedId = typeof characterId === 'number' ? characterId : Number(characterId);
    const normalizedId = Number.isNaN(parsedId) ? null : parsedId;
    state.selected[key] = normalizedId;
  }
  resetPickerSearch(type);
  updatePickerDisplay(type);
  closePicker(type);
  updateSelectedSummaries();
  renderCards();
}

function handlePickerOutsideClick(event) {
  const currentType = state.activePicker;
  if (!currentType) {
    return;
  }
  const refs = pickerRefs[currentType];
  if (!refs?.container) {
    return;
  }
  if (refs.container.contains(event.target)) {
    return;
  }
  closePicker(currentType);
}

function handlePickerKeydown(event) {
  if (event.key === 'Escape' && state.activePicker) {
    closePicker(state.activePicker);
  }
}

function initializePickers() {
  let hasPicker = false;
  pickerTypes.forEach((type) => {
    const refs = pickerRefs[type];
    if (!refs || !refs.container) {
      return;
    }
    hasPicker = true;
    if (refs.toggle) {
      refs.toggle.addEventListener('click', () => togglePicker(type));
    }
    if (refs.search) {
      refs.search.addEventListener('input', () => {
        state.pickerFilters[type].search = refs.search.value;
        renderPickerList(type);
      });
    }
    if (refs.costButtons && refs.costButtons.length) {
      refs.costButtons.forEach((button) => {
        button.addEventListener('click', () => {
          state.pickerFilters[type].cost = button.dataset.pickerCost || 'all';
          updatePickerCostButtons(type);
          renderPickerList(type);
        });
      });
    }
    if (refs.list) {
      refs.list.addEventListener('click', (event) => {
        const target = event.target.closest('button.character-picker-item');
        if (!target) {
          return;
        }
        event.preventDefault();
        if (target.dataset.pickerClear === 'true') {
          setSelectedCharacter(type, null);
        } else {
          setSelectedCharacter(type, Number(target.dataset.characterId));
        }
      });
    }
    updatePickerDisplay(type);
    updatePickerCostButtons(type);
  });

  if (hasPicker) {
    document.addEventListener('click', handlePickerOutsideClick);
    document.addEventListener('keydown', handlePickerKeydown);
  }
}

function initializeCharacters() {
  const orderedCharacters = characterSequence
    .map((id) => {
      const char = rawCharacterData[id];
      if (!char) {
        return null;
      }
      const key = Number(char.cost).toFixed(1);
      const readings = kanjiNameReadings[char.name] || {};
      const hiraSource = toHiragana(char.name);
      const hira = readings.hiragana || hiraSource;
      const kata = readings.katakana || hiraSource.replace(/[\u3041-\u3096]/g, (m) => String.fromCharCode(m.charCodeAt(0) + 0x60));
      const durabilityOptions = buildDurabilityTable(char);
      return {
        ...char,
        id,
        costKey: key,
        hira: hira,
        kata: kata,
        durabilityOptions
      };
    })
    .filter(Boolean);
  state.characters = orderedCharacters;
}

function buildDurabilityTable(char) {
  const key = Number(char.cost).toFixed(1);
  const baseValues = new Set([Number(char.cost)]);
  const mapValues = costRemainingMap[key] || [];
  mapValues.forEach((value) => baseValues.add(Number(value)));
  const sorted = Array.from(baseValues).sort((a, b) => b - a);
  return sorted.map((remaining) => {
    const effective = Math.min(remaining, Number(char.cost));
    const hp = Math.round(char.hp * (effective / Number(char.cost)));
    return {
      remaining,
      hp,
      ratio: Math.min(1, effective / Number(char.cost))
    };
  });
}

function formatCostValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value.toFixed(1)} COST`;
  }
  const parsed = Number(value);
  if (!Number.isNaN(parsed)) {
    return `${parsed.toFixed(1)} COST`;
  }
  return '--';
}

function createScenarioListItem(step) {
  const item = document.createElement('li');
  item.className = 'scenario-step';

  const header = document.createElement('div');
  header.className = 'scenario-step-header';
  const title = document.createElement('span');
  title.className = 'scenario-step-title';
  let titleText;
  if (step.turn === 0) {
    titleText = '試合開始時';
  } else {
    const turnLabel = step.turn <= 2 ? `${step.turn}落ち` : `${step.turn}回目`;
    const characterLabel = step.charName ? `${step.charType ? `${step.charType} ` : ''}${step.charName}` : '';
    titleText = characterLabel ? `${turnLabel}: ${characterLabel}` : turnLabel;
  }
  title.textContent = titleText;

  const value = document.createElement('span');
  value.className = 'scenario-step-value';
  if (typeof step.hpGained === 'number' && Number.isFinite(step.hpGained)) {
    value.textContent = step.turn === 0 ? `${step.hpGained.toLocaleString()} HP` : `+${step.hpGained.toLocaleString()} HP`;
  } else {
    value.textContent = '--';
  }

  header.append(title, value);
  item.appendChild(header);

  if (step.turn !== 0) {
    const meta = document.createElement('div');
    meta.className = 'scenario-step-meta';

    const consumed = document.createElement('span');
    consumed.textContent = `消費: ${formatCostValue(step.costConsumed ?? 0)}`;
    meta.appendChild(consumed);

    const remaining = document.createElement('span');
    remaining.textContent = `残り: ${formatCostValue(step.remainingCost ?? '')}`;
    meta.appendChild(remaining);

    item.appendChild(meta);
  }

  const noteTexts = [];
  const remainingCostNumber = Number(step.remainingCost);
  const shouldShowCompletionOnly = !Number.isNaN(remainingCostNumber) && remainingCostNumber <= 0;

  if (shouldShowCompletionOnly) {
    noteTexts.push('残りコスト0の為、計算終了');
  } else {
    const originalNote = typeof step.note === 'string' ? step.note.trim() : '';
    if (originalNote) {
      noteTexts.push(originalNote);
    }
  }

  noteTexts.forEach((text) => {
    const note = document.createElement('p');
    note.className = 'scenario-step-note';
    note.textContent = text;
    item.appendChild(note);
  });

  return item;
}

function renderTeamSummary(selection = getSelectedCharacters()) {
  if (!dom.teamSummaryPanel || !dom.teamSummaryGrid) {
    return;
  }
  const { player, partner } = selection;

  if (!player || !partner) {
    resetScenarioDisplay();
    return;
  }

  const scenarios = calculateTeamHpScenariosForCharacters(player, partner);
  if (!scenarios) {
    resetScenarioDisplay();
    return;
  }

  if (dom.teamSummaryEmpty) {
    dom.teamSummaryEmpty.hidden = true;
  }
  dom.teamSummaryGrid.hidden = false;

  const mapping = [
    ['idealScenario', 'ideal'],
    ['compromiseScenario', 'compromise'],
    ['bombScenario', 'bomb'],
    ['lowestScenario', 'lowest']
  ];

  mapping.forEach(([scenarioKey, bindingKey]) => {
    const data = scenarios[scenarioKey];
    const binding = scenarioBindings[bindingKey];
    if (!data || !binding) return;
    if (binding.details) {
      binding.details.open = false;
    }
    if (binding.title) {
      binding.title.textContent = data.name;
    }
    if (binding.value) {
      const totalHpText = typeof data.totalHp === 'number' ? data.totalHp.toLocaleString() : '--';
      binding.value.textContent = `${totalHpText} HP`;
    }
    if (binding.list) {
      binding.list.innerHTML = '';
      data.sequence.forEach((step) => {
        binding.list.appendChild(createScenarioListItem(step));
      });
    }
  });
}

function resetScenarioDisplay() {
  if (dom.teamSummaryEmpty) {
    dom.teamSummaryEmpty.hidden = false;
  }
  dom.teamSummaryGrid.hidden = true;
  Object.values(scenarioBindings).forEach((binding) => {
    if (!binding) return;
    if (binding.title) {
      binding.title.textContent = binding.defaultTitle;
    }
    if (binding.value) {
      binding.value.textContent = binding.defaultValue || '--';
    }
    if (binding.list) {
      binding.list.innerHTML = '';
    }
    if (binding.details) {
      binding.details.open = false;
    }
  });
}

function renderSelectedCharacterDetails(selection = getSelectedCharacters()) {
  if (!dom.selectedCharacterGrid) {
    return;
  }

  const cardMap = new Map();
  const registerCharacter = (character, role) => {
    if (!character) return;
    const existing = cardMap.get(character.id);
    if (existing) {
      existing.roles.push(role);
      return;
    }
    cardMap.set(character.id, { character, roles: [role] });
  };

  registerCharacter(selection.player, '自機');
  registerCharacter(selection.partner, '相方');

  dom.selectedCharacterGrid.innerHTML = '';

  if (!cardMap.size) {
    dom.selectedCharacterGrid.hidden = true;
    if (dom.selectedCharactersEmpty) {
      dom.selectedCharactersEmpty.hidden = false;
    }
    return;
  }

  dom.selectedCharacterGrid.hidden = false;
  if (dom.selectedCharactersEmpty) {
    dom.selectedCharactersEmpty.hidden = true;
  }

  Array.from(cardMap.values()).forEach(({ character, roles }) => {
    const card = createCharacterCardElement(character, { selectedRoles: roles });
    dom.selectedCharacterGrid.appendChild(card);
  });
}

function setupRouting() {
  const handleHashChange = () => {
    const hash = window.location.hash || '#home';
    const targetId = hash.replace('#', '');
    switchTab(targetId);
  };

  dom.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('aria-controls');
      window.location.hash = `#${target}`;
    });
  });

  dom.heroButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.navTarget;
      const scope = btn.dataset.cardScope;
      if (scope) {
        applyCardScope(scope);
      } else if (target === '#cards') {
        applyCardScope('all');
      }
      if (target) {
        window.location.hash = target;
      }
    });
  });

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

function applyCardScope(scope) {
  state.cardScope = scope === 'recent' ? 'recent' : 'all';
  updateCardScopeNotice();
  renderCards();
}

function updateCardScopeNotice() {
  if (!dom.recentFilterNotice || !dom.recentFilterText) {
    return;
  }
  const isRecent = state.cardScope === 'recent';
  dom.recentFilterNotice.hidden = !isRecent;
  if (!isRecent) {
    return;
  }
  dom.recentFilterText.textContent = state.history.length
    ? '最近の計算に使ったキャラのみ表示中'
    : '最近の計算履歴がまだありません';
}

function switchTab(targetId) {
  const validIds = dom.screens.map((screen) => screen.id);
  const resolvedId = validIds.includes(targetId) ? targetId : 'home';
  dom.screens.forEach((screen) => {
    const isTarget = screen.id === resolvedId;
    screen.toggleAttribute('hidden', !isTarget);
  });

  dom.tabs.forEach((tab) => {
    const isActive = tab.getAttribute('aria-controls') === resolvedId;
    tab.setAttribute('aria-selected', String(isActive));
  });
}

function setupCollapse() {
  dom.collapseToggles.forEach((toggle) => {
    const targetSelector = toggle.dataset.collapse;
    const target = document.querySelector(targetSelector);
    if (!target) return;

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      target.dataset.open = String(!expanded);
    });
  });
}

function calculateRemainingTeamCost(totalCost, maxCost) {
  const sanitizedTotal = typeof totalCost === 'number' && Number.isFinite(totalCost)
    ? totalCost
    : 0;
  const sanitizedMax = typeof maxCost === 'number' && Number.isFinite(maxCost)
    ? maxCost
    : 0;
  const remainingRaw = Math.max(0, sanitizedMax - sanitizedTotal);
  const roundedRemaining = Math.round(remainingRaw * 2) / 2;
  return Number.isFinite(roundedRemaining) ? roundedRemaining : 0;
}

function updateSelectedSummaries({ persistHistory = true } = {}) {
  const selection = getSelectedCharacters();
  const { player, partner } = selection;
  if (dom.playerCost) {
    dom.playerCost.textContent = player ? player.cost.toFixed(1) : '--';
  }
  if (dom.playerHp) {
    dom.playerHp.textContent = player ? player.hp.toLocaleString() : '--';
  }
  if (dom.partnerCost) {
    dom.partnerCost.textContent = partner ? partner.cost.toFixed(1) : '--';
  }
  if (dom.partnerHp) {
    dom.partnerHp.textContent = partner ? partner.hp.toLocaleString() : '--';
  }
  const total = (player?.cost || 0) + (partner?.cost || 0);
  if (dom.teamTotal) {
    dom.teamTotal.textContent = total.toFixed(1);
  }

  if (dom.remainingCost) {
    const remaining = calculateRemainingTeamCost(total, MAX_TEAM_COST);
    dom.remainingCost.value = remaining.toFixed(1);
  }

  const targetChar = resolveRedeployTarget(selection);
  if (dom.damageTaken) {
    dom.damageTaken.max = targetChar ? String(targetChar.hp) : '';
  }

  renderTeamSummary(selection);
  renderSelectedCharacterDetails(selection);

  performSimulation({ commitInputs: true, persistHistory });
}

function getSelectedCharacterByRole(role) {
  const key = role === 'partner' ? 'partnerId' : 'playerId';
  const id = state.selected[key];
  if (typeof id !== 'number' || Number.isNaN(id)) {
    return null;
  }
  return state.characters.find((char) => char.id === id) || null;
}

function getSelectedCharacters() {
  return {
    player: getSelectedCharacterByRole('player'),
    partner: getSelectedCharacterByRole('partner')
  };
}

function resolveRedeployTarget(selection = getSelectedCharacters()) {
  const { player, partner } = selection;
  return state.redeployTarget === 'partner' ? partner : player;
}

function setRedeployTarget(target) {
  const normalized = target === 'partner' ? 'partner' : 'player';
  state.redeployTarget = normalized;
  if (!dom.redeployChips) {
    return;
  }
  dom.redeployChips.querySelectorAll('button[data-value]').forEach((chip) => {
    const isActive = chip.dataset.value === normalized;
    chip.setAttribute('aria-pressed', String(isActive));
  });
}

function setupRedeployChips() {
  if (!dom.redeployChips) {
    return;
  }
  dom.redeployChips.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    setRedeployTarget(button.dataset.value);
    updateSelectedSummaries();
  });
  setRedeployTarget(state.redeployTarget);
}

function setupBonusToggle() {
  const toggleDamageField = () => {
    if (!dom.bonusSelectField || !dom.damageBonus) {
      return;
    }
    dom.bonusSelectField.toggleAttribute('hidden', !dom.damageBonus.checked);
  };
  const toggleShieldField = () => {
    if (!dom.shieldBonusField || !dom.shieldBonus) {
      return;
    }
    dom.shieldBonusField.toggleAttribute('hidden', !dom.shieldBonus.checked);
  };

  if (dom.damageBonus) {
    dom.damageBonus.addEventListener('change', () => {
      toggleDamageField();
      performSimulation({ commitInputs: true });
    });
    toggleDamageField();
  }

  if (dom.shieldBonus) {
    dom.shieldBonus.addEventListener('change', () => {
      toggleShieldField();
      if (!dom.shieldBonus.checked && dom.shieldBonusSelect) {
        dom.shieldBonusSelect.value = '0';
      }
      performSimulation({ commitInputs: true });
    });
    toggleShieldField();
  }
}

function setupSimulationAutoUpdate() {
  if (!dom.simResults) {
    return;
  }

  if (dom.remainingCost) {
    dom.remainingCost.addEventListener('input', () => performSimulation({ commitInputs: false }));
    dom.remainingCost.addEventListener('change', () => performSimulation({ commitInputs: true }));
  }

  if (dom.preGauge) {
    dom.preGauge.addEventListener('input', () => performSimulation({ commitInputs: false }));
    dom.preGauge.addEventListener('change', () => performSimulation({ commitInputs: true }));
  }

  if (dom.damageTaken) {
    dom.damageTaken.addEventListener('input', () => performSimulation({ commitInputs: false }));
    dom.damageTaken.addEventListener('change', () => performSimulation({ commitInputs: true }));
  }

  if (dom.bonusSelect) {
    dom.bonusSelect.addEventListener('change', () => performSimulation({ commitInputs: true }));
  }

  if (dom.shieldBonusSelect) {
    dom.shieldBonusSelect.addEventListener('change', () => performSimulation({ commitInputs: true }));
  }

  if (dom.ownDown) {
    dom.ownDown.addEventListener('change', () => performSimulation({ commitInputs: true }));
  }

  if (dom.partnerDown) {
    dom.partnerDown.addEventListener('change', () => performSimulation({ commitInputs: true }));
  }

}

function applyInlineAwakeningState({
  gaugeText = '--%',
  statusText = '--',
  isReady = null,
  visible = false
} = {}) {
  if (dom.inlineAwakeningGauge) {
    dom.inlineAwakeningGauge.textContent = gaugeText;
  }
  if (dom.inlineAwakeningStatus) {
    dom.inlineAwakeningStatus.textContent = statusText;
    dom.inlineAwakeningStatus.classList.remove('inline-result__status--ready', 'inline-result__status--not-ready');
    if (typeof isReady === 'boolean') {
      dom.inlineAwakeningStatus.classList.add(
        isReady ? 'inline-result__status--ready' : 'inline-result__status--not-ready'
      );
    }
  }
  if (dom.inlineAwakeningResults) {
    dom.inlineAwakeningResults.hidden = !visible;
  }
}

function resetAwakeningBreakdown() {
  if (dom.awakeningBreakdown) {
    dom.awakeningBreakdown.hidden = true;
    dom.awakeningBreakdown.open = false;
  }
  if (dom.awakeningBreakdownPreGauge) dom.awakeningBreakdownPreGauge.textContent = '--%';
  if (dom.awakeningBreakdownDamage) dom.awakeningBreakdownDamage.textContent = '+--%';
  if (dom.awakeningBreakdownDamageNote) dom.awakeningBreakdownDamageNote.textContent = '想定被ダメージ: --';
  if (dom.awakeningBreakdownOwnDown) dom.awakeningBreakdownOwnDown.textContent = '+--%';
  if (dom.awakeningBreakdownOwnDownStatus) dom.awakeningBreakdownOwnDownStatus.textContent = '未適用';
  if (dom.awakeningBreakdownDamageBonus) dom.awakeningBreakdownDamageBonus.textContent = '+--%';
  if (dom.awakeningBreakdownDamageBonusStatus) dom.awakeningBreakdownDamageBonusStatus.textContent = '未適用';
  if (dom.awakeningBreakdownShieldBonus) dom.awakeningBreakdownShieldBonus.textContent = '+--%';
  if (dom.awakeningBreakdownShieldBonusStatus) dom.awakeningBreakdownShieldBonusStatus.textContent = '未適用';
  if (dom.awakeningBreakdownPartnerBonus) dom.awakeningBreakdownPartnerBonus.textContent = '+--%';
  if (dom.awakeningBreakdownPartnerBonusStatus) dom.awakeningBreakdownPartnerBonusStatus.textContent = '未適用';
  if (dom.awakeningBreakdownTotal) dom.awakeningBreakdownTotal.textContent = '--%';
}

function updateAwakeningBreakdown(breakdown) {
  if (!dom.awakeningBreakdown) {
    return;
  }
  if (!breakdown) {
    resetAwakeningBreakdown();
    return;
  }

  const formatBase = (value) => {
    if (!Number.isFinite(value)) return '--%';
    return `${Math.round(value)}%`;
  };

  const formatSigned = (value) => {
    if (!Number.isFinite(value)) return '+--%';
    const rounded = Math.round(value);
    const sign = rounded >= 0 ? '+' : '';
    return `${sign}${rounded}%`;
  };

  dom.awakeningBreakdown.hidden = false;

  if (dom.awakeningBreakdownPreGauge) {
    dom.awakeningBreakdownPreGauge.textContent = formatBase(breakdown.baseGauge);
  }
  if (dom.awakeningBreakdownDamage) {
    dom.awakeningBreakdownDamage.textContent = formatSigned(breakdown.damageIncrease);
  }
  if (dom.awakeningBreakdownDamageNote) {
    if (Number.isFinite(breakdown.damageTaken) && Number.isFinite(breakdown.originalHp)) {
      const taken = Math.round(breakdown.damageTaken);
      const maxHp = Math.round(breakdown.originalHp);
      const percent = maxHp > 0 ? Math.round((taken / maxHp) * 100) : 0;
      dom.awakeningBreakdownDamageNote.textContent = `想定被ダメージ: ${taken.toLocaleString()} / ${maxHp.toLocaleString()} (${percent}%)`;
    } else {
      dom.awakeningBreakdownDamageNote.textContent = '想定被ダメージ: --';
    }
  }
  if (dom.awakeningBreakdownOwnDown) {
    dom.awakeningBreakdownOwnDown.textContent = formatSigned(breakdown.ownDownValue ?? 0);
  }
  if (dom.awakeningBreakdownOwnDownStatus) {
    dom.awakeningBreakdownOwnDownStatus.textContent = breakdown.ownDownEnabled ? '適用' : '未適用';
  }
  if (dom.awakeningBreakdownDamageBonus) {
    dom.awakeningBreakdownDamageBonus.textContent = formatSigned(breakdown.damageBonusValue ?? 0);
  }
  if (dom.awakeningBreakdownDamageBonusStatus) {
    dom.awakeningBreakdownDamageBonusStatus.textContent = breakdown.damageBonusEnabled ? '適用' : '未適用';
  }
  if (dom.awakeningBreakdownShieldBonus) {
    dom.awakeningBreakdownShieldBonus.textContent = formatSigned(breakdown.shieldBonusValue ?? 0);
  }
  if (dom.awakeningBreakdownShieldBonusStatus) {
    dom.awakeningBreakdownShieldBonusStatus.textContent = breakdown.shieldBonusEnabled ? '適用' : '未適用';
  }
  if (dom.awakeningBreakdownPartnerBonus) {
    dom.awakeningBreakdownPartnerBonus.textContent = formatSigned(breakdown.partnerBonusValue ?? 0);
  }
  if (dom.awakeningBreakdownPartnerBonusStatus) {
    dom.awakeningBreakdownPartnerBonusStatus.textContent = breakdown.partnerBonusEnabled ? '適用' : '未適用';
  }
  if (dom.awakeningBreakdownTotal) {
    dom.awakeningBreakdownTotal.textContent = formatBase(breakdown.total);
  }
}

function clearSimulationResults() {
  if (dom.resultHp) {
    dom.resultHp.textContent = '--';
  }
  if (dom.resultCost) {
    dom.resultCost.textContent = '--';
  }
  if (dom.resultUnit) {
    dom.resultUnit.textContent = '--';
  }
  if (dom.resultBaseCost) {
    dom.resultBaseCost.textContent = '--';
  }
  if (dom.resultOriginalHp) {
    dom.resultOriginalHp.textContent = '--';
  }
  if (dom.resultCostDetail) {
    dom.resultCostDetail.textContent = '--';
  }
  if (dom.resultHpDetail) {
    dom.resultHpDetail.textContent = '--';
  }
  if (dom.resultGauge) {
    dom.resultGauge.textContent = '--';
  }
  if (dom.resultAwaken) {
    dom.resultAwaken.textContent = '--';
    dom.resultAwaken.classList.remove('awakening-possible', 'awakening-not-possible');
  }
  if (dom.resultHpBar) {
    dom.resultHpBar.style.width = '0%';
  }
  resetAwakeningBreakdown();
  applyInlineAwakeningState();
  if (dom.simResults) {
    dom.simResults.hidden = true;
  }
}

function getHistoryKey(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  if (entry.characterId !== null && entry.characterId !== undefined) {
    return `id:${entry.characterId}`;
  }
  if (entry.name) {
    return `name:${entry.name}`;
  }
  return `misc:${entry.role ?? ''}:${entry.timestamp ?? ''}`;
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const normalized = { ...entry };
  if (!normalized.timestamp) {
    normalized.timestamp = new Date().toISOString();
  }
  return normalized;
}

function normalizeHistoryCollection(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  const counts = new Map();
  const result = [];
  entries.forEach((entry) => {
    const normalized = normalizeHistoryEntry(entry);
    if (!normalized) {
      return;
    }
    const key = getHistoryKey(normalized);
    const count = counts.get(key) ?? 0;
    if (count >= HISTORY_DUPLICATE_LIMIT) {
      return;
    }
    counts.set(key, count + 1);
    result.push(normalized);
  });
  return result;
}

function performSimulation({
  persistHistory: persistHistoryOverride,
  showAlert = false,
  commitInputs = true
} = {}) {
  const selection = getSelectedCharacters();
  const hasCompleteSelection = Boolean(selection.player && selection.partner);
  const targetChar = resolveRedeployTarget(selection);

  let historyRole = 'player';
  let historyCharacter = selection.player || null;

  if (targetChar && selection.partner && targetChar.id === selection.partner.id) {
    historyRole = 'partner';
    historyCharacter = selection.partner;
  } else if (targetChar && selection.player && targetChar.id === selection.player.id) {
    historyRole = 'player';
    historyCharacter = selection.player;
  } else if (state.redeployTarget === 'partner') {
    historyRole = 'partner';
    historyCharacter = selection.partner || targetChar || null;
  } else if (!historyCharacter && targetChar) {
    historyCharacter = targetChar;
  }

  if (!targetChar) {
    if (showAlert) {
      alert('再出撃する機体を選択してください');
    }
    clearSimulationResults();
    return null;
  }

  const remainingCost = clamp(parseFloat(dom.remainingCost.value) || 0, 0, MAX_TEAM_COST);
  if (commitInputs) {
    dom.remainingCost.value = remainingCost.toFixed(1);
  }

  const allocatedCost = Math.min(remainingCost, targetChar.cost);
  const calculatedHp = Math.round(targetChar.hp * (allocatedCost / targetChar.cost));
  const preGaugeRaw = dom.preGauge.value;
  const parsedPreGauge = clamp(parseFloat(preGaugeRaw), 0, 100);
  const gaugeBefore = Number.isNaN(parsedPreGauge) ? 0 : parsedPreGauge;
  if (commitInputs && preGaugeRaw !== '') {
    dom.preGauge.value = String(gaugeBefore);
  }
  const damageRaw = dom.damageTaken.value;
  const parsedDamage = clamp(parseFloat(damageRaw), 0, targetChar.hp);
  const damageInput = Number.isNaN(parsedDamage) ? 0 : parsedDamage;
  if (commitInputs && damageRaw !== '') {
    dom.damageTaken.value = String(damageInput);
  }

  const damageRatio = targetChar.hp > 0 ? damageInput / targetChar.hp : 0;
  const gaugeFromDamage = Math.floor(damageRatio * 100 * AVERAGE_GAUGE_COEFFICIENT);
  const costKey = targetChar.cost.toFixed(1);
  const ownDownValue = dom.ownDown && dom.ownDown.checked ? (AWAKENING_BONUS_BY_COST[costKey] || 0) : 0;
  const damageBonusValue = dom.damageBonus && dom.damageBonus.checked
    ? (dom.bonusSelect ? parseInt(dom.bonusSelect.value, 10) || 0 : 0)
    : 0;
  const shieldBonusValue = dom.shieldBonus && dom.shieldBonus.checked
    ? (dom.shieldBonusSelect ? parseInt(dom.shieldBonusSelect.value, 10) || 0 : 0)
    : 0;
  const partnerBonusValue = dom.partnerDown && dom.partnerDown.checked
    ? (PARTNER_DOWN_AWAKENING_BONUS[costKey] || 0)
    : 0;

  const totalBonus =
    ownDownValue +
    damageBonusValue +
    shieldBonusValue +
    partnerBonusValue;

  const finalGauge = clamp(Math.floor(gaugeBefore + gaugeFromDamage + totalBonus), 0, 100);
  const isReadyToAwaken = finalGauge >= AWAKENING_THRESHOLD;
  const awakenText = isReadyToAwaken ? '覚醒可能' : '不可';

  const baseHpText = `${calculatedHp.toLocaleString()} HP`;
  const hpRatio = targetChar.hp > 0
    ? clamp(Math.round((calculatedHp / targetChar.hp) * 100), 0, 999)
    : 0;
  const hpDisplayText = `${baseHpText}(${hpRatio}%)`;
  const costConsumedText = `${allocatedCost.toFixed(1)} コスト`;

  dom.resultHp.textContent = hpDisplayText;
  dom.resultCost.textContent = costConsumedText;
  if (dom.resultHpDetail) {
    dom.resultHpDetail.textContent = hpDisplayText;
  }
  if (dom.resultCostDetail) {
    dom.resultCostDetail.textContent = costConsumedText;
  }
  if (dom.resultUnit) {
    dom.resultUnit.textContent = targetChar.name;
  }
  if (dom.resultBaseCost) {
    dom.resultBaseCost.textContent = `${targetChar.cost.toFixed(1)} コスト`;
  }
  if (dom.resultOriginalHp) {
    dom.resultOriginalHp.textContent = `${targetChar.hp.toLocaleString()} HP`;
  }
  if (dom.resultGauge) {
    dom.resultGauge.textContent = `${finalGauge}%`;
  }
  if (dom.resultAwaken) {
    dom.resultAwaken.textContent = awakenText;
    dom.resultAwaken.classList.remove('awakening-possible', 'awakening-not-possible');
    dom.resultAwaken.classList.add(isReadyToAwaken ? 'awakening-possible' : 'awakening-not-possible');
  }
  dom.resultHpBar.style.width = `${Math.min(100, hpRatio)}%`;
  dom.simResults.hidden = false;

  applyInlineAwakeningState({
    gaugeText: `${finalGauge}%`,
    statusText: awakenText,
    isReady: isReadyToAwaken,
    visible: true
  });

  updateAwakeningBreakdown({
    baseGauge: gaugeBefore,
    damageIncrease: gaugeFromDamage,
    damageTaken: damageInput,
    originalHp: targetChar.hp,
    ownDownValue,
    ownDownEnabled: Boolean(dom.ownDown && dom.ownDown.checked),
    damageBonusValue,
    damageBonusEnabled: Boolean(dom.damageBonus && dom.damageBonus.checked),
    shieldBonusValue,
    shieldBonusEnabled: Boolean(dom.shieldBonus && dom.shieldBonus.checked),
    partnerBonusValue,
    partnerBonusEnabled: Boolean(dom.partnerDown && dom.partnerDown.checked),
    total: finalGauge
  });

  const shouldPersistHistory =
    typeof persistHistoryOverride === 'boolean' ? persistHistoryOverride : commitInputs;

  if (shouldPersistHistory && hasCompleteSelection) {
    const historyEntry = {
      role: historyRole,
      characterId: historyCharacter?.id ?? targetChar?.id ?? null,
      name: historyCharacter?.name || targetChar.name,
      timestamp: new Date().toISOString(),
      hp: calculatedHp,
      cost: allocatedCost,
      playerId: selection.player?.id ?? null,
      playerName: selection.player?.name || null,
      partnerId: selection.partner?.id ?? null,
      partnerName: selection.partner?.name || null
    };
    state.history = normalizeHistoryCollection([historyEntry, ...state.history]).slice(0, HISTORY_LIMIT);
    persistHistory();
    renderHistory();
  }

  return {
    targetChar,
    remainingCost,
    allocatedCost,
    calculatedHp,
    gaugeBefore,
    damageInput,
    finalGauge,
    awakenText
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderHistory() {
  if (!dom.recentList) {
    return;
  }
  dom.recentList.innerHTML = '';
  if (!state.history.length) {
    const empty = document.createElement('p');
    empty.className = 'panel-subtitle';
    empty.textContent = 'まだ計算履歴がありません';
    dom.recentList.appendChild(empty);
  } else {
    state.history.forEach((entry) => {
      const playerInfo = resolveHistoryCharacterInfo(entry, 'player');
      const partnerInfo = resolveHistoryCharacterInfo(entry, 'partner');
      const item = document.createElement('div');
      item.className = 'quick-item quick-item--history';
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('title', 'この履歴を再適用');

      const label = document.createElement('div');
      label.className = 'quick-label history-label';

      const characterRow = document.createElement('div');
      characterRow.className = 'history-characters';
      characterRow.append(
        createHistoryCharacterBadge('自機', playerInfo, 'player', entry.role === 'player'),
        createHistoryCharacterBadge('相方', partnerInfo, 'partner', entry.role === 'partner')
      );
      label.appendChild(characterRow);

      const handleActivate = (event) => {
        if (event.type === 'keydown') {
          const key = event.key;
          if (key !== 'Enter' && key !== ' ') {
            return;
          }
          event.preventDefault();
        }
        applyHistoryEntry(entry);
      };

      item.append(label);
      item.addEventListener('click', handleActivate);
      item.addEventListener('keydown', handleActivate);
      dom.recentList.appendChild(item);
    });
  }

  if (state.cardScope === 'recent') {
    renderCards();
  }
  updateCardScopeNotice();
}

function resolveHistoryCharacterInfo(entry, role) {
  const resolvedId = resolveHistoryCharacterId(entry, role);
  const nameCandidates = [];
  const nameKey = role === 'partner' ? 'partnerName' : 'playerName';
  if (typeof entry[nameKey] === 'string' && entry[nameKey]) {
    nameCandidates.push(entry[nameKey]);
  }
  if (entry.role === role && typeof entry.name === 'string' && entry.name) {
    nameCandidates.push(entry.name);
  }

  let matched = null;
  if (typeof resolvedId === 'number') {
    matched = state.characters.find((char) => char.id === resolvedId) || null;
  }
  if (!matched) {
    for (const candidate of nameCandidates) {
      matched = state.characters.find((char) => char.name === candidate) || null;
      if (matched) {
        break;
      }
    }
  }

  const displayName = matched?.name || nameCandidates.find((name) => typeof name === 'string' && name) || '--';

  return {
    id: typeof resolvedId === 'number' ? resolvedId : undefined,
    name: displayName || '--',
    image: matched?.image || null
  };
}

function createHistoryCharacterBadge(label, info, roleKey, isActive = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'history-character';
  if (isActive) {
    wrapper.classList.add('history-character--active');
  }
  if (roleKey) {
    wrapper.dataset.role = roleKey;
  }
  const hasName = info.name && info.name !== '--';
  const baseTitle = hasName ? `${label}: ${info.name}` : label;
  const emphasisTitle = isActive ? `${baseTitle}（再出撃対象）` : baseTitle;
  wrapper.setAttribute('title', emphasisTitle);
  wrapper.setAttribute('aria-label', emphasisTitle);
  wrapper.setAttribute('aria-current', isActive ? 'true' : 'false');

  const thumb = document.createElement('div');
  thumb.className = 'history-character__thumb';
  if (info.image) {
    const img = document.createElement('img');
    img.src = info.image;
    img.alt = `${label}: ${info.name}`;
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'history-character__placeholder';
    const text = typeof info.name === 'string' && info.name !== '--' ? info.name.slice(0, 2) : '?';
    placeholder.textContent = text;
    thumb.appendChild(placeholder);
  }

  const textWrapper = document.createElement('div');
  textWrapper.className = 'history-character__text';

  const roleSpan = document.createElement('span');
  roleSpan.className = 'history-character__role';
  roleSpan.textContent = label;

  const nameSpan = document.createElement('span');
  nameSpan.className = 'history-character__name';
  nameSpan.textContent = info.name;

  textWrapper.append(roleSpan, nameSpan);

  if (isActive) {
    const resultTag = document.createElement('span');
    resultTag.className = 'history-character__result';
    resultTag.textContent = '再出撃対象';
    textWrapper.appendChild(resultTag);
  }

  wrapper.append(thumb, textWrapper);
  return wrapper;
}

function resolveHistoryCharacterId(entry, role) {
  if (!entry || typeof entry !== 'object') {
    return undefined;
  }
  const idKey = role === 'partner' ? 'partnerId' : 'playerId';
  if (Object.prototype.hasOwnProperty.call(entry, idKey)) {
    const storedId = entry[idKey];
    if (typeof storedId === 'number') {
      return storedId;
    }
    return null;
  }

  if (entry.role === role && typeof entry.characterId === 'number') {
    return entry.characterId;
  }

  const nameKey = role === 'partner' ? 'partnerName' : 'playerName';
  const fallbackNames = [];
  if (typeof entry[nameKey] === 'string' && entry[nameKey]) {
    fallbackNames.push(entry[nameKey]);
  }
  if (entry.role === role && typeof entry.name === 'string' && entry.name) {
    fallbackNames.push(entry.name);
  }

  for (const candidate of fallbackNames) {
    const matched = state.characters.find((char) => char.name === candidate);
    if (matched) {
      return matched.id;
    }
  }

  return undefined;
}

function applyHistoryEntry(entry) {
  if (!entry) {
    return;
  }

  const playerId = resolveHistoryCharacterId(entry, 'player');
  const partnerId = resolveHistoryCharacterId(entry, 'partner');

  const nextSelection = {
    playerId: typeof playerId === 'undefined' ? state.selected.playerId : playerId,
    partnerId: typeof partnerId === 'undefined' ? state.selected.partnerId : partnerId
  };

  state.selected.playerId = nextSelection.playerId;
  state.selected.partnerId = nextSelection.partnerId;

  pickerTypes.forEach((type) => {
    resetPickerSearch(type);
    updatePickerDisplay(type);
    closePicker(type);
  });

  const desiredRedeployTarget = entry.role === 'partner' ? 'partner' : 'player';
  setRedeployTarget(desiredRedeployTarget);

  renderCards();
  updateSelectedSummaries({ persistHistory: false });

  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    window.location.hash = '#sim';
  }
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  } catch (error) {
    console.warn('Failed to save history', error);
  }
}

function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      state.history = normalizeHistoryCollection(parsed).slice(0, HISTORY_LIMIT);
    }
  } catch (error) {
    console.warn('Failed to load history', error);
  }
}

function setupHistoryControls() {
  if (dom.clearHistory) {
    dom.clearHistory.addEventListener('click', () => {
      state.history = [];
      persistHistory();
      renderHistory();
      if (state.cardScope === 'recent') {
        applyCardScope('all');
      }
    });
  }

  if (dom.resetCardScope) {
    dom.resetCardScope.addEventListener('click', () => {
      applyCardScope('all');
    });
  }
}

function setupFilters() {
  dom.cardSearch.addEventListener('input', () => {
    state.search = dom.cardSearch.value.trim();
    renderCards();
  });

  dom.costFilters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-cost]');
    if (!button) return;
    const { cost } = button.dataset;
    state.costFilter = cost === 'all' ? 'all' : Number(cost).toFixed(1);
    dom.costFilters.querySelectorAll('button[data-cost]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip === button));
    });
    renderCards();
  });

  dom.sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.sort = button.dataset.sort;
      dom.sortButtons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn === button)));
      renderCards();
    });
  });
  if (dom.sortButtons.length) {
    dom.sortButtons[0].setAttribute('aria-pressed', 'true');
  }
}

function createCharacterCardElement(char, { selectedRoles = [] } = {}) {
  const card = document.createElement('div');
  card.className = 'character-card';
  card.setAttribute('data-id', String(char.id));
  card.dataset.originalHp = String(char.hp);

  const avatarContent = char.image
    ? `<img src="${char.image}" alt="${char.name}のアイコン" loading="lazy">`
    : `<span class="avatar-fallback" aria-hidden="true">${char.name.charAt(0)}</span>`;

  const durabilityCellsHtml = char.durabilityOptions
    .map((item, index) => `
        <div class="durability-cell${index === 0 ? ' is-active' : ''}" data-remaining="${item.remaining}" data-hp="${item.hp}" data-ratio="${item.ratio}" tabindex="0" role="button" aria-pressed="${index === 0}">
          <span class="durability-label">${item.remaining.toFixed(1)} コスト</span>
          <span class="durability-value">${item.hp.toLocaleString()} HP</span>
        </div>
      `)
    .join('');

  card.innerHTML = `
      <div class="card-header">
        <span class="avatar">${avatarContent}</span>
        <div class="card-meta">
          <span class="card-name">${char.name}</span>
          <span class="cost-badge">${char.cost.toFixed(1)} COST</span>
        </div>
      </div>
      <div class="metric-row">
        <span class="metric-label">残コスト --</span>
        <strong class="metric-value">-- HP</strong>
      </div>
      <div class="hp-bar" role="presentation"><span style="width:0%"></span></div>
      <div class="hp-info">
        <span class="hp-current">-- HP</span>
        <span class="hp-ratio-text">--</span>
      </div>
      <div class="durability-table">
        ${durabilityCellsHtml}
      </div>
    `;

  if (selectedRoles.length) {
    card.classList.add('is-selected');
    const badge = document.createElement('span');
    badge.className = 'character-card-selection-badge';
    badge.textContent = selectedRoles.join(' / ');
    card.appendChild(badge);
  }

  setupCardHpInteractions(card, char);

  return card;
}

function collectRecentCharacterIdentifiers(historyEntries) {
  const ids = new Set();
  const names = new Set();

  if (!Array.isArray(historyEntries)) {
    return { ids, names };
  }

  historyEntries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const { characterId, playerId, partnerId, name, playerName, partnerName } = entry;

    [characterId, playerId, partnerId].forEach((value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        ids.add(value);
      }
    });

    [name, playerName, partnerName].forEach((value) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          names.add(trimmed);
        }
      }
    });
  });

  return { ids, names };
}

function renderCards() {
  if (!dom.cardGrid) {
    return;
  }
  dom.cardGrid.innerHTML = '';
  const query = state.search.toLowerCase();
  const hiraQuery = toHiragana(query);
  const isRecentScope = state.cardScope === 'recent';
  const { ids: recentIds, names: recentNames } = isRecentScope
    ? collectRecentCharacterIdentifiers(state.history)
    : { ids: null, names: null };

  if (
    isRecentScope &&
    recentIds &&
    recentNames &&
    recentIds.size === 0 &&
    recentNames.size === 0
  ) {
    const emptyRecent = document.createElement('p');
    emptyRecent.className = 'panel-subtitle';
    emptyRecent.textContent = '最近の計算履歴がまだありません';
    dom.cardGrid.appendChild(emptyRecent);
    return;
  }

  const filtered = state.characters.filter((char) => {
    if (
      isRecentScope &&
      recentIds &&
      recentNames &&
      !recentIds.has(char.id) &&
      !recentNames.has(char.name)
    ) {
      return false;
    }
    if (state.costFilter !== 'all' && char.costKey !== state.costFilter) {
      return false;
    }
    if (!query) return true;
    const nameLower = char.name.toLowerCase();
    return (
      nameLower.includes(query) ||
      char.hira.includes(hiraQuery) ||
      char.kata.toLowerCase().includes(query)
    );
  });

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'panel-subtitle';
    empty.textContent = isRecentScope
      ? '最近の計算に使ったキャラで該当するものがありません'
      : '該当するキャラクターが見つかりません';
    dom.cardGrid.appendChild(empty);
    return;
  }

  const sorted = filtered.sort((a, b) => sortCharacters(a, b, state.sort));
  sorted.forEach((char) => {
    const selectedRoles = [];
    if (state.selected.playerId === char.id) {
      selectedRoles.push('自機');
    }
    if (state.selected.partnerId === char.id) {
      selectedRoles.push('相方');
    }
    const card = createCharacterCardElement(char, { selectedRoles });
    dom.cardGrid.appendChild(card);
  });

}

function setupCardHpInteractions(card, char) {
  const hpBarFill = card.querySelector('.hp-bar span');
  const metricLabel = card.querySelector('.metric-label');
  const metricValue = card.querySelector('.metric-value');
  const hpCurrent = card.querySelector('.hp-current');
  const ratioText = card.querySelector('.hp-ratio-text');
  const durabilityCells = Array.from(card.querySelectorAll('.durability-cell'));

  if (!hpBarFill || !metricLabel || !metricValue || !hpCurrent || !ratioText || !durabilityCells.length) {
    return;
  }

  const originalHp = Number(char.hp) || 0;
  const originalHpDisplay = originalHp ? originalHp.toLocaleString() : '0';
  let currentHpValue = originalHp;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const allowAnimation = !prefersReducedMotion;

  const clampPercent = (value) => Math.max(0, Math.min(100, value));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const createNumberAnimator = () => {
    let animationFrameId = null;
    return (start, end, onUpdate, duration = 420) => {
      if (!allowAnimation) {
        onUpdate(Number.isFinite(end) ? end : 0, true);
        return;
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      const resolvedStart = Number.isFinite(start) ? start : 0;
      const resolvedEnd = Number.isFinite(end) ? end : 0;
      const startTime = performance.now();

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = easeOutCubic(progress);
        const value = Math.round(resolvedStart + (resolvedEnd - resolvedStart) * eased);
        onUpdate(value, progress === 1);
        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        }
      };

      animationFrameId = requestAnimationFrame(step);
    };
  };

  const animateHpNumber = createNumberAnimator();
  const animateMetricNumber = createNumberAnimator();
  const animateRatioNumber = createNumberAnimator();

  const animateBar = (targetPercent) => {
    if (!allowAnimation) {
      hpBarFill.style.width = `${clampPercent(targetPercent)}%`;
      return;
    }
    const currentPercent = parseFloat(hpBarFill.style.width) || 0;
    const clampedTarget = clampPercent(targetPercent);
    if (!hpBarFill.animate) {
      hpBarFill.style.width = `${clampedTarget}%`;
      return;
    }
    const animation = hpBarFill.animate(
      [
        { width: `${clampPercent(currentPercent)}%` },
        { width: `${clampedTarget}%` }
      ],
      { duration: 420, easing: 'cubic-bezier(0.22, 0.68, 0, 1)' }
    );
    animation.addEventListener('finish', () => {
      hpBarFill.style.width = `${clampedTarget}%`;
    });
  };

  const updateNumberDisplays = (hpValue) => {
    const percent = originalHp > 0 ? clampPercent(Math.round((hpValue / originalHp) * 100)) : 0;
    const hpText = `${hpValue.toLocaleString()} HP`;
    hpCurrent.textContent = hpText;
    metricValue.textContent = `${hpValue.toLocaleString()} HP (${percent}%)`;
    ratioText.textContent = `${hpValue.toLocaleString()} / ${originalHpDisplay} (${percent}%)`;
  };

  const updateFromCell = (cell, { animate = true } = {}) => {
    const hp = Number(cell.dataset.hp) || 0;
    const ratio = Number(cell.dataset.ratio);
    const remaining = Number(cell.dataset.remaining);

    durabilityCells.forEach((otherCell) => {
      const isActive = otherCell === cell;
      otherCell.classList.toggle('is-active', isActive);
      otherCell.setAttribute('aria-pressed', String(isActive));
    });

    const ratioValue = Number.isFinite(ratio) ? ratio : originalHp > 0 ? hp / originalHp : 0;
    const clampedRatio = Math.max(0, Math.min(1, ratioValue));
    const percent = Math.round(clampedRatio * 100);
    const remainingLabel = Number.isFinite(remaining) ? remaining.toFixed(1) : '--';

    metricLabel.textContent = `残コスト ${remainingLabel}`;
    if (!animate || !allowAnimation) {
      hpBarFill.style.width = `${percent}%`;
      updateNumberDisplays(hp);
      currentHpValue = hp;
      return;
    }

    animateBar(percent);

    animateHpNumber(currentHpValue, hp, (value, done) => {
      const finalValue = done ? hp : value;
      hpCurrent.textContent = `${finalValue.toLocaleString()} HP`;
    });

    animateMetricNumber(currentHpValue, hp, (value, done) => {
      const finalValue = done ? hp : value;
      const percentValue = originalHp > 0 ? clampPercent(Math.round((finalValue / originalHp) * 100)) : 0;
      metricValue.textContent = `${finalValue.toLocaleString()} HP (${percentValue}%)`;
    });

    animateRatioNumber(currentHpValue, hp, (value, done) => {
      const finalValue = done ? hp : value;
      const percentValue = originalHp > 0 ? clampPercent(Math.round((finalValue / originalHp) * 100)) : 0;
      ratioText.textContent = `${finalValue.toLocaleString()} / ${originalHpDisplay} (${percentValue}%)`;
    });

    currentHpValue = hp;
  };

  durabilityCells.forEach((cell) => {
    cell.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      updateFromCell(cell);
    });

    cell.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        updateFromCell(cell);
      }
    });
  });

  const initialCell = durabilityCells.find((cellElement) => cellElement.classList.contains('is-active')) || durabilityCells[0];
  if (initialCell) {
    updateFromCell(initialCell, { animate: false });
  }
}

function sortCharacters(a, b, sortKey) {
  switch (sortKey) {
    case 'hp-asc':
      return a.hp - b.hp || a.name.localeCompare(b.name, 'ja');
    case 'hp-desc':
      return b.hp - a.hp || a.name.localeCompare(b.name, 'ja');
    case 'cost-asc':
      return a.cost - b.cost || a.name.localeCompare(b.name, 'ja');
    case 'cost-desc':
      return b.cost - a.cost || a.name.localeCompare(b.name, 'ja');
    default:
      return b.hp - a.hp || a.name.localeCompare(b.name, 'ja');
  }
}

function init() {
  if (!appRoot) {
    return;
  }
  initializeCharacters();
  initializePickerRefs();
  initializePickers();
  setupRouting();
  setupCollapse();
  setupRedeployChips();
  setupBonusToggle();
  setupSimulationAutoUpdate();
  setupFilters();
  setupHistoryControls();
  loadHistory();
  renderHistory();
  renderCards();
  updateSelectedSummaries();
}

init();

export {
  createCharacterAvatar,
  createScenarioListItem,
  hasNativeLazyLoadingSupport,
  isIosSafari,
  isIosChromium,
  calculateRemainingTeamCost,
  collectRecentCharacterIdentifiers
};
