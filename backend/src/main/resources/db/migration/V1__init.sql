-- Combat Achievements Tracker — initial schema.
-- tasks: mirror of the wiki's combat_achievement Bucket (source of truth = wiki).
-- task_progress: the single local user's completions (source of truth = this app).

CREATE TABLE tasks (
    id             BIGSERIAL PRIMARY KEY,
    wiki_id        INTEGER      NOT NULL UNIQUE,      -- CA task id 0..645 (stable natural key)
    name           TEXT         NOT NULL,
    monster        TEXT,                              -- null when the wiki says "None"
    description    TEXT         NOT NULL,             -- the bucket `task` field, sanitized
    tier           TEXT         NOT NULL,             -- EASY|MEDIUM|HARD|ELITE|MASTER|GRANDMASTER
    type           TEXT         NOT NULL,             -- KILL_COUNT|RESTRICTION|PERFECTION|MECHANICAL|SPEED|STAMINA
    league_region  TEXT,
    points         SMALLINT     NOT NULL,             -- derived from tier (1..6)
    completion_pct NUMERIC(5,2),                      -- from completion.json; null = N/A
    retired        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_tier    ON tasks (tier);
CREATE INDEX idx_tasks_type    ON tasks (type);
CREATE INDEX idx_tasks_monster ON tasks (monster);

-- Progress kept in its own table so multi-user is a later additive change (add user_id + FK).
CREATE TABLE task_progress (
    task_id      BIGINT       PRIMARY KEY REFERENCES tasks (id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ  NOT NULL DEFAULT now()  -- row present ⇒ completed
);

CREATE TABLE sync_log (
    id          BIGSERIAL   PRIMARY KEY,
    source      TEXT        NOT NULL,                 -- 'full' | 'bucket' | 'completion'
    row_count   INTEGER,
    status      TEXT        NOT NULL,                 -- 'ok' | 'error'
    message     TEXT,
    started_at  TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ
);
