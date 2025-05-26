// services/xmlExtraction/securityExtractor.js
const BaseXmlExtractor = require('./baseExtractor');
const logger = require('../../utils/logger');

/**
 * Security mechanisms extraction from iFlow XML
 */
class SecurityExtractor extends BaseXmlExtractor {
  /**
   * Extract security mechanisms from parsed iFlow XML
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID for logging
   * @returns {Array} Array of security mechanisms
   */
  extractSecurity(parsedXml, flowId) {
    try {
      if (!parsedXml || !parsedXml['bpmn2:definitions']) {
        logger.warn('Invalid or missing parsed XML for security extraction', { flowId });
        return [];
      }

      const securityMechanisms = [];
      
      // Extract security from message flows
      const messageFlowSecurity = this.extractMessageFlowSecurity(parsedXml, flowId);
      securityMechanisms.push(...messageFlowSecurity);

      // Extract collaboration level security
      const collaborationSecurity = this.extractCollaborationSecurity(parsedXml, flowId);
      securityMechanisms.push(...collaborationSecurity);

      // Log summary
      logger.info('Security extraction completed', { 
        flowId, 
        securityMechanismsCount: securityMechanisms.length,
        securityTypes: [...new Set(securityMechanisms.map(s => s.mechanism_type))],
        inboundCount: securityMechanisms.filter(s => s.direction === 'Inbound').length,
        outboundCount: securityMechanisms.filter(s => s.direction === 'Outbound').length
      });

      return securityMechanisms;
    } catch (error) {
      logger.error('Error extracting security mechanisms from XML', { 
        flowId, 
        error: error.message, 
        stack: error.stack 
      });
      return [];
    }
  }

  /**
   * Extract security from message flows
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID for logging
   * @returns {Array} Array of security mechanisms
   */
  extractMessageFlowSecurity(parsedXml, flowId) {
    const securityMechanisms = [];
    const messageFlows = this.getMessageFlows(parsedXml);

    // Process each message flow for security information
    messageFlows.forEach((flow, index) => {
      logger.debug('Processing message flow for security', { 
        flowId, 
        messageFlowIndex: index, 
        messageFlowId: flow.id || flow.name || `MessageFlow_${index}` 
      });

      // Extract extensionElements
      const extensionElements = flow['bpmn2:extensionElements'];
      if (!extensionElements) {
        return;
      }

      // Extract properties
      let properties = extensionElements['ifl:property'] || [];
      if (!Array.isArray(properties)) {
        properties = properties ? [properties] : [];
      }

      // Determine if this is a sender or receiver adapter
      const direction = this.getPropertyValue(properties, 'direction') || 'Unknown';
      const adapterName = this.getPropertyValue(properties, 'Name') || flow.id || `Adapter_${index}`;
      const componentType = this.getPropertyValue(properties, 'ComponentType') || 'Unknown';
      
      // Get authentication method based on direction
      let authMethod = '';
      if (direction === 'Sender') {
        // For sender adapters, use senderAuthType
        authMethod = this.getPropertyValue(properties, 'senderAuthType');
        logger.debug('Found sender authentication method', { 
          flowId, 
          adapterName, 
          authMethod 
        });
      } else if (direction === 'Receiver') {
        // For receiver adapters, use authenticationMethod
        authMethod = this.getPropertyValue(properties, 'authenticationMethod');
        logger.debug('Found receiver authentication method', { 
          flowId, 
          adapterName, 
          authMethod 
        });
      }

      // Process authentication mechanisms
      const authMechanisms = this.processAuthenticationMechanism(
        authMethod, adapterName, direction, componentType, properties, flowId
      );
      securityMechanisms.push(...authMechanisms);

      // Process additional security features
      const additionalSecurity = this.processAdditionalSecurity(
        properties, adapterName, direction, componentType, flowId
      );
      securityMechanisms.push(...additionalSecurity);
    });

    return securityMechanisms;
  }

  /**
   * Process authentication mechanism
   * @param {string} authMethod - Authentication method
   * @param {string} adapterName - Adapter name
   * @param {string} direction - Direction (Sender/Receiver)
   * @param {string} componentType - Component type
   * @param {Array} properties - Properties array
   * @param {string} flowId - Flow ID
   * @returns {Array} Array of authentication security mechanisms
   */
  processAuthenticationMechanism(authMethod, adapterName, direction, componentType, properties, flowId) {
    const securityMechanisms = [];

    if (authMethod && authMethod !== 'None') {
      let mechanismType = authMethod;
      let mechanismName = `${adapterName}_${authMethod}`;

      // Normalize mechanism type for common authentication methods
      if (authMethod.includes('ClientCertificate') || authMethod.includes('Client Certificate')) {
        mechanismType = 'Client Certificate';
      } else if (authMethod.includes('Basic')) {
        mechanismType = 'Basic Authentication';
      } else if (authMethod.includes('OAuth')) {
        mechanismType = 'OAuth';
      } else if (authMethod.includes('SAML')) {
        mechanismType = 'SAML';
      } else if (authMethod.includes('JWT')) {
        mechanismType = 'JWT';
      }

      // Collect additional security configuration
      const securityConfig = this.collectSecurityConfiguration(properties);
      securityConfig.componentType = componentType;

      // Determine security direction (Inbound for Sender, Outbound for Receiver)
      const securityDirection = direction === 'Sender' ? 'Inbound' : 'Outbound';

      securityMechanisms.push({
        mechanism_name: mechanismName,
        mechanism_type: mechanismType,
        direction: securityDirection,
        configuration: securityConfig
      });

      logger.debug('Extracted security mechanism', {
        flowId,
        mechanismName,
        mechanismType,
        direction: securityDirection,
        componentType,
        authMethod
      });
    }

    return securityMechanisms;
  }

  /**
   * Process additional security features
   * @param {Array} properties - Properties array
   * @param {string} adapterName - Adapter name
   * @param {string} direction - Direction
   * @param {string} componentType - Component type
   * @param {string} flowId - Flow ID
   * @returns {Array} Array of additional security mechanisms
   */
  processAdditionalSecurity(properties, adapterName, direction, componentType, flowId) {
    const securityMechanisms = [];

    // Check for CSRF protection
    const isCSRFEnabled = this.getPropertyValue(properties, 'isCSRFEnabled');
    if (isCSRFEnabled === 'true') {
      securityMechanisms.push({
        mechanism_name: `${adapterName}_CSRF`,
        mechanism_type: 'CSRF Protection',
        direction: 'Outbound',
        configuration: { 
          csrfEnabled: true,
          componentType: componentType
        }
      });

      logger.debug('Extracted CSRF protection', {
        flowId,
        adapterName,
        componentType
      });
    }

    // Check for private key/certificate configurations
    const privateKeyAlias = this.getPropertyValue(properties, 'privateKeyAlias') || 
                           this.getPropertyValue(properties, 'odataCertAuthPrivateKeyAlias');
    if (privateKeyAlias && direction === 'Receiver') {
      securityMechanisms.push({
        mechanism_name: `${adapterName}_ClientCert`,
        mechanism_type: 'Client Certificate',
        direction: 'Outbound',
        configuration: { 
          privateKeyAlias: privateKeyAlias,
          certificateAuthentication: true,
          componentType: componentType
        }
      });

      logger.debug('Extracted client certificate configuration', {
        flowId,
        adapterName,
        privateKeyAlias,
        componentType
      });
    }

    // Check for XSRF protection
    const xsrfProtection = this.getPropertyValue(properties, 'xsrfProtection');
    if (xsrfProtection === '0' && direction === 'Sender') {
      securityMechanisms.push({
        mechanism_name: `${adapterName}_XSRF_Disabled`,
        mechanism_type: 'XSRF Protection',
        direction: 'Inbound',
        configuration: { 
          xsrfProtection: false,
          componentType: componentType
        }
      });
    }

    // Extract user role information for authorization
    const userRole = this.getPropertyValue(properties, 'userRole');
    if (userRole && direction === 'Sender') {
      securityMechanisms.push({
        mechanism_name: `${adapterName}_Authorization`,
        mechanism_type: 'Role-Based Authorization',
        direction: 'Inbound',
        configuration: { 
          userRole: userRole,
          componentType: componentType
        }
      });

      logger.debug('Extracted authorization configuration', {
        flowId,
        adapterName,
        userRole,
        componentType
      });
    }

    return securityMechanisms;
  }

  /**
   * Extract collaboration level security
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID
   * @returns {Array} Array of collaboration security mechanisms
   */
  extractCollaborationSecurity(parsedXml, flowId) {
    const securityMechanisms = [];
    const collaborationProps = this.getCollaborationProperties(parsedXml);
    
    collaborationProps.forEach(prop => {
      if (prop && prop.key && prop.key._) {
        const key = prop.key._;
        const value = prop.value ? prop.value._ : '';
        
        // Check for CORS settings
        if (key === 'corsEnabled' && value === 'true') {
          securityMechanisms.push({
            mechanism_name: `${flowId}_CORS`,
            mechanism_type: 'CORS',
            direction: 'Inbound',
            configuration: { corsEnabled: true }
          });
        }
        
        // Check for exception handling
        if (key === 'returnExceptionToSender') {
          securityMechanisms.push({
            mechanism_name: `${flowId}_ExceptionHandling`,
            mechanism_type: 'Exception Handling',
            direction: 'Inbound',
            configuration: { 
              returnExceptionToSender: value === 'true',
              securityImplication: value === 'false' ? 'Prevents information disclosure' : 'May expose internal errors'
            }
          });
        }

        // Extract logging as security feature
        if (key === 'log') {
          securityMechanisms.push({
            mechanism_name: `${flowId}_SecurityLogging`,
            mechanism_type: 'Security Logging',
            direction: 'Inbound',
            configuration: { 
              logLevel: value,
              auditTrail: true
            }
          });
        }

        // Extract server trace settings
        if (key === 'ServerTrace') {
          securityMechanisms.push({
            mechanism_name: `${flowId}_ServerTrace`,
            mechanism_type: 'Debug Security',
            direction: 'Inbound',
            configuration: { 
              serverTrace: value === 'true',
              securityRisk: value === 'true' ? 'May expose sensitive data in traces' : 'Safe for production'
            }
          });
        }
      }
    });

    return securityMechanisms;
  }

  /**
   * Collect security-related configuration from properties
   * @param {Array} properties - Properties array
   * @returns {Object} Security configuration object
   */
  collectSecurityConfiguration(properties) {
    const securityConfig = {};
    
    properties.forEach(prop => {
      if (prop.key && prop.key._) {
        const key = prop.key._;
        const value = prop.value ? prop.value._ : '';
        
        // Include security-related properties
        if (key.toLowerCase().includes('auth') || 
            key.toLowerCase().includes('certificate') ||
            key.toLowerCase().includes('credential') ||
            key.toLowerCase().includes('security') ||
            key.toLowerCase().includes('ssl') ||
            key.toLowerCase().includes('tls') ||
            key.toLowerCase().includes('userRole') ||
            key.toLowerCase().includes('clientCertificates') ||
            key.toLowerCase().includes('xsrf') ||
            key.toLowerCase().includes('maximumBodySize')) {
          securityConfig[key] = value;
        }
      }
    });

    return securityConfig;
  }
}

module.exports = SecurityExtractor;