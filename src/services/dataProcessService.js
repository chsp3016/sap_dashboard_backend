// services/dataProcessService.js - Complete modular implementation
const logger = require('../utils/logger');

// Import processors
const AdapterProcessor = require('./processing/adapterProcessor');
const SecurityProcessor = require('./processing/securityProcessor');
const ErrorHandlingProcessor = require('./processing/errorHandlingProcessor');
const PersistenceProcessor = require('./processing/persistenceProcessor');

// Initialize processors
const adapterProcessor = new AdapterProcessor();
const securityProcessor = new SecurityProcessor();
const errorHandlingProcessor = new ErrorHandlingProcessor();
const persistenceProcessor = new PersistenceProcessor();

/**
 * Process integration package data
 * @param {Object} packageData - Raw package data from API
 * @returns {Object} Processed package data for database
 */
const processPackageData = (packageData) => {
  try {
    logger.debug('Processing package data', { packageId: packageData.Id });
    
    return {
      package_id: packageData.Id,
      package_name: packageData.Name,
      package_description: packageData.Description || '',
      tenant_id: packageData.OwningTenant || 'default'
    };
  } catch (error) {
    logger.error('Error processing package data', { 
      error: error.message,
      packageData 
    });
    throw error;
  }
};

/**
 * Process integration flow data
 * @param {Object} flowData - Raw flow data from API
 * @param {Object} runtimeData - Runtime data from API
 * @returns {Object} Processed flow data for database
 */
const processIntegrationFlowData = (flowData, runtimeData = {}) => {
  try {
    logger.debug('Processing integration flow data', { flowId: flowData.id });
    
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
    
    // Extract basic flow information
    const processedFlow = {
      iflow_id: iflowId,
      package_id: packageId,
      iflow_name: flowData.Name || flowData.name || 'Unnamed Flow',
      iflow_description: flowData.Description || flowData.description || '',
      deployment_model: extractDeploymentModel(flowData),
      versioning_status: extractVersioningStatus(flowData),
      message_exchange_pattern: extractMessageExchangePattern(flowData),
      interface_mode: extractInterfaceMode(flowData),
      message_type: extractMessageType(flowData),
      systems_composition: extractSystemsComposition(flowData),
      iflow_type: extractIflowType(flowData),
      flag_based_logging: extractFlagBasedLogging(flowData),
      auditing: extractAuditing(flowData),
      context: extractContext(flowData),
      health_check: extractHealthCheck(flowData),
      additional_attributes: extractAdditionalAttributes(flowData, runtimeData)
    };
    
    logger.debug('Integration flow processing completed', { 
      iflowId,
      packageId,
      iflowName: processedFlow.iflow_name
    });
    
    return processedFlow;
  } catch (error) {
    logger.error('Error processing integration flow data', { 
      error: error.message,
      stack: error.stack,
      flowData 
    });
    throw error;
  }
};

/**
 * Extract deployment model from flow data
 * @param {Object} flowData - Flow data
 * @returns {string} Deployment model
 */
const extractDeploymentModel = (flowData) => {
  // Try to extract from Resources if available
  if (flowData.Resources && flowData.Resources.results) {
    const deploymentResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('DeploymentModel')
    );
    if (deploymentResource) {
      if (deploymentResource.Name.includes('Hybrid')) return 'Hybrid';
      if (deploymentResource.Name.includes('CloudToCloud')) return 'Cloud to Cloud';
      if (deploymentResource.Name.includes('CloudToOnprem')) return 'Cloud to Onprem';
      if (deploymentResource.Name.includes('OnpremToOnprem')) return 'Onprem to Onprem';
    }
  }
  
  // Default based on flow characteristics or undefined
  return 'undefined';
};

/**
 * Extract versioning status from flow data
 * @param {Object} flowData - Flow data
 * @returns {string} Versioning status
 */
const extractVersioningStatus = (flowData) => {
  // Check version information
  if (flowData.Version && flowData.Version !== '1.0.0') {
    return 'Versioned';
  }
  return 'Draft';
};

/**
 * Extract message exchange pattern from flow data
 * @param {Object} flowData - Flow data
 * @returns {string} Message exchange pattern
 */
const extractMessageExchangePattern = (flowData) => {
  if (flowData.Resources && flowData.Resources.results) {
    const mepResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('MessageExchangePattern')
    );
    if (mepResource && mepResource.Name.includes('Sync')) {
      return 'Sync';
    }
  }
  return 'Async'; // Default
};

/**
 * Extract interface mode from flow data
 * @param {Object} flowData - Flow data
 * @returns {string} Interface mode
 */
const extractInterfaceMode = (flowData) => {
  if (flowData.Resources && flowData.Resources.results) {
    const interfaceResource = flowData.Resources.results.find(
      resource => resource.Name && (
        resource.Name.includes('Batch') || 
        resource.Name.includes('EventDriven')
      )
    );
    if (interfaceResource) {
      if (interfaceResource.Name.includes('Batch')) return 'Batch';
      if (interfaceResource.Name.includes('EventDriven')) return 'event-driven';
    }
  }
  return 'real-time'; // Default
};

/**
 * Extract message type from flow data
 * @param {Object} flowData - Flow data
 * @returns {string} Message type
 */
const extractMessageType = (flowData) => {
  if (flowData.Resources && flowData.Resources.results) {
    const messageTypeResource = flowData.Resources.results.find(
      resource => resource.Name && (
        resource.Name.includes('Json') || 
        resource.Name.includes('EDI')
      )
    );
    if (messageTypeResource) {
      if (messageTypeResource.Name.includes('Json')) return 'Json';
      if (messageTypeResource.Name.includes('EDI')) return 'EDI';
    }
  }
  return 'xml'; // Default
};

/**
 * Extract systems composition from flow data
 * @param {Object} flowData - Flow data
 * @returns {string} Systems composition
 */
const extractSystemsComposition = (flowData) => {
  if (flowData.Resources && flowData.Resources.results) {
    const systemsResource = flowData.Resources.results.find(
      resource => resource.Name && (
        resource.Name.includes('SAP2NONSAP') || 
        resource.Name.includes('NONSAP2NONSAP')
      )
    );
    if (systemsResource) {
      if (systemsResource.Name.includes('SAP2NONSAP')) return 'SAP2NONSAP';
      if (systemsResource.Name.includes('NONSAP2NONSAP')) return 'NONSAP2NONSAP';
    }
  }
  return 'SAP2SAP'; // Default
};

/**
 * Extract iFlow type from flow data
 * @param {Object} flowData - Flow data
 * @returns {string} iFlow type
 */
const extractIflowType = (flowData) => {
  if (flowData.Resources && flowData.Resources.results) {
    const typeResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('Standard')
    );
    if (typeResource) {
      return 'Standard';
    }
  }
  return 'Custom'; // Default
};

/**
 * Extract flag-based logging setting
 * @param {Object} flowData - Flow data
 * @returns {boolean} Flag-based logging enabled
 */
const extractFlagBasedLogging = (flowData) => {
  if (flowData.Resources && flowData.Resources.results) {
    const loggingResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('FlagBasedLogging')
    );
    return !!loggingResource;
  }
  return false;
};

/**
 * Extract auditing setting
 * @param {Object} flowData - Flow data
 * @returns {boolean} Auditing enabled
 */
const extractAuditing = (flowData) => {
  if (flowData.Resources && flowData.Resources.results) {
    const auditingResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('Auditing')
    );
    return !!auditingResource;
  }
  return false;
};

/**
 * Extract context from flow data
 * @param {Object} flowData - Flow data
 * @returns {string} Context
 */
const extractContext = (flowData) => {
  if (flowData.Resources && flowData.Resources.results) {
    const contextResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('Context')
    );
    if (contextResource && contextResource.Content) {
      return contextResource.Content;
    }
  }
  return '';
};

/**
 * Extract health check setting
 * @param {Object} flowData - Flow data
 * @returns {boolean} Health check enabled
 */
const extractHealthCheck = (flowData) => {
  if (flowData.Resources && flowData.Resources.results) {
    const healthCheckResource = flowData.Resources.results.find(
      resource => resource.Name && resource.Name.includes('HealthCheck')
    );
    return !!healthCheckResource;
  }
  return false;
};

/**
 * Extract additional attributes
 * @param {Object} flowData - Flow data
 * @param {Object} runtimeData - Runtime data
 * @returns {Object} Additional attributes
 */
const extractAdditionalAttributes = (flowData, runtimeData) => {
  return {
    id: flowData.id || flowData.Id,
    artifactId: flowData.ArtifactId,
    createdBy: flowData.CreatedBy,
    createdAt: flowData.CreatedAt,
    modifiedBy: flowData.ModifiedBy,
    modifiedAt: flowData.ModifiedAt,
    version: flowData.Version,
    deploymentStatus: runtimeData.Status || 'Not Deployed'
  };
};

/**
 * Process security mechanisms using the dedicated processor
 * @param {Object} flowData - Flow data with parsed XML
 * @param {Array} securityMechanisms - Extracted security mechanisms
 * @returns {Array} Array of processed security mechanisms
 */
const processSecurityMechanisms = (flowData, securityMechanisms) => {
  return securityProcessor.processSecurityMechanisms(flowData, securityMechanisms);
};

/**
 * Process adapters using the dedicated processor
 * @param {Object} flowData - Flow data with parsed XML
 * @param {Array} adapters - Extracted adapters
 * @returns {Array} Array of processed adapters
 */
const processAdapters = (flowData, adapters) => {
  return adapterProcessor.processAdapters(flowData, adapters);
};

/**
 * Process error handling using the dedicated processor
 * @param {Object} flowData - Flow data with parsed XML
 * @param {Object} errorHandling - Extracted error handling configuration
 * @returns {Object} Processed error handling configuration
 */
const processErrorHandling = (flowData, errorHandling) => {
  return errorHandlingProcessor.processErrorHandling(flowData, errorHandling);
};

/**
 * Process persistence using the dedicated processor
 * @param {Object} flowData - Flow data with parsed XML
 * @param {Object} persistence - Extracted persistence configuration
 * @returns {Object} Processed persistence configuration
 */
const processPersistence = (flowData, persistence) => {
  return persistenceProcessor.processPersistence(flowData, persistence);
};

/**
 * Process deployment information from runtime data
 * @param {Object} flowData - Raw flow data from API
 * @param {Object} runtimeData - Runtime data from API
 * @returns {Object} Deployment information
 */
const processDeploymentInfo = (flowData, runtimeData = {}) => {
  try {
    logger.debug('Processing deployment info', { flowId: flowData.id });
    
    // Ensure we have a valid iflow_id
    const iflowId = flowData.id || flowData.Id || flowData.iflow_id;
    
    // Default deployment information
    const deploymentInfo = {
      iflow_id: iflowId,
      version: flowData.Version || '1.0.0',
      deployment_type: 'Manual',
      deployed_by: runtimeData.DeployedBy || '',
      deployed_on: runtimeData.DeployedOn || null,
      status: runtimeData.Status || 'Not Deployed',
      error_information: runtimeData.ErrorInformation || '',
      deployment_details: extractDeploymentDetails(runtimeData)
    };
    
    logger.debug('Deployment info processing completed', { 
      iflowId,
      status: deploymentInfo.status
    });
    
    return deploymentInfo;
  } catch (error) {
    logger.error('Error processing deployment info', { 
      error: error.message,
      flowData,
      runtimeData 
    });
    throw error;
  }
};

/**
 * Extract deployment details from runtime data
 * @param {Object} runtimeData - Runtime data
 * @returns {Object} Deployment details
 */
const extractDeploymentDetails = (runtimeData) => {
  const details = {};
  
  // Add any additional runtime data excluding the main fields
  const excludedFields = ['Id', 'Status', 'DeployedBy', 'DeployedOn', 'ErrorInformation'];
  
  Object.keys(runtimeData).forEach(key => {
    if (!excludedFields.includes(key)) {
      details[key] = runtimeData[key];
    }
  });
  
  return details;
};

/**
 * Process runtime information from message logs and endpoints
 * @param {string} flowId - Flow ID
 * @param {Array} messageLogs - Message processing logs
 * @param {Array} endpoints - Service endpoints
 * @returns {Object} Runtime information
 */
const processRuntimeInfo = (flowId, messageLogs = [], endpoints = []) => {
  try {
    logger.debug('Processing runtime info', { flowId });
    
    // Default runtime information
    const runtimeInfo = {
      iflow_id: flowId,
      endpoint: extractEndpoint(endpoints),
      avg_processing_time: calculateAverageProcessingTime(messageLogs),
      success_count: countSuccessfulMessages(messageLogs),
      failure_count: countFailedMessages(messageLogs),
      execution_type: determineExecutionType(messageLogs),
      last_execution_time: extractLastExecutionTime(messageLogs),
      runtime_details: buildRuntimeDetails(messageLogs, endpoints)
    };
    
    logger.debug('Runtime info processing completed', { 
      flowId,
      successCount: runtimeInfo.success_count,
      failureCount: runtimeInfo.failure_count
    });
    
    return runtimeInfo;
  } catch (error) {
    logger.error('Error processing runtime info', { 
      error: error.message,
      flowId,
      messageLogs,
      endpoints 
    });
    throw error;
  }
};

/**
 * Extract endpoint from service endpoints
 * @param {Array} endpoints - Service endpoints
 * @returns {string} Primary endpoint URL
 */
const extractEndpoint = (endpoints) => {
  if (endpoints && endpoints.length > 0) {
    return endpoints[0].Url || '';
  }
  return '';
};

/**
 * Calculate average processing time from message logs
 * @param {Array} messageLogs - Message logs
 * @returns {number} Average processing time in milliseconds
 */
const calculateAverageProcessingTime = (messageLogs) => {
  if (!messageLogs || messageLogs.length === 0) {
    return 0;
  }
  
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
    return Math.round(totalProcessingTime / processedLogs * 1000); // in milliseconds
  }
  
  return 0;
};

/**
 * Count successful messages from logs
 * @param {Array} messageLogs - Message logs
 * @returns {number} Count of successful messages
 */
const countSuccessfulMessages = (messageLogs) => {
  if (!messageLogs || messageLogs.length === 0) {
    return 0;
  }
  return messageLogs.filter(log => log.Status === 'COMPLETED').length;
};

/**
 * Count failed messages from logs
 * @param {Array} messageLogs - Message logs
 * @returns {number} Count of failed messages
 */
const countFailedMessages = (messageLogs) => {
  if (!messageLogs || messageLogs.length === 0) {
    return 0;
  }
  return messageLogs.filter(log => log.Status === 'FAILED').length;
};

/**
 * Determine execution type from message logs
 * @param {Array} messageLogs - Message logs
 * @returns {string} Execution type
 */
const determineExecutionType = (messageLogs) => {
  if (!messageLogs || messageLogs.length === 0) {
    return 'Ondemand';
  }
  
  const hasScheduled = messageLogs.some(log => log.ScheduledFlag === true);
  const hasOndemand = messageLogs.some(log => log.ScheduledFlag === false);
  
  if (hasScheduled && hasOndemand) {
    return 'Both';
  } else if (hasScheduled) {
    return 'Scheduled';
  } else {
    return 'Ondemand';
  }
};

/**
 * Extract last execution time from message logs
 * @param {Array} messageLogs - Message logs
 * @returns {string|null} Last execution time
 */
const extractLastExecutionTime = (messageLogs) => {
  if (!messageLogs || messageLogs.length === 0) {
    return null;
  }
  
  const sortedLogs = [...messageLogs].sort((a, b) => {
    return new Date(b.LogEnd || b.LogStart) - new Date(a.LogEnd || a.LogStart);
  });
  
  if (sortedLogs.length > 0) {
    return sortedLogs[0].LogEnd || sortedLogs[0].LogStart;
  }
  
  return null;
};

/**
 * Build runtime details object
 * @param {Array} messageLogs - Message logs
 * @param {Array} endpoints - Service endpoints
 * @returns {Object} Runtime details
 */
const buildRuntimeDetails = (messageLogs, endpoints) => {
  const details = {
    total_messages: messageLogs ? messageLogs.length : 0,
    endpoints: endpoints ? endpoints.map(endpoint => endpoint.Url) : []
  };
  
  if (messageLogs && messageLogs.length > 0) {
    details.success_rate = (details.total_messages > 0) ? 
      (countSuccessfulMessages(messageLogs) / details.total_messages * 100) : 0;
    
    // Add additional statistics
    details.message_statistics = {
      completed: countSuccessfulMessages(messageLogs),
      failed: countFailedMessages(messageLogs),
      processing: messageLogs.filter(log => log.Status === 'PROCESSING').length,
      abandoned: messageLogs.filter(log => log.Status === 'ABANDONED').length
    };
  }
  
  return details;
};

/**
 * Validate processed data before database insertion
 * @param {Object} data - Processed data
 * @param {string} dataType - Type of data being validated
 * @returns {Object} Validation result
 */
const validateProcessedData = (data, dataType) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  try {
    switch (dataType) {
      case 'package':
        return validatePackageData(data);
      case 'iflow':
        return validateIflowData(data);
      case 'adapter':
        return adapterProcessor.validateAdapter(data);
      case 'security':
        return securityProcessor.validateSecurityMechanism(data);
      case 'errorHandling':
        return errorHandlingProcessor.validateErrorHandling(data);
      case 'persistence':
        return persistenceProcessor.validatePersistence(data);
      default:
        validation.warnings.push(`Unknown data type: ${dataType}`);
    }
  } catch (error) {
    validation.isValid = false;
    validation.errors.push(`Validation error: ${error.message}`);
  }
  
  return validation;
};

/**
 * Validate package data
 * @param {Object} packageData - Package data
 * @returns {Object} Validation result
 */
const validatePackageData = (packageData) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  if (!packageData.package_id) {
    validation.isValid = false;
    validation.errors.push('Missing package_id');
  }
  
  if (!packageData.package_name) {
    validation.isValid = false;
    validation.errors.push('Missing package_name');
  }
  
  if (packageData.package_name && packageData.package_name.length > 255) {
    validation.warnings.push('package_name exceeds 255 characters');
  }
  
  return validation;
};

/**
 * Validate iFlow data
 * @param {Object} iflowData - iFlow data
 * @returns {Object} Validation result
 */
const validateIflowData = (iflowData) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  if (!iflowData.iflow_id) {
    validation.isValid = false;
    validation.errors.push('Missing iflow_id');
  }
  
  if (!iflowData.package_id) {
    validation.isValid = false;
    validation.errors.push('Missing package_id');
  }
  
  if (!iflowData.iflow_name) {
    validation.isValid = false;
    validation.errors.push('Missing iflow_name');
  }
  
  // Validate field lengths
  if (iflowData.iflow_name && iflowData.iflow_name.length > 255) {
    validation.warnings.push('iflow_name exceeds 255 characters');
  }
  
  // Validate enum values
  const validDeploymentModels = ['Hybrid', 'Cloud to Cloud', 'Cloud to Onprem', 'Onprem to Onprem', 'undefined'];
  if (iflowData.deployment_model && !validDeploymentModels.includes(iflowData.deployment_model)) {
    validation.warnings.push(`Invalid deployment_model: ${iflowData.deployment_model}`);
  }
  
  return validation;
};

module.exports = {
  processPackageData,
  processIntegrationFlowData,
  processSecurityMechanisms,
  processAdapters,
  processErrorHandling,
  processPersistence,
  processDeploymentInfo,
  processRuntimeInfo,
  validateProcessedData
};