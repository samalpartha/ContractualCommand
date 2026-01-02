# Counterfactual Command Center for Customer Retention Analytics

## 🎯 Core Mission
A decision accountability analytics platform that goes beyond churn prediction to quantify decision regret and simulate alternative intervention strategies. Shows leaders: **"Which customers were lost because of when we acted?"**

## 🏗️ Architecture (5-Box Model)

```
┌─────────────────────┐
│ Customer Data Layer │ ← Ingest CRM, usage, support data
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Churn Model       │ ← Predict churn probability
└──────────┬──────────┘
           │
┌──────────▼──────────────┐
│ Counterfactual Engine   │ ← Simulate alternate futures
└──────────┬──────────────┘
           │
┌──────────▼──────────────┐
│ Tableau Command Center  │ ← Interactive dashboard
└──────────┬──────────────┘
           │
┌──────────▼──────────┐
│   Action Layer      │ ← Trigger retention campaigns
└─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+
- Slack App (optional, for integrations)

### Installation

1. **Clone and install dependencies:**
```bash
npm install
pip install -r requirements.txt
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your database credentials and API keys
```

3. **Initialize database:**
```bash
npm run db:setup
```

4. **Generate sample data:**
```bash
npm run data:seed
```

5. **Train churn model:**
```bash
npm run model:train
```

6. **Start the server:**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## 📡 API Endpoints

### Customer Data
- `POST /api/customers/ingest` - Load customer data
- `GET /api/customers` - List all customers
- `GET /api/customers/:id` - Get customer details

### Churn Prediction
- `GET /api/churn/baseline` - Compute baseline churn probability distribution
- `GET /api/churn/predictions` - Get all churn predictions
- `GET /api/churn/predictions/:customerId` - Get prediction for specific customer

### Counterfactual Simulation
- `POST /api/counterfactual/simulate` - Run counterfactual scenario
  ```json
  {
    "customer_ids": ["optional array"],
    "intervention_timing": "7d_earlier|14d_earlier|30d_earlier|no_action",
    "intervention_type": "discount_offer|priority_support|proactive_outreach|none"
  }
  ```

### Decision Regret
- `GET /api/regret/leaderboard` - Ranked list of most regrettable lost customers
- `GET /api/regret/heatmap` - Regret by segment and intervention type

### Actions
- `POST /api/actions/trigger` - Fire retention campaigns
  ```json
  {
    "customer_ids": ["cust_123"],
    "action_type": "slack_alert|salesforce_task|email_campaign",
    "message": "Custom message",
    "priority": "high|normal"
  }
  ```

## 🧠 Churn Model

The churn prediction model uses a Random Forest classifier trained on:
- **Engagement Score** - User activity level
- **Tenure** - Days as customer
- **Support Response Time** - Average support ticket response (hours)
- **Revenue** - Monthly recurring revenue
- **Last Activity Date** - Days since last activity

**Key Metrics:**
- Model accuracy: >75% (on synthetic data)
- SHAP values for explainability
- Risk segments: High (>60%), Medium (30-60%), Low (<30%)

## 🔮 Counterfactual Engine

The engine simulates alternate futures based on intervention timing and type:

### Intervention Effects (Rule-based)
- **Proactive Outreach**: -15% churn (within 7d of risk signal)
- **Priority Support**: -10% churn (if response time improves)
- **Discount Offer**: -20% churn (but -5% margin)

### Timing Decay
Each 7-day delay reduces effectiveness by 5%

### Decision Regret Formula
```
Decision Regret = Actual Outcome - Best Counterfactual Outcome

Example:
Customer churned (lost $25,000)
Best counterfactual: Early proactive outreach (saved $25,000)
Regret = -$25,000 - (+$25,000) = -$50,000
```

## 📊 Tableau Integration

The system provides REST APIs for Tableau dashboards with 4 tabs:

1. **Churn Baseline** - Risk distribution and high-value customers at risk
2. **Counterfactual Simulator** - Interactive what-if analysis
3. **Decision Regret Leaderboard** - Most regrettable decisions
4. **Action Triggers** - Quick actions for at-risk customers

Connect Tableau to: `http://localhost:3000/api/tableau/*`

## 🔔 Integrations

### Slack
Set `SLACK_WEBHOOK_URL` in `.env` to enable alerts:
```
⚠️ 12 customers entering regret zone
Proactive outreach has 48h window
Revenue at risk: $250,000
```

### Salesforce (Future)
Create tasks in Salesforce Flow for CSM follow-up

## 📁 Project Structure

```
counterfactual-command-center/
├── src/
│   ├── api/              # Express API routes
│   ├── models/           # Data models and database schemas
│   ├── services/         # Business logic
│   └── utils/            # Helper functions
├── python/
│   ├── churn_model.py    # Churn prediction ML model
│   ├── train_model.py    # Model training script
│   └── predict.py        # Prediction service
├── data/
│   ├── seed.js           # Sample data generator
│   └── migrations/       # Database migrations
├── models/               # Trained model artifacts
├── docs/                 # Additional documentation
└── tests/                # Unit and integration tests
```

## 🎯 Success Criteria

- ✅ Baseline churn model predicts with >75% accuracy
- ✅ Counterfactual engine produces realistic alternate scenarios
- ✅ Decision regret leaderboard identifies top regrettable decisions
- ✅ Slack actions fire correctly
- ✅ API is documented and testable
- ✅ System is demo-ready with synthetic data

## 🔧 Development

### Run tests
```bash
npm test
```

### Train model with new data
```bash
npm run model:train
```

### API Documentation
After starting the server, visit: `http://localhost:3000/api-docs`

## 📈 Roadmap

### Phase 1 (MVP) ✅
- Backend API with churn model + counterfactual engine
- PostgreSQL with sample customer data
- Tableau-ready endpoints
- Slack integration
- Documentation

### Phase 2 (Future)
- Advanced Salesforce integration
- Real-time streaming (Kafka-based ingestion)
- Advanced causal inference (Bayesian networks)
- A/B test framework for validation
- Enhanced ML model with deep learning

## 🎤 Pitch Focus

**"We don't just predict churn. We show leaders the customers they could have saved — and when."**

The decision regret metric and counterfactual simulator demonstrate the cost of poor timing in customer interventions.

## 📄 License

MIT

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
