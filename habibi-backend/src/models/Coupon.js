const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Coupon = sequelize.define('Coupon', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  condition_type: { type: DataTypes.STRING(50) },
  condition_value: { type: DataTypes.JSONB },
  discount_type: { 
    type: DataTypes.ENUM({ name: 'discount_type_enum', values: ['percentage', 'fixed_amount', 'free_item', 'free_delivery', 'buy_one_get_one'] })
  },
  discount_value: { type: DataTypes.DECIMAL(10, 2) },
  valid_from: { type: DataTypes.DATE },
  valid_until: { type: DataTypes.DATE },
  usage_limit: { type: DataTypes.INTEGER },
  used_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'coupons',
  timestamps: false
});

module.exports = Coupon;
