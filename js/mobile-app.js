import {
  rawCharacterData,
  kanjiNameReadings,
  costRemainingMap,
  MAX_TEAM_COST,
  AVERAGE_GAUGE_COEFFICIENT,
  AWAKENING_THRESHOLD,
  AWAKENING_BONUS_BY_COST,
  PARTNER_DOWN_AWAKENING_BONUS
} from '../data.js';
import { toHiragana } from './utils.js';

const HISTORY_KEY = 'starward-mobile-history-v1';
const appRoot = document.querySelector('.mobile-app');

const state = {
  characters: [],
  search: '',
  costFilter: 'all',
  sort: 'hp-desc',
  redeployTarget: 'player',
  history: []
};

const dom = {
  screens: Array.from(document.querySelectorAll('.screen')),
  tabs: Array.from(document.querySelectorAll('.tab-button')),
  heroButtons: document.querySelectorAll('[data-nav-target]'),
  collapseToggles: document.querySelectorAll('.section-toggle'),
  playerSelect: document.getElementById('playerSelect'),
  partnerSelect: document.getElementById('partnerSelect'),
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
  partnerDown: document.getElementById('partnerDown'),
  runSimulation: document.getElementById('runSimulation'),
  simResults: document.getElementById('simResults'),
  resultHp: document.querySelector('[data-bind="result-hp"]'),
  resultCost: document.querySelector('[data-bind="result-cost"]'),
  resultGauge: document.querySelector('[data-bind="result-gauge"]'),
  resultAwaken: document.querySelector('[data-bind="result-awaken"]'),
  resultHpBar: document.querySelector('[data-bind="result-hp-bar"]'),
  recentList: document.getElementById('recentList'),
  clearHistory: document.querySelector('[data-action="clear-history"]'),
  cardSearch: document.getElementById('cardSearch'),
  costFilters: document.getElementById('costFilters'),
  sortButtons: document.querySelectorAll('.sort-select'),
  cardGrid: document.getElementById('cardGrid'),
  cardSheet: document.getElementById('cardSheet'),
  cardSheetTitle: document.getElementById('cardSheetTitle'),
  sheetRemaining: document.querySelector('[data-bind="sheet-remaining"]'),
  sheetHp: document.querySelector('[data-bind="sheet-hp"]'),
  sheetDescription: document.querySelector('[data-bind="sheet-description"]'),
  sheetTable: document.getElementById('sheetTable')
};

function initializeCharacters() {
  state.characters = rawCharacterData.map((char, index) => {
    const key = Number(char.cost).toFixed(1);
    const readings = kanjiNameReadings[char.name] || {};
    const hira = readings.hiragana || toHiragana(char.name);
    const kata = readings.katakana || toHiragana(char.name).replace(/[\u3041-\u3096]/g, (m) => String.fromCharCode(m.charCodeAt(0) + 0x60));
    const durabilityOptions = buildDurabilityTable(char);
    return {
      ...char,
      id: index,
      costKey: key,
      hira: hira,
      kata: kata,
      durabilityOptions
    };
  });
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

function hydrateSelectOptions() {
  const fragment = document.createDocumentFragment();
  const partnerFragment = document.createDocumentFragment();
  state.characters
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    .forEach((char) => {
      const option = document.createElement('option');
      option.value = String(char.id);
      option.textContent = `${char.name} (HP ${char.hp})`;
      fragment.appendChild(option);
      partnerFragment.appendChild(option.cloneNode(true));
    });
  dom.playerSelect.appendChild(fragment);
  dom.partnerSelect.appendChild(partnerFragment);
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
      if (target) {
        window.location.hash = target;
      }
    });
  });

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
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

function updateSelectedSummaries() {
  const player = getSelectedCharacter(dom.playerSelect.value);
  const partner = getSelectedCharacter(dom.partnerSelect.value);
  dom.playerCost.textContent = player ? player.cost.toFixed(1) : '--';
  dom.playerHp.textContent = player ? player.hp.toLocaleString() : '--';
  dom.partnerCost.textContent = partner ? partner.cost.toFixed(1) : '--';
  dom.partnerHp.textContent = partner ? partner.hp.toLocaleString() : '--';
  const total = (player?.cost || 0) + (partner?.cost || 0);
  dom.teamTotal.textContent = total.toFixed(1);

  const activeTarget = state.redeployTarget;
  const targetChar = activeTarget === 'player' ? player : partner;
  dom.damageTaken.max = targetChar ? String(targetChar.hp) : '';
}

function getSelectedCharacter(value) {
  if (!value) return null;
  const id = Number(value);
  if (Number.isNaN(id)) return null;
  return state.characters.find((char) => char.id === id) || null;
}

function setupSelects() {
  dom.playerSelect.addEventListener('change', () => {
    updateSelectedSummaries();
  });
  dom.partnerSelect.addEventListener('change', () => {
    updateSelectedSummaries();
  });

  dom.redeployChips.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    dom.redeployChips.querySelectorAll('button[data-value]').forEach((chip) => {
      const isActive = chip === button;
      chip.setAttribute('aria-pressed', String(isActive));
      if (isActive) {
        state.redeployTarget = chip.dataset.value;
      }
    });
    updateSelectedSummaries();
  });
}

function setupBonusToggle() {
  const toggleField = () => {
    dom.bonusSelectField.toggleAttribute('hidden', !dom.damageBonus.checked);
  };
  dom.damageBonus.addEventListener('change', toggleField);
  toggleField();
}

function runSimulation() {
  const player = getSelectedCharacter(dom.playerSelect.value);
  const partner = getSelectedCharacter(dom.partnerSelect.value);
  const targetChar = state.redeployTarget === 'partner' ? partner : player;

  if (!targetChar) {
    alert('再出撃する機体を選択してください');
    return;
  }

  const remainingCost = clamp(parseFloat(dom.remainingCost.value) || 0, 0, MAX_TEAM_COST);
  dom.remainingCost.value = remainingCost.toFixed(1);

  const allocatedCost = Math.min(remainingCost, targetChar.cost);
  const calculatedHp = Math.round(targetChar.hp * (allocatedCost / targetChar.cost));
  const gaugeBefore = clamp(parseFloat(dom.preGauge.value) || 0, 0, 100);
  dom.preGauge.value = String(gaugeBefore);
  const damageInput = clamp(parseFloat(dom.damageTaken.value) || 0, 0, targetChar.hp);
  dom.damageTaken.value = String(damageInput);

  const damageRatio = targetChar.hp > 0 ? damageInput / targetChar.hp : 0;
  const gaugeFromDamage = Math.floor(damageRatio * 100 * AVERAGE_GAUGE_COEFFICIENT);
  const costKey = targetChar.cost.toFixed(1);
  let bonus = 0;
  if (dom.ownDown.checked) {
    bonus += AWAKENING_BONUS_BY_COST[costKey] || 0;
  }
  if (dom.damageBonus.checked) {
    bonus += parseInt(dom.bonusSelect.value, 10) || 0;
  }
  if (dom.partnerDown.checked) {
    bonus += PARTNER_DOWN_AWAKENING_BONUS[costKey] || 0;
  }

  const finalGauge = clamp(Math.floor(gaugeBefore + gaugeFromDamage + bonus), 0, 100);
  const awakenText = finalGauge >= AWAKENING_THRESHOLD ? '覚醒可能' : '不可';

  dom.resultHp.textContent = `${calculatedHp.toLocaleString()} HP`;
  dom.resultCost.textContent = `${allocatedCost.toFixed(1)} コスト`;
  dom.resultGauge.textContent = `${finalGauge}%`;
  dom.resultAwaken.textContent = awakenText;
  dom.resultHpBar.style.width = `${Math.min(100, Math.round((calculatedHp / targetChar.hp) * 100))}%`;
  dom.simResults.hidden = false;

  const historyEntry = {
    name: targetChar.name,
    timestamp: new Date().toISOString(),
    hp: calculatedHp,
    cost: allocatedCost,
    gauge: finalGauge,
    awaken: awakenText
  };
  state.history.unshift(historyEntry);
  state.history = state.history.slice(0, 5);
  persistHistory();
  renderHistory();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderHistory() {
  dom.recentList.innerHTML = '';
  if (!state.history.length) {
    const empty = document.createElement('p');
    empty.className = 'panel-subtitle';
    empty.textContent = 'まだ計算履歴がありません';
    dom.recentList.appendChild(empty);
    return;
  }

  state.history.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'quick-item';
    item.innerHTML = `
      <div class="quick-label">
        <span>${entry.name}</span>
        <span>${formatDate(entry.timestamp)} / 覚醒 ${entry.gauge}%</span>
      </div>
      <span class="quick-value">${entry.hp.toLocaleString()} HP</span>
    `;
    dom.recentList.appendChild(item);
  });
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
      state.history = parsed;
    }
  } catch (error) {
    console.warn('Failed to load history', error);
  }
}

function setupHistoryControls() {
  dom.clearHistory.addEventListener('click', () => {
    state.history = [];
    persistHistory();
    renderHistory();
  });
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

function renderCards() {
  dom.cardGrid.innerHTML = '';
  const query = state.search.toLowerCase();
  const hiraQuery = toHiragana(query);
  const filtered = state.characters.filter((char) => {
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

  const sorted = filtered.sort((a, b) => sortCharacters(a, b, state.sort));
  sorted.forEach((char) => {
    const featured = char.durabilityOptions[0];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'character-card';
    card.setAttribute('data-id', String(char.id));
    card.innerHTML = `
      <div class="card-header">
        <span class="avatar"><img src="${char.image}" alt="${char.name}のアイコン" loading="lazy"></span>
        <div class="card-meta">
          <span class="card-name">${char.name}</span>
          <span class="cost-badge">${char.cost.toFixed(1)} COST</span>
        </div>
      </div>
      <div class="metric-row">
        <span>残コスト ${featured.remaining.toFixed(1)}</span>
        <strong>${featured.hp.toLocaleString()} HP</strong>
      </div>
      <div class="hp-bar"><span style="width:${Math.round(featured.ratio * 100)}%"></span></div>
      <div class="durability-table">
        ${char.durabilityOptions
          .map((item) => `
            <div class="durability-cell">
              <span class="durability-label">${item.remaining.toFixed(1)} コスト</span>
              <span class="durability-value">${item.hp.toLocaleString()} HP</span>
            </div>
          `)
          .join('')}
      </div>
    `;
    card.addEventListener('click', () => openCardSheet(char));
    dom.cardGrid.appendChild(card);
  });

  if (!sorted.length) {
    const empty = document.createElement('p');
    empty.className = 'panel-subtitle';
    empty.textContent = '該当するキャラクターが見つかりません';
    dom.cardGrid.appendChild(empty);
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

function openCardSheet(char) {
  dom.cardSheetTitle.textContent = char.name;
  dom.sheetRemaining.textContent = `${char.cost.toFixed(1)} COST`;
  dom.sheetHp.textContent = `${char.hp.toLocaleString()} HP`;
  dom.sheetDescription.textContent = '残コストごとの再出撃耐久を確認できます';
  dom.sheetTable.innerHTML = '';

  char.durabilityOptions.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'sheet-row';
    row.innerHTML = `
      <span>${item.remaining.toFixed(1)} コスト使用</span>
      <span>${item.hp.toLocaleString()} HP (${Math.round(item.ratio * 100)}%)</span>
    `;
    dom.sheetTable.appendChild(row);
  });

  dom.cardSheet.removeAttribute('hidden');
  dom.cardSheet.dataset.open = 'true';
}

function closeCardSheet() {
  dom.cardSheet.dataset.open = 'false';
  dom.cardSheet.setAttribute('hidden', '');
}

function setupSheet() {
  dom.cardSheet.addEventListener('click', (event) => {
    if (event.target.closest('.sheet-close')) {
      closeCardSheet();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dom.cardSheet.dataset.open === 'true') {
      closeCardSheet();
    }
  });
}

function setupSettings() {
  const themeSelect = document.getElementById('themeSelect');
  if (!themeSelect || !appRoot) {
    return;
  }
  const systemPreference = window.matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = () => {
    const theme = themeSelect.value;
    const resolvedTheme = theme === 'system' ? (systemPreference.matches ? 'dark' : 'light') : theme;
    appRoot.dataset.theme = resolvedTheme;
  };
  themeSelect.addEventListener('change', applyTheme);
  if (typeof systemPreference.addEventListener === 'function') {
    systemPreference.addEventListener('change', applyTheme);
  } else if (typeof systemPreference.addListener === 'function') {
    systemPreference.addListener(applyTheme);
  }
  applyTheme();
}

function init() {
  if (!appRoot) {
    return;
  }
  initializeCharacters();
  hydrateSelectOptions();
  setupRouting();
  setupCollapse();
  setupSelects();
  setupBonusToggle();
  setupFilters();
  setupSheet();
  setupSettings();
  setupHistoryControls();
  loadHistory();
  renderHistory();
  renderCards();
  updateSelectedSummaries();

  dom.runSimulation.addEventListener('click', runSimulation);
}

init();
