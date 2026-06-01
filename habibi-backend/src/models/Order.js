const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_number: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  customer_id: { type: DataTypes.INTEGER },
  location_id: { type: DataTypes.INTEGER },
  address_id: { type: DataTypes.INTEGER },
  delivery_method: { 
    type: DataTypes.ENUM({ name: 'delivery_method_enum', values: ['in_house', 'express', 'long_distance', 'pickup'] })
  },
  scheduled_time: { type: DataTypes.DATE },
  sub_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  tax: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  service_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  delivery_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  discount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  payment_method: { type: DataTypes.STRING(50) },
  payment_status: { 
    type: DataTypes.ENUM({ name: 'payment_status_enum', values: ['pending', 'paid', 'failed', 'refunded'] }),
    defaultValue: 'pending'
  },
  order_status: { 
    type: DataTypes.ENUM({ name: 'order_status_enum', values: ['received', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled'] }),
    defaultValue: 'received'
  },
  driver_name: { type: DataTypes.STRING(100) },
  driver_phone: { type: DataTypes.STRING(20) },
  driver_photo: { type: DataTypes.TEXT },
  delivery_partner: { type: DataTypes.STRING(50) },
  partner_delivery_id: { type: DataTypes.STRING(255) },
  partner_order_id: { type: DataTypes.STRING(255) },
  assigned_driver_id: { type: DataTypes.INTEGER },
  driver_location_lat: { type: DataTypes.DECIMAL(10, 8) },
  driver_location_lng: { type: DataTypes.DECIMAL(11, 8) },
  special_notes: { type: DataTypes.TEXT },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'orders',
  timestamps: false
});

module.exports = Order;

