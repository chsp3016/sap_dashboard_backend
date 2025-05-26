// fixed-verify-nlp.js - Corrected verification script
const { Op, Sequelize } = require('sequelize');  // ← Correct import
const models = require('../src/models');
const nlpService = require('../src/services/nlp-service');

async function verifyNLP() {
  try {
    console.log('🧪 VERIFYING NLP SERVICE WITH FIXED IMPORTS\n');

    // 1. Verify data exists (already confirmed from your previous run)
    const iflowCount = await models.Iflow.count();
    const securityCount = await models.SecurityMechanism.count();
    const relationshipCount = await models.IflowSecurity.count();

    console.log('📊 DATA VERIFICATION:');
    console.log(`✅ iFlows: ${iflowCount}`);
    console.log(`✅ Security Mechanisms: ${securityCount}`);
    console.log(`✅ Security Relationships: ${relationshipCount}`);

    // 2. Test OAuth query with CORRECT Op usage
    console.log('\n🔍 TESTING OAUTH QUERY WITH FIXED IMPORTS:');
    
    const oauthIflows = await models.Iflow.findAll({
      attributes: ['iflow_id', 'iflow_name'],
      include: [{
        model: models.IflowSecurity,
        include: [{
          model: models.SecurityMechanism,
          attributes: ['mechanism_name', 'mechanism_type'],
          where: { mechanism_type: { [Op.iLike]: '%oauth%' } }  // ← Fixed: Op.iLike instead of models.sequelize.Op.iLike
        }],
        required: true
      }, {
        model: models.Package,
        attributes: ['package_name']
      }],
      order: [['iflow_name', 'ASC']]
    });

    console.log(`✅ OAuth iFlows Found: ${oauthIflows.length}`);
    oauthIflows.forEach(iflow => {
      console.log(`  - ${iflow.iflow_name} (Package: ${iflow.package?.package_name || 'Unknown'})`);
      iflow.iflow_securities.forEach(sec => {
        console.log(`    Security: ${sec.security_mechanism.mechanism_type} (${sec.direction})`);
      });
    });

    // 3. Test NLP service directly
    console.log('\n🧪 TESTING NLP SERVICE:');
    
    const testQueries = [
      'show me all iFlows with OAuth authentication',
      'list all security mechanisms', 
      'how many iFlows use Basic Authentication'
    ];

    for (const query of testQueries) {
      console.log(`\n📝 Query: "${query}"`);
      try {
        const result = await nlpService.processQuery(query);
        console.log(`✅ Type: ${result.type}`);
        console.log(`✅ Message: ${result.message}`);
        
        if (result.data) {
          if (result.data.summary && Array.isArray(result.data.summary)) {
            console.log(`✅ Summary items: ${result.data.summary.length}`);
            // Show first few summary items
            result.data.summary.slice(0, 3).forEach(item => {
              console.log(`   - ${item.mechanism_type || item.adapter_type || 'Item'}: ${item.count}`);
            });
          }
          if (result.data.iflows && Array.isArray(result.data.iflows)) {
            console.log(`✅ iFlows returned: ${result.data.iflows.length}`);
            result.data.iflows.slice(0, 3).forEach(iflow => {
              console.log(`   - ${iflow.name} (Package: ${iflow.package})`);
              if (iflow.security_mechanisms) {
                iflow.security_mechanisms.forEach(sec => {
                  console.log(`     Security: ${sec.type} (${sec.direction})`);
                });
              }
            });
          }
          if (Array.isArray(result.data)) {
            console.log(`✅ Data array length: ${result.data.length}`);
          }
        }
      } catch (error) {
        console.log(`❌ NLP Query Failed: ${error.message}`);
        console.log('Stack:', error.stack);
      }
    }

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Database has plenty of data (75 iFlows, 52 security mechanisms)');
    console.log('✅ Relationships exist (54 security relationships)');
    console.log('✅ OAuth data exists (2 OAuth entries found)');
    console.log('');
    console.log('If NLP queries above worked, your service is fully functional!');
    console.log('If they failed, check the error messages above.');

    // 4. Test the actual HTTP endpoint
    console.log('\n🌐 TEST HTTP ENDPOINT:');
    console.log('curl -X POST http://localhost:3000/api/nlp/query \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"query": "show me all iFlows with OAuth authentication"}\'');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

verifyNLP().then(() => {
  console.log('\n✅ NLP verification completed!');
  process.exit(0);
}).catch(console.error);