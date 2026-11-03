// One file for what changes when you set this site up for a new brand or domain.
// Each area's own look (logo, colours, heading) lives in the database, set on the Client page.

window.CONFIG = {
  // ---- Where the data lives ----
  // 'local' = the whole site is a demo that runs in the visitor's own browser (nothing to set up).
  // 'live'  = real customers. The site uses the Supabase database (run sql/live/01_schema.sql first).
  //           Pages under /demo still run as a private demo in the visitor's browser.
  mode: 'local',

  // ---- Supabase (public values only; safe to be in the front end) ----
  supabase: {
    url: 'https://ublipzmopexbrjdjnezp.supabase.co',
    anonKey: 'sb_publishable_Ofz2teKTrBwgXmrJLdwUDA_pu2N4zIX'
  },

  // ---- Names ----
  siteName: 'My Main Street',               // always the same for every area
  domain: 'my-mainstreet.com.au',           // the main address (admin, safety, demo)
  baseDomain: 'my-mainstreet.com.au',       // each area lives at [area].my-mainstreet.com.au
  runBy: 'Chaos Master',
  homeCompany: 'Fruitbowl Events',
  demoHomeArea: 'croydon',                  // the area the guided demo uses

  // ---- Colours: the My Main Street platform brand (Figma). Each area adds its own look in Admin > Look. ----
  colors: {
    indigo: '#23003F', yellow: '#FFFDB4', red: '#F94500', lilac: '#BCACCE', ink: '#23003F', light: '#F7F4FA'
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
