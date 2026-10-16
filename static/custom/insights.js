/**
 * ============================================================================
 * Hermes WebUI Custom - Insights Panel Section
 * File: static/custom/insights.js
 * Target UI: #mainInsights, .insights-*
 * ============================================================================
 */
(function(HC) {
  'use strict';

  const InsightsSection = {
    name: 'Insights Panel',

    init() {
      // Model health card suppression is handled via CSS:
      // .insights-model-health-card { display: none !important; }
    },

    render() {
      // Hook for future insights enhancements
    }
  };

  if (typeof HC.registerSection === 'function') {
    HC.registerSection('insights', InsightsSection);
  } else {
    HC.sections = HC.sections || {};
    HC.sections.insights = InsightsSection;
  }

})(window.HermesCustom = window.HermesCustom || {});
