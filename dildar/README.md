# دڵدار · Dildar

A private, two-person iPhone app for a long-distance couple: snaps with
streaks, a fast end-to-end-encrypted chat, live synced games, an adults-only
Spicy side (both must opt in), a vault, and small "feel close" features.
Sorani Kurdish first (RTL), English optional.

> **Put it online:** [`CLOUDFLARE.md`](./CLOUDFLARE.md) (about 15 minutes, free tier).
> **Your part** (accounts, content, later the native iPhone build):
> [`SETUP.md`](./SETUP.md). **Two-phone test checklist:** [`TESTING.md`](./TESTING.md).

## Stack

| Layer | Choice |
|---|---|
| App | Expo SDK 58, React Native 0.88, TypeScript (strict), expo-router. Runs as a **website** (react-native-web) today and as a native iPhone app later from the same code |
| Animation / gestures | react-native-reanimated 4 + react-native-worklets, react-native-gesture-handler 3 |
| Backend | **Cloudflare**: one Worker (API + website), D1 (database), R2 (encrypted media), Durable Objects (live sync), Cron Triggers |
| Encryption | tweetnacl (+ tweetnacl-util): Curve25519 + XSalsa20-Poly1305, PBKDF2-HMAC-SHA512 key backup |
| Device | expo-camera, expo-image-picker, expo-image, expo-audio, expo-video, expo-haptics, expo-local-authentication, expo-secure-store, expo-screen-capture, expo-notifications, expo-sensors |
| Lists / keyboard | @shopify/flash-list 2, react-native-keyboard-controller |

Changes from the brief, and why:
- **Cloudflare instead of Supabase** (your choice). The access rules that were
  Postgres row-level security now live in the Worker (`server/src/tables.ts`)
  and are tested against the real Cloudflare runtime.
- **Email + password sign-in only.** Sign in with Apple needs a native build
  and an Apple Developer account.
- **expo-av → expo-audio / expo-video**: expo-av no longer ships with SDK 58.
- **MMKV not used**: AsyncStorage + an in-memory cache were fast enough.

## Folder structure

```
dildar/
├─ app/                      routes (expo-router)
│  ├─ _layout.tsx            providers, fonts, RTL, stage router, app lock, global overlays
│  ├─ (auth)/welcome.tsx     email sign-up / sign-in
│  ├─ setup/                 keys → pair (6-digit code, 18+) → profile
│  └─ (main)/                home pager, settings, chat/, snap/, games/, decks/,
│                            spicy/, vault/, closeness/, streak
├─ components/               Txt, Button, Glass, Screen, Input, States (skeleton/empty/error/offline), …
├─ features/                 one folder per feature (chat, snaps, streaks, games, decks,
│                            spicy, vault, closeness, lock, security, profile, home)
├─ lib/                      api (Worker client), realtime, crypto, keys, session, media,
│                            messages, push, offlineQueue, i18n, haptics, time, streak, match, theme
├─ i18n/                     ckb.ts (Sorani, primary) · en.ts · sections/<feature>.ts
├─ server/                   Cloudflare Worker
│  ├─ src/                   index (router), auth, tables (access rules), db, rpc,
│  │                         storage (R2), room (Durable Object), cron, push, functions
│  ├─ migrations/            D1 schema
│  └─ test/                  backend tests on the real Workers runtime (Miniflare)
├─ public/                   web template, home-screen icons, manifest, security headers
├─ e2e/                      two-browser end-to-end test on `wrangler dev`
├─ wrangler.jsonc            Cloudflare config
└─ __tests__/                unit tests (crypto, streak/time zones/DST, match, features)
```

## Commands

```bash
npm install
npm run test:all       # typecheck app + server, unit tests, backend tests
npm run test:e2e       # build site, run on Cloudflare's local runtime, two browsers pair/chat/play/snap
npm run dev:api        # local Worker on :8787 (serves dist/ + API)
npm run deploy         # build the website and deploy to Cloudflare
```

## Security model (short)

- **Only two people, ever.** The deployment accepts at most 2 accounts
  (`MAX_USERS`). A database trigger rejects a third member of a couple.
  Pairing is a 6-digit, 15-minute, single-use code with 10 attempts/hour/user;
  after pairing every code is voided.
- **E2E encryption.** Each device makes a box keypair (secret key in the
  Keychain on iPhone, in site storage on the web; public key in `profiles`).
  Both partners derive the same shared key and seal everything with it:
  messages, snaps and their doodles/text, voice notes, vault, avatars, card
  text, game state (also over the live socket), letters, plans and daily
  answers. D1 and R2 only ever hold ciphertext + nonce. A safety code
  (Settings › Security) lets you compare keys on a call.
- **Key backup.** Optional: passphrase → PBKDF2-HMAC-SHA512 (120k iterations)
  → sealed secret key. Lose both device and passphrase = history gone (by design).
- **Access rules on every table** (`server/src/tables.ts`): couple-scoped;
  private answers (Yes/No/Maybe, body map, fantasies, secret decks, scheduled
  surprises, locked letters/plans, unanswered daily question) are unreadable by
  the partner and only compared by server functions that return overlaps.
  Only listed tables/columns are reachable and values are always bound
  parameters. Covered by `npm run test:server`.
- **Accounts.** Passwords use PBKDF2-SHA256 (100k iterations, per-user salt).
  Session tokens are random and stored only as SHA-256 hashes. Sign-in is
  rate-limited.
- **Live sync** never carries private data: change notices only say "row X
  changed" and each phone re-fetches it through the access rules.
- **Web hardening:** strict Content-Security-Policy, no framing, no referrer,
  noindex.
- **Native iPhone build** adds Face ID / passcode lock, app-switcher blur,
  shake-to-hide, screenshot detection and recording block, and discreet push.
  The quick-hide calculator works on the web too. No analytics or trackers.
- What the server *can* see: who sent something and when, message types,
  sizes, streak counters, and your Yes/No/Maybe + body-map answers (needed for
  matching; still hidden from your partner).
