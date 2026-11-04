# Going live: Maroondah Festival, Sunday 8 Nov 2026

Do these in order. Each step is small. Tell Claude when a step is done.

The site is in **demo mode** until step 12. Nothing real happens before then.

## What you need (accounts)

| What | Why | Cost |
|---|---|---|
| Supabase **Pro**, project in **Sydney** | the shared database | about US$25 a month |
| Netlify **Pro** (you have it) | the website and the send-message functions | already paid |
| Resend | sends the emails | free to start |
| ClickSend (recommended) | sends the texts | pay as you go, about 5 to 8 cents a text |
| Domain `my-mainstreet.com.au` | the web address | you have it |

## Steps

### 1. Check Supabase is in Sydney
Supabase > Project Settings > General. Region must say Sydney (ap-southeast-2). Mumbai (ap-south-1) is wrong: make a new project in Sydney and send Claude the new URL and publishable key. Do this before step 2.

### 2. Run the database file
Supabase > SQL Editor > New query. Paste all of `sql/live/01_schema.sql`. Press Run. You should see `Success`.
Warning: running it again wipes everything. Only run it before real sign-ups start.

### 3. Make yourself Chaos Master
Open `sql/live/02_first_staff.sql`. Change the email to yours (lowercase). Paste it in a new query. Run.

### 4. Load Croydon
Open `sql/live/03_croydon.sql`. Replace the example shop with the real shop list, one line per shop. Paste and Run. You can also add and change shops later in Admin.

### 4b. Croydon's look and the lock-down
Run these two, each in its own **new query** (they don't wipe anything):
- `sql/live/04_croydon_look.sql` gives Croydon its logo and the Maroondah City Council colours (blue and amber, with green and orange on the prize buttons). Run it again now if you ran the older version.
- `sql/live/05_lockdown.sql` hides the budget limit from the public.
- `sql/live/06_offline.sql` lets a phone with no signal save a sign-up and send it later, and flags a possible duplicate.

### 5. Make your login
Supabase > Authentication > Users > Add user > Create new user. Use your email and a strong password. Tick **Auto Confirm User**.

### 6. Tell Supabase the web addresses
Authentication > URL Configuration.
- Site URL: `https://my-mainstreet.com.au`
- Redirect URLs, add: `https://my-mainstreet.com.au/**` and `https://croydon.my-mainstreet.com.au/**`

### 7. Point the domain at Netlify
Netlify > Domain management. Add `my-mainstreet.com.au` and add `croydon.my-mainstreet.com.au` as a domain alias. Follow Netlify's DNS steps at your domain host. Wait for the green padlock (HTTPS).
If you buy `mymainstreet.com.au` too, add it as an alias and set it to redirect to the main address.

### 8. Email (Resend)
Resend > Domains > add `my-mainstreet.com.au`. Add the DNS records Resend shows you. Wait until it says Verified. Make an API key.
Also in Supabase > Authentication > SMTP Settings, use Resend's SMTP details so staff invite emails send from your domain.

### 9. Texts (ClickSend)
Make a ClickSend account. Top up a little. Get your username and API key. Choose a sender name if you want one.

### 10. Netlify settings
Netlify > Site configuration > Environment variables. Add:

| Name | Value |
|---|---|
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key (never share it, never put it in the code) |
| `SITE_ORIGIN` | `https://my-mainstreet.com.au` |
| `BASE_DOMAIN` | `my-mainstreet.com.au` |
| `RESEND_API_KEY` | from Resend |
| `SMS_PROVIDER` | `clicksend` |
| `SMS_USERNAME` | your ClickSend username |
| `SMS_API_KEY` | your ClickSend API key |
| `SMS_FROM` | the sender name (optional) |

Then Deploys > Trigger deploy > Deploy site.

### 11. Fill in /safety
Send Claude your full name, ABN, privacy contact address and email. Claude puts them in. The page is marked `[to be checked by a lawyer]` until a lawyer has read it.

### 12. Flip the switch
Tell Claude "go live". Claude sets `mode: 'live'` in `js/config.js` and pushes. Wait for the deploy.

### 13. Test it properly
1. Go to `https://croydon.my-mainstreet.com.au/` on your phone. Sign up with your own email and mobile.
2. Log in at `https://croydon.my-mainstreet.com.au/desk` (invite a desk login first: Admin > People > Invite someone). Find your number, tap a prize.
3. Check your email or text arrives and the link opens your coupon.
4. Open the shop one-pager link (`/shop/claim`), set up one shop, check the coupon, use it.
5. In Admin, open Overview and download the spreadsheet.
6. Fix anything odd, then open sign-ups in Admin > Overview > Open sign-ups.

### 14. Print
Admin > Overview has two QR codes. Download the PNG for the marquee poster (sign-up) and the shop one-pager (shop set-up).

## If the internet drops (offline mode)
- **Open each iPad's desk page once with Wi-Fi first** (a few minutes before the doors open), and log in. That saves the page and the customer list on the iPad. After that it keeps working with no signal.
- **Customers' phones:** if their signal drops after the page has opened, sign-up still works. They see their number and "Saved — will sync". It sends itself when they get signal.
- **Prize desk taps:** each tap shows at once and is kept on the iPad. A bar says "Saved — will sync". It sends itself when the signal returns, even after a refresh or restart.
- **Two limits, on purpose:**
  - The same person on two offline phones can sign up twice. When both reconnect, the second is flagged "Possible duplicate" (in Admin and on the desk). A person decides. Nothing is merged for you.
  - If both iPads are offline together, each counts its own prizes and budget. They agree again when either reconnects. A prize or the budget can be slightly over-given.
- **A tap the system refuses** (for example, another iPad already gave that person a prize) shows a red box on the desk, "These did not save", until someone taps "Got it".
- **A customer who signed up offline can't be found on the desk** until their phone has sent the sign-up. Ask them to wait a minute for signal, or use the paper log.
- **The paper backup log is still the last resort** for a long, total outage. It needs no battery and no signal.

## On the day
- Two iPads at `https://croydon.my-mainstreet.com.au/desk`, each logged in with its own desk login.
- Watch the budget bar. It turns orange near $4,500 and the desk stops coupons at $5,000.
- Wrong tap? Undo is on screen for 10 seconds.
- Red bar at the top means the internet dropped. Taps are kept and retry on their own.

## After the festival
- Retire the demo: point council, Fruitbowl and shops at the live site, then archive the demo.
- Vendor pack (letter, branded poster, shop materials) once the real Croydon logo and Figma file are in.

## Not built yet (after Sunday)
Paying shops back, the branded asset maker, the Chaos Master overview across all streets, switching the text sender name to `CroydonMS`, reminder messages.
