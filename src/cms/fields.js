// Every block of site copy the admin panel can edit, with the site's built-in
// wording as the default. The admin panel builds its forms from this list;
// the site applies saved values (Supabase table site_content, one row per
// key) over the defaults. `bind` says where a value goes on the page:
//   sel     the element (or elements) it fills
//   lines   for multi-line values: the child elements, one per line
//   br      join lines with <br> inside `sel`
//   count   for the shop intro: "{count}" becomes the live number of fragrances

const slide = (n, lines, label) => [
  { key: `hero.${n}.lines`, label: `Slide ${n} · headline`, type: 'lines', count: 3, default: lines, bind: { sel: `[data-hero-slide="${n - 1}"]`, lines: '.hero__line' } },
  { key: `hero.${n}.label`, label: `Slide ${n} · caption`, type: 'text', default: label },
];
const signature = (n, name, tag, desc, notes) => [
  { key: `collection.${n}.tag`, label: `${name} · tagline`, type: 'text', default: tag, bind: { sel: `[data-variant="${n - 1}"] .variant__tag` } },
  { key: `collection.${n}.desc`, label: `${name} · description`, type: 'textarea', default: desc, bind: { sel: `[data-variant="${n - 1}"] .variant__desc` } },
  { key: `collection.${n}.notes`, label: `${name} · notes (top, heart, base)`, type: 'lines', count: 3, default: notes, bind: { sel: `[data-variant="${n - 1}"] .variant__notes`, lines: 'dd' } },
];

export const SECTIONS = [
  {
    key: 'announce',
    title: 'Announcement bar',
    note: 'A slim bar across the top of the site, for offers and news.',
    fields: [
      { key: 'announce.enabled', label: 'Show the bar', type: 'toggle', default: false },
      { key: 'announce.text', label: 'Message', type: 'text', default: 'Free shipping on orders above ₹999', max: 120 },
      { key: 'announce.linkLabel', label: 'Button text (optional)', type: 'text', default: 'Shop now', max: 30 },
      { key: 'announce.link', label: 'Button link', type: 'text', default: '/#shop', hint: 'A page or section, e.g. /#shop, /blogs, /p/regular-cool-water' },
    ],
  },
  {
    key: 'hero',
    title: 'Opening slides',
    note: 'The first screen. Each slide pairs with Base, Oud and Musk.',
    fields: [
      ...slide(1, ['Scents', 'that tell', 'stories'], 'Base — The Original Essence'),
      ...slide(2, ['Rich.', 'Bold.', 'Timeless.'], 'Oud — Rich. Bold. Timeless.'),
      ...slide(3, ['Pure.', 'Elegant.', 'Everlasting.'], 'Musk — Pure. Elegant. Everlasting.'),
      { key: 'hero.lead', label: 'Intro paragraph', type: 'textarea', default: 'Rooted in tradition. Created for today. Raza Perfume brings you the finest scents, inspired by heritage, designed for modern gentlemen.', bind: { sel: '[data-hero-lead]' } },
      { key: 'hero.aside', label: 'Side line', type: 'lines', count: 3, default: ['A legacy', 'in every', 'drop'], bind: { sel: '[data-hero-aside]', lines: 'span' } },
    ],
  },
  {
    key: 'story',
    title: 'Origins · Yasinali Sayed',
    fields: [
      { key: 'story.about', label: 'His story', type: 'textarea', default: 'In 1986, Yasinali Sayed opened a small perfume counter in Bombay with a handful of attars and a deep love for the craft. Blending oud, musk, amber, rose and sandal by hand, he treated every customer like family — and built a name his family still carries today.', bind: { sel: '[data-founder-origin-text]' } },
      { key: 'story.quote', label: 'His words', type: 'lines', count: 2, default: ['Sugandh se', 'rishte bante hain.'], bind: { sel: '[data-story-quote]', lines: '[data-quote-line]' } },
      { key: 'story.translation', label: 'Translation', type: 'text', default: '“Fragrance builds bonds.”', bind: { sel: '[data-quote-translation]' } },
    ],
  },
  {
    key: 'founder',
    title: 'The House Today · Liyaqat Sayed',
    fields: [
      { key: 'founder.about', label: 'His story', type: 'textarea', default: 'What his father Yasinali began at a single counter in 1986, Liyaqat Sayed carries forward today. He founded Raza Perfume as it stands now, shaping that legacy into a house of rare oud, musk and amber, made with the same devotion, and the same promise that every bottle carries a story worth wearing.', bind: { sel: '[data-founder-text]' } },
      { key: 'founder.quote', label: 'His words', type: 'lines', count: 2, default: ['True luxury is not seen,', 'it is felt.'], bind: { sel: '[data-quote-words]', br: true } },
    ],
  },
  {
    key: 'collection',
    title: 'Signature collection',
    note: 'Base, Oud and Musk in the Collection chapter.',
    fields: [
      ...signature(1, 'Base', 'The Original Essence', 'The signature that started it all. Warm amber and precious woods, balanced with a whisper of spice — the scent of the House of Raza.', ['Saffron · Bergamot', 'Amber · Rose', 'Sandalwood · Musk']),
      ...signature(2, 'Oud', 'Rich. Bold. Timeless.', 'Smoked agarwood from ancient forests, deepened with leather and resin. A commanding trail that lingers long after you leave the room.', ['Black Pepper · Cardamom', 'Agarwood · Leather', 'Incense · Vetiver']),
      ...signature(3, 'Musk', 'Pure. Elegant. Everlasting.', 'Clean white musk wrapped in soft florals and powdered iris — quiet, luminous and impossibly close to the skin.', ['Neroli · Pear', 'Jasmine · Iris', 'White Musk · Ambrette']),
    ],
  },
  {
    key: 'shop',
    title: 'Shop',
    fields: [
      { key: 'shop.lede', label: 'Shop introduction', type: 'textarea', default: 'From everyday classics to rare ouds: {count} fragrances from the House of Raza. Add your favourites to the bag and send your order in a single WhatsApp message.', hint: '{count} becomes the number of fragrances', bind: { sel: '.shop__lede', count: true } },
      { key: 'shop.disclaimer', label: 'Small print', type: 'textarea', default: 'Fragrances marked “Inspired” are Raza’s own interpretations. The names describe their scent profile only; Raza Perfume is not affiliated with or endorsed by the houses referenced.', bind: { sel: '.shop__disclaimer' } },
      { key: 'shop.shipping', label: 'Shipping line (product view)', type: 'text', default: 'Free shipping above ₹999', bind: { sel: '.qv__assure li:nth-child(2)' } },
    ],
  },
  {
    key: 'promise',
    title: 'Promises',
    note: 'The four icons above the footer.',
    fields: [
      { key: 'promise.1.title', label: 'Promise 1 · title', type: 'text', default: 'Free Shipping', bind: { sel: '.promise__item:nth-child(1) h3' } },
      { key: 'promise.1.text', label: 'Promise 1 · text', type: 'text', default: 'On orders above ₹999', bind: { sel: '.promise__item:nth-child(1) p' } },
      { key: 'promise.2.title', label: 'Promise 2 · title', type: 'text', default: 'Order on WhatsApp', bind: { sel: '.promise__item:nth-child(2) h3' } },
      { key: 'promise.2.text', label: 'Promise 2 · text', type: 'text', default: 'Quick, personal confirmation', bind: { sel: '.promise__item:nth-child(2) p' } },
      { key: 'promise.3.title', label: 'Promise 3 · title', type: 'text', default: 'Since 1986', bind: { sel: '.promise__item:nth-child(3) h3' } },
      { key: 'promise.3.text', label: 'Promise 3 · text', type: 'text', default: 'Four decades of the craft', bind: { sel: '.promise__item:nth-child(3) p' } },
    ],
  },
  {
    key: 'contact',
    title: 'Contact',
    note: 'Used for orders, calls and links everywhere on the site.',
    fields: [
      { key: 'contact.whatsapp', label: 'WhatsApp for orders', type: 'phone', default: '+91 89760 35333', hint: 'Orders from the bag are sent here' },
      { key: 'contact.phone', label: 'Phone for calls', type: 'phone', default: '+91 90295 04320' },
      { key: 'contact.instagram', label: 'Instagram link', type: 'text', default: 'https://www.instagram.com/raza_perfumenx2kalyan/' },
      { key: 'footer.subscribe', label: 'Newsletter line (footer)', type: 'text', default: 'Be the first to know about new launches, offers and stories.', bind: { sel: '.subscribe__text' } },
    ],
  },
  {
    key: 'blogs',
    title: 'Blogs Raza page',
    fields: [
      { key: 'blogs.lede', label: 'Page introduction', type: 'textarea', default: 'Blind tests on the mall floor, films of every bottle, and the hands that blend them. Straight from our counter.', bind: { sel: '[data-lede]' } },
    ],
  },
  {
    key: 'seo',
    title: 'Search & sharing',
    note: 'What Google and link previews show.',
    fields: [
      { key: 'seo.title', label: 'Page title', type: 'text', default: 'Raza Perfume — Scents That Tell Stories', max: 70 },
      { key: 'seo.description', label: 'Description', type: 'textarea', default: 'Raza Perfume. Rooted in tradition since 1986 — rare fragrances inspired by Arabian heritage, crafted for the modern gentleman.', max: 170 },
    ],
  },
];

export const FIELDS = SECTIONS.flatMap((s) => s.fields);
export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
export const DEFAULTS = Object.fromEntries(FIELDS.map((f) => [f.key, f.default]));
