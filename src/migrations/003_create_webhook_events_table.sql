CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY,
    event_id TEXT,
    event_type TEXT,
    order_id UUID,
    decision VARCHAR(40) NOT NULL CHECK (
        decision IN (
            'accepted',
            'rejected_signature',
            'rejected_payload',
            'rejected_duplicate',
            'rejected_not_found'
        )
    ),
    reason TEXT,
    signature_valid BOOLEAN NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_webhook_events_order_id
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id ON webhook_events(order_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_accepted_event_id_unique
    ON webhook_events(event_id)
    WHERE decision = 'accepted' AND event_id IS NOT NULL;
