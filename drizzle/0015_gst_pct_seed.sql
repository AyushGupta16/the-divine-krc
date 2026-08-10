-- Data migration, not a schema change: seeds the gstPct addon_settings row
-- so the Settings page's GST field is never empty on first load. Idempotent —
-- re-running always lands the row at 12, matching the GST_PCT constant
-- (bookings.ts:204) it replaces as the resolver's fallback.
INSERT INTO addon_settings (id, label, price)
VALUES ('gstPct', 'GST', 12)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price;
