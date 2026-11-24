# Testing Dildar on two iPhones

Automated checks (run before every deploy):

```bash
npm run test:all    # typecheck app + server · 96 unit tests · 16 backend tests on the real Workers runtime
npm run test:e2e    # two browsers on `wrangler dev`: sign-up, keys, pairing, profiles,
                    # chat both ways + seen, game invite + synced cards, view-once snap
```

Items marked *(iPhone app)* only apply to the native build. The website
can't do them; see CLOUDFLARE.md › Good to know.

Below, **A** = you, **B** = her. Tick each box on real phones (dev build or TestFlight).
Everything should feel instant; anything laggy is a bug.

## Phase 1: Foundation
- [ ] A and B sign up; each sets a key-backup passphrase.
- [ ] A ticks 18+ → creates a code; B ticks 18+ → enters it → both land on the profile step, then the camera.
- [ ] Try the same code on a third account → refused. A can't create a new code anymore.
- [ ] Both profiles visible (Settings shows both avatars + names; avatar upload works).
- [ ] Settings › Security › Safety code is identical on both phones.
- [ ] *(iPhone app)* Kill the app, reopen → Face ID. Background it for 60+ s → Face ID again. Under 60 s → no prompt.
- [ ] *(iPhone app)* App switcher shows a blurred card.
- [ ] Hold the heart logo (iPhone app: or shake) → calculator. Type `2580=` → back (iPhone app: after Face ID).
- [ ] Settings › Language › English → app reloads left-to-right; back to Kurdish → right-to-left.

## Phase 2: Chat
- [ ] Messages arrive instantly both ways; "دەنووسێت…" shows while typing; "بینرا" under your last seen message.
- [ ] Airplane mode on A, send 3 messages (they show "sending"), airplane off → all 3 arrive, in order, once.
- [ ] Swipe a bubble to reply; double-tap → ❤️; long-press → reaction picker / copy / delete (delete removes it on B too).
- [ ] Photo, video and voice note (hold to record, slide to cancel) both ways.
- [ ] Disappearing "after viewing": message is gone ~1 min after B sees it. "24h" mode shows the timer icon.
- [ ] *(iPhone app)* Close the app on B, send from A → B gets "دڵدار — شتێکی نوێ" (no content in the notification).

## Phase 3: Snaps + streaks
- [ ] Camera: flip, take a photo. *(iPhone app)* flash, tap to focus, pinch zoom, hold for video (stops at 30 s).
- [ ] Draw + Kurdish text + filter + 5 s timer → send. B sees the snap stack, opens it, it closes after 5 s, and can't be opened again.
- [ ] Spicy blur: B must hold to reveal. Hold-to-keep pauses the timer.
- [ ] *(iPhone app)* Screenshot in the snap viewer → "📸" card in A's chat.
- [ ] "Allow save" snap → B can save to vault; without it the button is hidden.
- [ ] Both send a snap the same day (home time zone) → 🔥 1. Next day both again → 🔥 2.
- [ ] Use a streak freeze after skipping exactly one day.

## Phase 4: Live games
- [ ] A starts Truth or Dare → B gets an in-app banner (or a push if closed) → Join. Card flips show on both phones within ~0.3 s.
- [ ] Dice: same roll on both phones. Edit dice faces in Decks.
- [ ] Would You Rather: both pick secretly → simultaneous reveal.
- [ ] Know-me: A writes questions, B answers, score shows.
- [ ] With Spicy on for both: Strip, Role-play, Tease timer appear and stay synced.
- [ ] Dare with snap proof → B completes it from the dare card → dare shows "done".
- [ ] Dare queue: send a dare with a deadline; countdown shows in chat.
- [ ] Decks: bulk import `3| …` lines; new deck is invisible to B until shared.

## Phase 5: Spicy hub
- [ ] Only A turns Spicy on → hub stays locked for both. B turns it on → unlocked (Face ID on entry).
- [ ] Yes/No/Maybe: different answers → only yes+yes / yes+maybe show in Matches.
- [ ] Body map overlaps only; fantasy box shows locked teaser until "interested".
- [ ] "Tonight?" → B gets a soft glow → 👍 → A sees the answer.

## Phase 6: Vault
- [ ] Set a vault PIN (Settings › Security). Vault asks Face ID + PIN.
- [ ] Thumbnails blurred until long-press; albums; voice note.
- [ ] Turn on "deleting needs both of us" → A requests delete → B confirms → gone.

## Phase 7–8: Closeness
- [ ] Touch canvas: B feels the same pattern + ripple. With B's app closed → card + push.
- [ ] Miss-you → hearts float on B; counters match.
- [ ] Countdown set 3 min ahead; both add plan items; at zero each sees the other's.
- [ ] Tease scheduler "tonight 9pm" is shown in B's time zone and arrives then.
- [ ] Open-when letter + dated letter (locked until its time).
- [ ] Daily question: same question on both phones; answer reveals after both answer.
- [ ] Sleep mode on both → "together", heartbeats in sync, screen stays on.
- [ ] Bucket list / coupon (redeem) / memory added on one phone appears on the other.
