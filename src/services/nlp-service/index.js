const OpenAI = require('openai');
const natural = require('natural');
const nlp = require('compromise');
const { Op, Sequelize } = require('sequelize');
const models = require('../../models');
const logger = require('../../utils/logger');

// Initialize tokenizer for text processing
const tokenizer = new natural.WordTokenizer();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
});

/**
 * NLP Service for processing natural language queries about SAP Integration Suite
 */
class NLPService {
  /**
   * Process a natural language query and return relevant data
   * @param {string} query - The natural language query
   * @returns {Promise<Object>} - The processed response
   */
  async processQuery(query) {
    try {
      logger.info(`Processing NLP query: ${query}`);
      
      // Normalize and tokenize the query
      const normalizedQuery = query.toLowerCase().trim();
      const tokens = tokenizer.tokenize(normalizedQuery);
      
      // Parse the query using compromise for entity recognition
      const doc = nlp(normalizedQuery);
      
      // Try to match the query to predefined patterns
      const patternMatch = await this.matchQueryPattern(normalizedQuery, doc);
      
      if (patternMatch) {
        logger.info(`Pattern matched: ${patternMatch.type}`);
        return patternMatch;
      }
      
      // If no pattern matches, use OpenAI to generate a structured query
      logger.info('No pattern matched, using OpenAI for query understanding');
      return await this.processWithOpenAI(query);
    } catch (error) {
      logger.error('Error processing NLP query', { error: error.message, stack: error.stack });
      throw new Error(`Failed to process query: ${error.message}`);
    }
  }
  
  /**
   * Match the query to predefined patterns
   * @param {string} normalizedQuery - The normalized query text
   * @param {Object} doc - The compromise document
   * @returns {Promise<Object|null>} - The matched pattern response or null
   */
  async matchQueryPattern(normalizedQuery, doc) {
    try {
      // Pattern 1: Authentication/Security related queries
      if (this.matchesSecurityPattern(normalizedQuery)) {
        return await this.getSecurityInfo(normalizedQuery);
      }
      
      // Pattern 2: Error handling related queries
      if (this.matchesErrorPattern(normalizedQuery)) {
        return await this.getErrorInfo(normalizedQuery);
      }
      
      // Pattern 3: Performance/Processing time related queries
      if (this.matchesPerformancePattern(normalizedQuery)) {
        return await this.getPerformanceInfo(normalizedQuery);
      }
      
      // Pattern 4: System composition related queries
      if (this.matchesSystemCompositionPattern(normalizedQuery)) {
        return await this.getSystemCompositionInfo(normalizedQuery);
      }
      
      // Pattern 5: Adapter related queries
      if (this.matchesAdapterPattern(normalizedQuery)) {
        return await this.getAdapterInfo(normalizedQuery);
      }
      
      // Pattern 6: Specific iFlow queries
      const iflowName = this.extractIflowName(normalizedQuery, doc);
      if (iflowName) {
        return await this.getIflowInfo(iflowName);
      }
      
      // No pattern matched
      return null;
    } catch (error) {
      logger.error('Error in pattern matching', { error: error.message });
      return null;
    }
  }
  
  /**
   * Check if the query matches security/authentication patterns
   * @param {string} query - The normalized query
   * @returns {boolean} - Whether the query matches the pattern
   */
  matchesSecurityPattern(query) {
    const securityTerms = [
      'security', 'authentication', 'auth', 'oauth', 'basic auth', 
      'certificate', 'secure', 'credentials', 'password', 'token',
      'ssl', 'tls', 'saml', 'jwt'
    ];
    
    return securityTerms.some(term => query.includes(term));
  }
  
  /**
   * Check if the query matches error handling patterns
   * @param {string} query - The normalized query
   * @returns {boolean} - Whether the query matches the pattern
   */
  matchesErrorPattern(query) {
    const errorTerms = [
      'error', 'fail', 'issue', 'problem', 'exception', 'fault',
      'broken', 'crash', 'bug', 'defect', 'incident', 'failed'
    ];
    
    return errorTerms.some(term => query.includes(term));
  }
  
  /**
   * Check if the query matches performance patterns
   * @param {string} query - The normalized query
   * @returns {boolean} - Whether the query matches the pattern
   */
  matchesPerformancePattern(query) {
    const performanceTerms = [
      'performance', 'processing time', 'latency', 'speed', 'fast', 
      'slow', 'average', 'response time', 'throughput', 'execution time',
      'runtime', 'duration'
    ];
    
    return performanceTerms.some(term => query.includes(term));
  }
  
  /**
   * Check if the query matches system composition patterns
   * @param {string} query - The normalized query
   * @returns {boolean} - Whether the query matches the pattern
   */
  matchesSystemCompositionPattern(query) {
    const compositionTerms = [
      'system composition', 'sap2sap', 'sap to sap', 'sap2nonsap', 
      'sap to non-sap', 'nonsap2nonsap', 'non-sap to non-sap', 'composition'
    ];
    
    return compositionTerms.some(term => query.includes(term));
  }
  
  /**
   * Check if the query matches adapter patterns
   * @param {string} query - The normalized query
   * @returns {boolean} - Whether the query matches the pattern
   */
  matchesAdapterPattern(query) {
    const adapterTerms = [
      'adapter', 'http', 'soap', 'rest', 'odata', 'jdbc', 'jms',
      'sftp', 'file', 'mail', 'idoc', 'rfc', 'connector'
    ];
    
    return adapterTerms.some(term => query.includes(term));
  }
  
  /**
   * Extract iFlow name from the query
   * @param {string} query - The normalized query
   * @param {Object} doc - The compromise document
   * @returns {string|null} - The extracted iFlow name or null
   */
  extractIflowName(query, doc) {
    // Try to extract iFlow name using regex patterns
    const patterns = [
      /iflow\s+(?:named\s+)?["']?([^"']+)["']?/i,
      /integration flow\s+(?:named\s+)?["']?([^"']+)["']?/i,
      /show\s+(?:me\s+)?(?:the\s+)?(?:iflow|integration flow)\s+(?:named\s+)?["']?([^"']+)["']?/i
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Try to extract using compromise
    const orgs = doc.organizations().out('array');
    const nouns = doc.nouns().out('array');
    
    // Check if any organization or noun might be an iFlow name
    if (orgs.length > 0) {
      return orgs[0];
    }
    
    // Look for nouns that might be iFlow names
    if (nouns.length > 0 && (query.includes('iflow') || query.includes('integration flow'))) {
      // Find nouns that are not common query terms
      const commonTerms = ['iflow', 'integration', 'flow', 'sap', 'adapter', 'error', 'security'];
      const potentialNames = nouns.filter(noun => !commonTerms.includes(noun.toLowerCase()));
      
      if (potentialNames.length > 0) {
        return potentialNames[0];
      }
    }
    
    return null;
  }
  
  /**
   * Get security information based on the query
   * @param {string} query - The normalized query
   * @returns {Promise<Object>} - The security information
   */
 // Enhanced debugging additions for your NLP service
// Add these debugging sections to your existing getSecurityInfo method

/**
 * Get security information based on the query (with enhanced debugging)
 */
async getSecurityInfo(query) {
  try {
    logger.info('🔍 Starting getSecurityInfo with query:', { query });
    
    // Extract specific security mechanism if mentioned
    const securityMechanisms = ['oauth', 'basic auth', 'certificate', 'ssl', 'tls', 'saml', 'jwt'];
    let specificMechanism = null;
    
    for (const mechanism of securityMechanisms) {
      if (query.includes(mechanism)) {
        specificMechanism = mechanism;
        break;
      }
    }
    
    logger.info('🎯 Specific mechanism filter:', { specificMechanism });
    
    // Count iFlows by security mechanism - FIXED QUERY with debugging
    logger.info('📊 Executing security counts query...');
    const securityCounts = await models.SecurityMechanism.findAll({
      attributes: [
        'mechanism_type',
        [Sequelize.fn('COUNT', Sequelize.col('iflow_securities.iflow_id')), 'count']
      ],
      include: [
        {
          model: models.IflowSecurity,
          attributes: [],
          required: false
        }
      ],
      group: ['security_mechanism.security_mechanism_id', 'mechanism_type'],
      raw: true
    });
    
    logger.info('📈 Security counts result:', { 
      count: securityCounts.length, 
      results: securityCounts 
    });
    
    // Get iFlows with security mechanisms - FIXED QUERY with debugging
    logger.info('🔗 Executing iFlows with security query...');
    let iflowsWithSecurityQuery = {
      attributes: ['iflow_id', 'iflow_name'],
      include: [
        {
          model: models.IflowSecurity,
          include: [
            {
              model: models.SecurityMechanism,
              attributes: ['mechanism_name', 'mechanism_type'],
              where: specificMechanism ? {
                mechanism_type: { [Op.iLike]: `%${specificMechanism}%` }
              } : undefined
            }
          ],
          required: true
        },
        {
          model: models.Package,
          attributes: ['package_name']
        }
      ],
      order: [['iflow_name', 'ASC']]
    };
    
    logger.info('🎮 Query configuration:', { 
      hasSpecificMechanism: !!specificMechanism,
      queryStructure: JSON.stringify(iflowsWithSecurityQuery, null, 2)
    });
    
    const iflowsWithSecurity = await models.Iflow.findAll(iflowsWithSecurityQuery);
    
    logger.info('🎯 iFlows with security result:', { 
      count: iflowsWithSecurity.length, 
      sampleNames: iflowsWithSecurity.slice(0, 3).map(i => i.iflow_name) 
    });
    
    // Debug individual iFlow security details
    if (iflowsWithSecurity.length > 0) {
      const sampleIflow = iflowsWithSecurity[0];
      logger.info('🔍 Sample iFlow security details:', {
        iflowId: sampleIflow.iflow_id,
        iflowName: sampleIflow.iflow_name,
        securityCount: sampleIflow.iflow_securities?.length || 0,
        securityTypes: sampleIflow.iflow_securities?.map(s => s.security_mechanism?.mechanism_type) || []
      });
    }
    
    // Format the response
    let message = 'Here is the security information for integration flows:';
    if (specificMechanism) {
      message = `Here are the integration flows using ${specificMechanism.toUpperCase()} authentication:`;
    }
    
    const response = {
      type: 'security_info',
      message,
      data: {
        summary: securityCounts,
        iflows: iflowsWithSecurity.map(iflow => ({
          id: iflow.iflow_id,
          name: iflow.iflow_name,
          package: iflow.package ? iflow.package.package_name : 'Unknown',
          security_mechanisms: iflow.iflow_securities.map(sec => ({
            name: sec.security_mechanism.mechanism_name,
            type: sec.security_mechanism.mechanism_type,
            direction: sec.direction
          }))
        }))
      }
    };
    
    logger.info('📤 Final response:', { 
      type: response.type,
      message: response.message,
      summaryCount: response.data.summary.length,
      iflowsCount: response.data.iflows.length
    });
    
    return response;
  } catch (error) {
    logger.error('❌ Error in getSecurityInfo:', { 
      error: error.message, 
      stack: error.stack,
      query 
    });
    throw new Error(`Failed to get security information: ${error.message}`);
  }
}
  /**
   * Get error handling information based on the query
   * @param {string} query - The normalized query
   * @returns {Promise<Object>} - The error handling information
   */
  async getErrorInfo(query) {
    try {
      // Check if query is about iFlows with error handling issues
      const isAboutIssues = query.includes('issue') || 
                           query.includes('problem') || 
                           query.includes('missing');
      
      if (isAboutIssues) {
        // Find iFlows with error handling issues
        const iflowsWithIssues = await models.Iflow.findAll({
          include: [
            {
              model: models.ErrorHandling,
              where: {
                [Op.or]: [
                  { detection_enabled: false },
                  { logging_enabled: false },
                  { classification_enabled: false },
                  { reporting_enabled: false }
                ]
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
        
        return {
          type: 'error_handling_issues',
          message: 'Here are the integration flows with error handling issues:',
          data: iflowsWithIssues.map(iflow => ({
            id: iflow.iflow_id,
            name: iflow.iflow_name,
            package: iflow.package ? iflow.package.package_name : 'Unknown',
            error_handling: {
              detection_enabled: iflow.error_handling.detection_enabled,
              logging_enabled: iflow.error_handling.logging_enabled,
              classification_enabled: iflow.error_handling.classification_enabled,
              reporting_enabled: iflow.error_handling.reporting_enabled
            }
          }))
        };
      } else {
        // Get failed iFlows
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
        
        return {
          type: 'failed_iflows',
          message: 'Here are the integration flows with failures:',
          data: failedIflows.map(iflow => ({
            id: iflow.iflow_id,
            name: iflow.iflow_name,
            package: iflow.package ? iflow.package.package_name : 'Unknown',
            status: iflow.deployment_infos[0].status,
            error: iflow.deployment_infos[0].error_information
          }))
        };
      }
    } catch (error) {
      logger.error('Error getting error info', { error: error.message, stack: error.stack });
      throw new Error(`Failed to get error information: ${error.message}`);
    }
  }
  
  /**
   * Get performance information based on the query
   * @param {string} query - The normalized query
   * @returns {Promise<Object>} - The performance information
   */
  async getPerformanceInfo(query) {
    try {
      // Check if query is about average processing time
      const isAboutAverage = query.includes('average') || query.includes('avg');
      const isAboutLastWeek = query.includes('last week') || query.includes('past week');
      
      // Get performance information
      let performanceQuery = {
        attributes: ['iflow_id', 'iflow_name'],
        include: [
          {
            model: models.RuntimeInfo,
            attributes: ['avg_processing_time', 'success_count', 'failure_count', 'last_execution_time'],
            required: false
          },
          {
            model: models.Package,
            attributes: ['package_name']
          }
        ],
        order: [[{ model: models.RuntimeInfo, as: 'runtime_info' }, 'avg_processing_time', 'DESC']]
      };
      
      // Add time filter if query is about last week
      if (isAboutLastWeek) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        performanceQuery.include[0].where = {
          last_execution_time: { [Op.gte]: oneWeekAgo }
        };
        performanceQuery.include[0].required = true;
      }
      
      const performanceInfo = await models.Iflow.findAll(performanceQuery);
      
      // Calculate average processing time across all iFlows if requested
      let averageProcessingTime = null;
      if (isAboutAverage) {
        const validTimes = performanceInfo
          .filter(iflow => iflow.runtime_info && iflow.runtime_info.avg_processing_time)
          .map(iflow => iflow.runtime_info.avg_processing_time);
        
        if (validTimes.length > 0) {
          averageProcessingTime = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
        }
      }
      
      // Format the response
      let message = 'Here are the performance metrics for integration flows:';
      if (isAboutAverage && isAboutLastWeek) {
        message = 'Here is the average message processing time for integration flows in the last week:';
      } else if (isAboutAverage) {
        message = 'Here is the average message processing time for all integration flows:';
      } else if (isAboutLastWeek) {
        message = 'Here are the performance metrics for integration flows in the last week:';
      }
      
      return {
        type: 'performance_info',
        message,
        data: {
          average_processing_time: averageProcessingTime,
          iflows: performanceInfo.map(iflow => ({
            id: iflow.iflow_id,
            name: iflow.iflow_name,
            package: iflow.package ? iflow.package.package_name : 'Unknown',
            avg_processing_time: iflow.runtime_info ? iflow.runtime_info.avg_processing_time : null,
            success_count: iflow.runtime_info ? iflow.runtime_info.success_count : 0,
            failure_count: iflow.runtime_info ? iflow.runtime_info.failure_count : 0,
            last_execution: iflow.runtime_info ? iflow.runtime_info.last_execution_time : null
          }))
        }
      };
    } catch (error) {
      logger.error('Error getting performance info', { error: error.message, stack: error.stack });
      throw new Error(`Failed to get performance information: ${error.message}`);
    }
  }
  
  /**
   * Get system composition information based on the query
   * @param {string} query - The normalized query
   * @returns {Promise<Object>} - The system composition information
   */
  async getSystemCompositionInfo(query) {
    try {
      // Extract specific composition type if mentioned
      const compositionTypes = ['sap2sap', 'sap to sap', 'sap2nonsap', 'sap to non-sap', 'nonsap2nonsap', 'non-sap to non-sap'];
      let specificComposition = null;
      
      for (const type of compositionTypes) {
        if (query.includes(type)) {
          if (type === 'sap to sap') specificComposition = 'SAP2SAP';
          else if (type === 'sap to non-sap') specificComposition = 'SAP2NONSAP';
          else if (type === 'non-sap to non-sap') specificComposition = 'NONSAP2NONSAP';
          else specificComposition = type.toUpperCase();
          break;
        }
      }
      
      // Count iFlows by system composition - FIXED QUERY
      const compositionCounts = await models.Iflow.findAll({
        attributes: [
          'systems_composition',
          [Sequelize.fn('COUNT', Sequelize.col('iflow_id')), 'count']
        ],
        where: {
          systems_composition: { [Op.ne]: null }
        },
        group: ['systems_composition'],
        raw: true
      });
      
      // Get iFlows with specific system composition if mentioned - FIXED QUERY
      let iflowsQuery = {
        attributes: ['iflow_id', 'iflow_name', 'systems_composition'],
        include: [
          {
            model: models.Package,
            attributes: ['package_name']
          }
        ],
        where: {
          systems_composition: { [Op.ne]: null }
        },
        order: [['iflow_name', 'ASC']]
      };
      
      if (specificComposition) {
        iflowsQuery.where.systems_composition = { [Op.iLike]: `%${specificComposition}%` };
      }
      
      const iflows = await models.Iflow.findAll(iflowsQuery);
      
      // Format the response
      let message = 'Here is the system composition information for integration flows:';
      if (specificComposition) {
        message = `Here are the integration flows with ${specificComposition} system composition:`;
      }
      
      return {
        type: 'system_composition_info',
        message,
        data: {
          summary: compositionCounts,
          iflows: iflows.map(iflow => ({
            id: iflow.iflow_id,
            name: iflow.iflow_name,
            package: iflow.package ? iflow.package.package_name : 'Unknown',
            systems_composition: iflow.systems_composition
          }))
        }
      };
    } catch (error) {
      logger.error('Error getting system composition info', { error: error.message, stack: error.stack });
      throw new Error(`Failed to get system composition information: ${error.message}`);
    }
  }
  
  /**
   * Get adapter information based on the query
   * @param {string} query - The normalized query
   * @returns {Promise<Object>} - The adapter information
   */
  async getAdapterInfo(query) {
    try {
      // Extract specific adapter type if mentioned
      const adapterTypes = ['http', 'soap', 'rest', 'odata', 'jdbc', 'jms', 'sftp', 'file', 'mail', 'idoc', 'rfc'];
      let specificAdapter = null;
      
      for (const type of adapterTypes) {
        if (query.includes(type)) {
          specificAdapter = type.toUpperCase();
          break;
        }
      }
      
      // Count iFlows by adapter type - FIXED QUERY
      const adapterCounts = await models.Adapter.findAll({
        attributes: [
          'adapter_type',
          [Sequelize.fn('COUNT', Sequelize.col('iflow_adapters.iflow_id')), 'count']
        ],
        include: [
          {
            model: models.IflowAdapter,
            attributes: [],
            required: false
          }
        ],
        group: ['adapter.adapter_id', 'adapter_type'],
        raw: true
      });
      
      // Get iFlows with adapters - FIXED QUERY
      let iflowsWithAdaptersQuery = {
        attributes: ['iflow_id', 'iflow_name'],
        include: [
          {
            model: models.IflowAdapter,
            include: [
              {
                model: models.Adapter,
                attributes: ['adapter_name', 'adapter_type'],
                where: specificAdapter ? {
                  adapter_type: { [Op.iLike]: `%${specificAdapter}%` }
                } : undefined
              }
            ],
            required: true
          },
          {
            model: models.Package,
            attributes: ['package_name']
          }
        ],
        order: [['iflow_name', 'ASC']]
      };
      
      const iflowsWithAdapters = await models.Iflow.findAll(iflowsWithAdaptersQuery);
      
      // Format the response
      let message = 'Here is the adapter usage information:';
      if (specificAdapter) {
        message = `Here are the integration flows using the ${specificAdapter} adapter:`;
      }
      
      return {
        type: 'adapter_info',
        message,
        data: {
          summary: adapterCounts,
          iflows: iflowsWithAdapters.map(iflow => ({
            id: iflow.iflow_id,
            name: iflow.iflow_name,
            package: iflow.package ? iflow.package.package_name : 'Unknown',
            adapters: iflow.iflow_adapters.map(adapter => ({
              name: adapter.adapter.adapter_name,
              type: adapter.adapter.adapter_type,
              direction: adapter.direction
            }))
          }))
        }
      };
    } catch (error) {
      logger.error('Error getting adapter info', { error: error.message, stack: error.stack });
      throw new Error(`Failed to get adapter information: ${error.message}`);
    }
  }
  
  /**
   * Get information about a specific iFlow
   * @param {string} iflowName - The name of the iFlow
   * @returns {Promise<Object>} - The iFlow information
   */
  async getIflowInfo(iflowName) {
    try {
      const iflow = await models.Iflow.findOne({
        where: {
          iflow_name: { [Op.iLike]: `%${iflowName}%` }
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
      
      if (!iflow) {
        return {
          type: 'not_found',
          message: `I couldn't find an integration flow named "${iflowName}".`,
          data: null
        };
      }
      
      return {
        type: 'iflow_info',
        message: `Here is the information for integration flow "${iflow.iflow_name}":`,
        data: iflow
      };
    } catch (error) {
      logger.error('Error getting iFlow info', { error: error.message, stack: error.stack });
      throw new Error(`Failed to get iFlow information: ${error.message}`);
    }
  }
  
  /**
   * Process the query using OpenAI for more complex queries
   * @param {string} query - The original query
   * @returns {Promise<Object>} - The processed response
   */
  async processWithOpenAI(query) {
    try {
      // Define the system message to guide the AI
      const systemMessage = `
        You are an AI assistant specialized in SAP Integration Suite. 
        Your task is to analyze the user's query about SAP Integration Suite and extract the following information:
        1. The main entity of interest (iFlow, adapter, security mechanism, etc.)
        2. The specific attribute or metric being queried
        3. Any filters or conditions mentioned
        4. The type of query (count, list, average, etc.)
        
        Format your response as a JSON object with the following structure:
        {
          "entity": "the main entity being queried",
          "attribute": "the specific attribute or metric",
          "filters": [{"field": "field name", "value": "filter value"}],
          "queryType": "count|list|average|etc"
        }
        
        Only respond with the JSON object, nothing else.
      `;
      
      // Call OpenAI API to analyze the query
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: query }
        ],
        temperature: 0.3,
        max_tokens: 500
      });
      
      // Parse the response
      const content = response.choices[0].message.content;
      let parsedResponse;
      
      try {
        parsedResponse = JSON.parse(content);
      } catch (error) {
        logger.error('Error parsing OpenAI response', { error: error.message, content });
        throw new Error('Failed to parse OpenAI response');
      }
      
      // Execute the appropriate query based on the parsed response
      return await this.executeStructuredQuery(parsedResponse, query);
    } catch (error) {
      logger.error('Error processing with OpenAI', { error: error.message, stack: error.stack });
      
      // Fallback to a generic search
      return await this.fallbackSearch(query);
    }
  }
  
  /**
   * Execute a structured query based on the parsed OpenAI response
   * @param {Object} parsedQuery - The parsed query structure
   * @param {string} originalQuery - The original query text
   * @returns {Promise<Object>} - The query results
   */
  async executeStructuredQuery(parsedQuery, originalQuery) {
    try {
      const { entity, attribute, filters, queryType } = parsedQuery;
      
      // Map entity to model
      const entityModelMap = {
        'iflow': models.Iflow,
        'adapter': models.Adapter,
        'security': models.SecurityMechanism,
        'deployment': models.DeploymentInfo,
        'runtime': models.RuntimeInfo,
        'error': models.ErrorHandling,
        'persistence': models.Persistence
      };
      
      // Determine the base model and related includes
      let baseModel = entityModelMap[entity.toLowerCase()] || models.Iflow;
      let includes = [];
      let where = {};
      
      // Build the query based on the entity and query type
      let queryResult;
      
      switch (entity.toLowerCase()) {
        case 'iflow':
          includes = [
            { model: models.Package, attributes: ['package_name'] },
            { model: models.DeploymentInfo }
          ];
          
          if (attribute === 'security' || attribute.includes('auth')) {
            includes.push({
              model: models.IflowSecurity,
              include: [{ 
                model: models.SecurityMechanism,
                where: filters && filters.length > 0 ? 
                  { mechanism_type: { [Op.iLike]: `%${filters[0].value}%` } } : undefined
              }],
              required: filters && filters.length > 0 // Only require if filtering
            });
            
            // Remove the where clause from the main query since we're filtering through the join
            where = {};
          } else if (attribute === 'adapter') {
            includes.push({
              model: models.IflowAdapter,
              include: [{ model: models.Adapter }]
            });
          } else if (attribute === 'error' || attribute.includes('error')) {
            includes.push({ model: models.ErrorHandling });
          } else if (attribute === 'performance' || attribute.includes('time')) {
            includes.push({ model: models.RuntimeInfo });
          }
          
          // Apply other non-security filters to the main where clause
          if (filters && filters.length > 0 && attribute !== 'security' && !attribute.includes('auth')) {
            filters.forEach(filter => {
              if (filter.field && filter.value) {
                // Map filter fields to actual iflow table columns
                const fieldMapping = {
                  'deployment_model': 'deployment_model',
                  'systems_composition': 'systems_composition',
                  'iflow_type': 'iflow_type',
                  'name': 'iflow_name',
                  'description': 'iflow_description'
                };
                
                const actualField = fieldMapping[filter.field] || filter.field;
                if (actualField) {
                  where[actualField] = { [Op.iLike]: `%${filter.value}%` };
                }
              }
            });
          }
          
          queryResult = await models.Iflow.findAll({
            where,
            include: includes,
            order: [['iflow_name', 'ASC']]
          });
          break;
          
        case 'adapter':
          if (queryType === 'count') {
            queryResult = await models.Adapter.findAll({
              attributes: [
                'adapter_type',
                [Sequelize.fn('COUNT', Sequelize.col('iflow_adapters.iflow_id')), 'count']
              ],
              include: [{ model: models.IflowAdapter, attributes: [] }],
              group: ['adapter.adapter_id', 'adapter_type'],
              raw: true
            });
          } else {
            queryResult = await models.Adapter.findAll({
              where,
              include: [{ model: models.IflowAdapter, include: [{ model: models.Iflow }] }]
            });
          }
          break;
          
        // Add more cases for other entities as needed
          
        default:
          // Default to searching iFlows
          queryResult = await models.Iflow.findAll({
            where: {
              [Op.or]: [
                { iflow_name: { [Op.iLike]: `%${originalQuery}%` } },
                { iflow_description: { [Op.iLike]: `%${originalQuery}%` } }
              ]
            },
            include: [
              { model: models.Package, attributes: ['package_name'] },
              { model: models.DeploymentInfo }
            ],
            order: [['iflow_name', 'ASC']]
          });
      }
      
      // Format the response based on the query type and results
      return {
        type: 'structured_query_result',
        message: `Here are the results for your query about ${entity} ${attribute || ''}:`,
        data: queryResult
      };
    } catch (error) {
      logger.error('Error executing structured query', { error: error.message, stack: error.stack });
      return await this.fallbackSearch(originalQuery);
    }
  }
  
  /**
   * Fallback search when other methods fail
   * @param {string} query - The original query
   * @returns {Promise<Object>} - The search results
   */
  async fallbackSearch(query) {
    try {
      // Extract search terms
      const terms = query.split(/\s+/).filter(term => term.length > 2);
      
      if (terms.length === 0) {
        return {
          type: 'no_results',
          message: "I couldn't understand your query. Please try a different query.",
          data: null
        };
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
      
      if (iflows.length > 0) {
        return {
          type: 'search_results',
          message: 'Here are the integration flows that match your query:',
          data: iflows.map(iflow => ({
            id: iflow.iflow_id,
            name: iflow.iflow_name,
            description: iflow.iflow_description,
            package: iflow.package ? iflow.package.package_name : 'Unknown',
            status: iflow.deployment_info ? iflow.deployment_info.status : 'Unknown'
          }))
        };
      } else {
        return {
          type: 'no_results',
          message: "I couldn't find any integration flows matching your query. Please try a different query.",
          data: null
        };
      }
    } catch (error) {
      logger.error('Error in fallback search', { error: error.message, stack: error.stack });
      throw new Error(`Failed to search: ${error.message}`);
    }
  }
}

module.exports = new NLPService();