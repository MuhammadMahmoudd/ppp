-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 chat, snaps, screenshots, streaks
-- All content columns hold tweetnacl ciphertext (base64) + nonce.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── messages ──────────────────────────────────────────────────────────────
create table public.messages (
  id              uuid primary key,          -- generated on device (idempotent offline retries)
  couple_id       uuid not null references public.couples(id) on delete cascade,
  sender_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type            text not null check (type in (
                    'text','image','video','voice','game_result','dare','tonight',
                    'miss_you','touch','screenshot','system','snap','envelope','streak')),
  ciphertext      text,
  nonce           text,
  media_path      text,
  media_nonce     text,
  reply_to        uuid references public.messages(id) on delete set null,
  disappear_mode  text not null default 'off' check (disappear_mode in ('off','view','24h')),
  meta            jsonb not null default '{}'::jsonb, -- non-sensitive structure only (deadline, ids)
  created_at      timestamptz not null default now(),
  seen_at         timestamptz,
  expires_at      timestamptz,
  deleted_at      timestamptz
);
create index messages_couple_created on public.messages (couple_id, created_at desc);
create index messages_expires on public.messages (expires_at) where expires_at is not null and deleted_at is null;

create or replace function public.messages_before_insert()
returns trigger language plpgsql as $$
begin
  new.created_at := now();
  new.seen_at := null;
  new.deleted_at := null;
  if new.disappear_mode = '24h' then
    new.expires_at := now() + interval '24 hours';
  else
    new.expires_at := null;
  end if;
  return new;
end $$;
create trigger messages_bi before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform add_xp(new.couple_id, 1);
  return null;
end $$;
create trigger messages_ai after insert on public.messages
  for each row execute function public.messages_after_insert();

-- receiver marks everything from partner as seen; 'view' messages start expiring
create or replace function public.mark_messages_seen()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update messages set
    seen_at = now(),
    expires_at = case when disappear_mode = 'view' then now() + interval '1 minute' else expires_at end
  where couple_id = my_couple_id() and sender_id <> auth.uid() and seen_at is null and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- sender deletes for both (content wiped, tombstone kept for ordering)
create or replace function public.delete_message(message_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare path text;
begin
  update messages set deleted_at = now(), ciphertext = null, nonce = null
   where id = message_id and sender_id = auth.uid() and deleted_at is null
  returning media_path into path;
  if not found then raise exception 'not_allowed'; end if;
  update messages set media_path = null where id = message_id;
  return path; -- client removes the storage object (allowed once the row no longer points to it)
end $$;

-- async dares: receiver marks done with optional proof message
create or replace function public.complete_dare(message_id uuid, proof_message_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update messages set meta = meta || jsonb_build_object('done_at', now(), 'proof', proof_message_id)
   where id = message_id and type = 'dare' and couple_id = my_couple_id() and sender_id <> auth.uid();
  if not found then raise exception 'not_allowed'; end if;
end $$;

-- tonight? answer: updates the card in place
create or replace function public.answer_signal(message_id uuid, answer text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if answer not in ('yes','no') then raise exception 'bad_answer'; end if;
  update messages set meta = meta || jsonb_build_object('answer', answer, 'answered_at', now())
   where id = message_id and type = 'tonight' and couple_id = my_couple_id() and sender_id <> auth.uid();
  if not found then raise exception 'not_allowed'; end if;
end $$;

create table public.message_reactions (
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  couple_id   uuid not null references public.couples(id) on delete cascade,
  emoji       text not null check (char_length(emoji) <= 16),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index reactions_couple on public.message_reactions (couple_id);

-- ─── snaps ─────────────────────────────────────────────────────────────────
create table public.snaps (
  id              uuid primary key,
  couple_id       uuid not null references public.couples(id) on delete cascade,
  sender_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path    text,
  nonce           text not null,
  meta_ciphertext text,          -- encrypted overlay JSON (doodles, text, filter)
  meta_nonce      text,
  media_kind      text not null check (media_kind in ('image','video')),
  duration        integer not null default 5 check (duration in (0,3,5,10)), -- 0 = ∞ loop
  allow_save      boolean not null default false,
  spicy_blur      boolean not null default false,
  view_once       boolean not null default true,
  proof_for       uuid,          -- dare message / game id this snap proves
  created_at      timestamptz not null default now(),
  opened_at       timestamptz,
  expires_at      timestamptz not null default now() + interval '7 days'
);
create index snaps_couple_created on public.snaps (couple_id, created_at desc);
create index snaps_unopened_expiry on public.snaps (expires_at) where opened_at is null;

-- ─── screenshot events ─────────────────────────────────────────────────────
create table public.screenshot_events (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  context     text not null check (context in ('snap','vault','spicy','chat','game')),
  target_id   uuid,
  created_at  timestamptz not null default now()
);
create index screenshot_events_couple on public.screenshot_events (couple_id, created_at desc);

-- ─── streaks ───────────────────────────────────────────────────────────────
create table public.streak_days (
  couple_id   uuid not null references public.couples(id) on delete cascade,
  day         date not null,
  a_sent      boolean not null default false,
  b_sent      boolean not null default false,
  completed   boolean not null default false,
  frozen      boolean not null default false,
  primary key (couple_id, day)
);

-- Core streak rule (mirrored in lib/streak.ts and unit-tested there):
-- a day counts when both partners sent ≥1 snap that day in the couple home tz.
create or replace function public.register_streak_activity(c uuid, sender uuid, at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  cpl couples%rowtype;
  r text;
  d date;
  sd streak_days%rowtype;
  new_count int;
begin
  select * into cpl from couples where id = c for update;
  select role into r from couple_members where couple_id = c and user_id = sender;
  d := (at at time zone cpl.home_timezone)::date;

  insert into streak_days (couple_id, day, a_sent, b_sent)
  values (c, d, r = 'a', r = 'b')
  on conflict (couple_id, day) do update
    set a_sent = streak_days.a_sent or excluded.a_sent,
        b_sent = streak_days.b_sent or excluded.b_sent
  returning * into sd;

  if sd.a_sent and sd.b_sent and not sd.completed then
    update streak_days set completed = true where couple_id = c and day = d;
    if cpl.streak_last_day = d - 1 then
      new_count := cpl.streak_count + 1;
    elsif cpl.streak_last_day = d then
      new_count := cpl.streak_count;
    else
      new_count := 1;
    end if;
    update couples set
      streak_count = new_count,
      streak_best = greatest(streak_best, new_count),
      streak_last_day = d,
      couple_xp = couple_xp + 5
    where id = c;
  end if;
end $$;

create or replace function public.snaps_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform register_streak_activity(new.couple_id, new.sender_id, new.created_at);
  perform add_xp(new.couple_id, 3);
  return null;
end $$;
create trigger snaps_ai after insert on public.snaps
  for each row execute function public.snaps_after_insert();

create or replace function public.snaps_before_insert()
returns trigger language plpgsql as $$
begin
  new.created_at := now();
  new.opened_at := null;
  new.expires_at := now() + interval '7 days';
  return new;
end $$;
create trigger snaps_bi before insert on public.snaps
  for each row execute function public.snaps_before_insert();

-- One freeze per calendar month (home tz). Saves a streak whose only gap is yesterday.
create or replace function public.use_streak_freeze()
returns integer language plpgsql security definer set search_path = public as $$
declare
  c uuid := my_couple_id();
  cpl couples%rowtype;
  today date;
  month text;
begin
  if c is null then raise exception 'no_couple'; end if;
  select * into cpl from couples where id = c for update;
  today := (now() at time zone cpl.home_timezone)::date;
  month := to_char(today, 'YYYY-MM');
  if cpl.streak_freeze_month is distinct from month then
    cpl.streak_freezes_left := 1;
  end if;
  if cpl.streak_freezes_left <= 0 then raise exception 'no_freezes_left'; end if;
  if cpl.streak_count <= 0 or cpl.streak_last_day is distinct from today - 2 then
    raise exception 'nothing_to_freeze';
  end if;
  insert into streak_days (couple_id, day, completed, frozen)
  values (c, today - 1, true, true)
  on conflict (couple_id, day) do update set completed = true, frozen = true;
  update couples set
    streak_last_day = today - 1,
    streak_freezes_left = cpl.streak_freezes_left - 1,
    streak_freeze_month = month
  where id = c;
  return cpl.streak_count;
end $$;

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.messages          enable row level security;
alter table public.message_reactions enable row level security;
alter table public.snaps             enable row level security;
alter table public.screenshot_events enable row level security;
alter table public.streak_days       enable row level security;

create policy messages_select on public.messages for select to authenticated
  using (public.is_member(couple_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and couple_id = public.my_couple_id() and public.is_paired());

create policy reactions_select on public.message_reactions for select to authenticated
  using (public.is_member(couple_id));
create policy reactions_insert on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and couple_id = public.my_couple_id()
              and exists (select 1 from public.messages m where m.id = message_reactions.message_id and m.couple_id = message_reactions.couple_id));
create policy reactions_update on public.message_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and couple_id = public.my_couple_id());
create policy reactions_delete on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

create policy snaps_select on public.snaps for select to authenticated
  using (public.is_member(couple_id));
create policy snaps_insert on public.snaps for insert to authenticated
  with check (sender_id = auth.uid() and couple_id = public.my_couple_id() and public.is_paired());

create policy screenshots_select on public.screenshot_events for select to authenticated
  using (public.is_member(couple_id));
create policy screenshots_insert on public.screenshot_events for insert to authenticated
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());

create policy streak_days_select on public.streak_days for select to authenticated
  using (public.is_member(couple_id));

revoke execute on function public.register_streak_activity(uuid, uuid, timestamptz) from public, anon, authenticated;
