const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const IflowAdapter = sequelize.define('iflow_adapter', {
  iflow_adapter_id: {
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
  adapter_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'adapter',
      key: 'adapter_id'
    }
  },
  direction: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['Sender', 'Receiver']]
    }
  },
  configuration: {
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
  tableName: 'iflow_adapter',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_iflow_adapter_iflow',
      fields: ['iflow_id']
    },
    {
      name: 'idx_iflow_adapter_adapter',
      fields: ['adapter_id']
    },
    {
      name: 'idx_iflow_adapter_unique',
      fields: ['iflow_id', 'adapter_id', 'direction'],
      unique: true
    }
  ]
});

module.exports = IflowAdapter;
