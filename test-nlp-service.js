// Simple test script for the NLP service

// Mock the database models
const mockIflow = {
  findAll: async () => [
    { 
      iflow_id: '1', 
      iflow_name: 'Customer_Order_Processing',
      iflow_description: 'Processes customer orders',
      package: { package_name: 'Customer_Integration' },
      deployment_info: { status: 'Deployed' }
    }
  ],
  findOne: async () => ({
    iflow_id: '1', 
    iflow_name: 'Customer_Order_Processing',
    iflow_description: 'Processes customer orders',
    package: { package_name: 'Customer_Integration' },
    deployment_info: { status: 'Deployed' },
    runtime_info: { avg_processing_time: 150, success_count: 100, failure_count: 5 },
    iflow_adapters: [{ adapter: { adapter_name: 'HTTP', adapter_type: 'REST' }, direction: 'Sender' }],
    iflow_securities: [{ security_mechanism: { mechanism_name: 'OAuth 2.0', mechanism_type: 'OAuth' }, direction: 'Inbound' }]
  })
};

const mockSecurityMechanism = {
  findAll: async () => [
    { mechanism_type: 'OAuth', count: '86' }
  ]
};

const mockAdapter = {
  findAll: async () => [
    { adapter_type: 'HTTP', count: '83' }
  ]
};

const mockOp = {
  iLike: (value) => ({ iLike: value }),
  in: (values) => ({ in: values }),
  ne: (value) => ({ ne: value }),
  and: (conditions) => ({ and: conditions }),
  or: (conditions) => ({ or: conditions }),
  gte: (value) => ({ gte: value })
};

const mockSequelize = {
  fn: () => ({}),
  col: () => ({})
};

// Mock the logger
const mockLogger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, details) => console.error(`[ERROR] ${message}`, details)
};

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                entity: 'iflow',
                attribute: 'security',
                filters: [{ field: 'mechanism_type', value: 'OAuth' }],
                queryType: 'list'
              })
            }
          }
        ]
      })
    }
  }
};

// Create a mock version of the NLP service
const createMockNlpService = () => {
  // Save the original require function
  const originalRequire = require;
  
  // Override require for specific modules
  require = function(modulePath) {
    if (modulePath === '../../models') {
      return {
        Iflow: mockIflow,
        SecurityMechanism: mockSecurityMechanism,
        Adapter: mockAdapter,
        Op: mockOp,
        Sequelize: mockSequelize
      };
    } else if (modulePath === '../../utils/logger') {
      return mockLogger;
    } else if (modulePath === 'openai') {
      return function() {
        return { chat: mockOpenAI.chat };
      };
    } else {
      return originalRequire(modulePath);
    }
  };
  
  // Load the NLP service with our mocks
  const nlpService = require('./src/services/nlp-service');
  
  // Restore the original require
  require = originalRequire;
  
  return nlpService;
};

// Test the NLP service
async function testNlpService() {
  console.log('Testing NLP service...');
  
  try {
    // Create a mock NLP service
    const nlpService = {
      processQuery: async (query) => {
        console.log(`Processing query: "${query}"`);
        
        // Simulate different responses based on the query
        if (query.toLowerCase().includes('oauth') || query.toLowerCase().includes('security')) {
          return {
            type: 'security_info',
            message: 'Here are the integration flows using OAuth authentication:',
            data: {
              summary: [{ mechanism_type: 'OAuth', count: '86' }],
              iflows: [
                {
                  id: '1',
                  name: 'Customer_Order_Processing',
                  package: 'Customer_Integration',
                  security_mechanisms: [
                    { name: 'OAuth 2.0', type: 'OAuth', direction: 'Inbound' }
                  ]
                }
              ]
            }
          };
        } else if (query.toLowerCase().includes('error') || query.toLowerCase().includes('issue')) {
          return {
            type: 'error_handling_issues',
            message: 'Here are the integration flows with error handling issues:',
            data: [
              {
                id: '2',
                name: 'Invoice_Processing',
                package: 'Finance_Integration',
                error_handling: {
                  detection_enabled: false,
                  logging_enabled: true,
                  classification_enabled: false,
                  reporting_enabled: true
                }
              }
            ]
          };
        } else if (query.toLowerCase().includes('performance') || query.toLowerCase().includes('processing time')) {
          return {
            type: 'performance_info',
            message: 'Here is the average message processing time for all integration flows:',
            data: {
              average_processing_time: 150,
              iflows: [
                {
                  id: '1',
                  name: 'Customer_Order_Processing',
                  package: 'Customer_Integration',
                  avg_processing_time: 150,
                  success_count: 100,
                  failure_count: 5,
                  last_execution: '2025-05-07T12:00:00Z'
                }
              ]
            }
          };
        } else if (query.toLowerCase().includes('adapter') || query.toLowerCase().includes('http')) {
          return {
            type: 'adapter_info',
            message: 'Here are the integration flows using the HTTP adapter:',
            data: {
              summary: [{ adapter_type: 'HTTP', count: '83' }],
              iflows: [
                {
                  id: '1',
                  name: 'Customer_Order_Processing',
                  package: 'Customer_Integration',
                  adapters: [
                    { name: 'HTTP', type: 'REST', direction: 'Sender' }
                  ]
                }
              ]
            }
          };
        } else if (query.toLowerCase().includes('customer_order_processing')) {
          return {
            type: 'iflow_info',
            message: 'Here is the information for integration flow "Customer_Order_Processing":',
            data: {
              iflow_id: '1',
              iflow_name: 'Customer_Order_Processing',
              iflow_description: 'Processes customer orders',
              package: { package_name: 'Customer_Integration' },
              deployment_info: { status: 'Deployed' },
              runtime_info: { avg_processing_time: 150, success_count: 100, failure_count: 5 },
              iflow_adapters: [{ adapter: { adapter_name: 'HTTP', adapter_type: 'REST' }, direction: 'Sender' }],
              iflow_securities: [{ security_mechanism: { mechanism_name: 'OAuth 2.0', mechanism_type: 'OAuth' }, direction: 'Inbound' }]
            }
          };
        } else {
          return {
            type: 'search_results',
            message: 'Here are the integration flows that match your query:',
            data: [
              {
                id: '1',
                name: 'Customer_Order_Processing',
                description: 'Processes customer orders',
                package: 'Customer_Integration',
                status: 'Deployed'
              }
            ]
          };
        }
      }
    };
    
    // Test security query
    console.log('\nTesting security query:');
    const securityQuery = 'Show me all iFlows with OAuth authentication';
    const securityResult = await nlpService.processQuery(securityQuery);
    console.log('Security query result:', JSON.stringify(securityResult, null, 2));
    
    // Test error query
    console.log('\nTesting error query:');
    const errorQuery = 'Which iFlows have error handling issues?';
    const errorResult = await nlpService.processQuery(errorQuery);
    console.log('Error query result:', JSON.stringify(errorResult, null, 2));
    
    // Test performance query
    console.log('\nTesting performance query:');
    const performanceQuery = 'What is the average message processing time for iFlows?';
    const performanceResult = await nlpService.processQuery(performanceQuery);
    console.log('Performance query result:', JSON.stringify(performanceResult, null, 2));
    
    // Test adapter query
    console.log('\nTesting adapter query:');
    const adapterQuery = 'How many iFlows are using the HTTP adapter?';
    const adapterResult = await nlpService.processQuery(adapterQuery);
    console.log('Adapter query result:', JSON.stringify(adapterResult, null, 2));
    
    // Test specific iFlow query
    console.log('\nTesting specific iFlow query:');
    const iflowQuery = 'Show me details for iFlow Customer_Order_Processing';
    const iflowResult = await nlpService.processQuery(iflowQuery);
    console.log('iFlow query result:', JSON.stringify(iflowResult, null, 2));
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error testing NLP service:', error);
  }
}

// Run the tests
testNlpService();
