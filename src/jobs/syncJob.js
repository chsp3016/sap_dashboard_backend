const cron = require('node-cron');
const dataSyncService = require('../services/dataSyncService');
const logger = require('../utils/logger');
require('dotenv').config();

/**
 * Initialize the scheduled data synchronization job
 */
const initSyncJob = () => {
  const cronSchedule = process.env.CRON_SCHEDULE || '*/30 * * * *'; // Default: every 30 minutes
  
  logger.info(`Initializing data sync job with schedule: ${cronSchedule}`);
  
  // Validate cron schedule
  if (!cron.validate(cronSchedule)) {
    logger.error(`Invalid cron schedule: ${cronSchedule}`);
    throw new Error(`Invalid cron schedule: ${cronSchedule}`);
  }
  
  // Schedule the job
  cron.schedule(cronSchedule, async () => {
    logger.info('Starting scheduled data synchronization');
    
    try {
      await dataSyncService.syncAllData();
      logger.info('Scheduled data synchronization completed successfully');
    } catch (error) {
      logger.error('Error during scheduled data synchronization', { 
        error: error.message,
        stack: error.stack
      });
    }
  });
  
  logger.info('Data sync job initialized successfully');
};

/**
 * Run an immediate data synchronization
 * @returns {Promise<void>}
 */
const runImmediateSync = async () => {
  logger.info('Starting immediate data synchronization');
  
  try {
    await dataSyncService.syncAllData();
    logger.info('Immediate data synchronization completed successfully');
  } catch (error) {
    logger.error('Error during immediate data synchronization', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

module.exports = {
  initSyncJob,
  runImmediateSync
};