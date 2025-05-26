// debug-database-data.js - Script to check database content
const models = require('../src/models');
const logger = require('../src/utils/logger');

async function debugDatabaseData() {
  try {
    console.log('🔍 Debugging database data...\n');

    // Check if database tables exist and have data
    const tableChecks = [
      { name: 'Tenants', model: models.Tenant },
      { name: 'Packages', model: models.Package },
      { name: 'iFlows', model: models.Iflow },
      { name: 'Security Mechanisms', model: models.SecurityMechanism },
      { name: 'iFlow Security Relations', model: models.IflowSecurity },
      { name: 'Adapters', model: models.Adapter },
      { name: 'iFlow Adapter Relations', model: models.IflowAdapter },
      { name: 'Deployment Info', model: models.DeploymentInfo },
      { name: 'Runtime Info', model: models.RuntimeInfo }
    ];

    console.log('📊 TABLE DATA COUNTS:');
    console.log('=====================');
    
    for (const check of tableChecks) {
      try {
        const count = await check.model.count();
        const status = count > 0 ? '✅' : '❌';
        console.log(`${status} ${check.name}: ${count} records`);
        
        // Show sample data for tables with records
        if (count > 0 && count <= 5) {
          const samples = await check.model.findAll({
            limit: 3,
            attributes: { exclude: ['created_at', 'updated_at'] }
          });
          console.log(`   Sample records:`, samples.map(s => {
            const plain = s.get({ plain: true });
            const keys = Object.keys(plain);
            const sample = {};
            // Show only first few key fields
            keys.slice(0, 3).forEach(key => {
              sample[key] = plain[key];
            });
            return sample;
          }));
        }
      } catch (error) {
        console.log(`❌ ${check.name}: Error - ${error.message}`);
      }
    }

    console.log('\n🔗 RELATIONSHIP CHECKS:');
    console.log('========================');

    // Check specific relationships
    try {
      const iflowsWithSecurity = await models.Iflow.findAll({
        include: [
          {
            model: models.IflowSecurity,
            include: [{ model: models.SecurityMechanism }]
          }
        ],
        limit: 3
      });
      
      const securityCount = iflowsWithSecurity.reduce((sum, iflow) => 
        sum + (iflow.iflow_securities ? iflow.iflow_securities.length : 0), 0);
      
      console.log(`✅ iFlows with Security: ${iflowsWithSecurity.length} iFlows, ${securityCount} security relations`);
      
      if (iflowsWithSecurity.length > 0) {
        console.log('   Sample:', {
          iflow: iflowsWithSecurity[0].iflow_name,
          securities: iflowsWithSecurity[0].iflow_securities.map(s => s.security_mechanism?.mechanism_type)
        });
      }
    } catch (error) {
      console.log(`❌ iFlows with Security: Error - ${error.message}`);
    }

    try {
      const iflowsWithAdapters = await models.Iflow.findAll({
        include: [
          {
            model: models.IflowAdapter,
            include: [{ model: models.Adapter }]
          }
        ],
        limit: 3
      });
      
      const adapterCount = iflowsWithAdapters.reduce((sum, iflow) => 
        sum + (iflow.iflow_adapters ? iflow.iflow_adapters.length : 0), 0);
      
      console.log(`✅ iFlows with Adapters: ${iflowsWithAdapters.length} iFlows, ${adapterCount} adapter relations`);
      
      if (iflowsWithAdapters.length > 0) {
        console.log('   Sample:', {
          iflow: iflowsWithAdapters[0].iflow_name,
          adapters: iflowsWithAdapters[0].iflow_adapters.map(a => a.adapter?.adapter_type)
        });
      }
    } catch (error) {
      console.log(`❌ iFlows with Adapters: Error - ${error.message}`);
    }

    console.log('\n🧪 NLP QUERY SIMULATION:');
    console.log('=========================');

    // Simulate the actual NLP queries
    try {
      console.log('Testing Security Query...');
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
      
      console.log(`✅ Security Counts Query: ${securityCounts.length} result(s)`);
      if (securityCounts.length > 0) {
        console.log('   Results:', securityCounts);
      }
    } catch (error) {
      console.log(`❌ Security Counts Query: Error - ${error.message}`);
    }

    console.log('\n📋 RECOMMENDATIONS:');
    console.log('====================');

    const totalIflows = await models.Iflow.count();
    const totalSecurityMechanisms = await models.SecurityMechanism.count();
    const totalAdapters = await models.Adapter.count();

    if (totalIflows === 0) {
      console.log('🚨 NO IFLOWS FOUND - Run data synchronization first:');
      console.log('   POST /api/sync');
      console.log('   OR set RUN_INITIAL_SYNC=true in .env and restart');
    } else if (totalSecurityMechanisms === 0) {
      console.log('🚨 NO SECURITY MECHANISMS FOUND - Check data processing:');
      console.log('   1. Verify SAP API returns security data');
      console.log('   2. Check XML parsing in dataFetchService');
      console.log('   3. Run sync with specific package: POST /api/sync');
    } else if (totalAdapters === 0) {
      console.log('🚨 NO ADAPTERS FOUND - Check adapter extraction:');
      console.log('   1. Verify iFlow XML contains adapter information');
      console.log('   2. Check adapterExtractor logic');
    } else {
      console.log('✅ Database seems populated. NLP queries should work.');
      console.log('   Try these test queries:');
      console.log('   - "Show me all security mechanisms"');
      console.log('   - "List all adapters"');
      console.log('   - "Show me all iFlows"');
    }

    console.log('\n🔧 NEXT STEPS:');
    console.log('===============');
    console.log('1. If no data: Run manual sync with: node debugFlow.js');
    console.log('2. If data exists but NLP fails: Check NLP response format');
    console.log('3. Check SAP API connectivity and credentials');
    console.log('4. Review logs for data processing errors');

  } catch (error) {
    console.error('❌ Debug script failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run debug if this script is executed directly
if (require.main === module) {
  debugDatabaseData().then(() => {
    console.log('\n✅ Debug completed!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Debug execution failed:', error);
    process.exit(1);
  });
}

module.exports = { debugDatabaseData };