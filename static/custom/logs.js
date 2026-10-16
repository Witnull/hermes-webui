/**
 * ============================================================================
 * Hermes WebUI Custom - Logs Panel Section
 * File: static/custom/logs.js
 * Target UI: #panelLogs, #mainLogs, #logsFile, #logsOutput, #logsCopyAll
 * ============================================================================
 */
(function(HC) {
  'use strict';

  const utils = HC.utils || {};

  const ALL_LOG_FILES = [
    { id: 'agent', label: 'Agent', file: 'agent.log' },
    { id: 'errors', label: 'Errors', file: 'errors.log' },
    { id: 'gateway', label: 'Gateway', file: 'gateway.log' },
    { id: 'gui', label: 'GUI', file: 'gui.log' },
    { id: 'tui_gateway_crash', label: 'Crash', file: 'tui_gateway_crash.log' }
  ];

  const LogsSection = {
    name: 'Logs Panel',
    _discoveredFiles: null,

    init() {
      this.hookSelectedFile();
      this.fetchAvailableLogs();
      this.injectControls();
    },

    render() {
      this.hookSelectedFile();
      this.injectControls();
    },

    hookSelectedFile() {
      if (typeof window._selectedLogsFile === 'function' && !window._selectedLogsFile._hc_hooked) {
        const orig = window._selectedLogsFile;
        window._selectedLogsFile = function() {
          const el = document.getElementById('logsFile');
          if (el && el.value) {
            return el.value;
          }
          return orig();
        };
        window._selectedLogsFile._hc_hooked = true;
      }
    },

    async fetchAvailableLogs() {
      try {
        const res = await utils.callApi('/api/logs?action=list');
        if (res && res.ok && Array.isArray(res.files)) {
          this._discoveredFiles = res.files;
          this.syncFileTabs();
        }
      } catch (_) {}
    },

    getActiveFile() {
      const el = document.getElementById('logsFile');
      return (el && el.value) || (typeof window._selectedLogsFile === 'function' ? window._selectedLogsFile() : 'agent');
    },

    setActiveFile(fileId) {
      const select = document.getElementById('logsFile');
      if (select) {
        select.value = fileId;
      }
      this.syncFileTabs();
      if (typeof window.loadLogs === 'function') {
        window.loadLogs(true);
      }
    },

    syncFileTabs() {
      const container = document.getElementById('logsFileTabs');
      if (!container) return;
      const current = this.getActiveFile();
      container.querySelectorAll('.logs-file-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.file === current);
      });
    },

    injectControls() {
      this.injectFileTabs();
      this.injectActionButtons();
    },

    injectFileTabs() {
      const select = document.getElementById('logsFile');
      if (!select) return;

      // Populate any missing options in the select element
      const existingOptions = new Set(Array.from(select.options).map(o => o.value));
      const fileList = this._discoveredFiles || ALL_LOG_FILES;
      fileList.forEach(item => {
        const id = item.id || item.name;
        if (!existingOptions.has(id)) {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = item.label || id;
          select.appendChild(opt);
        }
      });

      // Inject visual pills tab bar right above the select if not already present
      if (document.getElementById('logsFileTabs')) {
        this.syncFileTabs();
        return;
      }

      const tabs = document.createElement('div');
      tabs.id = 'logsFileTabs';
      tabs.className = 'logs-file-tabs';

      fileList.forEach(item => {
        const id = item.id || item.name;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'logs-file-tab' + (id === this.getActiveFile() ? ' active' : '');
        btn.dataset.file = id;
        btn.textContent = item.label || id;
        btn.title = `Switch to ${item.file || id + '.log'}`;
        btn.addEventListener('click', () => {
          this.setActiveFile(id);
        });
        tabs.appendChild(btn);
      });

      // Insert tabs before the select element
      select.parentNode.insertBefore(tabs, select);
      select.addEventListener('change', () => this.syncFileTabs());
    },

    injectActionButtons() {
      // 1. Sidebar clear buttons
      const copyBtn = document.getElementById('logsCopyAll');
      if (copyBtn && !document.getElementById('logsClearCurrent')) {
        const wrap = document.createElement('div');
        wrap.className = 'logs-clear-actions-row';

        const clearCur = document.createElement('button');
        clearCur.type = 'button';
        clearCur.id = 'logsClearCurrent';
        clearCur.className = 'logs-copy logs-btn-danger';
        clearCur.textContent = 'Clear log';
        clearCur.title = 'Clear currently selected log file';
        clearCur.onclick = () => this.handleClearCurrent();

        const clearAll = document.createElement('button');
        clearAll.type = 'button';
        clearAll.id = 'logsClearAll';
        clearAll.className = 'logs-copy logs-btn-danger';
        clearAll.textContent = 'Clear all';
        clearAll.title = 'Clear all log files';
        clearAll.onclick = () => this.handleClearAll();

        wrap.appendChild(clearCur);
        wrap.appendChild(clearAll);
        copyBtn.parentNode.insertBefore(wrap, copyBtn.nextSibling);
      }

      // 2. Header clear buttons in #mainLogs
      const headerActions = document.querySelector('#mainLogs .main-view-header .main-view-actions');
      if (headerActions && !document.getElementById('logsHeaderClearCurrent')) {
        const headerClearCur = document.createElement('button');
        headerClearCur.type = 'button';
        headerClearCur.id = 'logsHeaderClearCurrent';
        headerClearCur.className = 'logs-copy compact logs-btn-danger';
        headerClearCur.textContent = 'Clear log';
        headerClearCur.onclick = () => this.handleClearCurrent();

        const headerClearAll = document.createElement('button');
        headerClearAll.type = 'button';
        headerClearAll.id = 'logsHeaderClearAll';
        headerClearAll.className = 'logs-copy compact logs-btn-danger';
        headerClearAll.textContent = 'Clear all';
        headerClearAll.onclick = () => this.handleClearAll();

        headerActions.appendChild(headerClearCur);
        headerActions.appendChild(headerClearAll);
      }
    },

    async confirmAction(title, message, confirmLabel = 'Clear') {
      if (typeof window.showConfirmDialog === 'function') {
        return window.showConfirmDialog({
          title,
          message,
          confirmLabel,
          danger: true
        });
      }
      return window.confirm(`${title}\n\n${message}`);
    },

    async handleClearCurrent() {
      const file = this.getActiveFile();
      const ok = await this.confirmAction(
        'Clear Log File',
        `Are you sure you want to clear ${file}.log? Current entries will be permanently deleted.`
      );
      if (!ok) return;

      try {
        const res = await utils.callApi('/api/logs/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: file })
        });
        if (res && res.ok) {
          if (utils.toast) utils.toast(`Successfully cleared ${file}.log`, 'success');
          if (typeof window.loadLogs === 'function') {
            window.loadLogs(true);
          }
        } else {
          if (utils.toast) utils.toast('Failed to clear log: ' + ((res && res.error) || 'error'), 'error');
        }
      } catch (err) {
        if (utils.toast) utils.toast('Error clearing log: ' + err.message, 'error');
      }
    },

    async handleClearAll() {
      const ok = await this.confirmAction(
        'Clear All Logs',
        'Are you sure you want to clear ALL log files (agent, errors, gateway, gui, crash)? This action cannot be undone.',
        'Clear All'
      );
      if (!ok) return;

      try {
        const res = await utils.callApi('/api/logs/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: 'all' })
        });
        if (res && res.ok) {
          if (utils.toast) utils.toast('All log files cleared successfully', 'success');
          if (typeof window.loadLogs === 'function') {
            window.loadLogs(true);
          }
        } else {
          if (utils.toast) utils.toast('Failed to clear all logs: ' + ((res && res.error) || 'error'), 'error');
        }
      } catch (err) {
        if (utils.toast) utils.toast('Error clearing logs: ' + err.message, 'error');
      }
    }
  };

  if (typeof HC.registerSection === 'function') {
    HC.registerSection('logs', LogsSection);
  } else {
    HC.sections = HC.sections || {};
    HC.sections.logs = LogsSection;
  }

})(window.HermesCustom = window.HermesCustom || {});
