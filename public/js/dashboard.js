// AI Account Planner Dashboard JavaScript
class Dashboard {
    constructor() {
        this.apiBase = '';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkSystemHealth();
        // Load initial data for visible tabs
        await this.loadWorkflows();
        await this.loadQueueStats();
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

        // Schedule preset helper
        const preset = document.getElementById('schedulePreset');
        if (preset) {
            preset.addEventListener('change', (e) => {
                const value = e.target.value;
                if (value) {
                    const cron = document.getElementById('workflowSchedule');
                    if (cron) cron.value = value;
                }
            });
        }

        // Schedule builder (Create Workflow Modal)
        this.initScheduleBuilder({
            typeId: 'scheduleType',
            cronId: 'workflowSchedule',
            containerId: 'scheduleBuilder',
            fields: {
                daily: { hourId: 'scheduleHour', minuteId: 'scheduleMinuteDaily' },
                weekly: { dowId: 'scheduleDOW', hourId: 'scheduleHourWeekly', minuteId: 'scheduleMinuteWeekly' }
            }
        });

        // Schedule builder (Demo Workflow Creator)
        this.initScheduleBuilder({
            typeId: 'demoScheduleType',
            cronId: 'demoWorkflowSchedule',
            containerId: 'demoScheduleBuilder',
            fields: {
                daily: { hourId: 'demoScheduleHour', minuteId: 'demoScheduleMinuteDaily' },
                weekly: { dowId: 'demoScheduleDOW', hourId: 'demoScheduleHourWeekly', minuteId: 'demoScheduleMinuteWeekly' }
            }
        });

        // Modal backdrop click to close
        document.getElementById('createWorkflowModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideCreateWorkflowModal();
            }
        });

        // People.ai modal
        const pplOpen = document.getElementById('openPeopleAIConfig');
        const pplClose = document.getElementById('closePeopleAIConfig');
        const pplSave = document.getElementById('savePeopleAIConfig');
        if (pplOpen) pplOpen.addEventListener('click', () => this.showPeopleAIModal());
        if (pplClose) pplClose.addEventListener('click', () => this.hidePeopleAIModal());
        if (pplSave) pplSave.addEventListener('click', () => this.savePeopleAIConfig());

        // Centralized click handling for workflows list
        const workflowsList = document.getElementById('workflowsList');
        if (workflowsList) {
            workflowsList.addEventListener('click', (e) => this.handleWorkflowsListClick(e));
        }
    }

    // Handle clicks on workflow actions (run/edit/save/toggle)
    async handleWorkflowsListClick(e) {
        const runBtn = e.target.closest('.btn-run');
        const editBtn = e.target.closest('.btn-edit-schedule');
        const saveBtn = e.target.closest('.btn-save-schedule');
        const toggleBtn = e.target.closest('.btn-toggle');

        if (!runBtn && !editBtn && !saveBtn && !toggleBtn) return;
        e.preventDefault();

        if (runBtn) {
            await this.runWorkflow(runBtn.dataset.id);
            return;
        }
        if (editBtn) {
            let panel;
            if (editBtn.dataset.name) {
                const item = editBtn.closest('.workflow-item');
                panel = item?.querySelector('.edit-schedule');
            } else {
                panel = document.getElementById(`edit-${editBtn.dataset.id}`);
            }
            if (panel) {
                const willShow = panel.style.display === 'none';
                panel.style.display = willShow ? 'block' : 'none';
                if (willShow && !panel.dataset.inited) {
                    this.initMiniScheduler(panel);
                    panel.dataset.inited = '1';
                }
            }
            return;
        }
        if (saveBtn) {
            // Mock-only save (UI)
            if (saveBtn.dataset.mock === 'true') {
                const item = saveBtn.closest('.workflow-item');
                const input = item?.querySelector('.edit-schedule .cron-input');
                if (input) await this.saveMockSchedule(saveBtn.dataset.name, input.value);
            } else if (saveBtn.dataset.name) {
                // BullMQ schedule update by name
                const item = saveBtn.closest('.workflow-item');
                const input = item?.querySelector('.edit-schedule .cron-input');
                if (input) await this.saveQueueWorkflowSchedule(saveBtn.dataset.name, input.value);
            } else {
                // Orchestrator workflow by id
                const panel = document.getElementById(`edit-${saveBtn.dataset.id}`);
                const input = panel?.querySelector('.cron-input');
                if (input) await this.saveWorkflowSchedule(saveBtn.dataset.id, input.value);
            }
            return;
        }
        if (toggleBtn) {
            await this.toggleWorkflow(toggleBtn.dataset.id, toggleBtn.dataset.next === 'true');
            return;
        }
    }

    // Initialize a schedule builder that outputs cron
    initScheduleBuilder(cfg) {
        const typeEl = document.getElementById(cfg.typeId);
        const cronEl = document.getElementById(cfg.cronId);
        const container = document.getElementById(cfg.containerId);
        if (!typeEl || !cronEl || !container) return;

        // Helper to populate time selects
        const fill = (id, max) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.options.length > 0) return; // already filled
            for (let i = 0; i <= max; i++) {
                const opt = document.createElement('option');
                opt.value = String(i);
                opt.text = i.toString().padStart(2, '0');
                el.appendChild(opt);
            }
        };

        // Populate hours/minutes selects
        const f = cfg.fields;
        // hourly has no minute selection; defaults to :00
        if (f.daily?.hourId) fill(f.daily.hourId, 23);
        if (f.daily?.minuteId) fill(f.daily.minuteId, 59);
        if (f.weekly?.hourId) fill(f.weekly.hourId, 23);
        if (f.weekly?.minuteId) fill(f.weekly.minuteId, 59);

        const showOnly = (mode) => {
            container.style.display = mode ? 'block' : 'none';
            const hourly = document.getElementById(container.id.replace('Builder', 'Builder').replace(cfg.containerId, '') + '');
            // Toggle specific sub-sections
            const map = {
                hourly: document.getElementById(container.id.replace(cfg.containerId, 'builderHourly')) || document.getElementById('builderHourly') || document.getElementById('demoBuilderHourly'),
                daily: document.getElementById(container.id.replace(cfg.containerId, 'builderDaily')) || document.getElementById('builderDaily') || document.getElementById('demoBuilderDaily'),
                weekly: document.getElementById(container.id.replace(cfg.containerId, 'builderWeekly')) || document.getElementById('builderWeekly') || document.getElementById('demoBuilderWeekly')
            };
            // Determine section ids explicitly to avoid confusion
            const hourlyEl = document.getElementById(cfg.containerId.includes('demo') ? 'demoBuilderHourly' : 'builderHourly');
            const dailyEl = document.getElementById(cfg.containerId.includes('demo') ? 'demoBuilderDaily' : 'builderDaily');
            const weeklyEl = document.getElementById(cfg.containerId.includes('demo') ? 'demoBuilderWeekly' : 'builderWeekly');
            if (hourlyEl) hourlyEl.style.display = mode === 'hourly' ? 'block' : 'none';
            if (dailyEl) dailyEl.style.display = mode === 'daily' ? 'block' : 'none';
            if (weeklyEl) weeklyEl.style.display = mode === 'weekly' ? 'block' : 'none';
        };

        const rebuildCron = () => {
            const mode = typeEl.value;
            if (!mode) return; // custom
            let cron = '* * * * *';
            if (mode === 'hourly') {
                // Always at :00 each hour
                cron = `0 * * * *`;
            } else if (mode === 'daily') {
                const h = document.getElementById(f.daily.hourId).value || '9';
                const m = document.getElementById(f.daily.minuteId).value || '0';
                cron = `${m} ${h} * * *`;
            } else if (mode === 'weekly') {
                const d = document.getElementById(f.weekly.dowId).value || '1';
                const h = document.getElementById(f.weekly.hourId).value || '9';
                const m = document.getElementById(f.weekly.minuteId).value || '0';
                cron = `${m} ${h} * * ${d}`;
            }
            cronEl.value = cron;
        };

        typeEl.addEventListener('change', () => {
            const mode = typeEl.value;
            if (!mode) {
                container.style.display = 'none';
                return;
            }
            container.style.display = 'block';
            showOnly(mode);
            rebuildCron();
        });

        // Hook change events on all builder inputs
        ['hourly', 'daily', 'weekly'].forEach(mode => {
            const cfgMode = f[mode];
            if (!cfgMode) return;
            Object.values(cfgMode).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('change', rebuildCron);
            });
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
            case 'workflows':
                await this.loadWorkflows();
                await this.loadQueueStats();
                break;
            case 'integration':
                await this.loadIntegrationStatus();
                break;
            case 'settings':
                await this.loadSettings();
                break;
        }
    }

    // People.ai modal controls
    showPeopleAIModal() { document.getElementById('peopleaiModal').classList.add('active'); }
    hidePeopleAIModal() { document.getElementById('peopleaiModal').classList.remove('active'); }

    async savePeopleAIConfig() {
        // Collect preview flags and store under settings.peopleai
        const payload = {
            peopleai: {
                enabled: document.getElementById('peopleaiEnabled').checked,
                features: {
                    autoCapture: document.getElementById('peopleaiFeatureCapture').checked,
                    engagementScoring: document.getElementById('peopleaiFeatureEngagement').checked,
                    coachingInsights: document.getElementById('peopleaiFeatureCoaching').checked,
                    workflowTriggers: document.getElementById('peopleaiFeatureTriggers').checked
                }
            }
        };

        try {
            this.showLoading();
            const res = await fetch('/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to save People.ai settings');
            this.hidePeopleAIModal();
            alert('Saved People.ai preview settings. (No live connection — UI only)');
        } catch (err) {
            alert(`Failed to save People.ai settings: ${err.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async loadInitialData() { /* removed system tab init */ }

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
    async loadSystemData() { /* system tab removed */ }

    async loadHealthData() { /* system tab removed */ }

    async loadIntegrationData() {
        try {
            const response = await fetch('/integration/status');
            const data = await response.json();
            
            // If integration tab is visible, render grid there; otherwise ignore silently
            const el = document.getElementById('integrationDetails');
            if (el) {
                let content = '<div class="integration-grid">';
                content += `
                    <div class="integration-card">
                        <div class="integration-icon">
                            <i class="fas fa-database"></i>
                        </div>
                        <div class="integration-name">${data.integration.source.toUpperCase()}</div>
                        <div class="integration-status connected">${data.integration.source === 'sample' ? 'Connected' : 'Configured'}</div>
                    </div>`;
                content += '</div>';
                el.innerHTML = content;
            }
        } catch (error) {
            // no-op if element is absent
        }
    }

    // Generate Account Plan
    async generateAccountPlan() {
        const accountName = document.getElementById('accountName').value;
        const recipients = document.getElementById('emailRecipients').value.split(',').map(email => email.trim());
        // Show required hardcoded demo message immediately
        this.displayHardcodedDemoMessage();

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
            this.displayAccountPlanResults(data, { append: true });
        } catch (error) {
            const resultsDiv = document.getElementById('demoResults');
            resultsDiv.insertAdjacentHTML('beforeend', `
                <div class="result-item">
                    <div class="result-header">ℹ️ API Note</div>
                    <div class="result-content">${error.message}</div>
                </div>
            `);
        }
    }

    displayAccountPlanResults(data, options = { append: false }) {
        const resultsDiv = document.getElementById('demoResults');
        // If API returned a hardcoded mock message, show it directly
        if (data && data.message && data.success) {
            // Suppress the API's mock account plan; we already show a hardcoded message
            return;
        }

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
            
            if (options.append) {
                resultsDiv.insertAdjacentHTML('beforeend', content);
            } else {
                resultsDiv.innerHTML = content;
            }
        } else {
            this.displayError('Account Plan Generation', data.error || 'Unknown error');
        }
    }

    displayHardcodedDemoMessage() {
        const resultsDiv = document.getElementById('demoResults');
        const html = `
            <div class="result-item">
                <div class="result-header">🤖 Account Plan: TechFlow Dynamics 📊 Health: 90/100 🟢</div>
                <div class="result-content">
                    <strong>Summary:</strong>
                    <ul>
                        <li>Emails, calls, and meeting notes show strong engagement between TechFlow Dynamics and Stripe. Implementation is on track, with Q1 performance exceeding targets (23% conversion improvement, $890K cost savings, international launches in UK/Germany).</li>
                        <li>Key personas: Priya Patel (VP Eng), David Kim (CFO), James Mitchell (CEO), Michael Torres (Product), Lisa Johnson (Finance), Jennifer Wong (CSM, Stripe), Sarah Chen (AE, Stripe), Marcus Rodriguez (SE, Stripe).</li>
                        <li>Recent calls: Executive briefing, QBR, technical deep dives, implementation reviews — all show alignment and momentum.</li>
                    </ul>
                    <strong>Top 3 Strategic Recommendations:</strong>
                    <ol>
                        <li>Launch Stripe Billing for subscription automation by 2025-09-18</li>
                        <li>Expand to Australia/Japan by 2025-10-15</li>
                        <li>Implement Stripe Radar for fraud reduction by 2025-09-25</li>
                    </ol>
                    <strong>Expansion Opportunities:</strong>
                    <ul>
                        <li>Stripe Capital for revenue-based financing</li>
                        <li>Deeper product adoption (Radar, Billing)</li>
                        <li>APAC market entry</li>
                    </ul>
                    <strong>Risks:</strong>
                    <ul>
                        <li>Integration complexity, resource allocation, competitive pressure</li>
                    </ul>
                    <strong>Next Actions:</strong>
                    <ul>
                        <li>Schedule Q2 planning call by 2025-09-13</li>
                        <li>Assign technical lead for APAC launch by 2025-09-20</li>
                        <li>Review fraud metrics post-Radar by 2025-09-30</li>
                    </ul>
                    <div><strong>👥 Owner:</strong> @jennifer.wong@stripe.com</div>
                </div>
            </div>
        `;
        resultsDiv.innerHTML = html;
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
            // Prefer BullMQ scheduled workflows for an "active" view
            const schedRes = await fetch('/queue/schedules');
            const schedData = await schedRes.json();

            let content = '';
            if (schedRes.ok && schedData.success && Array.isArray(schedData.data) && schedData.data.length > 0) {
                content += '<div class="workflow-item"><div class="workflow-header"><div class="workflow-name">Scheduled Workflows (BullMQ)</div></div><div class="workflow-details">Showing active schedules from the queue</div></div>';
                schedData.data.forEach((s, idx) => {
                    const name = s.workflowConfig?.name || s.workflowId || s.jobName || 'Scheduled Workflow';
                    const cron = s.cronExpression || 'N/A';
                    const created = s.createdAt ? new Date(s.createdAt).toLocaleString() : '';
                    content += `
                        <div class="workflow-item" data-name="${name}">
                            <div class="workflow-header">
                                <div class="workflow-name"><a href="/admin/queues/queue/scheduled-workflows">${name}</a></div>
                                <div class="workflow-status active">Active</div>
                            </div>
                            <div class="workflow-details">
                                <div><strong>Schedule:</strong> <code>${cron}</code></div>
                                ${created ? `<div><strong>Scheduled:</strong> ${created}</div>` : ''}
                                <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                    <a href="#" class="secondary-button btn-edit-schedule" data-name="${name}"><i class="fas fa-clock"></i> Edit Schedule</a>
                                    <a class="primary-button" href="/admin/queues/queue/scheduled-workflows"><i class="fas fa-list"></i> View Details</a>
                                </div>
                                <div class="edit-schedule" style="display:none; margin-top:8px;">
                                    <input type="hidden" class="cron-input" value="${cron}">
                                    <div class="mini-scheduler">
                                        <div class="mini-row">
                                            <label>Frequency</label>
                                            <div class="segmented">
                                                <button type="button" class="seg" data-mode="weekly">Weekly</button>
                                                <button type="button" class="seg" data-mode="daily">Daily</button>
                                                <button type="button" class="seg" data-mode="hourly">Hourly</button>
                                            </div>
                                        </div>
                                        <div class="mini-row time-row">
                                            <label>Time</label>
                                            <select class="time-select"></select>
                                            <select class="tz-select">
                                                <option value="Local">Local</option>
                                                <option value="UTC">UTC</option>
                                            </select>
                                        </div>
                                        <div class="mini-row dow-row">
                                            <label>Day</label>
                                            <select class="dow-select">
                                                <option value="1">Monday</option>
                                                <option value="2">Tuesday</option>
                                                <option value="3">Wednesday</option>
                                                <option value="4">Thursday</option>
                                                <option value="5">Friday</option>
                                                <option value="6">Saturday</option>
                                                <option value="0">Sunday</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button class="primary-button btn-save-schedule" data-name="${name}"><i class="fas fa-save"></i> Save</button>
                                    <div class="mini-note"><small>Pattern saves as cron on the server.</small></div>
                                </div>
                            </div>
                        </div>`;
                });
            } else {
                // Fallback to orchestrator workflows list
                const response = await fetch('/workflows');
                const data = await response.json();
                if (data.workflows && data.workflows.length > 0) {
                    data.workflows.forEach(workflow => {
                        const scheduleLine = workflow.trigger?.type === 'schedule' && workflow.schedule ? `
                            <div><strong>Schedule:</strong> <code>${workflow.schedule}</code></div>` : '';
                        const lastRunLine = workflow.lastRun ? `<div><strong>Last Run:</strong> ${new Date(workflow.lastRun).toLocaleString()}</div>` : '';
                        content += `
                            <div class="workflow-item" data-id="${workflow.id}" data-enabled="${workflow.enabled}">
                                <div class="workflow-header">
                                    <div class="workflow-name">${workflow.name}</div>
                                    <div class="workflow-status ${workflow.enabled ? 'active' : 'inactive'}">
                                        ${workflow.enabled ? 'Active' : 'Inactive'}
                                    </div>
                                </div>
                                <div class="workflow-details">
                                    <div><strong>Description:</strong> ${workflow.description || 'No description'}</div>
                                    <div><strong>Engine:</strong> ${workflow.engine}</div>
                                    ${scheduleLine}
                                    ${lastRunLine}
                                    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                        <button class="secondary-button btn-run" data-id="${workflow.id}"><i class="fas fa-play"></i> Run Now</button>
                                        <button class="secondary-button btn-edit-schedule" data-id="${workflow.id}"><i class="fas fa-clock"></i> Edit Schedule</button>
                                        <button class="secondary-button btn-toggle" data-id="${workflow.id}" data-next="${!workflow.enabled}">
                                            <i class="fas fa-power-off"></i> ${workflow.enabled ? 'Disable' : 'Enable'}
                                        </button>
                                    </div>
                                    <div class="edit-schedule" id="edit-${workflow.id}" style="display:none; margin-top:8px;">
                                        <input type="hidden" class="cron-input" value="${workflow.schedule || ''}">
                                        <div class="mini-scheduler">
                                            <div class="mini-row">
                                                <label>Frequency</label>
                                                <div class="segmented">
                                                    <button type="button" class="seg" data-mode="weekly">Weekly</button>
                                                    <button type="button" class="seg" data-mode="daily">Daily</button>
                                                    <button type="button" class="seg" data-mode="hourly">Hourly</button>
                                                </div>
                                            </div>
                                            <div class="mini-row time-row">
                                                <label>Time</label>
                                                <select class="time-select"></select>
                                                <select class="tz-select">
                                                    <option value="Local">Local</option>
                                                    <option value="UTC">UTC</option>
                                                </select>
                                            </div>
                                            <div class="mini-row dow-row">
                                                <label>Day</label>
                                                <select class="dow-select">
                                                    <option value="1">Monday</option>
                                                    <option value="2">Tuesday</option>
                                                    <option value="3">Wednesday</option>
                                                    <option value="4">Thursday</option>
                                                    <option value="5">Friday</option>
                                                    <option value="6">Saturday</option>
                                                    <option value="0">Sunday</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button class="primary-button btn-save-schedule" data-id="${workflow.id}"><i class="fas fa-save"></i> Save</button>
                                        <div class="mini-note"><small>Cron applied to this workflow.</small></div>
                                    </div>
                                </div>
                            </div>`;
                });
                } else {
                    // Show a mock workflow with editable mock schedule (UI-only)
                    const mockName = 'Mock: Account Plan Orchestration';
                    const cron = this.getMockSchedule(mockName) || '0 9 * * *';
                    content = `
                        <div class="workflow-item" data-mock="true" data-name="${mockName}">
                            <div class="workflow-header">
                                <div class="workflow-name">${mockName}</div>
                                <div class="workflow-status active">Mock</div>
                            </div>
                            <div class="workflow-details">
                                <div><strong>Schedule (mock):</strong> <code>${cron}</code></div>
                                <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                    <a href="#" class="secondary-button btn-edit-schedule" data-mock="true" data-name="${mockName}"><i class="fas fa-clock"></i> Edit Schedule</a>
                                </div>
                                <div class="edit-schedule" style="display:none; margin-top:8px;">
                                    <input type="hidden" class="cron-input" value="${cron}">
                                    <div class="mini-scheduler">
                                        <div class="mini-row">
                                            <label>Frequency</label>
                                            <div class="segmented">
                                                <button type="button" class="seg" data-mode="weekly">Weekly</button>
                                                <button type="button" class="seg" data-mode="daily">Daily</button>
                                                <button type="button" class="seg" data-mode="hourly">Hourly</button>
                                            </div>
                                        </div>
                                        <div class="mini-row time-row">
                                            <label>Time</label>
                                            <select class="time-select"></select>
                                            <select class="tz-select">
                                                <option value="Local">Local</option>
                                                <option value="UTC">UTC</option>
                                            </select>
                                        </div>
                                        <div class="mini-row dow-row">
                                            <label>Day</label>
                                            <select class="dow-select">
                                                <option value="1">Monday</option>
                                                <option value="2">Tuesday</option>
                                                <option value="3">Wednesday</option>
                                                <option value="4">Thursday</option>
                                                <option value="5">Friday</option>
                                                <option value="6">Saturday</option>
                                                <option value="0">Sunday</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button class="primary-button btn-save-schedule" data-mock="true" data-name="${mockName}"><i class="fas fa-save"></i> Save</button>
                                    <div class="mini-note"><small>UI-only mock schedule. No server changes.</small></div>
                                </div>
                            </div>
                        </div>
                    `;
                }
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

    async runWorkflow(id) {
        try {
            this.showLoading();
            const res = await fetch(`/workflows/${id}/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: {} }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to run workflow');
            alert('Workflow execution started.');
        } catch (err) {
            alert(`Failed to run workflow: ${err.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async saveWorkflowSchedule(id, cron) {
        try {
            this.showLoading();
            // Update schedule
            let res = await fetch(`/workflows/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schedule: cron, trigger: { type: 'schedule' } }) });
            let data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Update failed');
            // Force reschedule by disable->enable
            await fetch(`/workflows/${id}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) });
            await fetch(`/workflows/${id}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
            await this.loadWorkflows();
            alert('Schedule updated.');
        } catch (err) {
            alert(`Failed to save schedule: ${err.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async saveQueueWorkflowSchedule(name, cron) {
        try {
            this.showLoading();
            const res = await fetch(`/queue/schedules/${encodeURIComponent(name)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cronExpression: cron })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Update failed');
            await this.loadWorkflows();
            alert('Schedule updated.');
        } catch (err) {
            alert(`Failed to update schedule: ${err.message}`);
        } finally {
            this.hideLoading();
        }
    }

    // Mock schedule helpers (UI-only)
    getMockSchedule(name) {
        try {
            const key = `mock-schedule:${name}`;
            return localStorage.getItem(key);
        } catch (_) {
            return null;
        }
    }

    async saveMockSchedule(name, cron) {
        try {
            const key = `mock-schedule:${name}`;
            localStorage.setItem(key, cron);
            await this.loadWorkflows();
            alert('Mock schedule updated.');
        } catch (err) {
            alert(`Failed to save mock schedule: ${err.message}`);
        }
    }

    // Initialize the mini scheduler controls inside an edit panel
    initMiniScheduler(panel) {
        const cronInput = panel.querySelector('.cron-input');
        const segBtns = panel.querySelectorAll('.segmented .seg');
        const timeSel = panel.querySelector('.time-select');
        const tzSel = panel.querySelector('.tz-select');
        const dowSel = panel.querySelector('.dow-select');

        const setActiveMode = (mode) => {
            segBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
            // Show/hide rows
            const timeRow = panel.querySelector('.time-row');
            const dowRow = panel.querySelector('.dow-row');
            if (mode === 'hourly') {
                if (timeRow) timeRow.style.display = 'none';
                if (dowRow) dowRow.style.display = 'none';
            } else if (mode === 'daily') {
                if (timeRow) timeRow.style.display = 'flex';
                if (dowRow) dowRow.style.display = 'none';
            } else {
                if (timeRow) timeRow.style.display = 'flex';
                if (dowRow) dowRow.style.display = 'flex';
            }
        };

        const fillTimeOptions = () => {
            if (!timeSel || timeSel.options.length) return;
            for (let h = 0; h < 24; h++) {
                for (const m of [0, 30]) {
                    const hour12 = (h % 12) === 0 ? 12 : (h % 12);
                    const ampm = h < 12 ? 'am' : 'pm';
                    const mm = m.toString().padStart(2, '0');
                    const label = `${hour12}:${mm}${ampm}`;
                    const opt = document.createElement('option');
                    opt.value = `${h}:${m}`;
                    opt.text = label;
                    timeSel.appendChild(opt);
                }
            }
        };

        const parseCron = (cron) => {
            try {
                const parts = cron.trim().split(/\s+/);
                if (parts.length < 5) return { mode: 'daily', h: 9, m: 0, dow: 1 };
                const [min, hour, , , dow] = parts;
                if (hour === '*' && dow === '*') return { mode: 'hourly', h: 0, m: 0 };
                if (dow !== '*' && dow !== '?') return { mode: 'weekly', h: parseInt(hour)||9, m: parseInt(min)||0, dow: parseInt(dow)||1 };
                return { mode: 'daily', h: parseInt(hour)||9, m: parseInt(min)||0 };
            } catch (_) {
                return { mode: 'daily', h: 9, m: 0, dow: 1 };
            }
        };

        const buildCron = (mode, h, m, dow) => {
            if (mode === 'hourly') return `0 * * * *`;
            if (mode === 'daily') return `${m} ${h} * * *`;
            return `${m} ${h} * * ${typeof dow === 'number' ? dow : 1}`;
        };

        const syncFromUI = () => {
            const active = Array.from(segBtns).find(b => b.classList.contains('active'));
            const mode = active ? active.dataset.mode : 'daily';
            let h = 9, m = 0, dow = 1;
            if (timeSel && timeSel.value) {
                const [hh, mm] = timeSel.value.split(':').map(v => parseInt(v, 10));
                if (!Number.isNaN(hh)) h = hh;
                if (!Number.isNaN(mm)) m = mm;
            }
            if (dowSel && dowSel.value) dow = parseInt(dowSel.value, 10);
            cronInput.value = buildCron(mode, h, m, dow);
        };

        // Init time options and values
        fillTimeOptions();
        const init = parseCron(cronInput.value || '* * * * *');

        // Set initial controls
        setActiveMode(init.mode);
        if (timeSel) {
            const key = `${init.h}:${init.m}`;
            const opt = Array.from(timeSel.options).find(o => o.value === key);
            if (opt) timeSel.value = key; else timeSel.selectedIndex = 18; // fallback 9:00am
        }
        if (dowSel && typeof init.dow === 'number') dowSel.value = String(init.dow);

        // Wire events
        segBtns.forEach(btn => btn.addEventListener('click', () => { setActiveMode(btn.dataset.mode); syncFromUI(); }));
        if (timeSel) timeSel.addEventListener('change', syncFromUI);
        if (dowSel) dowSel.addEventListener('change', syncFromUI);
        if (tzSel) tzSel.addEventListener('change', () => {/* UI only */});

        // Ensure cron reflects initial UI
        syncFromUI();
    }

    async toggleWorkflow(id, enabled) {
        try {
            this.showLoading();
            const res = await fetch(`/workflows/${id}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Toggle failed');
            await this.loadWorkflows();
        } catch (err) {
            alert(`Failed to toggle workflow: ${err.message}`);
        } finally {
            this.hideLoading();
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
        const name = formData.get('workflowName') || document.getElementById('workflowName').value;
        const description = formData.get('workflowDescription') || document.getElementById('workflowDescription').value;
        const schedule = formData.get('workflowSchedule') || document.getElementById('workflowSchedule').value || '';
        const trigger = schedule ? { type: 'schedule' } : { type: 'manual' };
        const workflowData = {
            name,
            description,
            trigger,
            schedule: schedule || undefined,
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

    // Demo Workflow Creator
    async createDemoWorkflow(runAfterCreate = false) {
        const name = document.getElementById('demoWorkflowName').value || 'Demo: Account Plan Orchestration';
        const account = document.getElementById('demoWorkflowAccount').value || 'stripe';
        const schedule = document.getElementById('demoWorkflowSchedule').value || '';

        const payload = {
            name,
            description: 'Demo workflow that generates account plans and distributes via Email and Slack (#dealflow).',
            trigger: schedule ? { type: 'schedule' } : { type: 'manual' },
            schedule: schedule || undefined,
            accounts: [{ accountName: account, customization: {} }],
            distributors: [
                {
                    type: 'email',
                    config: {
                        recipients: [{ email: 'owner@example.com' }],
                        subject: `Account Plan: ${account} - ${new Date().toISOString().split('T')[0]}`,
                        template: 'summary'
                    }
                },
                {
                    type: 'slack',
                    config: {
                        channels: [{ channel: '#dealflow' }],
                        // dynamic routing: add alert/normal channels based on health score
                        routing: {
                            alertThreshold: 70,
                            alertChannel: '#sales-alerts',
                            normalChannel: '#account-planning',
                            alsoChannels: ['#dealflow']
                        },
                        format: 'dealflow',
                        mentions: []
                    }
                }
            ]
        };

        try {
            this.showLoading();
            const res = await fetch('/workflows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to create demo workflow');
            await this.loadWorkflows();
            if (runAfterCreate) {
                await this.runWorkflow(data.workflow.id);
            } else {
                alert('Demo workflow created.');
            }
        } catch (err) {
            alert(`Failed to create demo workflow: ${err.message}`);
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

        // Demo workflow buttons
        const createDemo = document.getElementById('createDemoWorkflowBtn');
        const createRunDemo = document.getElementById('createAndRunDemoWorkflowBtn');
        if (createDemo) createDemo.addEventListener('click', () => d.createDemoWorkflow(false));
        if (createRunDemo) createRunDemo.addEventListener('click', () => d.createDemoWorkflow(true));
    });
