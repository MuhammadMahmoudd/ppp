# Your part

The code is finished and tested. Here's what only you can do, in order.

---

## 1. Put it online (Cloudflare)

Follow **[CLOUDFLARE.md](./CLOUDFLARE.md)**. In short:

```bash
cd dildar && npm install
npx wrangler login
npx wrangler d1 create dildar          # paste the id into wrangler.jsonc
npm run db:migrate
npx wrangler r2 bucket create dildar-media   # enable R2 in the dashboard first
npm run deploy                          # prints https://dildar.<you>.workers.dev
```

Then on both iPhones: open the link in Safari → **Share → Add to Home
Screen** → open it from the icon → sign up → set a backup passphrase → pair
with the 6-digit code → compare the safety code.

---

## 2. Content only you two can write

- **Level 4 (❤️‍🔥 ئاگرین) cards**: these ship empty on purpose. Games →
  Decks → new deck → *Bulk import*, one card per line, optional heat prefix:
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
  starter content is in `features/decks/starter.ts`,
  `features/spicy/ynmStarter.ts` and `features/closeness/questions.ts`.
  After editing, run `npm run deploy` again.

---

## 3. Later: the native iPhone app (optional)

The website covers almost everything. The App Store/TestFlight build adds
Face ID lock, screenshot detection, push notifications, video recording and
the app-switcher blur. It uses the same code and the same Cloudflare backend.

1. Enroll in the **Apple Developer Program** (paid yearly).
2. `npx eas-cli@latest login` and `npx eas-cli@latest init`.
3. Store your Worker address for the builds:
   ```bash
   for env in development preview production; do
     npx eas-cli@latest env:create --environment $env --name EXPO_PUBLIC_API_URL \
       --value "https://dildar.<you>.workers.dev" --visibility plaintext
   done
   ```
   and put the project id from `eas init` into `.env` as `EAS_PROJECT_ID`.
4. Build and send to TestFlight:
   ```bash
   npx eas-cli@latest build --profile production --platform ios
   npx eas-cli@latest submit --platform ios --latest
   ```
   App Store Connect → Users and Access → invite her. Then TestFlight →
   Internal Testing → add both of you.
5. Small fixes reach both phones without a new build:
   `npx eas-cli@latest update --channel production --message "fix: …"`.

Your accounts and pairing carry over. On the new app, enter your backup
passphrase on the key step to keep reading your history.

---

## 4. Not included yet

- **Lovense**: needs your own Lovense developer account/token and their
  official SDK. Add it behind Spicy Mode when you want it.
- **Home-screen widget** (streak, countdown, latest miss-you): needs the
  native build plus a widget extension.

---

## Things to know

- This repo's root has a GitHub Pages workflow that publishes the **whole
  repository** when you push to `main`. There are no secrets in it, but if
  you'd rather not publish the source, delete `.github/workflows/static.yml`.
- On the web, your encryption key lives in that home-screen app's storage.
  Deleting the icon or clearing website data removes it; your backup
  passphrase restores it.
