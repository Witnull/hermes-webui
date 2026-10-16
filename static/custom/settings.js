/**
 * ============================================================================
 * Hermes WebUI Custom - Settings Panel Section
 * File: static/custom/settings.js
 * Target UI: #mainSettings, #settingsMenu, #settingsPanePlugins, #settingsPaneConfig
 * ============================================================================
 */
(function(HC) {
  'use strict';

  const utils = HC.utils || {};

  const SettingsSection = {
    name: 'Settings Panel',

    // --------------------------------------------------------------------------
    // 3.A Plugins Management (UI: #settingsPanePlugins)
    // --------------------------------------------------------------------------
    plugins: {
      render() {
        const meta = document.querySelector('#settingsPanePlugins .settings-section-meta');
        if (meta && meta.textContent.includes('read-only')) {
          meta.textContent = 'View and manage installed Hermes plugins and lifecycle hooks.';
        }

        document.querySelectorAll('#pluginsList .plugin-card').forEach(card => {
          if (card.querySelector('.plugin-enable-toggle')) return;
          const key = card.dataset.plugin;
          if (!key) return;

          const badge = card.querySelector('.provider-card-badge');
          const isEnabled = !badge || !badge.classList.contains('plugin-card-badge-disabled');

          const body = card.querySelector('.plugin-card-body');
          if (!body) return;

          const row = document.createElement('div');
          row.className = 'plugin-card-footer-row custom-plugin-toggle';
          row.innerHTML = `
            <span class="plugin-toggle-label">Enabled</span>
            <label class="plugin-toggle-switch">
              <input type="checkbox" class="plugin-enable-toggle" ${isEnabled ? 'checked' : ''}>
              <span class="plugin-toggle-slider"></span>
            </label>
          `;

          const input = row.querySelector('input');
          input.addEventListener('change', async function() {
            const checked = this.checked;
            if (badge) {
              badge.textContent = checked ? 'Enabled' : 'Disabled';
              badge.className = 'provider-card-badge ' + (checked ? '' : 'plugin-card-badge-disabled');
            }
            try {
              if (typeof window.handlePluginEnableToggle === 'function') {
                await window.handlePluginEnableToggle(key, checked);
              } else if (utils.callApi) {
                const payload = { dashboard_plugins: {} };
                payload.dashboard_plugins[key] = !!checked;
                await utils.callApi('/api/settings', { method: 'POST', body: JSON.stringify(payload) });
                if (typeof window.loadPluginsPanel === 'function') window.loadPluginsPanel();
              }
            } catch (_) {}
          });

          body.appendChild(row);
        });
      }
    },

    // --------------------------------------------------------------------------
    // 3.B Raw Configuration YAML Editor (UI: #settingsPaneConfig)
    // --------------------------------------------------------------------------
    config: {
      injectPane() {
        const menuItems = document.querySelector('#settingsMenu .settings-menu-items');
        if (!menuItems || document.getElementById('sideMenuItemConfig')) return;

        // Navigation rail button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'side-menu-item';
        btn.id = 'sideMenuItemConfig';
        btn.dataset.settingsSection = 'config';
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>Config (YAML)</span>
        `;

        const sysBtn = menuItems.querySelector('[data-settings-section="system"]');
        if (sysBtn) {
          menuItems.insertBefore(btn, sysBtn);
        } else {
          menuItems.appendChild(btn);
        }

        // Settings pane content
        const sysPane = document.getElementById('settingsPaneSystem');
        if (sysPane && !document.getElementById('settingsPaneConfig')) {
          const pane = document.createElement('div');
          pane.className = 'settings-pane';
          pane.id = 'settingsPaneConfig';
          pane.innerHTML = `
            <div class="settings-section-head">
              <div>
                <div class="settings-section-title">Configuration (config.yaml)</div>
                <div class="settings-section-meta" id="configYamlPath">Loading config path…</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <button type="button" class="sm-btn" id="btnReloadConfigYaml">Reload</button>
                <button type="button" class="sm-btn primary" id="btnSaveConfigYaml">Save Config</button>
              </div>
            </div>
            <div class="settings-field" style="margin-top:12px">
              <textarea id="configYamlEditor" spellcheck="false" placeholder="Loading config.yaml..."></textarea>
              <div id="configYamlStatus" style="font-size:11px;color:var(--muted);margin-top:6px"></div>
            </div>
          `;
          sysPane.parentNode.insertBefore(pane, sysPane);

          document.getElementById('btnReloadConfigYaml')?.addEventListener('click', () => this.loadYaml());
          document.getElementById('btnSaveConfigYaml')?.addEventListener('click', () => this.saveYaml());

          // Support Tab indentation in YAML editor
          const editor = document.getElementById('configYamlEditor');
          editor?.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
              e.preventDefault();
              const start = this.selectionStart;
              const end = this.selectionEnd;
              this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
              this.selectionStart = this.selectionEnd = start + 2;
            }
          });
        }

        // Active tab toggling
        btn.addEventListener('click', () => {
          document.querySelectorAll('#settingsMenu .side-menu-item').forEach(el => el.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('.settings-pane').forEach(el => el.classList.remove('active'));
          const pane = document.getElementById('settingsPaneConfig');
          if (pane) pane.classList.add('active');
          this.loadYaml();
        });

        menuItems.querySelectorAll('.side-menu-item:not(#sideMenuItemConfig)').forEach(item => {
          item.addEventListener('click', () => {
            btn.classList.remove('active');
            const pane = document.getElementById('settingsPaneConfig');
            if (pane) pane.classList.remove('active');
          });
        });
      },

      async loadYaml() {
        const editor = document.getElementById('configYamlEditor');
        const pathEl = document.getElementById('configYamlPath');
        const status = document.getElementById('configYamlStatus');
        if (!editor) return;
        try {
          if (status) status.textContent = 'Loading config.yaml…';
          const data = utils.callApi ? await utils.callApi('/api/config/raw') : null;
          if (data && data.yaml !== undefined) {
            editor.value = data.yaml;
            if (pathEl) pathEl.textContent = data.path || 'config.yaml';
            if (status) status.textContent = `Loaded from ${data.path || 'config.yaml'}`;
          } else {
            if (status) status.textContent = 'Could not load config.yaml (endpoint unavailable)';
          }
        } catch (e) {
          if (status) status.textContent = 'Failed to load: ' + (e.message || String(e));
        }
      },

      async saveYaml() {
        const editor = document.getElementById('configYamlEditor');
        const status = document.getElementById('configYamlStatus');
        const saveBtn = document.getElementById('btnSaveConfigYaml');
        if (!editor) return;
        try {
          if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
          if (status) status.textContent = 'Saving…';
          if (utils.callApi) {
            const resp = await utils.callApi('/api/config/raw', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ yaml_text: editor.value })
            });
            if (status) status.textContent = 'Saved successfully to ' + (resp && resp.path || 'config.yaml');
            if (utils.toast) utils.toast('config.yaml saved', 'success');
          }
        } catch (e) {
          if (status) status.textContent = 'Failed to save: ' + (e.message || String(e));
          if (utils.toast) utils.toast('Failed to save config.yaml', 'error');
        } finally {
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Config'; }
        }
      }
    },

    // --------------------------------------------------------------------------
    // 3.C Provider Cards (UI: #settingsPaneProviders)
    // --------------------------------------------------------------------------
    providers: {
      render() {
        const pane = document.getElementById('settingsPaneProviders');
        if (!pane) return;

        pane.querySelectorAll('.provider-card').forEach(card => {
          if (card.dataset.hcEnhanced) return;
          const providerId = card.dataset.provider;
          if (!providerId) return;

          const modelInput = card.querySelector('input[id^="providerModel-"], .provider-model-input, input[placeholder*="model" i]');
          const probeStatus = card.querySelector('.provider-probe-status, [id^="providerProbe-"]');
          const badge = card.querySelector('.provider-card-badge');
          const isConnected = badge && !badge.classList.contains('provider-card-badge-disabled');

          // If probe status is empty and card is connected, populate helpful status
          if (isConnected && probeStatus && !probeStatus.textContent) {
            probeStatus.style.color = 'var(--ok, #2ea043)';
            probeStatus.textContent = 'Connected.';
          }
          card.dataset.hcEnhanced = 'true';
        });
      }
    },

    render() {
      this.plugins.render();
      this.config.injectPane();
      this.providers.render();
    }
  };

  if (typeof HC.registerSection === 'function') {
    HC.registerSection('settings', SettingsSection);
  } else {
    HC.sections = HC.sections || {};
    HC.sections.settings = SettingsSection;
  }

})(window.HermesCustom = window.HermesCustom || {});
