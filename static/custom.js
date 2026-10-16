/**
 * ============================================================================
 * Hermes WebUI - Custom Injector Barrel Script
 * File: static/custom.js
 * ============================================================================
 * Architecture:
 * Acts as the single entrypoint barrel that dynamically injects modular
 * custom UI sections located in static/custom/ without polluting index.html.
 *
 * Folder Structure:
 * static/
 * ├── custom.js              (This barrel file)
 * ├── custom.css             (Root fallback stylesheet)
 * └── custom/
 *     ├── styles.css         (Custom UI styles organized by section)
 *     ├── utils.js           (Shared utilities, storage, and API wrapper)
 *     ├── insights.js        (Insights Panel customizations)
 *     ├── logs.js            (Logs Panel: clear log & clear all)
 *     ├── settings.js        (Settings Panel: plugins toggle & config editor)
 *     ├── skills.js          (Skills Panel: default selector & frontmatter)
 *     └── engine.js          (Lifecycle scheduler and MutationObserver)
 * ============================================================================
 */
(function() {
  'use strict';

  // 1. Initialize namespace and registry
  const HC = window.HermesCustom = window.HermesCustom || {};
  HC.sections = HC.sections || {};

  HC.registerSection = function(name, sectionObj) {
    HC.sections[name] = sectionObj;
  };

  HC.getSection = function(name) {
    return HC.sections[name];
  };

  // 2. Inject Stylesheet
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'static/custom/styles.css';
  document.head.appendChild(css);

  // 3. Module scripts to load in strict sequential order
  const MODULES = [
    'static/custom/utils.js',
    'static/custom/insights.js',
    'static/custom/logs.js',
    'static/custom/settings.js',
    'static/custom/skills.js',
    'static/custom/profile.js',
    'static/custom/sessions.js',
    'static/custom/engine.js'
  ];

  MODULES.forEach((src) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false; // Preserves sequential execution order across all browsers
    document.head.appendChild(s);
  });

})();
