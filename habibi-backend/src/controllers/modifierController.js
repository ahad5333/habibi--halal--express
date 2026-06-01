const safeError = require('../utils/safeError');
const pool = require("../config/db");

const getChoiceGroups = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM menu_choice_groups ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const createChoiceGroup = async (req, res) => {
  try {
    const { name, min_selection, max_selection, is_required } = req.body;
    const result = await pool.query(
      "INSERT INTO menu_choice_groups (name, min_selection, max_selection, is_required) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, min_selection || 1, max_selection || 1, is_required !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const getAddonGroups = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM menu_addon_groups ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const createAddonGroup = async (req, res) => {
  try {
    const { name, max_selection } = req.body;
    const result = await pool.query(
      "INSERT INTO menu_addon_groups (name, max_selection) VALUES ($1, $2) RETURNING *",
      [name, max_selection || 10]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const deleteChoiceGroup = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM menu_choice_groups WHERE id = $1", [id]);
    res.json({ message: "Choice group deleted successfully" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const deleteAddonGroup = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM menu_addon_groups WHERE id = $1", [id]);
    res.json({ message: "Addon group deleted successfully" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

// Unified modifiers endpoints for the Modifiers.jsx screen in the Admin Dashboard
const getModifiers = async (req, res) => {
  try {
    const choicesResult = await pool.query(`
      SELECT cg.id, cg.name, 'choice' as type, cg.min_selection, cg.max_selection, cg.is_required,
             COALESCE(
               json_agg(
                 json_build_object('name', c.name, 'extra_price', c.additional_price)
               ) FILTER (WHERE c.id IS NOT NULL),
               '[]'
             ) as options
      FROM menu_choice_groups cg
      LEFT JOIN menu_choices c ON cg.id = c.group_id
      GROUP BY cg.id
    `);

    const addonsResult = await pool.query(`
      SELECT ag.id, ag.name, 'addon' as type, 0 as min_selection, ag.max_selection, false as is_required,
             COALESCE(
               json_agg(
                 json_build_object('name', a.name, 'extra_price', a.price)
               ) FILTER (WHERE a.id IS NOT NULL),
               '[]'
             ) as options
      FROM menu_addon_groups ag
      LEFT JOIN menu_addons a ON ag.id = a.group_id
      GROUP BY ag.id
    `);

    const allModifiers = [...choicesResult.rows, ...addonsResult.rows];
    res.json(allModifiers);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const createModifier = async (req, res) => {
  try {
    const { name, type, min_selection, max_selection, is_required, options } = req.body;
    if (type === "choice") {
      const groupResult = await pool.query(
        "INSERT INTO menu_choice_groups (name, min_selection, max_selection, is_required) VALUES ($1, $2, $3, $4) RETURNING id",
        [name, min_selection || 1, max_selection || 1, !!is_required]
      );
      const groupId = groupResult.rows[0].id;
      if (options && options.length > 0) {
        for (let opt of options) {
          await pool.query(
            "INSERT INTO menu_choices (group_id, name, additional_price) VALUES ($1, $2, $3)",
            [groupId, opt.name, opt.extra_price || 0.00]
          );
        }
      }
      res.status(201).json({ id: groupId, name, type, min_selection, max_selection, is_required, options });
    } else {
      const groupResult = await pool.query(
        "INSERT INTO menu_addon_groups (name, max_selection) VALUES ($1, $2) RETURNING id",
        [name, max_selection || 10]
      );
      const groupId = groupResult.rows[0].id;
      if (options && options.length > 0) {
        for (let opt of options) {
          await pool.query(
            "INSERT INTO menu_addons (group_id, name, price) VALUES ($1, $2, $3)",
            [groupId, opt.name, opt.extra_price || 0.00]
          );
        }
      }
      res.status(201).json({ id: groupId, name, type, min_selection: 0, max_selection, is_required: false, options });
    }
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const updateModifier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, min_selection, max_selection, is_required, options } = req.body;
    
    if (type === "choice") {
      await pool.query(
        "UPDATE menu_choice_groups SET name = $1, min_selection = $2, max_selection = $3, is_required = $4 WHERE id = $5",
        [name, min_selection || 1, max_selection || 1, !!is_required, id]
      );
      await pool.query("DELETE FROM menu_choices WHERE group_id = $1", [id]);
      if (options && options.length > 0) {
        for (let opt of options) {
          await pool.query(
            "INSERT INTO menu_choices (group_id, name, additional_price) VALUES ($1, $2, $3)",
            [id, opt.name, opt.extra_price || 0.00]
          );
        }
      }
    } else {
      await pool.query(
        "UPDATE menu_addon_groups SET name = $1, max_selection = $2 WHERE id = $3",
        [name, max_selection || 10, id]
      );
      await pool.query("DELETE FROM menu_addons WHERE group_id = $1", [id]);
      if (options && options.length > 0) {
        for (let opt of options) {
          await pool.query(
            "INSERT INTO menu_addons (group_id, name, price) VALUES ($1, $2, $3)",
            [id, opt.name, opt.extra_price || 0.00]
          );
        }
      }
    }
    res.json({ id, name, type, min_selection, max_selection, is_required, options });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

const deleteModifier = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    if (type === "choice") {
      await pool.query("DELETE FROM menu_choice_groups WHERE id = $1", [id]);
    } else {
      await pool.query("DELETE FROM menu_addon_groups WHERE id = $1", [id]);
    }
    res.json({ message: "Modifier deleted successfully" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  getChoiceGroups,
  createChoiceGroup,
  getAddonGroups,
  createAddonGroup,
  deleteChoiceGroup,
  deleteAddonGroup,
  getModifiers,
  createModifier,
  updateModifier,
  deleteModifier
};
