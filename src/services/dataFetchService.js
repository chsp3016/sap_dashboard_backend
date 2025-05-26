// services/dataFetchService.js - Modular implementation
const axios = require('axios');
const logger = require('../utils/logger');
const authService = require('./authService');

// Import extractors
const BaseXmlExtractor = require('./xmlExtraction/baseExtractor');
const AdapterExtractor = require('./xmlExtraction/adapterExtractor');
const SecurityExtractor = require('./xmlExtraction/securityExtractor');
const ErrorHandlingExtractor = require('./xmlExtraction/errorHandlingExtractor');
const PersistenceExtractor = require('./xmlExtraction/persistenceExtractor');

require('dotenv').config();

// Base URL for SAP Integration Suite API
const baseUrl = process.env.SAP_API_BASE_URL;

// Initialize extractors
const baseExtractor = new BaseXmlExtractor();
const adapterExtractor = new AdapterExtractor();
const securityExtractor = new SecurityExtractor();
const errorHandlingExtractor = new ErrorHandlingExtractor();
const persistenceExtractor = new PersistenceExtractor();

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
 * Fetch integration flow details - Returns only parsed XML
 * @param {string} flowId - Flow ID
 * @param {string} version - Flow version
 * @param {boolean} isBinary - Whether to fetch as binary data
 * @returns {Promise<Object>} Flow details with parsed XML
 */
const fetchIntegrationFlowDetails = async (flowId, version, isBinary = true) => {
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
        parsedXml: null,
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
        parsedXml: null,
        error: 'Invalid response format' 
      };
    }
    
    logger.debug('Received ZIP file', { flowId, size: zipBuffer.length });

    // Extract XML from ZIP
    const parsedXml = await baseExtractor.extractXmlFromZip(zipBuffer, flowId);
    if (!parsedXml) {
      logger.warn('Failed to extract XML from ZIP', { flowId });
      return { 
        id: flowId, 
        parsedXml: null,
        error: 'Failed to extract XML from ZIP' 
      };
    }

    logger.debug('Successfully parsed XML', { flowId });

    // Return flow data with parsed XML only
    const flowData = {
      id: flowId,
      parsedXml: parsedXml
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
        parsedXml: null,
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
      parsedXml: null,
      error: error.message 
    };
  }
};

/**
 * Extract adapters from parsed XML
 * @param {Object} parsedXml - Parsed XML object
 * @param {string} flowId - Flow ID for logging
 * @returns {Array} Array of adapters
 */
const extractAdaptersFromXml = (parsedXml, flowId) => {
  return adapterExtractor.extractAdapters(parsedXml, flowId);
};

/**
 * Extract security mechanisms from parsed XML
 * @param {Object} parsedXml - Parsed XML object
 * @param {string} flowId - Flow ID for logging
 * @returns {Array} Array of security mechanisms
 */
const extractSecurityFromXml = (parsedXml, flowId) => {
  return securityExtractor.extractSecurity(parsedXml, flowId);
};

/**
 * Extract error handling from parsed XML
 * @param {Object} parsedXml - Parsed XML object
 * @param {string} flowId - Flow ID for logging
 * @returns {Object} Error handling configuration
 */
const extractErrorHandlingFromXml = (parsedXml, flowId) => {
  return errorHandlingExtractor.extractErrorHandling(parsedXml, flowId);
};

/**
 * Extract persistence from parsed XML
 * @param {Object} parsedXml - Parsed XML object
 * @param {string} flowId - Flow ID for logging
 * @returns {Object} Persistence configuration
 */
const extractPersistenceFromXml = (parsedXml, flowId) => {
  return persistenceExtractor.extractPersistence(parsedXml, flowId);
};

module.exports = {
  fetchIntegrationPackages,
  fetchIntegrationPackage,
  fetchAllIntegrationFlows,
  fetchPackageIntegrationFlows,
  fetchIntegrationFlowDetails,
  extractAdaptersFromXml,
  extractSecurityFromXml,
  extractErrorHandlingFromXml,
  extractPersistenceFromXml
};