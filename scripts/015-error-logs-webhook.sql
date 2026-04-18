-- 015: Error logging table + pg_net webhook notification
-- Run this in Supabase SQL Editor

-- Enable pg_net if not already
create extension if not exists pg_net with schema extensions;

-- Error logs table
create table if not exists public.error_logs (
  id bigint generated always as identity primary key,
  source text not null,           -- 'app', 'n8n', 'ocr', 'rapprochement', 'storage'
  severity text not null default 'error', -- 'warning', 'error', 'critical'
  message text not null,
  details jsonb default '{}',
  created_at timestamptz default now()
);

-- RLS: only service role can insert, authenticated can read
alter table public.error_logs enable row level security;

create policy "Authenticated users can read error logs"
  on public.error_logs for select
  to authenticated
  using (true);

create policy "Service role can insert error logs"
  on public.error_logs for insert
  to service_role
  with check (true);

-- Index for recent errors
create index if not exists idx_error_logs_created_at
  on public.error_logs (created_at desc);

-- Function to notify via n8n webhook on new error
-- Replace YOUR_N8N_WEBHOOK_URL with your actual n8n webhook URL
create or replace function public.notify_error_webhook()
returns trigger
language plpgsql
security definer
as $$
begin
  perform extensions.http_post(
    url := current_setting('app.error_webhook_url', true),
    body := jsonb_build_object(
      'id', NEW.id,
      'source', NEW.source,
      'severity', NEW.severity,
      'message', NEW.message,
      'details', NEW.details,
      'created_at', NEW.created_at
    )::text,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return NEW;
exception when others then
  -- Don't block inserts if webhook fails
  return NEW;
end;
$$;

-- Trigger on new error log
drop trigger if exists trg_notify_error on public.error_logs;
create trigger trg_notify_error
  after insert on public.error_logs
  for each row
  execute function public.notify_error_webhook();

-- Helper RPC to log errors from the app
create or replace function public.log_error(
  p_source text,
  p_message text,
  p_severity text default 'error',
  p_details jsonb default '{}'
)
returns bigint
language sql
security definer
as $$
  insert into public.error_logs (source, severity, message, details)
  values (p_source, p_severity, p_message, p_details)
  returning id;
$$;
