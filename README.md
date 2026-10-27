# My Main Street: demo site

A click-through demo for councils, street associations and vendors. Shops and prizes are made up. No logins.

Plain HTML, CSS and JS. No build step. Data lives in Supabase. Hosting is Netlify.

## Set up (you do this once)

1. **Supabase**
   - Make a free project at supabase.com.
   - Open **SQL Editor**. Paste all of `sql/01_schema.sql` and press Run.
   - Paste `sql/02_nightly_reset.sql` and press Run. This resets the demo every night. If it complains about `pg_cron`, turn it on under **Database > Extensions**, then run it again.
   - Open **Project Settings > API**. Copy the **Project URL** and the **anon public** key.
2. **Keys**
   - Open `js/config.js`. Paste the URL and the anon key into the `supabase` block. (These two are safe to be public. Never paste the `service_role` key.)
3. **Netlify**
   - Add a new site from this GitHub repo. No build command. Publish directory: `.`
   - Netlify gives you the public link. `netlify.toml` already handles `/tap/<shop-id>`.
4. **Realtime**
   - `01_schema.sql` turns it on for the demo tables. If screens don't update live, check **Database > Replication** and make sure the tables are on.

## Change the street, council, colours or shops

Everything is in `js/config.js`.

## How it is locked

The public key can only read the demo tables. All changes go through small database functions in `sql/01_schema.sql`, and each one only does what a demo screen does. Emails and postcodes sit in a table the public cannot read.

## Notes

- Camera scanning uses the phone's built-in reader where there is one. Older iPhones can read QR codes only, not barcodes. The Scanner box works with a USB or Bluetooth scanner.
- The demo-only fields `posted_by`, `collect_at`, `place` and `sort_order` stand in for `from`, `where` and `order`, which are reserved words in SQL.
