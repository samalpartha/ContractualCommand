# Contributing to Counterfactual Command Center

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Code Standards](#code-standards)
4. [Testing](#testing)
5. [Pull Request Process](#pull-request-process)
6. [Feature Requests](#feature-requests)
7. [Bug Reports](#bug-reports)

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- PostgreSQL 14+
- Git

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/counterfactual-command-center.git
cd counterfactual-command-center

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/counterfactual-command-center.git
```

---

## Development Setup

### 1. Install Dependencies

```bash
npm install
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your local configuration
```

### 3. Setup Database

```bash
npm run db:setup
npm run data:seed
```

### 4. Train Model

```bash
npm run model:train
```

### 5. Start Development Server

```bash
npm run dev
```

---

## Code Standards

### JavaScript/Node.js

**Style Guide:** Follow standard Node.js conventions

**Key Principles:**
- Use `const` and `let` (no `var`)
- Async/await over callbacks
- Descriptive variable names
- Comments for complex logic only
- Error handling with try/catch

**Example:**
```javascript
const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/customers', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const result = await pool.query(
      'SELECT * FROM customers LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    res.json({
      success: true,
      customers: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers',
    });
  }
});

module.exports = router;
```

### Python

**Style Guide:** Follow PEP 8

**Key Principles:**
- Type hints for function parameters
- Docstrings for classes and functions
- Snake_case for variables and functions
- Clear class names

**Example:**
```python
from typing import List, Dict
import pandas as pd

class ChurnModel:
    """Churn prediction model using Random Forest"""
    
    def __init__(self, model_path: str = './models/churn_model.joblib'):
        """
        Initialize churn model
        
        Args:
            model_path: Path to saved model file
        """
        self.model_path = model_path
        self.model = None
    
    def predict(self, X: pd.DataFrame) -> List[float]:
        """
        Predict churn probability
        
        Args:
            X: Feature matrix
            
        Returns:
            List of churn probabilities
        """
        if self.model is None:
            raise ValueError("Model not trained")
        
        return self.model.predict_proba(X)[:, 1].tolist()
```

### SQL

**Key Principles:**
- Use parameterized queries (prevent SQL injection)
- Uppercase SQL keywords
- Meaningful table and column names
- Always use transactions for multiple writes

**Example:**
```sql
-- Good
SELECT 
  customer_id,
  company,
  revenue
FROM customers
WHERE risk_segment = $1
ORDER BY revenue DESC
LIMIT $2;

-- Avoid
select * from customers where risk_segment = 'high';  -- No parameters!
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test tests/api.test.js
```

### Writing Tests

**Structure:**
```javascript
describe('Feature Name', () => {
  test('should do something specific', async () => {
    // Arrange
    const input = { ... };
    
    // Act
    const result = await someFunction(input);
    
    // Assert
    expect(result).toHaveProperty('success', true);
  });
});
```

**Test Coverage Goals:**
- API endpoints: >80%
- Business logic: >90%
- Utilities: >70%

---

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

**Branch Naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions

### 2. Make Changes

- Write clear, focused commits
- Follow code standards
- Add tests for new features
- Update documentation

### 3. Commit Messages

**Format:**
```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Maintenance

**Example:**
```
feat: add customer segment filter to regret leaderboard

- Add segment parameter to /api/regret/leaderboard endpoint
- Update database query to filter by segment
- Add tests for segment filtering

Closes #123
```

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

**PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings

## Related Issues
Closes #123
```

### 5. Review Process

- Maintainers will review within 3 business days
- Address feedback in new commits
- Once approved, maintainer will merge

---

## Feature Requests

### Before Submitting

1. Check existing issues for duplicates
2. Clearly describe the use case
3. Explain why it benefits users

### Template

```markdown
**Feature Description**
A clear description of the feature

**Use Case**
Why is this needed? Who will use it?

**Proposed Solution**
How should this work?

**Alternatives Considered**
Other approaches you've thought about

**Additional Context**
Screenshots, mockups, etc.
```

---

## Bug Reports

### Before Submitting

1. Check existing issues for duplicates
2. Verify it's reproducible
3. Gather relevant information

### Template

```markdown
**Bug Description**
A clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen?

**Actual Behavior**
What actually happens?

**Environment**
- OS: [e.g., Ubuntu 22.04]
- Node version: [e.g., 18.16.0]
- Python version: [e.g., 3.9.7]
- Database version: [e.g., PostgreSQL 14]

**Logs**
```
Paste relevant logs here
```

**Additional Context**
Screenshots, error messages, etc.
```

---

## Development Guidelines

### API Endpoints

**Consistency:**
- Use plural nouns: `/api/customers` (not `/api/customer`)
- Use HTTP verbs correctly:
  - `GET` - Retrieve
  - `POST` - Create or complex queries
  - `PUT` - Update (full)
  - `PATCH` - Update (partial)
  - `DELETE` - Remove

**Response Format:**
```javascript
// Success
{
  "success": true,
  "data": { ... },
  "meta": { ... }  // Optional
}

// Error
{
  "success": false,
  "error": "Error type",
  "message": "Detailed message"
}
```

### Database Changes

**Migrations:**
- Create migration files for schema changes
- Include rollback logic
- Test both up and down migrations

**Example:**
```javascript
// migrations/002_add_customer_segment.js
async function up(pool) {
  await pool.query(`
    ALTER TABLE customers
    ADD COLUMN segment VARCHAR(50);
  `);
}

async function down(pool) {
  await pool.query(`
    ALTER TABLE customers
    DROP COLUMN segment;
  `);
}
```

### Machine Learning

**Model Changes:**
- Document feature changes
- Compare performance metrics
- Version model artifacts
- Update documentation

**Checklist:**
- [ ] Accuracy compared to baseline
- [ ] Feature importance analyzed
- [ ] Model size acceptable (<100MB)
- [ ] Prediction latency <500ms
- [ ] Documentation updated

---

## Code Review Checklist

**For Authors:**
- [ ] Code follows style guide
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] No console.log or debugging code
- [ ] Error handling in place
- [ ] SQL queries use parameters
- [ ] Sensitive data not logged

**For Reviewers:**
- [ ] Code is readable and maintainable
- [ ] Logic is correct
- [ ] Tests are comprehensive
- [ ] Performance considerations
- [ ] Security considerations
- [ ] Breaking changes documented

---

## Release Process

**Version Numbering:** Semantic Versioning (MAJOR.MINOR.PATCH)

**Process:**
1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag: `git tag v1.2.0`
4. Push tag: `git push origin v1.2.0`
5. Create GitHub release with notes

---

## Getting Help

**Questions?**
- Open a GitHub Discussion
- Join Slack: #counterfactual-dev
- Email: dev@counterfactual.ai

**Found a Security Issue?**
- Email: security@counterfactual.ai
- Do NOT open a public issue

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Recognition

Contributors will be:
- Listed in `CONTRIBUTORS.md`
- Mentioned in release notes
- Thanked in our monthly newsletter

Thank you for contributing! 🎉
