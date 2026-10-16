/**
 * ============================================================================
 * Hermes WebUI Custom - Core Lifecycle Engine
 * File: static/custom/engine.js
 * ============================================================================
 */
(function(HC) {
  'use strict';

  let debounceTimer = null;

  function scheduleTick(delay = 150) {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runAllSections();
    }, delay);
  }

  function hookModelNameParser() {
    if (HC.utils && HC.utils.parseModelName) {
      if (typeof window.getModelLabel === 'function' && !window.getModelLabel._hc_hooked) {
        const origGetModelLabel = window.getModelLabel;
        const hooked = function(modelId) {
          const raw = origGetModelLabel(modelId);
          return HC.utils.parseModelName(raw);
        };
        hooked._hc_hooked = true;
        window.getModelLabel = hooked;
      }

      if (typeof window._compactComposerModelChipLabel === 'function' && !window._compactComposerModelChipLabel._hc_hooked) {
        const origCompact = window._compactComposerModelChipLabel;
        const hookedCompact = function(modelId, labelText) {
          const res = origCompact(modelId, labelText);
          return HC.utils.parseModelName(res);
        };
        hookedCompact._hc_hooked = true;
        window._compactComposerModelChipLabel = hookedCompact;
      }

      if (typeof window.syncSettingsModelChip === 'function' && !window.syncSettingsModelChip._hc_hooked) {
        const origSyncChip = window.syncSettingsModelChip;
        const hookedSyncChip = function() {
          origSyncChip.apply(this, arguments);
          const sChip = document.getElementById('settingsModelChip');
          if (sChip && sChip.textContent) sChip.textContent = HC.utils.parseModelName(sChip.textContent);
        };
        hookedSyncChip._hc_hooked = true;
        window.syncSettingsModelChip = hookedSyncChip;
      }

      // Clean existing chips directly
      const cLabel = document.getElementById('composerModelLabel');
      if (cLabel && cLabel.textContent) cLabel.textContent = HC.utils.parseModelName(cLabel.textContent);
      const mLabel = document.getElementById('composerMobileModelLabel');
      if (mLabel && mLabel.textContent) mLabel.textContent = HC.utils.parseModelName(mLabel.textContent);
      const sChip = document.getElementById('settingsModelChip');
      if (sChip && sChip.textContent) sChip.textContent = HC.utils.parseModelName(sChip.textContent);

      document.querySelectorAll('#modelSelect option, select.model-select option, #activeModelSelect option, datalist[id^="providerModelList-"] option').forEach(opt => {
        if (opt.textContent && !opt.dataset.hcParsed) {
          opt.dataset.hcParsed = 'true';
          opt.textContent = HC.utils.parseModelName(opt.textContent);
        }
      });
    }
  }

  function hookCoreLifecycle() {
    if (typeof window.syncTopbar === 'function' && !window.syncTopbar._hc_hooked) {
      const origSyncTopbar = window.syncTopbar;
      const hookedSyncTopbar = function() {
        const res = origSyncTopbar.apply(this, arguments);
        const profileSec = HC.getSection && HC.getSection('profile');
        if (profileSec && typeof profileSec.render === 'function') {
          profileSec.render();
        }
        return res;
      };
      hookedSyncTopbar._hc_hooked = true;
      window.syncTopbar = hookedSyncTopbar;
    }
  }

  function runAllSections() {
    hookModelNameParser();
    hookCoreLifecycle();
    const sections = HC.sections || {};
    for (const [key, section] of Object.entries(sections)) {
      try {
        if (typeof section.render === 'function') {
          section.render();
        }
      } catch (err) {
        console.warn(`[HermesCustom] Error in section "${key}":`, err);
      }
    }
  }

  function initAllSections() {
    const sections = HC.sections || {};
    for (const [key, section] of Object.entries(sections)) {
      try {
        if (typeof section.init === 'function') {
          section.init();
        }
      } catch (err) {
        console.warn(`[HermesCustom] Error initializing section "${key}":`, err);
      }
    }
  }

  // Hook navigation and panel clicks for instantaneous UI responsiveness
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest('#skillsList, #sessionList, .rail-btn, .nav-tab, .side-menu-item, .panel-btn')) {
      setTimeout(() => scheduleTick(30), 10);
    }
  });

  // Startup lifecycle
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAllSections();
      scheduleTick(0);
    });
  } else {
    initAllSections();
    scheduleTick(0);
  }

  // Low-frequency observer with debounce to eliminate UI freeze
  const observer = new MutationObserver(() => {
    scheduleTick(150);
  });
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  // Expose engine controls
  HC.tick = (delay = 0) => scheduleTick(delay);
  HC.runAll = runAllSections;

})(window.HermesCustom = window.HermesCustom || {});
