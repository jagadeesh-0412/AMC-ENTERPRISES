-- Run once in Supabase SQL Editor after deploying the Gmail-enabled AMC project.
alter table public.settings add column if not exists gmail_enabled boolean not null default false;
alter table public.settings add column if not exists gmail_address text not null default '';
alter table public.settings add column if not exists gmail_admin_email text not null default '';
alter table public.settings add column if not exists gmail_refresh_token_enc text not null default '';
alter table public.settings add column if not exists gmail_connected_at timestamptz;
alter table public.settings add column if not exists email_new_order boolean not null default true;
alter table public.settings add column if not exists email_order_confirmed boolean not null default true;
alter table public.settings add column if not exists email_order_packed boolean not null default true;
alter table public.settings add column if not exists email_order_cancelled boolean not null default true;
alter table public.settings add column if not exists email_product_request boolean not null default true;
alter table public.settings add column if not exists email_review boolean not null default true;
alter table public.settings add column if not exists email_enquiry boolean not null default true;

create table if not exists public.notification_log (
  id text primary key,
  event_key text not null unique,
  order_id text,
  recipient_type text not null,
  recipient_phone text not null default '',
  event_type text not null,
  provider text not null default 'none',
  provider_message_id text not null default '',
  status text not null default 'pending',
  error text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  old_status text not null default '',
  new_status text not null,
  changed_by text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.notification_log enable row level security;
alter table public.order_status_history enable row level security;
grant select, insert, update, delete on table public.notification_log to service_role;
grant select, insert, update, delete on table public.order_status_history to service_role;
