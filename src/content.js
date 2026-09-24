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
