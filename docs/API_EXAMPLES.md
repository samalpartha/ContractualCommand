# API Usage Examples

## Table of Contents
1. [Customer Management](#customer-management)
2. [Churn Prediction](#churn-prediction)
3. [Counterfactual Simulation](#counterfactual-simulation)
4. [Decision Regret Analysis](#decision-regret-analysis)
5. [Action Triggers](#action-triggers)

---

## Customer Management

### Ingest Customer Data

**Single Customer:**
```bash
curl -X POST http://localhost:3000/api/customers/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_12345",
    "company": "Acme Corp",
    "revenue": 15000,
    "tenure": 450,
    "engagement_score": 75,
    "support_response_time": 8.5,
    "last_activity_date": "2024-01-15"
  }'
```

**Bulk Upload:**
```bash
curl -X POST http://localhost:3000/api/customers/ingest \
  -H "Content-Type: application/json" \
  -d '[
    {
      "customer_id": "cust_12345",
      "company": "Acme Corp",
      "revenue": 15000,
      "tenure": 450,
      "engagement_score": 75,
      "support_response_time": 8.5,
      "last_activity_date": "2024-01-15"
    },
    {
      "customer_id": "cust_67890",
      "company": "TechStart Inc",
      "revenue": 2500,
      "tenure": 90,
      "engagement_score": 45,
      "support_response_time": 36.2,
      "last_activity_date": "2023-12-20"
    }
  ]'
```

### Get All Customers

```bash
curl http://localhost:3000/api/customers?limit=20&offset=0
```

**With Risk Filter:**
```bash
curl http://localhost:3000/api/customers?risk_segment=high&limit=50
```

### Get Specific Customer

```bash
curl http://localhost:3000/api/customers/cust_12345
```

---

## Churn Prediction

### Get Baseline Churn Distribution

```bash
curl http://localhost:3000/api/churn/baseline
```

**Response:**
```json
{
  "success": true,
  "distribution": [
    {
      "risk_segment": "high",
      "count": 45,
      "avg_churn_prob": 0.7234,
      "total_revenue": 450000
    },
    {
      "risk_segment": "medium",
      "count": 82,
      "avg_churn_prob": 0.4521,
      "total_revenue": 320000
    },
    {
      "risk_segment": "low",
      "count": 73,
      "avg_churn_prob": 0.1823,
      "total_revenue": 180000
    }
  ],
  "overall": {
    "total_customers": 200,
    "avg_churn_prob": 0.4526,
    "high_risk_count": 45,
    "medium_risk_count": 82,
    "low_risk_count": 73
  },
  "high_value_at_risk": [...]
}
```

### Get All Churn Predictions

```bash
curl http://localhost:3000/api/churn/predictions?risk_segment=high&limit=20
```

### Get Customer Prediction

```bash
curl http://localhost:3000/api/churn/predictions/cust_12345
```

---

## Counterfactual Simulation

### Simulate Single Scenario

**Scenario: Proactive Outreach 14 days earlier**
```bash
curl -X POST http://localhost:3000/api/counterfactual/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "intervention_timing": "14d_earlier",
    "intervention_type": "proactive_outreach",
    "save_results": true
  }'
```

**Response:**
```json
{
  "success": true,
  "simulation": {
    "scenario": {
      "intervention_type": "proactive_outreach",
      "intervention_timing": "14d_earlier"
    },
    "summary": {
      "total_customers": 200,
      "customers_saved": 38,
      "revenue_at_risk": 950000,
      "revenue_recovered": 285000,
      "revenue_recovery_rate": 30.0,
      "churn_avoided_percent": 38.2,
      "total_decision_regret": -665000,
      "avg_churn_reduction": 0.1245
    },
    "customers": [...]
  }
}
```

### Simulate for Specific Customers

```bash
curl -X POST http://localhost:3000/api/counterfactual/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "customer_ids": ["cust_12345", "cust_67890"],
    "intervention_timing": "7d_earlier",
    "intervention_type": "discount_offer"
  }'
```

### Compare All Scenarios

```bash
curl -X POST http://localhost:3000/api/counterfactual/compare \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**
```json
{
  "success": true,
  "best_scenario": {
    "intervention_type": "discount_offer",
    "intervention_timing": "30d_earlier",
    "summary": {
      "customers_saved": 52,
      "revenue_recovered": 380000
    }
  },
  "all_scenarios": [...]
}
```

### Get Best Intervention for Customer

```bash
curl http://localhost:3000/api/counterfactual/recommendations/cust_12345
```

**Response:**
```json
{
  "success": true,
  "customer_id": "cust_12345",
  "recommendation": {
    "customer_id": "cust_12345",
    "company": "Acme Corp",
    "baseline_churn_prob": 0.68,
    "counterfactual_churn_prob": 0.42,
    "churn_reduction": 0.26,
    "saved": true,
    "revenue_recovered": 15000,
    "intervention_type": "proactive_outreach",
    "intervention_timing": "14d_earlier"
  }
}
```

---

## Decision Regret Analysis

### Get Regret Leaderboard

```bash
curl http://localhost:3000/api/regret/leaderboard?limit=20
```

**With Segment Filter:**
```bash
curl http://localhost:3000/api/regret/leaderboard?segment=enterprise&limit=10
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total_regrets": 30,
    "total_regret_value": -850000,
    "avg_regret_value": -28333.33
  },
  "leaderboard": [
    {
      "customer_id": "cust_00042",
      "company": "Global Enterprises",
      "revenue": 95000,
      "regret_value": -95000,
      "actual_outcome": "churned",
      "best_counterfactual_outcome": "saved",
      "best_intervention_type": "proactive_outreach",
      "best_intervention_timing": "14d_earlier"
    },
    ...
  ]
}
```

### Get Regret Heatmap

```bash
curl http://localhost:3000/api/regret/heatmap
```

**Response:**
```json
{
  "success": true,
  "heatmap": [
    {
      "segment": "enterprise",
      "intervention_type": "proactive_outreach",
      "total_regret": 285000,
      "affected_customers": 8,
      "avg_regret_per_customer": 35625
    },
    ...
  ]
}
```

### Get Actionable Insights

```bash
curl http://localhost:3000/api/regret/insights
```

**Response:**
```json
{
  "success": true,
  "insights": [
    {
      "type": "top_missed_opportunity",
      "title": "12 customers could have been saved with proactive_outreach",
      "description": "Applying proactive_outreach 14d_earlier could have prevented $285,000 in lost revenue.",
      "severity": "high",
      "recommended_action": "Implement proactive_outreach with 14d_earlier timing"
    }
  ],
  "top_patterns": [...],
  "segment_analysis": [...]
}
```

---

## Action Triggers

### Trigger Slack Alert

```bash
curl -X POST http://localhost:3000/api/actions/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "customer_ids": ["cust_12345", "cust_67890"],
    "action_type": "slack_alert",
    "message": "High risk customers need immediate attention",
    "priority": "high"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "slack_alert triggered for 2 customers",
  "action_result": {
    "success": true,
    "response": "ok"
  },
  "customers_affected": 2
}
```

### Trigger Salesforce Task

```bash
curl -X POST http://localhost:3000/api/actions/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "customer_ids": ["cust_12345"],
    "action_type": "salesforce_task",
    "message": "Call customer - high churn risk",
    "priority": "high"
  }'
```

### Get Action Log

```bash
curl http://localhost:3000/api/actions/log?limit=50
```

**With Filters:**
```bash
curl http://localhost:3000/api/actions/log?action_type=slack_alert&status=completed
```

### Get Customers in Regret Zone

```bash
curl http://localhost:3000/api/actions/regret-zone
```

**Response:**
```json
{
  "success": true,
  "count": 12,
  "total_revenue_at_risk": 250000,
  "customers": [
    {
      "customer_id": "cust_00015",
      "company": "Tech Solutions Ltd",
      "revenue": 35000,
      "baseline_churn_prob": 0.78,
      "engagement_score": 28,
      "days_inactive": 45
    },
    ...
  ],
  "recommendation": {
    "action": "proactive_outreach",
    "timing": "7d_earlier",
    "urgency": "high",
    "time_window": "48h"
  }
}
```

---

## Tableau Integration Examples

### Dashboard Parameter Binding

**Tableau Parameters → API Calls:**

1. **Intervention Type Parameter** (dropdown)
   - Values: `proactive_outreach`, `priority_support`, `discount_offer`, `none`

2. **Intervention Timing Parameter** (slider)
   - Values: `no_action`, `7d_earlier`, `14d_earlier`, `30d_earlier`

3. **Tableau Data Source (Live REST Connection):**
```
URL: http://localhost:3000/api/counterfactual/simulate
Method: POST
Body: {
  "intervention_timing": [Intervention Timing],
  "intervention_type": [Intervention Type]
}
```

### Tableau Calculated Fields

**Customers Saved:**
```
SUM([customers_saved])
```

**Revenue Recovery Rate:**
```
SUM([revenue_recovered]) / SUM([revenue_at_risk]) * 100
```

**Decision Regret (formatted):**
```
"$" + STR(ABS([total_decision_regret]))
```

---

## Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected"
}
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## Rate Limiting (Future)

Recommended for production:
- 1000 requests/hour per IP
- Burst allowance: 50 requests/minute
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
