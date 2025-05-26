const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RuntimeInfo = sequelize.define('runtime_info', {
  runtime_id: {
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
  endpoint: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  avg_processing_time: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  success_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  failure_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  execution_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['Scheduled', 'Ondemand', 'Both']]
    }
  },
  last_execution_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  runtime_details: {
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
  tableName: 'runtime_info',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_runtime_iflow',
      fields: ['iflow_id']
    },
    {
      name: 'idx_runtime_last_execution',
      fields: ['last_execution_time']
    },
    {
      name: 'idx_runtime_execution_type',
      fields: ['execution_type']
    }
  ]
});

module.exports = RuntimeInfo;
