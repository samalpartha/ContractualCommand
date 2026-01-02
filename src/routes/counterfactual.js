const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../config/logger');
const CounterfactualEngine = require('../services/counterfactualEngine');

/**
 * @route   POST /api/counterfactual/simulate
 * @desc    Run counterfactual scenario simulation
 * @access  Public
 */
router.post('/simulate', async (req, res) => {
  try {
    const {
      customer_ids = null,
      intervention_timing = '14d_earlier',
      intervention_type = 'proactive_outreach',
      save_results = true,
    } = req.body;
    
    logger.info(`Running counterfactual simulation: ${intervention_type} / ${intervention_timing}`);
    
    // Fetch customers with predictions
    let query = `
      SELECT 
        c.*,
        cp.baseline_churn_prob,
        cp.risk_segment
      FROM customers c
      JOIN churn_predictions cp ON c.customer_id = cp.customer_id
    `;
    
    const params = [];
    
    if (customer_ids && customer_ids.length > 0) {
      query += ` WHERE c.customer_id = ANY($1)`;
      params.push(customer_ids);
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No customers found for simulation',
      });
    }
    
    // Run simulation
    const simulation = CounterfactualEngine.simulateScenario(
      result.rows,
      intervention_type,
      intervention_timing
    );
    
    // Optionally save results to database
    if (save_results) {
      const client = await pool.connect();
      try {
        for (const customerResult of simulation.customers) {
          await client.query(`
            INSERT INTO counterfactual_scenarios (
              customer_id,
              intervention_timing,
              intervention_type,
              counterfactual_churn_prob,
              saved,
              revenue_recovered,
              decision_regret_score
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            customerResult.customer_id,
            intervention_timing,
            intervention_type,
            customerResult.counterfactual_churn_prob,
            customerResult.saved,
            customerResult.revenue_recovered,
            customerResult.decision_regret_score,
          ]);
        }
        logger.info(`Saved ${simulation.customers.length} counterfactual scenarios to database`);
      } finally {
        client.release();
      }
    }
    
    res.json({
      success: true,
      simulation,
    });
    
  } catch (error) {
    logger.error('Error running counterfactual simulation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run counterfactual simulation',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/counterfactual/scenarios
 * @desc    Get saved counterfactual scenarios
 * @access  Public
 */
router.get('/scenarios', async (req, res) => {
  try {
    const { customer_id, intervention_type, limit = 100 } = req.query;
    
    let query = `
      SELECT 
        cs.*,
        c.company,
        c.revenue
      FROM counterfactual_scenarios cs
      JOIN customers c ON cs.customer_id = c.customer_id
    `;
    
    const params = [];
    const conditions = [];
    
    if (customer_id) {
      conditions.push(`cs.customer_id = $${params.length + 1}`);
      params.push(customer_id);
    }
    
    if (intervention_type) {
      conditions.push(`cs.intervention_type = $${params.length + 1}`);
      params.push(intervention_type);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY cs.simulation_date DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      scenarios: result.rows,
    });
    
  } catch (error) {
    logger.error('Error fetching scenarios:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch counterfactual scenarios',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/counterfactual/compare
 * @desc    Compare multiple intervention scenarios
 * @access  Public
 */
router.post('/compare', async (req, res) => {
  try {
    const { customer_ids = null } = req.body;
    
    // Fetch customers
    let query = `
      SELECT 
        c.*,
        cp.baseline_churn_prob,
        cp.risk_segment
      FROM customers c
      JOIN churn_predictions cp ON c.customer_id = cp.customer_id
    `;
    
    const params = [];
    if (customer_ids && customer_ids.length > 0) {
      query += ` WHERE c.customer_id = ANY($1)`;
      params.push(customer_ids);
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No customers found',
      });
    }
    
    // Run multiple scenarios
    const interventionTypes = ['proactive_outreach', 'priority_support', 'discount_offer'];
    const timingOptions = ['7d_earlier', '14d_earlier', '30d_earlier'];
    
    const comparisons = [];
    
    for (const interventionType of interventionTypes) {
      for (const timing of timingOptions) {
        const simulation = CounterfactualEngine.simulateScenario(
          result.rows,
          interventionType,
          timing
        );
        
        comparisons.push({
          intervention_type: interventionType,
          intervention_timing: timing,
          summary: simulation.summary,
        });
      }
    }
    
    // Sort by revenue recovered (descending)
    comparisons.sort((a, b) => b.summary.revenue_recovered - a.summary.revenue_recovered);
    
    res.json({
      success: true,
      best_scenario: comparisons[0],
      all_scenarios: comparisons,
    });
    
  } catch (error) {
    logger.error('Error comparing scenarios:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare scenarios',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/counterfactual/recommendations/:customerId
 * @desc    Get best intervention recommendation for a customer
 * @access  Public
 */
router.get('/recommendations/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        c.*,
        cp.baseline_churn_prob,
        cp.risk_segment
      FROM customers c
      JOIN churn_predictions cp ON c.customer_id = cp.customer_id
      WHERE c.customer_id = $1
    `, [customerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }
    
    const customer = result.rows[0];
    const recommendation = CounterfactualEngine.findBestIntervention(customer);
    
    res.json({
      success: true,
      customer_id: customerId,
      recommendation,
    });
    
  } catch (error) {
    logger.error('Error getting recommendation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendation',
      message: error.message,
    });
  }
});

module.exports = router;
