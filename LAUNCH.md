# Going live with real customers

The site has two modes. Right now it is in **demo mode** (`mode: 'local'` in `js/config.js`): everything runs in the visitor's own browser. Follow these steps to switch the real sign-up form on. The guided demo at `/demo` keeps working as a private demo even after you go live.

What changes when it is live:

- The customer form (`/croydon`) saves real sign-ups in your Supabase database.
- Customers can only see **their own** coupon. Nobody can list other customers.
- The prize desk, Client page, Fruitbowl HQ and the reports need a **staff login** (a link sent to your email, no password).
- Shops use their 4-digit PIN, checked by the database.
- When staff tap a prize, the customer is **emailed** their coupon (through Resend).
- No "Demo" wording, no Reset button.

## A. Accounts (start today)

1. **Domain.** Buy it (Netlify: Domains, Add a domain; or any registrar). A `.com.au` needs an ABN. Tell Claude the name.
2. **Supabase.** Check the region is Sydney (Project Settings, General). Upgrade to the Pro plan, so the project doesn't pause and has daily backups.
3. **Resend** (resend.com). Sign up, then **Domains, Add domain**. Resend shows some DNS records. Add them where the domain's DNS lives (in Netlify: Domains, your domain, DNS records). Wait until Resend says **Verified**. Then **API Keys, Create** with "Sending access" and copy it.

## B. Set up the database (about 5 minutes)

1. Supabase, **SQL Editor**, **+ New query**. Paste all of `sql/live/01_schema.sql` and press **Run**. It should finish with no red error. (This is for real data. It wipes the project's tables, so only run it before real sign-ups start. It also switches off the demo's nightly reset, so real data is never reset.)
2. New query. Open `sql/live/02_first_staff.sql`, change the email to the one you will log in with, paste it and press **Run**.

## C. Let people log in

Supabase, **Authentication**:

1. **URL Configuration.** Site URL: `https://YOUR-DOMAIN`. Under Redirect URLs add `https://YOUR-DOMAIN/login` (and your `...netlify.app/login` while testing).
2. **Emails, SMTP Settings.** Switch on custom SMTP. This matters: Supabase's built-in email sender only allows a handful of emails an hour, so staff login links would stop arriving.
   - Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key.
   - Sender email `login@YOUR-DOMAIN`, sender name `My Main Street`.

## D. Netlify settings

1. **Domain management.** Add your custom domain. Netlify sets up HTTPS by itself.
2. **Site configuration, Environment variables.** Add these four. Never paste them into chat or the code.

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | the secret key: Supabase, Project Settings, API, `service_role` |
   | `RESEND_API_KEY` | the key from step A3 |
   | `SITE_ORIGIN` | `https://YOUR-DOMAIN` |

3. **Deploys, Trigger deploy, Deploy site.** The email sender only sees new settings after a fresh deploy.

## E. Switch it on

Tell Claude the domain. Claude changes `mode: 'local'` to `mode: 'live'` and sets `domain` in `js/config.js`, and pushes.

## F. Set up your first street (about 20 minutes)

1. Go to `https://YOUR-DOMAIN/login`, enter your email, open the link. You land on Fruitbowl HQ.
2. **Areas, Activate a new area.** Name it (for example Croydon Main Street Association). The web address comes from the first word, so `/croydon`. Then **Fill it in for them**.
3. Follow the four steps: about you, look (logo, colours, heading), shops and prizes, check.
   - In **Look**, set "Sent from" to `croydon@YOUR-DOMAIN` (a real address on your verified domain) and "Replies go to" to the client's own email.
   - Coupons are **value over $0**. A **gift** is value $0 and is handed over at the desk.
   - Each shop gets an invite link. Send it to them. They open it and choose their PIN.
4. In **Client, Overview**, set the event date and "Coupons must be used by".
5. Back in **HQ, Areas**, press **Launch**.
6. **HQ, Staff.** Add the desk staff (role Desk) and the client's contact (role Client) by email.
7. **Client, Overview.** Open the A3 poster and the counter stickers and print them ("Save as PDF" works too).
8. Fill in the yellow placeholders on `/safety` and get it checked by a lawyer.

## G. Dry run before the festival

1. Phone: scan the poster QR code, fill out the form with your own email.
2. Laptop: log in at `/desk`, scan or pick yourself, tap a prize. Your phone should show the win within a few seconds and an email should arrive.
3. Shop: `/shop`, enter a shop PIN, type your code, **Use it now**. Try the same code again. It should say it's already used.
4. Reports: Client, Reports, **Download spreadsheet**.

## What is not included yet

- **Text messages.** Customers who choose "Text message" are told on the desk screen that texts aren't on yet, and their phone screen shows the coupon. Adding texts needs an Australian SMS account.
- **Apple and Google Wallet passes.** The Wallet page says "coming soon" on the live site.
- **Real inboxes** for the privacy and contact addresses on `/safety`.

## If something doesn't work

- **Staff can't log in:** check Authentication, URL Configuration, and that custom SMTP is on.
- **Email doesn't send:** Netlify, Functions, `send-coupon`, Logs. Common causes: the domain isn't verified in Resend, or an environment variable is missing (then redeploy). The coupon always still shows on the customer's phone.
- **The desk says "Please log in":** the login expired. Log in again.
