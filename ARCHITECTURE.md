# Architecture Documentation

## System Overview

The Counterfactual Command Center is built using a 5-box model architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Data Layer                       │
│  (PostgreSQL + Ingest API)                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Churn Model                            │
│  (Python/scikit-learn + Random Forest)                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Counterfactual Engine                       │
│  (Node.js + Rule-based Simulations)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               Tableau Command Center                         │
│  (REST API + Interactive Dashboard)                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Action Layer                            │
│  (Slack + Salesforce + Email)                               │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Customer Data Layer

**Technology:** PostgreSQL 14+
**Purpose:** Store and manage customer data, churn predictions, and simulation results

**Tables:**
- `customers` - Core customer information
- `churn_predictions` - ML model predictions
- `counterfactual_scenarios` - Simulation results
- `decision_regret` - Regret analysis
- `actions_log` - Action audit trail

**API Endpoints:**
- `POST /api/customers/ingest` - Bulk customer data upload
- `GET /api/customers` - Query customers with filters
- `GET /api/customers/:id` - Individual customer details

### 2. Churn Model

**Technology:** Python 3.9+, scikit-learn, SHAP
**Model Type:** Random Forest Classifier
**Training:** Supervised learning on historical churn data

**Features:**
1. Engagement Score (0-100)
2. Tenure (days as customer)
3. Support Response Time (hours)
4. Revenue (monthly)
5. Days Since Last Activity

**Output:**
- Churn Probability (0-1)
- Risk Segment (high/medium/low)
- Top Churn Drivers (SHAP values)
- Explanations

**Performance Targets:**
- Accuracy: >75%
- Precision: >70%
- Recall: >65%
- ROC AUC: >0.80

### 3. Counterfactual Engine

**Technology:** Node.js
**Purpose:** Simulate alternate futures with different intervention strategies

**Intervention Types:**
1. **Proactive Outreach** (-15% churn)
2. **Priority Support** (-10% churn)
3. **Discount Offer** (-20% churn, -5% margin)
4. **None** (baseline)

**Timing Options:**
- No action (baseline)
- 7 days earlier
- 14 days earlier
- 30 days earlier

**Effectiveness Decay:**
- Each 7-day delay reduces effectiveness by 5%
- Minimum 30% effectiveness retained

**Decision Regret Formula:**
```
Decision Regret = Actual Outcome - Best Counterfactual Outcome

Where:
- Actual Outcome = Revenue lost if churned, 0 if retained
- Best Counterfactual = Revenue saved by best intervention
```

**API Endpoints:**
- `POST /api/counterfactual/simulate` - Run scenario
- `POST /api/counterfactual/compare` - Compare multiple scenarios
- `GET /api/counterfactual/recommendations/:id` - Get best intervention

### 4. Tableau Command Center

**Integration:** REST API → Tableau Parameters → Live Dashboard

**Dashboard Tabs:**

**Tab 1: Churn Baseline**
- Risk distribution histogram
- High-value customers at risk (table)
- Churn trend over time
- Revenue at risk by segment

**Tab 2: Counterfactual Simulator** ⭐ Core Innovation
- Interactive parameters:
  - Timing slider (no action → 30d earlier)
  - Intervention type dropdown
- Live metrics:
  - Customers Saved
  - Revenue Recovered
  - Churn Avoided %
  - Decision Regret Score
- Comparison table: baseline vs counterfactual

**Tab 3: Decision Regret Leaderboard**
- Heatmap: Segments × Intervention Type
- Top 20 Most Regrettable Decisions
- Filter by segment, date range, intervention

**Tab 4: Action Triggers**
- "Entering Regret Zone" customers
- Quick action buttons
- Audit log of actions taken

**API Endpoints for Tableau:**
- `GET /api/churn/baseline` - Distribution data
- `POST /api/counterfactual/simulate` - Scenario results
- `GET /api/regret/leaderboard` - Regret rankings
- `GET /api/regret/heatmap` - Heatmap data
- `GET /api/actions/regret-zone` - Urgent actions

### 5. Action Layer

**Integrations:**
1. **Slack** (via Webhooks)
2. **Salesforce** (REST API - coming soon)
3. **Email** (SMTP - coming soon)

**Slack Alert Types:**
- Regret Zone Alerts (high priority)
- High Risk Customers (batch alerts)
- Action Confirmations

**API Endpoints:**
- `POST /api/actions/trigger` - Fire campaign
- `GET /api/actions/log` - Action history
- `GET /api/actions/regret-zone` - Urgent customers

## Data Flow

### Customer Ingestion Flow
```
CRM/Usage Data → POST /api/customers/ingest → PostgreSQL
                                            ↓
                            python/train_model.py (batch)
                                            ↓
                            Churn Predictions → Database
```

### Simulation Flow
```
User adjusts parameters in Tableau
              ↓
POST /api/counterfactual/simulate
              ↓
Fetch customers + predictions from DB
              ↓
CounterfactualEngine.simulateScenario()
              ↓
Calculate counterfactual churn probabilities
              ↓
Determine saved customers & regret scores
              ↓
Return JSON → Tableau visualization updates
```

### Action Trigger Flow
```
User clicks "Trigger Action" in Tableau
              ↓
POST /api/actions/trigger
              ↓
Fetch customer details from DB
              ↓
Execute action (Slack/Salesforce/Email)
              ↓
Log action in actions_log table
              ↓
Return confirmation
```

## Security Considerations

1. **Database:** Use connection pooling with timeout limits
2. **API:** Rate limiting recommended for production
3. **Secrets:** Store in environment variables (.env)
4. **CORS:** Configure allowed origins for Tableau
5. **Validation:** Input validation on all endpoints

## Scalability

### Current Capacity
- ~10,000 customers
- Real-time simulations (<2s)
- Single PostgreSQL instance

### Scaling Strategy
1. **Database:** Vertical scaling (larger instance)
2. **API:** Horizontal scaling (multiple Node.js instances + load balancer)
3. **Caching:** Redis for frequently-accessed predictions
4. **Async:** Queue-based processing for batch simulations
5. **ML:** Model serving with dedicated Python service

## Monitoring & Observability

**Logs:**
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Winston logger with structured logging

**Metrics to Track:**
1. API response times
2. Database query performance
3. Model prediction latency
4. Action success rates
5. Simulation accuracy

**Health Checks:**
- `GET /health` - Database connectivity + API status

## Deployment

### Development
```bash
npm run dev  # Start API with nodemon
```

### Production
```bash
npm start  # Start API with Node.js
```

### Environment Variables
See `.env.example` for required configuration

### Database Initialization
```bash
npm run db:setup    # Create tables
npm run data:seed   # Generate synthetic data
npm run model:train # Train churn model
```

## Future Enhancements (Phase 2)

1. **Real-time Streaming**
   - Kafka-based event ingestion
   - Live churn score updates

2. **Advanced ML**
   - Deep learning models (LSTM for time series)
   - Bayesian networks for causal inference
   - A/B test framework for validation

3. **Enhanced Integrations**
   - Salesforce Flows + Record Updates
   - HubSpot CRM
   - Zendesk for support data
   - Stripe for revenue tracking

4. **Advanced Analytics**
   - Cohort analysis
   - Customer lifetime value (CLV) predictions
   - Churn risk evolution over time

5. **UI Dashboard**
   - React-based web UI
   - Real-time WebSocket updates
   - Drag-and-drop scenario builder
