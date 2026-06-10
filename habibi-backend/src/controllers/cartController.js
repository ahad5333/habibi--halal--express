const safeError = require('../utils/safeError');
const pool = require("../config/db");

const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    let cart = await pool.query(
      "SELECT * FROM carts WHERE user_id=$1",
      [userId]
    );

    if (cart.rows.length === 0) {
      return res.json({ items: [] });
    }

    const cartId = cart.rows[0].id;

    const items = await pool.query(
      `SELECT ci.id AS cart_item_id, ci.menu_item_id AS menu_id, ci.quantity, m.name, m.price
       FROM cart_items ci
       JOIN menus m ON ci.menu_item_id = m.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    res.json({
      cart_id: cartId,
      items: items.rows,
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};
const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { menu_id, quantity } = req.body;

    let cart = await pool.query(
      "SELECT * FROM carts WHERE user_id=$1",
      [userId]
    );

    let cartId;

    if (cart.rows.length === 0) {
      const newCart = await pool.query(
        "INSERT INTO carts(user_id) VALUES($1) RETURNING *",
        [userId]
      );

      cartId = newCart.rows[0].id;
    } else {
      cartId = cart.rows[0].id;
    }

    const existingItem = await pool.query(
      "SELECT * FROM cart_items WHERE cart_id=$1 AND menu_item_id=$2",
      [cartId, menu_id]
    );

    if (existingItem.rows.length > 0) {
      await pool.query(
        "UPDATE cart_items SET quantity = quantity + $1 WHERE id=$2",
        [quantity, existingItem.rows[0].id]
      );
    } else {
      await pool.query(
        "INSERT INTO cart_items(cart_id, menu_item_id, quantity) VALUES($1,$2,$3)",
        [cartId, menu_id, quantity]
      );
    }

    res.json({ message: "Added to cart" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};
const removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // IDOR guard: only delete items belonging to this user's cart
    const result = await pool.query(
      `DELETE FROM cart_items
       WHERE id=$1
         AND cart_id IN (SELECT id FROM carts WHERE user_id=$2)`,
      [id, userId]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: "Item removed" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};
const updateQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }

    // IDOR guard: only update items belonging to this user's cart
    const result = await pool.query(
      `UPDATE cart_items SET quantity=$1
       WHERE id=$2
         AND cart_id IN (SELECT id FROM carts WHERE user_id=$3)`,
      [quantity, id, userId]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: "Quantity updated" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await pool.query(
      "SELECT * FROM carts WHERE user_id=$1",
      [userId]
    );

    if (cart.rows.length > 0) {
      await pool.query(
        "DELETE FROM cart_items WHERE cart_id=$1",
        [cart.rows[0].id]
      );
    }

    res.json({ message: "Cart cleared" });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};
/* Replace the entire server cart in one call — frontend sends the full item list */
const syncCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items } = req.body; // [{ menu_id, quantity }]

    let cart = await pool.query("SELECT id FROM carts WHERE user_id=$1", [userId]);
    let cartId;
    if (cart.rows.length === 0) {
      const newCart = await pool.query("INSERT INTO carts(user_id) VALUES($1) RETURNING id", [userId]);
      cartId = newCart.rows[0].id;
    } else {
      cartId = cart.rows[0].id;
    }

    await pool.query("DELETE FROM cart_items WHERE cart_id=$1", [cartId]);

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (item.menu_id && item.quantity > 0) {
          await pool.query(
            "INSERT INTO cart_items(cart_id, menu_item_id, quantity) VALUES($1,$2,$3)",
            [cartId, item.menu_id, item.quantity]
          );
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  syncCart,
};