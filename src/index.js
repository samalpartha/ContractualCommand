const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();

const logger = require('./config/logger');
const pool = require('./config/database');

// Import routes
const customersRouter = require('./routes/customers');
const churnRouter = require('./routes/churn');
const counterfactualRouter = require('./routes/counterfactual');
const regretRouter = require('./routes/regret');
const actionsRouter = require('./routes/actions');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Counterfactual Command Center API',
      version: '1.0.0',
      description: 'Decision accountability analytics platform for customer retention',
      contact: {
        name: 'API Support',
        email: 'support@counterfactual.ai',
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'Customers',
        description: 'Customer data management',
      },
      {
        name: 'Churn',
        description: 'Churn prediction endpoints',
      },
      {
        name: 'Counterfactual',
        description: 'Counterfactual simulation',
      },
      {
        name: 'Regret',
        description: 'Decision regret analytics',
      },
      {
        name: 'Actions',
        description: 'Retention campaign actions',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/customers', customersRouter);
app.use('/api/churn', churnRouter);
app.use('/api/counterfactual', counterfactualRouter);
app.use('/api/regret', regretRouter);
app.use('/api/actions', actionsRouter);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Counterfactual Command Center API',
    version: '1.0.0',
    description: 'Decision accountability analytics platform for customer retention',
    documentation: '/api-docs',
    endpoints: {
      customers: '/api/customers',
      churn: '/api/churn',
      counterfactual: '/api/counterfactual',
      regret: '/api/regret',
      actions: '/api/actions',
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  COUNTERFACTUAL COMMAND CENTER');
  console.log('  Decision Accountability Analytics Platform');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Server running on port ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('  📡 API Endpoints:`);
  console.log(`     http://localhost:${PORT}/api/customers`);
  console.log(`     http://localhost:${PORT}/api/churn`);
  console.log(`     http://localhost:${PORT}/api/counterfactual`);
  console.log(`     http://localhost:${PORT}/api/regret`);
  console.log(`     http://localhost:${PORT}/api/actions`);
  console.log('');
  console.log('  📚 API Documentation:');
  console.log(`     http://localhost:${PORT}/api-docs`);
  console.log('');
  console.log('  🏥 Health Check:');
  console.log(`     http://localhost:${PORT}/health`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  logger.info(`Server started on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    logger.info('HTTP server closed');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});

module.exports = app;
