-- Credentials remain in Firebase Auth; this schema stores only the Firebase UID mapping.
-- RLS is enabled without policies until the application's read/write roles are specified.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.updated_at := now();
	return new;
end;
$$;

revoke execute on function public.set_updated_at() from public;

create table public.users (
	user_id uuid primary key default gen_random_uuid(),
	firebase_uid text not null unique check (btrim(firebase_uid) <> ''),
	name varchar(100) not null check (btrim(name) <> ''),
	email varchar(100) not null check (btrim(email) <> ''),
	phone varchar(20),
	role varchar(50) not null check (btrim(role) <> ''),
	is_active boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create unique index users_email_lower_uidx on public.users (lower(email));

create table public.admins (
	admin_id uuid primary key default gen_random_uuid(),
	firebase_uid text not null unique check (btrim(firebase_uid) <> ''),
	name varchar(100) not null check (btrim(name) <> ''),
	email varchar(100) not null check (btrim(email) <> ''),
	role varchar(50) not null check (btrim(role) <> ''),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create unique index admins_email_lower_uidx on public.admins (lower(email));

create table public.devices (
	device_id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (user_id) on delete cascade,
	device_name varchar(100) not null check (btrim(device_name) <> ''),
	os_type varchar(50) not null check (btrim(os_type) <> ''),
	device_model varchar(100) not null check (btrim(device_model) <> ''),
	device_id_hash varchar(255) not null check (btrim(device_id_hash) <> ''),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index devices_user_id_idx on public.devices (user_id);

create table public.anti_theft (
	theft_id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (user_id) on delete cascade,
	location varchar(255) not null check (btrim(location) <> ''),
	status varchar(50) not null check (btrim(status) <> ''),
	action_taken varchar(100) not null check (btrim(action_taken) <> ''),
	locked_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index anti_theft_user_id_idx on public.anti_theft (user_id);

create table public.phishing_detections (
	phishing_id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (user_id) on delete cascade,
	url text not null check (btrim(url) <> ''),
	risk_score numeric(5, 2) not null check (risk_score between 0 and 100),
	status varchar(50) not null check (btrim(status) <> ''),
	scanned_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index phishing_detections_user_scanned_idx
	on public.phishing_detections (user_id, scanned_at desc);

create table public.vpn_connections (
	vpn_id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (user_id) on delete cascade,
	server_location varchar(100) not null check (btrim(server_location) <> ''),
	connection_status varchar(50) not null check (btrim(connection_status) <> ''),
	ip_address inet not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index vpn_connections_user_id_idx on public.vpn_connections (user_id);

create table public.app_permissions (
	permission_id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (user_id) on delete cascade,
	app_name varchar(100) not null check (btrim(app_name) <> ''),
	permission_type varchar(100) not null check (btrim(permission_type) <> ''),
	status varchar(50) not null check (btrim(status) <> ''),
	granted_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index app_permissions_user_id_idx on public.app_permissions (user_id);

create table public.protection_settings (
	settings_id uuid primary key default gen_random_uuid(),
	user_id uuid not null unique references public.users (user_id) on delete cascade,
	biometric_enabled boolean not null default false,
	auto_lock boolean not null default true,
	data_wipe_enabled boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.security_logs (
	log_id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (user_id) on delete cascade,
	event_type varchar(100) not null check (btrim(event_type) <> ''),
	description text not null check (btrim(description) <> ''),
	severity varchar(50) not null check (btrim(severity) <> ''),
	"timestamp" timestamptz not null default now()
);

create index security_logs_user_timestamp_idx
	on public.security_logs (user_id, "timestamp" desc);

create table public.audit_events (
	event_id uuid primary key default gen_random_uuid(),
	admin_id uuid references public.admins (admin_id) on delete set null,
	user_id uuid references public.users (user_id) on delete set null,
	action varchar(100) not null check (btrim(action) <> ''),
	target varchar(100) not null check (btrim(target) <> ''),
	"timestamp" timestamptz not null default now()
);

create index audit_events_admin_timestamp_idx
	on public.audit_events (admin_id, "timestamp" desc)
	where admin_id is not null;
create index audit_events_user_timestamp_idx
	on public.audit_events (user_id, "timestamp" desc)
	where user_id is not null;

create table public.app_sessions (
	session_id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (user_id) on delete cascade,
	login_time timestamptz not null default now(),
	logout_time timestamptz,
	ip_address inet not null,
	status varchar(50) not null check (btrim(status) <> ''),
	updated_at timestamptz not null default now(),
	constraint app_sessions_logout_after_login_check
		check (logout_time is null or logout_time >= login_time)
);

create index app_sessions_user_login_idx
	on public.app_sessions (user_id, login_time desc);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger admins_set_updated_at
before update on public.admins
for each row execute function public.set_updated_at();

create trigger devices_set_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

create trigger anti_theft_set_updated_at
before update on public.anti_theft
for each row execute function public.set_updated_at();

create trigger phishing_detections_set_updated_at
before update on public.phishing_detections
for each row execute function public.set_updated_at();

create trigger vpn_connections_set_updated_at
before update on public.vpn_connections
for each row execute function public.set_updated_at();

create trigger app_permissions_set_updated_at
before update on public.app_permissions
for each row execute function public.set_updated_at();

create trigger protection_settings_set_updated_at
before update on public.protection_settings
for each row execute function public.set_updated_at();

create trigger app_sessions_set_updated_at
before update on public.app_sessions
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.admins enable row level security;
alter table public.devices enable row level security;
alter table public.anti_theft enable row level security;
alter table public.phishing_detections enable row level security;
alter table public.vpn_connections enable row level security;
alter table public.app_permissions enable row level security;
alter table public.protection_settings enable row level security;
alter table public.security_logs enable row level security;
alter table public.audit_events enable row level security;
alter table public.app_sessions enable row level security;
