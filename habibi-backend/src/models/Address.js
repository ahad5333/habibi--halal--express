const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Address = sequelize.define('Address', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  customer_id: { type: DataTypes.INTEGER, allowNull: false },
  receiver_name: { type: DataTypes.STRING(200), allowNull: false },
  street_address: { type: DataTypes.STRING(255), allowNull: false },
  second_line: { type: DataTypes.STRING(255) },
  city: { type: DataTypes.STRING(100), allowNull: false },
  state: { type: DataTypes.STRING(50), allowNull: false },
  zip_code: { type: DataTypes.STRING(10), allowNull: false },
  driver_instruction: { type: DataTypes.TEXT },
  is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_gift_order: { type: DataTypes.BOOLEAN, defaultValue: false },
  latitude: { type: DataTypes.DECIMAL(10, 8) },
  longitude: { type: DataTypes.DECIMAL(11, 8) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'addresses',
  timestamps: false
});

module.exports = Address;
