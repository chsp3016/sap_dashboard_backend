const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const IflowSecurity = sequelize.define('iflow_security', {
  iflow_security_id: {
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
  security_mechanism_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'security_mechanism',
      key: 'security_mechanism_id'
    }
  },
  direction: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['Inbound', 'Outbound']]
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
  tableName: 'iflow_security',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_iflow_security_iflow',
      fields: ['iflow_id']
    },
    {
      name: 'idx_iflow_security_mechanism',
      fields: ['security_mechanism_id']
    },
    {
      name: 'idx_iflow_security_unique',
      fields: ['iflow_id', 'security_mechanism_id', 'direction'],
      unique: true
    }
  ]
});

module.exports = IflowSecurity;
