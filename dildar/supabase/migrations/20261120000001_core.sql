-- ═══════════════════════════════════════════════════════════════════════════
-- دڵدار (Dildar) — 0001 core: couples, members, profiles, invites, keys
-- Every table has RLS. Clients never insert into couple_members directly;
-- pairing goes through SECURITY DEFINER RPCs below.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── couples ───────────────────────────────────────────────────────────────
create table public.couples (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  home_timezone          text not null default 'Asia/Baghdad',
  anniversary            date,
  adult_confirmed_a      boolean not null default false,
  adult_confirmed_b      boolean not null default false,
  spicy_enabled_a        boolean not null default false,
  spicy_enabled_b        boolean not null default false,
  -- snap streak (زنجیرە)
  streak_count           integer not null default 0,
  streak_best            integer not null default 0,
  streak_last_day        date,
  streak_warned_day      date,
  streak_freezes_left    integer not null default 1,
  streak_freeze_month    text,
  -- mini streaks
  question_streak        integer not null default 0,
  question_last_day      date,
  game_streak            integer not null default 0,
  game_last_day          date,
  -- couple level
  couple_xp              integer not null default 0,
  -- settings shared by both
  chat_disappear_mode    text not null default 'off' check (chat_disappear_mode in ('off','view','24h')),
  vault_delete_protection boolean not null default false,
  constraint valid_tz check (home_timezone <> '')
);

-- ─── couple_members (max 2, enforced by trigger) ───────────────────────────
create table public.couple_members (
  couple_id  uuid not null references public.couples(id) on delete cascade,
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  role       text not null check (role in ('a','b')),
  joined_at  timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (couple_id, role)
);

create or replace function public.enforce_two_members()
returns trigger language plpgsql as $$
begin
  -- lock the couple row so two concurrent joins cannot both pass the check
  perform 1 from public.couples where id = new.couple_id for update;
  if (select count(*) from public.couple_members where couple_id = new.couple_id) >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger couple_members_max_two
  before insert on public.couple_members
  for each row execute function public.enforce_two_members();

create or replace function public.forbid_member_moves()
returns trigger language plpgsql as $$
begin
  if new.couple_id <> old.couple_id or new.user_id <> old.user_id or new.role <> old.role then
    raise exception 'member_immutable';
  end if;
  return new;
end $$;

create trigger couple_members_immutable
  before update on public.couple_members
  for each row execute function public.forbid_member_moves();

-- ─── helpers (SECURITY DEFINER so RLS policies can use them without recursion)
create or replace function public.my_couple_id()
returns uuid language sql stable security definer set search_path = public as $$
  select couple_id from public.couple_members where user_id = auth.uid()
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.couple_members where user_id = auth.uid()
$$;

create or replace function public.is_member(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.couple_members where couple_id = c and user_id = auth.uid())
$$;

create or replace function public.partner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select m2.user_id from public.couple_members m1
  join public.couple_members m2 on m2.couple_id = m1.couple_id and m2.user_id <> m1.user_id
  where m1.user_id = auth.uid()
$$;

create or replace function public.is_paired()
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) = 2 from public.couple_members where couple_id = public.my_couple_id()
$$;

create or replace function public.spicy_active(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select spicy_enabled_a and spicy_enabled_b
                     and adult_confirmed_a and adult_confirmed_b
                   from public.couples where id = c), false)
$$;

create or replace function public.couple_today(c uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone home_timezone)::date from public.couples where id = c
$$;

-- ─── profiles ──────────────────────────────────────────────────────────────
create table public.profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 60),
  avatar_path   text,
  avatar_nonce  text,
  timezone      text not null default 'Asia/Baghdad',
  public_key    text,
  birthday      date,
  locale        text not null default 'ckb' check (locale in ('ckb','en')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Push tokens are kept apart from profiles so the partner can never read them.
create table public.devices (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  push_token     text,
  push_previews  boolean not null default false,
  updated_at     timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict do nothing;
  insert into public.devices (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger devices_updated before update on public.devices
  for each row execute function public.touch_updated_at();

-- ─── invites ───────────────────────────────────────────────────────────────
create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  code        text not null check (code ~ '^[0-9]{6}$'),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '15 minutes',
  used_at     timestamptz,
  used_by     uuid references auth.users(id)
);
create unique index invites_active_code on public.invites (code) where used_at is null;
create index invites_couple on public.invites (couple_id);

-- brute-force protection for invite codes
create table public.invite_attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  at         timestamptz not null default now()
);
create index invite_attempts_user_at on public.invite_attempts (user_id, at);

-- ─── encrypted key backup (server only ever sees ciphertext) ──────────────
create table public.key_backups (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  public_key  text not null,
  salt        text not null,
  nonce       text not null,
  ciphertext  text not null,
  kdf         text not null default 'pbkdf2-sha512',
  iterations  integer not null,
  updated_at  timestamptz not null default now()
);
create trigger key_backups_updated before update on public.key_backups
  for each row execute function public.touch_updated_at();

-- ─── pairing RPCs ──────────────────────────────────────────────────────────
create or replace function public.random_code6()
returns text language sql volatile as $$
  select lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0')
$$;

-- A creates the couple (and confirms 18+). Idempotent: returns the existing couple.
create or replace function public.create_couple(adult_confirmed boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not adult_confirmed then raise exception 'adult_required'; end if;
  select couple_id into c from couple_members where user_id = auth.uid();
  if c is not null then return c; end if;
  insert into couples (adult_confirmed_a) values (true) returning id into c;
  insert into couple_members (couple_id, user_id, role) values (c, auth.uid(), 'a');
  return c;
end $$;

-- A generates a 6-digit code (15 min, single use). Older unused codes are voided.
create or replace function public.create_invite()
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare c uuid; new_code text; tries int := 0;
begin
  select couple_id into c from couple_members where user_id = auth.uid();
  if c is null then raise exception 'no_couple'; end if;
  if (select count(*) from couple_members where couple_id = c) >= 2 then
    raise exception 'couple_full';
  end if;
  update invites set used_at = now() where couple_id = c and used_at is null;
  loop
    new_code := random_code6();
    begin
      insert into invites (code, couple_id, created_by) values (new_code, c, auth.uid());
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 10 then raise; end if;
    end;
  end loop;
  return query select i.code, i.expires_at from invites i where i.code = new_code and i.used_at is null;
end $$;

-- B redeems. Max 10 attempts per hour per user. A wrong code returns NULL
-- (not an exception) so the recorded attempt is not rolled back.
create or replace function public.redeem_invite(invite_code text, adult_confirmed boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not adult_confirmed then raise exception 'adult_required'; end if;
  if exists (select 1 from couple_members where user_id = auth.uid()) then
    raise exception 'already_in_couple';
  end if;
  if (select count(*) from invite_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many_attempts';
  end if;
  insert into invite_attempts (user_id) values (auth.uid());

  select * into inv from invites
   where code = invite_code and used_at is null and expires_at > now()
   for update;
  if inv.id is null then return null; end if;

  update invites set used_at = now(), used_by = auth.uid() where id = inv.id;
  insert into couple_members (couple_id, user_id, role) values (inv.couple_id, auth.uid(), 'b');
  update couples set adult_confirmed_b = true where id = inv.couple_id;
  -- void every other code of this couple: nobody else can ever join
  update invites set used_at = now() where couple_id = inv.couple_id and used_at is null;
  return inv.couple_id;
end $$;

-- Spicy Mode: each partner toggles their own flag; active only when both on.
create or replace function public.set_spicy(enabled boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare r text; c uuid;
begin
  select couple_id, role into c, r from couple_members where user_id = auth.uid();
  if c is null then raise exception 'no_couple'; end if;
  if r = 'a' then update couples set spicy_enabled_a = enabled where id = c;
  else update couples set spicy_enabled_b = enabled where id = c; end if;
  return spicy_active(c);
end $$;

-- Shared couple settings (safe subset only; counters are trigger-managed)
create or replace function public.update_couple_settings(
  p_home_timezone text default null,
  p_anniversary date default null,
  p_chat_disappear_mode text default null,
  p_vault_delete_protection boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid := my_couple_id();
begin
  if c is null then raise exception 'no_couple'; end if;
  if p_home_timezone is not null then
    perform now() at time zone p_home_timezone; -- raises on an invalid zone
  end if;
  update couples set
    home_timezone = coalesce(p_home_timezone, home_timezone),
    anniversary = coalesce(p_anniversary, anniversary),
    chat_disappear_mode = coalesce(p_chat_disappear_mode, chat_disappear_mode),
    vault_delete_protection = coalesce(p_vault_delete_protection, vault_delete_protection)
  where id = c;
end $$;

create or replace function public.add_xp(c uuid, amount int)
returns void language sql security definer set search_path = public as $$
  update couples set couple_xp = couple_xp + amount where id = c
$$;

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.couples         enable row level security;
alter table public.couple_members  enable row level security;
alter table public.profiles        enable row level security;
alter table public.devices         enable row level security;
alter table public.invites         enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.key_backups     enable row level security;

create policy couples_select on public.couples for select to authenticated
  using (public.is_member(id));
-- no insert/update/delete policies: changes go through RPCs

create policy members_select on public.couple_members for select to authenticated
  using (public.is_member(couple_id));

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or user_id = public.partner_id());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy devices_all on public.devices for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy invites_select on public.invites for select to authenticated
  using (public.is_member(couple_id));

-- invite_attempts: no policies → invisible to clients

create policy key_backups_all on public.key_backups for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke execute on function public.add_xp(uuid, int) from public, anon, authenticated;
revoke execute on function public.random_code6() from public, anon, authenticated;
