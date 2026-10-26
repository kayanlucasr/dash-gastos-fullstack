-- Preserve financial IDs and data; refuse to combine multiple owners.
DO $$ BEGIN
 IF (SELECT count(*) FROM users)>1 THEN RAISE EXCEPTION 'Multiple users: migration requires review'; END IF;
END $$;
LOCK TABLE users,accounts,transactions,investment_valuations,monthly_closings IN ACCESS EXCLUSIVE MODE;
ALTER TABLE transactions DROP CONSTRAINT transactions_source_account_id_user_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT transactions_destination_account_id_user_id_fkey;
ALTER TABLE investment_valuations DROP CONSTRAINT investment_valuations_account_id_user_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_source_account_fkey FOREIGN KEY(source_account_id) REFERENCES accounts(id) ON DELETE RESTRICT;
ALTER TABLE transactions ADD CONSTRAINT transactions_destination_account_fkey FOREIGN KEY(destination_account_id) REFERENCES accounts(id) ON DELETE RESTRICT;
ALTER TABLE investment_valuations ADD CONSTRAINT valuations_account_fkey FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE RESTRICT;
ALTER TABLE accounts DROP COLUMN user_id;
ALTER TABLE transactions DROP COLUMN user_id;
ALTER TABLE investment_valuations DROP COLUMN user_id;
ALTER TABLE monthly_closings DROP COLUMN user_id;
ALTER TABLE accounts ADD CONSTRAINT accounts_nome_key UNIQUE(nome);
ALTER TABLE monthly_closings ADD CONSTRAINT monthly_closings_month_key UNIQUE(month);
CREATE INDEX transactions_date ON transactions(data,id) WHERE cancelled_at IS NULL;
DROP TABLE users;
INSERT INTO accounts(nome,tipo) SELECT 'Conta disponível','available' WHERE NOT EXISTS(SELECT 1 FROM accounts WHERE tipo='available') ON CONFLICT(nome) DO NOTHING;
INSERT INTO schema_migrations(version) VALUES('003_single_wallet');
