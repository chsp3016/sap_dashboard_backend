const logger = require('../utils/logger');
const dataFetchService = require('./dataFetchService');
const dataProcessService = require('./dataProcessService');
const models = require('../models');

/**
 * Find or create a tenant record
 * @param {string} tenantName - Tenant name
 * @param {string} tenantUrl - Tenant URL
 * @returns {Promise<Object>} Tenant record
 */
const findOrCreateTenant = async (tenantName, tenantUrl) => {
  try {
    const [tenant, created] = await models.Tenant.findOrCreate({
      where: { tenant_name: tenantName },
      defaults: {
        tenant_url: tenantUrl,
        oauth_config: {
          client_id: process.env.SAP_CLIENT_ID,
          token_url: process.env.SAP_TOKEN_URL
        }
      }
    });
    
    if (created) {
      logger.info(`Created new tenant: ${tenantName}`);
    }
    
    return tenant;
  } catch (error) {
    logger.error('Error finding or creating tenant', { error: error.message });
    throw error;
  }
};

/**
 * Sync integration packages
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Array>} Array of package records
 */
const syncIntegrationPackages = async (tenantId) => {
  try {
    logger.info('Syncing integration packages');
    
    // Fetch packages from API
    const packagesData = await dataFetchService.fetchIntegrationPackages();
    
    // Process and upsert packages
    const packageRecords = [];
    
    for (const packageData of packagesData) {
      const processedPackage = dataProcessService.processPackageData(packageData);
      processedPackage.tenant_id = tenantId;
      
      const [packageRecord, created] = await models.Package.findOrCreate({
        where: {
          package_id: processedPackage.package_id
        },
        defaults: processedPackage
      });
      
      if (!created) {
        // Update existing package
        await packageRecord.update(processedPackage);
      }
      
      packageRecords.push(packageRecord);
    }
    
    logger.info(`Synced ${packageRecords.length} integration packages`);
    return packageRecords;
  } catch (error) {
    logger.error('Error syncing integration packages', { error: error.message });
    throw error;
  }
};

/**
 * Validate and sanitize processed flow data for database
 * @param {Object} processedFlow - Processed flow data
 * @returns {Object} Sanitized flow data
 */
const sanitizeFlowData = (processedFlow) => {
  // Define max lengths based on database schema
  const limits = {
    iflow_id: 255,
    package_id: 255,
    iflow_name: 255,
    iflow_description: null, // TEXT field, no limit
    deployment_model: 50,
    versioning_status: 50,
    message_exchange_pattern: 50,
    interface_mode: 50,
    message_type: 50,
    systems_composition: 50,
    iflow_type: 50,
    context: null // TEXT field, no limit
  };
  
  const sanitized = { ...processedFlow };
  
  // Truncate fields that exceed database limits
  Object.keys(limits).forEach(field => {
    if (limits[field] && sanitized[field] && sanitized[field].length > limits[field]) {
      logger.warn(`Truncating ${field} from ${sanitized[field].length} to ${limits[field]} characters`, {
        iflowId: sanitized.iflow_id,
        originalValue: sanitized[field]
      });
      sanitized[field] = sanitized[field].substring(0, limits[field]);
    }
  });
  
  // Ensure boolean fields are properly typed
  ['flag_based_logging', 'auditing', 'health_check'].forEach(field => {
    if (sanitized[field] !== null && sanitized[field] !== undefined) {
      sanitized[field] = Boolean(sanitized[field]);
    }
  });
  
  // Ensure JSONB fields are valid JSON
  if (sanitized.additional_attributes) {
    try {
      if (typeof sanitized.additional_attributes === 'string') {
        JSON.parse(sanitized.additional_attributes);
      }
    } catch (error) {
      logger.warn('Invalid JSON in additional_attributes, setting to empty object', {
        iflowId: sanitized.iflow_id,
        error: error.message
      });
      sanitized.additional_attributes = {};
    }
  }
  
  return sanitized;
};

/**
 * Debug helper to log database operation details
 * @param {Object} data - Data being processed
 * @param {string} operation - Operation being performed
 */
const debugDatabaseOperation = (data, operation = 'UPDATE') => {
  logger.debug(`${operation} operation details:`, {
    operation,
    iflowId: data.iflow_id,
    packageId: data.package_id,
    dataKeys: Object.keys(data),
    fieldLengths: Object.keys(data).map(key => ({
      key,
      type: typeof data[key],
      length: typeof data[key] === 'string' ? data[key].length : null
    }))
  });
};

/**
 * Sync integration flows for a package
 * @param {string} packageId - Package ID
 * @returns {Promise<Array>} Array of iFlow records
 */
const syncPackageIntegrationFlows = async (packageId) => {
  try {
    logger.info(`Syncing integration flows for package: ${packageId}`);
    
    // First, verify the package exists in the database
    const packageExists = await models.Package.findByPk(packageId);
    if (!packageExists) {
      logger.error(`Package ${packageId} not found in database. Cannot sync flows.`);
      throw new Error(`Package ${packageId} does not exist. Sync packages first.`);
    }
    
    // Fetch iFlows from API
    const flowsData = await dataFetchService.fetchPackageIntegrationFlows(packageId);
    
    // Process and upsert iFlows
    const iflowRecords = [];
    
    for (const flowData of flowsData) {
      try {
        // Skip flows with missing required data
        if (!flowData.Id) {
          logger.warn('Skipping flow with missing ID', { flowData });
          continue;
        }
        
        logger.info(`Processing flow: ${flowData.Id} (version: ${flowData.Version})`);
        
        // Fetch detailed flow information
        const flowDetails = await dataFetchService.fetchIntegrationFlowDetails(
          flowData.Id,
          flowData.Version,
          true
        );
        
        // Check if flow details contain errors
        if (!flowDetails || flowDetails.error) {
          logger.warn(`Skipping flow ${flowData.Id} due to fetch error`, { 
            error: flowDetails?.error,
            flowId: flowData.Id,
            version: flowData.Version
          });
          continue;
        }
        
        // Ensure we have a valid iflow_id
        if (!flowDetails.id) {
          logger.warn(`Skipping flow without valid ID`, { flowDetails });
          continue;
        }
        
        // Fetch runtime status
        let runtimeStatus = {};
        try {
          runtimeStatus = await dataFetchService.fetchRuntimeStatus(flowData.Id, flowData.Version);
        } catch (error) {
          logger.warn(`Could not fetch runtime status for flow ${flowData.Id} (version ${flowData.Version})`, { error: error.message });
        }
        
        // Process flow data
        let processedFlow;
        try {
          processedFlow = dataProcessService.processIntegrationFlowData(flowDetails, runtimeStatus);
        } catch (error) {
          logger.error(`Error processing flow data for ${flowData.Id}`, {
            error: error.message,
            stack: error.stack,
            flowId: flowData.Id,
            version: flowData.Version
          });
          continue;
        }
        
        // Ensure processedFlow has required fields
        if (!processedFlow.iflow_id) {
          logger.warn(`Processed flow missing iflow_id`, { processedFlow });
          continue;
        }
        
        // IMPORTANT: Ensure the package_id matches the one we're syncing
        // This prevents foreign key constraint violations
        processedFlow.package_id = packageId;
        
        // Sanitize data for database
        const sanitizedFlow = sanitizeFlowData(processedFlow);
        
        // Debug log the sanitized data
        debugDatabaseOperation(sanitizedFlow, 'UPDATE');
        
        // Find or create iFlow record
        const [iflowRecord, created] = await models.Iflow.findOrCreate({
          where: {
            iflow_id: sanitizedFlow.iflow_id
          },
          defaults: sanitizedFlow
        });
        
        if (!created) {
          // Store previous state for history
          const previousState = iflowRecord.toJSON();
          
          try {
            // Update existing iFlow
            await iflowRecord.update(sanitizedFlow);
            
            // Create history record for the update
            await models.IflowHistory.create({
              iflow_id: iflowRecord.iflow_id,
              change_timestamp: new Date(),
              changed_by: 'system',
              change_type: 'Update',
              previous_state: previousState,
              new_state: sanitizedFlow
            });
          } catch (updateError) {
            logger.error(`Error updating iFlow ${sanitizedFlow.iflow_id}`, {
              error: updateError.message,
              flowId: sanitizedFlow.iflow_id,
              sanitizedFlow
            });
            continue;
          }
        } else {
          // Create history record for the creation
          await models.IflowHistory.create({
            iflow_id: iflowRecord.iflow_id,
            change_timestamp: new Date(),
            changed_by: 'system',
            change_type: 'Create',
            previous_state: null,
            new_state: sanitizedFlow
          });
        }
        
        // Process and sync security mechanisms
        const securityMechanisms = dataProcessService.processSecurityMechanisms(flowDetails);
        await syncSecurityMechanisms(iflowRecord.iflow_id, securityMechanisms);
        
        // Process and sync adapters
        const adapters = dataProcessService.processAdapters(flowDetails);
        await syncAdapters(iflowRecord.iflow_id, adapters);
        
        // Process and sync error handling
        const errorHandling = dataProcessService.processErrorHandling(flowDetails);
        await syncErrorHandling(iflowRecord.iflow_id, errorHandling);
        
        // Process and sync persistence
        const persistence = dataProcessService.processPersistence(flowDetails);
        await syncPersistence(iflowRecord.iflow_id, persistence);
        
        // Process and sync deployment info
        const deploymentInfo = dataProcessService.processDeploymentInfo(flowDetails, runtimeStatus);
        await syncDeploymentInfo(iflowRecord.iflow_id, deploymentInfo);
        
        // Fetch and sync runtime info
        await syncRuntimeInfo(iflowRecord.iflow_id, flowData.Name);
        
        iflowRecords.push(iflowRecord);
      } catch (error) {
        logger.error(`Error processing flow ${flowData.Id}`, { 
          error: error.message, 
          stack: error.stack,
          flowId: flowData.Id,
          version: flowData.Version 
        });
        // Continue processing other flows instead of failing completely
        continue;
      }
    }
    
    logger.info(`Synced ${iflowRecords.length} integration flows for package ${packageId}`);
    return iflowRecords;
  } catch (error) {
    logger.error(`Error syncing integration flows for package ${packageId}`, { error: error.message });
    throw error;
  }
};

/**
 * Sync security mechanisms for an iFlow
 * @param {string} iflowId - iFlow ID
 * @param {Array} securityMechanisms - Array of security mechanisms
 * @returns {Promise<void>}
 */
const syncSecurityMechanisms = async (iflowId, securityMechanisms) => {
  try {
    if (!iflowId) {
      logger.warn('Cannot sync security mechanisms: iflowId is undefined');
      return;
    }
    
    for (const mechanism of securityMechanisms) {
      // Find or create security mechanism
      const [securityMechanism, created] = await models.SecurityMechanism.findOrCreate({
        where: {
          mechanism_name: mechanism.mechanism_name
        },
        defaults: {
          mechanism_type: mechanism.mechanism_type
        }
      });
      
      // Find or create iFlow security relationship
      await models.IflowSecurity.findOrCreate({
        where: {
          iflow_id: iflowId,
          security_mechanism_id: securityMechanism.security_mechanism_id,
          direction: mechanism.direction
        },
        defaults: {
          configuration: mechanism.configuration
        }
      });
    }
  } catch (error) {
    logger.error(`Error syncing security mechanisms for iFlow ${iflowId}`, { error: error.message });
    throw error;
  }
};

/**
 * Sync adapters for an iFlow
 * @param {string} iflowId - iFlow ID
 * @param {Array} adapters - Array of adapters
 * @returns {Promise<void>}
 */
const syncAdapters = async (iflowId, adapters) => {
  try {
    if (!iflowId) {
      logger.warn('Cannot sync adapters: iflowId is undefined');
      return;
    }
    
    logger.debug('Starting adapter sync', { iflowId, adapterCount: adapters.length });
    
    for (const adapter of adapters) {
      // Validate adapter data
      if (!adapter.adapter_name || !adapter.adapter_type) {
        logger.warn('Skipping adapter with missing required fields', {
          iflowId,
          adapter
        });
        continue;
      }
      
      logger.debug('Processing adapter', { 
        iflowId, 
        adapterName: adapter.adapter_name, 
        adapterType: adapter.adapter_type, 
        direction: adapter.direction 
      });
      
      // Find or create adapter
      const [adapterRecord, created] = await models.Adapter.findOrCreate({
        where: {
          adapter_name: adapter.adapter_name
        },
        defaults: {
          adapter_type: adapter.adapter_type,
          adapter_category: adapter.adapter_category
        }
      });
      
      logger.debug('Adapter record processed', { 
        iflowId, 
        adapterId: adapterRecord.adapter_id, 
        created 
      });
      
      // Find or create iFlow adapter relationship
      const [iflowAdapterRecord, iflowCreated] = await models.IflowAdapter.findOrCreate({
        where: {
          iflow_id: iflowId,
          adapter_id: adapterRecord.adapter_id,
          direction: adapter.direction
        },
        defaults: {
          configuration: adapter.configuration
        }
      });
      
      logger.debug('IflowAdapter record processed', { 
        iflowId, 
        iflowAdapterId: iflowAdapterRecord.iflow_adapter_id, 
        created: iflowCreated 
      });
    }
    
    logger.info('Completed adapter sync', { iflowId, adapterCount: adapters.length });
  } catch (error) {
    logger.error('Error syncing adapters', { 
      iflowId, 
      error: error.message, 
      stack: error.stack 
    });
    throw error;
  }
};

/**
 * Sync error handling for an iFlow
 * @param {string} iflowId - iFlow ID
 * @param {Object} errorHandling - Error handling configuration
 * @returns {Promise<void>}
 */
const syncErrorHandling = async (iflowId, errorHandling) => {
  try {
    if (!iflowId) {
      logger.warn('Cannot sync error handling: iflowId is undefined');
      return;
    }
    
    // Find or create error handling record
    const [errorHandlingRecord, created] = await models.ErrorHandling.findOrCreate({
      where: {
        iflow_id: iflowId
      },
      defaults: errorHandling
    });
    
    if (!created) {
      // Update existing record
      await errorHandlingRecord.update(errorHandling);
    }
  } catch (error) {
    logger.error(`Error syncing error handling for iFlow ${iflowId}`, { error: error.message });
    throw error;
  }
};

/**
 * Sync persistence for an iFlow
 * @param {string} iflowId - iFlow ID
 * @param {Object} persistence - Persistence configuration
 * @returns {Promise<void>}
 */
const syncPersistence = async (iflowId, persistence) => {
  try {
    if (!iflowId) {
      logger.warn('Cannot sync persistence: iflowId is undefined');
      return;
    }
    
    // Find or create persistence record
    const [persistenceRecord, created] = await models.Persistence.findOrCreate({
      where: {
        iflow_id: iflowId
      },
      defaults: persistence
    });
    
    if (!created) {
      // Update existing record
      await persistenceRecord.update(persistence);
    }
  } catch (error) {
    logger.error(`Error syncing persistence for iFlow ${iflowId}`, { error: error.message });
    throw error;
  }
};

/**
 * Sync deployment info for an iFlow
 * @param {string} iflowId - iFlow ID
 * @param {Object} deploymentInfo - Deployment information
 * @returns {Promise<void>}
 */
const syncDeploymentInfo = async (iflowId, deploymentInfo) => {
  try {
    if (!iflowId) {
      logger.warn('Cannot sync deployment info: iflowId is undefined');
      return;
    }
    
    // Find or create deployment info record
    const [deploymentRecord, created] = await models.DeploymentInfo.findOrCreate({
      where: {
        iflow_id: iflowId
      },
      defaults: deploymentInfo
    });
    
    if (!created) {
      // Store previous state for history
      const previousState = deploymentRecord.toJSON();
      
      // Check if status has changed
      const statusChanged = deploymentRecord.status !== deploymentInfo.status;
      
      // Update existing record
      await deploymentRecord.update(deploymentInfo);
      
      // Create history record if status changed
      if (statusChanged) {
        await models.DeploymentInfoHistory.create({
          deployment_id: deploymentRecord.deployment_id,
          change_timestamp: new Date(),
          changed_by: 'system',
          change_type: 'Update',
          previous_state: previousState,
          new_state: deploymentInfo
        });
      }
    } else {
      // Create history record for the creation
      await models.DeploymentInfoHistory.create({
        deployment_id: deploymentRecord.deployment_id,
        change_timestamp: new Date(),
        changed_by: 'system',
        change_type: 'Create',
        previous_state: null,
        new_state: deploymentInfo
      });
    }
  } catch (error) {
    logger.error(`Error syncing deployment info for iFlow ${iflowId}`, { error: error.message });
    throw error;
  }
};

/**
 * Sync runtime info for an iFlow
 * @param {string} iflowId - iFlow ID
 * @param {string} iflowName - iFlow name
 * @returns {Promise<void>}
 */
const syncRuntimeInfo = async (iflowId, iflowName) => {
  try {
    if (!iflowId) {
      logger.warn('Cannot sync runtime info: iflowId is undefined');
      return;
    }
    
    // Fetch message logs and endpoints
    let messageLogs = [];
    let endpoints = [];
    
    try {
      messageLogs = await dataFetchService.fetchMessageLogs(iflowName, 7);
    } catch (error) {
      logger.warn(`Could not fetch message logs for iFlow ${iflowName}`, { error: error.message });
    }
    
    try {
      endpoints = await dataFetchService.fetchServiceEndpoints(iflowName);
    } catch (error) {
      logger.warn(`Could not fetch service endpoints for iFlow ${iflowName}`, { error: error.message });
    }
    
    // Process runtime info
    const runtimeInfo = dataProcessService.processRuntimeInfo(iflowId, messageLogs, endpoints);
    
    // Find or create runtime info record
    const [runtimeRecord, created] = await models.RuntimeInfo.findOrCreate({
      where: {
        iflow_id: iflowId
      },
      defaults: runtimeInfo
    });
    
    if (!created) {
      // Store previous state for history
      const previousState = runtimeRecord.toJSON();
      
      // Check if significant changes (success/failure counts, processing time)
      const significantChanges = 
        runtimeRecord.success_count !== runtimeInfo.success_count ||
        runtimeRecord.failure_count !== runtimeInfo.failure_count ||
        Math.abs(runtimeRecord.avg_processing_time - runtimeInfo.avg_processing_time) > 100; // 100ms threshold
      
      // Update existing record
      await runtimeRecord.update(runtimeInfo);
      
      // Create history record if significant changes
      if (significantChanges) {
        await models.RuntimeInfoHistory.create({
          runtime_id: runtimeRecord.runtime_id,
          change_timestamp: new Date(),
          changed_by: 'system',
          change_type: 'Update',
          previous_state: previousState,
          new_state: runtimeInfo
        });
      }
    } else {
      // Create history record for the creation
      await models.RuntimeInfoHistory.create({
        runtime_id: runtimeRecord.runtime_id,
        change_timestamp: new Date(),
        changed_by: 'system',
        change_type: 'Create',
        previous_state: null,
        new_state: runtimeInfo
      });
    }
  } catch (error) {
    logger.error(`Error syncing runtime info for iFlow ${iflowId}`, { error: error.message });
    throw error;
  }
};

/**
 * Sync all data from SAP Integration Suite
 * @returns {Promise<void>}
 */
const syncAllData = async () => {
  try {
    logger.info('Starting full data synchronization');
    
    // Create default tenant
    const tenant = await findOrCreateTenant(
      'SAP Integration Suite',
      process.env.SAP_API_BASE_URL
    );
    
    // Sync packages
    const packages = await syncIntegrationPackages(tenant.tenant_id);
    
    // Sync iFlows for each package
    for (const pkg of packages) {
      try {
        await syncPackageIntegrationFlows(pkg.package_id);
      } catch (error) {
        logger.error(`Error syncing flows for package ${pkg.package_id}`, { error: error.message });
        // Continue with other packages instead of failing completely
        continue;
      }
    }
    
    logger.info('Full data synchronization completed successfully');
  } catch (error) {
    logger.error('Error during full data synchronization', { error: error.message });
    throw error;
  }
};

module.exports = {
  findOrCreateTenant,
  syncIntegrationPackages,
  syncPackageIntegrationFlows,
  syncSecurityMechanisms,
  syncAdapters,
  syncErrorHandling,
  syncPersistence,
  syncDeploymentInfo,
  syncRuntimeInfo,
  syncAllData
};