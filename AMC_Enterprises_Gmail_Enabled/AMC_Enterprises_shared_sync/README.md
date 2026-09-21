# AMC Enterprises — high-efficiency website upgrade

This version keeps the existing AMC Enterprises design and adds:

- SEO metadata, canonical URL and structured data
- Google Maps and IndiaMART quick links
- WhatsApp cart ordering
- Product search/category catalogue experience
- Genuine-review submission + admin approval workflow
- Expanded About/Business information, FAQ and Contact/support sections
- Shared-cloud product, settings, orders and enquiries data
- Product-request workflow + admin queue
- Order tracking by order number + checkout phone
- Admin analytics and CSV order report export
- Low-stock visibility through the existing inventory status
- Customer accounts with shared order history
- Browser notifications for new orders while the admin dashboard is open
- PWA manifest, service worker and install prompt

## Before deploying

1. Run the updated `schema.sql` once in the Supabase SQL Editor. It adds `product_requests`, `reviews`, `customer_accounts`, and the `customer_account_id` link on orders.
2. Keep the existing Vercel environment variables. Recommended additional variable: `CUSTOMER_SESSION_SECRET` (a long random value). If it is absent, the customer account API falls back to `ADMIN_SESSION_SECRET`.
3. Deploy this folder to the existing Vercel project.

Automated SMS and official automated WhatsApp API messaging are intentionally not enabled because they require a third-party provider/account and may incur usage charges. The free WhatsApp ordering link and browser notifications are included.

## Gmail notification setup

This version adds Gmail API notifications using Google OAuth 2.0. The app requests only the Gmail send scope (`https://www.googleapis.com/auth/gmail.send`); it does not read the Gmail inbox.

### 1. Run the database patch
Run `gmail_patch.sql` once in the Supabase SQL Editor.

### 2. Create Google OAuth credentials
In Google Cloud Console:
1. Create/select a Google Cloud project.
2. Enable the Gmail API.
3. Configure the OAuth consent screen.
4. Add your Gmail account as a test user if the OAuth app is still in testing.
5. Create an OAuth Client ID for a Web application.
6. Add this exact redirect URI:
   `https://YOUR-AMC-DOMAIN/api/gmail-auth?action=callback`
   For the Vercel production site, use your real production hostname.

Google requires OAuth 2.0 authorization for Gmail API requests. The backend stores the refresh token encrypted in the database; the encryption key is derived from `GMAIL_TOKEN_ENCRYPTION_KEY` when supplied, otherwise from the existing admin secret.

### 3. Add Vercel environment variables
Add:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_TOKEN_ENCRYPTION_KEY` (recommended; use a long random secret)

Do not put these values in GitHub or `index.html`.

### 4. Connect Gmail in AMC Admin
Open **Admin → Site settings → Gmail email notifications → Connect Gmail**.
Authorize the Gmail account, return to AMC, enter the **Admin notification email**, select the notification types, save settings, then use **Send test email**.

### Notifications implemented
- New order → admin email
- Order Confirmed → customer email (if checkout email was provided)
- Order Packed → customer email
- Order Cancelled → customer email
- Product request → admin email
- New customer review → admin email
- Customer enquiry → admin email

The notification log prevents duplicate event emails. Email failures are logged server-side and do not block a customer's order submission.
