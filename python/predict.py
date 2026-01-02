"""
Make predictions using the trained churn model
"""

import sys
import json
import pandas as pd
from churn_model import ChurnModel


def predict_single(customer_data):
    """
    Predict churn for a single customer
    
    Args:
        customer_data: Dict with customer features
        
    Returns:
        Dict with prediction and explanation
    """
    model = ChurnModel()
    model.load()
    
    # Convert to DataFrame
    df = pd.DataFrame([customer_data])
    
    # Prepare features
    features = model.prepare_features(df)
    
    # Get prediction with explanation
    result = model.predict_with_explanation(features)
    
    return result


def predict_batch(customers_data):
    """
    Predict churn for multiple customers
    
    Args:
        customers_data: List of dicts with customer features
        
    Returns:
        List of predictions
    """
    model = ChurnModel()
    model.load()
    
    # Convert to DataFrame
    df = pd.DataFrame(customers_data)
    
    # Prepare features
    features = model.prepare_features(df)
    
    # Get predictions
    predictions = model.predict(features)
    
    results = []
    for idx, customer in enumerate(customers_data):
        churn_prob = float(predictions[idx])
        risk_segment = 'high' if churn_prob >= 0.6 else 'medium' if churn_prob >= 0.3 else 'low'
        
        results.append({
            'customer_id': customer.get('customer_id', f'customer_{idx}'),
            'churn_probability': churn_prob,
            'risk_segment': risk_segment
        })
    
    return results


if __name__ == "__main__":
    # Read from stdin if data is provided
    if len(sys.argv) > 1:
        # Read JSON from command line argument
        input_data = json.loads(sys.argv[1])
    else:
        # Read from stdin
        input_data = json.loads(sys.stdin.read())
    
    # Determine if single or batch prediction
    if isinstance(input_data, list):
        result = predict_batch(input_data)
    else:
        result = predict_single(input_data)
    
    # Output JSON
    print(json.dumps(result, indent=2))
