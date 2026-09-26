import CATALOG from './catalog.json' with { type: 'json' };
import PHOTOS from './photos.json' with { type: 'json' };

// Product catalogue.
//
// The products, sizes, prices and quantities come from the client's
// spreadsheet (src/lib/SHOP NX2 ONLINE LIST.xlsx) via `npm run
// import:products`, which writes catalog.json. This file adds what the sheet
// doesn't hold: a tidy display name for each sheet entry, and whether the name
// references another fragrance house ("inspired"). Rows the sheet adds later
// still appear, title-cased, and the importer lists them so a tidy name can be
// added here.

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
  'CREED MEN': ['Creed Men', true],
  'WHITE LONDON': ['White London'],
  'BLACK LONDON': ['Black London'],
  'ARO MAGNET': ['Arrow Magnet'],
  'LOMANI CODE': ['Lomani Code', true],
  'CR 7': ['CR7', true],
  'INVICTUS': ['Invictus', true],
  'M. PONDS': ['M. Ponds', true],
  'CHARLIE': ['Charlie', true],
  'HELMENTON GREEN': ['Helmenton Green'],
  'ARMANI BLACK': ['Armani Black', true],
  'POLO SPORTS': ['Polo Sport', true],
  'POLO RED': ['Polo Red', true],
  'B DELICIOUS': ['Be Delicious', true],
  'TOMMY GIRL': ['Tommy Girl', true],
  'JAGUAR BLACK': ['Jaguar Black', true],
  'GUCCI BAMBOO': ['Gucci Bamboo', true],
  'BLACK EXCESS': ['Black Excess'],
  'COOL GIRL': ['Cool Girl'],
  'RASASI ROYAL BLUE': ['Rasasi Royal Blue', true],
  'BLACK ORCHID': ['Black Orchid', true],
  'SILVER SENT': ['Silver Scent', true],
  'LACOST WHITE': ['Lacoste White', true],
  'HUGO BOSS': ['Hugo Boss', true],
  'VERSACE': ['Versace', true],
  'VERSACE EROSS': ['Versace Eros', true],
  '212 SEXY MEN': ['212 Sexy Men', true],
  'BOMSHELL': ['Bombshell', true],
  'BULGURI BLACK': ['Bvlgari Black', true],
  'CK 1': ['CK One', true],
  'MOUNT BLANK LEGEND': ['Mont Blanc Legend', true],
  'Z DEO': ['Z Deo'],
  'X DEO': ['X Deo'],
  'IMM INTENCE': ['Imm Intense'],
  '24 CARET': ['24 Carat'],
  'ALLUR SPORTS': ['Allure Sport', true],
  'ICE BURG': ['Iceberg', true],
  'POISON': ['Poison', true],
  'FARARI RED': ['Ferrari Red', true],
  'C K SUMMER': ['CK Summer', true],
  'GUCCI BLOOM': ['Gucci Bloom', true],
  'WHITE OUD': ['White Oud'],
  'RED ROSE': ['Red Rose'],
  'ATTARFUL': ['Attarful'],
  'GUCCI FLORA': ['Gucci Flora', true],
  'ROYAL BLACK': ['Royal Black'],
  'LOMANI': ['Lomani', true],
  '555': ['555'],
  'SWEET HEART': ['Sweetheart'],
  'BRIGHT CRYSTAL': ['Bright Crystal', true],
  'T ROSE': ['T Rose'],
  'DEVID OFF CHAMPION': ['Davidoff Champion', true],
  'BLUE LADY': ['Blue Lady'],
  'ROYAL MIRAJ BROWN': ['Royal Miraj Brown'],
  'DOVE': ['Dove', true],
  'C 5': ['C5'],
  'RUH GULAB': ['Ruh Gulab'],
  'DIOR SAUVAGE': ['Dior Sauvage', true],
  'BLUE D CHENNAL': ['Bleu de Chanel', true],
  'CREED AVENTUS': ['Creed Aventus', true],
  'TERRE D HERMES': ["Terre d'Hermès", true],
  'VERSACCE DALAN BLUE': ['Versace Dylan Blue', true],
  'ROYAL PROFECCY': ['Royal Prophecy'],
  'ONE MILLION': ['One Million', true],
  'BOSS NIGHT': ['Boss Night', true],
  'CHOCLATE': ['Chocolate'],
  'BISCUTE': ['Biscuit'],
  'TOM F OMBER LEATHER': ['Tom Ford Ombre Leather', true],
  'LOCOST': ['Lacoste', true],
  'LACOST ALLURE P HOME': ['Lacoste Allure Pour Homme', true],
  'ICON': ['Icon'],
  // Premium
  'T.F FUCKING FABOULOS': ['T.F. F*** Fabulous', true],
  'BULGARI TIGER': ['Bvlgari Tygar', true],
  'DUBAI CHOCLATE': ['Dubai Chocolate'],
  'LAVEDER OUD': ['Lavender Oud'],
  'VANILLA': ['Vanilla'],
  'LATAFA KHAMRA': ['Lattafa Khamrah', true],
  'LATAFA NAJDIYA': ['Lattafa Najdia', true],
  'SINGNETURE': ['Signature'],
  '9PM': ['9PM', true],
  'SMOKE WISKY': ['Smoke Whisky'],
  'AQUA KISS': ['Aqua Kiss'],
  'OT PARIS': ['OT Paris'],
  'RAPLICA FIRE PLACE': ['Replica Fireplace', true],
  'ARMANI STRONGAR WITH YOU': ['Armani Stronger With You', true],
  'THE ONE': ['The One', true],
  'OUD INTENCE': ['Oud Intense'],
  'MARSH MALLOW': ['Marshmallow'],
  'MADAWI GOLD': ['Madawi Gold', true],
  'LATAFA YARA': ['Lattafa Yara', true],
  'YSL Y': ['YSL Y', true],
  'RM GOLD': ['RM Gold'],
  'ULTARA SUNESUA': ['Ultara Sunesua'],
  'AJMAL BLUE': ['Ajmal Blue', true],
  'T LEATHER': ['T Leather'],
  'CK. GOLD': ['CK Gold', true],
  'NEROLI PORTOFINO': ['Neroli Portofino', true],
  'NUDE SKIN': ['Nude Skin'],
  'ONE MILLION GOLD': ['One Million Gold', true],
  'ONE MILLION PRIVE': ['One Million Privé', true],
  'SECRET MUSK': ['Secret Musk'],
  'TITATAN RAW SKIN': ['Titan Skinn Raw', true],
  'CREAM D MUSK': ['Cream de Musk'],
  'GOLD SANDEL': ['Gold Sandal'],
  'KASTURI SANDEL': ['Kasturi Sandal'],
  'KESAR CHANDAN': ['Kesar Chandan'],
  'HEENA': ['Heena'],
  'COPPER': ['Copper'],
  'SWISS ARABIAN FIRDOOS': ['Swiss Arabian Firdous', true],
  'GOOD GIRL': ['Good Girl', true],
  'BULGURI AQUA': ['Bvlgari Aqua', true],
  'AQUA DGO': ['Acqua di Giò', true],
  'YSL MYSELF': ['YSL MYSLF', true],
  // Luxury
  'MADINA': ['Madina'],
  'ROUGER 540': ['Rouge 540', true],
  'RASASI HAWAS': ['Rasasi Hawas', true],
  'ZARA AMBER': ['Zara Amber', true],
  'GREEN AJMERI': ['Green Ajmeri'],
  'LV OMBER NOMARD': ['LV Ombre Nomade', true],
  'TOM FORD OUD SATIN MOOD': ['Tom Ford Oud Satin Mood', true],
  'PURPLE OUD': ['Purple Oud'],
  'COLLECTION OUD': ['Collection Oud'],
  'OUD MOOD': ['Oud Mood'],
  'TAM DAO': ['Tam Dao', true],
  'MUSK RIZALI': ['Musk Rizali'],
  'AFTERNOON SWIM': ['Afternoon Swim', true],
  'RASASI HAWAS BLACK': ['Rasasi Hawas Black', true],
  'AZARO MOST WANTED': ['Azzaro Most Wanted', true],
  'CAREMAL OUD': ['Caramel Oud'],
  'L V IMAGINATION': ['LV Imagination', true],
  'ARMAF CLUB D NOIT': ['Armaf Club de Nuit', true],
  'LATAFA KHAMRA QHAWA': ['Lattafa Khamrah Qahwa', true],
  'LATAFA WAHA': ['Lattafa Waha', true],
  'KACCHA GULAB': ['Kaccha Gulab'],
  'BIN SHAIKH': ['Bin Shaikh'],
  'AURUM': ['Aurum'],
  'RASASI HAWAS ICE': ['Rasasi Hawas Ice', true],
  'EL ROJA AMBER EX': ['El Roja Amber Ex', true],
  'GUCCI OUD': ['Gucci Oud', true],
  'GREATNESS OF OUD': ['Greatness of Oud'],
  'TURKISH OUD': ['Turkish Oud'],
  'MAFIA': ['Mafia'],
  'VEMPIRE BLOOD': ['Vampire Blood'],
};

const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

// Kinds of product a size can be (the group labels above the sheet's size columns)
export const TYPE_LABEL = { perfume: 'Perfume', attar: 'Attar' };
export const TYPE_NOTE = { perfume: 'Spray bottle', attar: 'Perfume oil' };
export const typeLabel = (t) => TYPE_LABEL[t] || (t ? titleCase(t) : '');

// sizes from the sheet → { id: 'perfume-30ml', type, ml, price, label: 'Perfume · 30 ml' }
const variantsOf = (row) =>
  (row.variants || []).map((v) => ({
    id: `${v.type ? `${slug(v.type)}-` : ''}${v.ml}ml`,
    type: v.type || null,
    ml: v.ml,
    price: v.price,
    label: `${v.type ? `${typeLabel(v.type)} · ` : ''}${v.ml} ml`,
  }));

export const UNREVIEWED = [];

export const PRODUCTS = CATALOG.products.map((row) => {
  const known = NAMES[row.sheetName];
  if (!known) UNREVIEWED.push(row.sheetName);
  const [name, inspired = false] = known || [titleCase(row.sheetName)];
  const variants = variantsOf(row);
  const prices = variants.map((v) => v.price).filter((n) => n != null);
  const id = `${row.category}-${slug(name)}`;
  return {
    id,
    name,
    sheetName: row.sheetName,
    category: row.category,
    number: row.number,
    inspired,
    // rupees · null = not priced yet. With sizes, the lowest ("from") price.
    price: prices.length ? Math.min(...prices) : row.price,
    variants, // [] = sold in one size
    stock: row.quantity, // units · null = not tracked
    images: PHOTOS[id] || [], // real photos (npm run import:photos); none = studio render
  };
});

// The three house signatures from the Collection chapter can go in the bag too.
export const SIGNATURES = [
  {
    id: 'house-base', name: 'Base', category: 'house', number: 1, inspired: false, price: null, variants: [], stock: null,
    description: 'The signature that started it all. Warm amber and precious woods, balanced with a whisper of spice — the scent of the House of Raza.',
  },
  {
    id: 'house-oud', name: 'Oud', category: 'house', number: 2, inspired: false, price: null, variants: [], stock: null,
    description: 'Smoked agarwood from ancient forests, deepened with leather and resin. A commanding trail that lingers long after you leave the room.',
  },
  {
    id: 'house-musk', name: 'Musk', category: 'house', number: 3, inspired: false, price: null, variants: [], stock: null,
    description: 'Clean white musk wrapped in soft florals and powdered iris — quiet, luminous and impossibly close to the skin.',
  },
];

SIGNATURES.forEach((p) => (p.images = PHOTOS[p.id] || []));

export const BY_ID = Object.fromEntries([...PRODUCTS, ...SIGNATURES].map((p) => [p.id, p]));

export const CATEGORY_LABEL = { regular: 'Regular', premium: 'Premium', luxury: 'Luxury', house: 'House Signature' };

// sizes: which one a bag line means, and what one unit of it costs
export const hasSizes = (p) => Boolean(p?.variants?.length);
export const variantOf = (p, v) => (v ? p?.variants?.find((x) => x.id === v) || null : null);
export const unitPrice = (p, v) => (hasSizes(p) ? variantOf(p, v)?.price ?? null : p?.price ?? null);
