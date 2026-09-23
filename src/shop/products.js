// Product catalogue, from the client's "ONLINE LIST.xlsx" (95 fragrances).
//
// Each row: [display name, name as written in the sheet, inspired?, price?]
//   - display name: tidied spelling for the website
//   - sheet name:   kept verbatim so the client's price list can be matched
//   - inspired:     true when the name references another fragrance house
//   - price:        rupees, or leave out → shown as "Price on request"
//
// To add prices, append the number to a row: ['Cool Water', 'COOL WATER', true, 499]

export const CATEGORIES = [
  { key: 'regular', label: 'Regular', blurb: 'Everyday classics' },
  { key: 'premium', label: 'Premium', blurb: 'Premium collection' },
  { key: 'luxury', label: 'Luxury', blurb: 'Luxury collection' },
];

const REGULAR = [
  ['Cool Water', 'COOL WATER', true],
  ['Desire', 'DESIRE', true],
  ['Blue Jean', 'BLUE JEAN', true],
  ['White London', 'WHITE LOBNDON'],
  ['Black London', 'BLACK LONDON'],
  ['Magnet', 'MAGNET'],
  ['Lomani Code', 'LOMANI CODE', true],
  ['CR7', 'CR 7', true],
  ['Seven Earth', 'SEVEN EARTH'],
  ['Ponds', 'PONDS', true],
  ['Charlie', 'CHARLIE', true],
  ['Helmenton Green', 'HELMENTON GREEN'],
  ['Forest Spice', 'FOREST SPICE'],
  ['Polo Sport', 'POLO SPORTS', true],
  ['Polo Red', 'POLO RED', true],
  ['Be Delicious', 'B DELICIOUS', true],
  ['White Meera', 'WHITE MEERA'],
  ['Jaguar Black', 'JAGUAR BLACK', true],
  ['Gucci Bamboo', 'GUCCI BAMBOO', true],
  ['Black Excess', 'BLACK EXCESS'],
  ['Cool Girl', 'COOL GIRL'],
  ['Royal Blue', 'ROYAL BLUE'],
  ['Black Orchid', 'BLACK ORCHID', true],
  ['Silver Scent', 'SILVER SENT', true],
  ['Lacoste White', 'LACOST WHITE', true],
  ['Hugo Boss', 'HUGO BOSS', true],
  ['Versace', 'VERSACE', true],
  ['Versace Eros', 'VERSACE EROSS', true],
  ['212 Sexy Men', '212 SEXY MEN', true],
  ['Bombshell', 'BOMSHELL', true],
  ['Marco', 'MARCO'],
  ['CK One', 'CK 1', true],
  ['Mont Blanc Legend', 'MOUNT BLANK LEGEND', true],
  ['Z Deo', 'Z DEO'],
  ['X Deo', 'X DEO'],
  ['Tulip', 'TULIP'],
  ['24 Carat', '24 CARET'],
  ['Titan Skinn Raw', 'TITAN SKIN RAW', true],
  ['Iceberg', 'ICE BURG', true],
  ['Poison', 'POISON', true],
  ['Ferrari Red', 'FARARI RED', true],
  ['CK Summer', 'C K SUMMER', true],
  ['Amarige', 'AMERIGE', true],
  ['White Oud', 'WHITE OUD'],
  ['Red Rose', 'RED ROSE'],
  ['Attarful', 'ATTARFUL'],
  ['Orange', 'ORANGE'],
  ['Signature', 'SIGNATURE'],
  ['Arrow Magnet', 'ARROW MAGNET'],
  ['555', '555'],
  ['Sweetheart', 'SWEET HEART'],
  ['Shararat', 'SHARARAT'],
  ['London Night', 'LONDON NIGHT'],
  ['Davidoff Champion', 'DEVID OFF CHAMPION', true],
  ['Blue Lady', 'BLUE LADY'],
  ['Royal Miraj Brown', 'ROYAL MIRAJ BROWN'],
  ['Dove', 'DOVE', true],
  ['C5', 'C 5'],
  ['Pride', 'PRIDE'],
  ['Romantic Mood', 'ROMANTIC MOOD'],
];

const PREMIUM = [
  ["Victoria's Secret Coco Sero", 'VICTORIA SECRET COCO SERO', true],
  ['Café Rose', 'CAFÉ ROSE', true],
  ['One Million Gold', 'ONE MILLION GOLD', true],
  ['Zubra', 'ZUBRA'],
  ['Kesar Chandan', 'KESAR CHANDAN'],
  ['Mukhallat Emirates', 'MUKHALLAT EMRITES'],
  ['Badar', 'BADAR'],
  ['Nopoline', 'NOPOLINE'],
  ['Tom Ford Oud Wood', 'TOM FORD OUD WOOD', true],
  ['LV Imagination', 'L V IMAGINATION', true],
  ['YSL Tuxedo', 'YSL TUXEDO', true],
  ['Blood Vampire', 'BLOOD VEMPIRE'],
  ['Replica Fireplace', 'REPLICA FIRE PLACE', true],
  ['T.F. F*** Fabulous', 'T.F FUCKING FABOULOS', true],
  ['Gucci Flora', 'GUCCI FLORA', true],
  ['Dior Sauvage', 'DIOR SAVAGE', true],
  ['Tobacco Vanilla', 'TABACCO VENILLA', true],
  ['Most Wanted', 'MOST WANTED', true],
  ['Collection Oud', 'COLLECTION OUD'],
  ['Arbab Wardat 21', 'ARBAB WARDAT 21'],
];

const LUXURY = [
  ['Madina', 'MADINA'],
  ['Rouge 540', 'ROUGER 540', true],
  ['Rasasi Hawas', 'RASASI HAWAS', true],
  ['Zara Amber', 'ZARA AMBER', true],
  ['Green Ajmeri', 'GREEN AJMERI'],
  ['LV Ombre Nomade', 'LV OMBER NOMARD', true],
  ['Tom Ford Ombre Leather', 'TOMFORD OMBER LEATHER', true],
  ['Purple Oud', 'PURPLE OUD'],
  ['Kasturi Chandan', 'KASTURI CHANDAN'],
  ['Aqua Kiss', 'AQUA KISS'],
  ['Tam Dao', 'TAM DAO', true],
  ['Musk Rizali', 'MUSK RIZALI'],
  ['Lavender Oud', 'LEVENDER OUD'],
  ['Montale Honey Oud', 'MONTAL HONEY OUD', true],
  ['Khus', 'KHUS'],
];

const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const build = (rows, category) =>
  rows.map(([name, sheetName, inspired = false, price = null], i) => ({
    id: `${category}-${slug(name)}`,
    name,
    sheetName,
    category,
    number: i + 1,
    inspired,
    price,
  }));

export const PRODUCTS = [...build(REGULAR, 'regular'), ...build(PREMIUM, 'premium'), ...build(LUXURY, 'luxury')];

// The three house signatures from the Collection chapter can go in the bag too.
export const SIGNATURES = [
  {
    id: 'house-base', name: 'Base', category: 'house', number: 1, inspired: false, price: null,
    description: 'The signature that started it all. Warm amber and precious woods, balanced with a whisper of spice — the scent of the House of Raza.',
  },
  {
    id: 'house-oud', name: 'Oud', category: 'house', number: 2, inspired: false, price: null,
    description: 'Smoked agarwood from ancient forests, deepened with leather and resin. A commanding trail that lingers long after you leave the room.',
  },
  {
    id: 'house-musk', name: 'Musk', category: 'house', number: 3, inspired: false, price: null,
    description: 'Clean white musk wrapped in soft florals and powdered iris — quiet, luminous and impossibly close to the skin.',
  },
];

export const BY_ID = Object.fromEntries([...PRODUCTS, ...SIGNATURES].map((p) => [p.id, p]));

export const CATEGORY_LABEL = { regular: 'Regular', premium: 'Premium', luxury: 'Luxury', house: 'House Signature' };
