// Brand content in one place so the client team can edit copy without touching
// the motion code. Colours drive the 3D bottle, splash and backdrop grading.

export const BRAND = {
  name: 'Raza',
  arabic: 'رضا',
  founder: 'Yasinali Sayed',
  established: 1986,
};

// Shop settings come from environment variables (.env locally, Vercel →
// Settings → Environment Variables in production). See .env.example.
const env = import.meta.env || {};
export const SHOP = {
  // WhatsApp that receives orders — digits only, with country code
  whatsapp: String(env.VITE_WHATSAPP_NUMBER || '918976035333').replace(/\D/g, ''),
  // phone for calls
  phone: '+919029504320',
  phoneLabel: '+91 90295 04320',
  whatsappLabel: '+91 89760 35333',
  instagram: 'https://www.instagram.com/raza_perfumenx2kalyan/',
  supabaseUrl: env.VITE_SUPABASE_URL || '',
  supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '',
  pageSize: 12,
};

// The shop as Google should know it (Search, Maps, the business panel). Keep
// every detail exactly as on the Google Business Profile: the same name,
// address and phone everywhere is what local search rewards. Empty fields are
// left out of the pages until they're filled in.
export const BUSINESS = {
  name: 'Raza Perfume',
  alternateNames: ['Raza Perfume NX2', 'Raza Perfume Kalyan', 'Raza Perfumes'],
  street: '', // e.g. 'Shop 12, NX2 …'
  locality: 'Kalyan',
  region: 'Maharashtra',
  postalCode: '',
  country: 'IN',
  geo: null, // { lat: 19.2403, lng: 73.1305 } from the shop's Google Maps pin
  mapsUrl: '', // the "Share" link of the Google Maps listing
  // e.g. [{ days: ['Monday', 'Tuesday'], opens: '10:00', closes: '22:00' }]
  hours: [],
  since: 1986,
};

export const VARIANTS = [
  {
    key: 'base',
    name: 'BASE',
    liquid: '#b0640f',
    liquidGlow: '#5e2a04',
    ribbon: '#d99a3a',
    glass: '#ffffff',
    capAccent: '#0c0a08',
  },
  {
    key: 'oud',
    name: 'OUD',
    liquid: '#1b0c05',
    liquidGlow: '#2c0e03',
    ribbon: '#7a3a14',
    glass: '#8f8175',
    capAccent: '#050404',
  },
  {
    key: 'musk',
    name: 'MUSK',
    liquid: '#efe6d4',
    liquidGlow: '#6f6a60',
    ribbon: '#efe2c4',
    glass: '#ffffff',
    capAccent: '#0c0a08',
  },
];
