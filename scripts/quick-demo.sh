#!/bin/bash

# Counterfactual Command Center - Quick Demo Script
# This script demonstrates key API endpoints with sample data

API_URL="http://localhost:3000"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║      Counterfactual Command Center - Quick Demo          ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if server is running
echo -e "${BLUE}Checking if API server is running...${NC}"
if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠ API server is not running!${NC}"
  echo "Please start the server first: npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Function to make API call and display result
demo_endpoint() {
  echo "───────────────────────────────────────────────────────────"
  echo -e "${BLUE}$1${NC}"
  echo "───────────────────────────────────────────────────────────"
  echo "Endpoint: $2"
  echo ""
  
  if [ "$3" == "POST" ]; then
    RESPONSE=$(curl -s -X POST "$API_URL$2" \
      -H "Content-Type: application/json" \
      -d "$4")
  else
    RESPONSE=$(curl -s "$API_URL$2")
  fi
  
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  echo ""
  echo -e "${GREEN}✓ Complete${NC}"
  echo ""
  sleep 2
}

# Demo 1: Health Check
demo_endpoint \
  "1. Health Check - Verify API is operational" \
  "/health" \
  "GET"

# Demo 2: Churn Baseline
demo_endpoint \
  "2. Churn Baseline - Risk distribution and high-value customers" \
  "/api/churn/baseline" \
  "GET"

# Demo 3: Counterfactual Simulation
demo_endpoint \
  "3. Counterfactual Simulation - What if we acted 14 days earlier?" \
  "/api/counterfactual/simulate" \
  "POST" \
  '{"intervention_timing":"14d_earlier","intervention_type":"proactive_outreach","save_results":false}'

# Demo 4: Compare Scenarios
demo_endpoint \
  "4. Compare All Scenarios - Find the best intervention strategy" \
  "/api/counterfactual/compare" \
  "POST" \
  '{}'

# Demo 5: Regret Leaderboard
demo_endpoint \
  "5. Regret Leaderboard - Most regrettable lost customers" \
  "/api/regret/leaderboard?limit=10" \
  "GET"

# Demo 6: Regret Heatmap
demo_endpoint \
  "6. Regret Heatmap - Regret by segment and intervention type" \
  "/api/regret/heatmap" \
  "GET"

# Demo 7: Customers in Regret Zone
demo_endpoint \
  "7. Regret Zone - Customers needing immediate action" \
  "/api/actions/regret-zone" \
  "GET"

echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}Demo Complete!${NC}"
echo ""
echo "Key Insights from Demo:"
echo "  • Baseline churn risk distribution"
echo "  • Impact of intervention timing"
echo "  • Customers that could have been saved"
echo "  • Decision regret quantification"
echo "  • Actionable recommendations"
echo ""
echo "Next Steps:"
echo "  1. View full API docs: http://localhost:3000/api-docs"
echo "  2. Try custom queries with Postman"
echo "  3. Connect Tableau dashboard"
echo "  4. Configure Slack integration"
echo ""
echo "═══════════════════════════════════════════════════════════"
