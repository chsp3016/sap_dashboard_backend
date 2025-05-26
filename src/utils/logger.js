const winston = require('winston');
const path = require('path');
require('dotenv').config();

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'sap-dashboard-backend' },
  transports: [
    // Console transport with debug level
    new winston.transports.Console({
      level: 'debug', // Explicitly set to debug for console
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
        )
      )
    }),
    // File transport
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH || path.join(__dirname, '../../logs/app.log'),
      level: process.env.LOG_LEVEL || 'info', // File logging remains configurable
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

module.exports = logger;