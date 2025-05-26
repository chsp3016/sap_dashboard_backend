// nlp-debug-workflow.js - Complete debugging workflow for NLP service
const models = require('../src/models');
const nlpService = require('../src/services/nlp-service');
const logger = require('../src/utils/logger');

async function runCompleteNLPDebug() {
  console.log('🔧 COMPLETE NLP SERVICE DEBUG WORKFLOW');
  console.log('=======================================\n');

  try {
    // Step 1: Check database connectivity
    console.log('1️⃣ CHECKING DATABASE CONNECTIVITY...');
    await models.sequelize.authenticate();
    console.log('✅ Database connected successfully\n');

    // Step 2: Check table data
    console.log('2️⃣ CHECKING TABLE DATA...');
    const counts = {
      tenants: await models.Tenant.count(),
      packages: await models.Package.count(),
      iflows: await models.Iflow.count(),
      securityMechanisms: await models.SecurityMechanism.count(),
      iflowSecurity: await models.IflowSecurity.count(),
      adapters: await models.Adapter.count(),
      iflowAdapters: await models.IflowAdapter.count()
    };

    console.log('📊 Data counts:', counts);

    const hasData = counts.iflows > 0 && counts.securityMechanisms > 0;
    console.log(`${hasData ? '✅' : '❌'} Database has ${hasData ? 'sufficient' : 'insufficient'} data\n`);

    if (!hasData) {
      console.log('🚨 INSUFFICIENT DATA DETECTED');
      console.log('Options:');
      console.log('  A) Run: node insert-test-data.js');
      console.log('  B) Run: POST /api/sync');
      console.log('  C) Check your SAP API connectivity and credentials\n');
      
      console.log('Would you like to insert test data? (This script will do it automatically in 5 seconds...)');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('🎯 INSERTING TEST DATA...');
      await insertMinimalTestData();
      console.log('✅ Test data inserted\n');
    }

    // Step 3: Test raw SQL queries
    console.log('3️⃣ TESTING RAW SQL QUERIES...');
    
    // Test security mechanisms query
    const securityCounts = await models.SecurityMechanism.findAll({
      attributes: [
        'mechanism_type',
        [models.sequelize.fn('COUNT', models.sequelize.col('iflow_securities.iflow_id')), 'count']
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
    
    console.log('🔍 Security counts query result:', securityCounts);

    // Test iFlows with security query
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
          ],
          required: true
        },
        {
          model: models.Package,
          attributes: ['package_name']
        }
      ],
      order: [['iflow_name', 'ASC']],
      limit: 5
    });
    
    console.log('🔍 iFlows with security query result count:', iflowsWithSecurity.length);
    if (iflowsWithSecurity.length > 0) {
      console.log('Sample result:', {
        name: iflowsWithSecurity[0].iflow_name,
        securities: iflowsWithSecurity[0].iflow_securities.map(s => s.security_mechanism.mechanism_type)
      });
    }
    console.log('');

    // Step 4: Test NLP service directly
    console.log('4️⃣ TESTING NLP SERVICE DIRECTLY...');
    
    const testQueries = [
      'list all security mechanisms',
      'show me OAuth authentication',
      'get me all adapters',
      'show all iflows'
    ];

    for (const query of testQueries) {
      console.log(`\n🧪 Testing query: "${query}"`);
      try {
        const result = await nlpService.processQuery(query);
        console.log('✅ Query successful');
        console.log('Response type:', result.type);
        console.log('Message:', result.message);
        
        if (result.data) {
          if (result.data.summary) {
            console.log('Summary count:', result.data.summary.length);
          }
          if (result.data.iflows) {
            console.log('iFlows count:', result.data.iflows.length);
          }
          if (Array.isArray(result.data)) {
            console.log('Data array length:', result.data.length);
          }
        }
      } catch (error) {
        console.log('❌ Query failed:', error.message);
      }
    }

    // Step 5: Test API endpoint directly
    console.log('\n5️⃣ TESTING API ENDPOINT...');
    console.log('Try these curl commands:');
    console.log(`curl -X POST http://localhost:3000/api/nlp/query -H "Content-Type: application/json" -d '{"query": "list all security mechanisms"}'`);
    console.log(`curl -X POST http://localhost:3000/api/nlp/query -H "Content-Type: application/json" -d '{"query": "show me OAuth authentication"}'`);

    console.log('\n✅ DEBUG WORKFLOW COMPLETED!');
    console.log('If NLP queries still return no results, check:');
    console.log('1. Frontend/client request format');
    console.log('2. API response handling');
    console.log('3. Network connectivity');

  } catch (error) {
    console.error('❌ Debug workflow failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function insertMinimalTestData() {
  // Create minimal test data for NLP testing
  const [tenant] = await models.Tenant.findOrCreate({
    where: { tenant_name: 'Test Tenant' },
    defaults: {
      tenant_url: 'https://test.sap.com',
      oauth_config: {}
    }
  });

  const [package1] = await models.Package.findOrCreate({
    where: { package_id: 'TEST_PKG' },
    defaults: {
      tenant_id: tenant.tenant_id,
      package_name: 'Test Package',
      package_description: 'Test package for NLP'
    }
  });

  const [iflow] = await models.Iflow.findOrCreate({
    where: { iflow_id: 'TEST_IFLOW' },
    defaults: {
      package_id: package1.package_id,
      iflow_name: 'Test Integration Flow',
      iflow_description: 'Test iFlow for NLP service',
      systems_composition: 'SAP2SAP',
      deployment_model: 'Cloud to Cloud'
    }
  });

  const [secMech] = await models.SecurityMechanism.findOrCreate({
    where: { mechanism_name: 'OAuth Test' },
    defaults: {
      mechanism_type: 'OAuth'
    }
  });

  await models.IflowSecurity.findOrCreate({
    where: {
      iflow_id: iflow.iflow_id,
      security_mechanism_id: secMech.security_mechanism_id
    },
    defaults: {
      direction: 'Inbound',
      configuration: {}
    }
  });

  const [adapter] = await models.Adapter.findOrCreate({
    where: { adapter_name: 'HTTP Test' },
    defaults: {
      adapter_type: 'HTTP',
      adapter_category: 'Receiver'
    }
  });

  await models.IflowAdapter.findOrCreate({
    where: {
      iflow_id: iflow.iflow_id,
      adapter_id: adapter.adapter_id
    },
    defaults: {
      direction: 'Receiver',
      configuration: {}
    }
  });

  console.log('✅ Minimal test data created');
}

// Run if this script is executed directly
if (require.main === module) {
  runCompleteNLPDebug().then(() => {
    console.log('\n🎉 Debug workflow completed!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Debug workflow failed:', error);
    process.exit(1);
  });
}

module.exports = { runCompleteNLPDebug };