/**
 * ============================================================================
 * Hermes WebUI Custom - Profile Management & Lock Protection
 * File: static/custom/profile.js
 * Target UI: #profileChip, #titlebarProfileBtn, #profileDropdown
 * ============================================================================
 */
(function(HC) {
  'use strict';

  const utils = HC.utils || {};

  function isProfileSwitchLocked() {
    if (typeof window.S === 'undefined' || !window.S) return false;
    const s = window.S;
    if (!s.session || !s.session.session_id) return false;
    if (Array.isArray(s.messages) && s.messages.some(m => m && m.role && m.role !== 'system')) return true;
    if (s.session.active_stream_id || s.activeStreamId || s.busy || s.session.pending_user_message) return true;
    if (typeof s.session.message_count === 'number' && s.session.message_count > 0) return true;
    return false;
  }

  // Expose globally so existing and future scripts can query it
  window.isProfileSwitchLocked = isProfileSwitchLocked;

  const ProfileSection = {
    name: 'Profile Management',

    init() {
      // 1. Capture-phase click interceptor on profile buttons
      document.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest && e.target.closest('#profileChip, #titlebarProfileBtn');
        if (btn && isProfileSwitchLocked()) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          utils.toast('Profile cannot be changed for an existing conversation. Start a new chat to switch profiles.', 'info', 3000);
        }
      }, true);

      // 2. Monkey-patch toggleProfileDropdown as defense-in-depth
      if (typeof window.toggleProfileDropdown === 'function' && !window.toggleProfileDropdown._hc_hooked) {
        const origToggle = window.toggleProfileDropdown;
        const hookedToggle = function(e) {
          if (isProfileSwitchLocked()) {
            utils.toast('Profile cannot be changed for an existing conversation. Start a new chat to switch profiles.', 'info', 3000);
            return;
          }
          return origToggle.apply(this, arguments);
        };
        hookedToggle._hc_hooked = true;
        window.toggleProfileDropdown = hookedToggle;
      }

      // 3. Monkey-patch switchToProfile to protect optimistic reverts and cross-profile switches
      if (typeof window.switchToProfile === 'function' && !window.switchToProfile._hc_hooked) {
        const origSwitch = window.switchToProfile;
        const hookedSwitch = async function(name) {
          if (isProfileSwitchLocked()) {
            utils.toast('Profile cannot be changed for an existing conversation. Start a new chat to switch profiles.', 'info', 3000);
            return false;
          }
          try {
            return await origSwitch.apply(this, arguments);
          } catch (err) {
            // Revert topbar labels to authoritative profile on failure
            const s = window.S || {};
            const authProfile = s.activeProfile || (s.session && s.session.profile) || 'default';
            const cLabel = document.getElementById('profileChipLabel');
            if (cLabel) cLabel.textContent = authProfile;
            const tLabel = document.getElementById('titlebarProfileLabel');
            if (tLabel) tLabel.textContent = authProfile;
            throw err;
          }
        };
        hookedSwitch._hc_hooked = true;
        window.switchToProfile = hookedSwitch;
      }
    },

    render() {
      const s = window.S || {};
      const authProfile = s.activeProfile || (s.session && s.session.profile) || 'default';

      // Keep topbar labels synchronized with authoritative profile
      const cLabel = document.getElementById('profileChipLabel');
      if (cLabel && cLabel.textContent !== authProfile) cLabel.textContent = authProfile;
      const tLabel = document.getElementById('titlebarProfileLabel');
      if (tLabel && tLabel.textContent !== authProfile) tLabel.textContent = authProfile;

      const locked = isProfileSwitchLocked();
      const lockTitle = locked
        ? 'Profile locked to current conversation. Start a new chat to switch.'
        : 'Switch profile';

      const chip = document.getElementById('profileChip');
      if (chip) {
        chip.disabled = locked;
        chip.setAttribute('aria-disabled', locked ? 'true' : 'false');
        chip.classList.toggle('profile-locked', locked);
        chip.title = lockTitle;
      }

      const titlebarBtn = document.getElementById('titlebarProfileBtn');
      if (titlebarBtn) {
        titlebarBtn.disabled = locked;
        titlebarBtn.setAttribute('aria-disabled', locked ? 'true' : 'false');
        titlebarBtn.classList.toggle('profile-locked', locked);
        titlebarBtn.title = lockTitle;
      }
    }
  };

  HC.profile = {
    isLocked: isProfileSwitchLocked
  };

  if (typeof HC.registerSection === 'function') {
    HC.registerSection('profile', ProfileSection);
  } else {
    HC.sections = HC.sections || {};
    HC.sections.profile = ProfileSection;
  }

})(window.HermesCustom = window.HermesCustom || {});
