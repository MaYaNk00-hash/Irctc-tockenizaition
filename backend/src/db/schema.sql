-- Database Schema for Tatkal Fair-Booking System

CREATE TABLE IF NOT EXISTS seat_inventory (
    id BIGSERIAL PRIMARY KEY,
    train_id TEXT NOT NULL,
    seat_class TEXT NOT NULL,
    travel_date DATE NOT NULL,
    total_seats INT NOT NULL,
    available_seats INT NOT NULL,
    version INT NOT NULL DEFAULT 0,
    UNIQUE (train_id, seat_class, travel_date)
);

CREATE TABLE IF NOT EXISTS seat_tokens (
    token_id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL,
    inventory_id BIGINT REFERENCES seat_inventory(id),
    status TEXT NOT NULL CHECK (status IN
        ('RESERVED','PAYMENT_PROCESSING','CONFIRMED',
         'EXPIRED','PAYMENT_FAILED','REFUND_INITIATED','REFUND_COMPLETED')),
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    pnr TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS token_seats (
    id BIGSERIAL PRIMARY KEY,
    token_id UUID REFERENCES seat_tokens(token_id),
    passenger_name TEXT,
    seat_number TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    txn_id UUID PRIMARY KEY,
    token_id UUID REFERENCES seat_tokens(token_id),
    amount NUMERIC(10,2),
    gateway_status TEXT,
    initiated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS status_audit_log (
    id BIGSERIAL PRIMARY KEY,
    token_id UUID REFERENCES seat_tokens(token_id),
    from_status TEXT,
    to_status TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS waiting_room_tickets (
    ticket_id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL,
    train_id TEXT, seat_class TEXT, travel_date DATE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    batch_number INT,
    status TEXT CHECK (status IN ('QUEUED','ADMITTED','EXPIRED'))
);

CREATE TABLE IF NOT EXISTS risk_scores (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    device_fingerprint TEXT,
    score NUMERIC(5,2),
    signals JSONB,
    friction_applied TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
