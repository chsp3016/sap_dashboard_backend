const logger = require('../utils/logger');

/**
 * Process integration package data
 * @param {Object} packageData - Raw package data from API
 * @returns {Object} Processed package data for database
 */
const processPackageData = (packageData) => {
  return {
    package_id: packageData.Id,
    package_name: packageData.Name,
    package_description: packageData.Description || '',
    tenant_id: packageData.OwningTenant || 'default'
  };
};

/**
 * Process integration flow data
 * @param {Object} flowData - Raw flow data from API
 * @param {Object} runtimeData - Runtime data from API
 * @returns {Object} Processed flow data for database
 */
const processIntegrationFlowData = (flowData, runtimeData = {}) => {
  // Ensure we have required fields
  if (!flowData) {
    throw new Error('flowData is required');
  }
  
  // Use the passed flowData's id property, or fall back to various possible fields
  const iflowId = flowData.id || flowData.Id || flowData.iflow_id;
  if (!iflowId) {
    throw new Error('Missing required iflow_id in flowData');
  }
  
  // Extract package ID - handle cases where it might be missing
  const packageId = flowData.PackageId || flowData.package_id || 'unknown';
  
  // Default values for deployment status
  const deploymentStatus = runtimeData.Status || 'Not Deployed';
  
  // Extract deployment model from flow data or resources
  let deploymentModel = 'undefined';
  if (flowData.Resources && flowData.Resources.results) {
    const deploymentResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('DeploymentModel')
    );
    if (deploymentResource) {
      if (deploymentResource.Name.includes('Hybrid')) deploymentModel = 'Hybrid';
      else if (deploymentResource.Name.includes('CloudToCloud')) deploymentModel = 'Cloud to Cloud';
      else if (deploymentResource.Name.includes('CloudToOnprem')) deploymentModel = 'Cloud to Onprem';
      else if (deploymentResource.Name.includes('OnpremToOnprem')) deploymentModel = 'Onprem to Onprem';
    }
  }
  
  // Extract versioning status
  let versioningStatus = 'Draft';
  if (flowData.Version && flowData.Version !== '1.0.0') {
    versioningStatus = 'Versioned';
  }
  
  // Extract message exchange pattern
  let messageExchangePattern = 'Async';
  if (flowData.Resources && flowData.Resources.results) {
    const mepResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('MessageExchangePattern')
    );
    if (mepResource) {
      if (mepResource.Name.includes('Sync')) messageExchangePattern = 'Sync';
    }
  }
  
  // Extract interface mode
  let interfaceMode = 'real-time';
  if (flowData.Resources && flowData.Resources.results) {
    const interfaceResource = flowData.Resources.results.find(
      resource => resource.Name && (resource.Name.includes('Batch') || resource.Name.includes('EventDriven'))
    );
    if (interfaceResource) {
      if (interfaceResource.Name.includes('Batch')) interfaceMode = 'Batch';
      else if (interfaceResource.Name.includes('EventDriven')) interfaceMode = 'event-driven';
    }
  }
  
  // Extract message type
  let messageType = 'xml';
  if (flowData.Resources && flowData.Resources.results) {
    const messageTypeResource = flowData.Resources.results.find(
      resource => resource.Name && (resource.Name.includes('Json') || resource.Name.includes('EDI'))
    );
    if (messageTypeResource) {
      if (messageTypeResource.Name.includes('Json')) messageType = 'Json';
      else if (messageTypeResource.Name.includes('EDI')) messageType = 'EDI';
    }
  }
  
  // Extract systems composition
  let systemsComposition = 'SAP2SAP';
  if (flowData.Resources && flowData.Resources.results) {
    const systemsResource = flowData.Resources.results.find(
      resource => resource.Name && (resource.Name.includes('SAP2NONSAP') || resource.Name.includes('NONSAP2NONSAP'))
    );
    if (systemsResource) {
      if (systemsResource.Name.includes('SAP2NONSAP')) systemsComposition = 'SAP2NONSAP';
      else if (systemsResource.Name.includes('NONSAP2NONSAP')) systemsComposition = 'NONSAP2NONSAP';
    }
  }
  
  // Extract iFlow type
  let iflowType = 'Custom';
  if (flowData.Resources && flowData.Resources.results) {
    const typeResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('Standard')
    );
    if (typeResource) {
      iflowType = 'Standard';
    }
  }
  
  // Extract flag-based logging
  let flagBasedLogging = false;
  if (flowData.Resources && flowData.Resources.results) {
    const loggingResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('FlagBasedLogging')
    );
    if (loggingResource) {
      flagBasedLogging = true;
    }
  }
  
  // Extract auditing
  let auditing = false;
  if (flowData.Resources && flowData.Resources.results) {
    const auditingResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('Auditing')
    );
    if (auditingResource) {
      auditing = true;
    }
  }
  
  // Extract health check
  let healthCheck = false;
  if (flowData.Resources && flowData.Resources.results) {
    const healthCheckResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('HealthCheck')
    );
    if (healthCheckResource) {
      healthCheck = true;
    }
  }
  
  // Extract context
  let context = '';
  if (flowData.Resources && flowData.Resources.results) {
    const contextResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('Context')
    );
    if (contextResource && contextResource.Content) {
      context = contextResource.Content;
    }
  }
  
  // Prepare additional attributes as JSON
  const additionalAttributes = {
    id: flowData.id || flowData.Id,
    artifactId: flowData.ArtifactId,
    createdBy: flowData.CreatedBy,
    createdAt: flowData.CreatedAt,
    modifiedBy: flowData.ModifiedBy,
    modifiedAt: flowData.ModifiedAt
  };
  
  return {
    iflow_id: iflowId,
    package_id: packageId,
    iflow_name: flowData.Name || flowData.name || 'Unnamed Flow',
    iflow_description: flowData.Description || flowData.description || '',
    deployment_model: deploymentModel,
    versioning_status: versioningStatus,
    message_exchange_pattern: messageExchangePattern,
    interface_mode: interfaceMode,
    message_type: messageType,
    systems_composition: systemsComposition,
    iflow_type: iflowType,
    flag_based_logging: flagBasedLogging,
    auditing: auditing,
    context: context,
    health_check: healthCheck,
    additional_attributes: additionalAttributes
  };
};

/**
 * Process security mechanisms from flow data
 * @param {Object} flowData - Raw flow data from API
 * @returns {Array} Array of security mechanisms
 */
const processSecurityMechanisms = (flowData) => {
  const securityMechanisms = [];
  
  if (!flowData.Resources || !flowData.Resources.results) {
    return securityMechanisms;
  }
  
  // Look for security-related resources
  const securityResources = flowData.Resources.results.filter(
    resource => resource.Name && (
      resource.Name.includes('Authentication') || 
      resource.Name.includes('Authorization') ||
      resource.Name.includes('Security') ||
      resource.Name.includes('Encryption')
    )
  );
  
  securityResources.forEach(resource => {
    // Determine direction (Inbound or Outbound)
    let direction = 'Inbound';
    if (resource.Name.includes('Outbound')) {
      direction = 'Outbound';
    }
    
    // Extract mechanism name and type
    let mechanismName = resource.Name;
    let mechanismType = 'Unknown';
    
    if (resource.Name.includes('BasicAuthentication')) {
      mechanismType = 'Basic Authentication';
    } else if (resource.Name.includes('OAuth')) {
      mechanismType = 'OAuth';
    } else if (resource.Name.includes('Certificate')) {
      mechanismType = 'Certificate';
    } else if (resource.Name.includes('SAML')) {
      mechanismType = 'SAML';
    } else if (resource.Name.includes('JWT')) {
      mechanismType = 'JWT';
    } else if (resource.Name.includes('Encryption')) {
      mechanismType = 'Encryption';
    }
    
    // Configuration details (if available)
    const configuration = resource.Content ? { content: resource.Content } : {};
    
    securityMechanisms.push({
      mechanism_name: mechanismName,
      mechanism_type: mechanismType,
      direction: direction,
      configuration: configuration
    });
  });
  
  return securityMechanisms;
};

/**
 * Process adapters from flow data
 * @param {Object} flowData - Flow data from fetchIntegrationFlowDetails
 * @returns {Array} Array of adapters
 */
const processAdapters = (flowData) => {
  logger.info('Processing adapters for iFlow', { flowId: flowData.id });
  
  const adapters = [];
  
  if (!flowData.adapters || !Array.isArray(flowData.adapters)) {
    logger.warn('No adapters found in flow data', { flowId: flowData.id });
    return adapters;
  }

  logger.debug('Available adapters', { 
    flowId: flowData.id, 
    adapterCount: flowData.adapters.length,
    adapterNames: flowData.adapters.map(a => a.adapter_name)
  });

  flowData.adapters.forEach(adapter => {
    // Ensure required fields are present
    if (!adapter.adapter_name || !adapter.adapter_type) {
      logger.warn('Skipping adapter with missing required fields', { 
        flowId: flowData.id, 
        adapter 
      });
      return;
    }
    
    adapters.push({
      adapter_name: adapter.adapter_name,
      adapter_type: adapter.adapter_type,
      adapter_category: adapter.adapter_category || 'Unknown',
      direction: adapter.direction || adapter.adapter_category || 'Unknown',
      configuration: adapter.configuration || {}
    });

    logger.debug('Adapter processed', { 
      flowId: flowData.id, 
      adapterName: adapter.adapter_name, 
      adapterType: adapter.adapter_type, 
      direction: adapter.direction || adapter.adapter_category
    });
  });

  if (adapters.length === 0) {
    logger.warn('No adapters detected for iFlow', { flowId: flowData.id });
  }

  return adapters;
};

/**
 * Process error handling configuration from flow data
 * @param {Object} flowData - Raw flow data from API
 * @returns {Object} Error handling configuration
 */
const processErrorHandling = (flowData) => {
  // Default error handling configuration
  const errorHandling = {
    detection_enabled: false,
    logging_enabled: false,
    classification_enabled: false,
    reporting_enabled: false,
    error_handling_details: {}
  };
  
  if (!flowData.Resources || !flowData.Resources.results) {
    return errorHandling;
  }
  
  // Look for error handling resources
  const errorResources = flowData.Resources.results.filter(
    resource => resource.Name && resource.Name.includes('ErrorHandling')
  );
  
  if (errorResources.length > 0) {
    // Update error handling configuration based on resources
    errorHandling.detection_enabled = errorResources.some(
      resource => resource.Name.includes('Detection')
    );
    
    errorHandling.logging_enabled = errorResources.some(
      resource => resource.Name.includes('Logging')
    );
    
    errorHandling.classification_enabled = errorResources.some(
      resource => resource.Name.includes('Classification')
    );
    
    errorHandling.reporting_enabled = errorResources.some(
      resource => resource.Name.includes('Reporting')
    );
    
    // Collect details from all error handling resources
    const details = {};
    errorResources.forEach(resource => {
      if (resource.Content) {
        details[resource.Name] = resource.Content;
      }
    });
    
    errorHandling.error_handling_details = details;
  }
  
  return errorHandling;
};

/**
 * Process persistence configuration from flow data
 * @param {Object} flowData - Raw flow data from API
 * @returns {Object} Persistence configuration
 */
const processPersistence = (flowData) => {
  // Default persistence configuration
  const persistence = {
    jms_enabled: false,
    data_store_enabled: false,
    variables_enabled: false,
    message_persistence_enabled: false,
    persistence_details: {}
  };
  
  if (!flowData.Resources || !flowData.Resources.results) {
    return persistence;
  }
  
  // Look for persistence resources
  const persistenceResources = flowData.Resources.results.filter(
    resource => resource.Name && (
      resource.Name.includes('Persistence') ||
      resource.Name.includes('JMS') ||
      resource.Name.includes('DataStore') ||
      resource.Name.includes('Variables')
    )
  );
  
  if (persistenceResources.length > 0) {
    // Update persistence configuration based on resources
    persistence.jms_enabled = persistenceResources.some(
      resource => resource.Name.includes('JMS')
    );
    
    persistence.data_store_enabled = persistenceResources.some(
      resource => resource.Name.includes('DataStore')
    );
    
    persistence.variables_enabled = persistenceResources.some(
      resource => resource.Name.includes('Variables')
    );
    
    persistence.message_persistence_enabled = persistenceResources.some(
      resource => resource.Name.includes('MessagePersistence')
    );
    
    // Collect details from all persistence resources
    const details = {};
    persistenceResources.forEach(resource => {
      if (resource.Content) {
        details[resource.Name] = resource.Content;
      }
    });
    
    persistence.persistence_details = details;
  }
  
  return persistence;
};

/**
 * Process deployment information from runtime data
 * @param {Object} flowData - Raw flow data from API
 * @param {Object} runtimeData - Runtime data from API
 * @returns {Object} Deployment information
 */
const processDeploymentInfo = (flowData, runtimeData = {}) => {
  // Ensure we have a valid iflow_id
  const iflowId = flowData.id || flowData.Id || flowData.iflow_id;
  
  // Default deployment information
  const deploymentInfo = {
    iflow_id: iflowId,
    version: flowData.Version || '1.0.0',
    deployment_type: 'Manual',
    deployed_by: '',
    deployed_on: null,
    status: 'Not Deployed',
    error_information: '',
    deployment_details: {}
  };
  
  // Update with runtime data if available
  if (runtimeData && runtimeData.Status) {
    deploymentInfo.status = runtimeData.Status;
    
    if (runtimeData.DeployedBy) {
      deploymentInfo.deployed_by = runtimeData.DeployedBy;
    }
    
    if (runtimeData.DeployedOn) {
      deploymentInfo.deployed_on = runtimeData.DeployedOn;
    }
    
    if (runtimeData.ErrorInformation) {
      deploymentInfo.error_information = runtimeData.ErrorInformation;
    }
    
    // Add any additional deployment details
    const details = {};
    Object.keys(runtimeData).forEach(key => {
      if (!['Id', 'Status', 'DeployedBy', 'DeployedOn', 'ErrorInformation'].includes(key)) {
        details[key] = runtimeData[key];
      }
    });
    
    deploymentInfo.deployment_details = details;
  }
  
  return deploymentInfo;
};

/**
 * Process runtime information from message logs and endpoints
 * @param {string} flowId - Flow ID
 * @param {Array} messageLogs - Message processing logs
 * @param {Array} endpoints - Service endpoints
 * @returns {Object} Runtime information
 */
const processRuntimeInfo = (flowId, messageLogs = [], endpoints = []) => {
  // Default runtime information
  const runtimeInfo = {
    iflow_id: flowId,
    endpoint: '',
    avg_processing_time: 0,
    success_count: 0,
    failure_count: 0,
    execution_type: 'Ondemand',
    last_execution_time: null,
    runtime_details: {}
  };
  
  // Extract endpoint from service endpoints
  if (endpoints && endpoints.length > 0) {
    runtimeInfo.endpoint = endpoints[0].Url || '';
  }
  
  // Process message logs if available
  if (messageLogs && messageLogs.length > 0) {
    // Count successful and failed messages
    runtimeInfo.success_count = messageLogs.filter(log => log.Status === 'COMPLETED').length;
    runtimeInfo.failure_count = messageLogs.filter(log => log.Status === 'FAILED').length;
    
    // Calculate average processing time
    let totalProcessingTime = 0;
    let processedLogs = 0;
    
    messageLogs.forEach(log => {
      if (log.LogStart && log.LogEnd) {
        const startTime = new Date(log.LogStart);
        const endTime = new Date(log.LogEnd);
        const processingTime = (endTime - startTime) / 1000; // in seconds
        
        if (processingTime > 0) {
          totalProcessingTime += processingTime;
          processedLogs++;
        }
      }
    });
    
    if (processedLogs > 0) {
      runtimeInfo.avg_processing_time = Math.round(totalProcessingTime / processedLogs * 1000); // in milliseconds
    }
    
    // Determine execution type (Scheduled, Ondemand, Both)
    const hasScheduled = messageLogs.some(log => log.ScheduledFlag === true);
    const hasOndemand = messageLogs.some(log => log.ScheduledFlag === false);
    
    if (hasScheduled && hasOndemand) {
      runtimeInfo.execution_type = 'Both';
    } else if (hasScheduled) {
      runtimeInfo.execution_type = 'Scheduled';
    } else {
      runtimeInfo.execution_type = 'Ondemand';
    }
    
    // Get last execution time
    const sortedLogs = [...messageLogs].sort((a, b) => {
      return new Date(b.LogEnd || b.LogStart) - new Date(a.LogEnd || a.LogStart);
    });
    
    if (sortedLogs.length > 0) {
      runtimeInfo.last_execution_time = sortedLogs[0].LogEnd || sortedLogs[0].LogStart;
    }
    
    // Add additional runtime details
    runtimeInfo.runtime_details = {
      total_messages: messageLogs.length,
      success_rate: runtimeInfo.success_count / messageLogs.length * 100,
      endpoints: endpoints.map(endpoint => endpoint.Url)
    };
  }
  
  return runtimeInfo;
};

module.exports = {
  processPackageData,
  processIntegrationFlowData,
  processSecurityMechanisms,
  processAdapters,
  processErrorHandling,
  processPersistence,
  processDeploymentInfo,
  processRuntimeInfo
};