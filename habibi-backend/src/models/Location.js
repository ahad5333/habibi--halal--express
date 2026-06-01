const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Location = sequelize.define('Location', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  brief_address: { type: DataTypes.STRING(255) },
  exact_address: { type: DataTypes.TEXT, allowNull: false },
  phone_number: { type: DataTypes.STRING(20) },
  image_url: { type: DataTypes.TEXT },
  working_days_hours: { type: DataTypes.TEXT },
  holidays: { type: DataTypes.TEXT },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  preference_level: { type: DataTypes.INTEGER, unique: true },
  location_note: { type: DataTypes.TEXT },
  self_delivery_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  delivery_radius_miles: { type: DataTypes.INTEGER },
  delivery_cost: { type: DataTypes.DECIMAL(10, 2) },
  delivery_per_mile_fee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
  latitude: { type: DataTypes.DECIMAL(10, 8) },
  longitude: { type: DataTypes.DECIMAL(11, 8) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'locations',
  timestamps: false
});

module.exports = Location;

