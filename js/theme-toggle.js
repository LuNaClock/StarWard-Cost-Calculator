const THEME_STORAGE_KEY = 'starward-desktop-theme';
const body = document.body;
const themeButtons = document.querySelectorAll('[data-theme-option]');

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    return null;
  }
}

function setStoredTheme(value) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch (error) {
    // noop - storage may be unavailable
  }
}

function resolveSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme, { skipSave = false } = {}) {
  if (!body) {
    return;
  }

  const normalized = theme === 'dark' ? 'dark' : 'light';
  body.dataset.theme = normalized;

  themeButtons.forEach((button) => {
    const isActive = button.dataset.themeOption === normalized;
    button.setAttribute('aria-pressed', String(isActive));
  });

  if (!skipSave) {
    setStoredTheme(normalized);
  }
}

const storedTheme = getStoredTheme();
const systemPreference = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

if (storedTheme === 'light' || storedTheme === 'dark') {
  applyTheme(storedTheme, { skipSave: true });
} else {
  applyTheme(resolveSystemTheme(), { skipSave: true });
}

if (systemPreference && typeof systemPreference.addEventListener === 'function' && !(storedTheme === 'light' || storedTheme === 'dark')) {
  systemPreference.addEventListener('change', (event) => {
    applyTheme(event.matches ? 'dark' : 'light', { skipSave: true });
  });
}

if (systemPreference && typeof systemPreference.addListener === 'function' && !(storedTheme === 'light' || storedTheme === 'dark')) {
  systemPreference.addListener((event) => {
    applyTheme(event.matches ? 'dark' : 'light', { skipSave: true });
  });
}

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyTheme(button.dataset.themeOption);
  });
});
