const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const models = require('../models');
const logger = require('../utils/logger');

/**
 * GET /api/iflows
 * Get all iFlows with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const {
      packageId,
      deploymentModel,
      systemsComposition,
      iflowType,
      deploymentStatus,
      search,
      limit = 100,
      offset = 0
    } = req.query;
    
    // Build filter conditions
    const where = {};
    
    if (packageId) {
      where.package_id = packageId;
    }
    
    if (deploymentModel) {
      where.deployment_model = deploymentModel;
    }
    
    if (systemsComposition) {
      where.systems_composition = systemsComposition;
    }
    
    if (iflowType) {
      where.iflow_type = iflowType;
    }
    
    if (search) {
      where[Op.or] = [
        { iflow_name: { [Op.iLike]: `%${search}%` } },
        { iflow_description: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    // Include deployment info if filtering by status
    const include = [
      {
        model: models.Package,
        attributes: ['package_id', 'package_name']
      }
    ];
    
    if (deploymentStatus) {
      include.push({
        model: models.DeploymentInfo,
        where: { status: deploymentStatus },
        required: true
      });
    } else {
      include.push({
        model: models.DeploymentInfo,
        required: false
      });
    }
    
    // Execute query
    const { count, rows } = await models.Iflow.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['iflow_name', 'ASC']]
    });
    
    res.json({
      total: count,
      iflows: rows
    });
  } catch (error) {
    logger.error('Error fetching iFlows', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch iFlows' });
  }
});

/**
 * GET /api/iflows/:id
 * Get a specific iFlow with all related data
 */
router.get('/:id', async (req, res) => {
  try {
    const iflowId = req.params.id;
    
    const iflow = await models.Iflow.findByPk(iflowId, {
      include: [
        {
          model: models.Package,
          attributes: ['package_id', 'package_name']
        },
        {
          model: models.DeploymentInfo
        },
        {
          model: models.RuntimeInfo
        },
        {
          model: models.ErrorHandling
        },
        {
          model: models.Persistence
        },
        {
          model: models.IflowAdapter,
          include: [
            {
              model: models.Adapter,
              attributes: ['adapter_id', 'adapter_name', 'adapter_type', 'adapter_category']
            }
          ]
        },
        {
          model: models.IflowSecurity,
          include: [
            {
              model: models.SecurityMechanism,
              attributes: ['security_mechanism_id', 'mechanism_name', 'mechanism_type']
            }
          ]
        }
      ]
    });
    
    if (!iflow) {
      return res.status(404).json({ error: 'iFlow not found' });
    }
    
    res.json(iflow);
  } catch (error) {
    logger.error(`Error fetching iFlow ${req.params.id}`, { error: error.message });
    res.status(500).json({ error: 'Failed to fetch iFlow details' });
  }
});

/**
 * GET /api/iflows/:id/history
 * Get history of changes for a specific iFlow
 */
router.get('/:id/history', async (req, res) => {
  try {
    const iflowId = req.params.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const history = await models.IflowHistory.findAll({
      where: { iflow_id: iflowId },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['change_timestamp', 'DESC']]
    });
    
    res.json(history);
  } catch (error) {
    logger.error(`Error fetching iFlow history for ${req.params.id}`, { error: error.message });
    res.status(500).json({ error: 'Failed to fetch iFlow history' });
  }
});

/**
 * GET /api/iflows/:id/deployment-history
 * Get deployment history for a specific iFlow
 */
router.get('/:id/deployment-history', async (req, res) => {
  try {
    const iflowId = req.params.id;
    const { limit = 50, offset = 0 } = req.query;
    
    // First get the deployment info
    const deploymentInfo = await models.DeploymentInfo.findOne({
      where: { iflow_id: iflowId }
    });
    
    if (!deploymentInfo) {
      return res.json([]);
    }
    
    // Then get the history
    const history = await models.DeploymentInfoHistory.findAll({
      where: { deployment_id: deploymentInfo.deployment_id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['change_timestamp', 'DESC']]
    });
    
    res.json(history);
  } catch (error) {
    logger.error(`Error fetching deployment history for iFlow ${req.params.id}`, { error: error.message });
    res.status(500).json({ error: 'Failed to fetch deployment history' });
  }
});

/**
 * GET /api/iflows/:id/runtime-history
 * Get runtime history for a specific iFlow
 */
router.get('/:id/runtime-history', async (req, res) => {
  try {
    const iflowId = req.params.id;
    const { limit = 50, offset = 0 } = req.query;
    
    // First get the runtime info
    const runtimeInfo = await models.RuntimeInfo.findOne({
      where: { iflow_id: iflowId }
    });
    
    if (!runtimeInfo) {
      return res.json([]);
    }
    
    // Then get the history
    const history = await models.RuntimeInfoHistory.findAll({
      where: { runtime_id: runtimeInfo.runtime_id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['change_timestamp', 'DESC']]
    });
    
    res.json(history);
  } catch (error) {
    logger.error(`Error fetching runtime history for iFlow ${req.params.id}`, { error: error.message });
    res.status(500).json({ error: 'Failed to fetch runtime history' });
  }
});

/**
 * GET /api/iflows/metrics/summary
 * Get summary metrics for all iFlows
 */
router.get('/metrics/summary', async (req, res) => {
  try {
    // Count iFlows by deployment model
    const deploymentModelCounts = await models.Iflow.findAll({
      attributes: [
        'deployment_model',
        [models.sequelize.fn('COUNT', models.sequelize.col('iflow_id')), 'count']
      ],
      group: ['deployment_model']
    });
    
    // Count iFlows by systems composition
    const systemsCompositionCounts = await models.Iflow.findAll({
      attributes: [
        'systems_composition',
        [models.sequelize.fn('COUNT', models.sequelize.col('iflow_id')), 'count']
      ],
      group: ['systems_composition']
    });
    
    // Count iFlows by type
    const iflowTypeCounts = await models.Iflow.findAll({
      attributes: [
        'iflow_type',
        [models.sequelize.fn('COUNT', models.sequelize.col('iflow_id')), 'count']
      ],
      group: ['iflow_type']
    });
    
    // Count iFlows by deployment status
    const deploymentStatusCounts = await models.DeploymentInfo.findAll({
      attributes: [
        'status',
        [models.sequelize.fn('COUNT', models.sequelize.col('deployment_id')), 'count']
      ],
      group: ['status']
    });
    
    // Get total success and failure counts
    const runtimeMetrics = await models.RuntimeInfo.findAll({
      attributes: [
        [models.sequelize.fn('SUM', models.sequelize.col('success_count')), 'total_success'],
        [models.sequelize.fn('SUM', models.sequelize.col('failure_count')), 'total_failure'],
        [models.sequelize.fn('AVG', models.sequelize.col('avg_processing_time')), 'avg_processing_time']
      ]
    });
    
    res.json({
      deployment_models: deploymentModelCounts,
      systems_compositions: systemsCompositionCounts,
      iflow_types: iflowTypeCounts,
      deployment_statuses: deploymentStatusCounts,
      runtime_metrics: runtimeMetrics[0]
    });
  } catch (error) {
    logger.error('Error fetching iFlow metrics summary', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch metrics summary' });
  }
});

module.exports = router;