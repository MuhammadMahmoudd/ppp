-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 storage buckets + policies, realtime publication + private broadcast
--      authorization, purge helpers, cron schedules.
-- Supabase-only schemas are guarded so the file also runs in local tests.
-- ═══════════════════════════════════════════════════════════════════════════

-- Rows the purge job must clean up (storage objects are removed by the edge
-- function through the Storage API, then the rows are finalized here).
create or replace function public.expired_snap_paths()
returns table (id uuid, storage_path text)
language sql stable security definer set search_path = public as $$
  select id, storage_path from snaps
  where storage_path is not null
    and (expires_at <= now()
         or (view_once and opened_at is not null and opened_at < now() - interval '5 minutes'))
$$;

create or replace function public.finalize_purge()
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_msgs int; n_snaps int; n_attempts int;
begin
  update messages set ciphertext = null, nonce = null, media_path = null, deleted_at = now()
   where expires_at <= now() and deleted_at is null;
  get diagnostics n_msgs = row_count;
  update snaps set storage_path = null, meta_ciphertext = null, meta_nonce = null
   where storage_path is null and meta_ciphertext is not null;
  get diagnostics n_snaps = row_count;
  delete from invite_attempts where at < now() - interval '1 day';
  get diagnostics n_attempts = row_count;
  return jsonb_build_object('messages', n_msgs, 'snaps', n_snaps, 'attempts', n_attempts);
end $$;

-- Streak warning candidates: streak alive, today not complete, ≤4h left (home tz).
create or replace function public.streak_warning_targets()
returns table (couple_id uuid, user_id uuid)
language sql stable security definer set search_path = public as $$
  with c as (
    select cp.*, (now() at time zone cp.home_timezone)::date as today
    from couples cp
    where cp.streak_count > 0
  )
  select c.id, m.user_id
  from c
  join couple_members m on m.couple_id = c.id
  left join streak_days sd on sd.couple_id = c.id and sd.day = c.today
  where c.streak_last_day = c.today - 1
    and c.streak_warned_day is distinct from c.today
    and ((c.today + 1)::timestamp at time zone c.home_timezone) - now() <= interval '4 hours'
    and not coalesce(case when m.role = 'a' then sd.a_sent else sd.b_sent end, false)
$$;

create or replace function public.mark_streak_warned(c uuid)
returns void language sql security definer set search_path = public as $$
  update couples set streak_warned_day = (now() at time zone home_timezone)::date where id = c
$$;

-- Display hygiene: streak is broken when the last complete day is older than
-- yesterday AND the freeze grace day has also passed.
create or replace function public.reset_broken_streaks()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update couples set streak_count = 0
   where streak_count > 0
     and streak_last_day < (now() at time zone home_timezone)::date - 2;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.expired_snap_paths() from public, anon, authenticated;
revoke execute on function public.finalize_purge() from public, anon, authenticated;
revoke execute on function public.streak_warning_targets() from public, anon, authenticated;
revoke execute on function public.mark_streak_warned(uuid) from public, anon, authenticated;
revoke execute on function public.reset_broken_streaks() from public, anon, authenticated;

-- ─── storage ───────────────────────────────────────────────────────────────
-- Object names are "<couple_id>/<uuid>". Everything uploaded is ciphertext.
do $storage$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema missing (local test) — skipping';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('snaps','snaps',false), ('vault','vault',false), ('chat-media','chat-media',false), ('avatars','avatars',false)
  on conflict (id) do nothing;

  execute $p$
    create policy "couple reads own objects" on storage.objects for select to authenticated
    using (bucket_id in ('snaps','vault','chat-media','avatars')
           and (storage.foldername(name))[1] = public.my_couple_id()::text)
  $p$;
  execute $p$
    create policy "couple uploads own objects" on storage.objects for insert to authenticated
    with check (bucket_id in ('snaps','vault','chat-media','avatars')
                and (storage.foldername(name))[1] = public.my_couple_id()::text)
  $p$;
  execute $p$
    create policy "avatar overwrite" on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_couple_id()::text)
  $p$;
  -- deletes: only objects no row points to any more (vault/chat), avatars freely.
  -- snaps are deleted by the snap_opened / purge_expired functions (service role).
  execute $p$
    create policy "couple deletes orphaned objects" on storage.objects for delete to authenticated
    using ((storage.foldername(name))[1] = public.my_couple_id()::text and (
      bucket_id = 'avatars'
      or (bucket_id = 'vault' and not exists (
            select 1 from public.vault_items v where v.storage_path = name or v.thumb_path = name))
      or (bucket_id = 'chat-media' and not exists (
            select 1 from public.messages m where m.media_path = name))))
  $p$;
end
$storage$;

-- ─── realtime ──────────────────────────────────────────────────────────────
do $rt$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication missing (local test) — skipping';
  else
    alter publication supabase_realtime add table
      public.messages, public.message_reactions, public.snaps, public.screenshot_events,
      public.couples, public.couple_members, public.profiles, public.game_sessions,
      public.miss_you_events, public.daily_answers, public.vault_items, public.envelopes;
  end if;

  -- Private broadcast/presence channels: topic must be "couple:<my couple id>"
  if exists (select 1 from pg_namespace where nspname = 'realtime')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'realtime' and c.relname = 'messages') then
    execute $p$
      create policy "couple channel read" on realtime.messages for select to authenticated
      using (realtime.topic() = 'couple:' || public.my_couple_id()::text)
    $p$;
    execute $p$
      create policy "couple channel write" on realtime.messages for insert to authenticated
      with check (realtime.topic() = 'couple:' || public.my_couple_id()::text)
    $p$;
  end if;
end
$rt$;

-- ─── cron (pg_cron + pg_net → edge functions) ──────────────────────────────
-- Requires two Vault secrets (see SETUP.md): project_url and cron_secret.
do $cron$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron/pg_net unavailable (local test) — skipping schedules';
    return;
  end if;
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.schedule('dildar_deliver_scheduled', '* * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/deliver_scheduled',
      headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body := '{}'::jsonb)
  $job$);
  perform cron.schedule('dildar_streak_check', '7 * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/streak_check',
      headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body := '{}'::jsonb)
  $job$);
  perform cron.schedule('dildar_purge_expired', '*/15 * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/purge_expired',
      headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body := '{}'::jsonb)
  $job$);
end
$cron$;
