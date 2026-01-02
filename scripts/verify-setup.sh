#!/bin/bash

# Counterfactual Command Center - Setup Verification Script
# This script verifies that all dependencies and configurations are correct

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Counterfactual Command Center - Setup Verification     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track errors
ERRORS=0

# Function to check command
check_command() {
  if command -v $1 &> /dev/null; then
    echo -e "${GREEN}✓${NC} $1 is installed"
    if [ ! -z "$2" ]; then
      VERSION=$($1 $2 2>&1 | head -n 1)
      echo "  Version: $VERSION"
    fi
  else
    echo -e "${RED}✗${NC} $1 is NOT installed"
    ERRORS=$((ERRORS + 1))
  fi
}

# Function to check file
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1 exists"
  else
    echo -e "${RED}✗${NC} $1 is missing"
    ERRORS=$((ERRORS + 1))
  fi
}

# Function to check directory
check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1 directory exists"
  else
    echo -e "${YELLOW}⚠${NC} $1 directory missing (will be created)"
  fi
}

echo "1. Checking System Dependencies..."
echo "-----------------------------------"
check_command "node" "--version"
check_command "npm" "--version"
check_command "python3" "--version"
check_command "pip3" "--version"
check_command "psql" "--version"
check_command "git" "--version"
echo ""

echo "2. Checking Project Files..."
echo "-----------------------------------"
check_file "package.json"
check_file "requirements.txt"
check_file ".env"
check_file "README.md"
check_file "src/index.js"
check_file "python/churn_model.py"
check_file "data/seed.js"
echo ""

echo "3. Checking Project Directories..."
echo "-----------------------------------"
check_dir "src"
check_dir "python"
check_dir "data"
check_dir "models"
check_dir "logs"
check_dir "docs"
check_dir "tests"
echo ""

echo "4. Checking Node.js Dependencies..."
echo "-----------------------------------"
if [ -d "node_modules" ]; then
  echo -e "${GREEN}✓${NC} node_modules exists"
  echo "  Checking key packages..."
  
  check_package() {
    if [ -d "node_modules/$1" ]; then
      echo -e "  ${GREEN}✓${NC} $1"
    else
      echo -e "  ${RED}✗${NC} $1 missing"
      ERRORS=$((ERRORS + 1))
    fi
  }
  
  check_package "express"
  check_package "pg"
  check_package "dotenv"
else
  echo -e "${RED}✗${NC} node_modules missing"
  echo -e "  ${YELLOW}Run: npm install${NC}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "5. Checking Python Dependencies..."
echo "-----------------------------------"
if python3 -c "import sklearn" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} scikit-learn is installed"
else
  echo -e "${RED}✗${NC} scikit-learn is NOT installed"
  echo -e "  ${YELLOW}Run: pip3 install -r requirements.txt${NC}"
  ERRORS=$((ERRORS + 1))
fi

if python3 -c "import pandas" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} pandas is installed"
else
  echo -e "${RED}✗${NC} pandas is NOT installed"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "6. Checking Environment Configuration..."
echo "-----------------------------------"
if [ -f ".env" ]; then
  echo -e "${GREEN}✓${NC} .env file exists"
  
  # Check key variables
  if grep -q "DB_NAME" .env; then
    echo -e "  ${GREEN}✓${NC} DB_NAME configured"
  else
    echo -e "  ${RED}✗${NC} DB_NAME not configured"
    ERRORS=$((ERRORS + 1))
  fi
  
  if grep -q "DB_USER" .env; then
    echo -e "  ${GREEN}✓${NC} DB_USER configured"
  else
    echo -e "  ${RED}✗${NC} DB_USER not configured"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${RED}✗${NC} .env file missing"
  echo -e "  ${YELLOW}Run: cp .env.example .env${NC}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "7. Checking Database Connection..."
echo "-----------------------------------"
if command -v psql &> /dev/null; then
  # Try to connect to database (will fail if DB doesn't exist yet)
  DB_NAME=$(grep DB_NAME .env 2>/dev/null | cut -d '=' -f2)
  DB_USER=$(grep DB_USER .env 2>/dev/null | cut -d '=' -f2)
  
  if [ ! -z "$DB_NAME" ] && [ ! -z "$DB_USER" ]; then
    if psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
      echo -e "${GREEN}✓${NC} Database connection successful"
    else
      echo -e "${YELLOW}⚠${NC} Cannot connect to database (may not be set up yet)"
      echo -e "  ${YELLOW}Run: npm run db:setup${NC}"
    fi
  else
    echo -e "${YELLOW}⚠${NC} Database configuration incomplete"
  fi
else
  echo -e "${RED}✗${NC} PostgreSQL not available"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "8. Checking Model Files..."
echo "-----------------------------------"
if [ -f "models/churn_model.joblib" ]; then
  echo -e "${GREEN}✓${NC} Churn model exists"
  SIZE=$(du -h models/churn_model.joblib | cut -f1)
  echo "  Size: $SIZE"
else
  echo -e "${YELLOW}⚠${NC} Churn model not trained yet"
  echo -e "  ${YELLOW}Run: npm run model:train${NC}"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! System is ready.${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Start the server: npm run dev"
  echo "  2. Visit: http://localhost:3000"
  echo "  3. API docs: http://localhost:3000/api-docs"
else
  echo -e "${RED}✗ Found $ERRORS issue(s). Please fix them before starting.${NC}"
  echo ""
  echo "Quick fixes:"
  echo "  - Install dependencies: npm install && pip3 install -r requirements.txt"
  echo "  - Setup database: npm run db:setup"
  echo "  - Seed data: npm run data:seed"
  echo "  - Train model: npm run model:train"
fi
echo "═══════════════════════════════════════════════════════════"
echo ""

exit $ERRORS
