// insert-test-data.js - Script to insert sample data for testing NLP service
const models = require('../src/models');
const logger = require('../src/utils/logger');

async function insertTestData() {
  try {
    console.log('🚀 Inserting test data for NLP service testing...\n');

    // 1. Create a test tenant
    console.log('1️⃣ Creating test tenant...');
    const [tenant] = await models.Tenant.findOrCreate({
      where: { tenant_name: 'Test SAP Integration Suite' },
      defaults: {
        tenant_url: 'https://test-tenant.sap.com',
        oauth_config: {
          client_id: 'test_client',
          token_url: 'https://test-tenant.authentication.sap.hana.ondemand.com/oauth/token'
        }
      }
    });
    console.log('✅ Tenant created:', tenant.tenant_name);

    // 2. Create test packages
    console.log('\n2️⃣ Creating test packages...');
    const packages = [
      {
        package_id: 'TEST_PACKAGE_001',
        tenant_id: tenant.tenant_id,
        package_name: 'Customer Integration Package',
        package_description: 'Package for customer-related integrations'
      },
      {
        package_id: 'TEST_PACKAGE_002', 
        tenant_id: tenant.tenant_id,
        package_name: 'Finance Integration Package',
        package_description: 'Package for finance-related integrations'
      }
    ];

    const createdPackages = [];
    for (const pkg of packages) {
      const [createdPkg] = await models.Package.findOrCreate({
        where: { package_id: pkg.package_id },
        defaults: pkg
      });
      createdPackages.push(createdPkg);
      console.log('✅ Package created:', createdPkg.package_name);
    }

    // 3. Create security mechanisms
    console.log('\n3️⃣ Creating security mechanisms...');
    const securityMechanisms = [
      { mechanism_name: 'OAuth 2.0 Authentication', mechanism_type: 'OAuth' },
      { mechanism_name: 'Basic Authentication', mechanism_type: 'Basic Authentication' },
      { mechanism_name: 'Client Certificate Auth', mechanism_type: 'Client Certificate' },
      { mechanism_name: 'SAML Authentication', mechanism_type: 'SAML' },
      { mechanism_name: 'JWT Token Authentication', mechanism_type: 'JWT' }
    ];

    const createdSecurityMechanisms = [];
    for (const sec of securityMechanisms) {
      const [createdSec] = await models.SecurityMechanism.findOrCreate({
        where: { mechanism_name: sec.mechanism_name },
        defaults: sec
      });
      createdSecurityMechanisms.push(createdSec);
      console.log('✅ Security mechanism created:', createdSec.mechanism_type);
    }

    // 4. Create adapters
    console.log('\n4️⃣ Creating adapters...');
    const adapters = [
      { adapter_name: 'HTTPS Sender', adapter_type: 'HTTPS', adapter_category: 'Sender' },
      { adapter_name: 'HTTP Receiver', adapter_type: 'HTTP', adapter_category: 'Receiver' },
      { adapter_name: 'SOAP Receiver', adapter_type: 'SOAP', adapter_category: 'Receiver' },
      { adapter_name: 'REST Receiver', adapter_type: 'REST', adapter_category: 'Receiver' },
      { adapter_name: 'JMS Sender', adapter_type: 'JMS', adapter_category: 'Sender' },
      { adapter_name: 'SFTP Receiver', adapter_type: 'SFTP', adapter_category: 'Receiver' }
    ];

    const createdAdapters = [];
    for (const adapter of adapters) {
      const [createdAdapter] = await models.Adapter.findOrCreate({
        where: { adapter_name: adapter.adapter_name },
        defaults: adapter
      });
      createdAdapters.push(createdAdapter);
      console.log('✅ Adapter created:', createdAdapter.adapter_type);
    }

    // 5. Create test iFlows
    console.log('\n5️⃣ Creating test iFlows...');
    const iflows = [
      {
        iflow_id: 'Customer_Order_Processing',
        package_id: createdPackages[0].package_id,
        iflow_name: 'Customer Order Processing',
        iflow_description: 'Processes incoming customer orders from web portal',
        deployment_model: 'Cloud to Cloud',
        versioning_status: 'Versioned',
        message_exchange_pattern: 'Async',
        interface_mode: 'real-time',
        message_type: 'Json',
        systems_composition: 'SAP2NONSAP',
        iflow_type: 'Custom',
        flag_based_logging: true,
        auditing: true,
        health_check: true
      },
      {
        iflow_id: 'Invoice_Approval_Workflow',
        package_id: createdPackages[1].package_id,
        iflow_name: 'Invoice Approval Workflow',
        iflow_description: 'Handles invoice approval process with external systems',
        deployment_model: 'Hybrid',
        versioning_status: 'Draft',
        message_exchange_pattern: 'Sync',
        interface_mode: 'Batch',
        message_type: 'xml',
        systems_composition: 'SAP2SAP',
        iflow_type: 'Standard',
        flag_based_logging: false,
        auditing: true,
        health_check: false
      },
      {
        iflow_id: 'Material_Master_Sync',
        package_id: createdPackages[0].package_id,
        iflow_name: 'Material Master Synchronization',
        iflow_description: 'Synchronizes material master data between SAP systems',
        deployment_model: 'Cloud to Onprem',
        versioning_status: 'Versioned',
        message_exchange_pattern: 'Async',
        interface_mode: 'event-driven',
        message_type: 'xml',
        systems_composition: 'NONSAP2NONSAP',
        iflow_type: 'Custom',
        flag_based_logging: true,
        auditing: false,
        health_check: true
      }
    ];

    const createdIflows = [];
    for (const iflow of iflows) {
      const [createdIflow] = await models.Iflow.findOrCreate({
        where: { iflow_id: iflow.iflow_id },
        defaults: iflow
      });
      createdIflows.push(createdIflow);
      console.log('✅ iFlow created:', createdIflow.iflow_name);
    }

    // 6. Create iFlow-Security relationships
    console.log('\n6️⃣ Creating iFlow-Security relationships...');
    const iflowSecurityRelations = [
      {
        iflow_id: createdIflows[0].iflow_id,
        security_mechanism_id: createdSecurityMechanisms[0].security_mechanism_id, // OAuth
        direction: 'Inbound',
        configuration: { endpoint: 'https://api.customer-portal.com/orders' }
      },
      {
        iflow_id: createdIflows[0].iflow_id,
        security_mechanism_id: createdSecurityMechanisms[2].security_mechanism_id, // Certificate
        direction: 'Outbound',
        configuration: { certificate_alias: 'customer_cert' }
      },
      {
        iflow_id: createdIflows[1].iflow_id,
        security_mechanism_id: createdSecurityMechanisms[1].security_mechanism_id, // Basic Auth
        direction: 'Inbound',
        configuration: { realm: 'invoice_system' }
      },
      {
        iflow_id: createdIflows[2].iflow_id,
        security_mechanism_id: createdSecurityMechanisms[3].security_mechanism_id, // SAML
        direction: 'Inbound',
        configuration: { idp_url: 'https://sso.company.com/saml' }
      }
    ];

    for (const relation of iflowSecurityRelations) {
      await models.IflowSecurity.findOrCreate({
        where: {
          iflow_id: relation.iflow_id,
          security_mechanism_id: relation.security_mechanism_id,
          direction: relation.direction
        },
        defaults: relation
      });
      console.log('✅ Security relation created');
    }

    // 7. Create iFlow-Adapter relationships
    console.log('\n7️⃣ Creating iFlow-Adapter relationships...');
    const iflowAdapterRelations = [
      {
        iflow_id: createdIflows[0].iflow_id,
        adapter_id: createdAdapters[0].adapter_id, // HTTPS Sender
        direction: 'Sender',
        configuration: { port: '8443', path: '/orders' }
      },
      {
        iflow_id: createdIflows[0].iflow_id,
        adapter_id: createdAdapters[1].adapter_id, // HTTP Receiver
        direction: 'Receiver',
        configuration: { url: 'https://backend-system.com/api/orders' }
      },
      {
        iflow_id: createdIflows[1].iflow_id,
        adapter_id: createdAdapters[2].adapter_id, // SOAP Receiver
        direction: 'Receiver',
        configuration: { wsdl_url: 'https://invoice-system.com/InvoiceService?wsdl' }
      },
      {
        iflow_id: createdIflows[2].iflow_id,
        adapter_id: createdAdapters[4].adapter_id, // JMS Sender
        direction: 'Sender',
        configuration: { queue_name: 'material.master.queue' }
      }
    ];

    for (const relation of iflowAdapterRelations) {
      await models.IflowAdapter.findOrCreate({
        where: {
          iflow_id: relation.iflow_id,
          adapter_id: relation.adapter_id,
          direction: relation.direction
        },
        defaults: relation
      });
      console.log('✅ Adapter relation created');
    }

    // 8. Create deployment info
    console.log('\n8️⃣ Creating deployment info...');
    for (const iflow of createdIflows) {
      await models.DeploymentInfo.findOrCreate({
        where: { iflow_id: iflow.iflow_id },
        defaults: {
          iflow_id: iflow.iflow_id,
          version: '1.0.0',
          deployment_type: 'Manual',
          deployed_by: 'test_user',
          deployed_on: new Date(),
          status: 'STARTED',
          deployment_details: { environment: 'test' }
        }
      });
      console.log('✅ Deployment info created for:', iflow.iflow_name);
    }

    // 9. Create runtime info
    console.log('\n9️⃣ Creating runtime info...');
    const runtimeData = [
      {
        iflow_id: createdIflows[0].iflow_id,
        endpoint: 'https://test-tenant.sap.com/http/orders',
        avg_processing_time: 150,
        success_count: 1250,
        failure_count: 23,
        execution_type: 'Ondemand',
        last_execution_time: new Date()
      },
      {
        iflow_id: createdIflows[1].iflow_id,
        endpoint: 'https://test-tenant.sap.com/http/invoices',
        avg_processing_time: 320,
        success_count: 890,
        failure_count: 12,
        execution_type: 'Scheduled',
        last_execution_time: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
      },
      {
        iflow_id: createdIflows[2].iflow_id,
        endpoint: 'https://test-tenant.sap.com/http/materials',
        avg_processing_time: 95,
        success_count: 2100,
        failure_count: 5,
        execution_type: 'Both',
        last_execution_time: new Date(Date.now() - 1000 * 60 * 10) // 10 minutes ago
      }
    ];

    for (const runtime of runtimeData) {
      await models.RuntimeInfo.findOrCreate({
        where: { iflow_id: runtime.iflow_id },
        defaults: runtime
      });
      console.log('✅ Runtime info created');
    }

    console.log('\n🎉 TEST DATA INSERTION COMPLETED!');
    console.log('=====================================');
    console.log('📊 Summary:');
    console.log(`   • ${createdPackages.length} packages`);
    console.log(`   • ${createdIflows.length} iFlows`);
    console.log(`   • ${createdSecurityMechanisms.length} security mechanisms`);
    console.log(`   • ${createdAdapters.length} adapters`);
    console.log(`   • ${iflowSecurityRelations.length} security relations`);
    console.log(`   • ${iflowAdapterRelations.length} adapter relations`);

    console.log('\n🧪 TEST QUERIES TO TRY:');
    console.log('========================');
    console.log('• "Show me all iFlows with OAuth authentication"');
    console.log('• "List all security mechanisms"');
    console.log('• "How many iFlows use HTTP adapter?"');
    console.log('• "Show me SAP2SAP integration flows"');
    console.log('• "Which iFlows have the highest processing time?"');
    console.log('• "Show me details for Customer Order Processing"');
    
  } catch (error) {
    console.error('❌ Error inserting test data:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  insertTestData().then(() => {
    console.log('\n✅ Test data insertion completed!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Test data insertion failed:', error);
    process.exit(1);
  });
}

module.exports = { insertTestData };