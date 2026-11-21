-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 vault, scheduled items, envelopes, countdown + locked plan,
--      daily question, miss-you, shared lists (bucket list / coupons / memories)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── vault ─────────────────────────────────────────────────────────────────
create table public.vault_albums (
  id               uuid primary key default gen_random_uuid(),
  couple_id        uuid not null references public.couples(id) on delete cascade,
  created_by       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name_ciphertext  text not null,
  name_nonce       text not null,
  created_at       timestamptz not null default now()
);

create table public.vault_items (
  id               uuid primary key default gen_random_uuid(),
  couple_id        uuid not null references public.couples(id) on delete cascade,
  uploader_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  album_id         uuid references public.vault_albums(id) on delete set null,
  kind             text not null check (kind in ('image','video','voice')),
  storage_path     text not null,
  nonce            text not null,
  thumb_path       text,
  thumb_nonce      text,
  meta_ciphertext  text,
  meta_nonce       text,
  created_at       timestamptz not null default now()
);
create index vault_items_couple on public.vault_items (couple_id, created_at desc);

create table public.vault_delete_requests (
  item_id       uuid primary key references public.vault_items(id) on delete cascade,
  couple_id     uuid not null references public.couples(id) on delete cascade,
  requested_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  requested_at  timestamptz not null default now()
);

-- Delete with optional "both must agree" protection.
-- Returns the storage paths to remove (client deletes them; storage policy
-- only allows deleting objects no row points to any more), or null if a
-- request was recorded and we now wait for the partner.
create or replace function public.vault_delete(p_item uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  it vault_items%rowtype;
  protected boolean;
  req vault_delete_requests%rowtype;
begin
  select * into it from vault_items where id = p_item and couple_id = my_couple_id();
  if it.id is null then raise exception 'not_found'; end if;
  select vault_delete_protection into protected from couples where id = it.couple_id;
  if protected then
    select * into req from vault_delete_requests where item_id = p_item;
    if req.item_id is null then
      insert into vault_delete_requests (item_id, couple_id) values (p_item, it.couple_id);
      return null;
    elsif req.requested_by = auth.uid() then
      return null; -- still waiting for the partner
    end if;
  end if;
  delete from vault_items where id = p_item;
  return array_remove(array[it.storage_path, it.thumb_path], null);
end $$;

-- ─── scheduled items (tease scheduler) ─────────────────────────────────────
-- Sender-only until delivered; deliver_scheduled() turns them into messages.
create table public.scheduled_items (
  id                  uuid primary key default gen_random_uuid(),
  couple_id           uuid not null references public.couples(id) on delete cascade,
  sender_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind                text not null default 'message' check (kind in ('message','snap')),
  message_type        text not null default 'text',
  payload_ciphertext  text,
  nonce               text,
  media_path          text,
  media_nonce         text,
  deliver_at          timestamptz not null,
  delivered_at        timestamptz,
  created_at          timestamptz not null default now()
);
create index scheduled_due on public.scheduled_items (deliver_at) where delivered_at is null;

create or replace function public.deliver_due_items()
returns setof public.messages language plpgsql security definer set search_path = public as $$
declare s scheduled_items%rowtype; m messages%rowtype;
begin
  for s in
    select * from scheduled_items where delivered_at is null and deliver_at <= now()
    order by deliver_at for update skip locked
  loop
    insert into messages (id, couple_id, sender_id, type, ciphertext, nonce, media_path, media_nonce, meta)
    values (gen_random_uuid(), s.couple_id, s.sender_id, s.message_type, s.payload_ciphertext, s.nonce,
            s.media_path, s.media_nonce, jsonb_build_object('scheduled', true))
    returning * into m;
    update scheduled_items set delivered_at = now() where id = s.id;
    return next m;
  end loop;
end $$;

-- ─── envelopes / open-when letters ─────────────────────────────────────────
create table public.envelopes (
  id                uuid primary key default gen_random_uuid(),
  couple_id         uuid not null references public.couples(id) on delete cascade,
  author_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('date','when')),
  title_ciphertext  text not null,  -- e.g. "open when you can't sleep"
  title_nonce       text not null,
  unlock_at         timestamptz,
  opened_at         timestamptz,
  created_at        timestamptz not null default now(),
  constraint date_needs_unlock check (kind = 'when' or unlock_at is not null)
);
create index envelopes_couple on public.envelopes (couple_id, created_at desc);

create table public.envelope_contents (
  envelope_id  uuid primary key references public.envelopes(id) on delete cascade,
  couple_id    uuid not null references public.couples(id) on delete cascade,
  ciphertext   text not null,
  nonce        text not null
);

create or replace function public.envelope_unlocked(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from envelopes
    where id = e and (author_id = auth.uid() or kind = 'when' or unlock_at <= now()))
$$;

create or replace function public.open_envelope(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update envelopes set opened_at = coalesce(opened_at, now())
   where id = p_id and couple_id = my_couple_id() and author_id <> auth.uid()
     and (kind = 'when' or unlock_at <= now());
  if not found then raise exception 'locked'; end if;
end $$;

-- ─── countdown to next visit + locked "first night back" plan ──────────────
create table public.countdowns (
  id                uuid primary key default gen_random_uuid(),
  couple_id         uuid not null references public.couples(id) on delete cascade,
  created_by        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title_ciphertext  text,
  title_nonce       text,
  target_at         timestamptz not null,
  created_at        timestamptz not null default now()
);
create index countdowns_couple on public.countdowns (couple_id, target_at);

create table public.plan_items (
  id            uuid primary key default gen_random_uuid(),
  countdown_id  uuid not null references public.countdowns(id) on delete cascade,
  couple_id     uuid not null references public.couples(id) on delete cascade,
  author_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ciphertext    text not null,
  nonce         text not null,
  created_at    timestamptz not null default now()
);

create or replace function public.countdown_reached(cd uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select target_at <= now() from countdowns where id = cd), false)
$$;

-- ─── daily question ────────────────────────────────────────────────────────
-- Questions ship in the app; both phones pick the same index for the day.
create table public.daily_answers (
  couple_id     uuid not null references public.couples(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day           date not null,
  pool          text not null check (pool in ('sweet','spicy')),
  question_idx  integer not null,
  ciphertext    text not null,
  nonce         text not null,
  created_at    timestamptz not null default now(),
  primary key (couple_id, user_id, day, pool)
);

create or replace function public.has_answered(c uuid, d date, p text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from daily_answers where couple_id = c and user_id = auth.uid() and day = d and pool = p)
$$;

create or replace function public.daily_answers_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare cpl couples%rowtype; n int;
begin
  select count(*) into n from daily_answers where couple_id = new.couple_id and day = new.day and pool = new.pool;
  if n = 2 then
    select * into cpl from couples where id = new.couple_id for update;
    if cpl.question_last_day is distinct from new.day then
      update couples set
        question_streak = case when cpl.question_last_day = new.day - 1 then cpl.question_streak + 1 else 1 end,
        question_last_day = new.day,
        couple_xp = couple_xp + 5
      where id = new.couple_id;
    end if;
  end if;
  return null;
end $$;
create trigger daily_answers_ai after insert on public.daily_answers
  for each row execute function public.daily_answers_after_insert();

-- ─── miss-you buzzes ───────────────────────────────────────────────────────
create table public.miss_you_events (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  sender_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index miss_you_couple on public.miss_you_events (couple_id, created_at desc);

-- ─── shared lists: bucket list, coupon book, memory timeline (phase 8) ─────
create table public.shared_items (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  created_by   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('bucket','coupon','memory')),
  ciphertext   text not null,
  nonce        text not null,
  happened_on  date,
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index shared_items_couple on public.shared_items (couple_id, kind, created_at desc);

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.vault_albums          enable row level security;
alter table public.vault_items           enable row level security;
alter table public.vault_delete_requests enable row level security;
alter table public.scheduled_items       enable row level security;
alter table public.envelopes             enable row level security;
alter table public.envelope_contents     enable row level security;
alter table public.countdowns            enable row level security;
alter table public.plan_items            enable row level security;
alter table public.daily_answers         enable row level security;
alter table public.miss_you_events       enable row level security;
alter table public.shared_items          enable row level security;

create policy albums_select on public.vault_albums for select to authenticated using (public.is_member(couple_id));
create policy albums_insert on public.vault_albums for insert to authenticated
  with check (created_by = auth.uid() and couple_id = public.my_couple_id());
create policy albums_update on public.vault_albums for update to authenticated
  using (public.is_member(couple_id)) with check (couple_id = public.my_couple_id());
create policy albums_delete on public.vault_albums for delete to authenticated using (public.is_member(couple_id));

create policy vault_select on public.vault_items for select to authenticated using (public.is_member(couple_id));
create policy vault_insert on public.vault_items for insert to authenticated
  with check (uploader_id = auth.uid() and couple_id = public.my_couple_id());
create policy vault_update on public.vault_items for update to authenticated
  using (public.is_member(couple_id)) with check (couple_id = public.my_couple_id());
-- deletes only via vault_delete()

create policy vault_req_select on public.vault_delete_requests for select to authenticated
  using (public.is_member(couple_id));
create policy vault_req_delete on public.vault_delete_requests for delete to authenticated
  using (public.is_member(couple_id));

create policy scheduled_own on public.scheduled_items for all to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid() and couple_id = public.my_couple_id() and delivered_at is null);

create policy envelopes_select on public.envelopes for select to authenticated using (public.is_member(couple_id));
create policy envelopes_insert on public.envelopes for insert to authenticated
  with check (author_id = auth.uid() and couple_id = public.my_couple_id());
create policy envelopes_delete on public.envelopes for delete to authenticated using (author_id = auth.uid());

create policy env_contents_select on public.envelope_contents for select to authenticated
  using (public.is_member(couple_id) and public.envelope_unlocked(envelope_id));
create policy env_contents_insert on public.envelope_contents for insert to authenticated
  with check (couple_id = public.my_couple_id()
              and exists (select 1 from public.envelopes e where e.id = envelope_contents.envelope_id and e.author_id = auth.uid()));

create policy countdowns_select on public.countdowns for select to authenticated using (public.is_member(couple_id));
create policy countdowns_insert on public.countdowns for insert to authenticated
  with check (created_by = auth.uid() and couple_id = public.my_couple_id());
create policy countdowns_update on public.countdowns for update to authenticated
  using (public.is_member(couple_id)) with check (couple_id = public.my_couple_id());
create policy countdowns_delete on public.countdowns for delete to authenticated using (public.is_member(couple_id));

create policy plan_select on public.plan_items for select to authenticated
  using (author_id = auth.uid() or (public.is_member(couple_id) and public.countdown_reached(countdown_id)));
create policy plan_insert on public.plan_items for insert to authenticated
  with check (author_id = auth.uid() and couple_id = public.my_couple_id());
create policy plan_delete on public.plan_items for delete to authenticated using (author_id = auth.uid());

-- partner's answer is readable only after you answered the same day/pool
create policy daily_select on public.daily_answers for select to authenticated
  using (user_id = auth.uid() or (public.is_member(couple_id) and public.has_answered(couple_id, day, pool)));
create policy daily_insert on public.daily_answers for insert to authenticated
  with check (user_id = auth.uid() and couple_id = public.my_couple_id()
              and (pool = 'sweet' or public.spicy_active(couple_id)));

create policy miss_select on public.miss_you_events for select to authenticated using (public.is_member(couple_id));
create policy miss_insert on public.miss_you_events for insert to authenticated
  with check (sender_id = auth.uid() and couple_id = public.my_couple_id());

create policy shared_select on public.shared_items for select to authenticated using (public.is_member(couple_id));
create policy shared_insert on public.shared_items for insert to authenticated
  with check (created_by = auth.uid() and couple_id = public.my_couple_id());
create policy shared_update on public.shared_items for update to authenticated
  using (public.is_member(couple_id)) with check (couple_id = public.my_couple_id());
create policy shared_delete on public.shared_items for delete to authenticated using (public.is_member(couple_id));

revoke execute on function public.deliver_due_items() from public, anon, authenticated;
