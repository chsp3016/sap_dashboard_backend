// services/processing/adapterProcessor.js
const BaseProcessor = require('./baseProcessor');
const logger = require('../../utils/logger');

/**
 * Adapter processing logic
 */
class AdapterProcessor extends BaseProcessor {
  /**
   * Process adapters from flow data
   * @param {Object} flowData - Flow data with parsed XML
   * @param {Array} adapters - Array of extracted adapters
   * @returns {Array} Array of processed adapters
   */
  processAdapters(flowData, adapters) {
    logger.info('Processing adapters for iFlow', { flowId: flowData.id });
    
    const processedAdapters = [];
    
    if (!adapters || !Array.isArray(adapters)) {
      logger.warn('No adapters found in flow data', { flowId: flowData.id });
      return processedAdapters;
    }

    logger.debug('Available adapters', { 
      flowId: flowData.id, 
      adapterCount: adapters.length,
      adapterNames: adapters.map(a => a.adapter_name)
    });

    adapters.forEach(adapter => {
      // Validate required fields
      if (!this.validateRequiredFields(adapter, ['adapter_name', 'adapter_type'], 'adapter processing')) {
        logger.warn('Skipping adapter with missing required fields', { 
          flowId: flowData.id, 
          adapter 
        });
        return;
      }
      
      const processedAdapter = this.processIndividualAdapter(adapter, flowData.id);
      if (processedAdapter) {
        processedAdapters.push(processedAdapter);
      }
    });

    if (processedAdapters.length === 0) {
      logger.warn('No adapters detected for iFlow', { flowId: flowData.id });
    } else {
      logger.info('Adapters processing completed', { 
        flowId: flowData.id, 
        processedCount: processedAdapters.length 
      });
    }

    return processedAdapters;
  }

  /**
   * Process individual adapter
   * @param {Object} adapter - Adapter data
   * @param {string} flowId - Flow ID for logging
   * @returns {Object|null} Processed adapter or null
   */
  processIndividualAdapter(adapter, flowId) {
    try {
      // Sanitize adapter fields
      const processedAdapter = {
        adapter_name: this.sanitizeString(adapter.adapter_name, 255),
        adapter_type: this.sanitizeString(adapter.adapter_type, 100),
        adapter_category: this.sanitizeString(adapter.adapter_category || 'Unknown', 100),
        direction: this.determineDirection(adapter),
        configuration: this.processAdapterConfiguration(adapter.configuration)
      };

      // Log processing details
      this.logProcessingDetails('Adapter', processedAdapter, flowId);

      logger.debug('Adapter processed', { 
        flowId, 
        adapterName: processedAdapter.adapter_name, 
        adapterType: processedAdapter.adapter_type, 
        direction: processedAdapter.direction
      });

      return processedAdapter;
    } catch (error) {
      logger.error('Error processing individual adapter', {
        flowId,
        adapter,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Determine adapter direction
   * @param {Object} adapter - Adapter data
   * @returns {string} Direction (Sender/Receiver/Unknown)
   */
  determineDirection(adapter) {
    // First, check the direction field
    if (adapter.direction) {
      return this.sanitizeString(adapter.direction, 50);
    }
    
    // Fallback to adapter_category
    if (adapter.adapter_category) {
      return this.sanitizeString(adapter.adapter_category, 50);
    }
    
    // Try to determine from adapter type
    const adapterType = adapter.adapter_type?.toLowerCase() || '';
    
    if (adapterType.includes('sender') || adapterType.includes('inbound')) {
      return 'Sender';
    }
    
    if (adapterType.includes('receiver') || adapterType.includes('outbound')) {
      return 'Receiver';
    }
    
    return 'Unknown';
  }

  /**
   * Process adapter configuration
   * @param {Object} configuration - Raw adapter configuration
   * @returns {Object} Processed configuration
   */
  processAdapterConfiguration(configuration) {
    if (!configuration) {
      return {};
    }

    const processed = {};
    
    // Handle nested configuration structure
    if (configuration.content) {
      processed.content = configuration.content;
    }
    
    if (configuration.resourceMetadata) {
      processed.resourceMetadata = this.validateJson(configuration.resourceMetadata, 'adapter metadata');
    }
    
    // Handle direct configuration properties
    Object.keys(configuration).forEach(key => {
      if (key !== 'content' && key !== 'resourceMetadata') {
        processed[key] = configuration[key];
      }
    });
    
    return processed;
  }

  /**
   * Extract adapter type mapping
   * @param {string} componentType - Component type from XML
   * @returns {string} Normalized adapter type
   */
  normalizeAdapterType(componentType) {
    if (!componentType) {
      return 'Unknown';
    }
    
    const typeMapping = {
      'HTTPS': 'HTTPS Sender',
      'HTTP': 'HTTP Receiver',
      'HCIOData': 'OData Receiver',
      'ProcessDirect': 'Process Direct',
      'JMS': 'JMS Adapter',
      'SFTP': 'SFTP Adapter',
      'Mail': 'Mail Adapter',
      'FTP': 'FTP Adapter',
      'SOAP': 'SOAP Adapter',
      'REST': 'REST Adapter'
    };
    
    return typeMapping[componentType] || componentType;
  }

  /**
   * Extract adapter category from properties
   * @param {Object} adapter - Adapter data
   * @returns {string} Adapter category
   */
  extractAdapterCategory(adapter) {
    // Check if direction is provided
    if (adapter.direction) {
      return adapter.direction;
    }
    
    // Check adapter_category
    if (adapter.adapter_category) {
      return adapter.adapter_category;
    }
    
    // Determine from configuration
    if (adapter.configuration && adapter.configuration.resourceMetadata) {
      const metadata = adapter.configuration.resourceMetadata;
      
      // Check component type for hints
      if (metadata.componentType) {
        const componentType = metadata.componentType.toLowerCase();
        
        if (componentType.includes('sender') || componentType.includes('https')) {
          return 'Sender';
        }
        
        if (componentType.includes('receiver') || componentType.includes('http') || 
            componentType.includes('odata') || componentType.includes('process')) {
          return 'Receiver';
        }
      }
    }
    
    return 'Unknown';
  }

  /**
   * Validate adapter data integrity
   * @param {Object} adapter - Adapter data
   * @returns {Object} Validation result
   */
  validateAdapter(adapter) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // Check required fields
    if (!adapter.adapter_name) {
      validation.isValid = false;
      validation.errors.push('Missing adapter_name');
    }
    
    if (!adapter.adapter_type) {
      validation.isValid = false;
      validation.errors.push('Missing adapter_type');
    }
    
    // Check field lengths
    if (adapter.adapter_name && adapter.adapter_name.length > 255) {
      validation.warnings.push('adapter_name exceeds 255 characters');
    }
    
    if (adapter.adapter_type && adapter.adapter_type.length > 100) {
      validation.warnings.push('adapter_type exceeds 100 characters');
    }
    
    // Validate direction
    const validDirections = ['Sender', 'Receiver', 'Unknown'];
    if (adapter.direction && !validDirections.includes(adapter.direction)) {
      validation.warnings.push(`Invalid direction: ${adapter.direction}`);
    }
    
    return validation;
  }
}

module.exports = AdapterProcessor;