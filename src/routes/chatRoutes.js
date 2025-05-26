const express = require('express');
const router = express.Router();
const { Op, Sequelize } = require('sequelize');
const models = require('../models');
const logger = require('../utils/logger');

/**
 * POST /api/chat/query
 * Process a natural language query about integration flows
 */
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    logger.info(`Processing chat query: ${query}`);
    
    // Simple keyword-based query processing
    // In a production system, you would use a more sophisticated NLP approach
    
    const queryLower = query.toLowerCase();
    let response = {};
    
    // Check for specific query types
    if (queryLower.includes('failed') || queryLower.includes('error')) {
      // Query for failed iFlows
      const failedIflows = await getFailedIflows();
      response = {
        type: 'failed_iflows',
        message: 'Here are the integration flows with failures:',
        data: failedIflows
      };
    } else if (queryLower.includes('security') || queryLower.includes('authentication')) {
      // Query for security mechanisms
      const securityInfo = await getSecurityInfo();
      response = {
        type: 'security_info',
        message: 'Here is the security information for integration flows:',
        data: securityInfo
      };
    } else if (queryLower.includes('adapter') || queryLower.includes('connection')) {
      // Query for adapter usage
      const adapterInfo = await getAdapterInfo();
      response = {
        type: 'adapter_info',
        message: 'Here is the adapter usage information:',
        data: adapterInfo
      };
    } else if (queryLower.includes('performance') || queryLower.includes('processing time')) {
      // Query for performance metrics
      const performanceInfo = await getPerformanceInfo();
      response = {
        type: 'performance_info',
        message: 'Here are the performance metrics for integration flows:',
        data: performanceInfo
      };
    } else if (queryLower.includes('deployment') || queryLower.includes('deployed')) {
      // Query for deployment status
      const deploymentInfo = await getDeploymentInfo();
      response = {
        type: 'deployment_info',
        message: 'Here is the deployment information:',
        data: deploymentInfo
      };
    } else if (queryLower.includes('show') && queryLower.includes('iflow')) {
      // Extract potential iFlow name from query
      const iflowNameMatch = query.match(/show\s+(?:me\s+)?(?:the\s+)?(?:iflow|integration flow)\s+(?:named\s+)?["']?([^"']+)["']?/i);
      
      if (iflowNameMatch && iflowNameMatch[1]) {
        const iflowName = iflowNameMatch[1].trim();
        const iflowInfo = await getIflowByName(iflowName);
        
        if (iflowInfo) {
          response = {
            type: 'iflow_info',
            message: `Here is the information for integration flow "${iflowName}":`,
            data: iflowInfo
          };
        } else {
          response = {
            type: 'not_found',
            message: `I couldn't find an integration flow named "${iflowName}".`,
            data: null
          };
        }
      } else {
        // Show all iFlows
        const allIflows = await getAllIflows();
        response = {
          type: 'all_iflows',
          message: 'Here are all the integration flows:',
          data: allIflows
        };
      }
    } else {
      // Generic search based on query terms
      const searchResults = await searchIflows(queryLower);
      
      if (searchResults.length > 0) {
        response = {
          type: 'search_results',
          message: 'Here are the integration flows that match your query:',
          data: searchResults
        };
      } else {
        response = {
          type: 'no_results',
          message: "I couldn't find any integration flows matching your query. Please try a different query.",
          data: null
        };
      }
    }
    
    res.json(response);
  } catch (error) {
    logger.error('Error processing chat query', { error: error.message });
    res.status(500).json({ error: 'Failed to process query' });
  }
});

/**
 * Get all failed iFlows
 * @returns {Promise<Array>} Array of failed iFlows
 */
const getFailedIflows = async () => {
  const failedIflows = await models.Iflow.findAll({
    include: [
      {
        model: models.DeploymentInfo,
        where: {
          status: { [Op.in]: ['Failed', 'Error'] }
        },
        required: true
      },
      {
        model: models.Package,
        attributes: ['package_name']
      }
    ],
    order: [['iflow_name', 'ASC']]
  });
  
  return failedIflows.map(iflow => ({
    id: iflow.iflow_id,
    name: iflow.iflow_name,
    package: iflow.package.package_name,
    status: iflow.deployment_infos[0].status,
    error: iflow.deployment_infos[0].error_information
  }));
};

/**
 * Get security information for iFlows
 * @returns {Promise<Object>} Security information
 */
const getSecurityInfo = async () => {
  // Count iFlows by security mechanism
  const securityCounts = await models.SecurityMechanism.findAll({
    attributes: [
      'mechanism_type',
      [Sequelize.fn('COUNT', Sequelize.col('iflow_securities.iflow_id')), 'count']
    ],
    include: [
      {
        model: models.IflowSecurity,
        attributes: []
      }
    ],
    group: ['mechanism_type']
  });
  
  // Get iFlows with security mechanisms
  const iflowsWithSecurity = await models.Iflow.findAll({
    attributes: ['iflow_id', 'iflow_name'],
    include: [
      {
        model: models.IflowSecurity,
        include: [
          {
            model: models.SecurityMechanism,
            attributes: ['mechanism_name', 'mechanism_type']
          }
        ]
      },
      {
        model: models.Package,
        attributes: ['package_name']
      }
    ],
    order: [['iflow_name', 'ASC']]
  });
  
  return {
    summary: securityCounts,
    iflows: iflowsWithSecurity.map(iflow => ({
      id: iflow.iflow_id,
      name: iflow.iflow_name,
      package: iflow.package.package_name,
      security_mechanisms: iflow.iflow_securities.map(sec => ({
        name: sec.security_mechanism.mechanism_name,
        type: sec.security_mechanism.mechanism_type,
        direction: sec.direction
      }))
    }))
  };
};

/**
 * Get adapter usage information
 * @returns {Promise<Object>} Adapter information
 */
const getAdapterInfo = async () => {
  // Count iFlows by adapter type
  const adapterCounts = await models.Adapter.findAll({
    attributes: [
      'adapter_type',
      [Sequelize.fn('COUNT', Sequelize.col('iflow_adapters.iflow_id')), 'count']
    ],
    include: [
      {
        model: models.IflowAdapter,
        attributes: []
      }
    ],
    group: ['adapter_type']
  });
  
  // Get iFlows with adapters
  const iflowsWithAdapters = await models.Iflow.findAll({
    attributes: ['iflow_id', 'iflow_name'],
    include: [
      {
        model: models.IflowAdapter,
        include: [
          {
            model: models.Adapter,
            attributes: ['adapter_name', 'adapter_type']
          }
        ]
      },
      {
        model: models.Package,
        attributes: ['package_name']
      }
    ],
    order: [['iflow_name', 'ASC']]
  });
  
  return {
    summary: adapterCounts,
    iflows: iflowsWithAdapters.map(iflow => ({
      id: iflow.iflow_id,
      name: iflow.iflow_name,
      package: iflow.package.package_name,
      adapters: iflow.iflow_adapters.map(adapter => ({
        name: adapter.adapter.adapter_name,
        type: adapter.adapter.adapter_type,
        direction: adapter.direction
      }))
    }))
  };
};

/**
 * Get performance information for iFlows
 * @returns {Promise<Array>} Performance information
 */
const getPerformanceInfo = async () => {
  const performanceInfo = await models.Iflow.findAll({
    attributes: ['iflow_id', 'iflow_name'],
    include: [
      {
        model: models.RuntimeInfo,
        attributes: ['avg_processing_time', 'success_count', 'failure_count', 'last_execution_time']
      },
      {
        model: models.Package,
        attributes: ['package_name']
      }
    ],
    order: [[models.RuntimeInfo, 'avg_processing_time', 'DESC']]
  });
  
  return performanceInfo.map(iflow => ({
    id: iflow.iflow_id,
    name: iflow.iflow_name,
    package: iflow.package.package_name,
    avg_processing_time: iflow.runtime_info ? iflow.runtime_info.avg_processing_time : null,
    success_count: iflow.runtime_info ? iflow.runtime_info.success_count : 0,
    failure_count: iflow.runtime_info ? iflow.runtime_info.failure_count : 0,
    last_execution: iflow.runtime_info ? iflow.runtime_info.last_execution_time : null
  }));
};

/**
 * Get deployment information for iFlows
 * @returns {Promise<Object>} Deployment information
 */
const getDeploymentInfo = async () => {
  // Count iFlows by deployment status
  const statusCounts = await models.DeploymentInfo.findAll({
    attributes: [
      'status',
      [Sequelize.fn('COUNT', Sequelize.col('deployment_id')), 'count']
    ],
    group: ['status']
  });
  
  // Get iFlows with deployment info
  const iflowsWithDeployment = await models.Iflow.findAll({
    attributes: ['iflow_id', 'iflow_name'],
    include: [
      {
        model: models.DeploymentInfo,
        attributes: ['status', 'version', 'deployed_by', 'deployed_on']
      },
      {
        model: models.Package,
        attributes: ['package_name']
      }
    ],
    order: [['iflow_name', 'ASC']]
  });
  
  return {
    summary: statusCounts,
    iflows: iflowsWithDeployment.map(iflow => ({
      id: iflow.iflow_id,
      name: iflow.iflow_name,
      package: iflow.package.package_name,
      status: iflow.deployment_info ? iflow.deployment_info.status : 'Unknown',
      version: iflow.deployment_info ? iflow.deployment_info.version : null,
      deployed_by: iflow.deployment_info ? iflow.deployment_info.deployed_by : null,
      deployed_on: iflow.deployment_info ? iflow.deployment_info.deployed_on : null
    }))
  };
};

/**
 * Get iFlow by name
 * @param {string} name - iFlow name
 * @returns {Promise<Object>} iFlow information
 */
const getIflowByName = async (name) => {
  const iflow = await models.Iflow.findOne({
    where: {
      iflow_name: { [Op.iLike]: `%${name}%` }
    },
    include: [
      {
        model: models.Package,
        attributes: ['package_name']
      },
      {
        model: models.DeploymentInfo
      },
      {
        model: models.RuntimeInfo
      },
      {
        model: models.ErrorHandling
      },
      {
        model: models.Persistence
      },
      {
        model: models.IflowAdapter,
        include: [
          {
            model: models.Adapter,
            attributes: ['adapter_name', 'adapter_type']
          }
        ]
      },
      {
        model: models.IflowSecurity,
        include: [
          {
            model: models.SecurityMechanism,
            attributes: ['mechanism_name', 'mechanism_type']
          }
        ]
      }
    ]
  });
  
  return iflow;
};

/**
 * Get all iFlows
 * @returns {Promise<Array>} Array of iFlows
 */
const getAllIflows = async () => {
  const iflows = await models.Iflow.findAll({
    attributes: ['iflow_id', 'iflow_name', 'iflow_description'],
    include: [
      {
        model: models.Package,
        attributes: ['package_name']
      },
      {
        model: models.DeploymentInfo,
        attributes: ['status']
      }
    ],
    order: [['iflow_name', 'ASC']]
  });
  
  return iflows.map(iflow => ({
    id: iflow.iflow_id,
    name: iflow.iflow_name,
    description: iflow.iflow_description,
    package: iflow.package.package_name,
    status: iflow.deployment_info ? iflow.deployment_info.status : 'Unknown'
  }));
};

/**
 * Search iFlows based on query terms
 * @param {string} query - Search query
 * @returns {Promise<Array>} Search results
 */
const searchIflows = async (query) => {
  // Extract search terms
  const terms = query.split(/\s+/).filter(term => term.length > 2);
  
  if (terms.length === 0) {
    return [];
  }
  
  // Build search conditions
  const searchConditions = terms.map(term => ({
    [Op.or]: [
      { iflow_name: { [Op.iLike]: `%${term}%` } },
      { iflow_description: { [Op.iLike]: `%${term}%` } }
    ]
  }));
  
  // Search iFlows
  const iflows = await models.Iflow.findAll({
    where: {
      [Op.and]: searchConditions
    },
    include: [
      {
        model: models.Package,
        attributes: ['package_name']
      },
      {
        model: models.DeploymentInfo,
        attributes: ['status']
      }
    ],
    order: [['iflow_name', 'ASC']]
  });
  
  return iflows.map(iflow => ({
    id: iflow.iflow_id,
    name: iflow.iflow_name,
    description: iflow.iflow_description,
    package: iflow.package.package_name,
    status: iflow.deployment_info ? iflow.deployment_info.status : 'Unknown'
  }));
};

module.exports = router;
