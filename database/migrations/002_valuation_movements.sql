ALTER TABLE investment_valuations ADD COLUMN transaction_id integer UNIQUE REFERENCES transactions(id);
INSERT INTO schema_migrations(version) VALUES ('002_valuation_movements');
