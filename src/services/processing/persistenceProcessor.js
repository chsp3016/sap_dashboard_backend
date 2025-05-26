// services/processing/persistenceProcessor.js (continued)
const BaseProcessor = require('./baseProcessor');
const logger = require('../../utils/logger');

/**
 * Persistence processing logic
 */
class PersistenceProcessor extends BaseProcessor {
  /**
   * Process persistence configuration from flow data
   * @param {Object} flowData - Flow data with parsed XML
   * @param {Object} persistence - Extracted persistence configuration
   * @returns {Object} Processed persistence configuration
   */
  processPersistence(flowData, persistence) {
    logger.info('Processing persistence for iFlow', { flowId: flowData.id });
    
    if (!persistence) {
      logger.warn('No persistence configuration found', { flowId: flowData.id });
      return this.getDefaultPersistence();
    }

    const processed = {
      jms_enabled: this.ensureBoolean(persistence.jms_enabled),
      data_store_enabled: this.ensureBoolean(persistence.data_store_enabled),
      variables_enabled: this.ensureBoolean(persistence.variables_enabled),
      message_persistence_enabled: this.ensureBoolean(persistence.message_persistence_enabled),
      persistence_details: this.processPersistenceDetails(persistence.persistence_details)
    };

    // Log processing details
    this.logProcessingDetails('Persistence', processed, flowData.id);

    logger.info('Persistence processing completed', { 
      flowId: flowData.id,
      jmsEnabled: processed.jms_enabled,
      dataStoreEnabled: processed.data_store_enabled,
      variablesEnabled: processed.variables_enabled,
      messagePersistenceEnabled: processed.message_persistence_enabled
    });

    return processed;
  }

  /**
   * Get default persistence configuration
   * @returns {Object} Default persistence configuration
   */
  getDefaultPersistence() {
    return {
      jms_enabled: false,
      data_store_enabled: false,
      variables_enabled: false,
      message_persistence_enabled: false,
      persistence_details: {}
    };
  }

  /**
   * Process persistence details
   * @param {Object} details - Raw persistence details
   * @returns {Object} Processed persistence details
   */
  processPersistenceDetails(details) {
    if (!details || typeof details !== 'object') {
      return {};
    }

    const processed = {};

    // Process JMS adapters
    if (details.jmsAdapters && Array.isArray(details.jmsAdapters)) {
      processed.jmsAdapters = this.processJmsAdapters(details.jmsAdapters);
    }

    // Process message persistence
    if (details.messagePersistence && Array.isArray(details.messagePersistence)) {
      processed.messagePersistence = this.processMessagePersistence(details.messagePersistence);
    }

    // Process data store operations
    if (details.dataStoreOperations && Array.isArray(details.dataStoreOperations)) {
      processed.dataStoreOperations = this.processDataStoreOperations(details.dataStoreOperations);
    }

    // Process data store activities
    if (details.dataStoreActivities && Array.isArray(details.dataStoreActivities)) {
      processed.dataStoreActivities = this.processDataStoreActivities(details.dataStoreActivities);
    }

    // Process variable operations
    if (details.variableOperations && Array.isArray(details.variableOperations)) {
      processed.variableOperations = this.processVariableOperations(details.variableOperations);
    }

    // Process external calls
    if (details.externalCalls && Array.isArray(details.externalCalls)) {
      processed.externalCalls = this.processExternalCalls(details.externalCalls);
    }

    // Process transactional handling
    if (details.transactionalHandling) {
      processed.transactionalHandling = this.sanitizeString(details.transactionalHandling, 100);
    }

    // Process process type
    if (details.processType) {
      processed.processType = this.sanitizeString(details.processType, 100);
    }

    // Process direct call flag
    if (details.directCall !== undefined) {
      processed.directCall = Boolean(details.directCall);
    }

    return processed;
  }

  /**
   * Process JMS adapters
   * @param {Array} jmsAdapters - JMS adapter configurations
   * @returns {Array} Processed JMS adapters
   */
  processJmsAdapters(jmsAdapters) {
    return jmsAdapters.map(adapter => ({
      name: this.sanitizeString(adapter.name, 255),
      type: this.sanitizeString(adapter.type, 100),
      properties: this.validateJson(adapter.properties, 'JMS adapter properties')
    }));
  }

  /**
   * Process message persistence configurations
   * @param {Array} messagePersistence - Message persistence configurations
   * @returns {Array} Processed message persistence
   */
  processMessagePersistence(messagePersistence) {
    return messagePersistence.map(config => ({
      adapterName: this.sanitizeString(config.adapterName, 255),
      componentType: this.sanitizeString(config.componentType, 100),
      enabled: Boolean(config.enabled),
      configuration: this.validateJson(config.configuration, 'message persistence config')
    }));
  }

  /**
   * Process data store operations
   * @param {Array} dataStoreOperations - Data store operations
   * @returns {Array} Processed data store operations
   */
  processDataStoreOperations(dataStoreOperations) {
    return dataStoreOperations.map(operation => ({
      adapterName: this.sanitizeString(operation.adapterName, 255),
      componentType: this.sanitizeString(operation.componentType, 100),
      operation: this.sanitizeString(operation.operation, 100),
      enabled: Boolean(operation.enabled),
      configuration: this.validateJson(operation.configuration, 'data store operation config')
    }));
  }

  /**
   * Process data store activities
   * @param {Array} dataStoreActivities - Data store activities
   * @returns {Array} Processed data store activities
   */
  processDataStoreActivities(dataStoreActivities) {
    return dataStoreActivities.map(activity => ({
      id: this.sanitizeString(activity.id, 100),
      name: this.sanitizeString(activity.name, 255),
      type: this.sanitizeString(activity.type, 100),
      properties: Array.isArray(activity.properties) ? 
        activity.properties.map(prop => ({
          key: this.sanitizeString(prop.key, 100),
          value: this.sanitizeString(prop.value, 500)
        })) : []
    }));
  }

  /**
   * Process variable operations
   * @param {Array} variableOperations - Variable operations
   * @returns {Array} Processed variable operations
   */
  processVariableOperations(variableOperations) {
    return variableOperations.map(operation => ({
      id: this.sanitizeString(operation.id, 100),
      name: this.sanitizeString(operation.name, 255),
      type: this.sanitizeString(operation.type, 100),
      operation: this.sanitizeString(operation.operation, 255)
    }));
  }

  /**
   * Process external calls
   * @param {Array} externalCalls - External calls
   * @returns {Array} Processed external calls
   */
  processExternalCalls(externalCalls) {
    return externalCalls.map(call => ({
      id: this.sanitizeString(call.id, 100),
      name: this.sanitizeString(call.name, 255)
    }));
  }

  /**
   * Validate persistence configuration
   * @param {Object} persistence - Persistence configuration
   * @returns {Object} Validation result
   */
  validatePersistence(persistence) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check boolean fields
    const booleanFields = ['jms_enabled', 'data_store_enabled', 'variables_enabled', 'message_persistence_enabled'];
    booleanFields.forEach(field => {
      if (persistence[field] !== undefined && typeof persistence[field] !== 'boolean') {
        validation.warnings.push(`${field} should be boolean, got ${typeof persistence[field]}`);
      }
    });

    // Validate persistence details
    if (persistence.persistence_details && typeof persistence.persistence_details !== 'object') {
      validation.errors.push('persistence_details must be an object');
      validation.isValid = false;
    }

    // Check for consistency
    if (persistence.jms_enabled && persistence.persistence_details) {
      const details = persistence.persistence_details;
      
      if (!details.jmsAdapters || !Array.isArray(details.jmsAdapters) || details.jmsAdapters.length === 0) {
        validation.warnings.push('JMS enabled but no JMS adapters found');
      }
    }

    if (persistence.data_store_enabled && persistence.persistence_details) {
      const details = persistence.persistence_details;
      
      if ((!details.dataStoreOperations || details.dataStoreOperations.length === 0) &&
          (!details.dataStoreActivities || details.dataStoreActivities.length === 0)) {
        validation.warnings.push('Data store enabled but no data store operations found');
      }
    }

    return validation;
  }

  /**
   * Extract persistence patterns from flow data
   * @param {Object} flowData - Flow data
   * @returns {Object} Persistence patterns summary
   */
  extractPersistencePatterns(flowData) {
    const patterns = {
      persistenceTypes: [],
      complexity: 'Low',
      transactional: false,
      hasTemporaryStorage: false,
      hasPermanentStorage: false,
      dataFlowPattern: 'Stateless'
    };

    if (!flowData || !flowData.persistence_details) {
      return patterns;
    }

    const details = flowData.persistence_details;

    // Identify persistence types
    if (flowData.jms_enabled) {
      patterns.persistenceTypes.push('JMS');
      patterns.hasPermanentStorage = true;
    }

    if (flowData.data_store_enabled) {
      patterns.persistenceTypes.push('Data Store');
      patterns.hasTemporaryStorage = true; // Data stores are typically temporary
    }

    if (flowData.variables_enabled) {
      patterns.persistenceTypes.push('Variables');
      patterns.hasTemporaryStorage = true;
    }

    if (flowData.message_persistence_enabled) {
      patterns.persistenceTypes.push('Message Persistence');
      patterns.hasPermanentStorage = true;
    }

    // Check for transactional handling
    if (details.transactionalHandling && details.transactionalHandling !== 'None') {
      patterns.transactional = true;
      patterns.persistenceTypes.push('Transactional');
    }

    // Determine complexity
    const typeCount = patterns.persistenceTypes.length;
    
    if (typeCount === 0) {
      patterns.complexity = 'None';
      patterns.dataFlowPattern = 'Stateless';
    } else if (typeCount === 1) {
      patterns.complexity = 'Low';
      patterns.dataFlowPattern = 'Simple Stateful';
    } else if (typeCount <= 2) {
      patterns.complexity = 'Medium';
      patterns.dataFlowPattern = 'Stateful';
    } else {
      patterns.complexity = 'High';
      patterns.dataFlowPattern = 'Complex Stateful';
    }

    // Determine data flow pattern
    if (patterns.hasPermanentStorage && patterns.hasTemporaryStorage) {
      patterns.dataFlowPattern = 'Hybrid Persistence';
    } else if (patterns.hasPermanentStorage) {
      patterns.dataFlowPattern = 'Persistent Storage';
    } else if (patterns.hasTemporaryStorage) {
      patterns.dataFlowPattern = 'Temporary Storage';
    }

    return patterns;
  }

  /**
   * Generate persistence recommendations
   * @param {Object} persistence - Persistence configuration
   * @returns {Array} Array of recommendations
   */
  generatePersistenceRecommendations(persistence) {
    const recommendations = [];

    // Check for potential performance issues
    if (persistence.jms_enabled && persistence.data_store_enabled) {
      recommendations.push({
        type: 'performance',
        message: 'Multiple persistence mechanisms may impact performance',
        priority: 'medium'
      });
    }

    // Check for direct call processes with persistence
    if (persistence.persistence_details?.directCall && persistence.message_persistence_enabled) {
      recommendations.push({
        type: 'design',
        message: 'Direct call processes typically do not need message persistence',
        priority: 'low'
      });
    }

    // Check for missing transactional handling with persistence
    if ((persistence.jms_enabled || persistence.message_persistence_enabled) && 
        (!persistence.persistence_details?.transactionalHandling || 
         persistence.persistence_details.transactionalHandling === 'None')) {
      recommendations.push({
        type: 'reliability',
        message: 'Consider enabling transactional handling for persistent operations',
        priority: 'high'
      });
    }

    // Check for data store operations without explicit data store usage
    if (persistence.persistence_details?.dataStoreOperations?.length > 0 && !persistence.data_store_enabled) {
      recommendations.push({
        type: 'configuration',
        message: 'Data store operations found but data store not enabled',
        priority: 'high'
      });
    }

    // Security recommendation for persistent data
    if (persistence.jms_enabled || persistence.data_store_enabled || persistence.message_persistence_enabled) {
      recommendations.push({
        type: 'security',
        message: 'Ensure sensitive data is encrypted when using persistence mechanisms',
        priority: 'high'
      });
    }

    return recommendations;
  }

  /**
   * Calculate persistence footprint
   * @param {Object} persistence - Persistence configuration
   * @returns {Object} Persistence footprint analysis
   */
  calculatePersistenceFootprint(persistence) {
    const footprint = {
      storageTypes: [],
      estimatedComplexity: 0,
      resourceUsage: 'Low',
      maintenanceLevel: 'Low'
    };

    if (!persistence) {
      return footprint;
    }

    let complexityScore = 0;

    // Calculate based on enabled persistence types
    if (persistence.jms_enabled) {
      footprint.storageTypes.push('JMS Queues');
      complexityScore += 3;
    }

    if (persistence.data_store_enabled) {
      footprint.storageTypes.push('Data Store');
      complexityScore += 2;
    }

    if (persistence.variables_enabled) {
      footprint.storageTypes.push('Process Variables');
      complexityScore += 1;
    }

    if (persistence.message_persistence_enabled) {
      footprint.storageTypes.push('Message Persistence');
      complexityScore += 3;
    }

    // Factor in additional details
    if (persistence.persistence_details) {
      const details = persistence.persistence_details;
      
      if (details.jmsAdapters?.length > 1) {
        complexityScore += 1;
      }
      
      if (details.dataStoreOperations?.length > 3) {
        complexityScore += 1;
      }
      
      if (details.transactionalHandling === 'Required') {
        complexityScore += 2;
      }
    }

    footprint.estimatedComplexity = complexityScore;

    // Determine resource usage and maintenance level
    if (complexityScore <= 2) {
      footprint.resourceUsage = 'Low';
      footprint.maintenanceLevel = 'Low';
    } else if (complexityScore <= 5) {
      footprint.resourceUsage = 'Medium';
      footprint.maintenanceLevel = 'Medium';
    } else {
      footprint.resourceUsage = 'High';
      footprint.maintenanceLevel = 'High';
    }

    return footprint;
  }
}

module.exports = PersistenceProcessor;