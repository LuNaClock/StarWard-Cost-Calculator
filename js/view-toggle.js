const STORAGE_KEY = 'starward-preferred-view';
const body = document.body;
const desktopContainer = document.querySelector('.desktop-app');
const mobileContainer = document.querySelector('.mobile-app');
const toggleButtons = document.querySelectorAll('[data-view-mode]');

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
  const normalized = mode === 'mobile' ? 'mobile' : 'desktop';

  if (body) {
    body.dataset.viewMode = normalized;
  }

  const showMobile = normalized === 'mobile';
  const showDesktop = !showMobile;

  if (mobileContainer) {
    mobileContainer.toggleAttribute('hidden', !showMobile);
    mobileContainer.setAttribute('aria-hidden', String(!showMobile));
  }

  if (desktopContainer) {
    desktopContainer.toggleAttribute('hidden', !showDesktop);
    desktopContainer.setAttribute('aria-hidden', String(!showDesktop));
  }

  toggleButtons.forEach((button) => {
    const isActive = button.dataset.viewMode === normalized;
    button.setAttribute('aria-pressed', String(isActive));
  });

  if (!skipSave) {
    setStoredPreference(normalized);
  }
}

function resolveInitialMode() {
  const stored = getStoredPreference();
  if (stored === 'mobile' || stored === 'desktop') {
    return stored;
  }

  if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
    return 'mobile';
  }

  return 'desktop';
}

const initialMode = resolveInitialMode();
applyViewMode(initialMode, { skipSave: true });

toggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetMode = button.dataset.viewMode;
    applyViewMode(targetMode);
  });
});
