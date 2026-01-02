# Tableau Dashboard Setup Guide

## Overview

This guide explains how to connect Tableau to the Counterfactual Command Center API and build the interactive dashboard.

## Prerequisites

- Tableau Desktop 2024.1+ or Tableau Server
- Counterfactual Command Center API running (http://localhost:3000)
- Database credentials (if connecting directly to PostgreSQL)

---

## Option 1: REST API Connection (Recommended)

### Step 1: Create Web Data Connector

1. Open Tableau Desktop
2. Click **Connect** → **Web Data Connector**
3. Enter URL: `http://localhost:3000/api/churn/baseline`
4. Click **Connect**

### Step 2: Create Parameters

**Parameter 1: Intervention Timing**
- Name: `Intervention Timing`
- Data Type: String
- Allowable Values: List
  - `no_action`
  - `7d_earlier`
  - `14d_earlier`
  - `30d_earlier`
- Current Value: `14d_earlier`

**Parameter 2: Intervention Type**
- Name: `Intervention Type`
- Data Type: String
- Allowable Values: List
  - `none`
  - `proactive_outreach`
  - `priority_support`
  - `discount_offer`
- Current Value: `proactive_outreach`

### Step 3: Create Data Sources

#### Data Source 1: Churn Baseline
- **Type:** Web Data Connector
- **URL:** `http://localhost:3000/api/churn/baseline`
- **Refresh:** Every 1 hour

#### Data Source 2: Counterfactual Simulation
- **Type:** Web Data Connector with Parameters
- **URL:** `http://localhost:3000/api/counterfactual/simulate`
- **Method:** POST
- **Body:**
```json
{
  "intervention_timing": "[Intervention Timing]",
  "intervention_type": "[Intervention Type]"
}
```
- **Refresh:** On parameter change

#### Data Source 3: Regret Leaderboard
- **Type:** Web Data Connector
- **URL:** `http://localhost:3000/api/regret/leaderboard?limit=50`
- **Refresh:** Every 30 minutes

---

## Option 2: Direct PostgreSQL Connection

### Step 1: Connect to Database

1. Open Tableau Desktop
2. Click **Connect** → **PostgreSQL**
3. Enter credentials:
   - Server: `localhost`
   - Port: `5432`
   - Database: `counterfactual_db`
   - Username: `postgres`
   - Password: (your password)

### Step 2: Select Tables

Select these tables:
- `customers`
- `churn_predictions`
- `decision_regret`
- `counterfactual_scenarios`

### Step 3: Create Relationships

- `customers.customer_id` ← `churn_predictions.customer_id`
- `customers.customer_id` ← `decision_regret.customer_id`
- `customers.customer_id` ← `counterfactual_scenarios.customer_id`

---

## Dashboard Design

### Tab 1: Churn Baseline

#### Visualization 1: Risk Distribution (Bar Chart)
- **Dimensions:** `risk_segment`
- **Measures:** `COUNT(customer_id)`
- **Color:** 
  - High = Red (#FF4444)
  - Medium = Orange (#FFA500)
  - Low = Green (#44FF44)
- **Sort:** High → Medium → Low

#### Visualization 2: High-Value Customers at Risk (Table)
- **Filter:** `risk_segment = 'high'`
- **Columns:**
  - Company
  - Revenue (formatted as currency)
  - Churn Probability (formatted as %)
  - Last Activity Date
- **Sort:** Revenue DESC
- **Limit:** Top 20

#### Visualization 3: Churn Trend Over Time (Line Chart)
- **X-axis:** `prediction_date`
- **Y-axis:** `AVG(baseline_churn_prob)`
- **Color:** `risk_segment`

#### Visualization 4: Revenue at Risk (KPI Card)
```
SUM(
  IF [risk_segment] = 'high' 
  THEN [revenue] 
  ELSE 0 
  END
)
```
Format as: **$XXX,XXX**

---

### Tab 2: Counterfactual Simulator ⭐

#### Layout
```
┌─────────────────────────────────────────────────┐
│  Parameters (Top)                               │
│  [Intervention Timing: ▼]  [Intervention Type: ▼] │
├─────────────────────────────────────────────────┤
│  KPIs (4 Cards)                                 │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐      │
│  │ Saved │ │Revenue│ │ Churn │ │Regret │      │
│  │  38   │ │$2.1M  │ │  38%  │ │-$850K │      │
│  └───────┘ └───────┘ └───────┘ └───────┘      │
├─────────────────────────────────────────────────┤
│  Comparison Table                               │
│  Baseline vs Counterfactual                     │
└─────────────────────────────────────────────────┘
```

#### Parameter Controls
- Add both parameters to dashboard
- Set to **Single Value (dropdown)**
- Position at top

#### KPI 1: Customers Saved
```
SUM([customers_saved])
```
- Font size: 48pt
- Color: Green (#44FF44)
- Label: "Customers Saved"

#### KPI 2: Revenue Recovered
```
SUM([revenue_recovered])
```
- Font size: 48pt
- Color: Green (#44FF44)
- Format: Currency ($X.XM)
- Label: "Revenue Recovered"

#### KPI 3: Churn Avoided %
```
SUM([churn_avoided_percent])
```
- Font size: 48pt
- Color: Blue (#4488FF)
- Format: Percentage (X.X%)
- Label: "Churn Avoided"

#### KPI 4: Decision Regret Score
```
SUM([total_decision_regret])
```
- Font size: 48pt
- Color: Red (#FF4444) if negative
- Format: Currency ($X.XM)
- Label: "Decision Regret"

#### Comparison Table
- **Rows:** Customer Company
- **Columns:**
  - Baseline Churn Prob
  - Counterfactual Churn Prob
  - Churn Reduction
  - Saved (✓ or ✗)
  - Revenue
- **Filter:** Show only customers with churn reduction > 0

---

### Tab 3: Decision Regret Leaderboard

#### Visualization 1: Regret Heatmap
- **Type:** Heatmap
- **Rows:** Segment (Enterprise, Mid-Market, SMB)
- **Columns:** Intervention Type
- **Color:** Total Regret Value
  - Red (high regret) → Yellow → Green (low regret)
- **Label:** Affected Customers

#### Visualization 2: Top Regrettable Decisions (Table)
- **Columns:**
  - Rank
  - Company
  - Revenue (lost)
  - Regret Value
  - Best Intervention Type
  - Best Intervention Timing
- **Sort:** Regret Value ASC (most negative first)
- **Limit:** Top 20
- **Conditional Formatting:**
  - Regret Value: Red background for <-$50K

#### Visualization 3: Regret by Segment (Bar Chart)
- **X-axis:** Segment
- **Y-axis:** `SUM(ABS([regret_value]))`
- **Color:** Segment
- **Label:** Show value

---

### Tab 4: Action Triggers

#### Visualization 1: Customers Entering Regret Zone (Table)
- **Data Source:** `/api/actions/regret-zone`
- **Columns:**
  - Company
  - Revenue
  - Churn Probability
  - Days Inactive
  - Action (Button)
- **Highlight:** Revenue > $10K in bold

#### Action Buttons

**Note:** Tableau doesn't natively support API calls from dashboards. Use one of these workarounds:

**Option A: Tableau Extensions**
Create a custom extension that:
1. Displays "Trigger Action" button
2. Calls `POST /api/actions/trigger` on click
3. Shows confirmation

**Option B: URL Actions**
1. Create calculated field:
```
"http://localhost:3000/api/actions/trigger?customer_id=" + [customer_id] + "&action=slack_alert"
```
2. Add as URL action
3. Opens in browser (manual confirmation)

**Option C: External Dashboard** (Recommended)
Create a simple web form that:
- Displays customers from `/api/actions/regret-zone`
- Has "Trigger Action" buttons
- Calls API directly
- Embed in Tableau using Web Page object

#### Visualization 2: Action Log (Timeline)
- **Data Source:** `/api/actions/log`
- **X-axis:** `triggered_at` (date/time)
- **Y-axis:** Customer Company
- **Color:** Action Type
- **Shape:** Status (✓ completed, ✗ failed)
- **Tooltip:** Message, Priority

---

## Calculated Fields

### Churn Risk Level (Color Coding)
```
IF [baseline_churn_prob] >= 0.6 THEN "High"
ELSEIF [baseline_churn_prob] >= 0.3 THEN "Medium"
ELSE "Low"
END
```

### Revenue at Risk
```
IF [risk_segment] = 'high' THEN [revenue] ELSE 0 END
```

### Customer Segment
```
IF [revenue] >= 10000 THEN "Enterprise"
ELSEIF [revenue] >= 2000 THEN "Mid-Market"
ELSE "SMB"
END
```

### Churn Reduction %
```
([baseline_churn_prob] - [counterfactual_churn_prob]) / [baseline_churn_prob] * 100
```

### Saved Indicator
```
IF [saved] = TRUE THEN "✓ Saved" ELSE "✗ Lost" END
```

---

## Filters

### Global Filters (Apply to All Tabs)
1. **Date Range:** Last 90 days
2. **Revenue Threshold:** > $500 (exclude very small customers)

### Tab-Specific Filters

**Tab 1 (Churn Baseline):**
- Risk Segment (multi-select)

**Tab 3 (Regret Leaderboard):**
- Segment (multi-select)
- Regret Value range slider

---

## Interactive Features

### Parameter Actions

**Scenario Comparison:**
1. Create duplicate sheets with different parameter values
2. Use dashboard actions to update parameters on click
3. Show side-by-side comparison

### Drill-Down

**From Heatmap to Customer List:**
1. Click on heatmap cell
2. Dashboard action → Filter customer table
3. Shows affected customers for that segment × intervention

### Tooltips

**Enhanced Tooltips:**
- Show SHAP explanation for churn prediction
- Display best intervention recommendation
- Show historical action log for customer

---

## Refresh Schedule

**Real-time Data (live connection):**
- Churn Baseline: Every 1 hour
- Counterfactual Simulation: On parameter change
- Regret Zone: Every 15 minutes

**Batch Updates:**
- Decision Regret: Daily at 2 AM
- Action Log: Every 30 minutes

---

## Performance Optimization

### Data Extracts
For large datasets (>10K customers):
1. Create Tableau extract (.hyper)
2. Schedule refresh: Daily
3. Use extract filters to reduce size

### Query Optimization
- Use API pagination (`limit` parameter)
- Cache frequently-accessed endpoints
- Use database indexes (already created)

### Dashboard Performance
- Limit data points: Top 50-100 customers per viz
- Use LOD calculations instead of data blending
- Avoid cross-data source filters

---

## Troubleshooting

### Issue: API Connection Timeout
**Solution:**
- Increase Tableau timeout: Edit → Preferences → Advanced → Timeout
- Optimize API queries (add indexes, use caching)

### Issue: Parameters Not Updating Dashboard
**Solution:**
- Ensure parameter is used in calculated field
- Check parameter data type matches API expectation
- Use "Refresh Data" action

### Issue: Dashboard Loads Slowly
**Solution:**
- Use data extracts instead of live connection
- Reduce number of marks (filter data)
- Simplify calculations

---

## Example Dashboard JSON (For Tableau Server)

```json
{
  "dashboardName": "Counterfactual Command Center",
  "tabs": [
    {
      "name": "Churn Baseline",
      "dataSources": ["churn_baseline_api"]
    },
    {
      "name": "Counterfactual Simulator",
      "dataSources": ["counterfactual_api"],
      "parameters": ["Intervention Timing", "Intervention Type"]
    },
    {
      "name": "Decision Regret",
      "dataSources": ["regret_leaderboard_api"]
    },
    {
      "name": "Action Triggers",
      "dataSources": ["regret_zone_api", "actions_log_api"]
    }
  ]
}
```

---

## Resources

- [Tableau Web Data Connector Documentation](https://tableau.github.io/webdataconnector/)
- [REST API Connector Guide](https://help.tableau.com/current/pro/desktop/en-us/examples_web_data_connector.htm)
- [Dashboard Extensions API](https://tableau.github.io/extensions-api/)

---

## Support

For API issues:
- Check API logs: `logs/combined.log`
- Test endpoints with Postman
- Verify database connectivity: `GET /health`

For Tableau issues:
- Check Tableau Desktop logs
- Verify data source connections
- Test API endpoints independently
