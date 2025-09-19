(function() {
  const overallEl = document.querySelector('[data-overall]');
  const updatedEl = document.querySelector('[data-updated]');
  const componentsEl = document.querySelector('[data-components]');
  const incidentsEl = document.querySelector('[data-incidents]');
  const performanceEl = document.querySelector('[data-performance]');
  const pipelineSummaryEl = document.querySelector('[data-pipeline-summary]');
  const pipelineStatusEl = document.querySelector('[data-pipeline-status]');
  const pipelineProvidersEl = document.querySelector('[data-pipeline-providers]');
  const pipelineConflictsEl = document.querySelector('[data-pipeline-conflicts]');
  const pipelineEventsEl = document.querySelector('[data-pipeline-events]');
  const crmStatusEl = document.querySelector('[data-crm-status]');
  const crmMetricsEl = document.querySelector('[data-crm-metrics]');
  const triggerBtn = document.querySelector('#trigger-health');

  const statusColors = {
    healthy: '#16a34a',
    degraded: '#f59e0b',
    unhealthy: '#dc2626',
    warning: '#f59e0b',
    critical: '#dc2626',
    unknown: '#64748b',
    disabled: '#6b7280'
  };

  const describeStatus = (status) => {
    const normalized = (status || 'unknown').toLowerCase();
    return {
      label: normalized.replace(/_/g, ' '),
      color: statusColors[normalized] || statusColors.unknown
    };
  };

  const formatAvailability = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      const date = new Date(iso);
      return date.toLocaleString();
    } catch (error) {
      return iso;
    }
  };

  const formatQualityTriplet = (quality) => {
    if (!quality) return 'Quality insight unavailable';
    const avg = typeof quality.average === 'number' ? quality.average.toFixed(3) : '—';
    const min = typeof quality.min === 'number' ? quality.min.toFixed(3) : '—';
    const max = typeof quality.max === 'number' ? quality.max.toFixed(3) : '—';
    return `avg ${avg} • min ${min} • max ${max}`;
  };

  const renderComponents = (snapshot) => {
    if (!componentsEl) return;
    componentsEl.innerHTML = '';
    snapshot.components.forEach((component) => {
      const { state } = component;
      const status = describeStatus(state.status);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="comp-name">
          <div class="title">${component.name}</div>
          <div class="subtitle">${component.description || ''}</div>
        </td>
        <td><span class="status-pill" style="background:${status.color}">${status.label}</span></td>
        <td>${formatAvailability(state.availability)}</td>
        <td>${component.slaTarget ? `${(component.slaTarget * 100).toFixed(2)}%` : '—'}</td>
        <td>${state.responseTimeMs ? `${state.responseTimeMs.toFixed ? state.responseTimeMs.toFixed(0) : Math.round(state.responseTimeMs)} ms` : '—'}</td>
        <td>${formatDate(state.lastChecked)}</td>
      `;
      componentsEl.appendChild(tr);
    });
  };

  const renderIncidents = (snapshot) => {
    if (!incidentsEl) return;
    incidentsEl.innerHTML = '';
    if (!snapshot.incidents || snapshot.incidents.length === 0) {
      incidentsEl.innerHTML = '<li class="empty">No active incidents.</li>';
      return;
    }
    snapshot.incidents.slice().reverse().forEach((incident) => {
      const status = describeStatus(incident.status);
      const li = document.createElement('li');
      const detailText = incident.details?.error || incident.details?.message || '';
      li.innerHTML = `
        <div class="incident-head">
          <span class="status-pill" style="background:${status.color}">${status.label}</span>
          <strong>${incident.component}</strong>
          <span class="ts">${formatDate(incident.timestamp)}</span>
        </div>
        <div class="incident-body">${detailText || 'Health monitor detected an issue.'}</div>
      `;
      incidentsEl.appendChild(li);
    });
  };

  const renderPerformance = (snapshot) => {
    if (!performanceEl) return;
    const perf = snapshot.performance || {};
    const errorRate = typeof perf.errorRate === 'number' ? (perf.errorRate * 100).toFixed(2) : '0.00';
    const errorTarget = perf.targets ? (perf.targets.errorRate * 100).toFixed(2) : '—';
    const list = (perf.httpTimings || []).slice(0, 8).map(item => `
      <tr>
        <td>${item.key}</td>
        <td>${item.p50 ? Math.round(item.p50) : 0} ms</td>
        <td>${item.p95 ? Math.round(item.p95) : 0} ms</td>
        <td>${item.p99 ? Math.round(item.p99) : 0} ms</td>
      </tr>
    `).join('');

    performanceEl.innerHTML = `
      <div class="performance-summary">
        <div><strong>Error rate:</strong> ${errorRate}% (target ${errorTarget}%)</div>
        <div><strong>Requests:</strong> ${perf.totalRequests || 0}</div>
        <div><strong>Errors:</strong> ${perf.totalErrors || 0}</div>
      </div>
      <table class="timings">
        <thead>
          <tr><th>Endpoint</th><th>P50</th><th>P95</th><th>P99</th></tr>
        </thead>
        <tbody>
          ${list || '<tr><td colspan="4">No request telemetry yet.</td></tr>'}
        </tbody>
      </table>
    `;
  };

  const renderCRMStatus = (snapshot) => {
    if (!crmStatusEl) return;
    const crmData = snapshot.crm || {};
    const connections = crmData.connections || {};

    crmStatusEl.innerHTML = '';

    const crmTypes = ['salesforce', 'hubspot', 'pipedrive'];
    crmTypes.forEach(crmType => {
      const connection = connections[crmType] || { status: 'unavailable' };
      const statusClass = connection.status === 'connected' ? 'connected' :
                         connection.status === 'mock' ? 'mock' : 'failed';

      const card = document.createElement('div');
      card.className = 'crm-card';
      card.innerHTML = `
        <div class="crm-status">
          <div class="status-dot ${statusClass}"></div>
          <strong>${crmType.charAt(0).toUpperCase() + crmType.slice(1)}</strong>
        </div>
        <div class="metric-row">
          <span class="metric-label">Status:</span>
          <span class="metric-value">${connection.status}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Last Test:</span>
          <span class="metric-value">${connection.lastTest ? formatDate(connection.lastTest) : '—'}</span>
        </div>
        ${connection.error ? `
          <div class="metric-row">
            <span class="metric-label">Error:</span>
            <span class="metric-value failure-rate">${connection.error}</span>
          </div>
        ` : ''}
      `;
      crmStatusEl.appendChild(card);
    });
  };

  const renderCRMMetrics = (snapshot) => {
    if (!crmMetricsEl) return;
    const crmMetrics = snapshot.crmMetrics || {};
    const taskCreation = crmMetrics.taskCreation || {};
    const connections = crmMetrics.connections || {};

    const successRate = taskCreation.total > 0 ?
      Math.round((taskCreation.successful / taskCreation.total) * 100) : 0;
    const connectionSuccessRate = connections.total > 0 ?
      Math.round((connections.successful / connections.total) * 100) : 0;

    crmMetricsEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        <div>
          <div class="metric-row">
            <span class="metric-label">Tasks Created:</span>
            <span class="metric-value">${taskCreation.total || 0}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Success Rate:</span>
            <span class="metric-value success-rate">${successRate}%</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Failed:</span>
            <span class="metric-value failure-rate">${taskCreation.failed || 0}</span>
          </div>
        </div>
        <div>
          <div class="metric-row">
            <span class="metric-label">CRM Operations:</span>
            <span class="metric-value">${connections.total || 0}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Connection Success:</span>
            <span class="metric-value success-rate">${connectionSuccessRate}%</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Avg Duration:</span>
            <span class="metric-value">${connections.avgDuration ? connections.avgDuration + 'ms' : '—'}</span>
          </div>
        </div>
      </div>
      ${Object.keys(taskCreation.byCRM || {}).length > 0 ? `
        <div style="margin-top: 16px;">
          <h4 style="color: #93c5fd; font-size: 0.9rem; margin-bottom: 8px;">By CRM System:</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
            ${Object.entries(taskCreation.byCRM).map(([crm, stats]) => `
              <div style="background: rgba(30, 41, 59, 0.3); padding: 8px; border-radius: 6px;">
                <div style="font-weight: 600; margin-bottom: 4px;">${crm.charAt(0).toUpperCase() + crm.slice(1)}</div>
                <div class="metric-row" style="margin: 2px 0;">
                  <span class="metric-label">Total:</span>
                  <span class="metric-value">${stats.total || 0}</span>
                </div>
                <div class="metric-row" style="margin: 2px 0;">
                  <span class="metric-label">Success:</span>
                  <span class="metric-value success-rate">${stats.successful || 0}</span>
                </div>
                ${stats.avgDuration ? `
                  <div class="metric-row" style="margin: 2px 0;">
                    <span class="metric-label">Avg:</span>
                    <span class="metric-value">${stats.avgDuration}ms</span>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  };

  const renderPipeline = (snapshot) => {
    if (!pipelineSummaryEl) return;
    const data = snapshot.dataPipeline || {};
    const status = describeStatus(data.status || 'unknown');

    pipelineSummaryEl.innerHTML = `
      <div><span class="status-pill" style="background:${status.color}">${status.label}</span></div>
      <div class="meta">
        <span>Source: ${data.source || '—'}</span>
        <span>Lookback: ${data.lookbackMinutes || 60}m</span>
        <span>Last event: ${formatDate(data.lastEventAt)}</span>
      </div>
      <div class="quality">${formatQualityTriplet(data.quality)}</div>
    `;

    if (pipelineStatusEl) {
      const entries = Object.entries(data.statusCounts || {});
      pipelineStatusEl.innerHTML = entries.length
        ? entries.map(([key, count]) => {
            const status = describeStatus(key);
            return `<li><span class="label">${status.label}</span><span>${count}</span></li>`;
          }).join('')
        : '<li class="empty">No recent ingestion runs.</li>';
    }

    if (pipelineProvidersEl) {
      const providers = data.providerCounts || [];
      pipelineProvidersEl.innerHTML = providers.length
        ? providers.map(item => `<li><span class="label">${item.source}</span><span>${item.count}</span></li>`).join('')
        : '<li class="empty">No provider activity.</li>';
    }

    if (pipelineConflictsEl) {
      const conflicts = data.conflictByDomain || [];
      pipelineConflictsEl.innerHTML = conflicts.length
        ? conflicts.map(item => `<li><span class="label">${item.recordType}</span><span>${item.conflicts}</span></li>`).join('')
        : '<li class="empty">No conflicts recorded.</li>';
    }

    if (pipelineEventsEl) {
      const events = data.recentEvents || [];
      pipelineEventsEl.innerHTML = events.length
        ? events.map(event => {
            const status = describeStatus(event.status);
            const quality = typeof event.qualityScore === 'number' ? event.qualityScore.toFixed(3) : '—';
            return `
              <tr>
                <td>${formatDate(event.createdAt || event.generatedAt)}</td>
                <td>${event.accountName || '—'}</td>
                <td>${event.source || (event.providers ? event.providers.map(p => p.provider).join(', ') : '—')}</td>
                <td>${event.recordType || '—'}</td>
                <td><span class="status-pill" style="background:${status.color}">${status.label}</span></td>
                <td>${quality}</td>
              </tr>
            `;
          }).join('')
        : '<tr><td colspan="6">No pipeline activity captured yet.</td></tr>';
    }
  };

  const renderSummary = (snapshot) => {
    if (overallEl) {
      const status = describeStatus(snapshot.overallStatus);
      overallEl.style.background = status.color;
      overallEl.textContent = status.label;
    }
    if (updatedEl) {
      updatedEl.textContent = snapshot.generatedAt ? formatDate(snapshot.generatedAt) : '—';
    }
  };

  const renderSnapshot = (snapshot) => {
    if (!snapshot) return;
    renderSummary(snapshot);
    renderComponents(snapshot);
    renderIncidents(snapshot);
    renderPerformance(snapshot);
    renderCRMStatus(snapshot);
    renderCRMMetrics(snapshot);
    renderPipeline(snapshot);
  };

  const fetchSnapshot = async () => {
    try {
      const response = await fetch('/api/monitoring/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      renderSnapshot(data);
    } catch (error) {
      console.error('Monitoring snapshot failed', error);
    }
  };

  const connectStream = () => {
    let retry = 1000;
    const connect = () => {
      const source = new EventSource('/monitoring/stream');

      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'snapshot') {
            renderSnapshot(payload.snapshot);
          } else if (payload.type === 'component') {
            fetchSnapshot();
          } else if (payload.type === 'incident') {
            fetchSnapshot();
          } else if (payload.type === 'pipeline') {
            renderPipeline({ dataPipeline: payload.summary });
          }
        } catch (error) {
          console.warn('SSE payload parse failed', error);
        }
      };

      source.onerror = () => {
        source.close();
        retry = Math.min(retry * 2, 30000);
        setTimeout(connect, retry);
      };
    };

    connect();
  };

  if (triggerBtn) {
    triggerBtn.addEventListener('click', async () => {
      triggerBtn.disabled = true;
      try {
        await fetch('/monitoring/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Manual health check failed', error);
      } finally {
        triggerBtn.disabled = false;
      }
    });
  }

  fetchSnapshot();
  connectStream();
})();
