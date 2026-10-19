-- Empty racing and prediction tables. This migration inserts no meetings, runners, results, odds, or predictions.

CREATE TABLE country (
    id UUID PRIMARY KEY,
    code VARCHAR(8) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL
);

CREATE TABLE venue (
    id UUID PRIMARY KEY,
    country_id UUID NOT NULL REFERENCES country (id),
    name VARCHAR(120) NOT NULL
);

CREATE TABLE horse (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL
);

CREATE TABLE person (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL
);

CREATE TABLE meeting (
    id UUID PRIMARY KEY,
    venue_id UUID NOT NULL REFERENCES venue (id),
    meeting_date DATE NOT NULL
);

CREATE TABLE race (
    id UUID PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES meeting (id),
    off_time TIMESTAMPTZ NOT NULL,
    country_code VARCHAR(8) NOT NULL,
    distance_metres INTEGER,
    surface VARCHAR(40),
    race_class VARCHAR(40),
    going VARCHAR(40),
    race_type VARCHAR(40),
    course_name VARCHAR(120)
);

CREATE INDEX race_off_time_idx ON race (off_time);

CREATE TABLE runner_entry (
    id UUID PRIMARY KEY,
    race_id UUID NOT NULL REFERENCES race (id),
    horse_id UUID NOT NULL REFERENCES horse (id),
    jockey_id UUID REFERENCES person (id),
    trainer_id UUID REFERENCES person (id),
    horse_number INTEGER,
    barrier INTEGER,
    carried_weight_kg NUMERIC(6, 2),
    withdrawn BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE runner_result (
    id UUID PRIMARY KEY,
    runner_entry_id UUID NOT NULL UNIQUE REFERENCES runner_entry (id),
    finishing_position INTEGER,
    margin_lengths NUMERIC(8, 3),
    finish_time_seconds NUMERIC(10, 3),
    sectional_time_seconds NUMERIC(10, 3)
);

CREATE TABLE odds_quote (
    id UUID PRIMARY KEY,
    runner_entry_id UUID NOT NULL REFERENCES runner_entry (id),
    quoted_at TIMESTAMPTZ,
    decimal_odds NUMERIC(10, 3) NOT NULL,
    source VARCHAR(80) NOT NULL
);

CREATE TABLE prediction (
    id UUID PRIMARY KEY,
    race_id UUID NOT NULL REFERENCES race (id),
    created_at TIMESTAMPTZ NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    feature_cutoff TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL,
    declaration_fingerprint VARCHAR(128) NOT NULL,
    message VARCHAR(1000) NOT NULL
);

CREATE INDEX prediction_race_created_idx ON prediction (race_id, created_at DESC);

CREATE TABLE prediction_runner (
    id UUID PRIMARY KEY,
    prediction_id UUID NOT NULL REFERENCES prediction (id),
    runner_entry_id UUID NOT NULL REFERENCES runner_entry (id),
    probability NUMERIC(8, 4),
    rank_position INTEGER
);

CREATE TABLE prediction_factor (
    id UUID PRIMARY KEY,
    prediction_runner_id UUID NOT NULL REFERENCES prediction_runner (id),
    factor_name VARCHAR(64) NOT NULL,
    available BOOLEAN NOT NULL,
    numeric_value DOUBLE PRECISION,
    detail VARCHAR(400) NOT NULL
);
