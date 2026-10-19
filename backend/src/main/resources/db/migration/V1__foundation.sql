CREATE TABLE schema_foundation (
    id SMALLINT PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT schema_foundation_singleton CHECK (id = 1)
);

COMMENT ON TABLE schema_foundation IS
    'Marks that the backend schema exists. This table holds no racing records.';

INSERT INTO schema_foundation (id, name)
VALUES (1, 'horsepredictor');
