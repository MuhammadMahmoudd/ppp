-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 decks/cards, live game sessions, spicy hub (YNM, body map, fantasies)
-- Private answers are readable only by their author. Partners only ever see
-- overlaps, through the SECURITY DEFINER match functions at the bottom.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── decks & cards ─────────────────────────────────────────────────────────
create table public.decks (
  id               uuid primary key default gen_random_uuid(),
  couple_id        uuid not null references public.couples(id) on delete cascade,
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind             text not null check (kind in (
                     'truth','dare','forfeit','would_you_rather','roleplay_setting',
                     'roleplay_character','roleplay_goal','dice','tease','know_me','general')),
  name_ciphertext  text not null,
  name_nonce       text not null,
  is_shared        boolean not null default false,
  created_at       timestamptz not null default now()
);
create index decks_couple on public.decks (couple_id);

create table public.cards (
  id               uuid primary key default gen_random_uuid(),
  deck_id          uuid not null references public.decks(id) on delete cascade,
  couple_id        uuid not null references public.couples(id) on delete cascade,
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  heat             smallint not null default 1 check (heat between 1 and 4),
  category         text not null default 'general' check (char_length(category) <= 40),
  text_ciphertext  text not null,
  nonce            text not null,
  is_shared        boolean not null default false,
  created_at       timestamptz not null default now()
);
create index cards_deck on public.cards (deck_id);
create index cards_couple on public.cards (couple_id);

-- sharing a deck shares all of its cards (and un-sharing hides them again)
create or replace function public.set_deck_shared(p_deck uuid, p_shared boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update decks set is_shared = p_shared where id = p_deck and owner_id = auth.uid();
  if not found then raise exception 'not_allowed'; end if;
  update cards set is_shared = p_shared where deck_id = p_deck and owner_id = auth.uid();
end $$;

-- cards may only be added to decks you own
create or replace function public.cards_check_deck()
returns trigger language plpgsql security definer set search_path = public as $$
declare d decks%rowtype;
begin
  select * into d from decks where id = new.deck_id;
  if d.id is null or d.owner_id <> new.owner_id or d.couple_id <> new.couple_id then
    raise exception 'deck_mismatch';
  end if;
  if tg_op = 'INSERT' then new.is_shared := d.is_shared; end if;
  return new;
end $$;
create trigger cards_deck_check before insert or update on public.cards
  for each row execute function public.cards_check_deck();

-- ─── live game sessions ────────────────────────────────────────────────────
-- state is an encrypted JSON blob; the server only sees version/turn/status.
create table public.game_sessions (
  id                uuid primary key default gen_random_uuid(),
  couple_id         uuid not null references public.couples(id) on delete cascade,
  game_type         text not null check (game_type in (
                      'truth_dare','dice','would_you_rather','strip','roleplay','tease_timer','know_me')),
  state_ciphertext  text,
  state_nonce       text,
  version           integer not null default 0,
  turn_user_id      uuid references auth.users(id),
  status            text not null default 'invited' check (status in ('invited','active','finished','cancelled')),
  created_by        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index game_sessions_couple on public.game_sessions (couple_id, created_at desc);

create or replace function public.is_spicy_game(t text)
returns boolean language sql immutable as $$ select t in ('strip','roleplay','tease_timer') $$;

create or replace function public.game_sessions_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_spicy_game(new.game_type) and not spicy_active(new.couple_id) then
    raise exception 'spicy_locked';
  end if;
  new.version := 0;
  new.created_at := now();
  new.updated_at := now();
  return new;
end $$;
create trigger game_sessions_bi before insert on public.game_sessions
  for each row execute function public.game_sessions_before_insert();

-- Optimistic concurrency: the write wins only if expected_version matches.
create or replace function public.game_apply(
  p_id uuid, p_expected_version int, p_state_ciphertext text, p_state_nonce text,
  p_turn_user_id uuid default null, p_status text default null)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare g game_sessions%rowtype; was_status text;
begin
  select status into was_status from game_sessions where id = p_id and couple_id = my_couple_id();
  if was_status is null then raise exception 'not_found'; end if;
  update game_sessions set
    state_ciphertext = p_state_ciphertext,
    state_nonce = p_state_nonce,
    version = version + 1,
    turn_user_id = coalesce(p_turn_user_id, turn_user_id),
    status = coalesce(p_status, status),
    updated_at = now()
  where id = p_id and couple_id = my_couple_id() and version = p_expected_version
  returning * into g;
  if g.id is null then raise exception 'version_conflict'; end if;
  if g.status = 'finished' and was_status <> 'finished' then
    perform register_game_played(g.couple_id);
  end if;
  return g;
end $$;

create or replace function public.register_game_played(c uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cpl couples%rowtype; d date;
begin
  select * into cpl from couples where id = c for update;
  d := (now() at time zone cpl.home_timezone)::date;
  update couples set
    game_streak = case when cpl.game_last_day = d then cpl.game_streak
                       when cpl.game_last_day = d - 1 then cpl.game_streak + 1
                       else 1 end,
    game_last_day = d,
    couple_xp = couple_xp + 10
  where id = c;
end $$;

-- ─── Yes / No / Maybe ──────────────────────────────────────────────────────
-- starter items ship in the app (stable keys like 's:massage');
-- custom items live here encrypted.
create table public.ynm_items (
  id               uuid primary key default gen_random_uuid(),
  couple_id        uuid not null references public.couples(id) on delete cascade,
  created_by       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category         text not null default 'custom',
  text_ciphertext  text not null,
  nonce            text not null,
  created_at       timestamptz not null default now()
);
create index ynm_items_couple on public.ynm_items (couple_id);

create table public.ynm_answers (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  couple_id   uuid not null references public.couples(id) on delete cascade,
  item_key    text not null check (char_length(item_key) <= 64),
  answer      text not null check (answer in ('yes','no','maybe')),
  updated_at  timestamptz not null default now(),
  primary key (user_id, item_key)
);
create index ynm_answers_couple_item on public.ynm_answers (couple_id, item_key);

create table public.ynm_try_soon (
  couple_id   uuid not null references public.couples(id) on delete cascade,
  item_key    text not null,
  added_by    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  added_at    timestamptz not null default now(),
  done_at     timestamptz,
  primary key (couple_id, item_key)
);

create table public.boundary_checkins (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  couple_id   uuid not null references public.couples(id) on delete cascade,
  at          timestamptz not null default now(),
  primary key (user_id, at)
);

-- ─── body map ──────────────────────────────────────────────────────────────
create table public.body_map_answers (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  couple_id   uuid not null references public.couples(id) on delete cascade,
  side        text not null check (side in ('mine','yours')), -- "on me" vs "on you"
  area        text not null check (char_length(area) <= 32),
  intensity   smallint not null check (intensity between 1 and 3),
  updated_at  timestamptz not null default now(),
  primary key (user_id, side, area)
);

-- ─── fantasy box ───────────────────────────────────────────────────────────
-- Table is author-only. Partners see a teaser through list_fantasies();
-- the text is revealed once the partner marks "interested".
create table public.fantasies (
  id                 uuid primary key default gen_random_uuid(),
  couple_id          uuid not null references public.couples(id) on delete cascade,
  author_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category           text not null default 'general',
  heat               smallint not null default 2 check (heat between 1 and 4),
  text_ciphertext    text not null,
  nonce              text not null,
  partner_interested boolean not null default false,
  interested_at      timestamptz,
  created_at         timestamptz not null default now()
);
create index fantasies_couple on public.fantasies (couple_id);

-- ─── match / reveal functions (the only way to compare private answers) ────
create or replace function public.ynm_matches()
returns table (item_key text, my_answer text, partner_answer text)
language sql stable security definer set search_path = public as $$
  select mine.item_key, mine.answer, theirs.answer
  from ynm_answers mine
  join ynm_answers theirs
    on theirs.item_key = mine.item_key
   and theirs.couple_id = mine.couple_id
   and theirs.user_id = partner_id()
  where mine.user_id = auth.uid()
    and mine.couple_id = my_couple_id()
    and spicy_active(mine.couple_id)
    and mine.answer in ('yes','maybe')
    and theirs.answer in ('yes','maybe')
    and (mine.answer = 'yes' or theirs.answer = 'yes')
$$;

-- "mine" from me matches "yours" from partner and vice versa: if I like X on me
-- and they like doing X on me, that's an overlap. Same-side overlaps also count
-- (we both like X on ourselves) — returned with kind for the UI.
create or replace function public.body_map_matches()
returns table (area text, kind text, intensity smallint)
language sql stable security definer set search_path = public as $$
  select me.area,
         case when me.side = 'mine' then 'on_me' else 'on_you' end,
         least(me.intensity, them.intensity)
  from body_map_answers me
  join body_map_answers them
    on them.area = me.area
   and them.user_id = partner_id()
   and them.couple_id = me.couple_id
   and them.side <> me.side
  where me.user_id = auth.uid()
    and me.couple_id = my_couple_id()
    and spicy_active(me.couple_id)
$$;

create or replace function public.list_fantasies()
returns table (id uuid, is_mine boolean, category text, heat smallint, revealed boolean,
               text_ciphertext text, nonce text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.author_id = auth.uid(), f.category, f.heat, f.partner_interested,
         case when f.author_id = auth.uid() or f.partner_interested then f.text_ciphertext end,
         case when f.author_id = auth.uid() or f.partner_interested then f.nonce end,
         f.created_at
  from fantasies f
  where f.couple_id = my_couple_id() and spicy_active(f.couple_id)
  order by f.created_at desc
$$;

create or replace function public.fantasy_interest(p_id uuid, p_interested boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update fantasies set partner_interested = p_interested,
                       interested_at = case when p_interested then now() end
   where id = p_id and couple_id = my_couple_id() and author_id <> auth.uid()
     and spicy_active(couple_id);
  if not found then raise exception 'not_allowed'; end if;
end $$;

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.decks             enable row level security;
alter table public.cards             enable row level security;
alter table public.game_sessions     enable row level security;
alter table public.ynm_items         enable row level security;
alter table public.ynm_answers       enable row level security;
alter table public.ynm_try_soon      enable row level security;
alter table public.boundary_checkins enable row level security;
alter table public.body_map_answers  enable row level security;
alter table public.fantasies         enable row level security;

-- secret decks: only the creator sees them until shared
create policy decks_select on public.decks for select to authenticated
  using (public.is_member(couple_id) and (owner_id = auth.uid() or is_shared));
create policy decks_insert on public.decks for insert to authenticated
  with check (owner_id = auth.uid() and couple_id = public.my_couple_id());
create policy decks_update on public.decks for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and couple_id = public.my_couple_id());
create policy decks_delete on public.decks for delete to authenticated
  using (owner_id = auth.uid());

create policy cards_select on public.cards for select to authenticated
  using (public.is_member(couple_id) and (owner_id = auth.uid() or is_shared)
         and (heat < 4 or public.spicy_active(couple_id) or owner_id = auth.uid()));
create policy cards_insert on public.cards for insert to authenticated
  with check (owner_id = auth.uid() and couple_id = public.my_couple_id());
create policy cards_update on public.cards for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and couple_id = public.my_couple_id());
create policy cards_delete on public.cards for delete to authenticated
  using (owner_id = auth.uid());

create policy games_select on public.game_sessions for select to authenticated
  using (public.is_member(couple_id));
create policy games_insert on public.game_sessions for insert to authenticated
  with check (created_by = auth.uid() and couple_id = public.my_couple_id() and public.is_paired());
-- updates only via game_apply()

create policy ynm_items_select on public.ynm_items for select to authenticated
  using (public.is_member(couple_id) and public.spicy_active(couple_id));
create policy ynm_items_insert on public.ynm_items for insert to authenticated
  with check (created_by = auth.uid() and couple_id = public.my_couple_id() and public.spicy_active(couple_id));
create policy ynm_items_delete on public.ynm_items for delete to authenticated
  using (created_by = auth.uid());

-- private answers: author only, never the partner
create policy ynm_answers_own on public.ynm_answers for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());

create policy try_soon_select on public.ynm_try_soon for select to authenticated
  using (public.is_member(couple_id));
create policy try_soon_insert on public.ynm_try_soon for insert to authenticated
  with check (added_by = auth.uid() and couple_id = public.my_couple_id()
              and exists (select 1 from public.ynm_matches() m where m.item_key = ynm_try_soon.item_key));
create policy try_soon_update on public.ynm_try_soon for update to authenticated
  using (public.is_member(couple_id)) with check (couple_id = public.my_couple_id());
create policy try_soon_delete on public.ynm_try_soon for delete to authenticated
  using (public.is_member(couple_id));

create policy checkins_own on public.boundary_checkins for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and couple_id = public.my_couple_id());

create policy body_map_own on public.body_map_answers for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());

create policy fantasies_author_select on public.fantasies for select to authenticated
  using (author_id = auth.uid());
create policy fantasies_author_insert on public.fantasies for insert to authenticated
  with check (author_id = auth.uid() and couple_id = public.my_couple_id() and public.spicy_active(couple_id));
create policy fantasies_author_delete on public.fantasies for delete to authenticated
  using (author_id = auth.uid());

revoke execute on function public.register_game_played(uuid) from public, anon, authenticated;
