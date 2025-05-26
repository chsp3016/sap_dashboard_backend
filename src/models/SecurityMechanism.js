const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SecurityMechanism = sequelize.define('security_mechanism', {
  security_mechanism_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  mechanism_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  mechanism_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'security_mechanism',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = SecurityMechanism;
