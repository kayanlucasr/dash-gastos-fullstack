CREATE TABLE categories(id INTEGER PRIMARY KEY,codigo TEXT NOT NULL UNIQUE,nome TEXT NOT NULL UNIQUE) STRICT;
CREATE TABLE accounts(id INTEGER PRIMARY KEY,nome TEXT NOT NULL UNIQUE CHECK(length(trim(nome)) BETWEEN 1 AND 100),tipo TEXT NOT NULL CHECK(tipo IN ('available','reserve','investment')),created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))) STRICT;
CREATE TABLE transactions(
 id INTEGER PRIMARY KEY,descricao TEXT NOT NULL CHECK(length(trim(descricao)) BETWEEN 1 AND 255),
 valor_centavos INTEGER NOT NULL CHECK(valor_centavos>0 AND valor_centavos<=999999999999),
 tipo TEXT NOT NULL CHECK(tipo IN ('income','expense','transfer','adjustment')),data TEXT NOT NULL CHECK(length(data)=10 AND date(data,'+0 days') IS NOT NULL AND date(data,'+0 days')=data),
 category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,source_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,destination_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),cancelled_at TEXT,
 CHECK(source_account_id IS NOT destination_account_id),
 CHECK((tipo='income' AND source_account_id IS NULL AND destination_account_id IS NOT NULL) OR
 (tipo='expense' AND source_account_id IS NOT NULL AND destination_account_id IS NULL) OR
 (tipo='transfer' AND source_account_id IS NOT NULL AND destination_account_id IS NOT NULL AND category_id IS NULL) OR
 (tipo='adjustment' AND ((source_account_id IS NULL)<>(destination_account_id IS NULL)) AND category_id IS NULL)),
 CHECK(tipo NOT IN ('income','expense') OR category_id IS NOT NULL)
) STRICT;
CREATE INDEX transactions_date ON transactions(data,id) WHERE cancelled_at IS NULL;
CREATE INDEX transactions_source_date ON transactions(source_account_id,data) WHERE cancelled_at IS NULL;
CREATE INDEX transactions_destination_date ON transactions(destination_account_id,data) WHERE cancelled_at IS NULL;
CREATE TABLE investment_valuations(id INTEGER PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,data TEXT NOT NULL CHECK(date(data,'+0 days') IS NOT NULL AND date(data,'+0 days')=data),valor_centavos INTEGER NOT NULL CHECK(valor_centavos>=0 AND valor_centavos<=999999999999),created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),transaction_id INTEGER UNIQUE REFERENCES transactions(id),UNIQUE(account_id,data)) STRICT;
CREATE TABLE monthly_closings(id INTEGER PRIMARY KEY,month TEXT NOT NULL UNIQUE CHECK(length(month)=10 AND substr(month,9,2)='01' AND date(month,'+0 days') IS NOT NULL AND date(month,'+0 days')=month),summary TEXT NOT NULL CHECK(json_valid(summary)),revision INTEGER NOT NULL DEFAULT 1,closed_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))) STRICT;
CREATE TABLE monthly_category_totals(closing_id INTEGER NOT NULL REFERENCES monthly_closings(id) ON DELETE CASCADE,category_id INTEGER NOT NULL REFERENCES categories(id),total_centavos INTEGER NOT NULL CHECK(total_centavos>=0),PRIMARY KEY(closing_id,category_id)) STRICT;
CREATE TABLE market_indicators(code TEXT PRIMARY KEY,nome TEXT NOT NULL,provider TEXT NOT NULL,symbol TEXT NOT NULL,currency TEXT NOT NULL,unit TEXT NOT NULL) STRICT;
CREATE TABLE market_quotes(indicator_code TEXT NOT NULL REFERENCES market_indicators(code),provider TEXT NOT NULL,quoted_at TEXT NOT NULL,price TEXT NOT NULL,change_percent TEXT,fetched_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),PRIMARY KEY(indicator_code,provider,quoted_at)) STRICT;
CREATE INDEX market_quotes_recent ON market_quotes(indicator_code,quoted_at DESC);
CREATE TABLE market_sync_state(indicator_code TEXT PRIMARY KEY REFERENCES market_indicators(code),attempted_at TEXT,succeeded_at TEXT,next_attempt_at TEXT,lease_until TEXT,error TEXT) STRICT;
INSERT INTO categories VALUES(1,'food','Alimentação'),(2,'transport','Transporte'),(3,'housing','Moradia'),(4,'health','Saúde'),(5,'leisure','Lazer'),(6,'education','Educação'),(7,'other','Outros');
INSERT INTO accounts(nome,tipo) VALUES('Conta disponível','available');
INSERT INTO market_indicators VALUES('USD','Dólar','awesome','USD-BRL','BRL','1 USD'),('EUR','Euro','awesome','EUR-BRL','BRL','1 EUR'),('BTC','Bitcoin','coingecko','bitcoin','BRL','1 BTC'),('IBOV','Ibovespa','brapi','^BVSP','POINTS','pontos'),('GOLD','Ouro','goldapi','XAU','USD','onça troy');
