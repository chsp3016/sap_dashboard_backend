const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RuntimeInfoHistory = sequelize.define('runtime_info_history', {
  history_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  runtime_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'runtime_info',
      key: 'runtime_id'
    }
  },
  change_timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  changed_by: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  change_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['Create', 'Update', 'Delete']]
    }
  },
  previous_state: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  new_state: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'runtime_info_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      name: 'idx_runtime_history_runtime',
      fields: ['runtime_id']
    },
    {
      name: 'idx_runtime_history_timestamp',
      fields: ['change_timestamp']
    },
    {
      name: 'idx_runtime_history_change_type',
      fields: ['change_type']
    }
  ]
});

module.exports = RuntimeInfoHistory;
