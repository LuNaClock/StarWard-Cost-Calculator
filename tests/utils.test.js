import { describe, expect, it } from 'vitest';
import { toHiragana, toKatakana } from '../js/utils.js';

describe('文字種変換ユーティリティ', () => {
  it('カタカナをひらがなに変換できる', () => {
    expect(toHiragana('テスト')).toBe('てすと');
  });

  it('ひらがなをカタカナに変換できる', () => {
    expect(toKatakana('あいうえお')).toBe('アイウエオ');
  });

  it('nullや空文字を安全に処理する', () => {
    expect(toHiragana(null)).toBe('');
    expect(toKatakana('')).toBe('');
  });
});
