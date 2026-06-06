-- Migration: Add max_selections to addon_groups + insert Chicken Over Rice modifiers
-- Run: psql -U postgres -d habibi_db -f this_file.sql

-- ── 1. Schema change ─────────────────────────────────────────────────────────
ALTER TABLE addon_groups ADD COLUMN IF NOT EXISTS max_selections INTEGER;

-- ── 2. Insert modifier data for Chicken Over Rice ─────────────────────────────
DO $$
DECLARE
  item_id       INTEGER;
  group_sauces  INTEGER;
  group_sides   INTEGER;
  group_bevs    INTEGER;
BEGIN
  SELECT id INTO item_id
  FROM menu_items
  WHERE title ILIKE '%chicken%rice%'
  LIMIT 1;

  IF item_id IS NULL THEN
    RAISE EXCEPTION 'Chicken Over Rice not found in menu_items — check title';
  END IF;

  RAISE NOTICE 'Chicken Over Rice id = %', item_id;

  -- Remove existing addon groups to avoid duplicates on re-run
  DELETE FROM addon_groups WHERE menu_item_id = item_id;

  -- ── Add Sauces ──────────────────────────────────────────────────────────────
  INSERT INTO addon_groups (menu_item_id, title, preference, max_selections)
  VALUES (item_id, 'Add Sauces', 1, NULL)          -- unlimited
  RETURNING id INTO group_sauces;

  INSERT INTO addon_options (addon_group_id, title, price, preference) VALUES
    (group_sauces, 'White Sauce', 0.50, 1),
    (group_sauces, 'Hot Sauce',   0.50, 2),
    (group_sauces, 'BBQ Sauce',   0.50, 3),
    (group_sauces, 'Ketchup',     0.00, 4),
    (group_sauces, 'Mustard',     0.00, 5);

  -- ── Choose Sides ────────────────────────────────────────────────────────────
  INSERT INTO addon_groups (menu_item_id, title, preference, max_selections)
  VALUES (item_id, 'Choose Sides', 2, NULL)         -- unlimited
  RETURNING id INTO group_sides;

  INSERT INTO addon_options (addon_group_id, title, price, preference) VALUES
    (group_sides, 'Fries',       3.00, 1),
    (group_sides, 'Pita',        1.00, 2),
    (group_sides, 'Extra Rice',  3.00, 3),
    (group_sides, 'Falafel',     2.25, 4),
    (group_sides, 'Samosas',     3.50, 5),
    (group_sides, 'Wings',       3.50, 6),
    (group_sides, 'Empanadas',   3.25, 7),
    (group_sides, 'Extra Meat',  2.50, 8);

  -- ── Beverages ───────────────────────────────────────────────────────────────
  INSERT INTO addon_groups (menu_item_id, title, preference, max_selections)
  VALUES (item_id, 'Beverages', 3, 1)               -- pick 1 beverage
  RETURNING id INTO group_bevs;

  INSERT INTO addon_options (addon_group_id, title, price, preference) VALUES
    (group_bevs, 'Water',    1.00, 1),
    (group_bevs, 'Soda',     1.50, 2),
    (group_bevs, 'Snapple',  2.00, 3),
    (group_bevs, 'Gatorade', 2.50, 4);

  RAISE NOTICE 'Done — sauces=%, sides=%, beverages=%', group_sauces, group_sides, group_bevs;
END $$;

-- ── 3. Verify ─────────────────────────────────────────────────────────────────
SELECT
  ag.id,
  ag.title,
  ag.max_selections,
  json_agg(
    json_build_object('title', ao.title, 'price', ao.price)
    ORDER BY ao.preference
  ) AS options
FROM addon_groups ag
JOIN menu_items mi ON mi.id = ag.menu_item_id
JOIN addon_options ao ON ao.addon_group_id = ag.id
WHERE mi.title ILIKE '%chicken%rice%'
GROUP BY ag.id, ag.title, ag.max_selections
ORDER BY ag.preference;
