/**
 * ============================================================================
 * Hermes WebUI Custom - Shared Utilities
 * File: static/custom/utils.js
 * ============================================================================
 */
(function(HC) {
  'use strict';

  const STORAGE_DEFAULT_SKILLS = 'hermes-default-skills';

  HC.utils = {
    toast(msg, type = 'info', duration = 3000) {
      if (typeof window.showToast === 'function') {
        window.showToast(msg, duration, type);
      }
    },

    escHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },

    async callApi(endpoint, opts = {}) {
      if (typeof window.api === 'function') {
        return window.api(endpoint, opts);
      }
      return fetch(endpoint, opts).then(r => r.json());
    },

    getDefaultSkills() {
      try {
        const val = localStorage.getItem(STORAGE_DEFAULT_SKILLS);
        return val ? JSON.parse(val) : [];
      } catch (_) {
        return [];
      }
    },

    setDefaultSkills(arr) {
      try {
        localStorage.setItem(STORAGE_DEFAULT_SKILLS, JSON.stringify(arr));
      } catch (_) {}
    },

    parseModelName(raw) {
      if (!raw || typeof raw !== 'string') return raw || '';
      let s = raw.trim();
      if (!s) return '';
      // Strip URI prefix or @provider: prefix
      if (s.startsWith('@') && s.includes(':')) {
        const parts = s.slice(1).split(':');
        s = parts.slice(1).join(':') || s;
      }
      // Strip provider slug if followed by path (e.g. llamacpp/F:\..., custom/C:\...)
      const firstSlash = s.indexOf('/');
      if (firstSlash > 0 && !s.includes('://')) {
        const prefix = s.slice(0, firstSlash);
        const remainder = s.slice(firstSlash + 1);
        if (/^[a-z0-9_-]+$/i.test(prefix) && (remainder.includes('\\') || remainder.includes('/'))) {
          s = remainder;
        }
      }
      // Strip directory paths (Windows backslashes \ or POSIX /)
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && (s.includes('\\') || s.includes('/'))) {
        s = s.replace(/[/\\]+$/, '');
        const lastSep = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        if (lastSep >= 0) {
          const tail = s.substring(lastSep + 1).trim();
          if (tail) s = tail;
        }
      }
      // Strip binary model file extensions (.gguf, .bin, .safetensors, .pt, .onnx, .pth, .ckpt)
      s = s.replace(/\.(gguf|bin|safetensors|pt|onnx|pth|ckpt)(\.[\w-]+)*$/i, '');
      return s || raw;
    }
  };

})(window.HermesCustom = window.HermesCustom || {});
