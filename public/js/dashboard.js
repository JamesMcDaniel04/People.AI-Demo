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
        // Demo page extras
        this.loadRecentActivity().catch(()=>{});
        this.initDemoMcpPanel().catch(()=>{});
        this.initPeopleAISpotlight().catch(()=>{});
        // Initialize demo mini scheduler UI (optional schedule)
        this.initDemoMiniScheduler();
        // Initialize editable sections (Goals, Integrations, Instructions)
        this.initEditableDemoSections();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Demo account plan generation (if present)
        const genBtn = document.getElementById('generatePlanBtn');
        if (genBtn) genBtn.addEventListener('click', () => this.generateAccountPlan());

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

        // Provider chips selection sync with select
        const providerChips = document.getElementById('aiProviderChips');
        const providerSelect = document.getElementById('aiProvider');
        if (providerChips && providerSelect) {
            providerChips.addEventListener('click', (e) => {
                const card = e.target.closest('.provider-card');
                if (!card) return;
                const value = card.dataset.provider;
                if (!value) return;
                providerSelect.value = value;
                this.updateAIProviderChips(value);
                this.renderModelSelects(value);
            });
            providerSelect.addEventListener('change', (e) => { 
                this.updateAIProviderChips(e.target.value);
                this.renderModelSelects(e.target.value);
            });
            // initialize state
            this.updateAIProviderChips(providerSelect.value);
            this.renderModelSelects(providerSelect.value);
        }

        // Centralized click handling for workflows list
        const workflowsList = document.getElementById('workflowsList');
        if (workflowsList) {
            workflowsList.addEventListener('click', (e) => this.handleWorkflowsListClick(e));
        }
    }

    initDemoMiniScheduler() {
        const panel = document.getElementById('demoMiniSchedulerPanel');
        if (panel && !panel.dataset.inited) {
            this.initMiniScheduler(panel);
            panel.dataset.inited = '1';
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
        // Clicking summary chips opens the editor at the right control
        const chip = e.target.closest('.summary-chip');
        if (chip) {
            const item = chip.closest('.workflow-item');
            const editBtnInline = item.querySelector('.btn-edit-schedule');
            if (editBtnInline) {
                editBtnInline.click();
                setTimeout(() => {
                    const panel = item.querySelector('.edit-schedule');
                    if (!panel) return;
                    // Ensure schedule tab is active
                    const tabSchedule = panel.querySelector('.tab-schedule');
                    if (tabSchedule && !tabSchedule.classList.contains('active')) tabSchedule.click();
                    const target = chip.dataset.open;
                    if (target === 'time') {
                        panel.querySelector('.time-select')?.focus();
                    } else if (target === 'day') {
                        panel.querySelector('.dow-select')?.focus();
                    } else if (target === 'frequency') {
                        panel.querySelector('.segmented .seg.active')?.focus();
                    }
                }, 0);
            }
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
            const item = saveBtn.closest('.workflow-item');
            const panel = item?.querySelector('.edit-schedule') || document.getElementById(`edit-${saveBtn.dataset.id}`);
            const cronInput = panel?.querySelector('.cron-input');
            const triggerInput = panel?.querySelector('.trigger-input');

            // Persist trigger selection (UI-only) by key
            const key = saveBtn.dataset.name || saveBtn.dataset.id || (item?.dataset.name);
            if (key && triggerInput?.value) {
                try { this.saveTriggerSelection(key, JSON.parse(triggerInput.value)); } catch(_){}
            }

            // Save schedule
            if (saveBtn.dataset.mock === 'true') {
                if (cronInput) await this.saveMockSchedule(saveBtn.dataset.name, cronInput.value);
            } else if (saveBtn.dataset.name) {
                if (cronInput) await this.saveQueueWorkflowSchedule(saveBtn.dataset.name, cronInput.value);
            } else {
                if (cronInput) await this.saveWorkflowSchedule(saveBtn.dataset.id, cronInput.value);
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
                // Re-init editable sections when switching to Workflows
                this.initEditableDemoSections();
                break;
            case 'integration':
                await this.loadIntegrationStatus();
                break;
            case 'settings':
                await this.loadSettings();
                break;
        }
    }

    // Simple HTML-safe encode for labels (not content)
    _escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Make the three demo workflow cards editable with localStorage persistence
    initEditableDemoSections() {
        const cards = document.querySelectorAll('.system-card[data-edit-key]');
        if (!cards || cards.length === 0) return;

        cards.forEach(card => {
            try {
                const key = card.getAttribute('data-edit-key');
                const title = card.getAttribute('data-edit-title') || 'Section';
                if (!key) return;

                const header = card.querySelector('.card-header');
                const content = card.querySelector('.card-content');
                if (!header || !content) return;

                // Ensure we only initialize once
                if (card.dataset.editInit === '1') {
                    // still refresh view state from storage
                    this._refreshEditableCard(card, key, title);
                    return;
                }

                // Wrap default content
                const defaultHTML = content.innerHTML;
                content.innerHTML = `
                    <div class="default-content">${defaultHTML}</div>
                    <div class="custom-content" style="display:none; margin-top:8px; padding:10px; border-left:3px solid #6c8cff; background:#f6f8ff; border-radius:4px;">
                        <div style="font-size:12px; font-weight:600; color:#334; margin-bottom:6px;">
                            <i class="fas fa-user-edit" style="margin-right:6px;"></i> Your customization
                        </div>
                        <div class="custom-body"></div>
                    </div>
                    <div class="edit-panel" style="display:none; margin-top:10px;">
                        <div style="font-size:12px; color:#556; margin-bottom:6px;">Editing ${this._escapeHtml(title)} (HTML allowed)</div>
                        <textarea class="edit-text" style="width:100%; min-height:140px; padding:8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:12px; border:1px solid #ccd; border-radius:4px;"></textarea>
                        <div style="margin-top:8px; display:flex; gap:8px;">
                            <button type="button" class="primary-button btn-save-edit"><i class="fas fa-save"></i> Save</button>
                            <button type="button" class="secondary-button btn-cancel-edit"><i class="fas fa-times"></i> Cancel</button>
                        </div>
                    </div>
                `;

                // Add header actions
                let actions = header.querySelector('.header-actions');
                if (!actions) {
                    actions = document.createElement('div');
                    actions.className = 'header-actions';
                    header.appendChild(actions);
                }
                actions.innerHTML = `${actions.innerHTML || ''}
                    <button class="secondary-button btn-edit-content" title="Customize ${this._escapeHtml(title)}" style="padding:4px 8px;">
                        <i class="fas fa-pen"></i> Edit
                    </button>
                    <button class="secondary-button btn-reset-content" title="Reset customization" style="padding:4px 8px; display:none;">
                        <i class="fas fa-undo"></i> Reset
                    </button>
                `;

                // Wire up events
                const editBtn = header.querySelector('.btn-edit-content');
                const resetBtn = header.querySelector('.btn-reset-content');
                const editPanel = content.querySelector('.edit-panel');
                const textarea = content.querySelector('.edit-text');
                const customWrap = content.querySelector('.custom-content');
                const customBody = content.querySelector('.custom-body');
                const defaultWrap = content.querySelector('.default-content');

                // Load existing customization
                const saved = localStorage.getItem(key);
                if (saved && saved.trim()) {
                    customBody.innerHTML = saved;
                    customWrap.style.display = 'block';
                    if (resetBtn) resetBtn.style.display = '';
                }

                // Open editor prefilled (prefer saved, else default)
                editBtn?.addEventListener('click', () => {
                    const current = localStorage.getItem(key);
                    textarea.value = current && current.trim() ? current : defaultWrap.innerHTML.trim();
                    editPanel.style.display = 'block';
                    textarea.focus();
                });

                // Save customization
                content.querySelector('.btn-save-edit')?.addEventListener('click', () => {
                    const val = textarea.value;
                    try {
                        if (val && val.trim()) {
                            localStorage.setItem(key, val);
                            customBody.innerHTML = val;
                            customWrap.style.display = 'block';
                            if (resetBtn) resetBtn.style.display = '';
                        }
                    } catch (e) {
                        console.error('Failed to save customization for', key, e);
                    }
                    editPanel.style.display = 'none';
                });

                // Cancel editing
                content.querySelector('.btn-cancel-edit')?.addEventListener('click', () => {
                    editPanel.style.display = 'none';
                });

                // Reset customization
                resetBtn?.addEventListener('click', () => {
                    localStorage.removeItem(key);
                    customBody.innerHTML = '';
                    customWrap.style.display = 'none';
                    resetBtn.style.display = 'none';
                });

                card.dataset.editInit = '1';
            } catch (e) {
                console.warn('Editable section init failed:', e);
            }
        });
    }

    _refreshEditableCard(card, key, title) {
        try {
            const content = card.querySelector('.card-content');
            if (!content) return;
            const customWrap = content.querySelector('.custom-content');
            const customBody = content.querySelector('.custom-body');
            const resetBtn = card.querySelector('.btn-reset-content');
            const saved = localStorage.getItem(key);
            if (saved && saved.trim()) {
                customBody.innerHTML = saved;
                if (customWrap) customWrap.style.display = 'block';
                if (resetBtn) resetBtn.style.display = '';
            } else {
                if (customWrap) customWrap.style.display = 'none';
                if (resetBtn) resetBtn.style.display = 'none';
            }
        } catch (e) {
            console.warn('Editable section refresh failed:', e);
        }
    }

    // People.ai modal controls
    async showPeopleAIModal() {
        const modal = document.getElementById('peopleaiModal');
        modal.classList.add('active');
        // Prefill toggles from backend status (settings-backed)
        try {
            const r = await fetch('/peopleai/status');
            if (r.ok) {
                const j = await r.json();
                const f = j.features || {};
                const enabled = !!j.enabled;
                const map = {
                    peopleaiEnabled: enabled,
                    peopleaiFeatureCapture: !!f.autoCapture,
                    peopleaiFeatureEngagement: !!f.engagementScoring,
                    peopleaiFeatureCoaching: !!f.coachingInsights,
                    peopleaiFeatureTriggers: !!f.workflowTriggers
                };
                Object.entries(map).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.checked = val; });
            }
        } catch (_) { /* ignore */ }
    }
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
            alert('Saved People.ai demo configuration. (UI-only; no live connection)');
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
            
            const el = document.getElementById('integrationDetails');
            if (el) {
                let content = '<div class="integration-grid">';
                const src = (data.integration?.source || 'sample').toUpperCase();
                content += `
                    <div class="integration-card">
                        <div class="integration-icon">
                            <img src="/static/img/logos/airtable.svg" alt="Data Source">
                        </div>
                        <div class="integration-name">${src}</div>
                        <div class="integration-status connected">${src === 'SAMPLE' ? 'Connected' : 'Configured'}</div>
                    </div>`;

                const integrations = [
                    { key: 'gmail', name: 'Gmail', logo: '/static/img/logos/gmail.svg' },
                    { key: 'googleCalendar', name: 'Google Calendar', logo: '/static/img/logos/googlecalendar.svg' },
                    { key: 'googleDrive', name: 'Google Drive', logo: '/static/img/logos/googledrive.svg' },
                    { key: 'slack', name: 'Slack', logo: '/static/img/logos/slack.svg' },
                    { key: 'notion', name: 'Notion', logo: '/static/img/logos/notion.svg' }
                ];
                const connected = (data.integration?.klavis?.servers) || (data.integration?.sample?.servers) || [];
                const isOn = (k) => Array.isArray(connected) ? connected.includes(k) : false;
                integrations.forEach(int => {
                    const ok = isOn(int.key);
                    content += `
                        <div class="integration-card">
                            <div class="integration-icon">
                                <img src="${int.logo}" alt="${int.name}">
                            </div>
                            <div class="integration-name">${int.name}</div>
                            <div class="integration-status ${ok ? 'connected' : 'disconnected'}">${ok ? 'Connected' : 'Disconnected'}</div>
                        </div>`;
                });

                content += '</div>';
                el.innerHTML = content;
            }
        } catch (error) {
            // no-op
        }
    }

    // Generate Account Plan
    async generateAccountPlan() {
        const accountName = document.getElementById('accountName').value;
        const recipients = document.getElementById('emailRecipients').value.split(',').map(email => email.trim());
        // Clear previous results
        const resultsDiv = document.getElementById('demoResults');
        if (resultsDiv) resultsDiv.innerHTML = '';

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
            this.displayAccountPlanResults(data, { append: false });
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
        // Expect production execution payload

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

    // Removed hardcoded demo message (production mode)

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

    // Recent workflow activity (left column)
    async loadRecentActivity() {
        const el = document.getElementById('recentActivity');
        if (!el) return;
        try {
            const res = await fetch('/workflows');
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.workflows || []);
            // Build real items (up to 5)
            const real = (list || []).slice().sort((a,b)=> new Date(b.lastRun||b.createdAt||0) - new Date(a.lastRun||a.createdAt||0)).slice(0,5);
            let html = '';
            if (real.length > 0) {
                html += real.map(w=>{
                    const status = (w.status||'created').toLowerCase();
                    const badge = status === 'completed' ? 'success' : status === 'failed' ? 'failed' : 'running';
                    const when = new Date(w.lastRun || w.createdAt || Date.now()).toLocaleString();
                    return `
                    <li class="feed-item">
                        <span class="dot" style="background:${badge==='success'?'#27ae60':badge==='failed'?'#e74c3c':'#3498db'}"></span>
                        <div>
                            <div><strong>${this._escapeHtml(w.name||'Workflow')}</strong> <span class="badge ${badge}">${status}</span></div>
                            <div class="meta">Last: ${when}</div>
                        </div>
                    </li>`;
                }).join('');
            }

            // Top up with mock items to ensure 4-5 entries are visible
            const need = Math.max(0, 5 - (real.length));
            if (need > 0) {
                html += this._mockActivityItems(need);
            }
            if (!html) {
                // If still empty, show 5 mocks
                html = this._mockActivityItems(5);
            }
            el.innerHTML = html;
        } catch (e) {
            // On error, still render mock activity for demo friendliness
            el.innerHTML = this._mockActivityItems(5);
        }
    }

    // Render 4-5 mock recent activity items
    _mockActivityItems(count = 5) {
        const now = Date.now();
        const events = [
            { title: 'Generated account plan for Stripe', status: 'completed', badge: 'success', ts: now - 6*60*1000 },
            { title: 'Posted Slack summary to #account-planning', status: 'completed', badge: 'success', ts: now - 14*60*1000 },
            { title: 'Sent executive report email', status: 'completed', badge: 'success', ts: now - 38*60*1000 },
            { title: 'Risk alert triggered: Contract renewal', status: 'failed', badge: 'failed', ts: now - 75*60*1000 },
            { title: 'Workflow created: Daily Account Health', status: 'created', badge: 'running', ts: now - 26*60*60*1000 }
        ];
        const items = events.slice(0, Math.max(1, Math.min(count, events.length))).map(ev => {
            const when = new Date(ev.ts).toLocaleString();
            const dot = ev.badge==='success'?'#27ae60':(ev.badge==='failed'?'#e74c3c':'#3498db');
            return `
            <li class="feed-item">
                <span class="dot" style="background:${dot}"></span>
                <div>
                    <div><strong>${this._escapeHtml(ev.title)}</strong> <span class="badge ${ev.badge}">${ev.status}</span></div>
                    <div class="meta">Last: ${when}</div>
                </div>
            </li>`;
        }).join('');
        return items;
    }

    // People.ai Spotlight (demo integration orchestrator)
    async initPeopleAISpotlight() {
        const tokenEl = document.getElementById('peopleaiToken');
        const connectBtn = document.getElementById('peopleaiConnectBtn');
        const disconnectBtn = document.getElementById('peopleaiDisconnectBtn');
        const syncBtn = document.getElementById('peopleaiSyncBtn');
        const statusBox = document.getElementById('peopleaiStatusBox');
        const kpisBox = document.getElementById('peopleaiKpis');
        const pill = document.getElementById('peopleaiConnPill');
        const signalsEl = document.getElementById('peopleaiSignals');
        if (!statusBox) return; // no spotlight on this page

        const renderStatus = (j) => {
            const s = j || {};
            const header = statusBox.querySelector('.result-header');
            const content = statusBox.querySelector('.result-content');
            if (header) header.textContent = `People.ai Status${s.connected?' • Connected':''}`;
            if (content) {
                if (!s.connected) {
                    content.textContent = 'Not connected';
                } else {
                    const org = s.org || {};
                    const sync = s.sync || {};
                    content.innerHTML = `
                        <div><strong>Org:</strong> ${this._escapeHtml(org.name||'DemoCo')} (${this._escapeHtml(org.plan||'Enterprise')})</div>
                        <div><strong>Seats:</strong> ${org.seats||0} • <strong>Domain:</strong> ${this._escapeHtml(org.domain||'example.com')}</div>
                        <div><strong>Last Sync:</strong> ${sync.lastSync ? new Date(sync.lastSync).toLocaleString() : '—'} • <strong>Engagement:</strong> ${sync.engagementScore||0}</div>
                        <div><strong>Counts:</strong> ${sync.contacts||0} contacts • ${sync.activities||0} activities • ${sync.deals||0} deals</div>
                        <div><strong>Token:</strong> ${this._escapeHtml(s.tokenMasked||'****')}</div>
                    `;
                }
            }
            if (pill) {
                pill.textContent = s.connected ? 'Status: Online' : 'Status: Offline';
                pill.classList.toggle('ok', !!s.connected);
                pill.classList.toggle('err', !s.connected);
            }
            if (kpisBox) {
                const sync = s.sync || {};
                kpisBox.innerHTML = `
                    <div class="kpi"><div class="kpi-label">Contacts</div><div class="kpi-value">${sync.contacts||0}</div></div>
                    <div class="kpi"><div class="kpi-label">Activities</div><div class="kpi-value">${sync.activities||0}</div></div>
                    <div class="kpi"><div class="kpi-label">Deals</div><div class="kpi-value">${sync.deals||0}</div></div>
                    <div class="kpi"><div class="kpi-label">Engagement</div><div class="kpi-value">${sync.engagementScore||0}</div></div>
                `;
            }
            if (tokenEl) tokenEl.value = '';
        };

        const renderSignals = (signals) => {
            if (!signalsEl) return;
            const arr = Array.isArray(signals) ? signals.slice(0,8) : [];
            if (arr.length === 0) { signalsEl.innerHTML = '<li class="meta">No recent signals</li>'; return; }
            signalsEl.innerHTML = arr.map(ev => {
                const dot = ev.severity==='warn'?'#f39c12':(ev.severity==='error'?'#e74c3c':'#27ae60');
                const when = ev.ts ? new Date(ev.ts).toLocaleString() : '';
                const iconClass = ev.type==='email' ? 'sig-email fa-envelope' : ev.type==='meeting' ? 'sig-meeting fa-handshake' : ev.type==='hygiene' ? 'sig-hygiene fa-broom' : 'sig-contact fa-user-plus';
                return `
                <li class="feed-item">
                    <span class="dot" style="background:${dot}"></span>
                    <div>
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span class="sig-icon ${iconClass.split(' ')[0]}"><i class="fas ${iconClass.split(' ')[1]}"></i></span>
                          <div><strong>${this._escapeHtml(ev.title||ev.type||'Signal')}</strong> <span class="badge ${ev.severity||'success'}">${this._escapeHtml(ev.type||'')}</span></div>
                        </div>
                        <div class="meta">${this._escapeHtml(ev.detail||'')} ${when?('• '+when):''}</div>
                    </div>
                </li>`;
            }).join('');
        };

        const load = async () => {
            try {
                const r = await fetch('/peopleai/status');
                if (!r.ok) throw new Error('status not available');
                const j = await r.json();
                renderStatus(j);
                renderSignals(j.recentSignals||[]);
            } catch (_) {
                // Silent fail – spotlight not available
            }
        };

        connectBtn?.addEventListener('click', async () => {
            try {
                this.showLoading();
                const token = tokenEl?.value?.trim();
                const r = await fetch('/peopleai/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
                await r.json();
                await load();
            } catch (e) {
                alert('Connect failed');
            } finally { this.hideLoading(); }
        });
        disconnectBtn?.addEventListener('click', async () => {
            try {
                this.showLoading();
                await fetch('/peopleai/disconnect', { method: 'POST' });
                await load();
            } catch (_) {} finally { this.hideLoading(); }
        });
        syncBtn?.addEventListener('click', async () => {
            try {
                this.showLoading();
                await fetch('/peopleai/sync', { method: 'POST' });
                await load();
            } catch (_) {} finally { this.hideLoading(); }
        });

        await load();
    }

    // Right column MCP mini-panel
    async initDemoMcpPanel() {
        const ids = ['dg_mcpGmail','dg_mcpCalendar','dg_mcpDrive','dg_mcpSlack','dg_mcpNotion'];
        if (!ids.some(id=>document.getElementById(id))) return;
        try {
            const r = await fetch('/settings');
            const j = await r.json();
            const servers = j?.current?.data?.mcp?.servers || {};
            document.getElementById('dg_mcpGmail').checked = !!servers.gmail?.enabled;
            document.getElementById('dg_mcpCalendar').checked = !!servers.googleCalendar?.enabled;
            document.getElementById('dg_mcpDrive').checked = !!servers.googleDrive?.enabled;
            document.getElementById('dg_mcpSlack').checked = !!servers.slack?.enabled;
            document.getElementById('dg_mcpNotion').checked = !!servers.notion?.enabled;
        } catch (_) {}

        const refreshBtn = document.getElementById('dg_load_mcp');
        const saveBtn = document.getElementById('dg_save_mcp');
        refreshBtn?.addEventListener('click', (e)=>{ e.preventDefault(); this.initDemoMcpPanel(); });
        saveBtn?.addEventListener('click', async (e)=>{
            e.preventDefault();
            try {
                this.showLoading();
                const payload = {
                    mcp: {
                        servers: {
                            gmail: { enabled: document.getElementById('dg_mcpGmail').checked },
                            googleCalendar: { enabled: document.getElementById('dg_mcpCalendar').checked },
                            googleDrive: { enabled: document.getElementById('dg_mcpDrive').checked },
                            slack: { enabled: document.getElementById('dg_mcpSlack').checked },
                            notion: { enabled: document.getElementById('dg_mcpNotion').checked }
                        }
                    }
                };
                const res = await fetch('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const j = await res.json();
                if (!j.success) throw new Error(j.error||'Failed to save MCP');
                alert('MCP settings saved');
            } catch (err) {
                alert(`Save failed: ${err.message}`);
            } finally {
                this.hideLoading();
            }
        });
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
                                <div><strong>Schedule:</strong> ${this.scheduleSummaryHTML(cron)}</div>
                                ${created ? `<div><strong>Scheduled:</strong> ${created}</div>` : ''}
                                <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                    <a href="#" class="secondary-button btn-edit-schedule" data-name="${name}"><i class="fas fa-clock"></i> Edit Schedule</a>
                                    <a class="primary-button" href="/admin/queues/queue/scheduled-workflows"><i class="fas fa-list"></i> View Details</a>
                                </div>
                                <div class="edit-schedule" style="display:none; margin-top:8px;">
                                    <div class="mini-tabs">
                                        <button type="button" class="tab tab-schedule active">Schedule</button>
                                        <button type="button" class="tab tab-trigger">Trigger</button>
                                    </div>
                                    <div class="panel-schedule">
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
                                        <div class="mini-note"><small>Pattern saves as cron on the server.</small></div>
                                    </div>
                                    <div class="panel-trigger" style="display:none;">
                                        <input type="hidden" class="trigger-input" value="">
                                        <div class="providers"></div>
                                        <div class="trigger-list"></div>
                                    </div>
                                    <div style="margin-top:8px;">
                                        <button class="primary-button btn-save-schedule" data-name="${name}"><i class="fas fa-save"></i> Save</button>
                                    </div>
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
                            <div><strong>Schedule:</strong> ${this.scheduleSummaryHTML(workflow.schedule)}</div>` : '';
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
                                        <div class="mini-tabs">
                                            <button type="button" class="tab tab-schedule active">Schedule</button>
                                            <button type="button" class="tab tab-trigger">Trigger</button>
                                        </div>
                                        <div class="panel-schedule">
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
                                            <div class="mini-note"><small>Cron applied to this workflow.</small></div>
                                        </div>
                                        <div class="panel-trigger" style="display:none;">
                                            <input type="hidden" class="trigger-input" value="">
                                            <div class="providers"></div>
                                            <div class="trigger-list"></div>
                                        </div>
                                        <div style="margin-top:8px;">
                                            <button class="primary-button btn-save-schedule" data-id="${workflow.id}"><i class="fas fa-save"></i> Save</button>
                                        </div>
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
                                <div><strong>Schedule (mock):</strong> ${this.scheduleSummaryHTML(cron)}</div>
                                <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                    <a href="#" class="secondary-button btn-edit-schedule" data-mock="true" data-name="${mockName}"><i class="fas fa-clock"></i> Edit Schedule</a>
                                </div>
                                <div class="edit-schedule" style="display:none; margin-top:8px;">
                                    <div class="mini-tabs">
                                        <button type="button" class="tab tab-schedule active">Schedule</button>
                                        <button type="button" class="tab tab-trigger">Trigger</button>
                                    </div>
                                    <div class="panel-schedule">
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
                                        <div class="mini-note"><small>UI-only mock schedule. No server changes.</small></div>
                                    </div>
                                    <div class="panel-trigger" style="display:none;">
                                        <input type="hidden" class="trigger-input" value="">
                                        <div class="providers"></div>
                                        <div class="trigger-list"></div>
                                    </div>
                                    <div style="margin-top:8px;">
                                        <button class="primary-button btn-save-schedule" data-mock="true" data-name="${mockName}"><i class="fas fa-save"></i> Save</button>
                                    </div>
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
            const res = await fetch(`/workflows/${id}/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: {}, waitForCompletion: false }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to run workflow');
            const msg = data.message || 'Workflow execution started. Expect the Slack post within about a minute.';
            alert(msg);
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
        // Setup tabs
        this.initMiniTabs(panel);
        // Setup trigger panel
        this.initMiniTriggers(panel);
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

    // Build compact human-readable schedule chips from a cron expression
    scheduleSummaryHTML(cron) {
        try {
            const { mode, h, m, dow } = this.parseCronString(cron);
            const tz = this.getLocalTzAbbr();
            const chips = [];
            const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
            chips.push(`<span class=\"summary-chip\" data-open=\"frequency\">${modeLabel}</span>`);
            if (mode !== 'hourly') {
                chips.push(`<span class=\"summary-chip\" data-open=\"time\">${this.formatTimeLabel(h, m)} ${tz}</span>`);
            }
            if (mode === 'weekly') {
                chips.push(`<span class=\"summary-chip\" data-open=\"day\">${this.dayName(dow)}</span>`);
            }
            return `<span class=\"schedule-summary\" data-cron=\"${cron}\">${chips.join(' ')}</span>`;
        } catch (_) {
            return `<span class=\"schedule-summary\"><span class=\"summary-chip\">Custom</span></span>`;
        }
    }

    parseCronString(cron) {
        const parts = (cron || '').trim().split(/\s+/);
        if (parts.length < 5) return { mode: 'daily', h: 9, m: 0, dow: 1 };
        const [min, hour, , , dow] = parts;
        if (hour === '*' && dow === '*') return { mode: 'hourly', h: 0, m: 0 };
        if (dow !== '*' && dow !== '?') return { mode: 'weekly', h: parseInt(hour)||9, m: parseInt(min)||0, dow: parseInt(dow)||1 };
        return { mode: 'daily', h: parseInt(hour)||9, m: parseInt(min)||0 };
    }

    formatTimeLabel(h, m) {
        const hour12 = (h % 12) === 0 ? 12 : (h % 12);
        const ampm = h < 12 ? 'am' : 'pm';
        const mm = (m || 0).toString().padStart(2, '0');
        return `${hour12}:${mm}${ampm}`;
    }

    dayName(d) {
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        if (typeof d !== 'number' || d < 0 || d > 6) return 'Monday';
        return days[d];
    }

    getLocalTzAbbr() {
        try {
            const str = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).format(new Date());
            const abbr = str.split(' ').pop();
            return abbr && /[A-Z]{2,4}/.test(abbr) ? abbr : 'Local';
        } catch (_) {
            return 'Local';
        }
    }

    initMiniTabs(panel) {
        const tabSchedule = panel.querySelector('.tab-schedule');
        const tabTrigger = panel.querySelector('.tab-trigger');
        const panelSchedule = panel.querySelector('.panel-schedule');
        const panelTrigger = panel.querySelector('.panel-trigger');
        if (!tabSchedule || !tabTrigger || !panelSchedule || !panelTrigger) return;

        const setActive = (which) => {
            const isSchedule = which === 'schedule';
            tabSchedule.classList.toggle('active', isSchedule);
            tabTrigger.classList.toggle('active', !isSchedule);
            panelSchedule.style.display = isSchedule ? 'block' : 'none';
            panelTrigger.style.display = isSchedule ? 'none' : 'block';
        };
        tabSchedule.addEventListener('click', () => setActive('schedule'));
        tabTrigger.addEventListener('click', () => setActive('trigger'));
        setActive('schedule');
    }

    initMiniTriggers(panel) {
        const providersDiv = panel.querySelector('.providers');
        const listDiv = panel.querySelector('.trigger-list');
        const hidden = panel.querySelector('.trigger-input');
        if (!providersDiv || !listDiv || !hidden) return;

        const item = panel.closest('.workflow-item');
        const key = item?.dataset.name || item?.dataset.id || 'mock';
        const saved = this.getTriggerSelection(key);

        const PROVIDERS = {
            gmail: ['New Email', 'From VIP', 'Has Attachment'],
            googleCalendar: ['New Event', 'Event Updated', 'Reminder 15m'],
            googleDrive: ['New File Uploaded', 'File Updated', 'Folder Shared'],
            slack: ['New Message in Channel', 'Mention', 'Reaction Added'],
            notion: ['Page Created', 'Page Updated', 'Database Item Updated']
        };

        const providerOrder = ['gmail','googleCalendar','googleDrive','slack','notion'];

        const renderProviders = (active) => {
            providersDiv.innerHTML = '';
            providerOrder.forEach(p => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'provider-chip' + (p === active ? ' active' : '');
                b.dataset.provider = p;
                const label = {
                    gmail: 'Gmail',
                    googleCalendar: 'Google Calendar',
                    googleDrive: 'Google Drive',
                    slack: 'Slack',
                    notion: 'Notion'
                }[p] || p;
                const logo = {
                    gmail: '/static/img/logos/gmail.svg',
                    googleCalendar: '/static/img/logos/googlecalendar.svg',
                    googleDrive: '/static/img/logos/googledrive.svg',
                    slack: '/static/img/logos/slack.svg',
                    notion: '/static/img/logos/notion.svg'
                }[p];
                b.innerHTML = logo ? `<img src="${logo}" alt="${label}"><span>${label}</span>` : label;
                b.addEventListener('click', () => {
                    renderProviders(p);
                    renderTriggers(p, null);
                });
                providersDiv.appendChild(b);
            });
        };

        const renderTriggers = (provider, selected) => {
            listDiv.innerHTML = '';
            (PROVIDERS[provider] || []).forEach(name => {
                const c = document.createElement('button');
                c.type = 'button';
                c.className = 'trigger-chip' + (name === selected ? ' active' : '');
                c.textContent = name;
                c.addEventListener('click', () => {
                    Array.from(listDiv.querySelectorAll('.trigger-chip')).forEach(el => el.classList.remove('active'));
                    c.classList.add('active');
                    hidden.value = JSON.stringify({ provider, event: name });
                });
                listDiv.appendChild(c);
            });

            // Update hidden if we have a preselect
            if (selected) hidden.value = JSON.stringify({ provider, event: selected });
        };

        // Initialize with saved or default
        const initProvider = saved?.provider || 'gmail';
        renderProviders(initProvider);
        renderTriggers(initProvider, saved?.event || (PROVIDERS[initProvider] ? PROVIDERS[initProvider][0] : ''));
    }

    getTriggerSelection(key) {
        try {
            const raw = localStorage.getItem(`mock-trigger:${key}`);
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    }

    saveTriggerSelection(key, value) {
        try { localStorage.setItem(`mock-trigger:${key}`, JSON.stringify(value)); } catch (_) {}
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

            const src = (data.integration?.source || 'sample').toUpperCase();
            content += `
                <div class="integration-card">
                    <div class="integration-icon">
                        <img src="/static/img/logos/airtable.svg" alt="Data Source">
                    </div>
                    <div class="integration-name">${src === 'SAMPLE' ? 'Sample Data' : src}</div>
                    <div class="integration-status connected">${src === 'SAMPLE' ? 'Connected' : 'Configured'}</div>
                </div>
            `;

            const integrations = [
                { key: 'gmail', name: 'Gmail', logo: '/static/img/logos/gmail.svg' },
                { key: 'googleCalendar', name: 'Google Calendar', logo: '/static/img/logos/googlecalendar.svg' },
                { key: 'googleDrive', name: 'Google Drive', logo: '/static/img/logos/googledrive.svg' },
                { key: 'slack', name: 'Slack', logo: '/static/img/logos/slack.svg' },
                { key: 'notion', name: 'Notion', logo: '/static/img/logos/notion.svg' }
            ];
            const connected = (data.integration?.klavis?.servers) || (data.integration?.sample?.servers) || [];
            const isOn = (k) => Array.isArray(connected) ? connected.includes(k) : false;
            integrations.forEach(int => {
                const ok = isOn(int.key);
                content += `
                    <div class="integration-card">
                        <div class="integration-icon">
                            <img src="${int.logo}" alt="${int.name}">
                        </div>
                        <div class="integration-name">${int.name}</div>
                        <div class="integration-status ${ok ? 'connected' : 'disconnected'}">${ok ? 'Connected' : 'Disconnected'}</div>
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
            this.updateAIProviderChips(cur.ai.provider);
            this.renderModelSelects(cur.ai.provider, cur.ai.models);
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

    updateAIProviderChips(active) {
        const wrap = document.getElementById('aiProviderChips');
        if (!wrap) return;
        Array.from(wrap.querySelectorAll('.provider-card')).forEach(card => {
            if (card.dataset.provider === active) card.classList.add('active');
            else card.classList.remove('active');
        });
    }

    collectSettingsPayload() {
        const aiProvider = document.getElementById('aiProvider').value;
        const aiTemperature = parseFloat(document.getElementById('aiTemperature').value || '0.1');
        const aiSystemPrompt = document.getElementById('aiSystemPrompt').value;
        const aiToolSystemPrompt = document.getElementById('aiToolSystemPrompt').value;
        const dataSource = document.getElementById('dataSource').value;
        const logLevel = document.getElementById('logLevel').value;

        // Model selections
        const models = {
            health: document.getElementById('aiModelHealth')?.value || 'claude-3-5-sonnet-20241022',
            opportunities: document.getElementById('aiModelOpportunities')?.value || 'gpt-4o',
            risks: document.getElementById('aiModelRisks')?.value || 'claude-3-5-sonnet-20241022',
            recommendations: document.getElementById('aiModelRecommendations')?.value || 'gpt-4o',
            insights: document.getElementById('aiModelInsights')?.value || 'claude-3-5-sonnet-20241022'
        };

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
                toolSystemPrompt: aiToolSystemPrompt,
                models
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

    // Render model selects based on provider
    renderModelSelects(provider, currentModels = null) {
        const modelOptions = {
            openai: [
                { value: 'gpt-4o', label: 'GPT-4o' },
                { value: 'gpt-4o-mini', label: 'GPT-4o mini' }
            ],
            anthropic: [
                { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
                { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' }
            ]
        };
        const combined = [...modelOptions.openai, ...modelOptions.anthropic];
        const pick = provider === 'openai' ? modelOptions.openai
                  : provider === 'anthropic' ? modelOptions.anthropic
                  : combined;

        const sets = [
            { id: 'aiModelHealth', key: 'health' },
            { id: 'aiModelOpportunities', key: 'opportunities' },
            { id: 'aiModelRisks', key: 'risks' },
            { id: 'aiModelRecommendations', key: 'recommendations' },
            { id: 'aiModelInsights', key: 'insights' }
        ];

        sets.forEach(({ id, key }) => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const prev = sel.value;
            sel.innerHTML = '';
            pick.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                sel.appendChild(o);
            });
            const want = (currentModels && currentModels[key]) || prev || pick[0]?.value;
            if (want) sel.value = want;
        });
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
