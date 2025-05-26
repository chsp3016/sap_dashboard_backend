const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ErrorHandling = sequelize.define('error_handling', {
  error_handling_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  iflow_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    references: {
      model: 'iflow',
      key: 'iflow_id'
    }
  },
  detection_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  logging_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  classification_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  reporting_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  error_handling_details: {
    type: DataTypes.JSONB,
    allowNull: true
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
  tableName: 'error_handling',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_error_handling_iflow',
      fields: ['iflow_id']
    }
  ]
});

module.exports = ErrorHandling;
