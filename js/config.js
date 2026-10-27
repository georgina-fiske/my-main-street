// One file for everything that changes when you white-label this site
// for another council or street. Names, colours, logo, shops, ideas.

window.CONFIG = {
  // ---- Supabase (public values only; safe to be in the front end) ----
  supabase: {
    url: 'PASTE_SUPABASE_PROJECT_URL_HERE',      // e.g. https://abcdxyz.supabase.co
    anonKey: 'PASTE_SUPABASE_ANON_PUBLIC_KEY_HERE'
  },

  // ---- Names ----
  siteName: 'My Main Street',
  streetName: 'Croydon Main Street',
  festivalName: 'Maroondah Festival',
  tagline: 'Shop local. Get stamps. Win prizes.',
  org: 'Fruitbowl Events',               // posts the campaigns
  council: 'Maroondah',                  // the council this demo is for
  councilLabel: 'Maroondah City Council',
  streetOrg: 'Croydon Main Street Association',
  allCouncils: ['Maroondah', 'Knox', 'Monash'],

  // ---- Colours ----
  colors: {
    purple: '#560CC9',   // main
    yellow: '#F9DE4B',
    pink: '#EB4870',
    ink: '#1E0B45',      // deep purple, for text
    light: '#F6F2FD',    // light background
    coral: '#F09066',    // extras
    blue: '#3E88F7',
    teal: '#6BE0CF'
  },

  // ---- Logo (small white logo, shown on the purple header) ----
  logoUrl: '/img/fruitbowl-logo-white.png',
  logoAlt: 'Fruitbowl',

  // ---- Rules ----
  stampsForReward: 6,
  stampsForDraw: 10,
  prizeUseDays: 7,

  // ---- Shops (made up). PIN is the number four times. ----
  shops: [
    { id: 'espresso', name: 'Main St Espresso',        type: 'Cafe',        pin: '1111' },
    { id: 'lantern',  name: 'Lantern Thai',            type: 'Restaurant',  pin: '2222' },
    { id: 'drover',   name: 'The Drover Bar',          type: 'Bar',         pin: '3333' },
    { id: 'gelato',   name: 'Gelato Lane',             type: 'Dessert',     pin: '4444' },
    { id: 'books',    name: 'The Corner Bookshop',     type: 'Bookshop',    pin: '5555' },
    { id: 'opshop',   name: 'Croydon Op Shop',         type: 'Op shop',     pin: '6666' },
    { id: 'optom',    name: 'Clear View Optometrist',  type: 'Optometrist', pin: '7777' },
    { id: 'dental',   name: 'Smile Dental',            type: 'Dentist',     pin: '8888' }
  ],

  // ---- Campaign ideas ----
  ideas: [
    { title: 'Tinsel & Thongs: a Summer Christmas', month: 'December', blurb: 'An Aussie summer Christmas. Stamp trail, late-night Thursdays, Santa on a banana lounge.' },
    { title: 'Hot Days, Cool Street', month: 'January', blurb: 'Beat the heat. Cold drink deals, chill stops in shops, water stations.' },
    { title: 'Back to School', month: 'February', blurb: 'Shoes, books, haircuts, eye checks and lunchbox treats for families.' },
    { title: 'Love Local', month: 'February', blurb: 'Date night on Main Street. Dinner, flowers and gift bundles.' },
    { title: 'Easter Egg Hunt', month: 'April', blurb: 'Eggs hidden in shop windows. Each one you find is a stamp.' },
    { title: "Mother's Day Gift Guide", month: 'May', blurb: 'A gift guide built from Main Street shops, with pamper pop-ups.' },
    { title: 'Winter Warmers', month: 'June to August', blurb: 'Soup, hot chocolate and cosy nights. Fire pits and a lantern walk.' },
    { title: 'Croydon Halloween', month: 'October', blurb: 'Shop-to-shop trick or treat and a costume parade.' }
  ]
};
