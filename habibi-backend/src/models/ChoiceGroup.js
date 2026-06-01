const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ChoiceGroup = sequelize.define('ChoiceGroup', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  menu_item_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(100), allowNull: false },
  preference: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'choice_groups',
  timestamps: false
});

module.exports = ChoiceGroup;

