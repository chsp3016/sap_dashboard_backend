const axios = require('axios');
const logger = require('../utils/logger');
const authService = require('./authService');
const xml2js = require('xml2js');
const AdmZip = require('adm-zip');
const fs = require('fs');
require('dotenv').config();

// Base URL for SAP Integration Suite API
const baseUrl = process.env.SAP_API_BASE_URL;

/**
 * Parse XML string to JSON
 * @param {string} xml - XML content
 * @returns {Promise<Object>} Parsed JSON
 */
const parseXml = async (xml) => {
  const parser = new xml2js.Parser({ 
    explicitArray: false, // Simplify arrays for single elements
    mergeAttrs: true, 
    normalizeTags: false, // Preserve original tag case
    ignoreAttrs: false,
    xmlns: true // Handle namespaces explicitly
  });
  try {
    const result = await parser.parseStringPromise(xml);
    logger.debug('XML parsed successfully', { topLevelKeys: Object.keys(result) });
    return result;
  } catch (error) {
    logger.error('XML parsing error', { error: error.message, stack: error.stack });
    throw error;
  }
};

/**
 * Generic function to make authenticated GET requests to SAP API
 * @param {string} endpoint - API endpoint path
 * @param {Object} params - Query parameters
 * @param {boolean} isBinary - Whether to fetch as binary data
 * @returns {Promise<Object|Buffer>} API response data
 */
const fetchFromApi = async (endpoint, params = {}, isBinary = false) => {
  try {
    const url = `${baseUrl}${endpoint}`;
    const headers = await authService.getAuthHeaders(isBinary);
    headers['Accept-Encoding'] = 'gzip, deflate, br';
    headers['Connection'] = 'keep-alive';
    logger.debug(`Fetching data from: ${url}`, { params, isBinary });
    
    const response = await axios({
      method: 'get',
      url,
      headers,
      params,
      responseType: isBinary ? 'arraybuffer' : 'json'
    }).catch(error => {
      logger.error(`Error fetching from API endpoint ${endpoint}`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
        request: { url, headers, params }
      });
      throw error;
    });

    if (isBinary) {
      logger.debug('Received binary data', { endpoint, size: response.data.length });
      return Buffer.from(response.data);
    }

    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('xml')) {
      return response.data; // Axios handles XML as text
    }

    return response.data;
  } catch (error) {
    logger.error(`Error fetching from API endpoint ${endpoint}`, { 
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Handle token expiration by clearing cache and retrying once
    if (error.response && error.response.status === 401) {
      logger.info('Token expired, clearing cache and retrying');
      authService.clearTokenCache();
      
      try {
        const headers = await authService.getAuthHeaders(isBinary);
        const response = await axios({
          method: 'get',
          url: `${baseUrl}${endpoint}`,
          headers,
          params,
          responseType: isBinary ? 'arraybuffer' : 'json'
        });

        if (isBinary) {
          logger.debug('Received binary data on retry', { endpoint, size: response.data.length });
          return Buffer.from(response.data);
        }

        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('xml')) {
          return response.data;
        }

        return response.data;
      } catch (retryError) {
        logger.error(`Retry failed for API endpoint ${endpoint}`, { 
          error: retryError.message,
          status: retryError.response?.status,
          data: retryError.response?.data
        });
        throw retryError;
      }
    }
    
    throw error;
  }
};



/**
 * Extract and parse XML from a ZIP file containing an iFlow
 * @param {Buffer} zipBuffer - ZIP file buffer
 * @param {string} flowId - Flow ID for logging and debugging
 * @returns {Promise<Object|null>} Parsed XML object or null on failure
 */
const extractXmlFromZip = async (zipBuffer, flowId) => {
  try {
    logger.debug('Starting ZIP processing', { flowId, bufferSize: zipBuffer.length });

    // Use environment variable for housekeeping directory
    const housekeepingDir = process.env.HOUSEKEEPING_DIR || '/Siva/AI/playground/HouseKeeping';
    const zipPath = `${housekeepingDir}/${flowId}.zip`;
    fs.writeFileSync(zipPath, zipBuffer);
    logger.debug('Saved ZIP file', { flowId, path: zipPath });

    // Extract ZIP contents
    let zip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (zipError) {
      logger.error('Failed to initialize AdmZip', { flowId, error: zipError.message });
      return null;
    }

    const zipEntries = zip.getEntries();
    logger.debug('ZIP contents', { 
      flowId, 
      files: zipEntries.map(e => e.entryName),
      fileCount: zipEntries.length 
    });
    
    // Find .iflw file
    const iflwEntry = zipEntries.find(entry => entry.entryName.endsWith('.iflw'));
    if (!iflwEntry) {
      logger.warn('No .iflw file found in ZIP', { flowId });
      return null;
    }
    
    logger.debug('Found .iflw file', { flowId, iflwFile: iflwEntry.entryName });
    let xmlContent;
    try {
      xmlContent = zip.readAsText(iflwEntry);
    } catch (readError) {
      logger.error('Failed to read .iflw file', { flowId, iflwFile: iflwEntry.entryName, error: readError.message });
      return null;
    }
    
    // Save XML for debugging
    const xmlPath = `${housekeepingDir}/${flowId}.iflw`;
    fs.writeFileSync(xmlPath, xmlContent);
    logger.debug('Saved iFlow XML', { flowId, path: xmlPath, xmlSize: xmlContent.length });
    
    // Parse XML
    let parsedXml;
    try {
      parsedXml = await parseXml(xmlContent);
    } catch (parseError) {
      logger.error('Failed to parse XML', { flowId, error: parseError.message });
      return null;
    }
    
    // Log parsed XML structure
    const definitions = parsedXml['bpmn2:definitions'];
    const collaboration = definitions?.['bpmn2:collaboration'];
    logger.debug('Parsed XML structure', { 
      flowId, 
      definitionsExists: !!definitions,
      collaborationExists: !!collaboration
    });

    return parsedXml;
  } catch (error) {
    logger.error('Error extracting XML from ZIP', { 
      flowId, 
      error: error.message, 
      stack: error.stack 
    });
    return null;
  }
};
/**
 * Extract adapter information from parsed iFlow XML
 * @param {Object} parsedXml - Parsed XML object
 * @param {string} flowId - Flow ID for logging
 * @returns {Array} Array of adapter resources
 */
const extractAdaptersFromXml = (parsedXml, flowId) => {
  try {
    if (!parsedXml || !parsedXml['bpmn2:definitions']) {
      logger.warn('Invalid or missing parsed XML', { flowId });
      return [];
    }

    const collaboration = parsedXml['bpmn2:definitions']['bpmn2:collaboration'];
    if (!collaboration) {
      logger.warn('No collaboration found in XML', { flowId });
      return [];
    }

    // Extract message flows
    let messageFlows = collaboration['bpmn2:messageFlow'] || [];
    if (!Array.isArray(messageFlows)) {
      messageFlows = messageFlows ? [messageFlows] : [];
    }
    
    logger.debug('Extracted message flows', { 
      flowId, 
      messageFlowCount: messageFlows.length,
      messageFlowIds: messageFlows.map(f => f.id || f.name || 'Unnamed')
    });

    if (messageFlows.length === 0) {
      logger.warn('No message flows found in XML', { flowId });
      return [];
    }

    // Process each message flow to extract adapter information
    return messageFlows
      .map((flow, index) => {
        logger.debug('Processing message flow', { flowId, messageFlowIndex: index, messageFlowId: flow.id || flow.name || `MessageFlow_${index}` });

        // Extract extensionElements
        const extensionElements = flow['bpmn2:extensionElements'];
        if (!extensionElements) {
          logger.debug('No extensionElements found in message flow', { flowId, messageFlowId: flow.id || flow.name });
          return null;
        }

        // Extract properties
        let properties = extensionElements['ifl:property'] || [];
        if (!Array.isArray(properties)) {
          properties = properties ? [properties] : [];
        }

        // Function to extract property value by key - handles the specific structure with namespace-aware parser
        const getPropertyValue = (propertyArray, targetKey) => {
          const property = propertyArray.find(prop => {
            // Handle the namespace-aware structure where key and value are objects
            if (prop.key && prop.key._ === targetKey) {
              return true;
            }
            return false;
          });
          
          if (property && property.value) {
            // Return the actual value from the nested structure
            return property.value._ || '';
          }
          return '';
        };

        // Extract required adapter information using the proper key matching
        const adapterName = getPropertyValue(properties, 'Name') || flow.id || `Adapter_${index}`;
        const adapterType = getPropertyValue(properties, 'ComponentType') || 'Unknown';
        const adapterCategory = getPropertyValue(properties, 'direction') || 'Unknown';

        logger.debug('Extracted properties', { 
          flowId, 
          messageFlowId: flow.id || flow.name, 
          adapterName,
          adapterType,
          adapterCategory,
          totalProperties: properties.length,
          // Log available keys for debugging
          availableKeys: properties.map(p => p.key ? p.key._ : 'Unknown').filter(k => k)
        });

        // Skip if critical information is missing
        if (adapterType === 'Unknown' && adapterCategory === 'Unknown') {
          logger.warn('Skipping adapter due to missing ComponentType and direction', { 
            flowId, 
            messageFlowId: flow.id || flow.name, 
            adapterName,
            availableProperties: properties.map(p => p.key ? p.key._ : 'Unknown').filter(k => k)
          });
          return null;
        }

        // Extract cmdVariantUri for additional configuration
        const cmdVariantUri = getPropertyValue(properties, 'cmdVariantUri') || 'N/A';

        // Prepare Content for configuration - collect all properties
        const contentProps = {};
        properties.forEach(prop => {
          if (prop.key && prop.key._ && prop.value) {
            const key = prop.key._;
            const value = prop.value._ || '';
            contentProps[key] = value;
          }
        });
        
        // Add additional flow information
        if (flow.id) contentProps.id = flow.id;
        if (adapterName) contentProps.name = adapterName;

        const resource = {
          Name: adapterName,
          '$': { id: flow.id || adapterName },
          ComponentType: adapterType,
          cmdVariantUri: cmdVariantUri,
          Content: JSON.stringify(contentProps)
        };

        logger.debug('Processed adapter resource', { 
          flowId, 
          adapterName, 
          adapterType, 
          adapterCategory,
          cmdVariantUri
        });

        return {
          adapter_name: adapterName,
          adapter_type: adapterType,
          adapter_category: adapterCategory,
          direction: adapterCategory, // Map adapter_category to direction for compatibility
          configuration: {
            content: resource.Content,
            resourceMetadata: {
              name: resource.Name,
              cmdVariantUri: resource.cmdVariantUri,
              componentType: resource.ComponentType
            }
          }
        };
      })
      .filter(resource => resource !== null); // Remove null entries
  } catch (error) {
    logger.error('Error extracting adapters from XML', { 
      flowId, 
      error: error.message, 
      stack: error.stack 
    });
    return [];
  }
};

/**
 * Extract security mechanisms from parsed iFlow XML
 * @param {Object} parsedXml - Parsed XML object
 * @param {string} flowId - Flow ID for logging
 * @returns {Array} Array of security mechanisms
 */
const extractSecurityFromXml = (parsedXml, flowId) => {
  try {
    if (!parsedXml || !parsedXml['bpmn2:definitions']) {
      logger.warn('Invalid or missing parsed XML for security extraction', { flowId });
      return [];
    }

    const securityMechanisms = [];
    const collaboration = parsedXml['bpmn2:definitions']['bpmn2:collaboration'];
    
    if (!collaboration) {
      logger.warn('No collaboration found in XML for security extraction', { flowId });
      return [];
    }

    // Extract security from message flows
    let messageFlows = collaboration['bpmn2:messageFlow'] || [];
    if (!Array.isArray(messageFlows)) {
      messageFlows = messageFlows ? [messageFlows] : [];
    }

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

      // Function to extract property value by key
      const getPropertyValue = (propertyArray, targetKey) => {
        const property = propertyArray.find(prop => {
          if (prop.key && prop.key._ === targetKey) {
            return true;
          }
          return false;
        });
        
        if (property && property.value) {
          return property.value._ || '';
        }
        return '';
      };

      // Determine if this is a sender or receiver adapter
      const direction = getPropertyValue(properties, 'direction') || 'Unknown';
      const adapterName = getPropertyValue(properties, 'Name') || flow.id || `Adapter_${index}`;
      const componentType = getPropertyValue(properties, 'ComponentType') || 'Unknown';
      
      // Get authentication method based on direction
      let authMethod = '';
      if (direction === 'Sender') {
        // For sender adapters, use senderAuthType
        authMethod = getPropertyValue(properties, 'senderAuthType');
        logger.debug('Found sender authentication method', { 
          flowId, 
          adapterName, 
          authMethod 
        });
      } else if (direction === 'Receiver') {
        // For receiver adapters, use authenticationMethod
        authMethod = getPropertyValue(properties, 'authenticationMethod');
        logger.debug('Found receiver authentication method', { 
          flowId, 
          adapterName, 
          authMethod 
        });
      }

      // Process authentication if found
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

      // Check for CSRF protection (common in OData adapters)
      const isCSRFEnabled = getPropertyValue(properties, 'isCSRFEnabled');
      if (isCSRFEnabled === 'true') {
        securityMechanisms.push({
          mechanism_name: `${adapterName}_CSRF`,
          mechanism_type: 'CSRF Protection',
          direction: 'Outbound', // CSRF is typically outbound protection
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

      // Check for private key/certificate configurations (for outbound calls)
      const privateKeyAlias = getPropertyValue(properties, 'privateKeyAlias') || 
                             getPropertyValue(properties, 'odataCertAuthPrivateKeyAlias');
      if (privateKeyAlias && direction === 'Receiver') {
        // Only add if not already covered by authenticationMethod
        const existingClientCert = securityMechanisms.find(
          sm => sm.mechanism_name === `${adapterName}_Client Certificate` ||
                sm.mechanism_name === `${adapterName}_ClientCertificate`
        );
        
        if (!existingClientCert) {
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
      }

      // Check for XSRF protection (specific to HTTP Sender)
      const xsrfProtection = getPropertyValue(properties, 'xsrfProtection');
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
      const userRole = getPropertyValue(properties, 'userRole');
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
    });

    // Check collaboration level security settings
    const collaborationProps = collaboration['bpmn2:extensionElements']?.['ifl:property'] || [];
    const collabPropsArray = Array.isArray(collaborationProps) ? collaborationProps : [collaborationProps].filter(Boolean);
    
    collabPropsArray.forEach(prop => {
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

        
        
      }
    });

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
};

/**
 * Fetch all integration packages
 * @returns {Promise<Array>} List of integration packages
 */
const fetchIntegrationPackages = async () => {
  const response = await fetchFromApi('/api/v1/IntegrationPackages');
  return response.d.results;
};

/**
 * Fetch a specific integration package by ID
 * @param {string} packageId - Package ID
 * @returns {Promise<Object>} Package details
 */
const fetchIntegrationPackage = async (packageId) => {
  const response = await fetchFromApi(`/api/v1/IntegrationPackages('${packageId}')`);
  return response.d;
};

/**
 * Fetch all integration flows (design-time artifacts)
 * @returns {Promise<Array>} List of integration flows
 */
const fetchAllIntegrationFlows = async () => {
  const response = await fetchFromApi('/api/v1/IntegrationDesigntimeArtifacts');
  return response.d.results;
};

/**
 * Fetch integration flows for a specific package
 * @param {string} packageId - Package ID
 * @returns {Promise<Array>} List of integration flows in the package
 */
const fetchPackageIntegrationFlows = async (packageId) => {
  const response = await fetchFromApi(`/api/v1/IntegrationPackages('${packageId}')/IntegrationDesigntimeArtifacts`);
  return response.d.results;
};

/**
 * Fetch integration flow details
 * @param {string} flowId - Flow ID
 * @param {string} version - Flow version
 * @param {boolean} isBinary - Whether to fetch as binary data
 * @returns {Promise<Object>} Flow details
 */
const fetchIntegrationFlowDetails = async (flowId, version,isBinary = true) => {
  try {
    logger.debug('Fetching integration flow details', { flowId });
    const encodedFlowId = encodeURIComponent(flowId);
    const encodedVersion = encodeURIComponent(version);
    
    // Fetch ZIP file using fetchFromApi
    const response = await fetchFromApi(
      `/api/v1/IntegrationDesigntimeArtifacts(Id='${encodedFlowId}',Version='${encodedVersion}')/$value`,
      {},
      isBinary
    );

    // Check if response contains data
    if (!response || (!response.d && !Buffer.isBuffer(response))) {
      logger.warn('No data received from API', { flowId });
      return { 
        id: flowId, 
        adapters: [], 
        error: 'No data received from API' 
      };
    }

    // Handle binary response
    let zipBuffer;
    if (Buffer.isBuffer(response)) {
      zipBuffer = response;
    } else if (response.d) {
      zipBuffer = Buffer.from(response.d);
    } else {
      logger.warn('Invalid response format', { flowId, responseType: typeof response });
      return { 
        id: flowId, 
        adapters: [], 
        error: 'Invalid response format' 
      };
    }
    
    logger.debug('Received ZIP file', { flowId, size: zipBuffer.length });

    // Extract XML from ZIP
    const parsedXml = await extractXmlFromZip(zipBuffer, flowId);
    if (!parsedXml) {
      logger.warn('Failed to extract XML from ZIP', { flowId });
      return { 
        id: flowId, 
        adapters: [], 
        error: 'Failed to extract XML from ZIP' 
      };
    }

    // Extract adapters from parsed XML
    const adapters = await extractAdaptersFromXml(parsedXml, flowId);
    logger.debug('Extracted adapters', { flowId, adapterCount: adapters.length });

    // Construct flow data
    const flowData = {
      id: flowId,
      adapters: adapters
    };

    return flowData;
  } catch (error) {
    if (error.response?.status === 400) {
      logger.warn(`Invalid request for flow ${flowId} (version ${version})`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return { 
        id: flowId, 
        adapters: [], 
        error: error.response?.data?.message || error.message 
      };
    }
    logger.error('Error fetching integration flow details', {
      flowId,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack
    });
    return { 
      id: flowId, 
      adapters: [], 
      error: error.message 
    };
  }
};
/**
 * Fetch runtime status of an integration flow
 * @param {string} flowId - Flow ID
 * @param {string} version - Flow version
 * @returns {Promise<Object>} Runtime status information
 */
const fetchRuntimeStatus = async (flowId, version) => {
  try {
    const response = await fetchFromApi(`/api/v1/IntegrationRuntimeArtifacts(Id='${flowId}',Version='${version}')`);
    return response.d;
  } catch (error) {
    // If the flow is not deployed, the API might return a 404
    if (error.response && error.response.status === 404) {
      return { Status: 'Not Deployed' };
    }
    throw error;
  }
};

/**
 * Fetch message processing logs for a specific integration flow
 * @param {string} flowName - Flow name
 * @param {number} days - Number of days to look back
 * @param {string} status - Filter by status (optional)
 * @returns {Promise<Array>} Message processing logs
 */
const fetchMessageLogs = async (flowName, days = 7, status = null) => {
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Format dates for OData filter
  const startDateStr = startDate.toISOString().split('.')[0];
  
  // Build filter
  let filterParams = `LogStart gt datetime'${startDateStr}' and IntegrationFlowName eq '${flowName}'`;
  if (status) {
    filterParams += ` and Status eq '${status}'`;
  }
  
  const response = await fetchFromApi('/api/v1/MessageProcessingLogs', {
    $filter: filterParams
  });
  
  return response.d.results;
};

/**
 * Fetch service endpoints for a specific integration flow
 * @param {string} flowName - Flow name
 * @returns {Promise<Array>} Service endpoints
 */
const fetchServiceEndpoints = async (flowName) => {
  try {
    const response = await fetchFromApi('/api/v1/ServiceEndpoints', {
      $filter: `IntegrationFlowName eq '${flowName}'`
    });
    return response.d.results;
  } catch (error) {
    logger.error(`Error fetching service endpoints for flow ${flowName}`, { error: error.message });
    return [];
  }
};

/**
 * Fetch error information for a specific message
 * @param {string} messageGuid - Message GUID
 * @returns {Promise<Object>} Error information
 */
const fetchErrorInformation = async (messageGuid) => {
  try {
    const response = await fetchFromApi(`/api/v1/MessageProcessingLogs(MessageGuid='${messageGuid}')/ErrorInformation`);
    return response.d;
  } catch (error) {
    logger.error(`Error fetching error information for message ${messageGuid}`, { error: error.message });
    return null;
  }
};

module.exports = {
  fetchIntegrationPackages,
  fetchIntegrationPackage,
  fetchAllIntegrationFlows,
  fetchPackageIntegrationFlows,
  fetchIntegrationFlowDetails,
  extractXmlFromZip,
  extractAdaptersFromXml
  //fetchRuntimeStatus,
  //fetchMessageLogs,
  //fetchServiceEndpoints,
  //fetchErrorInformation
};