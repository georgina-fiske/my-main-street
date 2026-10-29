# My Main Street: demo site

A click-through demo for councils, street associations and shops. The shops and coupons are made up. Nothing is sent to real people.

Plain HTML, CSS and JS. No build step. Data lives in Supabase. Hosting is Netlify.

## The pages

| Address | What it is |
|---|---|
| `/demo` | The guided demo: 12 steps, instructions on the left, a live phone or laptop on the right |
| `/croydon` | The festival form for an area (every area has its own address) |
| `/c/CMS-1234` | A customer's coupon page |
| `/croydon/shops` | The shops taking part |
| `/desk` | The prize desk (staff at the wheel) |
| `/shop` | The shop screen (type a shop PIN, check and use coupons) |
| `/client` | The client dashboard (shops, prizes, look, campaigns, reports) |
| `/hq` | Fruitbowl HQ (every area, campaigns, workshops, settings, reports) |
| `/join` | A council or street association signs itself up (4 steps) |
| `/shop/join/<link>` | A shop joins from its invite link |
| `/wallet` | Phase 2: the Wallet pass |
| `/poster/croydon`, `/stickers/croydon` | Printable QR poster (A3) and counter stickers |
| `/safety` | Safety and privacy |
| `/tap/espresso` | A stamp from a shop's counter QR code or sticker |

## Set up (you do this once)

1. **Supabase.** Open **SQL Editor**, press **New query**, paste all of `sql/01_schema.sql`, press **Run**. It ends with `{"ok": true}`. It wipes and reloads the demo, so it is safe to run again whenever you want a fresh start.
2. **Nightly reset.** Turn on `pg_cron` (Database > Extensions), then run `sql/02_nightly_reset.sql` once.
3. **Keys.** The Supabase project URL and the public ("anon" or "publishable") key go in `js/config.js`. Never use the `service_role` or secret key.
4. **Netlify.** Add the site from this GitHub repo. No build command. Publish directory: `.`. `netlify.toml` already sends every page address to the app.

## Change things

- Names, domain and campaign ideas: `js/config.js`.
- Each area's logo, colours, heading and street name: the **Look** tab on the client page. They are saved in the database.
- Demo data (areas, shops, prizes, campaigns, workshops, 3 customers): `reset_demo()` in `sql/01_schema.sql`. Run the file again after editing.
- Dark mode colours: top of `css/styles.css`.

## How it is locked

The public key can only read the demo tables. Every change goes through a small database function in `sql/01_schema.sql` that does only what a demo screen does and checks its input. Emails, mobiles, postcodes, full last names, shop PINs, shop invite links and contact details sit in tables the public cannot read.

Two things are open in the demo and need real logins before this goes live: the reports (they list every sign-up with email and mobile) and the staff pages.

## Notes

- Column names `posted_by`, `collect_at`, `place` and `sort_order` stand in for `from`, `where` and `order`, which are reserved words in SQL.
- The email and text are shown on screen only. Nothing is sent. The wording lives in `js/messages.js` so it can be wired to Resend and an SMS service later.
- The A3 poster and stickers open a print page. Choose "Save as PDF" to keep a file.
- Camera scanning uses the phone's built-in reader where there is one. Older iPhones read QR codes only, not barcodes. A USB or Bluetooth scanner types into the scanner box.
