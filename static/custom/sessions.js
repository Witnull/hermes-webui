/**
 * ============================================================================
 * Hermes WebUI Custom - Sessions Management & Sidebar Enhancements
 * File: static/custom/sessions.js
 * Target UI: #sessionList, #mainSessions, sidebar conversation items
 * ============================================================================
 */
(function(HC) {
  'use strict';

  const SessionsSection = {
    name: 'Sessions Management',

    init() {
      // 1. Monkey-patch loadSession for graceful profile-mismatch and 404 recovery
      if (typeof window.loadSession === 'function' && !window.loadSession._hc_hooked) {
        const origLoadSession = window.loadSession;
        const hookedLoadSession = async function(sid) {
          try {
            return await origLoadSession.apply(this, arguments);
          } catch (e) {
            const isProfileMismatch = e && (e.status === 409 || e.code === 'session_profile_mismatch' || (e.body && e.body.code === 'session_profile_mismatch'));
            const is404 = e && (e.status === 404 || /not found/i.test(e.message || ''));
            const s = window.S || {};
            if (isProfileMismatch || (is404 && (!s.messages || s.messages.length === 0))) {
              try { localStorage.removeItem('hermes-webui-session'); } catch (_) {}
              if (typeof window.newSession === 'function') {
                await window.newSession(false, { worktree: false });
              }
              return;
            }
            throw e;
          }
        };
        hookedLoadSession._hc_hooked = true;
        window.loadSession = hookedLoadSession;
      }

      // 2. Wrap renderSessionListFromCache to re-run enhancements on cache update
      if (typeof window.renderSessionListFromCache === 'function' && !window.renderSessionListFromCache._hc_hooked) {
        const origRenderFromCache = window.renderSessionListFromCache;
        const hookedRenderFromCache = function() {
          const res = origRenderFromCache.apply(this, arguments);
          SessionsSection.render();
          return res;
        };
        hookedRenderFromCache._hc_hooked = true;
        window.renderSessionListFromCache = hookedRenderFromCache;
      }
    },

    render() {
      const list = document.getElementById('sessionList');
      if (!list) return;

      const sessions = (window.S && Array.isArray(window.S.sessions) ? window.S.sessions : []) || [];
      const sessionMap = new Map();
      sessions.forEach(s => {
        if (s && s.session_id) sessionMap.set(s.session_id, s);
      });

      // 1. Add session-profile-tag badges to session rows
      list.querySelectorAll('.session-item, [data-session-id]').forEach(row => {
        const sid = row.dataset.sessionId || row.id.replace(/^session-/, '');
        const s = sessionMap.get(sid);
        if (!s) return;

        const titleRow = row.querySelector('.session-item-title-row, .session-title-row') ||
                         row.querySelector('.session-text > div:first-child') ||
                         row.querySelector('.session-title')?.parentElement;
        if (!titleRow || titleRow.querySelector('.session-profile-tag')) return;

        const sProfile = s.profile || 'default';
        const profTag = document.createElement('span');
        profTag.className = 'session-profile-tag' + (sProfile === 'default' ? ' session-profile-tag--default' : ' session-profile-tag--custom');
        profTag.textContent = sProfile;
        profTag.title = 'Profile: ' + sProfile;

        // Insert before timestamp element if present
        const ts = titleRow.querySelector('.session-ts, .session-time, time, span:last-child');
        if (ts && ts.parentElement === titleRow) {
          titleRow.insertBefore(profTag, ts);
        } else {
          titleRow.appendChild(profTag);
        }
      });

      // 2. Enhance text toggles to explicit chrome buttons
      list.querySelectorAll('div').forEach(el => {
        // Skip elements already enhanced or not direct children of session list / groups
        if (el.tagName === 'BUTTON' || el.classList.contains('session-list-btn')) return;

        const txt = (el.textContent || '').trim();

        // 2.1 "Show X from other profiles" / "Show active profile only"
        if (/^Show \d+ from other profiles$/i.test(txt)) {
          el.className = 'session-list-btn session-profile-toggle-btn';
          el.setAttribute('role', 'button');
          el.setAttribute('aria-pressed', 'false');
          if (!el.querySelector('svg')) {
            const iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
            el.innerHTML = iconSvg + `<span>${HC.utils.escHtml(txt)}</span>`;
          }
        } else if (/^Show active profile only$/i.test(txt)) {
          el.className = 'session-list-btn session-profile-toggle-btn active';
          el.setAttribute('role', 'button');
          el.setAttribute('aria-pressed', 'true');
          if (!el.querySelector('svg')) {
            const iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
            el.innerHTML = iconSvg + `<span>${HC.utils.escHtml(txt)}</span>`;
          }
        }

        // 2.2 "Show X archived" / "Hide archived"
        else if (/^(Show \d+ archived|Hide archived)$/i.test(txt)) {
          const isHide = /^Hide/i.test(txt);
          el.className = 'session-list-btn session-archived-toggle-btn' + (isHide ? ' active' : '');
          el.setAttribute('role', 'button');
          el.setAttribute('aria-pressed', isHide ? 'true' : 'false');
          if (!el.querySelector('svg')) {
            const archIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>`;
            el.innerHTML = archIconSvg + `<span>${HC.utils.escHtml(txt)}</span>`;
          }
        }

        // 2.3 "Load X more archived"
        else if (/^Load \d+ more archived/i.test(txt)) {
          el.className = 'session-list-btn session-load-more-btn';
          el.setAttribute('role', 'button');
          if (!el.querySelector('svg')) {
            const moreSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
            el.innerHTML = moreSvg + `<span>${HC.utils.escHtml(txt)}</span>`;
          }
        }

        // 2.4 "Session select mode"
        else if (el.classList.contains('session-select-toggle') || /Session select mode/i.test(txt)) {
          el.className = 'session-list-btn session-select-toggle';
          el.setAttribute('role', 'button');
          if (!el.querySelector('svg')) {
            const selectIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></svg>`;
            el.innerHTML = selectIconSvg + `<span>${HC.utils.escHtml(txt)}</span>`;
          }
        }
      });
    }
  };

  if (typeof HC.registerSection === 'function') {
    HC.registerSection('sessions', SessionsSection);
  } else {
    HC.sections = HC.sections || {};
    HC.sections.sessions = SessionsSection;
  }

})(window.HermesCustom = window.HermesCustom || {});
