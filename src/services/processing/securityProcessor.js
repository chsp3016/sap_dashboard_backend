// services/processing/securityProcessor.js (continued)
const BaseProcessor = require('./baseProcessor');
const logger = require('../../utils/logger');

/**
 * Security mechanisms processing logic
 */
class SecurityProcessor extends BaseProcessor {
  /**
   * Process security mechanisms from flow data
   * @param {Object} flowData - Flow data with parsed XML
   * @param {Array} securityMechanisms - Array of extracted security mechanisms
   * @returns {Array} Array of processed security mechanisms
   */
  processSecurityMechanisms(flowData, securityMechanisms) {
    logger.info('Processing security mechanisms for iFlow', { flowId: flowData.id });
    
    const processedSecurity = [];
    
    if (!securityMechanisms || !Array.isArray(securityMechanisms)) {
      logger.warn('No security mechanisms found in flow data', { flowId: flowData.id });
      return this.processLegacySecurityMechanisms(flowData);
    }

    logger.debug('Available security mechanisms', { 
      flowId: flowData.id, 
      securityMechanismCount: securityMechanisms.length,
      mechanismTypes: securityMechanisms.map(s => s.mechanism_type)
    });

    securityMechanisms.forEach(mechanism => {
      // Validate required fields
      if (!this.validateRequiredFields(mechanism, ['mechanism_name', 'mechanism_type'], 'security processing')) {
        logger.warn('Skipping security mechanism with missing required fields', { 
          flowId: flowData.id, 
          mechanism 
        });
        return;
      }
      
      const processedMechanism = this.processIndividualSecurityMechanism(mechanism, flowData.id);
      if (processedMechanism) {
        processedSecurity.push(processedMechanism);
      }
    });

    if (processedSecurity.length === 0) {
      logger.warn('No security mechanisms detected for iFlow', { flowId: flowData.id });
    } else {
      logger.info('Security mechanisms processing completed', { 
        flowId: flowData.id, 
        processedCount: processedSecurity.length,
        mechanisms: processedSecurity.map(s => ({
          name: s.mechanism_name,
          type: s.mechanism_type,
          direction: s.direction
        }))
      });
    }

    return processedSecurity;
  }

  /**
   * Process individual security mechanism
   * @param {Object} mechanism - Security mechanism data
   * @param {string} flowId - Flow ID for logging
   * @returns {Object|null} Processed security mechanism or null
   */
  processIndividualSecurityMechanism(mechanism, flowId) {
    try {
      // Sanitize and validate security mechanism fields
      const processed = {
        mechanism_name: this.sanitizeString(mechanism.mechanism_name, 255),
        mechanism_type: this.normalizeSecurityType(mechanism.mechanism_type),
        direction: this.determineSecurityDirection(mechanism),
        configuration: this.processSecurityConfiguration(mechanism.configuration)
      };

      // Log processing details
      this.logProcessingDetails('Security Mechanism', processed, flowId);

      logger.debug('Security mechanism processed', { 
        flowId, 
        mechanismName: processed.mechanism_name, 
        mechanismType: processed.mechanism_type, 
        direction: processed.direction
      });

      return processed;
    } catch (error) {
      logger.error('Error processing individual security mechanism', {
        flowId,
        mechanism,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Normalize security mechanism type
   * @param {string} mechanismType - Raw mechanism type
   * @returns {string} Normalized mechanism type
   */
  normalizeSecurityType(mechanismType) {
    if (!mechanismType) {
      return 'Unknown';
    }

    // Sanitize the type
    const sanitized = this.sanitizeString(mechanismType, 100);
    
    // Normalize common security types
    const typeMapping = {
      'ClientCertificate': 'Client Certificate',
      'Client Certificate': 'Client Certificate',
      'BasicAuthentication': 'Basic Authentication',
      'Basic Authentication': 'Basic Authentication',
      'OAuth': 'OAuth',
      'OAuth2': 'OAuth',
      'SAML': 'SAML',
      'JWT': 'JWT',
      'None': 'None',
      'CSRF Protection': 'CSRF Protection',
      'XSRF Protection': 'XSRF Protection',
      'CORS': 'CORS',
      'Role-Based Authorization': 'Role-Based Authorization',
      'Exception Handling': 'Exception Handling',
      'Security Logging': 'Security Logging',
      'Debug Security': 'Debug Security'
    };

    // Find exact match first
    if (typeMapping[sanitized]) {
      return typeMapping[sanitized];
    }

    // Find partial match
    for (const [key, value] of Object.entries(typeMapping)) {
      if (sanitized.toLowerCase().includes(key.toLowerCase()) || 
          key.toLowerCase().includes(sanitized.toLowerCase())) {
        return value;
      }
    }

    return sanitized;
  }

  /**
   * Determine security direction
   * @param {Object} mechanism - Security mechanism data
   * @returns {string} Direction (Inbound/Outbound)
   */
  determineSecurityDirection(mechanism) {
    // First, check the direction field
    if (mechanism.direction) {
      const direction = this.sanitizeString(mechanism.direction, 50);
      if (direction === 'Inbound' || direction === 'Outbound') {
        return direction;
      }
    }
    
    // Determine from mechanism type
    const mechanismType = mechanism.mechanism_type?.toLowerCase() || '';
    
    // Inbound security (receiving requests)
    if (mechanismType.includes('sender') || 
        mechanismType.includes('authorization') || 
        mechanismType.includes('cors') || 
        mechanismType.includes('exception handling') ||
        mechanismType.includes('logging')) {
      return 'Inbound';
    }
    
    // Outbound security (making outbound calls)
    if (mechanismType.includes('receiver') || 
        mechanismType.includes('csrf') ||
        (mechanismType.includes('client certificate') && 
         mechanism.configuration?.privateKeyAlias)) {
      return 'Outbound';
    }
    
    // Default based on mechanism type
    if (mechanismType.includes('client certificate')) {
      // Check configuration for more context
      if (mechanism.configuration?.senderAuthType) {
        return 'Inbound';
      }
      if (mechanism.configuration?.authenticationMethod || 
          mechanism.configuration?.privateKeyAlias) {
        return 'Outbound';
      }
    }
    
    return 'Inbound'; // Default to Inbound
  }

  /**
   * Process security configuration
   * @param {Object} configuration - Raw security configuration
   * @returns {Object} Processed configuration
   */
  processSecurityConfiguration(configuration) {
    if (!configuration) {
      return {};
    }

    // Validate JSON structure
    const processed = this.validateJson(configuration, 'security configuration');
    
    // Clean up configuration values
    const cleanedConfig = {};
    Object.keys(processed).forEach(key => {
      const value = processed[key];
      
      // Handle boolean values
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') {
          cleanedConfig[key] = true;
        } else if (value.toLowerCase() === 'false') {
          cleanedConfig[key] = false;
        } else {
          cleanedConfig[key] = value;
        }
      } else {
        cleanedConfig[key] = value;
      }
    });
    
    return cleanedConfig;
  }

  /**
   * Process legacy security mechanisms (fallback)
   * @param {Object} flowData - Flow data
   * @returns {Array} Array of legacy security mechanisms
   */
  processLegacySecurityMechanisms(flowData) {
    const legacySecurity = [];
    
    // Check if flow has Resources property (legacy structure)
    if (flowData.Resources && flowData.Resources.results) {
      const securityResources = flowData.Resources.results.filter(
        resource => resource.Name && (
          resource.Name.includes('Authentication') || 
          resource.Name.includes('Authorization') ||
          resource.Name.includes('Security') ||
          resource.Name.includes('Encryption')
        )
      );
      
      securityResources.forEach(resource => {
        const mechanism = this.processLegacySecurityResource(resource);
        if (mechanism) {
          legacySecurity.push(mechanism);
        }
      });
      
      logger.info('Processed legacy security mechanisms', {
        flowId: flowData.id,
        count: legacySecurity.length
      });
    }
    
    return legacySecurity;
  }

  /**
   * Process legacy security resource
   * @param {Object} resource - Legacy security resource
   * @returns {Object|null} Processed security mechanism
   */
  processLegacySecurityResource(resource) {
    try {
      // Determine direction (Inbound or Outbound)
      let direction = 'Inbound';
      if (resource.Name.includes('Outbound')) {
        direction = 'Outbound';
      }
      
      // Extract mechanism name and type
      let mechanismName = this.sanitizeString(resource.Name, 255);
      let mechanismType = 'Unknown';
      
      if (resource.Name.includes('BasicAuthentication')) {
        mechanismType = 'Basic Authentication';
      } else if (resource.Name.includes('OAuth')) {
        mechanismType = 'OAuth';
      } else if (resource.Name.includes('Certificate')) {
        mechanismType = 'Client Certificate';
      } else if (resource.Name.includes('SAML')) {
        mechanismType = 'SAML';
      } else if (resource.Name.includes('JWT')) {
        mechanismType = 'JWT';
      } else if (resource.Name.includes('Encryption')) {
        mechanismType = 'Encryption';
      }
      
      // Configuration details (if available)
      const configuration = resource.Content ? { content: resource.Content } : {};
      
      return {
        mechanism_name: mechanismName,
        mechanism_type: mechanismType,
        direction: direction,
        configuration: configuration
      };
    } catch (error) {
      logger.error('Error processing legacy security resource', {
        resource,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Validate security mechanism data
   * @param {Object} mechanism - Security mechanism data
   * @returns {Object} Validation result
   */
  validateSecurityMechanism(mechanism) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // Check required fields
    if (!mechanism.mechanism_name) {
      validation.isValid = false;
      validation.errors.push('Missing mechanism_name');
    }
    
    if (!mechanism.mechanism_type) {
      validation.isValid = false;
      validation.errors.push('Missing mechanism_type');
    }
    
    // Check field lengths
    if (mechanism.mechanism_name && mechanism.mechanism_name.length > 255) {
      validation.warnings.push('mechanism_name exceeds 255 characters');
    }
    
    if (mechanism.mechanism_type && mechanism.mechanism_type.length > 100) {
      validation.warnings.push('mechanism_type exceeds 100 characters');
    }
    
    // Validate direction
    const validDirections = ['Inbound', 'Outbound'];
    if (mechanism.direction && !validDirections.includes(mechanism.direction)) {
      validation.warnings.push(`Invalid direction: ${mechanism.direction}`);
    }
    
    // Validate configuration if present
    if (mechanism.configuration && typeof mechanism.configuration !== 'object') {
      validation.warnings.push('Invalid configuration format');
    }
    
    return validation;
  }

  /**
   * Deduplicate security mechanisms by name and direction
   * @param {Array} securityMechanisms - Array of security mechanisms
   * @returns {Array} Deduplicated array
   */
  deduplicateSecurityMechanisms(securityMechanisms) {
    const seen = new Map();
    const deduplicated = [];
    
    securityMechanisms.forEach(mechanism => {
      const key = `${mechanism.mechanism_name}_${mechanism.direction}`;
      
      if (!seen.has(key)) {
        seen.set(key, true);
        deduplicated.push(mechanism);
      } else {
        logger.debug('Skipping duplicate security mechanism', {
          mechanismName: mechanism.mechanism_name,
          direction: mechanism.direction
        });
      }
    });
    
    return deduplicated;
  }

  /**
   * Classify security mechanisms by type
   * @param {Array} securityMechanisms - Array of security mechanisms
   * @returns {Object} Classification of security mechanisms
   */
  classifySecurityMechanisms(securityMechanisms) {
    const classification = {
      authentication: [],
      authorization: [],
      encryption: [],
      logging: [],
      protection: [],
      other: []
    };
    
    securityMechanisms.forEach(mechanism => {
      const type = mechanism.mechanism_type.toLowerCase();
      
      if (type.includes('authentication') || type.includes('certificate') || 
          type.includes('oauth') || type.includes('saml') || type.includes('jwt')) {
        classification.authentication.push(mechanism);
      } else if (type.includes('authorization') || type.includes('role')) {
        classification.authorization.push(mechanism);
      } else if (type.includes('encryption') || type.includes('ssl') || type.includes('tls')) {
        classification.encryption.push(mechanism);
      } else if (type.includes('logging') || type.includes('audit')) {
        classification.logging.push(mechanism);
      } else if (type.includes('csrf') || type.includes('xsrf') || type.includes('cors')) {
        classification.protection.push(mechanism);
      } else {
        classification.other.push(mechanism);
      }
    });
    
    return classification;
  }
}

module.exports = SecurityProcessor;