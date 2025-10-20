-- EVA Note MVP - Initial Schema Migration
-- Created: 2025-01-20
-- Description: Complete database schema for EVA Note MVP with profiles, patients, visits, transcripts, notes, and usage metrics

-- Enable required extensions
create extension if not exists pgcrypto;

-- =====================================================
-- 1) PROFILES (Clerk user sync)
-- =====================================================
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email text,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_clerk_user_id on profiles(clerk_user_id);

comment on table profiles is 'Physical therapist profiles synced from Clerk authentication';
comment on column profiles.clerk_user_id is 'Clerk user ID from JWT sub claim';

-- =====================================================
-- 2) PATIENTS
-- =====================================================
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint patients_name_not_empty check (
    length(trim(first_name)) > 0 and length(trim(last_name)) > 0
  )
);

create index if not exists idx_patients_owner on patients(owner_id);
create index if not exists idx_patients_created_at on patients(created_at desc);

comment on table patients is 'Patient records managed by physical therapists';
comment on column patients.owner_id is 'Physical therapist who owns this patient record';

-- =====================================================
-- 3) VISITS
-- =====================================================
create type visit_status as enum ('draft', 'recording', 'processing', 'completed', 'failed');
create type language_pref as enum ('de', 'fr', 'auto');

create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  provider_id uuid not null references profiles(id) on delete cascade,
  status visit_status not null default 'draft',
  language_pref language_pref not null default 'de',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint visits_valid_duration check (
    ended_at is null or started_at is null or ended_at > started_at
  )
);

create index if not exists idx_visits_patient on visits(patient_id);
create index if not exists idx_visits_provider on visits(provider_id);
create index if not exists idx_visits_status on visits(status);
create index if not exists idx_visits_created_at on visits(created_at desc);

comment on table visits is 'Individual therapy sessions with patients';
comment on column visits.status is 'Current status: draft, recording, processing, completed, or failed';
comment on column visits.language_pref is 'Preferred language for transcription and SOAP generation (DE by default)';

-- =====================================================
-- 4) TRANSCRIPTS
-- =====================================================
create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  text text not null,
  raw_json jsonb,
  language text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz default now(),

  constraint transcripts_text_min_length check (length(trim(text)) >= 20)
);

create index if not exists idx_transcripts_visit on transcripts(visit_id);

comment on table transcripts is 'Transcribed text from Deepgram (audio is NOT stored, only text)';
comment on column transcripts.text is 'Final transcript text (minimum 20 characters)';
comment on column transcripts.raw_json is 'Raw Deepgram response for debugging';
comment on column transcripts.confidence is 'Deepgram confidence score (0-1)';

-- =====================================================
-- 5) NOTES (SOAP)
-- =====================================================
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  soap jsonb not null,
  model text not null,
  version int not null default 1,
  is_final boolean not null default false,
  created_at timestamptz default now(),

  constraint notes_soap_has_sections check (
    soap ? 'subjective' and
    soap ? 'objective' and
    soap ? 'assessment' and
    soap ? 'plan'
  ),
  constraint notes_version_positive check (version > 0)
);

create index if not exists idx_notes_visit on notes(visit_id);
create index if not exists idx_notes_is_final on notes(is_final);
create index if not exists idx_notes_created_at on notes(created_at desc);

comment on table notes is 'SOAP notes generated by AI (Azure OpenAI) with versioning';
comment on column notes.soap is 'JSONB with keys: subjective, objective, assessment, plan';
comment on column notes.model is 'AI model used (e.g., azure:gpt-4o-mini-eu)';
comment on column notes.version is 'Version number (incremented on regeneration)';
comment on column notes.is_final is 'Whether this note is marked as final by the provider';

-- =====================================================
-- 6) USAGE METRICS (Cost Tracking)
-- =====================================================
create table if not exists usage_metrics (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,

  -- STT (Speech-to-Text)
  stt_seconds integer not null default 0,
  stt_cost_cents integer not null default 0,
  stt_model text,

  -- LLM (Language Model)
  llm_tokens_in integer not null default 0,
  llm_tokens_out integer not null default 0,
  llm_cost_cents integer not null default 0,
  llm_model text,

  -- Total cost (generated column)
  total_cost_cents integer generated always as (
    coalesce(stt_cost_cents, 0) + coalesce(llm_cost_cents, 0)
  ) stored,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint usage_metrics_positive_values check (
    stt_seconds >= 0 and
    stt_cost_cents >= 0 and
    llm_tokens_in >= 0 and
    llm_tokens_out >= 0 and
    llm_cost_cents >= 0
  )
);

create index if not exists idx_usage_metrics_visit on usage_metrics(visit_id);
create index if not exists idx_usage_metrics_created on usage_metrics(created_at desc);

comment on table usage_metrics is 'Cost tracking for STT (Deepgram) and LLM (Azure OpenAI) per visit';
comment on column usage_metrics.stt_cost_cents is 'Deepgram cost in euro cents';
comment on column usage_metrics.llm_cost_cents is 'Azure OpenAI cost in euro cents';
comment on column usage_metrics.total_cost_cents is 'Total cost (STT + LLM) in euro cents (generated)';

-- =====================================================
-- 7) VIEWS
-- =====================================================

-- Monthly usage aggregation
create or replace view monthly_usage as
select
  date_trunc('month', created_at) as month,
  count(distinct visit_id) as visits,
  sum(stt_seconds) as total_stt_seconds,
  sum(total_cost_cents) / 100.0 as total_cost_eur
from usage_metrics
group by 1
order by 1 desc;

comment on view monthly_usage is 'Monthly aggregated usage metrics (visits, STT seconds, total cost in EUR)';

-- =====================================================
-- 8) TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply triggers to all tables with updated_at
drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute procedure set_updated_at();

drop trigger if exists trg_patients_updated_at on patients;
create trigger trg_patients_updated_at
  before update on patients
  for each row execute procedure set_updated_at();

drop trigger if exists trg_visits_updated_at on visits;
create trigger trg_visits_updated_at
  before update on visits
  for each row execute procedure set_updated_at();

drop trigger if exists trg_usage_metrics_updated_at on usage_metrics;
create trigger trg_usage_metrics_updated_at
  before update on usage_metrics
  for each row execute procedure set_updated_at();

-- =====================================================
-- 9) ROW LEVEL SECURITY (RLS)
-- =====================================================

-- NOTE: RLS is intentionally NOT enabled for MVP
-- Security is handled via Server Actions with Clerk userId validation
-- RLS can be enabled post-MVP when JWT claim propagation is configured

-- Example RLS policies (commented out for MVP):
/*
alter table patients enable row level security;
alter table visits enable row level security;
alter table transcripts enable row level security;
alter table notes enable row level security;

-- Helper function to get current user's profile_id from JWT
create or replace function current_profile_id()
returns uuid as $$
  select id from profiles
  where clerk_user_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
$$ language sql stable;

-- Policy: users can only see their own patients
create policy patients_owner_policy on patients
  for select using (owner_id = current_profile_id());

-- Policy: users can only see visits for their patients
create policy visits_provider_policy on visits
  for select using (
    provider_id = current_profile_id() or
    patient_id in (select id from patients where owner_id = current_profile_id())
  );
*/

-- =====================================================
-- END OF MIGRATION
-- =====================================================
