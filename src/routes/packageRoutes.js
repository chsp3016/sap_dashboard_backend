const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const models = require('../models');
const logger = require('../utils/logger');

/**
 * GET /api/packages
 * Get all packages with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { search, limit = 100, offset = 0 } = req.query;
    
    // Build filter conditions
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { package_name: { [Op.iLike]: `%${search}%` } },
        { package_description: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    // Execute query
    const { count, rows } = await models.Package.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['package_name', 'ASC']]
    });
    
    res.json({
      total: count,
      packages: rows
    });
  } catch (error) {
    logger.error('Error fetching packages', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

/**
 * GET /api/packages/:id
 * Get a specific package with its iFlows
 */
router.get('/:id', async (req, res) => {
  try {
    const packageId = req.params.id;
    
    const packageData = await models.Package.findByPk(packageId, {
      include: [
        {
          model: models.Iflow,
          include: [
            {
              model: models.DeploymentInfo,
              attributes: ['status', 'deployed_on', 'deployed_by']
            }
          ]
        }
      ]
    });
    
    if (!packageData) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    res.json(packageData);
  } catch (error) {
    logger.error(`Error fetching package ${req.params.id}`, { error: error.message });
    res.status(500).json({ error: 'Failed to fetch package details' });
  }
});

/**
 * GET /api/packages/:id/metrics
 * Get metrics for a specific package
 */
router.get('/:id/metrics', async (req, res) => {
  try {
    const packageId = req.params.id;
    
    // Get all iFlows in the package
    const iflows = await models.Iflow.findAll({
      where: { package_id: packageId },
      attributes: ['iflow_id']
    });
    
    if (iflows.length === 0) {
      return res.json({
        iflow_count: 0,
        deployment_statuses: [],
        runtime_metrics: {
          total_success: 0,
          total_failure: 0,
          avg_processing_time: 0
        }
      });
    }
    
    // Extract iFlow IDs
    const iflowIds = iflows.map(iflow => iflow.iflow_id);
    
    // Count iFlows by deployment status
    const deploymentStatusCounts = await models.DeploymentInfo.findAll({
      attributes: [
        'status',
        [models.sequelize.fn('COUNT', models.sequelize.col('deployment_id')), 'count']
      ],
      where: {
        iflow_id: { [Op.in]: iflowIds }
      },
      group: ['status']
    });
    
    // Get runtime metrics
    const runtimeMetrics = await models.RuntimeInfo.findAll({
      attributes: [
        [models.sequelize.fn('SUM', models.sequelize.col('success_count')), 'total_success'],
        [models.sequelize.fn('SUM', models.sequelize.col('failure_count')), 'total_failure'],
        [models.sequelize.fn('AVG', models.sequelize.col('avg_processing_time')), 'avg_processing_time']
      ],
      where: {
        iflow_id: { [Op.in]: iflowIds }
      }
    });
    
    res.json({
      iflow_count: iflows.length,
      deployment_statuses: deploymentStatusCounts,
      runtime_metrics: runtimeMetrics[0]
    });
  } catch (error) {
    logger.error(`Error fetching metrics for package ${req.params.id}`, { error: error.message });
    res.status(500).json({ error: 'Failed to fetch package metrics' });
  }
});

module.exports = router;
