export const rawCharacterData = [
    { name: "グリフィン", hp: 3020, cost: 3, image: "assets/character_icons/griffin.png" },
    { name: "キャヴァリー", hp: 3003, cost: 3, image: "assets/character_icons/cavalry.png" },
    { name: "ケルビム", hp: 2953, cost: 3, image: "assets/character_icons/cherubim.png" },
    { name: "ラジエル", hp: 2953, cost: 3, image: "assets/character_icons/rasiel.png" },
    { name: "影", hp: 2909, cost: 3, image: "assets/character_icons/shadow.png" },
    { name: "ロタ", hp: 2892, cost: 3, image: "assets/character_icons/rota.png" },
    { name: "ヒカリ", hp: 2886, cost: 3, image: "assets/character_icons/hikari.png" },
    { name: "シュウウ", hp: 2886, cost: 3, image: "assets/character_icons/qiuyu.png" },
    { name: "イーザー", hp: 2886, cost: 3, image: "assets/character_icons/ether.png" },
    { name: "ライン", hp: 2850, cost: 3, image: "assets/character_icons/rhine.png" },
    { name: "エルフィン", hp: 2808, cost: 3, image: "assets/character_icons/elfin.png" },
    { name: "シャオリン", hp: 2772, cost: 2.5, image: "assets/character_icons/xiaoling.png" },
    { name: "アリス", hp: 2772, cost: 2.5, image: "assets/character_icons/aliz.png" },
    { name: "スズラン", hp: 2723, cost: 3, image: "assets/character_icons/convallaria.png" },
    { name: "轟雷改", hp: 2669, cost: 2.5, image: "assets/character_icons/gourai-kai.png" },
    { name: "フリード", hp: 2664, cost: 2.5, image: "assets/character_icons/ffreedo.png" },
    { name: "スカイセーバー", hp: 2664, cost: 2.5, image: "assets/character_icons/skysaber.png" },
    { name: "十八号", hp: 2664, cost: 2.5, image: "assets/character_icons/xviii.png" },
    { name: "カゼ", hp: 2592, cost: 2.5, image: "assets/character_icons/kaze.png" },
    { name: "シャープ", hp: 2592, cost: 2.5, image: "assets/character_icons/sharp.png" },
    { name: "ヴァルキア", hp: 2592, cost: 2.5, image: "assets/character_icons/valkia.png" },
    { name: "稲", hp: 2556, cost: 2.5, image: "assets/character_icons/ine.png" },
    { name: "エヴァ", hp: 2550, cost: 2.5, image: "assets/character_icons/iva.png" },
    { name: "アンジェリス", hp: 2500, cost: 2.5, image: "assets/character_icons/angelis.png" },
    { name: "シグナス", hp: 2492, cost: 2.5, image: "assets/character_icons/cygnus.png" },
    { name: "バーゼラルド", hp: 2556, cost: 2.5, image: "assets/character_icons/baselard.png" },
    { name: "パラス", hp: 2448, cost: 2, image: "assets/character_icons/pallas.png" },
    { name: "ヴァーチェ", hp: 2348, cost: 2, image: "assets/character_icons/virtue.png" },
    { name: "ベータ", hp: 2340, cost: 2, image: "assets/character_icons/beta.png" },
    { name: "セラフィム", hp: 2340, cost: 2, image: "assets/character_icons/seraphim.png" },
    { name: "咲迦", hp: 2298, cost: 2, image: "assets/character_icons/emika.png" },
    { name: "スコーピオン", hp: 2268, cost: 2, image: "assets/character_icons/scorpion.png" },
    { name: "チンニ", hp: 2268, cost: 2, image: "assets/character_icons/qingni.png" },
    { name: "アイーダ", hp: 2240, cost: 2, image: "assets/character_icons/aida.png" },
    { name: "ザハロワ", hp: 2196, cost: 2, image: "assets/character_icons/zakharova.png" },
    { name: "デュカリオン", hp: 2168, cost: 2, image: "assets/character_icons/deucalion.png" },
    { name: "ヒビキ", hp: 2168, cost: 2, image: "assets/character_icons/hibiki.png" },
    { name: "ダークスター", hp: 2155, cost: 2, image: "assets/character_icons/darkstar.png" },
    { name: "スティレット", hp: 2340, cost: 2, image: "assets/character_icons/stylet.png" },
    { name: "ローランド", hp: 2088, cost: 1.5, image: "assets/character_icons/roland.png" },
    { name: "カタリナ", hp: 2080, cost: 1.5, image: "assets/character_icons/katerina.png" },
    { name: "オーキッド", hp: 1980, cost: 1.5, image: "assets/character_icons/orchid.png" },
    { name: "ヤミン", hp: 1980, cost: 1.5, image: "assets/character_icons/yammyn.png" },
    { name: "スノーウォル", hp: 1872, cost: 1.5, image: "assets/character_icons/snowowl.png" }
];

export const kanjiNameReadings = {
    "影": { hiragana: "かげ", katakana: "カゲ" },
    "轟雷改": { hiragana: "ごうらいかい", katakana: "ゴウライカイ" },
    "十八号": { hiragana: "じゅうはちごう", katakana: "ジュウハチゴウ" },
    "稲": { hiragana: "いね", katakana: "イネ" },
    "咲迦": { hiragana: "えみか", katakana: "エミカ" }
};

export const costRemainingMap = {
    "3.0": [0.5, 1.0, 1.5],
    "2.5": [0.5, 1.0, 1.5, 2.0],
    "2.0": [0.5, 1.0, 1.5],
    "1.5": [0.5, 1.0]
};

export const MAX_TEAM_COST = 6.0;
export const AVERAGE_GAUGE_COEFFICIENT = 0.5980;
export const AWAKENING_THRESHOLD = 50;

export const AWAKENING_BONUS_BY_COST = {
    "3.0": 22, "3": 22,
    "2.5": 22,
    "2.0": 20, "2": 20,
    "1.5": 15
};

export const PARTNER_DOWN_AWAKENING_BONUS = {
    "3.0": 10, "3": 10,
    "2.5": 9,
    "2.0": 7, "2": 7,
    "1.5": 5
};