const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../config/logger');

/**
 * @route   GET /api/regret/leaderboard
 * @desc    Get ranked list of most regrettable lost customers
 * @access  Public
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { segment, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        dr.*,
        c.company,
        c.revenue,
        c.tenure,
        c.engagement_score,
        cp.baseline_churn_prob
      FROM decision_regret dr
      JOIN customers c ON dr.customer_id = c.customer_id
      LEFT JOIN churn_predictions cp ON dr.customer_id = cp.customer_id
    `;
    
    const params = [];
    
    if (segment) {
      query += ` WHERE dr.segment = $${params.length + 1}`;
      params.push(segment);
    }
    
    query += ` ORDER BY dr.regret_value ASC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    // Get summary statistics
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_regrets,
        ROUND(SUM(regret_value)::numeric, 2) as total_regret_value,
        ROUND(AVG(regret_value)::numeric, 2) as avg_regret_value,
        COUNT(DISTINCT segment) as segments_affected
      FROM decision_regret
      ${segment ? 'WHERE segment = $1' : ''}
    `, segment ? [segment] : []);
    
    res.json({
      success: true,
      summary: summary.rows[0],
      leaderboard: result.rows,
    });
    
  } catch (error) {
    logger.error('Error fetching regret leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regret leaderboard',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/regret/heatmap
 * @desc    Get regret heatmap by segment and intervention type
 * @access  Public
 */
router.get('/heatmap', async (req, res) => {
  try {
    // Calculate potential regret by simulating what would happen with each intervention
    const customers = await pool.query(`
      SELECT 
        c.*,
        cp.baseline_churn_prob,
        CASE 
          WHEN c.revenue >= 10000 THEN 'enterprise'
          WHEN c.revenue >= 2000 THEN 'mid_market'
          ELSE 'smb'
        END as segment
      FROM customers c
      JOIN churn_predictions cp ON c.customer_id = cp.customer_id
      WHERE cp.risk_segment = 'high'
    `);
    
    // Calculate regret for each segment × intervention combination
    const segments = ['enterprise', 'mid_market', 'smb'];
    const interventions = ['proactive_outreach', 'priority_support', 'discount_offer', 'none'];
    
    const heatmapData = [];
    
    for (const segment of segments) {
      const segmentCustomers = customers.rows.filter(c => c.segment === segment);
      
      for (const intervention of interventions) {
        // Simulate: assume no action was taken (customer churned)
        // Calculate what would have happened with this intervention
        const CounterfactualEngine = require('../services/counterfactualEngine');
        
        let totalRegret = 0;
        let affectedCustomers = 0;
        
        for (const customer of segmentCustomers) {
          // Simulate with 14d_earlier timing
          const result = CounterfactualEngine.simulateCustomer(
            customer,
            intervention,
            '14d_earlier'
          );
          
          // If customer would have been saved, that's regret for not doing it
          if (result.saved) {
            totalRegret += Math.abs(result.revenue);
            affectedCustomers++;
          }
        }
        
        heatmapData.push({
          segment,
          intervention_type: intervention,
          total_regret: totalRegret,
          affected_customers: affectedCustomers,
          avg_regret_per_customer: affectedCustomers > 0 ? totalRegret / affectedCustomers : 0,
        });
      }
    }
    
    // Sort by total regret (descending)
    heatmapData.sort((a, b) => b.total_regret - a.total_regret);
    
    res.json({
      success: true,
      heatmap: heatmapData,
    });
    
  } catch (error) {
    logger.error('Error generating regret heatmap:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate regret heatmap',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/regret/insights
 * @desc    Get actionable insights from regret analysis
 * @access  Public
 */
router.get('/insights', async (req, res) => {
  try {
    // Get top patterns of regret
    const topPatterns = await pool.query(`
      SELECT 
        best_intervention_type,
        best_intervention_timing,
        COUNT(*) as occurrence_count,
        ROUND(SUM(ABS(regret_value))::numeric, 2) as total_regret,
        ROUND(AVG(ABS(regret_value))::numeric, 2) as avg_regret
      FROM decision_regret
      GROUP BY best_intervention_type, best_intervention_timing
      ORDER BY total_regret DESC
      LIMIT 10
    `);
    
    // Get regret by segment
    const segmentAnalysis = await pool.query(`
      SELECT 
        segment,
        COUNT(*) as customer_count,
        ROUND(SUM(ABS(regret_value))::numeric, 2) as total_regret,
        ROUND(AVG(ABS(regret_value))::numeric, 2) as avg_regret_per_customer
      FROM decision_regret
      GROUP BY segment
      ORDER BY total_regret DESC
    `);
    
    // Generate insights
    const insights = [];
    
    if (topPatterns.rows.length > 0) {
      const top = topPatterns.rows[0];
      insights.push({
        type: 'top_missed_opportunity',
        title: `${top.occurrence_count} customers could have been saved with ${top.best_intervention_type}`,
        description: `Applying ${top.best_intervention_type} ${top.best_intervention_timing} could have prevented $${top.total_regret.toLocaleString()} in lost revenue.`,
        severity: 'high',
        recommended_action: `Implement ${top.best_intervention_type} with ${top.best_intervention_timing} timing`,
      });
    }
    
    if (segmentAnalysis.rows.length > 0) {
      const topSegment = segmentAnalysis.rows[0];
      insights.push({
        type: 'segment_focus',
        title: `${topSegment.segment} segment shows highest regret`,
        description: `${topSegment.customer_count} ${topSegment.segment} customers lost with total regret of $${topSegment.total_regret.toLocaleString()}.`,
        severity: 'medium',
        recommended_action: `Prioritize retention efforts for ${topSegment.segment} customers`,
      });
    }
    
    res.json({
      success: true,
      insights,
      top_patterns: topPatterns.rows,
      segment_analysis: segmentAnalysis.rows,
    });
    
  } catch (error) {
    logger.error('Error generating insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate insights',
      message: error.message,
    });
  }
});

module.exports = router;
