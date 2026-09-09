# AMC Enterprises — shared multi-device website

This version keeps the existing UI but moves products/stock, site settings, orders and enquiries to Supabase. Admin changes are therefore shared across laptop and phone instead of being trapped in browser localStorage.

## Setup
1. Create a Supabase project.
2. Open SQL Editor and run `schema.sql`.
3. In Supabase Settings → API Keys, copy the Project URL and a **Secret key**. Never put the secret key in frontend code.
4. Deploy this folder to Vercel.
5. In Vercel → Project → Settings → Environment Variables, add:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`
6. Redeploy after adding variables.
7. Open the live site. Use the admin password from `ADMIN_PASSWORD`.

The browser calls `/api/products`, `/api/settings`, `/api/orders` and `/api/enquiries`. The server talks to Supabase with the secret key. Product/settings are refreshed every few seconds so a change made on one device appears on the others without editing GitHub.

Do not commit `.env` or secret keys to GitHub.
