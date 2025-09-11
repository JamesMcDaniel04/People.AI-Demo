// AI Account Planner Dashboard JavaScript
class Dashboard {
    constructor() {
        this.apiBase = '';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkSystemHealth();
        this.loadInitialData();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Demo account plan generation
        document.getElementById('generatePlanBtn').addEventListener('click', () => this.generateAccountPlan());

        // Refresh buttons
        document.querySelectorAll('.refresh-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const btn = e.target.closest('.refresh-btn');
                const endpoint = btn?.dataset?.endpoint;
                const action = btn?.dataset?.action;
                if (endpoint) {
                    this.refreshEndpoint(endpoint);
                } else if (action === 'load-settings') {
                    this.loadSettings();
                }
            });
        });

        // Workflow modal
        document.getElementById('createWorkflowBtn').addEventListener('click', () => this.showCreateWorkflowModal());
        document.querySelector('.close-modal').addEventListener('click', () => this.hideCreateWorkflowModal());
        document.querySelector('.cancel-btn').addEventListener('click', () => this.hideCreateWorkflowModal());
        document.getElementById('createWorkflowForm').addEventListener('submit', (e) => this.createWorkflow(e));

        // Modal backdrop click to close
        document.getElementById('createWorkflowModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideCreateWorkflowModal();
            }
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Load tab-specific data
        this.loadTabData(tabName);

        // Lazy load settings
        if (tabName === 'settings') {
            this.loadSettings();
        }
    }

    async loadTabData(tabName) {
        switch (tabName) {
            case 'system':
                await this.loadSystemData();
                break;
            case 'queues':
                await this.loadQueueStats();
                break;
            case 'workflows':
                await this.loadWorkflows();
                break;
            case 'integration':
                await this.loadIntegrationStatus();
                break;
            case 'settings':
                await this.loadSettings();
                break;
        }
    }

    async loadInitialData() {
        await this.loadSystemData();
    }

    // System Health Check
    async checkSystemHealth() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            
            const statusIndicator = document.getElementById('statusIndicator');
            const statusText = document.getElementById('statusText');
            
            if (data.status === 'healthy') {
                statusIndicator.classList.add('healthy');
                statusText.textContent = 'System Healthy';
            } else {
                statusIndicator.classList.add('error');
                statusText.textContent = 'System Error';
            }
        } catch (error) {
            const statusIndicator = document.getElementById('statusIndicator');
            const statusText = document.getElementById('statusText');
            statusIndicator.classList.add('error');
            statusText.textContent = 'Connection Error';
        }
    }

    // Load System Data
    async loadSystemData() {
        await Promise.all([
            this.loadHealthData(),
            this.loadIntegrationData()
        ]);
    }

    async loadHealthData() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            
            document.getElementById('healthContent').innerHTML = `
                <div class="result-item">
                    <div class="result-header">System Status</div>
                    <div class="result-content">Status: ${data.status}</div>
                </div>
                <div class="result-item">
                    <div class="result-header">Version</div>
                    <div class="result-content">v${data.version}</div>
                </div>
                <div class="result-item">
                    <div class="result-header">Last Check</div>
                    <div class="result-content">${new Date(data.timestamp).toLocaleString()}</div>
                </div>
            `;
        } catch (error) {
            document.getElementById('healthContent').innerHTML = `
                <div class="result-item">
                    <div class="result-header">Error</div>
                    <div class="result-content">Failed to load health data: ${error.message}</div>
                </div>
            `;
        }
    }

    async loadIntegrationData() {
        try {
            const response = await fetch('/integration/status');
            const data = await response.json();
            
            let content = `
                <div class="result-item">
                    <div class="result-header">Data Source</div>
                    <div class="result-content">${data.integration.source}</div>
                </div>
            `;
            
            if (data.integration.sample) {
                content += `
                    <div class="result-item">
                        <div class="result-header">Sample Data</div>
                        <div class="result-content">
                            ${data.integration.sample.emails} emails, 
                            ${data.integration.sample.calls} calls, 
                            ${data.integration.sample.stakeholders} stakeholders
                        </div>
                    </div>
                `;
            }
            
            document.getElementById('integrationContent').innerHTML = content;
        } catch (error) {
            document.getElementById('integrationContent').innerHTML = `
                <div class="result-item">
                    <div class="result-header">Error</div>
                    <div class="result-content">Failed to load integration data: ${error.message}</div>
                </div>
            `;
        }
    }

    // Generate Account Plan
    async generateAccountPlan() {
        const accountName = document.getElementById('accountName').value;
        const recipients = document.getElementById('emailRecipients').value.split(',').map(email => email.trim());
        
        this.showLoading();
        
        try {
            const response = await fetch(`/api/demo/${accountName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ recipients })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.displayAccountPlanResults(data);
        } catch (error) {
            this.displayError('Account Plan Generation', error.message);
        } finally {
            this.hideLoading();
        }
    }

    displayAccountPlanResults(data) {
        const resultsDiv = document.getElementById('demoResults');
        
        if (data.status === 'success') {
            let content = `
                <div class="result-item">
                    <div class="result-header">✅ Account Plan Generated Successfully</div>
                    <div class="result-content">
                        Workflow ID: ${data.execution.workflowId}<br>
                        Execution ID: ${data.execution.executionId}<br>
                        Completed: ${new Date(data.execution.completedAt).toLocaleString()}
                    </div>
                </div>
            `;
            
            if (data.execution.results && data.execution.results.length > 0) {
                data.execution.results.forEach(result => {
                    content += `
                        <div class="result-item">
                            <div class="result-header">Account: ${result.accountName}</div>
                            <div class="result-content">
                                Status: ${result.status}<br>
                                Processed: ${new Date(result.processedAt).toLocaleString()}<br>
                                Distribution Results: ${result.distributionResults?.length || 0} channels
                            </div>
                        </div>
                    `;
                    
                    if (result.accountPlan) {
                        content += `
                            <div class="result-item">
                                <div class="result-header">Health Score</div>
                                <div class="result-content">${result.accountPlan.healthScore?.overall || 'N/A'}/10</div>
                            </div>
                            <div class="result-item">
                                <div class="result-header">Opportunities</div>
                                <div class="result-content">${result.accountPlan.opportunities?.length || 0} identified</div>
                            </div>
                            <div class="result-item">
                                <div class="result-header">Risks</div>
                                <div class="result-content">${result.accountPlan.risks?.length || 0} identified</div>
                            </div>
                        `;
                    }
                });
            }
            
            resultsDiv.innerHTML = content;
        } else {
            this.displayError('Account Plan Generation', data.error || 'Unknown error');
        }
    }

    // Load Queue Stats
    async loadQueueStats() {
        try {
            const response = await fetch('/queue/stats');
            const data = await response.json();
            
            if (data.success && data.data.enabled) {
                let content = '<div class="queue-grid">';
                
                Object.entries(data.data.queues).forEach(([queueName, stats]) => {
                    content += `
                        <div class="queue-card">
                            <h4>${queueName.replace(/-/g, ' ').toUpperCase()}</h4>
                            <div class="queue-stats-grid">
                                <div class="stat-item">
                                    <div class="stat-value">${stats.waiting}</div>
                                    <div class="stat-label">Waiting</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${stats.active}</div>
                                    <div class="stat-label">Active</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${stats.completed}</div>
                                    <div class="stat-label">Completed</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${stats.failed}</div>
                                    <div class="stat-label">Failed</div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                content += '</div>';
                document.getElementById('queueStats').innerHTML = content;
            } else {
                document.getElementById('queueStats').innerHTML = `
                    <div class="result-item">
                        <div class="result-header">Queue Status</div>
                        <div class="result-content">Job queues are disabled or unavailable</div>
                    </div>
                `;
            }
        } catch (error) {
            document.getElementById('queueStats').innerHTML = `
                <div class="result-item">
                    <div class="result-header">Error</div>
                    <div class="result-content">Failed to load queue stats: ${error.message}</div>
                </div>
            `;
        }
    }

    // Load Workflows
    async loadWorkflows() {
        try {
            const response = await fetch('/workflows');
            const data = await response.json();
            
            let content = '';
            
            if (data.workflows && data.workflows.length > 0) {
                data.workflows.forEach(workflow => {
                    content += `
                        <div class="workflow-item">
                            <div class="workflow-header">
                                <div class="workflow-name">${workflow.name}</div>
                                <div class="workflow-status ${workflow.enabled ? 'active' : 'inactive'}">
                                    ${workflow.enabled ? 'Active' : 'Inactive'}
                                </div>
                            </div>
                            <div class="workflow-details">
                                <strong>Description:</strong> ${workflow.description || 'No description'}<br>
                                <strong>Engine:</strong> ${workflow.engine}<br>
                                <strong>Created:</strong> ${new Date(workflow.createdAt).toLocaleString()}<br>
                                ${workflow.lastRun ? `<strong>Last Run:</strong> ${new Date(workflow.lastRun).toLocaleString()}` : ''}
                            </div>
                        </div>
                    `;
                });
            } else {
                content = `
                    <div class="workflow-item">
                        <div class="workflow-header">
                            <div class="workflow-name">No workflows found</div>
                        </div>
                        <div class="workflow-details">
                            Create your first workflow using the "Create Workflow" button above.
                        </div>
                    </div>
                `;
            }
            
            document.getElementById('workflowsList').innerHTML = content;
        } catch (error) {
            document.getElementById('workflowsList').innerHTML = `
                <div class="workflow-item">
                    <div class="workflow-header">
                        <div class="workflow-name">Error Loading Workflows</div>
                    </div>
                    <div class="workflow-details">
                        ${error.message}
                    </div>
                </div>
            `;
        }
    }

    // Load Integration Status
    async loadIntegrationStatus() {
        try {
            const response = await fetch('/integration/status');
            const data = await response.json();
            
            let content = '<div class="integration-grid">';
            
            if (data.integration.source === 'sample') {
                content += `
                    <div class="integration-card">
                        <div class="integration-icon">
                            <i class="fas fa-database"></i>
                        </div>
                        <div class="integration-name">Sample Data</div>
                        <div class="integration-status connected">Connected</div>
                    </div>
                `;
            }
            
            // Add placeholder integration cards
            const integrations = [
                { name: 'Gmail', icon: 'envelope', status: 'disconnected' },
                { name: 'Google Calendar', icon: 'calendar', status: 'disconnected' },
                { name: 'Slack', icon: 'slack', status: 'disconnected' },
                { name: 'CRM', icon: 'users', status: 'disconnected' }
            ];
            
            integrations.forEach(integration => {
                content += `
                    <div class="integration-card">
                        <div class="integration-icon">
                            <i class="fab fa-${integration.icon}"></i>
                        </div>
                        <div class="integration-name">${integration.name}</div>
                        <div class="integration-status ${integration.status}">${integration.status}</div>
                    </div>
                `;
            });
            
            content += '</div>';
            document.getElementById('integrationDetails').innerHTML = content;
        } catch (error) {
            document.getElementById('integrationDetails').innerHTML = `
                <div class="result-item">
                    <div class="result-header">Error</div>
                    <div class="result-content">Failed to load integration status: ${error.message}</div>
                </div>
            `;
        }
    }

    // Workflow Modal Management
    showCreateWorkflowModal() {
        document.getElementById('createWorkflowModal').classList.add('active');
    }

    hideCreateWorkflowModal() {
        document.getElementById('createWorkflowModal').classList.remove('active');
        document.getElementById('createWorkflowForm').reset();
    }

    async createWorkflow(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const workflowData = {
            name: formData.get('workflowName') || document.getElementById('workflowName').value,
            description: formData.get('workflowDescription') || document.getElementById('workflowDescription').value,
            trigger: { type: 'schedule' },
            schedule: formData.get('workflowSchedule') || document.getElementById('workflowSchedule').value,
            accounts: [{
                accountName: formData.get('workflowAccount') || document.getElementById('workflowAccount').value,
                customization: {}
            }],
            distributors: [{
                type: 'email',
                config: {
                    recipients: ['demo@example.com']
                }
            }]
        };
        
        this.showLoading();
        
        try {
            const response = await fetch('/workflows', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(workflowData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            this.hideCreateWorkflowModal();
            await this.loadWorkflows(); // Refresh the workflows list
            
            alert('Workflow created successfully!');
        } catch (error) {
            alert(`Error creating workflow: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    // Refresh specific endpoint
    async refreshEndpoint(endpoint) {
        switch (endpoint) {
            case '/health':
                await this.loadHealthData();
                break;
            case '/integration/status':
                await this.loadIntegrationData();
                break;
            case '/queue/stats':
                await this.loadQueueStats();
                break;
        }
    }

    // Utility methods
    showLoading() {
        document.getElementById('loadingOverlay').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }

    displayError(title, message) {
        const resultsDiv = document.getElementById('demoResults');
        resultsDiv.innerHTML = `
            <div class="result-item">
                <div class="result-header">❌ ${title} Failed</div>
                <div class="result-content">${message}</div>
            </div>
        `;
    }

    // SETTINGS
    async loadSettings() {
        try {
            const res = await fetch('/settings');
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to load settings');

            const cur = data.current;
            // AI
            document.getElementById('aiProvider').value = cur.ai.provider;
            document.getElementById('aiTemperature').value = cur.ai.temperature;
            document.getElementById('aiSystemPrompt').value = cur.ai.systemPrompt || '';
            document.getElementById('aiToolSystemPrompt').value = cur.ai.toolSystemPrompt || '';
            // Data/MCP
            document.getElementById('dataSource').value = cur.data.source;
            const servers = cur.data.mcp?.servers || {};
            document.getElementById('mcpGmail').checked = !!servers.gmail?.enabled;
            document.getElementById('mcpCalendar').checked = !!servers.googleCalendar?.enabled;
            document.getElementById('mcpDrive').checked = !!servers.googleDrive?.enabled;
            document.getElementById('mcpSlack').checked = !!servers.slack?.enabled;
            document.getElementById('mcpNotion').checked = !!servers.notion?.enabled;
            // Logging
            document.getElementById('logLevel').value = cur.logging.level || 'info';
        } catch (err) {
            console.error('Failed to load settings', err);
        }
    }

    collectSettingsPayload() {
        const aiProvider = document.getElementById('aiProvider').value;
        const aiTemperature = parseFloat(document.getElementById('aiTemperature').value || '0.1');
        const aiSystemPrompt = document.getElementById('aiSystemPrompt').value;
        const aiToolSystemPrompt = document.getElementById('aiToolSystemPrompt').value;
        const dataSource = document.getElementById('dataSource').value;
        const logLevel = document.getElementById('logLevel').value;

        const mcp = {
            servers: {
                gmail: { enabled: document.getElementById('mcpGmail').checked },
                googleCalendar: { enabled: document.getElementById('mcpCalendar').checked },
                googleDrive: { enabled: document.getElementById('mcpDrive').checked },
                slack: { enabled: document.getElementById('mcpSlack').checked },
                notion: { enabled: document.getElementById('mcpNotion').checked }
            }
        };

        return {
            ai: {
                provider: aiProvider,
                temperature: aiTemperature,
                systemPrompt: aiSystemPrompt,
                toolSystemPrompt: aiToolSystemPrompt
            },
            data: {
                source: dataSource
            },
            mcp,
            logging: { level: logLevel }
        };
    }

    async saveSettings() {
        const payload = this.collectSettingsPayload();
        try {
            this.showLoading();
            const res = await fetch('/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to save settings');
            alert('Settings saved. Click Apply & Reload to take effect.');
        } catch (err) {
            alert(`Failed to save settings: ${err.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async applySettings() {
        try {
            this.showLoading();
            const res = await fetch('/settings/reload', { method: 'POST' });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to apply settings');
            alert('Settings applied and services reloaded.');
            await this.loadSystemData();
        } catch (err) {
            alert(`Failed to apply settings: ${err.message}`);
        } finally {
            this.hideLoading();
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const d = new Dashboard();
    const saveBtn = document.getElementById('saveSettingsBtn');
    const applyBtn = document.getElementById('applySettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => d.saveSettings());
    if (applyBtn) applyBtn.addEventListener('click', () => d.applySettings());
});
