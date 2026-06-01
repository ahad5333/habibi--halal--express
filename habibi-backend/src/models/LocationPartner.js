const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const LocationPartner = sequelize.define('LocationPartner', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  location_id: { type: DataTypes.INTEGER, allowNull: false },
  partner_name: { 
    type: DataTypes.ENUM({ name: 'partner_name_enum', values: ['uber_eats', 'doordash', 'grubhub', 'instacart', 'roadie', 'hhe'] })
  },
  is_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  api_key: { type: DataTypes.TEXT },
  api_secret: { type: DataTypes.TEXT },
  store_id: { type: DataTypes.STRING(100) },
  tablet_username: { type: DataTypes.STRING(100) },
  tablet_password: { type: DataTypes.STRING(100) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'location_partners',
  timestamps: false
});

module.exports = LocationPartner;

