// simple-debug.js - Run from project root: node simple-debug.js
const models = require('../src/models');

async function debugDatabase() {
  try {
    console.log('🔍 DEBUGGING DATABASE CONTENT\n');

    // Test connection
    await models.sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Check each table
    const tables = [
      { name: 'Tenants', model: models.Tenant },
      { name: 'Packages', model: models.Package },
      { name: 'iFlows', model: models.Iflow },
      { name: 'Security Mechanisms', model: models.SecurityMechanism },
      { name: 'iFlow-Security Relations', model: models.IflowSecurity },
      { name: 'Adapters', model: models.Adapter },
      { name: 'iFlow-Adapter Relations', model: models.IflowAdapter }
    ];

    console.log('📊 TABLE COUNTS:');
    for (const table of tables) {
      const count = await table.model.count();
      console.log(`${count > 0 ? '✅' : '❌'} ${table.name}: ${count}`);
    }

    // Show sample data
    console.log('\n🔍 SAMPLE DATA:');
    
    const iflows = await models.Iflow.findAll({ limit: 3 });
    console.log(`\nSample iFlows (${iflows.length}):`);
    iflows.forEach(i => console.log(`  - ${i.iflow_name} (ID: ${i.iflow_id})`));

    const secMechs = await models.SecurityMechanism.findAll({ limit: 5 });
    console.log(`\nSample Security Mechanisms (${secMechs.length}):`);
    secMechs.forEach(s => console.log(`  - ${s.mechanism_name} (Type: ${s.mechanism_type})`));

    const iFlowSecurity = await models.IflowSecurity.findAll({ limit: 5 });
    console.log(`\nSample iFlow-Security Relations (${iFlowSecurity.length}):`);
    iFlowSecurity.forEach(rel => console.log(`  - iFlow: ${rel.iflow_id}, Direction: ${rel.direction}`));

    // Test the actual failing query
    console.log('\n🧪 TESTING THE ACTUAL NLP QUERIES:');
    
    // Query 1: Security counts
    const securityCounts = await models.SecurityMechanism.findAll({
      attributes: [
        'mechanism_type',
        [models.sequelize.fn('COUNT', models.sequelize.col('iflow_securities.iflow_id')), 'count']
      ],
      include: [{
        model: models.IflowSecurity,
        attributes: [],
        required: false
      }],
      group: ['security_mechanism.security_mechanism_id', 'mechanism_type'],
      raw: true
    });
    
    console.log('Security Counts Query Result:', securityCounts);

    // Query 2: iFlows with OAuth
    const oauthIflows = await models.Iflow.findAll({
      attributes: ['iflow_id', 'iflow_name'],
      include: [{
        model: models.IflowSecurity,
        include: [{
          model: models.SecurityMechanism,
          attributes: ['mechanism_name', 'mechanism_type'],
          where: { mechanism_type: { [models.sequelize.Op.iLike]: '%oauth%' } }
        }],
        required: true
      }, {
        model: models.Package,
        attributes: ['package_name']
      }],
      order: [['iflow_name', 'ASC']]
    });
    
    console.log('OAuth iFlows Query Result Count:', oauthIflows.length);

    // Diagnosis
    console.log('\n💡 DIAGNOSIS:');
    if (iflows.length === 0) {
      console.log('❌ NO IFLOWS - Run data sync or insert test data');
    } else if (secMechs.length === 0) {
      console.log('❌ NO SECURITY MECHANISMS - Need to create security data');
    } else if (iFlowSecurity.length === 0) {
      console.log('❌ NO IFLOW-SECURITY RELATIONSHIPS - This is the problem!');
      console.log('   Your iFlows exist but have no security mechanisms assigned');
    } else {
      console.log('✅ Data exists - Check NLP response handling');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugDatabase().then(() => {
  console.log('\n✅ Debug completed');
  process.exit(0);
}).catch(console.error);