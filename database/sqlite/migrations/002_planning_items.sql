CREATE TABLE planning_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 255),
  planned_date TEXT NOT NULL CHECK(length(planned_date)=10 AND planned_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(planned_date, '+0 days') IS NOT NULL AND date(planned_date, '+0 days')=planned_date),
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 999999999999),
  created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;
CREATE INDEX planning_items_date_idx ON planning_items(planned_date, id);
