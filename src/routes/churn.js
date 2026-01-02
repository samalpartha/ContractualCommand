const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../config/logger');

/**
 * @route   GET /api/churn/baseline
 * @desc    Get baseline churn probability distribution
 * @access  Public
 */
router.get('/baseline', async (req, res) => {
  try {
    // Get distribution statistics
    const distribution = await pool.query(`
      SELECT 
        risk_segment,
        COUNT(*) as count,
        ROUND(AVG(baseline_churn_prob)::numeric, 4) as avg_churn_prob,
        ROUND(MIN(baseline_churn_prob)::numeric, 4) as min_churn_prob,
        ROUND(MAX(baseline_churn_prob)::numeric, 4) as max_churn_prob,
        ROUND(SUM(c.revenue)::numeric, 2) as total_revenue
      FROM churn_predictions cp
      JOIN customers c ON cp.customer_id = c.customer_id
      GROUP BY risk_segment
      ORDER BY 
        CASE risk_segment 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END
    `);
    
    // Get histogram data (10 bins)
    const histogram = await pool.query(`
      SELECT 
        WIDTH_BUCKET(baseline_churn_prob, 0, 1, 10) as bucket,
        COUNT(*) as count,
        ROUND((WIDTH_BUCKET(baseline_churn_prob, 0, 1, 10) - 1) * 0.1::numeric, 2) as bin_start,
        ROUND(WIDTH_BUCKET(baseline_churn_prob, 0, 1, 10) * 0.1::numeric, 2) as bin_end
      FROM churn_predictions
      GROUP BY bucket
      ORDER BY bucket
    `);
    
    // Get overall statistics
    const overall = await pool.query(`
      SELECT 
        COUNT(*) as total_customers,
        ROUND(AVG(baseline_churn_prob)::numeric, 4) as avg_churn_prob,
        ROUND(STDDEV(baseline_churn_prob)::numeric, 4) as stddev_churn_prob,
        COUNT(*) FILTER (WHERE baseline_churn_prob >= 0.6) as high_risk_count,
        COUNT(*) FILTER (WHERE baseline_churn_prob >= 0.3 AND baseline_churn_prob < 0.6) as medium_risk_count,
        COUNT(*) FILTER (WHERE baseline_churn_prob < 0.3) as low_risk_count
      FROM churn_predictions
    `);
    
    // Get high-value customers at risk
    const highValueAtRisk = await pool.query(`
      SELECT 
        c.customer_id,
        c.company,
        c.revenue,
        cp.baseline_churn_prob,
        cp.risk_segment
      FROM customers c
      JOIN churn_predictions cp ON c.customer_id = cp.customer_id
      WHERE cp.risk_segment = 'high'
      ORDER BY c.revenue DESC
      LIMIT 20
    `);
    
    res.json({
      success: true,
      distribution: distribution.rows,
      histogram: histogram.rows,
      overall: overall.rows[0],
      high_value_at_risk: highValueAtRisk.rows,
    });
    
  } catch (error) {
    logger.error('Error fetching baseline churn:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch baseline churn data',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/churn/predictions
 * @desc    Get all churn predictions
 * @access  Public
 */
router.get('/predictions', async (req, res) => {
  try {
    const { risk_segment, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        cp.*,
        c.company,
        c.revenue,
        c.tenure,
        c.engagement_score,
        c.support_response_time
      FROM churn_predictions cp
      JOIN customers c ON cp.customer_id = c.customer_id
    `;
    
    const params = [];
    
    if (risk_segment) {
      query += ` WHERE cp.risk_segment = $${params.length + 1}`;
      params.push(risk_segment);
    }
    
    query += ` ORDER BY cp.baseline_churn_prob DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      predictions: result.rows,
    });
    
  } catch (error) {
    logger.error('Error fetching predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch churn predictions',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/churn/predictions/:customerId
 * @desc    Get churn prediction for specific customer
 * @access  Public
 */
router.get('/predictions/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        cp.*,
        c.company,
        c.revenue,
        c.tenure,
        c.engagement_score,
        c.support_response_time,
        c.last_activity_date
      FROM churn_predictions cp
      JOIN customers c ON cp.customer_id = c.customer_id
      WHERE cp.customer_id = $1
    `, [customerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prediction not found for customer',
      });
    }
    
    res.json({
      success: true,
      prediction: result.rows[0],
    });
    
  } catch (error) {
    logger.error('Error fetching prediction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch churn prediction',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/churn/trends
 * @desc    Get churn trends over time
 * @access  Public
 */
router.get('/trends', async (req, res) => {
  try {
    // Group predictions by date (using prediction_date)
    const trends = await pool.query(`
      SELECT 
        DATE(prediction_date) as date,
        COUNT(*) as total_predictions,
        ROUND(AVG(baseline_churn_prob)::numeric, 4) as avg_churn_prob,
        COUNT(*) FILTER (WHERE risk_segment = 'high') as high_risk_count,
        COUNT(*) FILTER (WHERE risk_segment = 'medium') as medium_risk_count,
        COUNT(*) FILTER (WHERE risk_segment = 'low') as low_risk_count
      FROM churn_predictions
      GROUP BY DATE(prediction_date)
      ORDER BY date DESC
      LIMIT 30
    `);
    
    res.json({
      success: true,
      trends: trends.rows,
    });
    
  } catch (error) {
    logger.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch churn trends',
      message: error.message,
    });
  }
});

module.exports = router;
