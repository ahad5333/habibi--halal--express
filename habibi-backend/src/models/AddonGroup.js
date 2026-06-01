const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AddonGroup = sequelize.define('AddonGroup', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  menu_item_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(100), allowNull: false },
  preference: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'addon_groups',
  timestamps: false
});

module.exports = AddonGroup;

