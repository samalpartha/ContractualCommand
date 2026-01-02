const request = require('supertest');
const app = require('../src/index');

describe('API Health Checks', () => {
  test('GET / should return API information', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('version');
  });

  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status');
  });
});

describe('Customer Endpoints', () => {
  test('POST /api/customers/ingest should accept customer data', async () => {
    const customerData = {
      customer_id: 'test_001',
      company: 'Test Corp',
      revenue: 5000,
      tenure: 180,
      engagement_score: 65,
      support_response_time: 12,
      last_activity_date: '2024-01-01',
    };

    const response = await request(app)
      .post('/api/customers/ingest')
      .send(customerData)
      .set('Content-Type', 'application/json');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
  });

  test('GET /api/customers should return customer list', async () => {
    const response = await request(app).get('/api/customers?limit=10');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('customers');
    expect(Array.isArray(response.body.customers)).toBe(true);
  });
});

describe('Churn Endpoints', () => {
  test('GET /api/churn/baseline should return distribution', async () => {
    const response = await request(app).get('/api/churn/baseline');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('distribution');
    expect(response.body).toHaveProperty('overall');
  });

  test('GET /api/churn/predictions should return predictions', async () => {
    const response = await request(app).get('/api/churn/predictions?limit=5');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('predictions');
  });
});

describe('Counterfactual Endpoints', () => {
  test('POST /api/counterfactual/simulate should run simulation', async () => {
    const simulationParams = {
      intervention_timing: '14d_earlier',
      intervention_type: 'proactive_outreach',
      save_results: false,
    };

    const response = await request(app)
      .post('/api/counterfactual/simulate')
      .send(simulationParams)
      .set('Content-Type', 'application/json');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('simulation');
    expect(response.body.simulation).toHaveProperty('summary');
  });

  test('POST /api/counterfactual/compare should compare scenarios', async () => {
    const response = await request(app)
      .post('/api/counterfactual/compare')
      .send({})
      .set('Content-Type', 'application/json');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('best_scenario');
    expect(response.body).toHaveProperty('all_scenarios');
  });
});

describe('Regret Endpoints', () => {
  test('GET /api/regret/leaderboard should return ranked list', async () => {
    const response = await request(app).get('/api/regret/leaderboard?limit=10');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('leaderboard');
    expect(response.body).toHaveProperty('summary');
  });

  test('GET /api/regret/heatmap should return heatmap data', async () => {
    const response = await request(app).get('/api/regret/heatmap');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('heatmap');
  });
});

describe('Action Endpoints', () => {
  test('GET /api/actions/regret-zone should return urgent customers', async () => {
    const response = await request(app).get('/api/actions/regret-zone');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('customers');
    expect(response.body).toHaveProperty('recommendation');
  });

  test('GET /api/actions/log should return action history', async () => {
    const response = await request(app).get('/api/actions/log?limit=10');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('actions');
  });
});
