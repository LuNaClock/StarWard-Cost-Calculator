const STORAGE_KEY = 'starward-preferred-view';
const MOBILE_BREAKPOINT_QUERY = '(max-width: 900px)';
const body = document.body;
const desktopContainer = document.querySelector('.desktop-app');
const mobileContainer = document.querySelector('.mobile-app');
const toggleButtons = document.querySelectorAll('[data-view-mode]');
const floatingSwitcher = document.querySelector('.view-switcher--floating');
const settingsSwitcher = document.querySelector('.view-switcher--settings');
const mobileBreakpoint = window.matchMedia
  ? window.matchMedia(MOBILE_BREAKPOINT_QUERY)
  : null;

function isMobileViewport() {
  if (mobileBreakpoint) {
    return mobileBreakpoint.matches;
  }

  return window.innerWidth <= 900;
}

function getStoredPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return null;
  }
}

function setStoredPreference(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch (error) {
    // noop - storage may be unavailable
  }
}

function applyViewMode(mode, { skipSave = false } = {}) {
  const normalized = mode === 'mobile' || mode === 'desktop' ? mode : 'auto';

  if (body) {
    body.dataset.viewMode = normalized;
  }

  const useMobileLayout =
    normalized === 'mobile' || (normalized === 'auto' && isMobileViewport());
  const useDesktopLayout =
    normalized === 'desktop' || (normalized === 'auto' && !isMobileViewport());

  if (mobileContainer) {
    mobileContainer.toggleAttribute('hidden', !useMobileLayout);
    mobileContainer.setAttribute('aria-hidden', String(!useMobileLayout));
  }

  if (desktopContainer) {
    desktopContainer.toggleAttribute('hidden', !useDesktopLayout);
    desktopContainer.setAttribute('aria-hidden', String(!useDesktopLayout));
  }

  const activeVisualMode = useMobileLayout ? 'mobile' : 'desktop';

  toggleButtons.forEach((button) => {
    const isActive = button.dataset.viewMode === activeVisualMode;
    button.setAttribute('aria-pressed', String(isActive));
  });

  if (floatingSwitcher) {
    const shouldHideFloating = useMobileLayout;
    floatingSwitcher.toggleAttribute('hidden', shouldHideFloating);
    floatingSwitcher.setAttribute('aria-hidden', String(shouldHideFloating));
  }

  if (settingsSwitcher) {
    const shouldShowSettings = useMobileLayout;
    settingsSwitcher.toggleAttribute('hidden', !shouldShowSettings);
    settingsSwitcher.setAttribute('aria-hidden', String(!shouldShowSettings));
  }

  if (!skipSave && normalized !== 'auto') {
    setStoredPreference(normalized);
  }

  return activeVisualMode;
}

function resolveInitialMode() {
  const stored = getStoredPreference();
  if (stored === 'mobile' || stored === 'desktop') {
    return stored;
  }

  return 'auto';
}

const initialMode = resolveInitialMode();
applyViewMode(initialMode, { skipSave: true });

if (mobileBreakpoint) {
  mobileBreakpoint.addEventListener('change', () => {
    if (body?.dataset.viewMode === 'auto') {
      applyViewMode('auto', { skipSave: true });
    }
  });
}

toggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetMode = button.dataset.viewMode;
    applyViewMode(targetMode);
  });
});
