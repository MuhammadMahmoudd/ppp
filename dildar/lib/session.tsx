/**
 * Session: auth user + couple + both profiles + E2E keys, kept live with
 * Realtime. Everything the app needs to know "who are we" comes from here.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { api, apiConfigured } from './api';
import type { CoupleRow, MemberRow, ProfileRow } from './database.types';
import { deriveSharedKey, type KeyPairB64 } from './crypto';
import { loadLocalKeyPair, publishPublicKey } from './keys';
import { connectCoupleChannel, disconnectCoupleChannel, subscribeTable } from './realtime';

export type Stage = 'loading' | 'unconfigured' | 'signedOut' | 'needsKeys' | 'needsPairing' | 'needsProfile' | 'ready';

export type SessionValue = {
  stage: Stage;
  session: Session | null;
  userId: string | null;
  me: ProfileRow | null;
  partner: ProfileRow | null;
  couple: CoupleRow | null;
  role: 'a' | 'b' | null;
  members: MemberRow[];
  keyPair: KeyPairB64 | null;
  /** Symmetric key shared with the partner, null until both keys exist. */
  sharedKey: Uint8Array | null;
  spicyActive: boolean;
  refresh: () => Promise<void>;
  setKeyPair: (kp: KeyPairB64) => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<ProfileRow | null>(null);
  const [partner, setPartner] = useState<ProfileRow | null>(null);
  const [couple, setCouple] = useState<CoupleRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [keyPair, setKeyPair] = useState<KeyPairB64 | null>(null);
  const userId = session?.user.id ?? null;
  const loadSeq = useRef(0);

  useEffect(() => {
    if (!apiConfigured) {
      setAuthReady(true);
      return;
    }
    api.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = api.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const seq = ++loadSeq.current;
    const [kp, profiles, mem] = await Promise.all([
      loadLocalKeyPair(userId),
      api.from('profiles').select('*'),
      api.from('couple_members').select('*'),
    ]);
    if (seq !== loadSeq.current) return;
    const myProfile = profiles.data?.find((p) => p.user_id === userId) ?? null;
    const memberRows = mem.data ?? [];
    const myMember = memberRows.find((m) => m.user_id === userId);
    let cpl: CoupleRow | null = null;
    if (myMember) {
      const { data } = await api.from('couples').select('*').eq('id', myMember.couple_id).maybeSingle();
      cpl = data ?? null;
    }
    if (seq !== loadSeq.current) return;
    // Keep the published key in sync with this device's key.
    if (kp && myProfile && myProfile.public_key !== kp.publicKey) {
      await publishPublicKey(userId, kp.publicKey).catch(() => undefined);
      myProfile.public_key = kp.publicKey;
    }
    setKeyPair(kp);
    setMe(myProfile);
    setPartner(profiles.data?.find((p) => p.user_id !== userId) ?? null);
    setMembers(memberRows);
    setCouple(cpl);
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    setLoaded(false);
    if (userId) refresh();
    else {
      setMe(null);
      setPartner(null);
      setCouple(null);
      setMembers([]);
      setKeyPair(null);
    }
  }, [userId, refresh]);

  // Live updates for couple settings/streak, membership and profiles.
  const coupleId = couple?.id ?? null;
  useEffect(() => {
    if (!coupleId || !userId) return;
    connectCoupleChannel(coupleId, userId);
    const offs = [
      subscribeTable<CoupleRow>('couples', coupleId, (c) => c.eventType === 'UPDATE' && setCouple(c.new), 'id'),
      subscribeTable<MemberRow>('couple_members', coupleId, () => refresh()),
    ];
    return () => {
      offs.forEach((o) => o());
      disconnectCoupleChannel();
    };
  }, [coupleId, userId, refresh]);

  const partnerId = partner?.user_id ?? null;
  useEffect(() => {
    if (!partnerId) return;
    return subscribeTable<ProfileRow>('profiles', partnerId, (c) => c.new && setPartner(c.new), 'user_id');
  }, [partnerId]);

  const sharedKey = useMemo(() => {
    if (!keyPair || !partner?.public_key) return null;
    try {
      return deriveSharedKey(partner.public_key, keyPair.secretKey);
    } catch {
      return null;
    }
  }, [keyPair, partner?.public_key]);

  const role = members.find((m) => m.user_id === userId)?.role ?? null;
  const paired = members.length === 2;

  let stage: Stage;
  if (!apiConfigured) stage = 'unconfigured';
  else if (!authReady) stage = 'loading';
  else if (!session) stage = 'signedOut';
  else if (!loaded) stage = 'loading';
  else if (!keyPair) stage = 'needsKeys';
  else if (!paired) stage = 'needsPairing';
  else if (!me?.display_name) stage = 'needsProfile';
  else stage = 'ready';

  const spicyActive = !!couple && couple.spicy_enabled_a && couple.spicy_enabled_b && couple.adult_confirmed_a && couple.adult_confirmed_b;

  const value: SessionValue = {
    stage,
    session,
    userId,
    me,
    partner,
    couple,
    role,
    members,
    keyPair,
    sharedKey,
    spicyActive,
    refresh,
    setKeyPair: (kp) => setKeyPair(kp),
    signOut: async () => {
      disconnectCoupleChannel();
      await api.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/** For screens that only render when stage === 'ready'. */
export function useReady() {
  const s = useSession();
  if (!s.userId || !s.couple) throw new Error('useReady before ready');
  return s as SessionValue & { userId: string; couple: CoupleRow; role: 'a' | 'b' };
}
