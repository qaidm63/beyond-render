-- ============================================================
-- Shadow Matrix — database schema (Blueprint § 6 Phase 2)
-- PostgreSQL + pgvector on Supabase.
--
-- Idempotent: safe to re-run.
-- Apply via the Supabase SQL editor, or:
--   psql "$DATABASE_URL" -f backend/db/schema.sql
--
-- EMBEDDING WIDTH: vector(768) matches Gemini `text-embedding-004`.
-- Operator-confirmed. Must stay in lockstep with EMBEDDING_DIMENSIONS in
-- backend/core/config.py; changing either alone corrupts every score.
-- Changing the model means changing this width AND re-embedding everything.
-- ============================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Portfolio evidence + embeddings (§ 3.a)
-- ------------------------------------------------------------

create table if not exists projects (
    project_id      text primary key,
    title           text        not null,
    category        text        not null,
    status          text        not null,
    scope           jsonb       not null default '[]'::jsonb,
    decision_log    jsonb       not null,
    evidence_layer  jsonb       not null default '{}'::jsonb,
    software_stack  jsonb       not null default '[]'::jsonb,
    updated_at      timestamptz not null default now()
);

create table if not exists project_embeddings (
    project_id      text primary key references projects (project_id) on delete cascade,
    -- The flattened document that was embedded; kept for auditability so we
    -- can tell whether a re-embed is actually required.
    source_document text        not null,
    -- sha256 of source_document + model id: lets ingestion skip unchanged rows.
    content_hash    text        not null,
    model           text        not null,
    embedding       vector(768) not null,
    updated_at      timestamptz not null default now()
);

-- IVFFlat needs data before it is useful; with a handful of projects a
-- sequential scan is faster. Index kept for when the corpus grows.
create index if not exists project_embeddings_vector_idx
    on project_embeddings using ivfflat (embedding vector_cosine_ops)
    with (lists = 10);

-- ------------------------------------------------------------
-- Scout pipeline (§ 4, § 5.1)
-- ------------------------------------------------------------

create table if not exists jobs (
    id              uuid primary key default gen_random_uuid(),
    -- Stable cross-run identity: sha256(source + external id | url).
    fingerprint     text        not null unique,
    title           text        not null,
    company         text        not null,
    company_id      text        not null,
    location        text,
    url             text        not null,
    source          text        not null,
    engine          text        not null check (engine in ('xhr', 'dom')),
    description     text,
    contract_type   text,
    is_remote       boolean,
    fit_score       numeric(5, 2),
    -- Which project matched best, for explainability in the Radar.
    best_project_id text references projects (project_id) on delete set null,
    rejection_reason text,
    stage           text        not null default 'discovered'
                    check (stage in ('discovered', 'high_match', 'ready_to_apply', 'applied')),
    posted_at       timestamptz,
    discovered_at   timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists jobs_stage_idx     on jobs (stage);
create index if not exists jobs_fit_score_idx on jobs (fit_score desc nulls last);
create index if not exists jobs_discovered_idx on jobs (discovered_at desc);

-- ------------------------------------------------------------
-- Swarm control matrix (§ 3.b)
-- ------------------------------------------------------------

create table if not exists agent_config (
    id                 int primary key default 1 check (id = 1), -- singleton row
    work_model         jsonb       not null,
    target_locations   jsonb       not null,
    contract_type      jsonb       not null,
    matching_threshold int         not null default 85
                       check (matching_threshold between 0 and 100),
    search_terms       jsonb       not null default '[]'::jsonb,
    updated_at         timestamptz not null default now()
);

insert into agent_config (id, work_model, target_locations, contract_type, matching_threshold, search_terms)
values (
    1,
    '{"remoteWorldwide": true, "onSite": true, "hybrid": true}'::jsonb,
    '["United Arab Emirates", "Saudi Arabia", "Qatar", "Oman", "Remote"]'::jsonb,
    '{"fullTime": true, "projectBased": true, "freelance": false}'::jsonb,
    85,
    '["Architect", "Architectural Designer", "Interior Designer", "BIM Coordinator", "Revit Architect", "Urban Planner", "Site Supervisor Architecture"]'::jsonb
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Dynamic pitches (§ 5.3) — populated in Phase 4
-- ------------------------------------------------------------

create table if not exists pitches (
    company_id           text primary key,
    company_name         text        not null,
    job_id               uuid references jobs (id) on delete set null,
    cover_letter         text        not null default '',
    featured_project_ids jsonb       not null default '[]'::jsonb,
    approved             boolean     not null default false,
    view_count           int         not null default 0,
    created_at           timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Telemetry (§ 5.4)
-- ------------------------------------------------------------

create table if not exists telemetry_events (
    id         bigserial primary key,
    event_type text        not null,
    company_id text,
    job_id     uuid,
    metadata   jsonb       not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists telemetry_type_idx on telemetry_events (event_type, created_at desc);

-- ------------------------------------------------------------
-- Semantic Gatekeeper RPC (§ 4.3)
--
-- Returns the best-matching project for a job embedding, with similarity
-- rescaled to a 0–100 Fit Score. Cosine distance (<=>) is in [0, 2];
-- similarity = 1 - distance, clamped at 0 so opposing vectors score 0
-- rather than going negative.
-- ------------------------------------------------------------

create or replace function match_portfolio (
    query_embedding vector(768),
    match_count     int default 3
)
returns table (
    project_id text,
    title      text,
    fit_score  numeric
)
language sql stable
as $$
    select
        p.project_id,
        p.title,
        round(greatest(0, 1 - (pe.embedding <=> query_embedding))::numeric * 100, 2) as fit_score
    from project_embeddings pe
    join projects p on p.project_id = pe.project_id
    order by pe.embedding <=> query_embedding
    limit match_count;
$$;

-- ------------------------------------------------------------
-- Row Level Security
--
-- Every table is locked down. The backend uses the service-role key, which
-- bypasses RLS; no anonymous client may read the pipeline. The public site
-- never queries these tables directly.
-- ------------------------------------------------------------

alter table projects           enable row level security;
alter table project_embeddings enable row level security;
alter table jobs               enable row level security;
alter table agent_config       enable row level security;
alter table pitches            enable row level security;
alter table telemetry_events   enable row level security;
