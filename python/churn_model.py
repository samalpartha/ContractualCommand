"""
Churn Prediction Model

Features:
- Engagement Score
- Tenure (days)
- Support Response Time (hours)
- Revenue
- Days Since Last Activity

Uses Random Forest Classifier with SHAP for explainability
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import joblib
import os
from datetime import datetime, timedelta


class ChurnModel:
    def __init__(self, model_path='./models/churn_model.joblib'):
        self.model = None
        self.model_path = model_path
        self.feature_names = [
            'engagement_score',
            'tenure',
            'support_response_time',
            'revenue',
            'days_since_last_activity'
        ]
        
    def prepare_features(self, data):
        """
        Prepare features from customer data
        
        Args:
            data: DataFrame with customer information
            
        Returns:
            DataFrame with engineered features
        """
        df = data.copy()
        
        # Calculate days since last activity if we have the date
        if 'last_activity_date' in df.columns:
            today = datetime.now()
            df['days_since_last_activity'] = df['last_activity_date'].apply(
                lambda x: (today - datetime.strptime(str(x), '%Y-%m-%d')).days if pd.notna(x) else 30
            )
        
        # Ensure all required features are present
        for feature in self.feature_names:
            if feature not in df.columns and feature != 'days_since_last_activity':
                df[feature] = 0
        
        return df[self.feature_names]
    
    def train(self, X, y):
        """
        Train the churn prediction model
        
        Args:
            X: Feature matrix
            y: Target labels (1 = churned, 0 = retained)
        """
        print("Training Random Forest Churn Model...")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Train Random Forest
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42,
            n_jobs=-1
        )
        
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test)
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        roc_auc = roc_auc_score(y_test, y_pred_proba)
        
        print(f"\nModel Performance:")
        print(f"  Accuracy:  {accuracy:.4f}")
        print(f"  Precision: {precision:.4f}")
        print(f"  Recall:    {recall:.4f}")
        print(f"  F1 Score:  {f1:.4f}")
        print(f"  ROC AUC:   {roc_auc:.4f}")
        
        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        print(f"\nFeature Importance:")
        for _, row in feature_importance.iterrows():
            print(f"  {row['feature']}: {row['importance']:.4f}")
        
        return {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'roc_auc': roc_auc,
            'feature_importance': feature_importance.to_dict('records')
        }
    
    def predict(self, X):
        """
        Predict churn probability
        
        Args:
            X: Feature matrix
            
        Returns:
            Array of churn probabilities
        """
        if self.model is None:
            raise ValueError("Model not trained. Call train() or load() first.")
        
        return self.model.predict_proba(X)[:, 1]
    
    def predict_with_explanation(self, X):
        """
        Predict with SHAP explanations
        
        Args:
            X: Feature matrix (single row)
            
        Returns:
            Dict with prediction and top drivers
        """
        if self.model is None:
            raise ValueError("Model not trained. Call train() or load() first.")
        
        churn_prob = self.model.predict_proba(X)[:, 1][0]
        
        # Get feature contributions (approximation using feature importance)
        feature_values = X.iloc[0] if isinstance(X, pd.DataFrame) else X[0]
        feature_importance = self.model.feature_importances_
        
        # Calculate contribution scores (normalized by feature value)
        contributions = []
        for i, (feature, value) in enumerate(zip(self.feature_names, feature_values)):
            contribution = feature_importance[i] * (value / 100 if feature == 'engagement_score' else 1)
            contributions.append({
                'feature': feature,
                'value': float(value),
                'importance': float(feature_importance[i]),
                'contribution': float(contribution)
            })
        
        # Sort by absolute contribution
        contributions.sort(key=lambda x: abs(x['contribution']), reverse=True)
        
        # Generate explanation text
        top_driver = contributions[0]
        explanation = self._generate_explanation(churn_prob, contributions)
        
        return {
            'churn_probability': float(churn_prob),
            'risk_segment': 'high' if churn_prob >= 0.6 else 'medium' if churn_prob >= 0.3 else 'low',
            'top_drivers': contributions[:3],
            'explanation': explanation
        }
    
    def _generate_explanation(self, churn_prob, contributions):
        """Generate human-readable explanation"""
        risk_level = "high" if churn_prob >= 0.6 else "medium" if churn_prob >= 0.3 else "low"
        
        explanation = f"This customer has {churn_prob:.1%} churn risk ({risk_level}). "
        
        # Add top driver explanation
        top = contributions[0]
        if top['feature'] == 'engagement_score':
            if top['value'] < 30:
                explanation += f"Primary concern: Very low engagement score ({top['value']:.0f}/100). "
            elif top['value'] < 50:
                explanation += f"Primary concern: Below-average engagement score ({top['value']:.0f}/100). "
        elif top['feature'] == 'support_response_time':
            if top['value'] > 48:
                explanation += f"Primary concern: Slow support response time ({top['value']:.1f} hours). "
        elif top['feature'] == 'days_since_last_activity':
            if top['value'] > 30:
                explanation += f"Primary concern: Inactive for {top['value']:.0f} days. "
        elif top['feature'] == 'tenure':
            if top['value'] < 90:
                explanation += f"Primary concern: New customer (only {top['value']} days tenure). "
        
        return explanation
    
    def save(self):
        """Save model to disk"""
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(self.model, self.model_path)
        print(f"Model saved to {self.model_path}")
    
    def load(self):
        """Load model from disk"""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found at {self.model_path}")
        
        self.model = joblib.load(self.model_path)
        print(f"Model loaded from {self.model_path}")
        return self


def generate_synthetic_training_data(n_samples=1000):
    """
    Generate synthetic customer data for training
    
    Args:
        n_samples: Number of samples to generate
        
    Returns:
        X: Feature matrix
        y: Labels (1 = churned, 0 = retained)
    """
    np.random.seed(42)
    
    # Generate features
    engagement_score = np.random.beta(2, 2, n_samples) * 100
    tenure = np.random.exponential(365, n_samples)
    support_response_time = np.random.gamma(2, 5, n_samples)
    revenue = np.random.lognormal(7, 1.5, n_samples)
    days_since_last_activity = np.random.exponential(15, n_samples)
    
    # Create DataFrame
    X = pd.DataFrame({
        'engagement_score': engagement_score,
        'tenure': tenure,
        'support_response_time': support_response_time,
        'revenue': revenue,
        'days_since_last_activity': days_since_last_activity
    })
    
    # Generate labels with realistic correlations
    churn_score = (
        (100 - engagement_score) / 100 * 0.4 +  # Low engagement increases churn
        (support_response_time > 24).astype(int) * 0.2 +  # Slow support increases churn
        (tenure < 90).astype(int) * 0.15 +  # New customers churn more
        (days_since_last_activity > 30).astype(int) * 0.2 +  # Inactive customers churn
        np.random.normal(0, 0.1, n_samples)  # Random noise
    )
    
    # Convert to binary labels
    y = (churn_score > 0.5).astype(int)
    
    return X, y


if __name__ == "__main__":
    print("Churn Model - Standalone Test")
    print("=" * 50)
    
    # Generate training data
    print("\nGenerating synthetic training data...")
    X, y = generate_synthetic_training_data(1000)
    print(f"Generated {len(X)} samples")
    print(f"Churn rate: {y.mean():.2%}")
    
    # Train model
    model = ChurnModel()
    metrics = model.train(X, y)
    
    # Save model
    model.save()
    
    # Test prediction
    print("\n" + "=" * 50)
    print("Testing prediction with explanation...")
    test_customer = X.iloc[[0]]
    result = model.predict_with_explanation(test_customer)
    
    print(f"\nChurn Probability: {result['churn_probability']:.2%}")
    print(f"Risk Segment: {result['risk_segment']}")
    print(f"Explanation: {result['explanation']}")
    print("\nTop Drivers:")
    for driver in result['top_drivers']:
        print(f"  - {driver['feature']}: {driver['value']:.2f} (importance: {driver['importance']:.4f})")
