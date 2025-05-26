const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DeploymentInfo = sequelize.define('deployment_info', {
  deployment_id: {
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
  version: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  deployment_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  deployed_by: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  deployed_on: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  error_information: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  deployment_details: {
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
  tableName: 'deployment_info',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_deployment_iflow',
      fields: ['iflow_id']
    },
    {
      name: 'idx_deployment_status',
      fields: ['status']
    },
    {
      name: 'idx_deployment_deployed_on',
      fields: ['deployed_on']
    }
  ]
});

module.exports = DeploymentInfo;
