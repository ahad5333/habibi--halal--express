const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  first_name: { type: DataTypes.STRING(100), allowNull: false },
  last_name: { type: DataTypes.STRING(100), allowNull: false },
  business_name: { type: DataTypes.STRING(255) },
  date_of_birth: { type: DataTypes.DATE },
  receive_sms_updates: { type: DataTypes.BOOLEAN, defaultValue: true },
  receive_promotions: { type: DataTypes.BOOLEAN, defaultValue: false },
  last_login: { type: DataTypes.DATE }
}, {
  tableName: 'customers',
  timestamps: false
});

module.exports = Customer;

