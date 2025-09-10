// AI Account Planner Demo Interface JavaScript
class DemoInterface {
    constructor() {
        this.currentExecution = null;
        this.executionSteps = [
            { id: 'validation', title: 'Configuration Validation', description: 'Validating workflow configuration and inputs' },
            { id: 'initialization', title: 'System Initialization', description: 'Initializing AI services and data integration' },
            { id: 'data_collection', title: 'Data Collection', description: 'Gathering account data from integrated sources' },
            { id: 'ai_analysis', title: 'AI Analysis', description: 'Running multi-model AI analysis pipeline' },
            { id: 'plan_generation', title: 'Plan Generation', description: 'Generating comprehensive account plan' },
            { id: 'distribution', title: 'Distribution', description: 'Distributing account plan via configured channels' }
        ];
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkSystemStatus();
        this.log('Demo interface initialized successfully', 'info');
    }

    bindEvents() {
        // Configuration and execution buttons
        document.getElementById('validateBtn').addEventListener('click', () => this.validateConfiguration());
        document.getElementById('executeBtn').addEventListener('click', () => this.executeWorkflow());
        
        // Error handling buttons
        document.getElementById('retryBtn')?.addEventListener('click', () => this.retryExecution());
        document.getElementById('clearErrorBtn')?.addEventListener('click', () => this.clearError());
        
        // Log management
        document.getElementById('clearLogsBtn').addEventListener('click', () => this.clearLogs());
        
        // Real-time input validation
        document.getElementById('recipientsList').addEventListener('input', () => this.validateRecipients());
        document.getElementById('accountSelect').addEventListener('change', () => this.onAccountChange());
    }

    async checkSystemStatus() {
        this.log('Checking system status...', 'info');
        
        try {
            // Check overall health
            const health = await this.apiCall('/health');
            this.updateSystemStatus('ready');
            
            // Check integration status
            const integration = await this.apiCall('/integration/status');
            this.updateStatusCards(integration);
            
            this.log('System status check completed', 'success');
        } catch (error) {
            this.log(`System status check failed: ${error.message}`, 'error');
            this.updateSystemStatus('error');
        }
    }

    updateStatusCards(integrationData) {
        // AI Services Status
        const aiStatus = integrationData?.ai?.status === 'ready' ? 'success' : 'error';
        const aiText = integrationData?.ai?.status === 'ready' 
            ? `${integrationData.ai.models?.length || 0} models ready`
            : 'Services unavailable';
        this.updateStatusCard('aiStatus', aiStatus, aiText);

        // Data Integration Status
        const dataStatus = integrationData?.data?.status === 'ready' ? 'success' : 'error';
        const dataText = integrationData?.data?.status === 'ready'
            ? `${integrationData.data.sources?.length || 0} sources connected`
            : 'Integration failed';
        this.updateStatusCard('dataStatus', dataStatus, dataText);

        // Email Distribution Status
        const emailStatus = integrationData?.email?.status === 'ready' ? 'success' : 'warning';
        const emailText = integrationData?.email?.status === 'ready'
            ? 'Postmark configured'
            : 'Mock mode active';
        this.updateStatusCard('emailStatus', emailStatus, emailText);

        // Workflow Engine Status
        const workflowStatus = integrationData?.workflow?.status === 'ready' ? 'success' : 'error';
        const workflowText = integrationData?.workflow?.status === 'ready'
            ? 'Internal engine ready'
            : 'Engine unavailable';
        this.updateStatusCard('workflowStatus', workflowStatus, workflowText);
    }

    updateStatusCard(cardId, status, text) {
        const card = document.getElementById(cardId);
        const icon = card.querySelector('.status-icon');
        const value = card.querySelector('.status-value');
        
        // Remove existing status classes
        icon.classList.remove('success', 'error', 'warning');
        icon.classList.add(status);
        
        value.textContent = text;
    }

    updateSystemStatus(status) {
        const indicator = document.getElementById('systemStatus');
        const statusText = indicator.querySelector('span');
        const statusIcon = indicator.querySelector('i');
        
        indicator.className = `status-indicator ${status}`;
        
        switch (status) {
            case 'ready':
                statusText.textContent = 'System Ready';
                statusIcon.className = 'fas fa-circle';
                break;
            case 'running':
                statusText.textContent = 'Executing...';
                statusIcon.className = 'fas fa-spinner fa-spin';
                break;
            case 'error':
                statusText.textContent = 'System Error';
                statusIcon.className = 'fas fa-exclamation-circle';
                break;
            case 'warning':
                statusText.textContent = 'System Warning';
                statusIcon.className = 'fas fa-exclamation-triangle';
                break;
        }
    }

    validateConfiguration() {
        this.log('Validating configuration...', 'info');
        
        const config = this.getConfiguration();
        const validation = this.performValidation(config);
        
        if (validation.isValid) {
            this.log('✅ Configuration validation passed', 'success');
            this.showSuccess('Configuration is valid and ready for execution');
            document.getElementById('executeBtn').disabled = false;
        } else {
            this.log('❌ Configuration validation failed', 'error');
            this.showError('Configuration Validation Failed', validation.errors);
            document.getElementById('executeBtn').disabled = true;
        }
    }

    performValidation(config) {
        const errors = [];
        
        // Validate account selection
        if (!config.accountName) {
            errors.push('Account selection is required');
        }
        
        // Validate recipients
        if (!config.recipients || config.recipients.length === 0) {
            errors.push('At least one recipient email is required');
        } else {
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const invalidEmails = config.recipients.filter(email => !emailRegex.test(email.trim()));
            if (invalidEmails.length > 0) {
                errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`);
            }
        }
        
        // Validate template selection
        if (!config.template) {
            errors.push('Email template selection is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    validateRecipients() {
        const recipientsList = document.getElementById('recipientsList');
        const recipients = recipientsList.value.split('\n').filter(email => email.trim());
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        let hasInvalidEmail = false;
        recipients.forEach(email => {
            if (email.trim() && !emailRegex.test(email.trim())) {
                hasInvalidEmail = true;
            }
        });
        
        if (hasInvalidEmail) {
            recipientsList.style.borderColor = 'var(--error-color)';
        } else {
            recipientsList.style.borderColor = 'var(--border-color)';
        }
    }

    getConfiguration() {
        const recipientsList = document.getElementById('recipientsList').value;
        const recipients = recipientsList.split('\n')
            .map(email => email.trim())
            .filter(email => email);
            
        return {
            accountName: document.getElementById('accountSelect').value,
            template: document.getElementById('templateSelect').value,
            recipients: recipients,
            customSubject: document.getElementById('customSubject').value || undefined
        };
    }

    async executeWorkflow() {
        const config = this.getConfiguration();
        const validation = this.performValidation(config);
        
        if (!validation.isValid) {
            this.showError('Configuration Invalid', validation.errors);
            return;
        }

        this.log(`🚀 Starting workflow execution for ${config.accountName}`, 'info');
        this.showExecutionPanel();
        this.updateSystemStatus('running');
        this.disableControls(true);

        try {
            // Initialize execution steps
            this.initializeExecutionSteps();
            
            // Step 1: Validation
            this.updateExecutionStep('validation', 'active');
            await this.delay(1000);
            this.updateExecutionStep('validation', 'completed');
            this.updateProgress(16.67);

            // Step 2: System Initialization
            this.updateExecutionStep('initialization', 'active');
            await this.delay(2000);
            this.updateExecutionStep('initialization', 'completed');
            this.updateProgress(33.33);

            // Step 3: Data Collection
            this.updateExecutionStep('data_collection', 'active');
            this.log(`📊 Collecting data for ${config.accountName}...`, 'info');
            await this.delay(3000);
            this.updateExecutionStep('data_collection', 'completed');
            this.updateProgress(50);

            // Step 4: AI Analysis (longest step)
            this.updateExecutionStep('ai_analysis', 'active');
            this.log('🤖 Running AI analysis with Claude 3.5 + GPT-4o...', 'info');
            await this.delay(2000);
            this.updateProgress(66.67);

            // Step 5: Plan Generation
            this.updateExecutionStep('ai_analysis', 'completed');
            this.updateExecutionStep('plan_generation', 'active');
            this.log('📋 Generating comprehensive account plan...', 'info');
            
            // Make actual API call
            const executionData = await this.executeWorkflowAPI(config);
            this.currentExecution = executionData;
            
            this.updateExecutionStep('plan_generation', 'completed');
            this.updateProgress(83.33);

            // Step 6: Distribution
            this.updateExecutionStep('distribution', 'active');
            this.log('📧 Distributing account plan...', 'info');
            await this.delay(2000);
            this.updateExecutionStep('distribution', 'completed');
            this.updateProgress(100);

            // Show results
            this.showExecutionResults(executionData);
            this.log('✅ Workflow execution completed successfully', 'success');
            this.updateSystemStatus('ready');

        } catch (error) {
            this.log(`❌ Workflow execution failed: ${error.message}`, 'error');
            this.showError('Execution Failed', [error.message]);
            this.updateSystemStatus('error');
            this.markCurrentStepAsError();
        } finally {
            this.disableControls(false);
        }
    }

    async executeWorkflowAPI(config) {
        const payload = {
            recipients: config.recipients.map(email => ({ email: email.trim() })),
            template: config.template
        };

        if (config.customSubject) {
            payload.subject = config.customSubject;
        }

        const response = await this.apiCall(`/api/demo/${encodeURIComponent(config.accountName)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.success) {
            throw new Error(response.error || 'Workflow execution failed');
        }

        return response;
    }

    showExecutionPanel() {
        const panel = document.getElementById('executionPanel');
        panel.style.display = 'block';
        panel.classList.add('slide-up');
        this.updateProgressText('Initializing workflow execution...');
    }

    initializeExecutionSteps() {
        const stepsContainer = document.getElementById('executionSteps');
        stepsContainer.innerHTML = '';

        this.executionSteps.forEach((step, index) => {
            const stepElement = this.createStepElement(step, index);
            stepsContainer.appendChild(stepElement);
        });
    }

    createStepElement(step, index) {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'step';
        stepDiv.id = `step-${step.id}`;
        
        stepDiv.innerHTML = `
            <div class="step-icon">
                <i class="fas fa-circle"></i>
            </div>
            <div class="step-content">
                <div class="step-title">${step.title}</div>
                <div class="step-description">${step.description}</div>
            </div>
            <div class="step-time" id="step-time-${step.id}"></div>
        `;
        
        return stepDiv;
    }

    updateExecutionStep(stepId, status) {
        const stepElement = document.getElementById(`step-${stepId}`);
        const timeElement = document.getElementById(`step-time-${stepId}`);
        const icon = stepElement.querySelector('.step-icon i');
        
        // Remove existing status classes
        stepElement.classList.remove('active', 'completed', 'error');
        stepElement.classList.add(status);
        
        switch (status) {
            case 'active':
                icon.className = 'fas fa-spinner fa-spin';
                timeElement.textContent = 'In progress...';
                this.updateProgressText(`${this.executionSteps.find(s => s.id === stepId)?.title}...`);
                break;
            case 'completed':
                icon.className = 'fas fa-check';
                timeElement.textContent = new Date().toLocaleTimeString();
                break;
            case 'error':
                icon.className = 'fas fa-times';
                timeElement.textContent = 'Failed';
                break;
        }
    }

    markCurrentStepAsError() {
        const activeStep = document.querySelector('.step.active');
        if (activeStep) {
            activeStep.classList.remove('active');
            activeStep.classList.add('error');
            const icon = activeStep.querySelector('.step-icon i');
            const timeElement = activeStep.querySelector('.step-time');
            icon.className = 'fas fa-times';
            timeElement.textContent = 'Failed';
        }
    }

    updateProgress(percentage) {
        const progressBar = document.getElementById('progressBar');
        progressBar.style.width = `${percentage}%`;
    }

    updateProgressText(text) {
        const progressText = document.getElementById('progressText');
        progressText.textContent = text;
    }

    showExecutionResults(executionData) {
        const resultsContainer = document.getElementById('executionResults');
        const accountPlan = executionData.results?.[0]?.accountPlan;
        const distributionResults = executionData.results?.[0]?.distributionResults;
        
        if (!accountPlan) {
            resultsContainer.innerHTML = '<p>No results available</p>';
            return;
        }

        const resultsHTML = `
            <div class="result-grid">
                <div class="result-card">
                    <h4><i class="fas fa-heart"></i> Health Score</h4>
                    <div class="result-value">${accountPlan.accountOverview?.healthScore?.score || 'N/A'}/100</div>
                    <div class="result-description">Overall account health rating</div>
                </div>
                <div class="result-card">
                    <h4><i class="fas fa-bullseye"></i> Opportunities</h4>
                    <div class="result-value">${accountPlan.opportunityAnalysis?.identifiedOpportunities?.length || 0}</div>
                    <div class="result-description">Growth opportunities identified</div>
                </div>
                <div class="result-card">
                    <h4><i class="fas fa-exclamation-triangle"></i> Risks</h4>
                    <div class="result-value">${accountPlan.riskAssessment?.identifiedRisks?.length || 0}</div>
                    <div class="result-description">Risks requiring attention</div>
                </div>
                <div class="result-card">
                    <h4><i class="fas fa-users"></i> Stakeholders</h4>
                    <div class="result-value">${accountPlan.stakeholderMap?.keyRelationships?.length || 0}</div>
                    <div class="result-description">Key relationships mapped</div>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem;">
                <h4>📧 Distribution Results:</h4>
                <div style="margin-top: 0.5rem;">
                    ${this.formatDistributionResults(distributionResults)}
                </div>
            </div>
            
            <div style="margin-top: 1.5rem;">
                <h4>🎯 Key Insights:</h4>
                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                    ${(accountPlan.executiveSummary?.keyHighlights || []).map(highlight => 
                        `<li>${highlight}</li>`
                    ).join('')}
                </ul>
            </div>
            
            <div style="margin-top: 1.5rem;">
                <h4>📋 Executive Summary:</h4>
                <p style="margin-top: 0.5rem; padding: 1rem; background: var(--light-color); border-radius: 8px;">
                    ${accountPlan.executiveSummary?.recommendation || 'Account analysis completed successfully.'}
                </p>
            </div>
        `;

        resultsContainer.innerHTML = resultsHTML;
        resultsContainer.style.display = 'block';
        resultsContainer.classList.add('fade-in');
        
        this.updateProgressText('Execution completed successfully!');
    }

    formatDistributionResults(distributionResults) {
        if (!distributionResults || distributionResults.length === 0) {
            return '<p>No distribution results available</p>';
        }

        return distributionResults.map(result => {
            const status = result.status === 'success' ? '✅' : '❌';
            const details = result.status === 'success' 
                ? `Sent to ${result.result?.sentCount || 0} recipients`
                : `Failed: ${result.result?.results?.[0]?.error || 'Unknown error'}`;
            
            return `<div style="padding: 0.5rem; margin: 0.25rem 0; background: var(--light-color); border-radius: 4px;">
                ${status} <strong>${result.type.toUpperCase()}</strong>: ${details}
            </div>`;
        }).join('');
    }

    showError(title, errors) {
        const errorPanel = document.getElementById('errorPanel');
        const errorContent = document.getElementById('errorContent');
        
        const errorHTML = `
            <h3 style="color: var(--error-color); margin-bottom: 1rem;">${title}</h3>
            <ul style="margin-left: 1.5rem;">
                ${Array.isArray(errors) ? errors.map(error => `<li>${error}</li>`).join('') : `<li>${errors}</li>`}
            </ul>
        `;
        
        errorContent.innerHTML = errorHTML;
        errorPanel.style.display = 'block';
        errorPanel.classList.add('slide-up');
    }

    showSuccess(message) {
        // Create temporary success notification
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success-color);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: var(--shadow-lg);
        `;
        successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    clearError() {
        const errorPanel = document.getElementById('errorPanel');
        errorPanel.style.display = 'none';
    }

    retryExecution() {
        this.clearError();
        this.executeWorkflow();
    }

    disableControls(disabled) {
        document.getElementById('validateBtn').disabled = disabled;
        document.getElementById('executeBtn').disabled = disabled;
        document.getElementById('accountSelect').disabled = disabled;
        document.getElementById('templateSelect').disabled = disabled;
        document.getElementById('recipientsList').disabled = disabled;
        document.getElementById('customSubject').disabled = disabled;
    }

    onAccountChange() {
        const accountName = document.getElementById('accountSelect').value;
        this.log(`Account selection changed to: ${accountName}`, 'info');
        
        // Update placeholder subject if not customized
        const subjectField = document.getElementById('customSubject');
        if (!subjectField.value) {
            subjectField.placeholder = `[DEMO] Account Plan: ${accountName}`;
        }
    }

    clearLogs() {
        const logsContent = document.getElementById('logsContent');
        logsContent.innerHTML = `
            <div class="log-entry info">
                <span class="log-time">[CLEARED]</span>
                <span class="log-message">Logs cleared</span>
            </div>
        `;
    }

    log(message, level = 'info') {
        const logsContent = document.getElementById('logsContent');
        const timestamp = new Date().toLocaleTimeString();
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${level}`;
        logEntry.innerHTML = `
            <span class="log-time">[${timestamp}]</span>
            <span class="log-message">${message}</span>
        `;
        
        logsContent.appendChild(logEntry);
        logsContent.scrollTop = logsContent.scrollHeight;
    }

    async apiCall(endpoint, options = {}) {
        const response = await fetch(endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the demo interface when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.demoInterface = new DemoInterface();
});