const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BusinessMenuItem = sequelize.define('BusinessMenuItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT },
  image_url: { type: DataTypes.TEXT },
  price1: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  price2: { type: DataTypes.DECIMAL(10, 2) },
  price3: { type: DataTypes.DECIMAL(10, 2) },
  category: { type: DataTypes.STRING(100) },
  is_available: { type: DataTypes.BOOLEAN, defaultValue: true },
  preference: { type: DataTypes.INTEGER, defaultValue: 0 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'business_menu_items',
  timestamps: false
});

module.exports = BusinessMenuItem;

