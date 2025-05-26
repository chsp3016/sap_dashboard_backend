// services/processing/baseProcessor.js
const logger = require('../../utils/logger');

/**
 * Base processor with common functionality
 */
class BaseProcessor {
  /**
   * Validate required fields in data
   * @param {Object} data - Data to validate
   * @param {Array} requiredFields - Array of required field names
   * @param {string} context - Context for logging
   * @returns {boolean} True if valid, false otherwise
   */
  validateRequiredFields(data, requiredFields, context) {
    for (const field of requiredFields) {
      if (!data[field]) {
        logger.warn(`Missing required field ${field}`, { context, data });
        return false;
      }
    }
    return true;
  }

  /**
   * Sanitize string fields to prevent database issues
   * @param {string} value - Value to sanitize
   * @param {number} maxLength - Maximum length
   * @returns {string} Sanitized value
   */
  sanitizeString(value, maxLength = null) {
    if (!value || typeof value !== 'string') {
      return '';
    }
    
    let sanitized = value.trim();
    
    if (maxLength && sanitized.length > maxLength) {
      logger.warn(`Truncating string from ${sanitized.length} to ${maxLength} characters`, {
        originalValue: sanitized
      });
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
  }

  /**
   * Ensure boolean values are properly typed
   * @param {*} value - Value to convert to boolean
   * @returns {boolean|null} Boolean value or null if undefined
   */
  ensureBoolean(value) {
    if (value === null || value === undefined) {
      return null;
    }
    return Boolean(value);
  }

  /**
   * Validate and sanitize JSON data
   * @param {*} data - Data to validate as JSON
   * @param {string} context - Context for logging
   * @returns {Object} Valid JSON object or empty object
   */
  validateJson(data, context) {
    if (!data) {
      return {};
    }
    
    if (typeof data === 'object') {
      return data;
    }
    
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        logger.warn('Invalid JSON string, returning empty object', {
          context,
          error: error.message,
          data
        });
        return {};
      }
    }
    
    logger.warn('Invalid JSON data type, returning empty object', {
      context,
      type: typeof data,
      data
    });
    return {};
  }

  /**
   * Extract property value from resources array (legacy support)
   * @param {Array} resources - Array of resources
   * @param {string} searchKey - Key to search for
   * @returns {string} Property value or empty string
   */
  extractFromResources(resources, searchKey) {
    if (!resources || !Array.isArray(resources)) {
      return '';
    }
    
    const resource = resources.find(r => 
      r.Name && r.Name.includes(searchKey)
    );
    
    return resource ? (resource.Content || '') : '';
  }

  /**
   * Log processing details for debugging
   * @param {string} operation - Operation being performed
   * @param {Object} data - Data being processed
   * @param {string} context - Context information
   */
  logProcessingDetails(operation, data, context) {
    logger.debug(`${operation} processing details:`, {
      operation,
      context,
      dataKeys: Object.keys(data),
      fieldLengths: Object.keys(data).map(key => ({
        key,
        type: typeof data[key],
        length: typeof data[key] === 'string' ? data[key].length : null
      }))
    });
  }

  /**
   * Merge configuration objects safely
   * @param {Object} target - Target configuration
   * @param {Object} source - Source configuration
   * @returns {Object} Merged configuration
   */
  mergeConfigurations(target, source) {
    const merged = { ...target };
    
    Object.keys(source).forEach(key => {
      if (Array.isArray(source[key])) {
        // Merge arrays
        merged[key] = merged[key] || [];
        if (Array.isArray(merged[key])) {
          merged[key].push(...source[key]);
        } else {
          merged[key] = source[key];
        }
      } else if (typeof source[key] === 'object' && source[key] !== null) {
        // Merge objects
        merged[key] = this.mergeConfigurations(merged[key] || {}, source[key]);
      } else {
        // Override primitives
        merged[key] = source[key];
      }
    });
    
    return merged;
  }
}

module.exports = BaseProcessor;