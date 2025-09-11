// Simplified Distribution System - Simulates email and Slack delivery
// This replaces complex integrations with demo-friendly simulations

export class SimplifiedDistribution {
  constructor() {
    this.distributionHistory = [];
  }

  // Simulate email distribution (like Postmark/SMTP)
  async sendEmail(recipients, subject, content, template = 'default') {
    // Simulate email sending delay
    await this.sleep(500);
    
    const emailResult = {
      id: this.generateId(),
      type: 'email',
      timestamp: new Date().toISOString(),
      recipients: recipients,
      subject: subject,
      template: template,
      status: 'sent',
      messageId: `demo-email-${Date.now()}`,
      details: {
        provider: 'demo_smtp',
        deliveryTime: '0.5s',
        opens: Math.floor(Math.random() * recipients.length) + 1,
        clicks: Math.floor(Math.random() * 3)
      }
    };

    this.distributionHistory.push(emailResult);
    
    // Log the email content for demo purposes
    console.log('\n📧 EMAIL SENT:');
    console.log(`   To: ${recipients.join(', ')}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Template: ${template}`);
    console.log(`   Status: ✅ Delivered`);
    
    return emailResult;
  }

  // Simulate Slack notification (like mentioned in conversation)
  async sendSlackMessage(channels, content, mentions = [], format = 'summary') {
    // Simulate Slack API delay
    await this.sleep(300);
    
    const slackResult = {
      id: this.generateId(),
      type: 'slack',
      timestamp: new Date().toISOString(),
      channels: channels,
      mentions: mentions,
      format: format,
      status: 'posted',
      messageId: `demo-slack-${Date.now()}`,
      details: {
        workspace: 'demo-workspace',
        reactions: ['👍', '🎯', '💡'][Math.floor(Math.random() * 3)],
        replies: Math.floor(Math.random() * 5)
      }
    };

    this.distributionHistory.push(slackResult);
    
    // Log the Slack message for demo purposes
    console.log('\n💬 SLACK MESSAGE POSTED:');
    console.log(`   Channels: ${channels.join(', ')}`);
    console.log(`   Format: ${format}`);
    console.log(`   Mentions: ${mentions.length > 0 ? mentions.join(', ') : 'None'}`);
    console.log(`   Status: ✅ Posted`);
    
    return slackResult;
  }

  // Simulate CRM update (Salesforce/HubSpot integration)
  async updateCRM(accountName, actions, data) {
    // Simulate CRM API delay
    await this.sleep(700);
    
    const crmResult = {
      id: this.generateId(),
      type: 'crm',
      timestamp: new Date().toISOString(),
      account: accountName,
      actions: actions,
      status: 'updated',
      recordId: `demo-crm-${Date.now()}`,
      details: {
        provider: 'demo_crm',
        updatedFields: actions.length,
        tasksCreated: actions.includes('createTasks') ? Math.floor(Math.random() * 3) + 1 : 0,
        opportunitiesUpdated: actions.includes('updateOpportunities') ? 1 : 0
      }
    };

    this.distributionHistory.push(crmResult);
    
    // Log the CRM update for demo purposes
    console.log('\n🔄 CRM UPDATED:');
    console.log(`   Account: ${accountName}`);
    console.log(`   Actions: ${actions.join(', ')}`);
    console.log(`   Status: ✅ Updated`);
    
    return crmResult;
  }

  // Main distribution orchestrator
  async distributeAccountPlan(accountPlan, distributionConfig) {
    console.log('\n🚀 DISTRIBUTING ACCOUNT PLAN...');
    console.log(`   Account: ${accountPlan.accountName || 'Demo Account'}`);
    console.log(`   Distribution Channels: ${distributionConfig.length}`);
    
    const results = [];
    
    for (const config of distributionConfig) {
      try {
        let result;
        
        switch (config.type) {
          case 'email':
            result = await this.distributeViaEmail(accountPlan, config);
            break;
          case 'slack':
            result = await this.distributeViaSlack(accountPlan, config);
            break;
          case 'crm':
            result = await this.distributeToCRM(accountPlan, config);
            break;
          default:
            throw new Error(`Unknown distribution type: ${config.type}`);
        }
        
        results.push(result);
        
      } catch (error) {
        results.push({
          type: config.type,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.log(`\n✅ DISTRIBUTION COMPLETE: ${results.filter(r => r.status === 'sent' || r.status === 'posted' || r.status === 'updated').length}/${results.length} successful`);
    
    return results;
  }

  // Email distribution handler
  async distributeViaEmail(accountPlan, config) {
    const subject = config.subject || `Account Plan: ${accountPlan.accountName || 'Demo Account'}`;
    const emailContent = this.formatEmailContent(accountPlan, config.template || 'default');
    
    return await this.sendEmail(
      config.recipients || ['demo@example.com'],
      subject,
      emailContent,
      config.template || 'default'
    );
  }

  // Slack distribution handler
  async distributeViaSlack(accountPlan, config) {
    const slackContent = this.formatSlackContent(accountPlan, config.format || 'summary');
    
    return await this.sendSlackMessage(
      config.channels || ['#account-planning'],
      slackContent,
      config.mentions || [],
      config.format || 'summary'
    );
  }

  // CRM distribution handler
  async distributeToCRM(accountPlan, config) {
    const actions = config.actions || ['updateAccount'];
    
    return await this.updateCRM(
      accountPlan.accountName || 'Demo Account',
      actions,
      accountPlan
    );
  }

  // Format content for email
  formatEmailContent(accountPlan, template) {
    switch (template) {
      case 'executive':
        return this.formatExecutiveEmail(accountPlan);
      case 'summary':
        return this.formatSummaryEmail(accountPlan);
      default:
        return this.formatDefaultEmail(accountPlan);
    }
  }

  formatExecutiveEmail(accountPlan) {
    return `
**EXECUTIVE ACCOUNT SUMMARY**

Account: ${accountPlan.accountName}
Health Score: ${accountPlan.accountOverview?.healthScore?.score}/100
Total Pipeline: ${accountPlan.opportunityAnalysis?.totalPipelineValue}

KEY OPPORTUNITIES:
${accountPlan.opportunityAnalysis?.identifiedOpportunities?.slice(0, 3).map(opp => 
  `• ${opp.title} (${opp.value})`
).join('\n') || 'No opportunities identified'}

EXECUTIVE SUMMARY:
${accountPlan.executiveSummary?.keyHighlights?.join('\n• ') || 'No highlights available'}

Next Actions: Strategic review scheduled
`;
  }

  formatSummaryEmail(accountPlan) {
    return `
**ACCOUNT PLAN SUMMARY**

${accountPlan.accountName}
Health: ${accountPlan.accountOverview?.healthScore?.score}/100

Top Opportunities:
${accountPlan.opportunityAnalysis?.identifiedOpportunities?.slice(0, 2).map(opp => 
  `• ${opp.title}`
).join('\n') || 'No opportunities'}

Key Risks:
${accountPlan.riskAssessment?.identifiedRisks?.slice(0, 2).map(risk => 
  `• ${risk.risk}`
).join('\n') || 'No risks identified'}
`;
  }

  formatDefaultEmail(accountPlan) {
    return `
**DAILY ACCOUNT COACHING - ${accountPlan.accountName}**

🎯 Health Score: ${accountPlan.accountOverview?.healthScore?.score}/100
📊 Pipeline Value: ${accountPlan.opportunityAnalysis?.totalPipelineValue}

Priority Actions:
${accountPlan.strategicRecommendations?.immediateActions?.slice(0, 3).map(action => 
  `• ${action.action} (${action.timeline})`
).join('\n') || 'No immediate actions'}

Full account plan attached.
`;
  }

  // Format content for Slack
  formatSlackContent(accountPlan, format) {
    switch (format) {
      case 'detailed':
        return this.formatDetailedSlack(accountPlan);
      case 'alert':
        return this.formatAlertSlack(accountPlan);
      default:
        return this.formatSummarySlack(accountPlan);
    }
  }

  formatSummarySlack(accountPlan) {
    return `🎯 **Daily Account Update: ${accountPlan.accountName}**

📊 Health Score: ${accountPlan.accountOverview?.healthScore?.score}/100
💰 Pipeline: ${accountPlan.opportunityAnalysis?.totalPipelineValue}

**Top Priority:** ${accountPlan.strategicRecommendations?.immediateActions?.[0]?.action || 'Review account plan'}`;
  }

  formatDetailedSlack(accountPlan) {
    return `📋 **Account Plan Generated: ${accountPlan.accountName}**

🏥 **Health:** ${accountPlan.accountOverview?.healthScore?.score}/100 (${accountPlan.accountOverview?.healthScore?.trend})
💼 **Pipeline:** ${accountPlan.opportunityAnalysis?.totalPipelineValue}
⚠️ **Risk Level:** ${accountPlan.riskAssessment?.overallRiskLevel}

**Key Opportunities:**
${accountPlan.opportunityAnalysis?.identifiedOpportunities?.slice(0, 2).map(opp => 
  `• ${opp.title} (${opp.probability})`
).join('\n') || 'No opportunities'}

**Next Actions:**
${accountPlan.strategicRecommendations?.immediateActions?.slice(0, 2).map(action => 
  `• ${action.action} - ${action.timeline}`
).join('\n') || 'No actions'}`;
  }

  formatAlertSlack(accountPlan) {
    const urgentRisks = accountPlan.riskAssessment?.identifiedRisks?.filter(r => r.severity === 'High') || [];
    const urgentActions = accountPlan.strategicRecommendations?.immediateActions?.slice(0, 1) || [];
    
    return `🚨 **URGENT: Account Alert - ${accountPlan.accountName}**

${urgentRisks.length > 0 ? `⚠️ **High Risk:** ${urgentRisks[0].risk}` : ''}
${urgentActions.length > 0 ? `🎯 **Action Required:** ${urgentActions[0].action}` : ''}

Health Score: ${accountPlan.accountOverview?.healthScore?.score}/100
@channel - Immediate attention required`;
  }

  // Get distribution history
  getDistributionHistory(limit = 10) {
    return this.distributionHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  // Utility methods
  generateId() {
    return `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Clear history (for demo reset)
  clearHistory() {
    this.distributionHistory = [];
    console.log('📋 Distribution history cleared');
  }
}

export default SimplifiedDistribution;