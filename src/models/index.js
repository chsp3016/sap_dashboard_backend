const { sequelize } = require('../config/database');
const Tenant = require('./Tenant');
const Package = require('./Package');
const Iflow = require('./Iflow');
const Adapter = require('./Adapter');
const IflowAdapter = require('./IflowAdapter');
const SecurityMechanism = require('./SecurityMechanism');
const IflowSecurity = require('./IflowSecurity');
const ErrorHandling = require('./ErrorHandling');
const Persistence = require('./Persistence');
const DeploymentInfo = require('./DeploymentInfo');
const RuntimeInfo = require('./RuntimeInfo');
const IflowHistory = require('./IflowHistory');
const DeploymentInfoHistory = require('./DeploymentInfoHistory');
const RuntimeInfoHistory = require('./RuntimeInfoHistory');

// Define associations
Tenant.hasMany(Package, { foreignKey: 'tenant_id' });
Package.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Package.hasMany(Iflow, { foreignKey: 'package_id' });
Iflow.belongsTo(Package, { foreignKey: 'package_id' });

Iflow.hasMany(DeploymentInfo, { foreignKey: 'iflow_id' });
DeploymentInfo.belongsTo(Iflow, { foreignKey: 'iflow_id' });

Iflow.hasMany(RuntimeInfo, { foreignKey: 'iflow_id' });
RuntimeInfo.belongsTo(Iflow, { foreignKey: 'iflow_id' });

Iflow.hasMany(IflowAdapter, { foreignKey: 'iflow_id' });
IflowAdapter.belongsTo(Iflow, { foreignKey: 'iflow_id' });

Adapter.hasMany(IflowAdapter, { foreignKey: 'adapter_id' });
IflowAdapter.belongsTo(Adapter, { foreignKey: 'adapter_id' });

Iflow.hasMany(IflowSecurity, { foreignKey: 'iflow_id' });
IflowSecurity.belongsTo(Iflow, { foreignKey: 'iflow_id' });

SecurityMechanism.hasMany(IflowSecurity, { foreignKey: 'security_mechanism_id' });
IflowSecurity.belongsTo(SecurityMechanism, { foreignKey: 'security_mechanism_id' });

Iflow.hasOne(ErrorHandling, { foreignKey: 'iflow_id' });
ErrorHandling.belongsTo(Iflow, { foreignKey: 'iflow_id' });

Iflow.hasOne(Persistence, { foreignKey: 'iflow_id' });
Persistence.belongsTo(Iflow, { foreignKey: 'iflow_id' });

Iflow.hasMany(IflowHistory, { foreignKey: 'iflow_id' });
IflowHistory.belongsTo(Iflow, { foreignKey: 'iflow_id' });

DeploymentInfo.hasMany(DeploymentInfoHistory, { foreignKey: 'deployment_id' });
DeploymentInfoHistory.belongsTo(DeploymentInfo, { foreignKey: 'deployment_id' });

RuntimeInfo.hasMany(RuntimeInfoHistory, { foreignKey: 'runtime_id' });
RuntimeInfoHistory.belongsTo(RuntimeInfo, { foreignKey: 'runtime_id' });

module.exports = {
  sequelize,
  Tenant,
  Package,
  Iflow,
  Adapter,
  IflowAdapter,
  SecurityMechanism,
  IflowSecurity,
  ErrorHandling,
  Persistence,
  DeploymentInfo,
  RuntimeInfo,
  IflowHistory,
  DeploymentInfoHistory,
  RuntimeInfoHistory
};
