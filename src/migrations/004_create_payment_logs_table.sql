CREATE TABLE IF NOT EXISTS payment_logs (
    id UUID PRIMARY KEY,
    order_id UUID,
    transaction_id UUID,
    event_type VARCHAR(80) NOT NULL,
    status VARCHAR(40) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    CONSTRAINT fk_payment_logs_order_id
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_payment_logs_transaction_id
        FOREIGN KEY (transaction_id)
        REFERENCES transactions(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_order_id ON payment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_transaction_id ON payment_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_event_type ON payment_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_logs_timestamp ON payment_logs(timestamp DESC);

CREATE OR REPLACE FUNCTION prevent_payment_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'payment_logs is append-only and cannot be modified';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_logs_no_update ON payment_logs;
CREATE TRIGGER payment_logs_no_update
    BEFORE UPDATE ON payment_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_payment_logs_mutation();

DROP TRIGGER IF EXISTS payment_logs_no_delete ON payment_logs;
CREATE TRIGGER payment_logs_no_delete
    BEFORE DELETE ON payment_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_payment_logs_mutation();