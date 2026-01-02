const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../config/logger');

/**
 * @route   POST /api/customers/ingest
 * @desc    Ingest customer data (CRM, usage, support metrics)
 * @access  Public
 */
router.post('/ingest', async (req, res) => {
  try {
    const customers = Array.isArray(req.body) ? req.body : [req.body];
    
    logger.info(`Ingesting ${customers.length} customer records`);
    
    const client = await pool.connect();
    let insertedCount = 0;
    let updatedCount = 0;
    
    try {
      for (const customer of customers) {
        const {
          customer_id,
          company,
          revenue,
          tenure,
          engagement_score,
          support_response_time,
          last_activity_date,
        } = customer;
        
        // Validate required fields
        if (!customer_id || !company) {
          logger.warn(`Skipping customer with missing required fields: ${JSON.stringify(customer)}`);
          continue;
        }
        
        // Upsert customer
        const result = await client.query(`
          INSERT INTO customers (
            customer_id, company, revenue, tenure, engagement_score,
            support_response_time, last_activity_date, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          ON CONFLICT (customer_id) 
          DO UPDATE SET
            company = EXCLUDED.company,
            revenue = EXCLUDED.revenue,
            tenure = EXCLUDED.tenure,
            engagement_score = EXCLUDED.engagement_score,
            support_response_time = EXCLUDED.support_response_time,
            last_activity_date = EXCLUDED.last_activity_date,
            updated_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS inserted
        `, [
          customer_id,
          company,
          revenue || 0,
          tenure || 0,
          engagement_score || 50,
          support_response_time || 24,
          last_activity_date || new Date().toISOString().split('T')[0],
        ]);
        
        if (result.rows[0].inserted) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      }
      
      logger.info(`Ingestion complete: ${insertedCount} inserted, ${updatedCount} updated`);
      
      res.status(200).json({
        success: true,
        message: `Successfully processed ${customers.length} customer records`,
        inserted: insertedCount,
        updated: updatedCount,
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Error ingesting customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ingest customer data',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/customers
 * @desc    Get all customers
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0, risk_segment } = req.query;
    
    let query = `
      SELECT 
        c.*,
        cp.baseline_churn_prob,
        cp.risk_segment,
        cp.predicted_churn_date
      FROM customers c
      LEFT JOIN churn_predictions cp ON c.customer_id = cp.customer_id
    `;
    
    const params = [];
    
    if (risk_segment) {
      query += ` WHERE cp.risk_segment = $${params.length + 1}`;
      params.push(risk_segment);
    }
    
    query += ` ORDER BY c.revenue DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      customers: result.rows,
    });
    
  } catch (error) {
    logger.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/customers/:id
 * @desc    Get customer by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        c.*,
        cp.baseline_churn_prob,
        cp.risk_segment,
        cp.predicted_churn_date,
        cp.features
      FROM customers c
      LEFT JOIN churn_predictions cp ON c.customer_id = cp.customer_id
      WHERE c.customer_id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }
    
    res.json({
      success: true,
      customer: result.rows[0],
    });
    
  } catch (error) {
    logger.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer',
      message: error.message,
    });
  }
});

module.exports = router;
