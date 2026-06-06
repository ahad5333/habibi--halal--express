-- ============================================================
-- Migration: Add modifiers to ALL breakfast items
-- 1. Drop FK on choice_groups.menu_item_id (uses menus table)
-- 2. Add "Choose your bread" choice group to sandwich items
-- 3. Add sauces / sides / drinks addon groups to all breakfast
-- Safe to run multiple times (skips items already processed)
-- ============================================================

-- Step 1: Drop FK constraint on choice_groups so we can use menus.id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%choice_group%menu_item%'
      OR constraint_name LIKE '%choice_groups%menu_item%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE choice_groups DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE (constraint_name LIKE '%choice_group%menu_item%'
          OR constraint_name LIKE '%choice_groups%menu_item%')
        AND table_name = 'choice_groups'
      LIMIT 1
    );
    RAISE NOTICE 'Dropped FK on choice_groups.menu_item_id';
  ELSE
    RAISE NOTICE 'No FK found on choice_groups.menu_item_id — skipping';
  END IF;
END $$;

-- Step 2 & 3: Insert modifiers for all breakfast items
DO $$
DECLARE
  item_rec   RECORD;
  v_group_id INTEGER;
  is_sandwich BOOLEAN;
BEGIN

  FOR item_rec IN
    SELECT id, name FROM menus
    WHERE category ILIKE '%breakfast%'
    ORDER BY id
  LOOP
    is_sandwich := (
      item_rec.name ILIKE '%sandwich%'
      OR item_rec.name ILIKE '%bagel%'
      OR item_rec.name ILIKE '%roll%'
      OR item_rec.name ILIKE '%croissant%'
      OR item_rec.name ILIKE '%hero%'
      OR item_rec.name ILIKE '%wrap%'
    );

    RAISE NOTICE 'Processing: % (id=%, sandwich=%)',
      item_rec.name, item_rec.id, is_sandwich;

    -- ── CHOICE GROUP: bread (only for sandwiches, Required) ──
    IF is_sandwich AND NOT EXISTS (
      SELECT 1 FROM choice_groups
      WHERE menu_item_id = item_rec.id AND title ILIKE '%bread%'
    ) THEN
      INSERT INTO choice_groups (menu_item_id, title, preference)
      VALUES (item_rec.id, 'Choose your bread', 1)
      RETURNING id INTO v_group_id;

      INSERT INTO choice_options (choice_group_id, title, extra_price, is_default, preference) VALUES
        (v_group_id, 'Bagel',      0.00, true,  1),
        (v_group_id, 'Roll',       0.00, false, 2),
        (v_group_id, 'Croissant',  0.00, false, 3),
        (v_group_id, 'Hero',       0.00, false, 4),
        (v_group_id, 'Wrap',       0.00, false, 5),
        (v_group_id, 'Pita',       0.00, false, 6);

      RAISE NOTICE '  ✓ Bread choice group added';
    END IF;

    -- ── ADDON GROUP: Add sauces ───────────────────────────────
    IF NOT EXISTS (
      SELECT 1 FROM addon_groups
      WHERE menu_item_id = item_rec.id AND title ILIKE 'Add sauces'
    ) THEN
      INSERT INTO addon_groups (menu_item_id, title, preference, max_selections)
      VALUES (item_rec.id, 'Add sauces', 2, 100)
      RETURNING id INTO v_group_id;

      INSERT INTO addon_options (addon_group_id, title, price, preference) VALUES
        (v_group_id, 'White Sauce',  0.50, 1),
        (v_group_id, 'Hot Sauce',    0.50, 2),
        (v_group_id, 'BBQ Sauce',    0.50, 3),
        (v_group_id, 'Ketchup',      0.00, 4),
        (v_group_id, 'Mustard',      0.00, 5);

      RAISE NOTICE '  ✓ Sauces addon group added';
    END IF;

    -- ── ADDON GROUP: Choose your sides ────────────────────────
    IF NOT EXISTS (
      SELECT 1 FROM addon_groups
      WHERE menu_item_id = item_rec.id AND title ILIKE 'Choose your sides'
    ) THEN
      INSERT INTO addon_groups (menu_item_id, title, preference, max_selections)
      VALUES (item_rec.id, 'Choose your sides', 3, 9)
      RETURNING id INTO v_group_id;

      INSERT INTO addon_options (addon_group_id, title, price, preference) VALUES
        (v_group_id, 'French Fries',                      2.00, 1),
        (v_group_id, 'Pita Bread',                        1.00, 2),
        (v_group_id, 'Extra Rice',                        2.00, 3),
        (v_group_id, 'Falafel (4 pcs) with White Sauce',  2.25, 4),
        (v_group_id, 'Samosa (3 pcs)',                    2.50, 5),
        (v_group_id, 'Three Wings (with Same Sauce)',      2.50, 6),
        (v_group_id, 'Three Wings Plain',                 2.50, 7),
        (v_group_id, 'Three Buffalo Wings',               2.50, 8),
        (v_group_id, 'Three BBQ Wings',                   2.50, 9);

      RAISE NOTICE '  ✓ Sides addon group added';
    END IF;

    -- ── ADDON GROUP: Choose your drinks ───────────────────────
    IF NOT EXISTS (
      SELECT 1 FROM addon_groups
      WHERE menu_item_id = item_rec.id AND title ILIKE 'Choose your drinks'
    ) THEN
      INSERT INTO addon_groups (menu_item_id, title, preference, max_selections)
      VALUES (item_rec.id, 'Choose your drinks', 4, 14)
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

      RAISE NOTICE '  ✓ Drinks addon group added';
    END IF;

  END LOOP;

  RAISE NOTICE 'Migration complete.';
END $$;
