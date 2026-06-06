-- ============================================================
-- Migration: Add sauces / sides / drinks add-ons
-- Matches UberEats add-on groups for Habibi Halal Express
-- Safe to run multiple times (skips items that already have
-- addon groups with the same titles)
-- ============================================================

DO $$
DECLARE
  item_rec   RECORD;
  v_group_id INTEGER;
BEGIN

  -- ── Target items ─────────────────────────────────────────
  -- Add/extend the ILIKE patterns below to include more items.
  -- Items already having add-on groups with these exact titles
  -- are skipped automatically.
  FOR item_rec IN
    SELECT id, name FROM menus
    WHERE (
        name ILIKE '%falafel salad%'
     OR name ILIKE '%gyro platter%'
     OR name ILIKE '%chicken platter%'
     OR name ILIKE '%mixed platter%'
     OR name ILIKE '%falafel platter%'
     OR name ILIKE '%gyro over rice%'
     OR name ILIKE '%philly%'
     OR name ILIKE '%gyro wrap%'
     OR name ILIKE '%chicken wrap%'
    )
    -- skip items we already processed for this migration
    AND id NOT IN (
      SELECT DISTINCT menu_item_id
      FROM addon_groups
      WHERE title ILIKE 'Add sauces'
        AND menu_item_id IS NOT NULL
    )
    ORDER BY id
  LOOP
    RAISE NOTICE 'Processing: % (id=%)', item_rec.name, item_rec.id;

    -- ── Group 1: Add sauces (max 100) ──────────────────────
    INSERT INTO addon_groups (menu_item_id, title, preference, max_selections)
    VALUES (item_rec.id, 'Add sauces', 1, 100)
    RETURNING id INTO v_group_id;

    INSERT INTO addon_options (addon_group_id, title, price, preference) VALUES
      (v_group_id, 'White Sauce',  0.50, 1),
      (v_group_id, 'Hot Sauce',    0.50, 2),
      (v_group_id, 'BBQ Sauce',    0.50, 3),
      (v_group_id, 'Ketchup',      0.00, 4),
      (v_group_id, 'Mustard',      0.00, 5);

    -- ── Group 2: Choose your sides (max 9) ─────────────────
    INSERT INTO addon_groups (menu_item_id, title, preference, max_selections)
    VALUES (item_rec.id, 'Choose your sides', 2, 9)
    RETURNING id INTO v_group_id;

    INSERT INTO addon_options (addon_group_id, title, price, preference) VALUES
      (v_group_id, 'French Fries',                         2.00, 1),
      (v_group_id, 'Pita Bread',                           1.00, 2),
      (v_group_id, 'Extra Rice',                           2.00, 3),
      (v_group_id, 'Falafel (4 pcs) with White Sauce',     2.25, 4),
      (v_group_id, 'Samosa (3 pcs)',                       2.50, 5),
      (v_group_id, 'Three Wings (with Same Sauce)',         2.50, 6),
      (v_group_id, 'Three Wings Plain',                    2.50, 7),
      (v_group_id, 'Three Buffalo Wings',                  2.50, 8),
      (v_group_id, 'Three BBQ Wings',                      2.50, 9);

    -- ── Group 3: Choose your drinks (max 14) ───────────────
    INSERT INTO addon_groups (menu_item_id, title, preference, max_selections)
    VALUES (item_rec.id, 'Choose your drinks', 3, 14)
    RETURNING id INTO v_group_id;

    INSERT INTO addon_options (addon_group_id, title, price, preference) VALUES
      (v_group_id, 'Bottle of Water',          1.00,  1),
      (v_group_id, 'Can of Soda (Pepsi)',       1.00,  2),
      (v_group_id, 'Can of Soda (Diet Pepsi)',  1.00,  3),
      (v_group_id, 'Can of Soda (Coke)',        1.00,  4),
      (v_group_id, 'Can of Soda (Orange)',      1.00,  5),
      (v_group_id, 'Can of Soda (Sprite)',      1.00,  6),
      (v_group_id, 'Can of Soda (Ginger Ale)',  1.00,  7),
      (v_group_id, 'Can of Soda (Iced Tea)',    1.00,  8),
      (v_group_id, 'Snapple (Apple)',           2.00,  9),
      (v_group_id, 'Snapple (Lemon Tea)',       2.50, 10),
      (v_group_id, 'Snapple (Peach)',           2.50, 11),
      (v_group_id, 'Gatorade (Apple)',          2.50, 12),
      (v_group_id, 'Gatorade (Lemon Tea)',      2.50, 13),
      (v_group_id, 'Gatorade (Peach)',          2.50, 14);

    RAISE NOTICE '  ✓ 3 add-on groups inserted for id=%', item_rec.id;
  END LOOP;

  RAISE NOTICE 'Migration complete.';
END $$;
