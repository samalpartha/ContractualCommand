"""
Train the churn prediction model using database data
"""

import psycopg2
import pandas as pd
import os
from dotenv import load_dotenv
from churn_model import ChurnModel, generate_synthetic_training_data
from datetime import datetime

load_dotenv()


def fetch_customer_data():
    """Fetch customer data from PostgreSQL database"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', 5432),
            database=os.getenv('DB_NAME', 'counterfactual_db'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'postgres')
        )
        
        query = """
            SELECT 
                customer_id,
                engagement_score,
                tenure,
                support_response_time,
                revenue,
                last_activity_date
            FROM customers
        """
        
        df = pd.read_sql(query, conn)
        conn.close()
        
        return df
    except Exception as e:
        print(f"Could not fetch data from database: {e}")
        print("Falling back to synthetic data...")
        return None


def update_predictions(model, customer_data):
    """Update churn predictions in database"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', 5432),
            database=os.getenv('DB_NAME', 'counterfactual_db'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'postgres')
        )
        cursor = conn.cursor()
        
        # Prepare features
        features = model.prepare_features(customer_data)
        
        # Get predictions
        predictions = model.predict(features)
        
        print(f"\nUpdating predictions for {len(customer_data)} customers...")
        
        # Update each customer's prediction
        for idx, row in customer_data.iterrows():
            customer_id = row['customer_id']
            churn_prob = float(predictions[idx])
            
            # Determine risk segment
            if churn_prob >= 0.6:
                risk_segment = 'high'
            elif churn_prob >= 0.3:
                risk_segment = 'medium'
            else:
                risk_segment = 'low'
            
            # Delete old prediction
            cursor.execute(
                "DELETE FROM churn_predictions WHERE customer_id = %s",
                (customer_id,)
            )
            
            # Insert new prediction
            cursor.execute("""
                INSERT INTO churn_predictions (
                    customer_id, baseline_churn_prob, risk_segment, model_version, features
                ) VALUES (%s, %s, %s, %s, %s)
            """, (
                customer_id,
                churn_prob,
                risk_segment,
                '1.0',
                None
            ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✓ Predictions updated in database")
        
        # Print summary
        high_risk = sum(1 for p in predictions if p >= 0.6)
        medium_risk = sum(1 for p in predictions if 0.3 <= p < 0.6)
        low_risk = sum(1 for p in predictions if p < 0.3)
        
        print(f"\nPrediction Summary:")
        print(f"  High Risk (≥60%):    {high_risk}")
        print(f"  Medium Risk (30-60%): {medium_risk}")
        print(f"  Low Risk (<30%):      {low_risk}")
        print(f"  Average Churn Prob:   {predictions.mean():.2%}")
        
    except Exception as e:
        print(f"Error updating predictions: {e}")


def main():
    print("=" * 60)
    print("CHURN MODEL TRAINING")
    print("=" * 60)
    
    # Try to fetch real data from database
    print("\n1. Fetching customer data...")
    customer_data = fetch_customer_data()
    
    # Use synthetic data for training (more samples for better model)
    print("\n2. Generating synthetic training data...")
    X_train, y_train = generate_synthetic_training_data(2000)
    print(f"   Generated {len(X_train)} training samples")
    print(f"   Churn rate: {y_train.mean():.2%}")
    
    # Train model
    print("\n3. Training model...")
    model = ChurnModel()
    metrics = model.train(X_train, y_train)
    
    # Save model
    print("\n4. Saving model...")
    model.save()
    
    # Update predictions in database if we have real customer data
    if customer_data is not None:
        print("\n5. Updating predictions in database...")
        update_predictions(model, customer_data)
    else:
        print("\n5. Skipping database update (no customer data available)")
    
    print("\n" + "=" * 60)
    print("✅ MODEL TRAINING COMPLETE")
    print("=" * 60)
    
    # Print model performance summary
    print(f"\nModel Performance:")
    print(f"  Accuracy:  {metrics['accuracy']:.2%}")
    print(f"  Precision: {metrics['precision']:.2%}")
    print(f"  Recall:    {metrics['recall']:.2%}")
    print(f"  F1 Score:  {metrics['f1']:.2%}")
    print(f"  ROC AUC:   {metrics['roc_auc']:.2%}")


if __name__ == "__main__":
    main()
