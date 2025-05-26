const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Adapter = sequelize.define('adapter', {
  adapter_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  adapter_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  adapter_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  adapter_category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['Sender', 'Receiver']]
    }
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
  tableName: 'adapter',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Adapter;
