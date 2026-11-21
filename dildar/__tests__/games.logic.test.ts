import {
  initialState, todDraw, todResolve, diceRoll, wyrDraw, wyrCommitPick, wyrReveal, wyrResult, wyrBothCommitted,
  stripDeal, stripAsk, stripGuess, stripJudge, stripForfeit, roleplayDeal, roleplayCommitGoal, roleplayRevealGoal,
  teaseNext, teaseStart, teaseDurationFor, teaseHeatFor, knowAsk, knowGuess, knowJudge, knowNext, pickFresh,
  type TodState, type DiceState, type WyrState, type StripState, type RoleplayState, type TeaseState, type KnowMeState,
} from '../features/games/logic';
import { poolFor, wyrPool, diceDefs, knowMePool } from '../features/decks/pools';
import { STARTER_DICE } from '../features/decks/starter';
import type { CardView } from '../features/decks/api';

const P = { a: 'A', b: 'B' };
const seq = (...vals: number[]) => { let i = 0; return (n: number) => vals[i++ % vals.length] % n; };
const card = (over: Partial<CardView>): CardView => ({ id: 'c1', deckId: 'd1', kind: 'dare', heat: 4, category: 'general', text: 'x', isShared: true, ownerId: 'A', mine: true, ...over });

describe('truth or dare', () => {
  it('draws from the right heat, scores and passes the turn', () => {
    let s = initialState('truth_dare', P, 'A', { heat: 2 }) as TodState;
    const pool = poolFor('truth', [], { heat: 2 });
    expect(pool.length).toBeGreaterThanOrEqual(15);
    expect(pool.every((c) => c.heat === 2)).toBe(true);
    s = todDraw(s, 'truth', pool, seq(3));
    expect(s.current?.card.id).toBe(pool[3].id);
    s = todResolve(s, true);
    expect(s.scores.A).toBe(1);
    expect(s.turn).toBe('B');
    expect(s.current).toBeNull();
  });
  it('level 4 only has our own cards', () => {
    expect(poolFor('dare', [], { heat: 4 })).toHaveLength(0);
    expect(poolFor('dare', [card({ id: 'mine4' })], { heat: 4 }).map((c) => c.id)).toEqual(['mine4']);
  });
  it('prefers unused cards', () => {
    const arr = [{ id: '1' }, { id: '2' }, { id: '3' }];
    expect(pickFresh(arr, ['1', '2'], seq(0))?.id).toBe('3');
    expect(pickFresh(arr, ['1', '2', '3'], seq(1))?.id).toBe('2');
  });
});

describe('dice', () => {
  it('both phones see the same roll from the shipped state', () => {
    const s0 = initialState('dice', P, 'A', { dice: STARTER_DICE.slice(0, 2) }) as DiceState;
    const s1 = diceRoll(s0, 'A', seq(4, 2));
    expect(s1.roll).toEqual({ results: [4, 2], by: 'A', seq: 1 });
    const wire = JSON.parse(JSON.stringify(s1)) as DiceState; // what the partner decrypts
    expect(wire.dice[0].faces[wire.roll!.results[0]]).toEqual(STARTER_DICE[0].faces[4]);
    expect(diceRoll(s1, 'B', seq(0, 0)).roll?.seq).toBe(2);
  });
  it('custom dice decks become dice with the deck name', () => {
    const defs = diceDefs([card({ kind: 'dice', text: 'one', heat: 1 }), card({ id: 'c2', kind: 'dice', text: 'two', heat: 1 })], new Map([['d1', 'Mood']]));
    expect(defs[0]).toEqual({ id: 'c:d1:Mood', name: 'Mood', faces: ['one', 'two'] });
    expect(defs).toHaveLength(1 + STARTER_DICE.length);
  });
});

describe('would you rather (commit → reveal)', () => {
  const pool = wyrPool([], 1);
  it('hides picks until both committed, then verifies reveals', () => {
    let s = wyrDraw(initialState('would_you_rather', P, 'A') as WyrState, pool, seq(0));
    s = wyrCommitPick(s, 'A', 'a', 'saltA');
    expect(JSON.stringify(s)).not.toContain('"pick"');
    expect(wyrReveal(s, 'A', 'a', 'saltA')).toBe(s); // can't reveal before both committed
    s = wyrCommitPick(s, 'B', 'a', 'saltB');
    expect(wyrBothCommitted(s)).toBe(true);
    s = wyrReveal(s, 'A', 'a', 'saltA');
    s = wyrReveal(s, 'B', 'a', 'saltB');
    expect(wyrResult(s)).toMatchObject({ complete: true, valid: true, match: true });
    expect(s.matches).toBe(1);
  });
  it('detects a cheating reveal', () => {
    let s = wyrDraw(initialState('would_you_rather', P, 'A') as WyrState, pool, seq(1));
    s = wyrCommitPick(s, 'A', 'a', 'x');
    s = wyrCommitPick(s, 'B', 'b', 'y');
    s = wyrReveal(s, 'A', 'b', 'x'); // lies about the pick
    s = wyrReveal(s, 'B', 'b', 'y');
    expect(wyrResult(s)).toMatchObject({ complete: true, valid: false });
    expect(s.matches).toBe(0);
  });
  it('custom "a || b" cards join the pool', () => {
    expect(wyrPool([card({ kind: 'would_you_rather', text: 'tea || coffee', heat: 1 })], 1).some((w) => w.a === 'tea' && w.b === 'coffee')).toBe(true);
  });
});

describe('strip game', () => {
  it('lower card loses, tie redeals, loser draws a forfeit', () => {
    let s = initialState('strip', P, 'A') as StripState;
    s = stripDeal(s, seq(3, 3));
    expect(s.loser).toBeNull();
    expect(s.phase).toBe('dealt');
    s = stripDeal(s, seq(2, 9));
    expect(s.loser).toBe('A');
    expect(s.scores.A).toBe(1);
    s = stripForfeit(s, poolFor('forfeit', [], { maxHeat: 2 }), seq(0));
    expect(s.forfeit).not.toBeNull();
  });
  it('quiz: wrong guess makes the guesser lose', () => {
    let s = stripAsk(initialState('strip', P, 'A') as StripState, 'A', 'favorite color?');
    s = stripGuess(s, 'blue');
    s = stripJudge(s, false);
    expect(s.loser).toBe('B');
  });
});

describe('role-play', () => {
  it('deals two different characters; goals stay committed until revealed', () => {
    let s = initialState('roleplay', P, 'A') as RoleplayState;
    s = roleplayDeal(s, poolFor('roleplay_setting', []), poolFor('roleplay_character', []), seq(0, 0));
    expect(s.setting).not.toBeNull();
    expect(s.characters.A).not.toEqual(s.characters.B);
    s = roleplayCommitGoal(s, 'A', 'secret goal', 'salt');
    expect(JSON.stringify(s)).not.toContain('secret goal');
    expect(roleplayRevealGoal(s, 'A', 'other goal', 'salt').goalReveals.A).toBeUndefined();
    expect(roleplayRevealGoal(s, 'A', 'secret goal', 'salt').goalReveals.A?.goal).toBe('secret goal');
  });
});

describe('tease timer', () => {
  it('escalates duration and heat, uses absolute end times', () => {
    expect(teaseDurationFor(1)).toBe(30);
    expect(teaseDurationFor(100)).toBe(300);
    expect(teaseHeatFor(1, 3)).toBe(1);
    expect(teaseHeatFor(5, 3)).toBe(3);
    expect(teaseHeatFor(9, 2)).toBe(2);
    let s = initialState('tease_timer', P, 'A') as TeaseState;
    s = teaseNext(s, (h) => poolFor('tease', [], { heat: h }), 3, seq(1, 0));
    expect(s.leader).toBe('B');
    expect(s.round).toBe(1);
    s = teaseStart(s, new Date('2026-01-01T00:00:00Z'));
    expect(s.endsAt).toBe('2026-01-01T00:00:30.000Z');
    s = teaseNext(s, (h) => poolFor('tease', [], { heat: h }), 3, seq(0, 0));
    expect(s.round).toBe(2);
    expect(s.durationSec).toBe(45);
    expect(s.endsAt).toBeNull();
  });
});

describe('how well do you know me', () => {
  it('guesser scores on right, roles swap', () => {
    const pool = knowMePool([card({ kind: 'know_me', text: 'Fav food? || dolma', ownerId: 'A' }), card({ id: 'x', kind: 'know_me', text: 'no split', ownerId: 'A' })], 'A');
    expect(pool).toEqual([{ id: 'c1', question: 'Fav food?', answer: 'dolma' }]);
    let s = initialState('know_me', P, 'A') as KnowMeState;
    s = knowAsk(s, 'A', { id: 'c1', text: 'Fav food?' });
    expect(JSON.stringify(s)).not.toContain('dolma');
    s = knowGuess(s, ' dolma ');
    s = knowJudge(s, true, 'dolma');
    expect(s.scores.B).toBe(1);
    s = knowNext(s);
    expect(s.subject).toBe('B');
  });
});
