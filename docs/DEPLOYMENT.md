# Deployment Guide

## Quick Start (Development)

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Required Configuration:**
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=counterfactual_db
DB_USER=postgres
DB_PASSWORD=your_password

# Slack (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3. Setup Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE counterfactual_db;"

# Run migrations
npm run db:setup

# Seed with sample data
npm run data:seed
```

### 4. Train Model

```bash
# Train the churn prediction model
npm run model:train
```

### 5. Start Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`

---

## Production Deployment

### Option 1: AWS Deployment

#### Architecture
```
Internet
    ↓
Application Load Balancer (ALB)
    ↓
EC2 Auto Scaling Group (Node.js API)
    ↓
RDS PostgreSQL (Database)
    ↓
S3 (Model Artifacts)
```

#### Step-by-Step

**1. Database (RDS PostgreSQL)**

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier counterfactual-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --master-username postgres \
  --master-user-password YOUR_PASSWORD \
  --allocated-storage 100 \
  --backup-retention-period 7 \
  --publicly-accessible false

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier counterfactual-db \
  --query 'DBInstances[0].Endpoint.Address'
```

**2. Application Server (EC2)**

```bash
# Launch EC2 instance (Ubuntu 22.04)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxx \
  --subnet-id subnet-xxxxxxxx

# SSH into instance
ssh -i your-key.pem ubuntu@ec2-instance-ip

# Install Node.js and dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs python3 python3-pip postgresql-client

# Clone repository
git clone https://github.com/your-org/counterfactual-command-center.git
cd counterfactual-command-center

# Install dependencies
npm install
pip3 install -r requirements.txt

# Configure environment
sudo nano /etc/environment
# Add:
# DB_HOST=your-rds-endpoint.amazonaws.com
# DB_PASSWORD=your-password

# Setup database
npm run db:setup
npm run data:seed
npm run model:train

# Install PM2 for process management
sudo npm install -g pm2

# Start application
pm2 start src/index.js --name counterfactual-api
pm2 save
pm2 startup
```

**3. Load Balancer**

```bash
# Create target group
aws elbv2 create-target-group \
  --name counterfactual-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxxxxx \
  --health-check-path /health

# Register instances
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --targets Id=i-xxxxxxxxx

# Create load balancer
aws elbv2 create-load-balancer \
  --name counterfactual-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-xxxxxxxx
```

**4. Auto Scaling**

```bash
# Create launch template
aws ec2 create-launch-template \
  --launch-template-name counterfactual-lt \
  --version-description "v1" \
  --launch-template-data '{
    "ImageId": "ami-xxxxxxxx",
    "InstanceType": "t3.medium",
    "UserData": "base64-encoded-startup-script"
  }'

# Create auto scaling group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name counterfactual-asg \
  --launch-template LaunchTemplateName=counterfactual-lt \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 2 \
  --target-group-arns arn:aws:elasticloadbalancing:...
```

---

### Option 2: Docker Deployment

#### Dockerfile

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Install Python for ML model
FROM node:18-alpine

RUN apk add --no-cache python3 py3-pip postgresql-client

WORKDIR /app

# Copy from builder
COPY --from=builder /app .

# Install Python dependencies
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/index.js"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  database:
    image: postgres:14
    environment:
      POSTGRES_DB: counterfactual_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build: .
    environment:
      DB_HOST: database
      DB_PORT: 5432
      DB_NAME: counterfactual_db
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      NODE_ENV: production
      SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL}
    ports:
      - "3000:3000"
    depends_on:
      database:
        condition: service_healthy
    restart: unless-stopped
    volumes:
      - ./models:/app/models
      - ./logs:/app/logs

volumes:
  postgres-data:
```

#### Build and Run

```bash
# Build image
docker-compose build

# Start services
docker-compose up -d

# Initialize database
docker-compose exec api npm run db:setup
docker-compose exec api npm run data:seed

# Train model
docker-compose exec api npm run model:train

# View logs
docker-compose logs -f api

# Scale API instances
docker-compose up -d --scale api=3
```

---

### Option 3: Kubernetes Deployment

#### Manifests

**deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: counterfactual-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: counterfactual-api
  template:
    metadata:
      labels:
        app: counterfactual-api
    spec:
      containers:
      - name: api
        image: counterfactual-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: db_host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: db_password
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

**service.yaml**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: counterfactual-api-service
spec:
  selector:
    app: counterfactual-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

**Deploy:**
```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl get services
```

---

## Environment Variables Reference

### Required
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=counterfactual_db
DB_USER=postgres
DB_PASSWORD=your_password
```

### Optional
```env
# Server
PORT=3000
NODE_ENV=production

# Logging
LOG_LEVEL=info

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Model
MODEL_PATH=./models/churn_model.joblib
CHURN_THRESHOLD_HIGH=0.6
CHURN_THRESHOLD_MEDIUM=0.3

# Counterfactual Engine
INTERVENTION_PROACTIVE_OUTREACH_EFFECT=-0.15
INTERVENTION_PRIORITY_SUPPORT_EFFECT=-0.10
INTERVENTION_DISCOUNT_OFFER_EFFECT=-0.20
TIMING_DECAY_PER_WEEK=0.05
```

---

## Monitoring

### Health Checks

```bash
# Application health
curl http://localhost:3000/health

# Database connectivity
psql -h localhost -U postgres -d counterfactual_db -c "SELECT 1"

# Model availability
ls -lh models/churn_model.joblib
```

### Logs

```bash
# Application logs
tail -f logs/combined.log

# Error logs
tail -f logs/error.log

# Filter for specific errors
grep "ERROR" logs/combined.log
```

### Metrics to Track

1. **API Performance**
   - Request latency (p50, p95, p99)
   - Requests per second
   - Error rate

2. **Database**
   - Query execution time
   - Connection pool usage
   - Table sizes

3. **ML Model**
   - Prediction latency
   - Model accuracy over time
   - Feature drift

4. **Business Metrics**
   - Active customers
   - High-risk customer count
   - Actions triggered per day

---

## Backup and Recovery

### Database Backup

```bash
# Manual backup
pg_dump -h localhost -U postgres counterfactual_db > backup_$(date +%Y%m%d).sql

# Automated daily backup (cron)
0 2 * * * pg_dump -h localhost -U postgres counterfactual_db > /backups/backup_$(date +\%Y\%m\%d).sql
```

### Restore

```bash
psql -h localhost -U postgres counterfactual_db < backup_20240115.sql
```

### Model Backup

```bash
# Backup model artifacts
cp models/churn_model.joblib backups/churn_model_$(date +%Y%m%d).joblib

# Upload to S3
aws s3 cp models/churn_model.joblib s3://your-bucket/models/
```

---

## Security Checklist

- [ ] Database credentials stored in environment variables (not in code)
- [ ] PostgreSQL not exposed to public internet
- [ ] HTTPS enabled (use nginx reverse proxy or ALB)
- [ ] API rate limiting configured
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] CORS configured for allowed origins only
- [ ] Secrets rotation policy in place
- [ ] Regular security updates (npm audit, pip check)
- [ ] Logging of sensitive actions (audit trail)

---

## Performance Tuning

### Database Optimization

```sql
-- Add indexes (already in migrations)
CREATE INDEX idx_customers_revenue ON customers(revenue DESC);
CREATE INDEX idx_churn_predictions_risk_segment ON churn_predictions(risk_segment);

-- Vacuum and analyze
VACUUM ANALYZE customers;
VACUUM ANALYZE churn_predictions;

-- Connection pooling
-- Already configured in src/config/database.js
```

### API Optimization

```javascript
// Enable compression
const compression = require('compression');
app.use(compression());

// Caching layer (Redis)
const redis = require('redis');
const client = redis.createClient();

// Cache churn baseline (1 hour TTL)
app.get('/api/churn/baseline', async (req, res) => {
  const cached = await client.get('churn:baseline');
  if (cached) return res.json(JSON.parse(cached));
  
  // ... fetch from database
  await client.setex('churn:baseline', 3600, JSON.stringify(data));
  res.json(data);
});
```

---

## Troubleshooting

### Issue: Database connection timeout

**Symptoms:** API returns 500 errors, logs show "database connection timeout"

**Solutions:**
1. Check database is running: `psql -h localhost -U postgres -d counterfactual_db`
2. Verify credentials in `.env`
3. Increase connection pool size in `src/config/database.js`
4. Check firewall rules

### Issue: Model prediction errors

**Symptoms:** `/api/churn/predictions` returns errors

**Solutions:**
1. Verify model file exists: `ls models/churn_model.joblib`
2. Retrain model: `npm run model:train`
3. Check Python dependencies: `pip3 list | grep scikit-learn`

### Issue: Slow API responses

**Symptoms:** Requests take >2 seconds

**Solutions:**
1. Add database indexes (see Performance Tuning)
2. Enable caching (Redis)
3. Use pagination (`limit` parameter)
4. Scale horizontally (more API instances)

---

## Scaling Guidelines

| Customers | Database | API Instances | Notes |
|-----------|----------|---------------|-------|
| <1K | db.t3.small | 1 | Development |
| 1K-10K | db.t3.medium | 2-3 | Small production |
| 10K-100K | db.r5.large | 3-5 | Medium production |
| 100K+ | db.r5.xlarge+ | 5-10 | Large production, consider read replicas |

---

## Support

For deployment issues:
- Check logs: `logs/combined.log`
- Review health endpoint: `GET /health`
- Database connectivity: `psql` test
- Model availability: `ls models/`

For production support:
- Email: support@counterfactual.ai
- Slack: #counterfactual-support
