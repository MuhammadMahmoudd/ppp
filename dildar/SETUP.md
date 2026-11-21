# Your part: getting Dildar onto both iPhones

The code is done. What's left are the steps only you can do: accounts,
keys, payment and content. Do them in this order. Commands run inside
`dildar/` on any computer (no Mac needed).

---

## 0. One-time tools

```bash
cd dildar
npm install
npx eas-cli@latest login        # create a free Expo account if needed
```

---

## 1. Supabase project (≈15 min)

1. Create a project at supabase.com (pick the region closest to both of you,
   e.g. Frankfurt). Save the **database password** somewhere safe.
2. **Apply the schema.** Easiest way (CLI):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push            # runs supabase/migrations/* in order
   ```
   No CLI? Open **SQL Editor** and run the 6 files in
   `supabase/migrations/` one by one, in filename order.
   This creates every table with RLS, the 4 private Storage buckets,
   Realtime settings and the cron jobs.
3. **Cron secrets** (lets the scheduled jobs call the Edge Functions).
   Pick a long random string, e.g. from `openssl rand -hex 32`, then in
   **SQL Editor** run:
   ```sql
   select vault.create_secret('https://<your-project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<the-random-string>', 'cron_secret');
   ```
4. **Edge Functions:**
   ```bash
   npx supabase secrets set CRON_SECRET=<the-same-random-string>
   npx supabase functions deploy send_push snap_opened purge_expired deliver_scheduled streak_check
   ```
5. **Auth settings** (Dashboard → Authentication):
   - *Email*: you can turn **"Confirm email" off** to skip the confirmation
     mail (only two people will ever sign up).
   - *Sign in with Apple* (optional): enable the Apple provider and add
     `com.surchy.dildar` to **Client IDs**. No secret is needed for native
     iPhone sign-in.
   - **After both of you have created accounts and paired:** turn
     **"Allow new users to sign up" OFF**. The database already blocks a
     third person from joining your couple. This also stops strangers from
     creating accounts at all.
6. **Keys for the app:** Project Settings → API → copy the **Project URL**
   and the **anon / publishable key** (public values, safe in the app).
   Never use the `service_role` key in the app.

---

## 2. Local `.env` (for your dev build)

```bash
cp .env.example .env
# fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npx eas-cli@latest init          # creates the Expo project, prints a projectId
# put that id into .env as EAS_PROJECT_ID=...
```

EAS cloud builds don't read your `.env` (it's git-ignored), so store the
same three values as **EAS environment variables**, once per environment
(`development`, `preview`, `production`):

```bash
for env in development preview production; do
  npx eas-cli@latest env:create --environment $env --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co" --visibility plaintext
  npx eas-cli@latest env:create --environment $env --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>" --visibility plaintext
  npx eas-cli@latest env:create --environment $env --name EAS_PROJECT_ID --value "<projectId>" --visibility plaintext
done
```

---

## 3. Apple Developer Program (paid yearly)

1. Enroll at developer.apple.com/programs (individual is fine). Approval can
   take 1–2 days.
2. Nothing else to click by hand: on the first iOS build EAS asks to log in
   to your Apple account and creates the bundle id `com.surchy.dildar`,
   certificates, the push-notification key and the Sign in with Apple
   capability for you. Say **yes** when it offers.

---

## 4. Builds

### a) Development build (you, while testing each phase)
```bash
npx eas-cli@latest device:create              # register your iPhone (open the link on the phone)
npx eas-cli@latest build --profile development --platform ios
```
Install it from the link/QR, then run `npx expo start --dev-client` on your
computer (same Wi-Fi, or add `--tunnel`). Hot reload works.

### b) TestFlight (both of you)
```bash
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios --latest   # creates the App Store Connect app the first time
```
Then in **App Store Connect → Users and Access**, invite your girlfriend
(any role, e.g. *Marketing*). In **TestFlight → Internal Testing**, create a
group, add both of you, and add the build. She installs **TestFlight** from
the App Store and accepts the invite. There is no public listing and no App
Review for internal testers.

### c) Small fixes without a new build (EAS Update)
```bash
npx eas-cli@latest update --channel production --message "fix: …"
```
Both phones pick it up on the next launch. You only need a new build when
native modules or `app.config.ts` change.

---

## 5. First run (both phones)

1. Open the app. It shows sign-up/sign-in (Face ID lock starts once you are paired).
2. **Each of you** creates an account. The app makes your encryption key and
   offers a **backup passphrase**. Please set one and write it down somewhere
   offline. ⚠️ Losing both the phone *and* the passphrase means the history
   can't be recovered, by anyone.
3. **You:** tick 18+ → *I'll create the code* → read the 6 digits to her.
   **Her:** tick 18+ → *I have a code* → enter it. Done: paired forever.
4. Settings › Security › **Safety code**: compare the 30 digits on a call.
   If they match, nobody is in the middle.
5. Settings › Us: set the **home time zone** for streaks (default
   Asia/Baghdad) and the anniversary.
6. Spicy Mode stays off until **both** of you switch it on in Settings.

---

## 6. Content only you two can write

- **Level 4 (❤️‍🔥 ئاگرین) cards**: these ship empty on purpose. Games →
  Decks → new deck → *Bulk import*, one card per line, optional heat
  prefix, e.g.
  ```
  4| ...
  4| ...
  3| ...
  ```
  New decks are **secret** until you tap *Share*.
- Custom **dice faces**, **role-play** settings/characters/goals,
  **forfeits**, **"How well do you know me"** questions, the **"first night
  back"** plan, **open-when letters**.
- **Review the Sorani wording.** It's written to be natural, but you know your
  dialect best. All UI text is in `i18n/ckb.ts` and `i18n/sections/*.ts`;
  starter cards/questions are in `features/decks/starter.ts`,
  `features/spicy/ynmStarter.ts` and `features/closeness/questions.ts`.

---

## 7. Later (Phase 8)

- **Lovense**: needs your own Lovense developer account and token
  (developer.lovense.com). Integrate only through their official SDK,
  behind Spicy Mode. It isn't included yet because it needs your
  credentials and their native SDK.
- **Home-screen widget** (streak + countdown + latest miss-you): needs a
  native widget extension. Doable later with an Expo config plugin.
- Bucket list, coupon book and memory timeline are already in
  *Closeness*.

---

## Things to know

- This repo's root has a GitHub Pages workflow that publishes the **whole
  repository** when you push to `main`. The app contains no secrets, but if
  you'd rather not publish its source, delete
  `.github/workflows/static.yml` or limit it to the web project.
- Free Supabase projects pause after a week without activity. Daily use keeps
  them awake; the Pro plan never pauses.
- Push notifications only work on a real iPhone build (not a simulator) and
  after you allow them on first launch.
