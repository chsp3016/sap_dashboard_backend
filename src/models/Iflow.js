const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Iflow = sequelize.define('iflow', {
  iflow_id: {
    type: DataTypes.STRING(255),
    
    primaryKey: true
  },
  package_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    references: {
      model: 'package',
      key: 'package_id'
    }
  },
  iflow_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  iflow_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  deployment_model: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['Hybrid', 'Cloud to Cloud', 'Cloud to Onprem', 'Onprem to Onprem', 'undefined']]
    }
  },
  versioning_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['Draft', 'Versioned']]
    }
  },
  message_exchange_pattern: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['Sync', 'Async']]
    }
  },
  interface_mode: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['real-time', 'Batch', 'event-driven']]
    }
  },
  message_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['xml', 'Json', 'EDI']]
    }
  },
  systems_composition: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['SAP2SAP', 'SAP2NONSAP', 'NONSAP2NONSAP']]
    }
  },
  iflow_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['Standard', 'Custom']]
    }
  },
  flag_based_logging: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  auditing: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  context: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  health_check: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  additional_attributes: {
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
  tableName: 'iflow',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_iflow_package',
      fields: ['package_id']
    },
    {
      name: 'idx_iflow_package_name',
      fields: ['package_id', 'iflow_name'],
      unique: true
    },
    {
      name: 'idx_iflow_deployment_model',
      fields: ['deployment_model']
    },
    {
      name: 'idx_iflow_systems_composition',
      fields: ['systems_composition']
    },
    {
      name: 'idx_iflow_type',
      fields: ['iflow_type']
    }
  ]
});

module.exports = Iflow;
