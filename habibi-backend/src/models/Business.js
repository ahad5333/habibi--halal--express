const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Business = sequelize.define('Business', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  business_name: { type: DataTypes.STRING(255), allowNull: false },
  representative_name: { type: DataTypes.STRING(200) },
  business_address: { type: DataTypes.TEXT },
  ein: { type: DataTypes.STRING(50) },
  certificate_of_authority_url: { type: DataTypes.TEXT },
  delivery_addresses: { type: DataTypes.JSONB },
  preferred_delivery_days: { type: DataTypes.JSONB },
  preferred_delivery_hours: { type: DataTypes.STRING(100) },
  expected_deliveries_per_week: { type: DataTypes.STRING(50) },
  phone_number: { type: DataTypes.STRING(20) },
  alternative_phone: { type: DataTypes.STRING(20) },
  price_category: { type: DataTypes.INTEGER, defaultValue: 1 },
  credit: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  payment_methods: { type: DataTypes.JSONB },
  is_approved: { type: DataTypes.BOOLEAN, defaultValue: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'businesses',
  timestamps: false
});

module.exports = Business;

