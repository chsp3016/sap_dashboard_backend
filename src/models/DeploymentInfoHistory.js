const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DeploymentInfoHistory = sequelize.define('deployment_info_history', {
  history_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  deployment_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'deployment_info',
      key: 'deployment_id'
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
  tableName: 'deployment_info_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      name: 'idx_deployment_history_deployment',
      fields: ['deployment_id']
    },
    {
      name: 'idx_deployment_history_timestamp',
      fields: ['change_timestamp']
    },
    {
      name: 'idx_deployment_history_change_type',
      fields: ['change_type']
    }
  ]
});

module.exports = DeploymentInfoHistory;
