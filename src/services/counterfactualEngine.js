/**
 * Counterfactual Engine
 * 
 * Simulates alternate futures based on intervention timing and type
 */

const logger = require('../config/logger');

// Intervention effects (baseline reductions in churn probability)
const INTERVENTION_EFFECTS = {
  proactive_outreach: -0.15,   // -15% churn if delivered within 7d
  priority_support: -0.10,     // -10% churn if response time improves
  discount_offer: -0.20,       // -20% churn but -5% margin
  none: 0,
};

// Timing decay: effectiveness reduces by 5% per week of delay
const TIMING_DECAY_PER_WEEK = 0.05;

// Timing options in days
const TIMING_OPTIONS = {
  no_action: 0,
  '7d_earlier': 7,
  '14d_earlier': 14,
  '30d_earlier': 30,
};

class CounterfactualEngine {
  /**
   * Calculate counterfactual churn probability
   * 
   * @param {number} baselineChurnProb - Baseline churn probability (0-1)
   * @param {string} interventionType - Type of intervention
   * @param {string} interventionTiming - Timing of intervention
   * @returns {number} - Counterfactual churn probability
   */
  static calculateCounterfactualChurn(baselineChurnProb, interventionType, interventionTiming) {
    // Get base intervention effect
    const interventionEffect = INTERVENTION_EFFECTS[interventionType] || 0;
    
    if (interventionEffect === 0) {
      return baselineChurnProb;
    }
    
    // Get timing in days
    const daysEarlier = TIMING_OPTIONS[interventionTiming] || 0;
    
    if (daysEarlier === 0) {
      return baselineChurnProb;
    }
    
    // Calculate effectiveness decay based on timing
    const weeksDelay = Math.max(0, (30 - daysEarlier) / 7); // Assume 30 days is "now"
    const effectivenessDecay = 1 - (weeksDelay * TIMING_DECAY_PER_WEEK);
    const adjustedEffect = interventionEffect * Math.max(0.3, effectivenessDecay); // Min 30% effectiveness
    
    // Calculate counterfactual churn probability
    const counterfactualChurn = Math.max(0, Math.min(1, baselineChurnProb + adjustedEffect));
    
    return counterfactualChurn;
  }
  
  /**
   * Determine if customer is saved by intervention
   * 
   * @param {number} baselineChurnProb - Baseline churn probability
   * @param {number} counterfactualChurnProb - Counterfactual churn probability
   * @param {number} threshold - Threshold for "saved" (default 0.5)
   * @returns {boolean} - True if customer is saved
   */
  static isCustomerSaved(baselineChurnProb, counterfactualChurnProb, threshold = 0.5) {
    return baselineChurnProb >= threshold && counterfactualChurnProb < threshold;
  }
  
  /**
   * Calculate decision regret score
   * 
   * Decision Regret = Actual Outcome - Best Counterfactual Outcome
   * 
   * @param {number} revenue - Customer revenue
   * @param {boolean} actuallyChurned - Whether customer actually churned
   * @param {boolean} wouldBeSaved - Whether customer would be saved by intervention
   * @returns {number} - Regret value (negative = loss)
   */
  static calculateDecisionRegret(revenue, actuallyChurned, wouldBeSaved) {
    if (actuallyChurned && wouldBeSaved) {
      // Lost customer who could have been saved = full revenue loss
      return -revenue;
    } else if (!actuallyChurned && !wouldBeSaved) {
      // Retained customer who wouldn't have been saved anyway = no regret
      return 0;
    } else if (actuallyChurned && !wouldBeSaved) {
      // Lost customer who couldn't be saved = no regret (unavoidable)
      return 0;
    } else {
      // Retained customer = positive outcome, no regret
      return 0;
    }
  }
  
  /**
   * Simulate counterfactual scenario for a single customer
   * 
   * @param {object} customer - Customer data with churn prediction
   * @param {string} interventionType - Type of intervention
   * @param {string} interventionTiming - Timing of intervention
   * @returns {object} - Simulation result
   */
  static simulateCustomer(customer, interventionType, interventionTiming) {
    const baselineChurnProb = parseFloat(customer.baseline_churn_prob);
    const revenue = parseFloat(customer.revenue);
    
    // Calculate counterfactual churn probability
    const counterfactualChurnProb = this.calculateCounterfactualChurn(
      baselineChurnProb,
      interventionType,
      interventionTiming
    );
    
    // Determine if customer is saved
    const saved = this.isCustomerSaved(baselineChurnProb, counterfactualChurnProb);
    
    // Calculate revenue recovered (if saved)
    const revenueRecovered = saved ? revenue : 0;
    
    // Calculate decision regret (assume high-risk customers would churn)
    const actuallyChurned = baselineChurnProb >= 0.6;
    const decisionRegretScore = this.calculateDecisionRegret(
      revenue,
      actuallyChurned,
      saved
    );
    
    // Calculate churn reduction
    const churnReduction = baselineChurnProb - counterfactualChurnProb;
    const churnReductionPercent = (churnReduction / baselineChurnProb) * 100;
    
    return {
      customer_id: customer.customer_id,
      company: customer.company,
      baseline_churn_prob: baselineChurnProb,
      counterfactual_churn_prob: counterfactualChurnProb,
      churn_reduction: churnReduction,
      churn_reduction_percent: churnReductionPercent,
      saved,
      revenue,
      revenue_recovered: revenueRecovered,
      decision_regret_score: decisionRegretScore,
      intervention_type: interventionType,
      intervention_timing: interventionTiming,
    };
  }
  
  /**
   * Simulate counterfactual scenario for multiple customers
   * 
   * @param {array} customers - Array of customer data
   * @param {string} interventionType - Type of intervention
   * @param {string} interventionTiming - Timing of intervention
   * @returns {object} - Aggregated simulation results
   */
  static simulateScenario(customers, interventionType, interventionTiming) {
    logger.info(`Simulating scenario: ${interventionType} / ${interventionTiming}`);
    
    // Simulate each customer
    const individualResults = customers.map(customer =>
      this.simulateCustomer(customer, interventionType, interventionTiming)
    );
    
    // Aggregate results
    const customersSaved = individualResults.filter(r => r.saved).length;
    const totalRevenue = individualResults.reduce((sum, r) => sum + r.revenue, 0);
    const revenueRecovered = individualResults.reduce((sum, r) => sum + r.revenue_recovered, 0);
    const totalRegret = individualResults.reduce((sum, r) => sum + r.decision_regret_score, 0);
    const avgChurnReduction = individualResults.reduce((sum, r) => sum + r.churn_reduction, 0) / individualResults.length;
    
    // Calculate churn avoided percentage
    const baselineChurned = individualResults.filter(r => r.baseline_churn_prob >= 0.5).length;
    const counterfactualChurned = individualResults.filter(r => r.counterfactual_churn_prob >= 0.5).length;
    const churnAvoided = baselineChurned > 0 
      ? ((baselineChurned - counterfactualChurned) / baselineChurned) * 100
      : 0;
    
    return {
      scenario: {
        intervention_type: interventionType,
        intervention_timing: interventionTiming,
      },
      summary: {
        total_customers: customers.length,
        customers_saved: customersSaved,
        revenue_at_risk: totalRevenue,
        revenue_recovered: revenueRecovered,
        revenue_recovery_rate: totalRevenue > 0 ? (revenueRecovered / totalRevenue) * 100 : 0,
        churn_avoided_percent: churnAvoided,
        total_decision_regret: totalRegret,
        avg_churn_reduction: avgChurnReduction,
      },
      customers: individualResults,
    };
  }
  
  /**
   * Find best intervention for a customer
   * 
   * @param {object} customer - Customer data
   * @returns {object} - Best intervention recommendation
   */
  static findBestIntervention(customer) {
    const interventionTypes = Object.keys(INTERVENTION_EFFECTS).filter(t => t !== 'none');
    const timingOptions = Object.keys(TIMING_OPTIONS).filter(t => t !== 'no_action');
    
    let bestResult = null;
    let bestScore = -Infinity;
    
    // Try all combinations
    for (const interventionType of interventionTypes) {
      for (const timing of timingOptions) {
        const result = this.simulateCustomer(customer, interventionType, timing);
        
        // Score = churn reduction + (saved ? bonus : 0)
        const score = result.churn_reduction + (result.saved ? 0.3 : 0);
        
        if (score > bestScore) {
          bestScore = score;
          bestResult = result;
        }
      }
    }
    
    return bestResult;
  }
}

module.exports = CounterfactualEngine;
