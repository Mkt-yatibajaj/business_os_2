# Advaitum Business OS — Commercial Production Package (v3.0)

Private, zero-cost commercial ERP and Business Automation suite built with **Next.js 15**, **Supabase (Auth, Postgres, Atomic FIFO RPCs, RLS)**, and **Vercel**.

Designed specifically to monitor:
1. **Products IN & OUT**: Cumulative Units IN, Units OUT, live On-Hand Stock, FIFO landed unit cost, and chronological stock movement ledger.
2. **What You Have Earned**: Multi-channel sales (Website, Instagram/WhatsApp, Amazon, Flipkart, Meesho, Blinkit, Offline), FIFO Gross Profit, Gross Margin %, and Net Profit.
3. **What You Have Expended**: Inventory Purchases (Stock IN with freight/landed cost allocation) + Operating Expenses (Marketing/Ads, Packaging, Courier/Shipping, Rent, Salaries) + Earned vs. Expended Cash Flow statements.
4. **Business Automation**: Atomic FIFO lot consumption, automatic order numbering (`SAL-1001`, `PUR-1001`), 1-click Advaitum Starter SKU seeding, 1-click Low-Stock WhatsApp Purchase Order generator, CSV exports, and a built-in Vercel Cron keep-alive endpoint (`/api/keep-alive`) so your free Supabase database never pauses.

---

## Quick 10-Minute Zero-Cost Deployment (GitHub + Supabase + Vercel)

### Step 1: Supabase Database Setup (₹0 Free Tier)
1. Go to [supabase.com](https://supabase.com) and create a new project in the **Mumbai (`ap-south-1`)** region.
2. Open **SQL Editor → New Query**.
3. Copy and run **`supabase/FULL_DATABASE_SETUP.sql`** (this single script installs `0001_advaitum_core.sql` + `0002_operations.sql` + `0003_in_out_summary.sql` in one click).
   *(Alternatively, run the files inside `supabase/migrations/` in order: `0001`, `0002`, `0003`).*
4. *(Optional)* Run **`supabase/seed_advaitum_catalog.sql`** in the SQL Editor (or click **"Load Advaitum Starter SKUs"** inside the Products tab of the app) to pre-load Advaitum categories, suppliers, and crystal SKUs.
5. Go to **Authentication → Users → Add User**, enter your admin email and password, and check **Auto Confirm User**.
6. Go to **Authentication → Sign In / Providers** and turn **OFF** "Allow new users to sign up" so the workspace stays strictly private.
7. Open **`supabase/bootstrap-owner.sql`**, replace `YOUR-ADMIN-EMAIL@example.com` with your email, and run it in the SQL Editor to grant yourself **Owner** permissions.

### Step 2: Push to GitHub (₹0 Free Tier)
```bash
git init
git add .
git commit -m "Deploy Advaitum Business OS Commercial v3"
git branch -M main
git remote add origin https://github.com/<your-username>/advaitum-business-os.git
git push -u origin main
```

### Step 3: Deploy on Vercel (₹0 Hobby Tier)
1. Import your GitHub repository on [vercel.com](https://vercel.com/new).
2. Add the two Environment Variables from Supabase (**Project Settings → API**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Click **Deploy**. Vercel will also register the `/api/keep-alive` cron job from `vercel.json` to ping Supabase every 3 days and prevent free-tier inactivity pausing.

---

## Local Development Commands
```bash
npm install
npm run dev        # Start local server on http://localhost:3000
npm run typecheck  # Verify TypeScript types
npm run lint       # Run ESLint
npm run build      # Production build check
```
