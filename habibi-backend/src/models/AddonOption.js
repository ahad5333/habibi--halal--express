const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AddonOption = sequelize.define('AddonOption', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  addon_group_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(100), allowNull: false },
  price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  preference: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'addon_options',
  timestamps: false
});

module.exports = AddonOption;

