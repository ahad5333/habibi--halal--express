const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ChoiceOption = sequelize.define('ChoiceOption', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  choice_group_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(100), allowNull: false },
  extra_price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
  preference: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'choice_options',
  timestamps: false
});

module.exports = ChoiceOption;

