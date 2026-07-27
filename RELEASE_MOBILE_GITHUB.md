# Release Guide: Mobile + GitHub

This project is ready to ship as a mobile-friendly web app.

## 1) Final local verification

From frontend:

- npm ci
- npm run build

Build already passes in current workspace.

## 2) Mobile readiness checklist

Current app already includes:

- Responsive viewport in [frontend/public/index.html](frontend/public/index.html)
- Mobile-first UI patterns in pages and components
- Supabase auth/session persistence for mobile browser usage

Quick manual checks before each release:

- Open Chrome DevTools device toolbar (iPhone 14 Pro, Pixel 7)
- Verify login page, today timeline, food library, and history detail pages
- Verify admin public-food actions on small screens

## 3) Production deploy (recommended: Vercel)

1. Push this branch to GitHub.
2. In Vercel, import repository: Finn-623/First-Project-Calendar.
3. Set Root Directory to frontend.
4. Framework preset: Create React App.
5. Confirm Install Command is `npm ci`, Build Command is `npm run build`, and Output Directory is `build`.
6. Add environment variables:
   - REACT_APP_SUPABASE_URL
   - REACT_APP_SUPABASE_ANON_KEY
7. Deploy.

After first deploy, use the production URL on your phone directly.

## 4) Database migration sync (already applied on linked project)

Linked remote project has migrations 001-010 applied.
If you deploy to another Supabase project, run:

- npx supabase db push --linked --yes

## 5) GitHub release flow

Use these commands from project root:

- git add .
- git commit -m "release: admin public food management and RLS fixes"
- git push origin supabase-v1

Then open a Pull Request from supabase-v1 to main.

## 6) Optional: make it installable (PWA)

If you want home-screen install and offline shell next step, add:

- web app manifest customization
- service worker registration
- app icons

Current release is mobile-browser ready even without PWA install.
