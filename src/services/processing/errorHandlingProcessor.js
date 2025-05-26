// services/processing/errorHandlingProcessor.js
const BaseProcessor = require('./baseProcessor');
const logger = require('../../utils/logger');

/**
 * Error handling processing logic
 */
class ErrorHandlingProcessor extends BaseProcessor {
  /**
   * Process error handling configuration from flow data
   * @param {Object} flowData - Flow data with parsed XML
   * @param {Object} errorHandling - Extracted error handling configuration
   * @returns {Object} Processed error handling configuration
   */
  processErrorHandling(flowData, errorHandling) {
    logger.info('Processing error handling for iFlow', { flowId: flowData.id });
    
    if (!errorHandling) {
      logger.warn('No error handling configuration found', { flowId: flowData.id });
      return this.getDefaultErrorHandling();
    }

    const processed = {
      detection_enabled: this.ensureBoolean(errorHandling.detection_enabled),
      logging_enabled: this.ensureBoolean(errorHandling.logging_enabled),
      classification_enabled: this.ensureBoolean(errorHandling.classification_enabled),
      reporting_enabled: this.ensureBoolean(errorHandling.reporting_enabled),
      error_handling_details: this.processErrorHandlingDetails(errorHandling.error_handling_details)
    };

    // Log processing details
    this.logProcessingDetails('Error Handling', processed, flowData.id);

    logger.info('Error handling processing completed', { 
      flowId: flowData.id,
      detectionEnabled: processed.detection_enabled,
      loggingEnabled: processed.logging_enabled,
      classificationEnabled: processed.classification_enabled,
      reportingEnabled: processed.reporting_enabled
    });

    return processed;
  }

  /**
   * Get default error handling configuration
   * @returns {Object} Default error handling configuration
   */
  getDefaultErrorHandling() {
    return {
      detection_enabled: false,
      logging_enabled: false,
      classification_enabled: false,
      reporting_enabled: false,
      error_handling_details: {}
    };
  }

  /**
   * Process error handling details
   * @param {Object} details - Raw error handling details
   * @returns {Object} Processed error handling details
   */
  processErrorHandlingDetails(details) {
    if (!details || typeof details !== 'object') {
      return {};
    }

    const processed = {};

    // Process collaboration level settings
    if (details.returnExceptionToSender !== undefined) {
      processed.returnExceptionToSender = Boolean(details.returnExceptionToSender);
    }

    if (details.logLevel) {
      processed.logLevel = this.sanitizeString(details.logLevel, 100);
    }

    if (details.serverTrace !== undefined) {
      processed.serverTrace = Boolean(details.serverTrace);
    }

    // Process process details
    if (details.processDetails) {
      processed.processDetails = this.processProcessDetails(details.processDetails);
    }

    // Process error subprocesses
    if (details.errorSubprocesses) {
      processed.errorSubprocesses = this.processErrorSubprocesses(details.errorSubprocesses);
    }

    // Process transaction handling
    if (details.transactionHandling) {
      processed.transactionHandling = this.processTransactionHandling(details.transactionHandling);
    }

    return processed;
  }

  /**
   * Process process-level error handling details
   * @param {Object} processDetails - Process error handling details
   * @returns {Object} Processed process details
   */
  processProcessDetails(processDetails) {
    const processed = {};

    Object.keys(processDetails).forEach(processId => {
      const process = processDetails[processId];
      
      processed[processId] = {
        processName: this.sanitizeString(process.processName, 255),
        hasErrorHandling: Boolean(process.hasErrorHandling),
        errorSubprocesses: process.errorSubprocesses || [],
        tryCatchPatterns: process.tryCatchPatterns || [],
        transactionHandling: process.transactionHandling || null
      };

      // Process error subprocesses for this process
      if (process.errorSubprocesses && Array.isArray(process.errorSubprocesses)) {
        processed[processId].errorSubprocesses = process.errorSubprocesses.map(subprocess => ({
          id: this.sanitizeString(subprocess.id, 100),
          name: this.sanitizeString(subprocess.name, 255),
          type: this.sanitizeString(subprocess.type, 100),
          classification: this.sanitizeString(subprocess.classification, 100),
          errorStartEvents: subprocess.errorStartEvents || []
        }));
      }

      // Process try-catch patterns for this process
      if (process.tryCatchPatterns && Array.isArray(process.tryCatchPatterns)) {
        processed[processId].tryCatchPatterns = process.tryCatchPatterns.map(pattern => ({
          id: this.sanitizeString(pattern.id, 100),
          name: this.sanitizeString(pattern.name, 255),
          type: this.sanitizeString(pattern.type, 100),
          errorHandlingProps: pattern.errorHandlingProps || []
        }));
      }
    });

    return processed;
  }

  /**
   * Process error subprocesses
   * @param {Array} errorSubprocesses - Error subprocess configurations
   * @returns {Array} Processed error subprocesses
   */
  processErrorSubprocesses(errorSubprocesses) {
    if (!Array.isArray(errorSubprocesses)) {
      return [];
    }

    return errorSubprocesses.map(subprocess => ({
      id: this.sanitizeString(subprocess.id, 100),
      name: this.sanitizeString(subprocess.name, 255),
      type: this.sanitizeString(subprocess.type, 100),
      classification: this.classifyErrorHandling(subprocess),
      errorStartEvents: this.processErrorStartEvents(subprocess.errorStartEvents),
      isActive: true
    }));
  }

  /**
   * Process error start events
   * @param {Array} errorStartEvents - Error start events
   * @returns {Array} Processed error start events
   */
  processErrorStartEvents(errorStartEvents) {
    if (!Array.isArray(errorStartEvents)) {
      return [];
    }

    return errorStartEvents.map(event => ({
      id: this.sanitizeString(event.id, 100),
      name: this.sanitizeString(event.name, 255),
      errorRef: this.sanitizeString(event.errorRef, 255)
    }));
  }

  /**
   * Process transaction handling
   * @param {Object} transactionHandling - Transaction handling configuration
   * @returns {Object} Processed transaction handling
   */
  processTransactionHandling(transactionHandling) {
    if (!transactionHandling || typeof transactionHandling !== 'object') {
      return {};
    }

    return {
      transactionTimeout: this.sanitizeString(transactionHandling.transactionTimeout, 50),
      transactionalHandling: this.sanitizeString(transactionHandling.transactionalHandling, 100),
      supportsRollback: Boolean(transactionHandling.supportsRollback),
      isolationLevel: this.sanitizeString(transactionHandling.isolationLevel, 50)
    };
  }

  /**
   * Classify error handling type
   * @param {Object} subprocess - Error subprocess
   * @returns {string} Classification
   */
  classifyErrorHandling(subprocess) {
    if (!subprocess) {
      return 'Unknown';
    }

    // Use existing classification if available
    if (subprocess.classification) {
      return this.sanitizeString(subprocess.classification, 100);
    }

    // Classify based on type
    const type = subprocess.type?.toLowerCase() || '';
    
    if (type.includes('response')) {
      return 'Response-based';
    }
    
    if (type.includes('escalation')) {
      return 'Escalation-based';
    }
    
    if (type.includes('error')) {
      return 'Standard';
    }
    
    return 'Basic';
  }

  /**
   * Validate error handling configuration
   * @param {Object} errorHandling - Error handling configuration
   * @returns {Object} Validation result
   */
  validateErrorHandling(errorHandling) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check boolean fields
    const booleanFields = ['detection_enabled', 'logging_enabled', 'classification_enabled', 'reporting_enabled'];
    booleanFields.forEach(field => {
      if (errorHandling[field] !== undefined && typeof errorHandling[field] !== 'boolean') {
        validation.warnings.push(`${field} should be boolean, got ${typeof errorHandling[field]}`);
      }
    });

    // Validate error handling details
    if (errorHandling.error_handling_details && typeof errorHandling.error_handling_details !== 'object') {
      validation.errors.push('error_handling_details must be an object');
      validation.isValid = false;
    }

    // Check for consistency
    if (errorHandling.detection_enabled && errorHandling.error_handling_details) {
      const details = errorHandling.error_handling_details;
      
      if (!details.processDetails && !details.errorSubprocesses) {
        validation.warnings.push('Detection enabled but no error handling mechanisms found');
      }
    }

    return validation;
  }

  /**
   * Extract error handling patterns from flow data
   * @param {Object} flowData - Flow data
   * @returns {Object} Error handling patterns summary
   */
  extractErrorHandlingPatterns(flowData) {
    const patterns = {
      hasErrorSubprocess: false,
      hasTryCatch: false,
      hasTransactionHandling: false,
      errorHandlingTypes: [],
      complexity: 'Low'
    };

    if (!flowData || !flowData.error_handling_details) {
      return patterns;
    }

    const details = flowData.error_handling_details;

    // Check for error subprocesses
    if (details.processDetails) {
      Object.values(details.processDetails).forEach(process => {
        if (process.errorSubprocesses && process.errorSubprocesses.length > 0) {
          patterns.hasErrorSubprocess = true;
          patterns.errorHandlingTypes.push('Error Subprocess');
        }
        
        if (process.tryCatchPatterns && process.tryCatchPatterns.length > 0) {
          patterns.hasTryCatch = true;
          patterns.errorHandlingTypes.push('Try-Catch');
        }
        
        if (process.transactionHandling) {
          patterns.hasTransactionHandling = true;
          patterns.errorHandlingTypes.push('Transaction Handling');
        }
      });
    }

    // Determine complexity
    const typeCount = patterns.errorHandlingTypes.length;
    
    if (typeCount === 0) {
      patterns.complexity = 'None';
    } else if (typeCount === 1) {
      patterns.complexity = 'Low';
    } else if (typeCount === 2) {
      patterns.complexity = 'Medium';
    } else {
      patterns.complexity = 'High';
    }

    return patterns;
  }

  /**
   * Generate error handling recommendations
   * @param {Object} errorHandling - Error handling configuration
   * @returns {Array} Array of recommendations
   */
  generateErrorHandlingRecommendations(errorHandling) {
    const recommendations = [];

    if (!errorHandling.detection_enabled) {
      recommendations.push({
        type: 'improvement',
        message: 'Consider enabling error detection for better error monitoring',
        priority: 'medium'
      });
    }

    if (!errorHandling.logging_enabled) {
      recommendations.push({
        type: 'improvement',
        message: 'Enable error logging for better troubleshooting capabilities',
        priority: 'high'
      });
    }

    if (errorHandling.detection_enabled && !errorHandling.classification_enabled) {
      recommendations.push({
        type: 'improvement',
        message: 'Enable error classification to categorize different error types',
        priority: 'medium'
      });
    }

    if (!errorHandling.reporting_enabled) {
      recommendations.push({
        type: 'improvement',
        message: 'Consider enabling error reporting for better visibility',
        priority: 'low'
      });
    }

    // Check details for specific recommendations
    if (errorHandling.error_handling_details) {
      const details = errorHandling.error_handling_details;
      
      if (details.returnExceptionToSender === true) {
        recommendations.push({
          type: 'security',
          message: 'Returning exceptions to sender may expose sensitive information',
          priority: 'high'
        });
      }
      
      if (details.serverTrace === true) {
        recommendations.push({
          type: 'security',
          message: 'Server trace is enabled which may expose sensitive data in traces',
          priority: 'medium'
        });
      }
    }

    return recommendations;
  }
}

module.exports = ErrorHandlingProcessor;