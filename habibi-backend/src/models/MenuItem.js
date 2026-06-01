const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const MenuItem = sequelize.define('MenuItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT },
  image_url: { type: DataTypes.TEXT },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  partner_price: { type: DataTypes.DECIMAL(10, 2) },
  category_id: { type: DataTypes.INTEGER },
  preference: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_available: { type: DataTypes.BOOLEAN, defaultValue: true },
  note: { type: DataTypes.TEXT },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'menu_items',
  timestamps: false
});

module.exports = MenuItem;

