import CATALOG from './catalog.json' with { type: 'json' };

// Product catalogue.
//
// The products, prices and quantities come from the client's spreadsheet
// (src/lib/ONLINE LIST.xlsx) via `npm run import:products`, which writes
// catalog.json. This file adds what the sheet doesn't hold: a tidy display
// name for each sheet entry, and whether the name references another
// fragrance house ("inspired"). Rows the sheet adds later still appear,
// title-cased, and the importer lists them so a tidy name can be added here.

export const CATEGORIES = [
  { key: 'luxury', label: 'Luxury', blurb: 'Luxury collection' },
  { key: 'premium', label: 'Premium', blurb: 'Premium collection' },
  { key: 'regular', label: 'Regular', blurb: 'Everyday classics' },
];

// sheet spelling → [display name, inspired?]
const NAMES = {
  // Regular
  'COOL WATER': ['Cool Water', true],
  'DESIRE': ['Desire', true],
  'BLUE JEAN': ['Blue Jean', true],
  'WHITE LOBNDON': ['White London'],
  'BLACK LONDON': ['Black London'],
  'MAGNET': ['Magnet'],
  'LOMANI CODE': ['Lomani Code', true],
  'CR 7': ['CR7', true],
  'SEVEN EARTH': ['Seven Earth'],
  'PONDS': ['Ponds', true],
  'CHARLIE': ['Charlie', true],
  'HELMENTON GREEN': ['Helmenton Green'],
  'FOREST SPICE': ['Forest Spice'],
  'POLO SPORTS': ['Polo Sport', true],
  'POLO RED': ['Polo Red', true],
  'B DELICIOUS': ['Be Delicious', true],
  'WHITE MEERA': ['White Meera'],
  'JAGUAR BLACK': ['Jaguar Black', true],
  'GUCCI BAMBOO': ['Gucci Bamboo', true],
  'BLACK EXCESS': ['Black Excess'],
  'COOL GIRL': ['Cool Girl'],
  'ROYAL BLUE': ['Royal Blue'],
  'BLACK ORCHID': ['Black Orchid', true],
  'SILVER SENT': ['Silver Scent', true],
  'LACOST WHITE': ['Lacoste White', true],
  'HUGO BOSS': ['Hugo Boss', true],
  'VERSACE': ['Versace', true],
  'VERSACE EROSS': ['Versace Eros', true],
  '212 SEXY MEN': ['212 Sexy Men', true],
  'BOMSHELL': ['Bombshell', true],
  'MARCO': ['Marco'],
  'CK 1': ['CK One', true],
  'MOUNT BLANK LEGEND': ['Mont Blanc Legend', true],
  'Z DEO': ['Z Deo'],
  'X DEO': ['X Deo'],
  'TULIP': ['Tulip'],
  '24 CARET': ['24 Carat'],
  'TITAN SKIN RAW': ['Titan Skinn Raw', true],
  'ICE BURG': ['Iceberg', true],
  'POISON': ['Poison', true],
  'FARARI RED': ['Ferrari Red', true],
  'C K SUMMER': ['CK Summer', true],
  'AMERIGE': ['Amarige', true],
  'WHITE OUD': ['White Oud'],
  'RED ROSE': ['Red Rose'],
  'ATTARFUL': ['Attarful'],
  'ORANGE': ['Orange'],
  'SIGNATURE': ['Signature'],
  'ARROW MAGNET': ['Arrow Magnet'],
  '555': ['555'],
  'SWEET HEART': ['Sweetheart'],
  'SHARARAT': ['Shararat'],
  'LONDON NIGHT': ['London Night'],
  'DEVID OFF CHAMPION': ['Davidoff Champion', true],
  'BLUE LADY': ['Blue Lady'],
  'ROYAL MIRAJ BROWN': ['Royal Miraj Brown'],
  'DOVE': ['Dove', true],
  'C 5': ['C5'],
  'PRIDE': ['Pride'],
  'ROMANTIC MOOD': ['Romantic Mood'],
  // Premium
  'VICTORIA SECRET COCO SERO': ["Victoria's Secret Coco Sero", true],
  'CAFÉ ROSE': ['Café Rose', true],
  'ONE MILLION GOLD': ['One Million Gold', true],
  'ZUBRA': ['Zubra'],
  'KESAR CHANDAN': ['Kesar Chandan'],
  'MUKHALLAT EMRITES': ['Mukhallat Emirates'],
  'BADAR': ['Badar'],
  'NOPOLINE': ['Nopoline'],
  'TOM FORD OUD WOOD': ['Tom Ford Oud Wood', true],
  'L V IMAGINATION': ['LV Imagination', true],
  'YSL TUXEDO': ['YSL Tuxedo', true],
  'BLOOD VEMPIRE': ['Blood Vampire'],
  'REPLICA FIRE PLACE': ['Replica Fireplace', true],
  'T.F FUCKING FABOULOS': ['T.F. F*** Fabulous', true],
  'GUCCI FLORA': ['Gucci Flora', true],
  'DIOR SAVAGE': ['Dior Sauvage', true],
  'TABACCO VENILLA': ['Tobacco Vanilla', true],
  'MOST WANTED': ['Most Wanted', true],
  'COLLECTION OUD': ['Collection Oud'],
  'ARBAB WARDAT 21': ['Arbab Wardat 21'],
  // Luxury
  'MADINA': ['Madina'],
  'ROUGER 540': ['Rouge 540', true],
  'RASASI HAWAS': ['Rasasi Hawas', true],
  'ZARA AMBER': ['Zara Amber', true],
  'GREEN AJMERI': ['Green Ajmeri'],
  'LV OMBER NOMARD': ['LV Ombre Nomade', true],
  'TOMFORD OMBER LEATHER': ['Tom Ford Ombre Leather', true],
  'PURPLE OUD': ['Purple Oud'],
  'KASTURI CHANDAN': ['Kasturi Chandan'],
  'AQUA KISS': ['Aqua Kiss'],
  'TAM DAO': ['Tam Dao', true],
  'MUSK RIZALI': ['Musk Rizali'],
  'LEVENDER OUD': ['Lavender Oud'],
  'MONTAL HONEY OUD': ['Montale Honey Oud', true],
  'KHUS': ['Khus'],
};

const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

export const UNREVIEWED = [];

export const PRODUCTS = CATALOG.products.map((row) => {
  const known = NAMES[row.sheetName];
  if (!known) UNREVIEWED.push(row.sheetName);
  const [name, inspired = false] = known || [titleCase(row.sheetName)];
  return {
    id: `${row.category}-${slug(name)}`,
    name,
    sheetName: row.sheetName,
    category: row.category,
    number: row.number,
    inspired,
    price: row.price,      // rupees · null = not priced yet
    stock: row.quantity,   // units · null = not tracked
  };
});

// The three house signatures from the Collection chapter can go in the bag too.
export const SIGNATURES = [
  {
    id: 'house-base', name: 'Base', category: 'house', number: 1, inspired: false, price: null, stock: null,
    description: 'The signature that started it all. Warm amber and precious woods, balanced with a whisper of spice — the scent of the House of Raza.',
  },
  {
    id: 'house-oud', name: 'Oud', category: 'house', number: 2, inspired: false, price: null, stock: null,
    description: 'Smoked agarwood from ancient forests, deepened with leather and resin. A commanding trail that lingers long after you leave the room.',
  },
  {
    id: 'house-musk', name: 'Musk', category: 'house', number: 3, inspired: false, price: null, stock: null,
    description: 'Clean white musk wrapped in soft florals and powdered iris — quiet, luminous and impossibly close to the skin.',
  },
];

export const BY_ID = Object.fromEntries([...PRODUCTS, ...SIGNATURES].map((p) => [p.id, p]));

export const CATEGORY_LABEL = { regular: 'Regular', premium: 'Premium', luxury: 'Luxury', house: 'House Signature' };
