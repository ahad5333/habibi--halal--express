const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CartItem = sequelize.define('CartItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cart_id: { type: DataTypes.INTEGER, allowNull: false },
  menu_item_id: { type: DataTypes.INTEGER },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  selected_choices: { type: DataTypes.JSONB },
  selected_addons: { type: DataTypes.JSONB },
  special_instructions: { type: DataTypes.TEXT },
  unit_price: { type: DataTypes.DECIMAL(10, 2) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'cart_items',
  timestamps: false
});

module.exports = CartItem;
