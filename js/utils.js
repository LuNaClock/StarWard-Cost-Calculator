// Helper functions for Hiragana/Katakana conversion
export function toHiragana(str) {
    if (!str) return "";
    return str.replace(/[\u30A1-\u30F6]/g, function(match) { // Katakana to Hiragana
        var chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
}

export function toKatakana(str) {
    if (!str) return "";
    return str.replace(/[\u3041-\u3096]/g, function(match) { // Hiragana to Katakana
        var chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });
}