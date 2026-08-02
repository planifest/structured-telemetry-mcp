/**
 * DuckDB schema DDL for the telemetry store.
 * Single events table — see ADR-004.
 */
export const CREATE_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS events (
    id           VARCHAR    NOT NULL DEFAULT gen_random_uuid(),
    schema_version VARCHAR  NOT NULL,
    event        VARCHAR    NOT NULL,
    session_id   VARCHAR    NOT NULL,
    initiative_id VARCHAR,
    product_id   VARCHAR,
    phase        VARCHAR    NOT NULL,
    agent        VARCHAR    NOT NULL,
    tool         VARCHAR    NOT NULL,
    model        VARCHAR    NOT NULL,
    mcp_mode     VARCHAR    NOT NULL,
    timestamp    TIMESTAMPTZ NOT NULL,
    model_config JSON,
    data         JSON,
    inserted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
  )
`;

/** Run against existing databases to add the model_config column without data loss. */
export const MIGRATE_ADD_MODEL_CONFIG = `
  ALTER TABLE events ADD COLUMN IF NOT EXISTS model_config JSON
`;

/** Run against existing databases to add the product_id column without data loss (0000015, ADR-017). */
export const MIGRATE_ADD_PRODUCT_ID = `
  ALTER TABLE events ADD COLUMN IF NOT EXISTS product_id VARCHAR
`;

export const CREATE_SESSION_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_events_session_id
  ON events (session_id)
`;

export const CREATE_EVENT_TIMESTAMP_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_events_event_timestamp
  ON events (event, timestamp)
`;

export const CREATE_PHASE_SESSION_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_events_phase_session
  ON events (phase, session_id)
`;
