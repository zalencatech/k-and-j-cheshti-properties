# K&J Cheshti Properties — Setup Guide

## 1. File structure (2 content files, rest is boilerplate)

```
k-and-j-cheshti-properties/
├── app/
│   ├── layout.tsx      ← required by Next.js App Router (renders <html>/<body>)
│   ├── globals.css     ← Tailwind + black/gold theme + print rules
│   └── page.tsx         ← THE APP: login, admin dashboard, staff dashboard,
│                            all entry forms, rent management, income, expenses,
│                            analytics, reports, settings — one file
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
└── supabase-setup.sql   ← paste into Supabase SQL Editor, run once
```

`layout.tsx` and `globals.css` are unavoidable Next.js scaffolding — `page.tsx` is
the one real application file, exactly as requested.

Supabase already has your **anon** key and URL hard-coded into `app/page.tsx`
(they are public/safe to ship — see §40 of your brief). **All access control is
enforced by RLS policies in the SQL script**, not by hiding the key.

## 2. Run the SQL

Supabase → your project → **SQL Editor** → paste the entire contents of
`supabase-setup.sql` → **Run**. It creates all tables, enums, RLS policies,
views, the audit trigger, the `receipts` storage bucket, and seeds:
- Properties, assets, commercial units (Cakes n Bakes, Gym, Shalimar shop)
- 12 Shalimar houses (6 @ 42,500, 6 @ 37,500)
- The 3 hostel room types (22,500 / 25,000 / 55,000)
- Expense + income categories
- Settings (rent_due_day=1, grace_period_days=5)

**Hostel beds are intentionally NOT seeded** — the 125-bed floor/room layout
wasn't given, so nothing is invented. Add beds from **Admin → Settings →
Hostel Setup** after logging in (each bed just needs floor/room/label/room
type — rent is inherited automatically).

## 3. Create your two users

Supabase → **Authentication → Users → Add user** (twice):
- `admin@yourdomain.com` — set a password you choose
- `staff@yourdomain.com` — set a password you choose

A trigger in the SQL script auto-creates a matching `profiles` row for each
new user with `role = 'staff'`. Promote the admin account by running once in
the SQL Editor:

```sql
update profiles set role = 'admin' where email = 'admin@yourdomain.com';
```

## 4. Local setup

```bash
npx create-next-app@14.2.5 k-and-j-cheshti-properties --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd k-and-j-cheshti-properties
```
Now delete the generated `app/page.tsx` and `app/globals.css`, and copy in the
three files provided here (`layout.tsx`, `globals.css`, `page.tsx`), plus
overwrite `package.json`, `tsconfig.json`, `next.config.ts`,
`postcss.config.mjs`, `tailwind.config.ts` with the versions provided.

```bash
npm install
npm run dev
```
Open `http://localhost:3000`, log in with the admin account, add hostel beds
in Settings, then test a rent entry, expense, and other-income entry as staff.

No `.env` file is required — the Supabase URL/anon key are already inlined in
`page.tsx` as you requested. (If you'd rather use env vars, swap the two
constants at the top of `page.tsx` for `process.env.NEXT_PUBLIC_SUPABASE_URL`
/ `NEXT_PUBLIC_SUPABASE_ANON_KEY` and set them in Vercel.)

## 5. GitHub

```bash
git init
git add .
git commit -m "K&J Cheshti Properties - initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 6. Vercel

1. vercel.com → **Add New → Project** → import your GitHub repo
2. Framework preset: **Next.js** (auto-detected)
3. No environment variables needed (see note above)
4. **Deploy**
5. Open the deployed URL, log in with the admin/staff accounts you created

## 7. First-time data setup checklist

1. Log in as admin
2. Settings → Hostel Setup → add floors/rooms/beds/room types until you reach 125 beds
3. Residential/Commercial tabs → confirm seeded units look right
4. Mark tenants against occupied units as they move in (done inline in the rent entry form — typing a tenant name creates them)
5. Record a test rent payment as staff
6. Record a test expense (try uploading a receipt)
7. Record a test "other income" entry
8. Check Analytics and Dashboard reflect the test entries
9. Check the Rent Management tab shows correct PAID/PENDING/OVERDUE/VACANT status

## 8. Testing checklist

**Auth**: admin login, staff login, wrong password, staff cannot see Analytics/Settings/Reports tabs (they don't appear in staff nav, and RLS blocks writes to protected tables regardless).

**Rent**: pay a commercial unit, pay a house, pay a hostel bed, leave one unpaid past day 6 of the month and confirm it flips to OVERDUE and triggers the dashboard alert.

**Income/Expenses**: enter both payment methods, enter every expense category once, upload a receipt and confirm admin can view it.

**Analytics/Reports**: confirm Net Profit = (Rent Received + Other Income) − Expenses; select an individual asset and confirm totals narrow correctly; use the Reports tab print button.

**Security**: confirm a staff account gets a Postgres RLS error (not data) if you try to hit an admin-only table directly via the API.

## 9. Troubleshooting

- **"new row violates row-level security policy"** — you're inserting as staff into a table staff can't write, or forgot `created_by: profile.id` on a transaction insert.
- **Blank dashboard / zero everywhere** — no transactions yet; this is correct behavior (no fake data), not a bug.
- **Login works but app hangs on loading** — the `profiles` trigger didn't fire (rare); manually insert a row: `insert into profiles (id, email, role) values ('<auth-user-uuid>', 'x@x.com', 'staff');`
- **Receipt upload fails** — check the `receipts` bucket exists (created by the SQL script) and you're logged in.
- **Vercel build fails on `lucide-react` imports** — confirm `package.json` was fully replaced, not merged.
- **Staff sees nothing in dropdowns** — categories/room types are seeded by the SQL script; re-run the `insert ... on conflict do nothing` blocks if needed.
