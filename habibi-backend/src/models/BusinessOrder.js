const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BusinessOrder = sequelize.define('BusinessOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_number: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  business_id: { type: DataTypes.INTEGER },
  items: { type: DataTypes.JSONB },
  sub_total: { type: DataTypes.DECIMAL(10, 2) },
  delivery_fee: { type: DataTypes.DECIMAL(10, 2) },
  service_fee: { type: DataTypes.DECIMAL(10, 2) },
  credit_used: { type: DataTypes.DECIMAL(10, 2) },
  total: { type: DataTypes.DECIMAL(10, 2) },
  payment_method: { type: DataTypes.STRING(50) },
  payment_status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
  order_status: { type: DataTypes.STRING(30), defaultValue: 'created' },
  delivery_address: { type: DataTypes.TEXT },
  scheduled_date: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'business_orders',
  timestamps: false
});

module.exports = BusinessOrder;

