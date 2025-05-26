const axios = require('axios');
const qs = require('querystring');
const logger = require('../utils/logger');
require('dotenv').config();

// Cache for the OAuth token
let tokenCache = {
  accessToken: null,
  expiresAt: null
};

// Circuit breaker to prevent infinite retries
let circuitBreaker = {
  failureCount: 0,
  lastFailureTime: null,
  isOpen: false,
  openUntil: null
};

const MAX_FAILURES = 3;
const CIRCUIT_BREAKER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Check if circuit breaker is open
 */
const isCircuitBreakerOpen = () => {
  if (circuitBreaker.isOpen && circuitBreaker.openUntil && Date.now() < circuitBreaker.openUntil) {
    return true;
  }
  
  // Reset circuit breaker if timeout has passed
  if (circuitBreaker.isOpen && circuitBreaker.openUntil && Date.now() >= circuitBreaker.openUntil) {
    logger.info('Circuit breaker timeout expired, resetting');
    circuitBreaker = {
      failureCount: 0,
      lastFailureTime: null,
      isOpen: false,
      openUntil: null
    };
  }
  
  return false;
};

/**
 * Record authentication failure
 */
const recordFailure = () => {
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailureTime = Date.now();
  
  if (circuitBreaker.failureCount >= MAX_FAILURES) {
    circuitBreaker.isOpen = true;
    circuitBreaker.openUntil = Date.now() + CIRCUIT_BREAKER_TIMEOUT;
    logger.error(`Authentication circuit breaker opened due to ${MAX_FAILURES} consecutive failures. Will retry after ${CIRCUIT_BREAKER_TIMEOUT/1000/60} minutes`);
  }
};

/**
 * Record authentication success
 */
const recordSuccess = () => {
  if (circuitBreaker.failureCount > 0) {
    logger.info('Authentication recovered, resetting circuit breaker');
  }
  circuitBreaker = {
    failureCount: 0,
    lastFailureTime: null,
    isOpen: false,
    openUntil: null
  };
};

/**
 * Validate configuration before attempting authentication
 */
const validateConfiguration = () => {
  const requiredEnvVars = ['SAP_CLIENT_ID', 'SAP_CLIENT_SECRET', 'SAP_TOKEN_URL'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate URL format
  try {
    new URL(process.env.SAP_TOKEN_URL);
  } catch (error) {
    throw new Error(`Invalid SAP_TOKEN_URL format: ${process.env.SAP_TOKEN_URL}`);
  }
};

/**
 * Get OAuth token using client credentials grant
 * @returns {Promise<string>} The access token
 */
const getOAuthToken = async () => {
  try {
    // Validate configuration first
    validateConfiguration();
    
    // Check circuit breaker
    if (isCircuitBreakerOpen()) {
      const timeUntilReset = Math.ceil((circuitBreaker.openUntil - Date.now()) / 1000 / 60);
      throw new Error(`Authentication circuit breaker is open. Retry in ${timeUntilReset} minutes`);
    }
    
    // Check if we have a valid cached token
    const now = Date.now();
    if (tokenCache.accessToken && tokenCache.expiresAt && now < tokenCache.expiresAt) {
      logger.debug('Using cached OAuth token');
      return tokenCache.accessToken;
    }

    logger.info('Requesting new OAuth token');
    
    // Prepare the request for token
    const tokenUrl = process.env.SAP_TOKEN_URL;
    const clientId = process.env.SAP_CLIENT_ID;
    const clientSecret = process.env.SAP_CLIENT_SECRET;
    
    // Create the Authorization header with Base64-encoded client_id:client_secret
    const authString = `${clientId}:${clientSecret}`;
    const base64Auth = Buffer.from(authString).toString('base64');
    
    const headers = {
      'Authorization': `Basic ${base64Auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'SAP-Dashboard-Backend/1.0.0'
    };
    
    const data = qs.stringify({
      'grant_type': 'client_credentials'
    });
    
    // Make the request to get the token with timeout
    const response = await axios.post(tokenUrl, data, { 
      headers,
      timeout: 10000 // 10 second timeout
    });
    
    if (response.status === 200 && response.data.access_token) {
      // Calculate token expiration time (subtract 5 minutes for safety margin)
      const expiresIn = response.data.expires_in || 3600; // Default to 1 hour if not provided
      const expiresAt = now + (expiresIn * 1000) - (5 * 60 * 1000);
      
      // Cache the token
      tokenCache = {
        accessToken: response.data.access_token,
        expiresAt
      };
      
      // Record success
      recordSuccess();
      
      logger.info('Successfully obtained new OAuth token', {
        expiresIn: expiresIn,
        expiresAt: new Date(expiresAt).toISOString()
      });
      
      return response.data.access_token;
    } else {
      throw new Error('Invalid token response structure');
    }
  } catch (error) {
    // Record failure
    recordFailure();
    
    logger.error('Failed to obtain OAuth token', { 
      error: error.message,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
      tokenUrl: process.env.SAP_TOKEN_URL ? process.env.SAP_TOKEN_URL.replace(/\/oauth\/token.*/, '/oauth/token') : 'Not configured'
    });
    
    // Provide helpful error messages based on error type
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to SAP system. Please check SAP_TOKEN_URL: ${error.message}`);
    } else if (error.response?.status === 401) {
      throw new Error(`Authentication failed. Please check SAP_CLIENT_ID and SAP_CLIENT_SECRET: ${error.response.data?.error_description || error.message}`);
    } else if (error.response?.status === 400) {
      throw new Error(`Bad request to SAP token endpoint: ${error.response.data?.error_description || error.message}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error(`Request timeout. SAP system may be slow or unreachable: ${error.message}`);
    }
    
    throw new Error(`Authentication failed: ${error.message}`);
  }
};

/**
 * Get authorization headers with the OAuth token
 * @returns {Promise<Object>} Headers object with Authorization
 */
const getAuthHeaders = async (isBinary = false) => {
  const token = await getOAuthToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': isBinary ? 'application/zip' : 'application/json, application/xml',
    'User-Agent': 'SAP-Dashboard-Backend/1.0.0'
  };
};

/**
 * Clear the token cache (useful for testing or when token needs to be refreshed)
 */
const clearTokenCache = () => {
  tokenCache = {
    accessToken: null,
    expiresAt: null
  };
  logger.info('OAuth token cache cleared');
};

/**
 * Get circuit breaker status
 */
const getCircuitBreakerStatus = () => {
  return {
    isOpen: circuitBreaker.isOpen,
    failureCount: circuitBreaker.failureCount,
    lastFailureTime: circuitBreaker.lastFailureTime,
    openUntil: circuitBreaker.openUntil,
    nextRetryIn: circuitBreaker.openUntil ? Math.max(0, circuitBreaker.openUntil - Date.now()) : 0
  };
};

/**
 * Reset circuit breaker (for manual recovery)
 */
const resetCircuitBreaker = () => {
  logger.info('Manually resetting authentication circuit breaker');
  circuitBreaker = {
    failureCount: 0,
    lastFailureTime: null,
    isOpen: false,
    openUntil: null
  };
};

module.exports = {
  getOAuthToken,
  getAuthHeaders,
  clearTokenCache,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  validateConfiguration
};