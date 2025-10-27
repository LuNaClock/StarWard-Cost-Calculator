import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const THEME_STORAGE_KEY = 'starward-desktop-theme';
const THEME_MODULE_PATH = '../js/theme-toggle.js';

function setupDom() {
  document.body.innerHTML = `
    <div class="theme-toggle" role="group">
      <button type="button" class="theme-toggle__button" data-theme-option="light" aria-pressed="false">ライト</button>
      <button type="button" class="theme-toggle__button" data-theme-option="dark" aria-pressed="false">ダーク</button>
    </div>
  `;
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.body.dataset.theme = '';
  setupDom();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createMatchMediaMock({ matches = false, onChange = () => {} } = {}) {
  return {
    matches,
    addEventListener: vi.fn((eventName, handler) => {
      if (eventName === 'change') {
        onChange(handler);
      }
    }),
    addListener: vi.fn((handler) => {
      onChange(handler);
    }),
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

describe('デスクトップテーマ切り替え', () => {
  it('保存済みテーマを初期表示に反映する', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    const mock = createMatchMediaMock();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue(mock),
    });

    await import(THEME_MODULE_PATH);

    const [lightButton, darkButton] = document.querySelectorAll('[data-theme-option]');

    expect(document.body.dataset.theme).toBe('dark');
    expect(lightButton.getAttribute('aria-pressed')).toBe('false');
    expect(darkButton.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(mock.addEventListener).not.toHaveBeenCalled();
    expect(mock.addListener).not.toHaveBeenCalled();
  });

  it('ボタン操作でテーマと保存内容を更新する', async () => {
    const mock = createMatchMediaMock();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue(mock),
    });

    await import(THEME_MODULE_PATH);

    const lightButton = document.querySelector('[data-theme-option="light"]');
    const darkButton = document.querySelector('[data-theme-option="dark"]');

    expect(document.body.dataset.theme).toBe('dark');

    lightButton.click();

    expect(document.body.dataset.theme).toBe('light');
    expect(lightButton.getAttribute('aria-pressed')).toBe('true');
    expect(darkButton.getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    darkButton.click();

    expect(document.body.dataset.theme).toBe('dark');
    expect(lightButton.getAttribute('aria-pressed')).toBe('false');
    expect(darkButton.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('システムテーマの変更イベントに追従する', async () => {
    let storedHandler;
    const mock = createMatchMediaMock({
      matches: true,
      onChange: (handler) => {
        storedHandler = handler;
      },
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue(mock),
    });

    await import(THEME_MODULE_PATH);

    expect(document.body.dataset.theme).toBe('dark');

    storedHandler?.({ matches: false });

    expect(document.body.dataset.theme).toBe('light');
  });
});
