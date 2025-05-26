const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Package = sequelize.define('package', {
  package_id: {
    type: DataTypes.STRING(255),
    
    primaryKey: true
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tenant',
      key: 'tenant_id'
    }
  },
  package_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  package_description: {
    type: DataTypes.TEXT,
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
  tableName: 'package',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_package_tenant',
      fields: ['tenant_id']
    },
    {
      name: 'idx_package_tenant_name',
      fields: ['tenant_id', 'package_name'],
      unique: true
    }
  ]
});

module.exports = Package;
