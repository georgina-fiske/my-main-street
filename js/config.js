// One file for what changes when you set this site up for a new brand or domain.
// Each area's own look (logo, colours, heading) lives in the database, set on the Client page.

window.CONFIG = {
  // ---- Supabase (public values only; safe to be in the front end) ----
  supabase: {
    url: 'https://zrhjvrcshvvekafocnlr.supabase.co',
    anonKey: 'sb_publishable_wiCLPXeOi9XRP2X70tR8CQ_LVuMEkfM'
  },

  // ---- Names ----
  siteName: 'My Main Street',               // always the same for every area
  domain: 'mymainstreet.com.au',            // placeholder until the real domain is bought
  runBy: 'Chaos Master',
  homeCompany: 'Fruitbowl Events',
  demoHomeArea: 'croydon',                  // the area the guided demo uses

  // ---- Colours (Fruitbowl). Each area picks its own on the Client page. ----
  colors: {
    purple: '#560CC9', yellow: '#F9DE4B', pink: '#EB4870', ink: '#1E0B45', light: '#F6F2FD'
  },

  // ---- Rules ----
  stampsForReward: 6,
  stampsForDraw: 10,
  allCouncils: ['Maroondah', 'Knox', 'Monash'],

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
