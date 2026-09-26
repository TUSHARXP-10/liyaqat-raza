// Blogs Raza (/blogs): the films and photos, and what the page says about them.
//
// The raw WhatsApp exports live in SOURCE (not committed). `npm run
// import:blog` makes the web copies in public/media/blog/ (a 720p film, a
// 4-second silent preview loop and a poster per film) and src/blog/media.json.
// To add a film: drop it in SOURCE, add a line below, run the script.
//
// Left out on purpose: re-exports of the same clip (kept once), the
// "15% / 25% off, 29–31 May" offer (expired), and a lab clip carrying another
// brand's watermark (@infiniparfums).

export const SOURCE = 'src/story/blog content';
const video = (t) => `WhatsApp Video 2026-09-24 at ${t}.mp4`;
const image = (t) => `WhatsApp Image 2026-09-24 at ${t}.jpeg`;

export const CATEGORIES = [
  { key: 'films', label: 'Fragrance films' },
  { key: 'challenge', label: 'The blind test' },
  { key: 'lab', label: 'In the lab' },
  { key: 'counter', label: 'At the counter' },
];

// featured: leads the page (the brand's own picks) · product: shop id, for
// "Shop this fragrance" · poster / preview: seconds into the clip for the
// still and the start of the silent loop
export const REELS = [
  // featured
  { slug: 'afternoon-swim', file: video('12.52.51 AM (1)'), cat: 'films', featured: true, product: 'luxury-afternoon-swim', poster: 5, preview: 3,
    title: 'Afternoon Swim', text: 'Our Afternoon Swim, filmed in crystal-blue water.' },
  { slug: 'dior-savage', file: video('12.53.01 AM'), cat: 'films', featured: true, product: 'regular-dior-sauvage', poster: 1.2, preview: 4,
    title: 'Dior Savage', text: 'Red light, a mist of spray, and a bottle that means business.' },
  { slug: 'oud-rose', file: video('12.52.59 AM'), cat: 'films', featured: true, poster: 1.5, preview: 5,
    title: 'Oud Rose', text: 'Rose and oud in a jewel-dark bottle.' },
  { slug: 'the-red-room', file: video('12.52.50 AM'), cat: 'lab', featured: true, poster: 16, preview: 2,
    title: 'The red room', text: 'Weighed, poured and sealed, one bottle at a time.' },
  { slug: 'valantino', file: video('12.52.54 AM (1)'), cat: 'films', featured: true, poster: 8.5, preview: 3,
    title: 'Valantino', text: 'One spray at dusk.' },
  { slug: 'from-a-call-to-a-bottle', file: video('12.53.04 AM (1)'), cat: 'lab', featured: true, poster: 8, preview: 1,
    title: 'From a call to a bottle', text: 'Call Raza Perfume, and it is blended for you.' },
  { slug: 'unboxing-lattafa', file: video('12.52.55 AM'), cat: 'films', featured: true, poster: 8, preview: 6,
    title: 'Unboxing Lattafa', text: 'Crystal, gold and a velvet box.' },

  // the blind test
  { slug: 'the-blind-test', file: video('12.51.48 AM'), cat: 'challenge', poster: 50, preview: 12,
    title: 'Raza NX2 vs branded: the blind test', text: 'Shoppers smell two perfumes without knowing which is which, and the score is kept on screen.' },
  { slug: 'the-blind-test-round-two', file: video('12.51.19 AM'), cat: 'challenge', poster: 26, preview: 8,
    title: 'The blind test, round two', text: 'More shoppers, same question: which one smells better?' },
  { slug: 'itne-acche', file: video('12.52.40 AM (2)'), cat: 'challenge', poster: 1.5, preview: 1,
    title: '“Itne acche?”', text: 'Reactions from the blind test.' },

  // at the counter
  { slug: 'fourteen-thousand-or-nineteen-hundred', file: video('12.52.11 AM'), cat: 'counter', poster: 4, preview: 3,
    title: '₹14,200 or ₹1,900?', text: 'Liyaqat on why a recreation costs a fraction of the original.' },
  { slug: 'what-is-a-recreation', file: video('12.52.40 AM'), cat: 'counter', poster: 13, preview: 10,
    title: 'What is a recreation?', text: 'Liyaqat explains what goes into a Raza recreation.' },
  { slug: 'sauvage-for-a-fraction', file: video('12.52.51 AM (2)'), cat: 'counter', poster: 5.5, preview: 4,
    title: 'Sauvage, for a fraction', text: 'The original’s price tag, and ours.' },
  { slug: 'your-questions', file: video('12.52.50 AM (1)'), cat: 'counter', poster: 5, preview: 2,
    title: 'Do we sell branded perfume?', text: 'The questions we hear most, answered at the counter.' },
  { slug: 'inside-the-store', file: video('12.52.51 AM'), cat: 'counter', poster: 1, preview: 6,
    title: 'Inside the Kalyan store', text: 'Perfume, attar, mehendi and agarbatti under one roof.' },
  { slug: 'walls-of-fragrance', file: video('12.52.56 AM'), cat: 'counter', poster: 14, preview: 10,
    title: 'Walls of fragrance', text: 'Shelf after shelf of perfumes and attars.' },
  { slug: 'packed-with-care', file: video('12.52.53 AM'), cat: 'counter', poster: 3, preview: 1,
    title: 'Packed with care', text: 'Every order boxed and bagged at the counter.' },
  { slug: 'pick-your-scent', file: video('12.52.57 AM'), cat: 'counter', poster: 4.5, preview: 1,
    title: 'Pick your scent', text: 'A fist bump, and the bottles appear.' },
  { slug: 'two-scents-one-choice', file: video('12.53.00 AM (3)'), cat: 'counter', poster: 8, preview: 4,
    title: 'Two scents, one choice', text: 'Which one would you take home?' },
  { slug: 'best-use-of-a-trend', file: video('12.52.59 AM (2)'), cat: 'counter', poster: 3, preview: 6,
    title: 'POV: best use of a trend', text: 'A customer, the team, and one very good trend.' },
  { slug: 'confidence-level', file: video('12.52.57 AM (1)'), cat: 'counter', poster: 1, preview: 1,
    title: 'Whenever I make perfume for myself', text: 'Confidence level: this cat.' },

  // in the lab
  { slug: 'attar-poured-by-hand', file: video('12.52.55 AM (1)'), cat: 'lab', poster: 7, preview: 3,
    title: 'Attar, poured by hand', text: 'Golden attar into a filigree bottle.' },
  { slug: 'the-chemistry-of-a-scent', file: video('12.52.58 AM (2)'), cat: 'lab', poster: 6.5, preview: 1,
    title: 'The chemistry of a scent', text: 'Measured drop by drop.' },
  { slug: 'nahi-better-hai', file: video('12.52.58 AM'), cat: 'lab', poster: 30, preview: 9,
    title: '“Nahi!” … “Better hai!”', text: 'Blending until it is right.' },
  { slug: 'blending-with-the-team', file: video('12.53.04 AM'), cat: 'lab', poster: 9, preview: 6,
    title: 'Blending with the team', text: 'Liyaqat and the team at the scale.' },

  // fragrance films
  { slug: 'pm9', file: video('12.52.52 AM (1)'), cat: 'films', product: 'premium-9pm', poster: 12, preview: 2,
    title: 'PM9', text: 'Violet light and a golden crown.' },
  { slug: 'r-hawas-black', file: video('12.52.52 AM'), cat: 'films', product: 'luxury-rasasi-hawas-black', poster: 8, preview: 2,
    title: 'R. Hawas Black', text: 'Dark glass, bright fire.' },
  { slug: 'lv-imagination', file: video('12.52.53 AM (1)'), cat: 'films', product: 'luxury-lv-imagination', poster: 10.5, preview: 1,
    title: 'LV Imagination', text: 'Citrus and cool blue glass.' },
  { slug: 'rasasi-hawas-ice', file: video('12.52.54 AM'), cat: 'films', product: 'luxury-rasasi-hawas-ice', poster: 7.5, preview: 1,
    title: 'Rasasi Hawas Ice', text: 'Ice-blue, from every angle.' },
  { slug: 'hawas-ice-unwrapped', file: video('12.53.00 AM (2)'), cat: 'films', product: 'luxury-rasasi-hawas-ice', poster: 3.8, preview: 0.5,
    title: 'Hawas Ice, unwrapped', text: 'Torn open in four seconds.' },
  { slug: 'dubai-chocolate', file: video('12.52.57 AM (2)'), cat: 'films', product: 'premium-dubai-chocolate', poster: 12.5, preview: 3,
    title: 'Dubai Chocolate', text: 'Warm, golden and on fire.' },
  { slug: 'elroja-amber-aoud', file: video('12.52.49 AM (2)'), cat: 'films', product: 'luxury-el-roja-amber-ex', poster: 10.5, preview: 2,
    title: 'Elroja Amber Aoud', text: 'Amber, oud and flame.' },
  { slug: 'kaaf', file: video('12.52.59 AM (1)'), cat: 'films', poster: 12.5, preview: 3,
    title: 'Kaaf', text: 'A crown of gold on teal.' },
  { slug: 'lomani-blue', file: video('12.52.54 AM (2)'), cat: 'films', poster: 14, preview: 3,
    title: 'Lomani Blue', text: 'Deep blue, one spray.' },
  { slug: 'jpg-ultra-male', file: video('12.52.49 AM'), cat: 'films', poster: 30, preview: 10,
    title: 'JPG Ultra Male', text: 'A crown, a spray and a violet sky.' },
  { slug: 'fresh-cut', file: video('12.52.48 AM (1)'), cat: 'films', poster: 13.5, preview: 1,
    title: 'Fresh cut', text: 'Orange, leaf and a golden Raza bottle.' },
  { slug: 'know-your-notes', file: video('12.52.52 AM (2)'), cat: 'films', poster: 5, preview: 1,
    title: 'Know your notes', text: 'Oud Rose, Afternoon Swim and Oud Father, note by note.' },
];

// photos for the "Moments" wall
export const PHOTOS = [
  image('12.53.01 AM'), image('12.53.02 AM (1)'), image('12.53.02 AM (2)'), image('12.53.02 AM (3)'),
  image('12.53.02 AM'), image('12.53.03 AM (1)'), image('12.53.03 AM (2)'), image('12.53.03 AM'),
  image('12.53.04 AM (1)'), image('12.53.04 AM'), image('12.53.05 AM (1)'), image('12.53.05 AM'),
];
