const express = require('express');
const router = express.Router();
const syncJob = require('../jobs/syncJob');
const logger = require('../utils/logger');

/**
 * POST /api/sync
 * Trigger an immediate data synchronization
 */
router.post('/', async (req, res) => {
  try {
    logger.info('Manual sync triggered by API request');
    
    // Start sync in background
    syncJob.runImmediateSync()
      .then(() => {
        logger.info('Manual sync completed successfully');
      })
      .catch(error => {
        logger.error('Manual sync failed', { error: error.message });
      });
    
    // Return immediately to avoid timeout
    res.json({
      message: 'Data synchronization started',
      status: 'processing'
    });
  } catch (error) {
    logger.error('Error triggering manual sync', { error: error.message });
    res.status(500).json({ error: 'Failed to trigger data synchronization' });
  }
});

/**
 * GET /api/sync/status
 * Get the status of the last synchronization
 * Note: This is a placeholder. In a production system, you would track sync status in the database.
 */
router.get('/status', (req, res) => {
  // In a real implementation, you would store sync status in the database
  // and retrieve the latest status here
  res.json({
    message: 'Sync status endpoint',
    note: 'This is a placeholder. Implement actual status tracking in production.'
  });
});

module.exports = router;