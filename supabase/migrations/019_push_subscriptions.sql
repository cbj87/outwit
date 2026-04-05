-- ============================================================
-- 019_push_subscriptions.sql
-- Web Push subscription storage for browser push notifications.
-- ============================================================

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth_key   text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can insert own push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can read own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (auth.uid() = user_id);
