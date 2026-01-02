/**
 * Slack Integration Service
 * 
 * Sends alerts to Slack channels
 */

const axios = require('axios');
const logger = require('../config/logger');

class SlackService {
  /**
   * Send alert to Slack
   * 
   * @param {object} data - Alert data
   * @param {string} priority - Alert priority (high/normal)
   * @returns {Promise<object>} - Response from Slack
   */
  static async sendAlert(data, priority = 'normal') {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
      logger.warn('Slack webhook URL not configured, skipping Slack alert');
      return { success: false, message: 'Slack webhook not configured' };
    }
    
    try {
      const message = this.formatMessage(data, priority);
      
      const response = await axios.post(webhookUrl, {
        text: message.text,
        blocks: message.blocks,
      });
      
      logger.info('Slack alert sent successfully');
      return { success: true, response: response.data };
      
    } catch (error) {
      logger.error('Failed to send Slack alert:', error);
      throw new Error(`Slack alert failed: ${error.message}`);
    }
  }
  
  /**
   * Format message for Slack
   * 
   * @param {object} data - Alert data
   * @param {string} priority - Alert priority
   * @returns {object} - Formatted Slack message
   */
  static formatMessage(data, priority) {
    const emoji = priority === 'high' ? '🚨' : '⚠️';
    const priorityText = priority === 'high' ? '*HIGH PRIORITY*' : 'Alert';
    
    // Different message types
    if (data.type === 'regret_zone') {
      return this.formatRegretZoneAlert(data, emoji, priorityText);
    } else if (data.type === 'high_risk_customers') {
      return this.formatHighRiskAlert(data, emoji, priorityText);
    } else if (data.type === 'action_triggered') {
      return this.formatActionAlert(data, emoji, priorityText);
    } else {
      return this.formatGenericAlert(data, emoji, priorityText);
    }
  }
  
  /**
   * Format regret zone alert
   */
  static formatRegretZoneAlert(data, emoji, priorityText) {
    const { customerCount, revenueAtRisk, timeWindow, recommendedAction } = data;
    
    return {
      text: `${emoji} ${customerCount} customers entering regret zone`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} Customers Entering Regret Zone`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${priorityText}\n\n*${customerCount} customers* are entering the regret zone.\n*${recommendedAction}* has a *${timeWindow}* window remaining.`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Revenue at Risk:*\n$${revenueAtRisk.toLocaleString()}`,
            },
            {
              type: 'mrkdwn',
              text: `*Time Window:*\n${timeWindow}`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View in Dashboard',
                emoji: true,
              },
              url: process.env.DASHBOARD_URL || 'http://localhost:3000',
              style: 'primary',
            },
          ],
        },
      ],
    };
  }
  
  /**
   * Format high risk customers alert
   */
  static formatHighRiskAlert(data, emoji, priorityText) {
    const { customers, totalRevenue } = data;
    
    // Format top customers list
    const customerList = customers
      .slice(0, 5)
      .map(c => `• *${c.company}* - $${c.revenue.toLocaleString()} (${(c.churn_prob * 100).toFixed(0)}% churn risk)`)
      .join('\n');
    
    return {
      text: `${emoji} ${customers.length} high-risk customers detected`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} High-Risk Customers Alert`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${priorityText}\n\n*${customers.length} customers* have high churn risk (≥60%)`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Total Revenue at Risk:*\n$${totalRevenue.toLocaleString()}`,
            },
            {
              type: 'mrkdwn',
              text: `*Recommended Action:*\nProactive Outreach`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Top 5 At-Risk Customers:*\n${customerList}`,
          },
        },
      ],
    };
  }
  
  /**
   * Format action triggered alert
   */
  static formatActionAlert(data, emoji, priorityText) {
    const { actionType, customerCount, message } = data;
    
    return {
      text: `${emoji} Retention action triggered: ${actionType}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *Retention Action Triggered*\n\n*Action:* ${actionType}\n*Customers:* ${customerCount}\n*Message:* ${message}`,
          },
        },
      ],
    };
  }
  
  /**
   * Format generic alert
   */
  static formatGenericAlert(data, emoji, priorityText) {
    return {
      text: `${emoji} ${data.message || 'Counterfactual Command Center Alert'}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} ${priorityText}\n\n${data.message || 'Alert from Counterfactual Command Center'}`,
          },
        },
      ],
    };
  }
  
  /**
   * Send regret zone alert
   */
  static async sendRegretZoneAlert(customerCount, revenueAtRisk, timeWindow = '48h', priority = 'high') {
    return this.sendAlert({
      type: 'regret_zone',
      customerCount,
      revenueAtRisk,
      timeWindow,
      recommendedAction: 'Proactive outreach',
    }, priority);
  }
  
  /**
   * Send high risk customers alert
   */
  static async sendHighRiskAlert(customers, priority = 'high') {
    const totalRevenue = customers.reduce((sum, c) => sum + parseFloat(c.revenue || 0), 0);
    
    return this.sendAlert({
      type: 'high_risk_customers',
      customers,
      totalRevenue,
    }, priority);
  }
}

module.exports = SlackService;
