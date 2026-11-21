import type { DeckKind } from '@/lib/database.types';

export const DECK_KINDS: DeckKind[] = [
  'truth', 'dare', 'forfeit', 'would_you_rather', 'know_me', 'dice', 'tease',
  'roleplay_setting', 'roleplay_character', 'roleplay_goal', 'general',
];
/** kinds where the heat level matters */
export const HEATED: DeckKind[] = ['truth', 'dare', 'forfeit', 'would_you_rather', 'tease', 'general'];
/** kinds whose cards are "a || b" pairs */
export const PAIRED: DeckKind[] = ['would_you_rather', 'know_me'];
/** spicy-only pools (hidden in the picker while Spicy Mode is off) */
export const SPICY_KINDS: DeckKind[] = ['tease', 'roleplay_setting', 'roleplay_character', 'roleplay_goal'];
export const KIND_EMOJI: Record<DeckKind, string> = {
  truth: '🗣️', dare: '🔥', forfeit: '🃏', would_you_rather: '🤔', know_me: '💭', dice: '🎲', tease: '⏱️',
  roleplay_setting: '🏨', roleplay_character: '🎭', roleplay_goal: '🤫', general: '💌',
};
