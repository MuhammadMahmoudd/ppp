/**
 * Pure game logic. Every action is `(state, actor, …, rng) → state`, so the
 * acting phone computes the next state (including any randomness) and ships
 * it to the other phone — both screens always show the same roll/card.
 * The whole state is E2E-encrypted before it leaves the device.
 */
import type { GameType, Heat } from '@/lib/database.types';
import { commit, verifyCommit } from '@/lib/crypto';
import type { Txt } from '@/features/decks/text';
import type { DieDef, PoolCard, WyrCard } from '@/features/decks/pools';

export type Rng = (n: number) => number;
export type Players = { a: string; b: string };
export type StateCard = { id: string; text: Txt; heat: Heat };

type Common = {
  v: 1;
  players: Players;
  scores: Record<string, number>;
  round: number;
  updatedAt: string;
};

export type TodState = Common & {
  game: 'truth_dare';
  heat: Heat;
  turn: string;
  current: { kind: 'truth' | 'dare'; card: StateCard } | null;
  used: string[];
};
export type DiceState = Common & {
  game: 'dice';
  dice: { name: Txt; faces: Txt[] }[];
  roll: { results: number[]; by: string; seq: number } | null;
};
export type WyrState = Common & {
  game: 'would_you_rather';
  heat: Heat;
  question: { id: string; a: Txt; b: Txt } | null;
  commits: Record<string, string>;
  reveals: Record<string, { pick: 'a' | 'b'; salt: string }>;
  matches: number;
  used: string[];
};
export type StripState = Common & {
  game: 'strip';
  mode: 'higher' | 'quiz';
  heat: Heat;
  phase: 'idle' | 'dealt' | 'quiz_asked' | 'quiz_answered' | 'lost';
  cards: Record<string, number> | null;
  quiz: { subject: string; question: string; guess: string | null } | null;
  loser: string | null;
  forfeit: StateCard | null;
};
export type RoleplayState = Common & {
  game: 'roleplay';
  setting: Txt | null;
  characters: Record<string, Txt>;
  goalCommits: Record<string, string>;
  goalReveals: Record<string, { goal: Txt; salt: string }>;
};
export type TeaseState = Common & {
  game: 'tease_timer';
  leader: string | null;
  durationSec: number;
  endsAt: string | null;
  prompt: Txt | null;
  heat: Heat;
};
export type KnowMeState = Common & {
  game: 'know_me';
  subject: string; // whose questions are being asked
  question: { id: string; text: string } | null;
  guess: string | null;
  verdict: 'right' | 'wrong' | null;
  answer: string | null;
};

export type GameState = TodState | DiceState | WyrState | StripState | RoleplayState | TeaseState | KnowMeState;

export const SPICY_GAMES: GameType[] = ['strip', 'roleplay', 'tease_timer'];
export const GAME_ORDER: GameType[] = ['truth_dare', 'dice', 'would_you_rather', 'know_me', 'strip', 'roleplay', 'tease_timer'];
export const GAME_EMOJI: Record<GameType, string> = {
  truth_dare: '🎭', dice: '🎲', would_you_rather: '🤔', strip: '🃏', roleplay: '🎬', tease_timer: '⏱️', know_me: '💭',
};

const now = () => new Date().toISOString();
const other = (p: Players, uid: string) => (p.a === uid ? p.b : p.a);
const bump = <S extends Common>(s: S, patch: Partial<S>): S => ({ ...s, ...patch, updatedAt: now() });

export function pick<T>(arr: T[], rng: Rng): T | null {
  return arr.length ? arr[rng(arr.length)] : null;
}

/** Prefer unused cards; when all are used, start over. */
export function pickFresh<T extends { id: string }>(arr: T[], used: string[], rng: Rng): T | null {
  const fresh = arr.filter((c) => !used.includes(c.id));
  return pick(fresh.length ? fresh : arr, rng);
}

export function initialState(game: GameType, players: Players, starter: string, opts: { heat?: Heat; dice?: DieDef[] } = {}): GameState {
  const base: Common = { v: 1, players, scores: { [players.a]: 0, [players.b]: 0 }, round: 1, updatedAt: now() };
  switch (game) {
    case 'truth_dare':
      return { ...base, game, heat: opts.heat ?? 1, turn: starter, current: null, used: [] };
    case 'dice':
      return { ...base, game, dice: (opts.dice ?? []).slice(0, 4).map((d) => ({ name: d.name, faces: d.faces })), roll: null };
    case 'would_you_rather':
      return { ...base, game, heat: opts.heat ?? 1, question: null, commits: {}, reveals: {}, matches: 0, used: [] };
    case 'strip':
      return { ...base, game, mode: 'higher', heat: opts.heat ?? 2, phase: 'idle', cards: null, quiz: null, loser: null, forfeit: null };
    case 'roleplay':
      return { ...base, game, setting: null, characters: {}, goalCommits: {}, goalReveals: {} };
    case 'tease_timer':
      return { ...base, game, leader: null, durationSec: 30, endsAt: null, prompt: null, heat: 1 };
    case 'know_me':
      return { ...base, game, subject: starter, question: null, guess: null, verdict: null, answer: null };
  }
}

// ─── Truth or Dare ─────────────────────────────────────────────────────────
export function todSetHeat(s: TodState, heat: Heat): TodState {
  return bump(s, { heat });
}

export function todDraw(s: TodState, kind: 'truth' | 'dare', pool: PoolCard[], rng: Rng): TodState {
  const card = pickFresh(pool, s.used, rng);
  if (!card) return s;
  return bump(s, { current: { kind, card: { id: card.id, text: card.text, heat: card.heat } }, used: [...s.used.slice(-200), card.id] });
}

/** done = the turn player completed it (+1); skip = no point. Turn passes. */
export function todResolve(s: TodState, done: boolean): TodState {
  const scores = done ? { ...s.scores, [s.turn]: (s.scores[s.turn] ?? 0) + 1 } : s.scores;
  return bump(s, { scores, current: null, turn: other(s.players, s.turn), round: s.round + 1 });
}

// ─── Dice ──────────────────────────────────────────────────────────────────
export function diceSetDice(s: DiceState, dice: DieDef[]): DiceState {
  return bump(s, { dice: dice.slice(0, 4).map((d) => ({ name: d.name, faces: d.faces })), roll: null });
}

export function diceRoll(s: DiceState, actor: string, rng: Rng): DiceState {
  const results = s.dice.map((d) => rng(Math.max(1, d.faces.length)));
  return bump(s, { roll: { results, by: actor, seq: (s.roll?.seq ?? 0) + 1 }, round: s.round + 1 });
}

// ─── Would You Rather (commit → reveal) ────────────────────────────────────
export function wyrDraw(s: WyrState, pool: WyrCard[], rng: Rng): WyrState {
  const q = pickFresh(pool, s.used, rng);
  if (!q) return s;
  return bump(s, { question: { id: q.id, a: q.a, b: q.b }, commits: {}, reveals: {}, used: [...s.used.slice(-200), q.id], round: s.question ? s.round + 1 : s.round });
}

export function wyrCommitPick(s: WyrState, actor: string, pickSide: 'a' | 'b', salt: string): WyrState {
  if (!s.question || s.commits[actor]) return s;
  return bump(s, { commits: { ...s.commits, [actor]: commit(`${s.question.id}:${pickSide}`, salt) } });
}

export function wyrBothCommitted(s: WyrState): boolean {
  return !!s.commits[s.players.a] && !!s.commits[s.players.b];
}

export function wyrReveal(s: WyrState, actor: string, pickSide: 'a' | 'b', salt: string): WyrState {
  if (!s.question || !wyrBothCommitted(s) || s.reveals[actor]) return s;
  const reveals = { ...s.reveals, [actor]: { pick: pickSide, salt } };
  let matches = s.matches;
  const r = wyrResult({ ...s, reveals });
  if (r.complete && r.valid && r.match) matches += 1;
  return bump(s, { reveals, matches });
}

export function wyrResult(s: WyrState): { complete: boolean; valid: boolean; match: boolean; picks: Record<string, 'a' | 'b'> } {
  const picks: Record<string, 'a' | 'b'> = {};
  let valid = true;
  for (const uid of [s.players.a, s.players.b]) {
    const r = s.reveals[uid];
    if (!r) continue;
    picks[uid] = r.pick;
    if (!s.question || !verifyCommit(`${s.question.id}:${r.pick}`, r.salt, s.commits[uid] ?? '')) valid = false;
  }
  const complete = Object.keys(picks).length === 2;
  return { complete, valid, match: complete && picks[s.players.a] === picks[s.players.b], picks };
}

// ─── Strip game ────────────────────────────────────────────────────────────
export function stripSetMode(s: StripState, mode: StripState['mode']): StripState {
  return bump(s, { mode, phase: 'idle', cards: null, quiz: null, loser: null, forfeit: null });
}

export function stripSetHeat(s: StripState, heat: Heat): StripState {
  return bump(s, { heat });
}

/** Higher card: both get a value 2–14; lower loses, tie → redeal. */
export function stripDeal(s: StripState, rng: Rng): StripState {
  const { a, b } = s.players;
  const ca = 2 + rng(13);
  const cb = 2 + rng(13);
  const loser = ca === cb ? null : ca < cb ? a : b;
  return bump(s, { cards: { [a]: ca, [b]: cb }, loser, phase: loser ? 'lost' : 'dealt', forfeit: null, quiz: null, round: s.round + 1, scores: loser ? { ...s.scores, [loser]: (s.scores[loser] ?? 0) + 1 } : s.scores });
}

/** Quiz: the subject asks a question about themselves; the other answers. */
export function stripAsk(s: StripState, subject: string, question: string): StripState {
  return bump(s, { phase: 'quiz_asked', quiz: { subject, question, guess: null }, loser: null, forfeit: null, cards: null });
}

export function stripGuess(s: StripState, guess: string): StripState {
  if (!s.quiz) return s;
  return bump(s, { phase: 'quiz_answered', quiz: { ...s.quiz, guess } });
}

/** The subject judges; a wrong guess makes the guesser lose, a right one the subject. */
export function stripJudge(s: StripState, right: boolean): StripState {
  if (!s.quiz) return s;
  const guesser = other(s.players, s.quiz.subject);
  const loser = right ? s.quiz.subject : guesser;
  return bump(s, { phase: 'lost', loser, round: s.round + 1, scores: { ...s.scores, [loser]: (s.scores[loser] ?? 0) + 1 } });
}

export function stripForfeit(s: StripState, pool: PoolCard[], rng: Rng): StripState {
  const card = pick(pool, rng);
  if (!card) return s;
  return bump(s, { forfeit: { id: card.id, text: card.text, heat: card.heat } });
}

// ─── Role-play ─────────────────────────────────────────────────────────────
export function roleplayDeal(s: RoleplayState, settings: PoolCard[], characters: PoolCard[], rng: Rng): RoleplayState {
  const setting = pick(settings, rng);
  const c1 = pick(characters, rng);
  const rest = characters.filter((c) => c.id !== c1?.id);
  const c2 = pick(rest.length ? rest : characters, rng);
  if (!setting || !c1 || !c2) return s;
  return bump(s, {
    setting: setting.text,
    characters: { [s.players.a]: c1.text, [s.players.b]: c2.text },
    goalCommits: {},
    goalReveals: {},
    round: s.setting ? s.round + 1 : s.round,
  });
}

export const goalCommitValue = (goal: Txt) => JSON.stringify(goal);

/** Each player draws their own goal locally and only publishes a commitment. */
export function roleplayCommitGoal(s: RoleplayState, actor: string, goal: Txt, salt: string): RoleplayState {
  return bump(s, { goalCommits: { ...s.goalCommits, [actor]: commit(goalCommitValue(goal), salt) } });
}

export function roleplayRevealGoal(s: RoleplayState, actor: string, goal: Txt, salt: string): RoleplayState {
  if (!s.goalCommits[actor] || !verifyCommit(goalCommitValue(goal), salt, s.goalCommits[actor])) return s;
  return bump(s, { goalReveals: { ...s.goalReveals, [actor]: { goal, salt } } });
}

// ─── Tease timer ───────────────────────────────────────────────────────────
/** Escalates: +15 s per round (max 5 min); heat rises every 2 rounds (cap 3, or maxHeat). */
export function teaseDurationFor(round: number): number {
  return Math.min(300, 30 + (round - 1) * 15);
}
export function teaseHeatFor(round: number, maxHeat: Heat): Heat {
  return Math.min(maxHeat, 1 + Math.floor((round - 1) / 2)) as Heat;
}

export function teaseNext(s: TeaseState, prompts: (heat: Heat) => PoolCard[], maxHeat: Heat, rng: Rng): TeaseState {
  const round = s.leader ? s.round + 1 : s.round;
  const heat = teaseHeatFor(round, maxHeat);
  const leader = rng(2) === 0 ? s.players.a : s.players.b;
  const p = pick(prompts(heat), rng);
  return bump(s, { round, heat, leader, durationSec: teaseDurationFor(round), endsAt: null, prompt: p?.text ?? null });
}

export function teaseStart(s: TeaseState, at: Date = new Date()): TeaseState {
  return bump(s, { endsAt: new Date(at.getTime() + s.durationSec * 1000).toISOString() });
}

// ─── How well do you know me ───────────────────────────────────────────────
export function knowAsk(s: KnowMeState, actor: string, q: { id: string; text: string }): KnowMeState {
  return bump(s, { subject: actor, question: q, guess: null, verdict: null, answer: null });
}

export function knowGuess(s: KnowMeState, guess: string): KnowMeState {
  return bump(s, { guess: guess.trim().slice(0, 300) });
}

/** Subject judges and reveals their answer; the guesser scores on "right". */
export function knowJudge(s: KnowMeState, right: boolean, answer: string): KnowMeState {
  const guesser = other(s.players, s.subject);
  const scores = right ? { ...s.scores, [guesser]: (s.scores[guesser] ?? 0) + 1 } : s.scores;
  return bump(s, { verdict: right ? 'right' : 'wrong', answer, scores });
}

/** Next question: roles swap. */
export function knowNext(s: KnowMeState): KnowMeState {
  return bump(s, { subject: other(s.players, s.subject), question: null, guess: null, verdict: null, answer: null, round: s.round + 1 });
}

export function otherPlayer(s: { players: Players }, uid: string): string {
  return other(s.players, uid);
}
