const logger = require('./src/utils/logger');
const dataFetchService = require('./src/services/dataFetchService');
const dataProcessService = require('./src/services/dataProcessService');
const models = require('./src/models');
require('dotenv').config();

/**
 * Debug script to diagnose foreign key constraint violations
 */
async function debugForeignKeyIssue() {
  try {
    const flowId = 'CreateEnvelop_C4C_-_DocuSign';
    const version = '2024.01.32';
    
    logger.info(`Debugging foreign key issue for flow: ${flowId} (version: ${version})`);
    
    // 1. Fetch the flow data from API
    const flowsData = await dataFetchService.fetchPackageIntegrationFlows('00TESTPACK');
    const targetFlow = flowsData.find(flow => flow.Id === flowId);
    
    if (!targetFlow) {
      logger.error(`Flow ${flowId} not found in package 00TESTPACK`);
      return;
    }
    
    logger.info('Flow from API:', {
      Id: targetFlow.Id,
      PackageId: targetFlow.PackageId,
      Name: targetFlow.Name,
      Version: targetFlow.Version
    });
    
    // 2. Check if the package exists in database
    const packageId = targetFlow.PackageId || '00TESTPACK';
    const packageExists = await models.Package.findByPk(packageId);
    
    if (!packageExists) {
      logger.error(`Package ${packageId} NOT FOUND in database!`);
      logger.info('Available packages in database:');
      const allPackages = await models.Package.findAll({
        attributes: ['package_id', 'package_name']
      });
      allPackages.forEach(pkg => {
        logger.info(`- ${pkg.package_id}: ${pkg.package_name}`);
      });
    } else {
      logger.info(`Package ${packageId} exists in database:`, {
        package_id: packageExists.package_id,
        package_name: packageExists.package_name
      });
    }
    
    // 3. Fetch detailed flow information
    const flowDetails = await dataFetchService.fetchIntegrationFlowDetails(flowId, version, true);
    
    if (flowDetails.error) {
      logger.error('Failed to fetch flow details:', flowDetails.error);
      return;
    }
    
    // 4. Process the data
    const runtimeStatus = {};
    const processedFlow = dataProcessService.processIntegrationFlowData(flowDetails, runtimeStatus);
    
    logger.info('Processed package_id:', processedFlow.package_id);
    logger.info('Expected package_id:', packageId);
    
    // 5. Check if processed flow has the correct package_id
    if (processedFlow.package_id !== packageId) {
      logger.warn(`Package ID mismatch! Processed: ${processedFlow.package_id}, Expected: ${packageId}`);
      logger.info('Correcting package_id...');
      processedFlow.package_id = packageId;
    }
    
    // 6. Verify the corrected package_id exists
    const correctedPackageExists = await models.Package.findByPk(processedFlow.package_id);
    if (!correctedPackageExists) {
      logger.error(`Corrected package_id ${processedFlow.package_id} STILL DOES NOT EXIST!`);
      return;
    }
    
    // 7. Test the update operation
    try {
      const existingFlow = await models.Iflow.findByPk(flowId);
      if (existingFlow) {
        logger.info('Testing update operation...');
        await existingFlow.update(processedFlow);
        logger.info('SUCCESS: Update operation completed without foreign key error!');
      } else {
        logger.info('Testing create operation...');
        await models.Iflow.create(processedFlow);
        logger.info('SUCCESS: Create operation completed without foreign key error!');
      }
    } catch (error) {
      logger.error('Database operation failed:', {
        message: error.message,
        name: error.name,
        constraint: error.constraint,
        table: error.table,
        column: error.column,
        detail: error.detail
      });
    }
    
  } catch (error) {
    logger.error('Debug script failed:', {
      message: error.message,
      stack: error.stack
    });
  }
}

// Run the debug script
debugForeignKeyIssue().then(() => {
  logger.info('Foreign key debug script completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Debug script error:', error);
  process.exit(1);
});

module.exports = { debugForeignKeyIssue };