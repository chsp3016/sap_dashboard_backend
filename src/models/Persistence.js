const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Persistence = sequelize.define('persistence', {
  persistence_id: {
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
  jms_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  data_store_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  variables_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  message_persistence_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  persistence_details: {
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
  tableName: 'persistence',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_persistence_iflow',
      fields: ['iflow_id']
    }
  ]
});

module.exports = Persistence;
