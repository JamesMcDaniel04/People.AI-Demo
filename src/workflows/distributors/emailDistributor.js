import axios from 'axios';
import { Logger } from '../../utils/logger.js';

export class EmailDistributor {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.postmarkApiKey = null;
    this.postmarkBaseUrl = 'https://api.postmarkapp.com';
    this.fromEmail = null;
    this.mockMode = false;
  }

  async initialize() {
    this.logger.info('🔄 Initializing Email Distributor...');

    // Check for Postmark API key
    if (!process.env.SMTP_API_KEY) {
      this.logger.warn('⚠️ No Postmark API key found, using mock mode');
      this.mockMode = true;
      return;
    }

    // Configure Postmark API client
    this.postmarkApiKey = process.env.SMTP_API_KEY;
    this.fromEmail = process.env.SMTP_FROM || 'hello@joinfloor.app';
    
    // Test Postmark API connection
    try {
      const response = await axios.get(`${this.postmarkBaseUrl}/server`, {
        headers: {
          'Accept': 'application/json',
          'X-Postmark-Server-Token': this.postmarkApiKey
        }
      });
      
      this.logger.info('✅ Email Distributor initialized successfully', {
        provider: 'Postmark',
        server: response.data.Name
      });
    } catch (error) {
      this.logger.warn('⚠️ Postmark API verification failed, using mock mode', { 
        error: error.message 
      });
      this.mockMode = true;
    }
  }

  async distribute(accountPlan, config, context) {
    const { recipients, subject, template = 'default' } = config;
    const { accountName, executionId } = context;

    this.logger.info('📧 Distributing account plan via email', {
      accountName,
      executionId,
      recipients: recipients.length,
      template
    });

    try {
      // Generate email content based on template
      const emailContent = this.generateEmailContent(accountPlan, template, context);

      // Send to each recipient
      const results = [];
      for (const recipient of recipients) {
        const result = await this.sendEmail(
          recipient,
          subject || `Account Plan: ${accountName}`,
          emailContent,
          accountPlan,
          context
        );
        results.push(result);
      }

      return {
        status: 'success',
        sentCount: results.filter(r => r.status === 'sent').length,
        results
      };

    } catch (error) {
      this.logger.error('❌ Email distribution failed', {
        accountName,
        error: error.message
      });
      throw error;
    }
  }

  async sendEmail(recipient, subject, content, accountPlan, context) {
    const { accountName, executionId } = context;

    try {
      if (this.mockMode) {
        // Mock mode for demonstration
        this.logger.info('📧 Email sent (mock mode)', {
          recipient: recipient.email,
          subject,
          accountName
        });

        return {
          recipient: recipient.email,
          status: 'sent',
          messageId: `mock-${Date.now()}`,
          sentAt: new Date().toISOString(),
          mode: 'mock'
        };
      }

      // Use Postmark HTTP API
      const emailData = {
        From: this.fromEmail,
        To: recipient.email,
        Subject: subject,
        HtmlBody: content.html,
        TextBody: content.text,
        MessageStream: 'outbound',
        Attachments: [
          {
            Name: `${accountName}-account-plan-${new Date().toISOString().split('T')[0]}.json`,
            Content: Buffer.from(JSON.stringify(accountPlan, null, 2)).toString('base64'),
            ContentType: 'application/json'
          }
        ]
      };

      const response = await axios.post(`${this.postmarkBaseUrl}/email`, emailData, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.postmarkApiKey
        }
      });

      this.logger.info('✅ Email sent successfully via Postmark', {
        recipient: recipient.email,
        messageId: response.data.MessageID,
        accountName,
        executionId
      });

      return {
        recipient: recipient.email,
        status: 'sent',
        messageId: response.data.MessageID,
        sentAt: new Date().toISOString(),
        provider: 'Postmark'
      };

    } catch (error) {
      this.logger.error('❌ Failed to send email via Postmark', {
        recipient: recipient.email,
        error: error.message,
        errorCode: error.response?.data?.ErrorCode,
        errorMessage: error.response?.data?.Message,
        accountName
      });

      return {
        recipient: recipient.email,
        status: 'failed',
        error: error.response?.data?.Message || error.message,
        errorCode: error.response?.data?.ErrorCode,
        failedAt: new Date().toISOString()
      };
    }
  }

  generateEmailContent(accountPlan, template, context) {
    const { accountName, executionId, timestamp } = context;
    
    switch (template) {
      case 'executive':
        return this.generateExecutiveTemplate(accountPlan, context);
      
      case 'detailed':
        return this.generateDetailedTemplate(accountPlan, context);
      
      case 'summary':
        return this.generateSummaryTemplate(accountPlan, context);
      
      default:
        return this.generateDefaultTemplate(accountPlan, context);
    }
  }

  generateDefaultTemplate(accountPlan, context) {
    const { accountName } = context;
    const healthScore = accountPlan.accountOverview?.healthScore?.score || 'N/A';
    const opportunities = accountPlan.opportunityAnalysis?.identifiedOpportunities || [];
    const risks = accountPlan.riskAssessment?.identifiedRisks || [];

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px; }
            .section { margin: 30px 0; padding: 20px; border-left: 4px solid #667eea; background: #f8f9fa; }
            .metric { display: inline-block; margin: 10px 20px 10px 0; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .health-score { font-size: 2.5em; font-weight: bold; color: ${healthScore >= 80 ? '#28a745' : healthScore >= 60 ? '#ffc107' : '#dc3545'}; }
            .opportunity { background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 10px 0; border-radius: 4px; }
            .risk { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 10px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 40px; padding: 20px; color: #666; }
            .cta { background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎯 Account Plan: ${accountName}</h1>
            <p>AI-Powered Strategic Account Analysis</p>
            <p>Generated: ${new Date(context.timestamp).toLocaleDateString()}</p>
        </div>

        <div class="section">
            <h2>📊 Account Health Overview</h2>
            <div class="metric">
                <div>Health Score</div>
                <div class="health-score">${healthScore}/100</div>
            </div>
            <div class="metric">
                <div>Opportunities</div>
                <div style="font-size: 2em; color: #17a2b8;">${opportunities.length}</div>
            </div>
            <div class="metric">
                <div>Risks</div>
                <div style="font-size: 2em; color: #dc3545;">${risks.length}</div>
            </div>
        </div>

        <div class="section">
            <h2>🚀 Key Opportunities</h2>
            ${opportunities.slice(0, 3).map(opp => `
                <div class="opportunity">
                    <strong>${opp.type || 'Growth Opportunity'}</strong><br>
                    <span style="color: #28a745; font-weight: bold;">$${(opp.value || 0).toLocaleString()}</span>
                    <span style="margin-left: 15px; color: #666;">${Math.round((opp.confidence || 0.5) * 100)}% confidence</span><br>
                    <em>${opp.reasoning || 'Strategic growth opportunity identified'}</em>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>⚠️ Risk Assessment</h2>
            ${risks.slice(0, 3).map(risk => `
                <div class="risk">
                    <strong>${risk.type || 'Account Risk'}</strong><br>
                    <span style="color: #dc3545;">${risk.level || 'medium'} priority</span><br>
                    <em>${risk.description || 'Risk requires attention'}</em>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>📈 Executive Summary</h2>
            <p><strong>Key Highlights:</strong></p>
            <ul>
                ${(accountPlan.executiveSummary?.keyHighlights || []).map(highlight => 
                    `<li>${highlight}</li>`
                ).join('')}
            </ul>
            
            <p><strong>Recommendation:</strong></p>
            <p>${accountPlan.executiveSummary?.recommendation || 'Continue monitoring and engagement'}</p>
        </div>

        <div class="section">
            <h2>🎯 Next Steps</h2>
            ${(accountPlan.actionPlan?.nextSteps || []).slice(0, 3).map(step => `
                <div style="padding: 10px; margin: 5px 0; background: white; border-radius: 4px;">
                    <strong>${step.action}</strong><br>
                    <small>Owner: ${step.owner} | Timeline: ${step.timeline}</small>
                </div>
            `).join('')}
        </div>

        <div class="footer">
            <small>Generated by AI Account Planner | Execution ID: ${context.executionId}</small><br>
            <small>This account plan includes comprehensive analysis and recommendations based on live data integration.</small>
        </div>
    </body>
    </html>
    `;

    const text = `
AI Account Plan: ${accountName}

ACCOUNT HEALTH OVERVIEW
=======================
Health Score: ${healthScore}/100
Opportunities: ${opportunities.length}
Risks: ${risks.length}

KEY OPPORTUNITIES
================
${opportunities.slice(0, 3).map((opp, i) => 
  `${i+1}. ${opp.type || 'Growth Opportunity'} - $${(opp.value || 0).toLocaleString()} (${Math.round((opp.confidence || 0.5) * 100)}% confidence)`
).join('\n')}

RISK ASSESSMENT
==============
${risks.slice(0, 3).map((risk, i) => 
  `${i+1}. ${risk.type || 'Account Risk'} (${risk.level || 'medium'} priority) - ${risk.description || 'Risk requires attention'}`
).join('\n')}

EXECUTIVE SUMMARY
================
${accountPlan.executiveSummary?.recommendation || 'Continue monitoring and engagement'}

Generated by AI Account Planner
Execution ID: ${context.executionId}
    `;

    return { html, text };
  }

  generateExecutiveTemplate(accountPlan, context) {
    // Simplified executive template focusing on key metrics and recommendations
    const { accountName } = context;
    const summary = accountPlan.executiveSummary || {};
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .executive-header { background: #1a237e; color: white; padding: 30px; text-align: center; }
            .key-metrics { display: flex; justify-content: space-around; margin: 30px 0; }
            .metric-card { text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; }
            .metric-value { font-size: 2em; font-weight: bold; color: #1a237e; }
            .recommendation { background: #e8f5e8; border-left: 5px solid #4caf50; padding: 20px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="executive-header">
            <h1>Executive Brief: ${accountName}</h1>
            <p>Strategic Account Overview</p>
        </div>
        
        <div class="key-metrics">
            <div class="metric-card">
                <div class="metric-value">${accountPlan.accountOverview?.healthScore?.score || 'N/A'}</div>
                <div>Health Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${accountPlan.opportunityAnalysis?.identifiedOpportunities?.length || 0}</div>
                <div>Opportunities</div>
            </div>
        </div>

        <div class="recommendation">
            <h3>Strategic Recommendation</h3>
            <p>${summary.recommendation || 'Continue strategic engagement and monitoring'}</p>
        </div>
    </body>
    </html>
    `;

    return { html, text: `Executive Brief: ${accountName}\n\n${summary.recommendation || ''}` };
  }

  generateDetailedTemplate(accountPlan, context) {
    // Full detailed template - same as default for now
    return this.generateDefaultTemplate(accountPlan, context);
  }

  generateSummaryTemplate(accountPlan, context) {
    // Brief summary template for quick notifications
    const { accountName } = context;
    const healthScore = accountPlan.accountOverview?.healthScore?.score || 'N/A';
    
    const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
        <h2 style="color: #333;">📊 ${accountName} - Account Summary</h2>
        <p><strong>Health Score:</strong> <span style="color: ${healthScore >= 80 ? 'green' : healthScore >= 60 ? 'orange' : 'red'};">${healthScore}/100</span></p>
        <p><strong>Status:</strong> ${accountPlan.executiveSummary?.recommendation || 'Monitoring required'}</p>
        <small>Generated: ${new Date().toLocaleString()}</small>
    </div>
    `;

    return { html, text: `${accountName} Account Summary\nHealth: ${healthScore}/100` };
  }
}