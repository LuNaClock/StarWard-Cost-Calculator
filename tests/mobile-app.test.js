import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const DEFAULT_USER_AGENT = navigator.userAgent;
const IOS_CHROMIUM_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.0.0 Mobile/15E148 Safari/604.1';
const IOS_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function setUserAgent(ua) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true
  });
}

describe('createCharacterAvatar', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    setUserAgent(DEFAULT_USER_AGENT);
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('forces eager loading on small avatars for iOS Chromium browsers when native lazy loading is unavailable', async () => {
    setUserAgent(IOS_CHROMIUM_UA);
    const module = await import('../js/mobile-app.js');
    vi.spyOn(module, 'hasNativeLazyLoadingSupport').mockReturnValue(false);

    const avatar = module.createCharacterAvatar({ name: 'アキ', image: 'https://example.com/a.png' }, 'small');
    const img = avatar.querySelector('img');

    expect(img.getAttribute('loading')).toBe('eager');
  });

  it('avoids setting the loading attribute on iOS Safari when native lazy loading is unavailable', async () => {
    setUserAgent(IOS_SAFARI_UA);
    const module = await import('../js/mobile-app.js');
    vi.spyOn(module, 'hasNativeLazyLoadingSupport').mockReturnValue(false);

    const avatar = module.createCharacterAvatar({ name: 'ユナ', image: 'https://example.com/b.png' }, 'small');
    const img = avatar.querySelector('img');

    expect(img.hasAttribute('loading')).toBe(false);
  });
});
