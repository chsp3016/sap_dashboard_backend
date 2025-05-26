const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const IflowHistory = sequelize.define('iflow_history', {
  history_id: {
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
  tableName: 'iflow_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      name: 'idx_iflow_history_iflow',
      fields: ['iflow_id']
    },
    {
      name: 'idx_iflow_history_timestamp',
      fields: ['change_timestamp']
    },
    {
      name: 'idx_iflow_history_change_type',
      fields: ['change_type']
    }
  ]
});

module.exports = IflowHistory;
