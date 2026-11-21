import type { Locale } from '@/lib/settings';
import type { CardView, DeckView } from '@/features/decks/api';
import type { GameState } from '../logic';

export type RoomProps<S extends GameState> = {
  sessionId: string;
  state: S;
  apply: (m: (s: S) => S) => Promise<boolean>;
  me: string;
  partnerId: string;
  partnerName: string;
  locale: Locale;
  spicyActive: boolean;
  cards: CardView[];
  decks: DeckView[];
  readOnly: boolean;
};
