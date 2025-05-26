const express = require('express');
const router = express.Router();
const nlpService = require('../services/nlp-service');
const logger = require('../utils/logger');

/**
 * POST /api/nlp/query
 * Process a natural language query about SAP Integration Suite
 */
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    logger.info(`Processing NLP query: ${query}`);
    
    // Process the query using the NLP service
    const response = await nlpService.processQuery(query);
    
    res.json(response);
  } catch (error) {
    logger.error('Error processing NLP query', { error: error.message });
    res.status(500).json({ error: 'Failed to process query', details: error.message });
  }
});

/**
 * GET /api/nlp/capabilities
 * Get information about the NLP service capabilities
 */
router.get('/capabilities', (req, res) => {
  const capabilities = {
    queryTypes: [
      {
        type: 'security',
        description: 'Queries about security mechanisms and authentication',
        examples: [
          'Show me all iFlows with OAuth authentication',
          'Which iFlows are using certificate-based security?',
          'List all security mechanisms used in the tenant'
        ]
      },
      {
        type: 'error',
        description: 'Queries about errors and error handling',
        examples: [
          'Which iFlows have error handling issues?',
          'Show me all failed iFlows',
          'List iFlows with missing error logging'
        ]
      },
      {
        type: 'performance',
        description: 'Queries about performance and processing time',
        examples: [
          'What is the average message processing time for iFlows in the last week?',
          'Which iFlows have the highest processing time?',
          'Show me performance metrics for all iFlows'
        ]
      },
      {
        type: 'system_composition',
        description: 'Queries about system composition',
        examples: [
          'List all iFlows with SAP2SAP system composition',
          'How many iFlows are using SAP to non-SAP composition?',
          'Show me all non-SAP to non-SAP integrations'
        ]
      },
      {
        type: 'adapter',
        description: 'Queries about adapters',
        examples: [
          'How many iFlows are using the HTTP adapter?',
          'Which iFlows use the SOAP adapter?',
          'List all adapters used in the tenant'
        ]
      },
      {
        type: 'iflow',
        description: 'Queries about specific iFlows',
        examples: [
          'Show me details for iFlow "Customer_Order_Processing"',
          'What security mechanisms does iFlow "Invoice_Approval" use?',
          'Show me the performance of iFlow "Material_Master_Sync"'
        ]
      }
    ]
  };
  
  res.json(capabilities);
});

module.exports = router;