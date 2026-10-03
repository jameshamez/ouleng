-- อูเล้งคาเฟ่: schema. All access goes through the Next.js server with the
-- service role key, so RLS is enabled with no policies (anon/auth get nothing).

create table menu_categories (
  id text primary key,
  name text not null,
  emoji text not null default '',
  sort int not null default 0
);

create table menu_items (
  id text primary key,
  category_id text not null references menu_categories(id),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  emoji text not null default '',
  station text not null check (station in ('somtam','cafe')),
  is_available boolean not null default true,
  is_signature boolean not null default false,
  options jsonb not null default '[]',
  sort int not null default 0
);

create table tables (
  id text primary key,
  code text not null unique,
  zone text not null check (zone in ('indoor','canal')),
  seats int not null check (seats > 0)
);

create table customers (
  id text primary key, -- LINE userId
  display_name text not null,
  picture_url text
);

create table bookings (
  id text primary key,
  line_user_id text not null,
  name text not null,
  phone text not null,
  party_size int not null check (party_size > 0),
  date date not null,
  time text not null,
  zone text not null check (zone in ('indoor','canal')),
  note text not null default '',
  status text not null check (status in ('pending','confirmed','rejected','seated','cancelled')),
  table_id text references tables(id),
  created_at timestamptz not null default now()
);
create index on bookings (date);

create table dining_sessions (
  id text primary key,
  table_id text not null references tables(id),
  booking_id text references bookings(id),
  status text not null check (status in ('open','bill_requested','paid')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
-- at most one live session per table
create unique index one_live_session_per_table on dining_sessions (table_id) where status <> 'paid';

create table orders (
  id text primary key,
  type text not null check (type in ('dine_in','takeaway','preorder')),
  session_id text references dining_sessions(id),
  booking_id text references bookings(id),
  line_user_id text not null,
  customer_name text not null,
  pickup_time text,
  status text not null check (status in ('awaiting_payment','placed','ready','picked_up','cancelled')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index on orders (session_id);
create index on orders (status);

create table order_items (
  id text primary key,
  order_id text not null references orders(id),
  menu_item_id text not null references menu_items(id),
  name text not null,
  unit_price numeric(10,2) not null,
  qty int not null check (qty > 0),
  options jsonb not null default '[]',
  note text not null default '',
  station text not null check (station in ('somtam','cafe')),
  status text not null check (status in ('held','queued','cooking','ready','served','cancelled')),
  created_at timestamptz not null default now()
);
create index on order_items (status, station);
create index on order_items (order_id);

create table payments (
  id text primary key,
  target_type text not null check (target_type in ('session','order')),
  target_id text not null,
  amount numeric(10,2) not null,
  method text not null check (method in ('promptpay','cash')),
  slip_url text,
  status text not null check (status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index on payments (status);

alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table tables enable row level security;
alter table customers enable row level security;
alter table bookings enable row level security;
alter table dining_sessions enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;

-- Private bucket for payment slips; staff view them through short-lived signed URLs.
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false)
on conflict (id) do nothing;
