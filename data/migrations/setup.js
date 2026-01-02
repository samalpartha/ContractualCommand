const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'counterfactual_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Creating database schema...');
    
    // Customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) UNIQUE NOT NULL,
        company VARCHAR(255) NOT NULL,
        revenue DECIMAL(10, 2) NOT NULL,
        tenure INTEGER NOT NULL,
        engagement_score DECIMAL(5, 2) NOT NULL,
        support_response_time DECIMAL(6, 2) NOT NULL,
        last_activity_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Customers table created');
    
    // Churn predictions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS churn_predictions (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) NOT NULL,
        baseline_churn_prob DECIMAL(5, 4) NOT NULL,
        risk_segment VARCHAR(20) NOT NULL,
        predicted_churn_date DATE,
        model_version VARCHAR(50) DEFAULT '1.0',
        prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        features JSONB,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
      );
    `);
    console.log('✓ Churn predictions table created');
    
    // Counterfactual scenarios table
    await client.query(`
      CREATE TABLE IF NOT EXISTS counterfactual_scenarios (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) NOT NULL,
        intervention_timing VARCHAR(50) NOT NULL,
        intervention_type VARCHAR(50) NOT NULL,
        counterfactual_churn_prob DECIMAL(5, 4) NOT NULL,
        saved BOOLEAN NOT NULL,
        revenue_recovered DECIMAL(10, 2),
        decision_regret_score DECIMAL(10, 2),
        simulation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
      );
    `);
    console.log('✓ Counterfactual scenarios table created');
    
    // Decision regret table
    await client.query(`
      CREATE TABLE IF NOT EXISTS decision_regret (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) NOT NULL,
        actual_outcome VARCHAR(50) NOT NULL,
        best_counterfactual_outcome VARCHAR(50) NOT NULL,
        best_intervention_type VARCHAR(50) NOT NULL,
        best_intervention_timing VARCHAR(50) NOT NULL,
        regret_value DECIMAL(10, 2) NOT NULL,
        segment VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
      );
    `);
    console.log('✓ Decision regret table created');
    
    // Actions log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS actions_log (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        message TEXT,
        priority VARCHAR(20) DEFAULT 'normal',
        status VARCHAR(20) DEFAULT 'pending',
        triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        response JSONB,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
      );
    `);
    console.log('✓ Actions log table created');
    
    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);
      CREATE INDEX IF NOT EXISTS idx_customers_revenue ON customers(revenue DESC);
      CREATE INDEX IF NOT EXISTS idx_churn_predictions_customer_id ON churn_predictions(customer_id);
      CREATE INDEX IF NOT EXISTS idx_churn_predictions_risk_segment ON churn_predictions(risk_segment);
      CREATE INDEX IF NOT EXISTS idx_decision_regret_regret_value ON decision_regret(regret_value);
      CREATE INDEX IF NOT EXISTS idx_decision_regret_segment ON decision_regret(segment);
    `);
    console.log('✓ Indexes created');
    
    console.log('\n✅ Database setup complete!');
    
  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { setupDatabase };
