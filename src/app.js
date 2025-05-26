const express = require('express');
const cors = require('cors');
const { sequelize } = require('./config/database');
const syncJob = require('./jobs/syncJob');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const iflowRoutes = require('./routes/iflowRoutes');
const packageRoutes = require('./routes/packageRoutes');
const syncRoutes = require('./routes/syncRoutes');
const chatRoutes = require('./routes/chatRoutes');
const nlpRoutes = require('./routes/nlpRoutes');

require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(errorHandler);
// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// API routes
app.use('/api/iflows', iflowRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/nlp', nlpRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
  //res.redirect('/api/health/ping');
});

// Not found handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Sync database models (in development mode)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized');
    }
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      
      // Initialize scheduled sync job
      syncJob.initSyncJob();
      
      // Run initial data sync if specified
      if (process.env.RUN_INITIAL_SYNC === 'true') {
        logger.info('Running initial data synchronization');
        syncJob.runImmediateSync()
          .then(() => {
            logger.info('Initial data synchronization completed');
          })
          .catch(error => {
            logger.error('Initial data synchronization failed', { error: error.message });
          });
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

// Start the server
startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;