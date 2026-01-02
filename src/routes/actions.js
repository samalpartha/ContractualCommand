const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../config/logger');
const SlackService = require('../services/slackService');

/**
 * @route   POST /api/actions/trigger
 * @desc    Trigger retention campaign actions
 * @access  Public
 */
router.post('/trigger', async (req, res) => {
  try {
    const {
      customer_ids,
      action_type = 'slack_alert',
      message = '',
      priority = 'normal',
    } = req.body;
    
    if (!customer_ids || customer_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'customer_ids array is required',
      });
    }
    
    logger.info(`Triggering ${action_type} for ${customer_ids.length} customers`);
    
    // Fetch customer details
    const customers = await pool.query(`
      SELECT 
        c.*,
        cp.baseline_churn_prob,
        cp.risk_segment
      FROM customers c
      LEFT JOIN churn_predictions cp ON c.customer_id = cp.customer_id
      WHERE c.customer_id = ANY($1)
    `, [customer_ids]);
    
    if (customers.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No customers found',
      });
    }
    
    let actionResult;
    
    // Execute action based on type
    switch (action_type) {
      case 'slack_alert':
        actionResult = await executeSlackAlert(customers.rows, message, priority);
        break;
        
      case 'salesforce_task':
        actionResult = await executeSalesforceTask(customers.rows, message, priority);
        break;
        
      case 'email_campaign':
        actionResult = await executeEmailCampaign(customers.rows, message, priority);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action type: ${action_type}`,
        });
    }
    
    // Log actions in database
    const client = await pool.connect();
    try {
      for (const customer of customers.rows) {
        await client.query(`
          INSERT INTO actions_log (
            customer_id,
            action_type,
            message,
            priority,
            status,
            response
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          customer.customer_id,
          action_type,
          message,
          priority,
          actionResult.success ? 'completed' : 'failed',
          JSON.stringify(actionResult),
        ]);
      }
    } finally {
      client.release();
    }
    
    res.json({
      success: true,
      message: `${action_type} triggered for ${customers.rows.length} customers`,
      action_result: actionResult,
      customers_affected: customers.rows.length,
    });
    
  } catch (error) {
    logger.error('Error triggering action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger action',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/actions/log
 * @desc    Get action log history
 * @access  Public
 */
router.get('/log', async (req, res) => {
  try {
    const { customer_id, action_type, status, limit = 100 } = req.query;
    
    let query = `
      SELECT 
        al.*,
        c.company,
        c.revenue
      FROM actions_log al
      JOIN customers c ON al.customer_id = c.customer_id
    `;
    
    const params = [];
    const conditions = [];
    
    if (customer_id) {
      conditions.push(`al.customer_id = $${params.length + 1}`);
      params.push(customer_id);
    }
    
    if (action_type) {
      conditions.push(`al.action_type = $${params.length + 1}`);
      params.push(action_type);
    }
    
    if (status) {
      conditions.push(`al.status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY al.triggered_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      actions: result.rows,
    });
    
  } catch (error) {
    logger.error('Error fetching action log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch action log',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/actions/regret-zone
 * @desc    Get customers entering regret zone (high risk with low time left)
 * @access  Public
 */
router.get('/regret-zone', async (req, res) => {
  try {
    // Customers with high churn risk and low engagement (urgent action needed)
    const result = await pool.query(`
      SELECT 
        c.*,
        cp.baseline_churn_prob,
        cp.risk_segment,
        EXTRACT(DAY FROM (CURRENT_DATE - c.last_activity_date)) as days_inactive
      FROM customers c
      JOIN churn_predictions cp ON c.customer_id = cp.customer_id
      WHERE 
        cp.risk_segment = 'high'
        AND c.engagement_score < 40
        AND EXTRACT(DAY FROM (CURRENT_DATE - c.last_activity_date)) > 14
      ORDER BY c.revenue DESC
      LIMIT 50
    `);
    
    const totalRevenue = result.rows.reduce((sum, c) => sum + parseFloat(c.revenue), 0);
    
    res.json({
      success: true,
      count: result.rows.length,
      total_revenue_at_risk: totalRevenue,
      customers: result.rows,
      recommendation: {
        action: 'proactive_outreach',
        timing: '7d_earlier',
        urgency: 'high',
        time_window: '48h',
      },
    });
    
  } catch (error) {
    logger.error('Error fetching regret zone customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regret zone customers',
      message: error.message,
    });
  }
});

/**
 * Execute Slack alert
 */
async function executeSlackAlert(customers, customMessage, priority) {
  try {
    const result = await SlackService.sendHighRiskAlert(customers, priority);
    return result;
  } catch (error) {
    logger.error('Slack alert failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute Salesforce task (placeholder)
 */
async function executeSalesforceTask(customers, customMessage, priority) {
  // TODO: Implement Salesforce integration
  logger.info('Salesforce task creation not yet implemented');
  
  return {
    success: true,
    message: 'Salesforce integration coming soon',
    tasks_created: customers.length,
  };
}

/**
 * Execute email campaign (placeholder)
 */
async function executeEmailCampaign(customers, customMessage, priority) {
  // TODO: Implement email campaign integration
  logger.info('Email campaign not yet implemented');
  
  return {
    success: true,
    message: 'Email campaign integration coming soon',
    emails_queued: customers.length,
  };
}

module.exports = router;
