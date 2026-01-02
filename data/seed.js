const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'counterfactual_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Generate realistic company names
const companyPrefixes = ['Acme', 'Apex', 'Global', 'Summit', 'Prime', 'Vertex', 'Nexus', 'Quantum', 'Stellar', 'Fusion'];
const companySuffixes = ['Technologies', 'Solutions', 'Systems', 'Enterprises', 'Industries', 'Corp', 'Group', 'Labs', 'Digital', 'Innovations'];

function generateCompanyName() {
  const prefix = companyPrefixes[Math.floor(Math.random() * companyPrefixes.length)];
  const suffix = companySuffixes[Math.floor(Math.random() * companySuffixes.length)];
  return `${prefix} ${suffix}`;
}

function getRandomDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString().split('T')[0];
}

function generateCustomer(index) {
  const customerId = `cust_${String(index).padStart(5, '0')}`;
  const company = generateCompanyName();
  
  // Revenue follows power law (few high-value, many low-value)
  const revenue = Math.random() < 0.1 
    ? Math.floor(Math.random() * 90000) + 10000  // 10% high-value ($10K-$100K)
    : Math.floor(Math.random() * 4000) + 500;     // 90% normal ($500-$4.5K)
  
  // Tenure in days (newer customers churn more)
  const tenure = Math.floor(Math.random() * 1825); // 0-5 years
  
  // Engagement score (0-100)
  // Correlate with tenure: older customers tend to have more stable engagement
  const baseEngagement = tenure > 365 ? 60 : 40;
  const engagement_score = Math.max(0, Math.min(100, baseEngagement + (Math.random() * 40 - 20)));
  
  // Support response time in hours
  // Higher for at-risk customers
  const support_response_time = engagement_score < 30 
    ? Math.random() * 72 + 24  // 24-96 hours for low engagement
    : Math.random() * 12 + 2;   // 2-14 hours for normal
  
  // Last activity date
  const daysInactive = engagement_score < 30 
    ? Math.floor(Math.random() * 60) + 30  // 30-90 days for low engagement
    : Math.floor(Math.random() * 14);       // 0-14 days for normal
  const last_activity_date = getRandomDate(daysInactive);
  
  return {
    customer_id: customerId,
    company,
    revenue: revenue.toFixed(2),
    tenure,
    engagement_score: engagement_score.toFixed(2),
    support_response_time: support_response_time.toFixed(2),
    last_activity_date,
  };
}

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Generating synthetic customer data...');
    
    // Clear existing data
    await client.query('DELETE FROM actions_log');
    await client.query('DELETE FROM decision_regret');
    await client.query('DELETE FROM counterfactual_scenarios');
    await client.query('DELETE FROM churn_predictions');
    await client.query('DELETE FROM customers');
    console.log('✓ Cleared existing data');
    
    // Generate 200 customers
    const customers = [];
    for (let i = 1; i <= 200; i++) {
      customers.push(generateCustomer(i));
    }
    
    // Insert customers in batches
    console.log('Inserting customers...');
    for (const customer of customers) {
      await client.query(`
        INSERT INTO customers (
          customer_id, company, revenue, tenure, engagement_score,
          support_response_time, last_activity_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        customer.customer_id,
        customer.company,
        customer.revenue,
        customer.tenure,
        customer.engagement_score,
        customer.support_response_time,
        customer.last_activity_date,
      ]);
    }
    
    console.log(`✓ Inserted ${customers.length} customers`);
    
    // Generate basic churn predictions (will be updated by ML model)
    console.log('Generating baseline churn predictions...');
    const customerRecords = await client.query('SELECT * FROM customers');
    
    for (const customer of customerRecords.rows) {
      // Simple rule-based baseline prediction
      let baselineChurnProb = 0.3; // Default 30%
      
      // Factors that increase churn probability
      if (customer.engagement_score < 30) baselineChurnProb += 0.3;
      else if (customer.engagement_score < 50) baselineChurnProb += 0.15;
      
      if (customer.support_response_time > 48) baselineChurnProb += 0.2;
      else if (customer.support_response_time > 24) baselineChurnProb += 0.1;
      
      if (customer.tenure < 90) baselineChurnProb += 0.2;
      else if (customer.tenure < 365) baselineChurnProb += 0.1;
      
      // Cap at 0.95
      baselineChurnProb = Math.min(0.95, baselineChurnProb);
      
      // Determine risk segment
      let riskSegment;
      if (baselineChurnProb >= 0.6) riskSegment = 'high';
      else if (baselineChurnProb >= 0.3) riskSegment = 'medium';
      else riskSegment = 'low';
      
      // Predicted churn date (if high risk)
      const predictedChurnDate = baselineChurnProb >= 0.6 
        ? getRandomDate(-30) // Predict churn in next 30 days
        : null;
      
      await client.query(`
        INSERT INTO churn_predictions (
          customer_id, baseline_churn_prob, risk_segment, predicted_churn_date, features
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        customer.customer_id,
        baselineChurnProb.toFixed(4),
        riskSegment,
        predictedChurnDate,
        JSON.stringify({
          engagement_score: customer.engagement_score,
          tenure: customer.tenure,
          support_response_time: customer.support_response_time,
          revenue: customer.revenue,
        }),
      ]);
    }
    
    console.log(`✓ Generated ${customerRecords.rows.length} churn predictions`);
    
    // Generate decision regret entries for high-risk customers who "churned"
    console.log('Generating decision regret data...');
    const highRiskCustomers = await client.query(`
      SELECT c.*, cp.baseline_churn_prob
      FROM customers c
      JOIN churn_predictions cp ON c.customer_id = cp.customer_id
      WHERE cp.risk_segment = 'high'
      LIMIT 30
    `);
    
    for (const customer of highRiskCustomers.rows) {
      // Simulate that these customers churned
      const actualOutcome = 'churned';
      const bestCounterfactualOutcome = 'saved';
      const bestInterventionType = 'proactive_outreach';
      const bestInterventionTiming = '14d_earlier';
      
      // Regret value = lost revenue (negative means loss)
      const regretValue = -parseFloat(customer.revenue);
      
      // Segment by revenue
      let segment;
      if (customer.revenue >= 10000) segment = 'enterprise';
      else if (customer.revenue >= 2000) segment = 'mid_market';
      else segment = 'smb';
      
      await client.query(`
        INSERT INTO decision_regret (
          customer_id, actual_outcome, best_counterfactual_outcome,
          best_intervention_type, best_intervention_timing,
          regret_value, segment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        customer.customer_id,
        actualOutcome,
        bestCounterfactualOutcome,
        bestInterventionType,
        bestInterventionTiming,
        regretValue.toFixed(2),
        segment,
      ]);
    }
    
    console.log(`✓ Generated ${highRiskCustomers.rows.length} decision regret entries`);
    
    // Summary statistics
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(*) FILTER (WHERE risk_segment = 'high') as high_risk,
        COUNT(*) FILTER (WHERE risk_segment = 'medium') as medium_risk,
        COUNT(*) FILTER (WHERE risk_segment = 'low') as low_risk,
        ROUND(AVG(baseline_churn_prob)::numeric, 4) as avg_churn_prob,
        ROUND(SUM(c.revenue) FILTER (WHERE cp.risk_segment = 'high')::numeric, 2) as revenue_at_risk
      FROM customers c
      JOIN churn_predictions cp ON c.customer_id = cp.customer_id
    `);
    
    console.log('\n📊 Database Summary:');
    console.log(`   Total Customers: ${stats.rows[0].total_customers}`);
    console.log(`   High Risk: ${stats.rows[0].high_risk}`);
    console.log(`   Medium Risk: ${stats.rows[0].medium_risk}`);
    console.log(`   Low Risk: ${stats.rows[0].low_risk}`);
    console.log(`   Avg Churn Probability: ${stats.rows[0].avg_churn_prob}`);
    console.log(`   Revenue at Risk: $${stats.rows[0].revenue_at_risk}`);
    
    console.log('\n✅ Database seeding complete!');
    
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
