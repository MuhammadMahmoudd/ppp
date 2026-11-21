# دڵدار · Dildar

A private, two-person iPhone app for a long-distance couple: snaps with
streaks, a fast end-to-end-encrypted chat, live synced games, an adults-only
Spicy side (both must opt in), a vault, and small "feel close" features.
Sorani Kurdish first (RTL), English optional.

> **Start here:** [`SETUP.md`](./SETUP.md) is the step-by-step list of what
> *you* need to create (Supabase, Apple, EAS) to get it on both iPhones.
> [`TESTING.md`](./TESTING.md) is the two-phone test checklist per phase.

## Stack

| Layer | Choice |
|---|---|
| App | Expo SDK 58, React Native 0.88, TypeScript (strict), expo-router |
| Animation / gestures | react-native-reanimated 4 + react-native-worklets, react-native-gesture-handler 3 |
| Backend | Supabase: Postgres + RLS, Auth, Realtime (private channels), Storage, Edge Functions, pg_cron |
| Encryption | tweetnacl (+ tweetnacl-util): Curve25519 + XSalsa20-Poly1305, PBKDF2-HMAC-SHA512 key backup |
| Device | expo-camera, expo-image-picker, expo-image, **expo-audio + expo-video** (expo-av was removed from the SDK), expo-haptics, expo-local-authentication, expo-secure-store, expo-screen-capture, expo-notifications, expo-sensors |
| Lists / keyboard | @shopify/flash-list 2, react-native-keyboard-controller |
| Builds | EAS Build → TestFlight (internal), EAS Update |

Changes from the brief, and why:
- **expo-av → expo-audio / expo-video**: expo-av no longer ships with SDK 58.
- **MMKV not used**: AsyncStorage + an in-memory LRU were fast enough.
- **Session tokens** are stored encrypted (key in the iOS Keychain, blob in
  AsyncStorage), because SecureStore items are size-limited.

## Folder structure

```
dildar/
├─ app/                      routes (expo-router)
│  ├─ _layout.tsx            providers, fonts, RTL, stage router, app lock
│  ├─ (auth)/welcome.tsx     email + Sign in with Apple
│  ├─ setup/                 keys → pair (6-digit code, 18+) → profile
│  └─ (main)/                home pager, settings, snap/, games/, decks/,
│                            spicy/, vault/, closeness/, streak
├─ components/               Txt, Button, Glass, Screen, Input, States (skeleton/empty/error/offline), …
├─ features/                 one folder per feature (chat, snaps, streaks, games, decks,
│                            spicy, vault, closeness, lock, security, profile, home)
├─ lib/                      crypto, keys, supabase, session, realtime, media, messages,
│                            push, offlineQueue, i18n, haptics, time, streak, match, theme
├─ i18n/                     ckb.ts (Sorani, primary) · en.ts · sections/<feature>.ts
├─ locales/                  iOS permission strings (ckb + en)
├─ supabase/
│  ├─ migrations/            schema + RLS + functions + storage + realtime + cron
│  ├─ functions/             snap_opened, send_push, purge_expired, deliver_scheduled, streak_check
│  └─ tests/                 PGlite (real Postgres in-process) RLS/schema tests
└─ __tests__/                unit tests (crypto, streak/time zones/DST, match, features)
```

## Commands

```bash
npm install
npm run typecheck      # tsc --noEmit
npm test               # jest unit tests
npm run test:db        # runs every migration in PGlite and tests RLS/pairing/streaks/matches
npx expo start --dev-client
```

## Security model (short)

- **Only two people, ever.** `couple_members` has a trigger that rejects a
  third row (row-locked, so two joins can't race). Pairing is a 6-digit,
  15-minute, single-use code with 10 attempts/hour/user. After pairing, every
  code for that couple is voided.
- **E2E encryption.** Each phone makes a box keypair (secret key in the
  Keychain, public key in `profiles`). Both partners derive the same shared key
  (`nacl.box.before`) and seal everything with it: messages, snaps + their
  doodles/text, voice notes, vault, avatars, card text, game state, letters,
  plans, daily answers. Postgres/Storage only ever hold ciphertext + nonce.
  A safety code (Settings › Security) lets you compare keys on a call.
- **Key backup.** Optional, passphrase → PBKDF2-HMAC-SHA512 (120k iterations)
  → sealed secret key in `key_backups`. Lose both phone and passphrase =
  history gone (by design).
- **RLS on every table.** Couple-scoped; private answers (Yes/No/Maybe, body
  map, fantasies, secret decks, scheduled surprises, locked letters/plans,
  unanswered daily question) are unreadable by the partner and only compared
  by `SECURITY DEFINER` functions that return overlaps. Internal functions
  are revoked from clients. Covered by `npm run test:db`.
- **Device.** Face ID / passcode on open and after 60 s in background, blur in
  the app switcher, quick-hide (shake / hold the logo → working calculator,
  type `2580=` to return), screenshot detection + screen-recording block on
  snap viewer / vault / spicy, discreet push ("دڵدار — شتێکی نوێ").
  No analytics or trackers.
- What the server *can* see: who sent something and when, message types,
  sizes, streak counters, and your Yes/No/Maybe + body-map answers (needed for
  server-side matching; still hidden from your partner by RLS).
