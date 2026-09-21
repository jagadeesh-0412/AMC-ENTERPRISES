-- Run this once in Supabase SQL Editor.
create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null default '',
  manufacturer text not null default '',
  pack text not null default '',
  stock integer not null default 0,
  price numeric(12,2) not null default 0,
  image text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id integer primary key check (id = 1),
  phone text not null default '',
  whatsapp text not null default '',
  sms_to text not null default '',
  email text not null default '',
  address text not null default '',
  hours text not null default '',
  gstin text not null default '',
  hero_title text not null default '',
  hero_sub text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  date text,
  created_at timestamptz not null default now(),
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0,
  payment_status text not null default 'Cash on Delivery',
  status text not null default 'New'
);

create table if not exists public.enquiries (
  id text primary key,
  name text not null,
  phone text not null,
  message text not null,
  date text,
  created_at timestamptz not null default now()
);

-- The backend uses the Supabase secret key, so it can bypass RLS.
-- Keep RLS enabled as a safety boundary for any future browser-side access.
alter table public.products enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;
alter table public.enquiries enable row level security;

insert into public.settings (id, phone, whatsapp, sms_to, email, address, hours, gstin, hero_title, hero_sub)
values (1, '+91 9600364064 / +91 9600364065', '919600364064', '', 'info@amcenterprises.in', 'No. 13, Cauvery College Road, Annamalai Nagar, Tiruchirappalli – 620018, Tamil Nadu', 'Mon – Sat, 9:30 AM – 8:00 PM', '33AASFA8890L1ZO', 'Trusted Healthcare & Pharmaceutical Distribution', 'AMC Enterprises is a Tiruchirappalli-based wholesale and retail business serving healthcare needs with medical and healthcare products, including adhesive tapes, bandages and burn therapy dressings.')
on conflict (id) do nothing;


-- Growth features: product requests, genuine customer reviews and customer accounts.
create table if not exists public.product_requests (
  id text primary key,
  name text not null,
  phone text not null,
  product_name text not null,
  quantity integer not null default 1,
  notes text not null default '',
  date text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id text primary key,
  name text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  review text not null,
  date text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_accounts (
  id text primary key,
  name text not null,
  phone text not null unique,
  email text not null default '',
  address text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists customer_account_id text references public.customer_accounts(id) on delete set null;
alter table public.product_requests enable row level security;
alter table public.reviews enable row level security;
alter table public.customer_accounts enable row level security;

-- Gmail notification fields (also included in gmail_patch.sql for existing databases).
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
