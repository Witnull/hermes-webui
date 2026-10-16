/**
 * ============================================================================
 * Hermes WebUI Custom - Skills Panel Section
 * File: static/custom/skills.js
 * Target UI: #mainSkills, #skillsList, #skillDetailBody, #skillDetailTitle
 * ============================================================================
 */
(function(HC) {
  'use strict';

  const utils = HC.utils || {};

  const BUNDLED_DEFAULT_SKILLS = new Set([
    'airtable', 'architecture-diagram', 'arxiv', 'baoyu-infographic', 'blocked-page-recovery',
    'box', 'claude-code', 'codebase-inspection', 'codex', 'competitor-news-monitor',
    'computer-use', 'design-md', 'document-to-action-items', 'docx', 'dogfood',
    'email-inbox-triage', 'gif-search', 'github', 'google-workspace', 'grounded-citations',
    'hermes-agent', 'hermes-agent-skill-authoring', 'himalaya', 'humanizer',
    'inspecting-hermes-desktop-dom', 'llm-wiki', 'maps', 'meeting-action-items',
    'node-inspect-debugger', 'obsidian', 'opencode', 'p5js', 'pdf', 'popular-web-designs',
    'powerpoint', 'product-price-monitor', 'python-debugpy', 'requesting-code-review',
    'sdlc-review', 'simplify-code', 'songsee', 'spike', 'systematic-debugging',
    'test-driven-development', 'weekly-review-planning', 'xlsx', 'xurl', 'youtube-content'
  ]);

  const OFFICIAL_OPTIONAL_SKILLS = new Set([
    '1password', '3-statement-model', 'accelerate', 'actual-setup', 'adversarial-ux-test',
    'agent-merge-conflict-arbiter', 'agentmail', 'ai-presenter-video', 'antigravity-cli',
    'archify', 'ascii-art', 'ast-grep', 'audiocraft-audio-generation', 'auteur', 'axolotl',
    'baoyu-article-illustrator', 'baoyu-comic', 'bioinformatics', 'blackbox', 'blogwatcher',
    'brag', 'brag-slim', 'canvas', 'chroma', 'clip', 'cloudflare-temporary-deploy', 'code-wiki',
    'comfyui', 'comps-analysis', 'concept-diagrams', 'creative-ideation', 'darwinian-evolver',
    'dcf-model', 'decision-questionnaire', 'docker-management', 'domain-intel', 'draw-your-font',
    'dream-loop', 'drug-discovery', 'dspy', 'duckduckgo-search', 'dynamic-workflow',
    'evaluating-llms-harness', 'evm', 'excalidraw', 'excel-author', 'faiss', 'fastmcp',
    'fitness-nutrition', 'flash-attention', 'gitnexus-explorer', 'godmode', 'grill-me', 'grok',
    'guidance', 'har-derived-api-client', 'heartmula', 'here-now',
    'hermes-s6-container-supervision', 'honcho', 'huggingface-hub', 'huggingface-tokenizers',
    'hyperframes', 'hyperliquid', 'impeccable', 'inference-sh-cli', 'instructor', 'ip-as-logo',
    'jupyter-notebook', 'kanban-video-orchestrator', 'lambda-labs', 'lbo-model',
    'live-dashboard', 'llama-cpp', 'llava', 'mcp-oauth-remote-gateway', 'mcporter',
    'meme-generation', 'memento-flashcards', 'merger-model', 'minecraft-modpack-server',
    'modal', 'mono-color', 'mpp-agent', 'nemo-curator', 'neuroskill-bci', 'obliteratus',
    'one-three-one-rule', 'openclaw-migration', 'openhands', 'openhue', 'osint-investigation',
    'oss-forensics', 'outlines', 'page-agent', 'parallel-cli', 'peft', 'pinecone',
    'pinecone-research', 'pinggy-tunnel', 'pixel-art', 'pokemon-player', 'polymarket',
    'pptx-author', 'pr-lens', 'pretext', 'property-listings', 'publish-site', 'pytorch-fsdp',
    'pytorch-lightning', 'qdrant', 'qmd', 'reddit-reading', 'research-paper-writing',
    'rest-graphql-debug', 'rss-feeds', 'saelens', 'scrapling', 'scrollcraft', 'searxng-search',
    'segment-anything-model', 'serving-llms-vllm', 'setup-wizard-generator', 'sherlock',
    'shop', 'shopify', 'simple-english', 'simpo', 'siyuan', 'sketch', 'slime',
    'social-media-content-calendar', 'solana', 'stable-diffusion', 'stocks',
    'stripe-link-cli', 'stripe-projects', 'subagent-driven-development', 'system-atlas',
    'telephony', 'tensorrt-llm', 'tldraw-offline', 'torchtitan', 'trl-fine-tuning',
    'unbroker', 'unreal-mcp', 'unsloth', 'watchers', 'web-pentest', 'weights-and-biases',
    'whisper', 'yuanbao'
  ]);

  const SkillsSection = {
    name: 'Skills Panel',

    activeOrigin: 'all',

    resolveOrigin(skill) {
      if (skill && skill.origin && ['user', 'optional', 'default'].includes(skill.origin)) {
        return skill.origin;
      }
      const name = ((skill && skill.name) || '').toLowerCase();
      if (BUNDLED_DEFAULT_SKILLS.has(name)) {
        return 'default';
      }
      if (OFFICIAL_OPTIONAL_SKILLS.has(name) || (skill && String(skill.category || '').toLowerCase() === 'optional')) {
        return 'optional';
      }
      return 'user';
    },

    // --------------------------------------------------------------------------
    // Origin Filter Tabs & Badges (UI: #panelSkills head & #skillsList)
    // --------------------------------------------------------------------------
    originTabs: {
      injectTabs() {
        const panelHead = document.querySelector('#panelSkills .panel-head');
        if (!panelHead || document.getElementById('skillsOriginTabs')) return;

        const tabsWrap = document.createElement('div');
        tabsWrap.id = 'skillsOriginTabs';
        tabsWrap.className = 'skills-origin-tabs';
        tabsWrap.innerHTML = `
          <button type="button" class="skills-origin-tab active" data-origin="all">All</button>
          <button type="button" class="skills-origin-tab" data-origin="user">User</button>
          <button type="button" class="skills-origin-tab" data-origin="default">Default</button>
          <button type="button" class="skills-origin-tab" data-origin="optional">Optional</button>
        `;

        tabsWrap.querySelectorAll('.skills-origin-tab').forEach(btn => {
          btn.addEventListener('click', () => {
            tabsWrap.querySelectorAll('.skills-origin-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            SkillsSection.activeOrigin = btn.dataset.origin;
            if (typeof window.filterSkills === 'function') {
              window.filterSkills();
            } else if (typeof window.renderSkills === 'function' && window._skillsData) {
              window.renderSkills(window._skillsData);
            }
          });
        });

        panelHead.parentNode.insertBefore(tabsWrap, panelHead.nextSibling);
        this.updateTabCounts();
      },

      updateTabCounts(skills) {
        const list = Array.isArray(skills) ? skills : (window._skillsData || []);
        if (!list.length) return;
        const counts = { all: list.length, user: 0, default: 0, optional: 0 };
        list.forEach(s => {
          const o = SkillsSection.resolveOrigin(s);
          if (counts[o] !== undefined) counts[o]++;
        });
        const tabsWrap = document.getElementById('skillsOriginTabs');
        if (!tabsWrap) return;
        tabsWrap.querySelectorAll('.skills-origin-tab').forEach(btn => {
          const org = btn.dataset.origin;
          const label = org.charAt(0).toUpperCase() + org.slice(1);
          btn.textContent = `${label} (${counts[org] || 0})`;
        });
      },

      hookRenderSkills() {
        if (typeof window.renderSkills === 'function' && !window.renderSkills._hc_origin_hooked) {
          const origRender = window.renderSkills;
          const hookedRender = function(skills) {
            let list = Array.isArray(skills) ? skills : [];
            list.forEach(s => {
              if (!s.origin) s.origin = SkillsSection.resolveOrigin(s);
            });
            SkillsSection.originTabs.updateTabCounts(skills);
            const origin = SkillsSection.activeOrigin;
            if (origin && origin !== 'all') {
              list = list.filter(s => SkillsSection.resolveOrigin(s) === origin);
            }
            const res = origRender(list);
            setTimeout(() => {
              SkillsSection.defaultSelection.syncBadges();
              SkillsSection.originTabs.syncOriginBadges();
            }, 10);
            return res;
          };
          hookedRender._hc_origin_hooked = true;
          window.renderSkills = hookedRender;
        }

        // Hook toggleSkill to disallow disabled skills being default
        if (typeof window.toggleSkill === 'function' && !window.toggleSkill._hc_guard_hooked) {
          const origToggle = window.toggleSkill;
          window.toggleSkill = async function(name, currentlyEnabled) {
            const res = await origToggle(name, currentlyEnabled);
            if (currentlyEnabled) {
              // It was enabled and is now being disabled
              let defaults = utils.getDefaultSkills ? utils.getDefaultSkills() : [];
              if (defaults.includes(name)) {
                defaults = defaults.filter(s => s !== name);
                if (utils.setDefaultSkills) utils.setDefaultSkills(defaults);
                if (utils.toast) utils.toast(`Removed disabled skill "${name}" from default skills`, 'warning');
                SkillsSection.defaultSelection.syncUI();
                SkillsSection.defaultSelection.syncBadges();
              }
            }
            return res;
          };
          window.toggleSkill._hc_guard_hooked = true;
        }
      },

      syncOriginBadges() {
        const skillsData = window._skillsData || [];
        const items = document.querySelectorAll('#skillsList .skill-item');
        if (!items.length) return;

        items.forEach(item => {
          const nameEl = item.querySelector('.skill-name');
          if (!nameEl) return;
          const baseName = nameEl.dataset.origName || nameEl.textContent.replace(/\s*★.*$/, '').trim();
          const skillObj = skillsData.find(s => s.name === baseName);
          const origin = SkillsSection.resolveOrigin(skillObj || { name: baseName });

          let originBadge = item.querySelector('.skill-origin-tag');
          if (!originBadge) {
            originBadge = document.createElement('span');
            originBadge.className = 'skill-origin-tag skill-origin-' + origin;
            originBadge.textContent = origin;
            originBadge.title = `Origin: ${origin}`;
            item.appendChild(originBadge);
          } else {
            originBadge.className = 'skill-origin-tag skill-origin-' + origin;
            originBadge.textContent = origin;
            originBadge.title = `Origin: ${origin}`;
          }
        });
      }
    },

    // --------------------------------------------------------------------------
    // 4.A Default Skill Selection (UI: Header & #skillsList)
    // --------------------------------------------------------------------------
    defaultSelection: {
      injectToggle() {
        const actions = document.querySelector('#mainSkills .main-view-header .main-view-actions');
        if (!actions || document.getElementById('skillDefaultToggleWrap')) return;

        const wrap = document.createElement('label');
        wrap.className = 'skill-default-toggle-wrap';
        wrap.id = 'skillDefaultToggleWrap';
        wrap.innerHTML = `
          <input type="checkbox" id="skillDefaultCheckbox">
          <span id="skillDefaultLabel">Default (max 3)</span>
        `;

        const cb = wrap.querySelector('#skillDefaultCheckbox');
        cb.addEventListener('change', () => {
          const titleEl = document.getElementById('skillDetailTitle');
          const activeSkill = window._currentSkillDetail || (titleEl ? titleEl.textContent : '');
          if (!activeSkill) return;

          const skillObj = (window._skillsData || []).find(s => s.name === activeSkill);
          if (skillObj && skillObj.disabled) {
            cb.checked = false;
            if (utils.toast) utils.toast('Disabled skill CANNOT be assigned as default', 'error');
            return;
          }

          let current = utils.getDefaultSkills ? utils.getDefaultSkills() : [];
          if (cb.checked) {
            if (!current.includes(activeSkill)) {
              if (current.length >= 3) {
                if (utils.toast) utils.toast(`Maximum 3 default skills allowed (already: ${current.join(', ')})`, 'error');
                cb.checked = false;
                return;
              }
              current.push(activeSkill);
              if (utils.setDefaultSkills) utils.setDefaultSkills(current);
              if (utils.toast) utils.toast(`Added ${activeSkill} to default skills (${current.length}/3)`, 'success');
            }
          } else {
            current = current.filter(s => s !== activeSkill);
            if (utils.setDefaultSkills) utils.setDefaultSkills(current);
            if (utils.toast) utils.toast(`Removed ${activeSkill} from default skills (${current.length}/3)`);
          }
          this.syncUI();
          this.syncBadges();
        });

        actions.insertBefore(wrap, actions.firstChild);
      },

      syncUI() {
        const wrap = document.getElementById('skillDefaultToggleWrap');
        const cb = document.getElementById('skillDefaultCheckbox');
        const label = document.getElementById('skillDefaultLabel');
        const titleEl = document.getElementById('skillDetailTitle');
        const activeSkill = window._currentSkillDetail || (titleEl ? titleEl.textContent : '');

        if (!wrap || !cb || !label) return;
        const body = document.getElementById('skillDetailBody');
        const isShowing = body && body.style.display !== 'none' && !!activeSkill;
        wrap.style.display = isShowing ? 'inline-flex' : 'none';

        if (isShowing) {
          const skillObj = (window._skillsData || []).find(s => s.name === activeSkill);
          const isDisabled = skillObj ? !!skillObj.disabled : false;
          let defaults = utils.getDefaultSkills ? utils.getDefaultSkills() : [];

          if (isDisabled) {
            // Disabled skills cannot be assigned as default
            if (defaults.includes(activeSkill)) {
              defaults = defaults.filter(s => s !== activeSkill);
              if (utils.setDefaultSkills) utils.setDefaultSkills(defaults);
              if (utils.toast) utils.toast(`Removed disabled skill "${activeSkill}" from default skills`, 'warning');
            }
            cb.checked = false;
            cb.disabled = true;
            wrap.classList.add('disabled-locked');
            wrap.title = 'Disabled skills cannot be assigned as default';
            label.textContent = 'Disabled (cannot set default)';
          } else {
            cb.disabled = false;
            wrap.classList.remove('disabled-locked');
            wrap.title = '';
            const isDef = defaults.includes(activeSkill);
            cb.checked = isDef;
            label.textContent = isDef ? `★ Default (${defaults.length}/3)` : `Default (${defaults.length}/3)`;
          }
        }
      },

      syncBadges() {
        let defaults = utils.getDefaultSkills ? utils.getDefaultSkills() : [];
        const skillsData = window._skillsData || [];
        const items = document.querySelectorAll('#skillsList .skill-item');
        if (!items.length) return;

        items.forEach(item => {
          const nameEl = item.querySelector('.skill-name');
          if (!nameEl) return;
          const baseName = nameEl.dataset.origName || nameEl.textContent.replace(/\s*★.*$/, '').trim();
          nameEl.dataset.origName = baseName;

          const skillObj = skillsData.find(s => s.name === baseName);
          const isDisabled = (skillObj && skillObj.disabled) || item.classList.contains('disabled');

          // If a skill is disabled, make sure it is not in defaults
          if (isDisabled && defaults.includes(baseName)) {
            defaults = defaults.filter(s => s !== baseName);
            if (utils.setDefaultSkills) utils.setDefaultSkills(defaults);
          }

          let star = nameEl.querySelector('.skill-default-star');
          const shouldHaveStar = !isDisabled && defaults.includes(baseName);
          if (shouldHaveStar && !star) {
            star = document.createElement('span');
            star.className = 'skill-default-star';
            star.textContent = ' ★';
            star.title = 'Default skill';
            nameEl.appendChild(star);
          } else if (!shouldHaveStar && star) {
            star.remove();
          }
        });
      }
    },

    // --------------------------------------------------------------------------
    // 4.B Hermes Frontmatter Spec Parser & Card (UI: #skillDetailBody)
    // --------------------------------------------------------------------------
    frontmatterCard: {
      parseYaml(text) {
        const data = { tags: [], platforms: [] };
        if (!text) return data;
        const lines = text.split(/\r?\n/);
        let currentSection = null;
        let currentSubSection = null;

        for (const rawLine of lines) {
          if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
          const indent = rawLine.search(/\S|$/);
          const line = rawLine.trim();

          if (indent === 0) {
            currentSection = null;
            currentSubSection = null;
          }

          if (line.startsWith('- ')) {
            const itemVal = line.substring(2).trim().replace(/^['"]|['"]$/g, '');
            if (currentSection === 'platforms' || currentSubSection === 'platforms') {
              data.platforms.push(itemVal);
            } else if (currentSection === 'tags' || currentSubSection === 'tags') {
              data.tags.push(itemVal);
            } else if (currentSection === 'requires' || currentSubSection === 'requires') {
              if (!data.requires) data.requires = [];
              data.requires.push(itemVal);
            }
            continue;
          }

          const colonIdx = line.indexOf(':');
          if (colonIdx === -1) continue;

          const key = line.substring(0, colonIdx).trim().toLowerCase();
          const val = line.substring(colonIdx + 1).trim();

          if (indent === 0) {
            if (!val) {
              currentSection = key;
            } else {
              currentSection = null;
              data[key] = this.cleanVal(val);
            }
          } else if (indent === 2 && currentSection === 'metadata') {
            if (!val) {
              currentSubSection = key;
            } else {
              data[key] = this.cleanVal(val);
            }
          } else if (indent >= 2) {
            if (key === 'tags') {
              data.tags = this.cleanList(val);
            } else if (key === 'category') {
              data.category = this.cleanVal(val);
            } else if (val) {
              data[key] = this.cleanVal(val);
            }
          }
        }

        if (data.platforms && typeof data.platforms === 'string') {
          data.platforms = this.cleanList(data.platforms);
        }
        if (data.tags && typeof data.tags === 'string') {
          data.tags = this.cleanList(data.tags);
        }
        return data;
      },

      cleanVal(val) {
        if (!val) return '';
        return val.replace(/^['"]|['"]$/g, '').trim();
      },

      cleanList(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        val = val.trim();
        if (val.startsWith('[') && val.endsWith(']')) {
          return val.slice(1, -1).split(',').map(s => this.cleanVal(s)).filter(Boolean);
        }
        return [this.cleanVal(val)];
      },

      enhance() {
        const detailsList = document.querySelectorAll('#skillDetailBody .skill-frontmatter:not(.fm-enhanced)');
        if (!detailsList.length) return;

        detailsList.forEach(details => {
          details.classList.add('fm-enhanced');
          const codeEl = details.querySelector('pre code');
          if (!codeEl) return;
          const rawText = codeEl.textContent.trim();
          const meta = this.parseYaml(rawText);

          const titleEl = document.getElementById('skillDetailTitle');
          const skillName = meta.name || (titleEl ? titleEl.textContent : 'Skill');

          let cardHtml = '<div class="skill-fm-card">';

          // Badges row
          cardHtml += '<div class="skill-fm-badges">';
          if (meta.version) {
            cardHtml += `<span class="skill-fm-badge skill-fm-ver">v${utils.escHtml(meta.version)}</span>`;
          }
          if (meta.license) {
            cardHtml += `<span class="skill-fm-badge skill-fm-lic">${utils.escHtml(meta.license)}</span>`;
          }
          if (meta.category) {
            cardHtml += `<span class="skill-fm-badge skill-fm-cat">${utils.escHtml(meta.category)}</span>`;
          }
          if (meta.author) {
            cardHtml += `<span class="skill-fm-author">by ${utils.escHtml(meta.author)}</span>`;
          }
          cardHtml += '</div>';

          // Argument-hint / usage command pill
          const argHint = meta['argument-hint'] || meta.argument_hint || meta.args;
          if (argHint) {
            cardHtml += `<div class="skill-fm-row"><span class="skill-fm-label">Command:</span><span class="skill-fm-arg">/${utils.escHtml(skillName)} ${utils.escHtml(argHint)}</span></div>`;
          }

          // Platforms
          if (meta.platforms && meta.platforms.length) {
            cardHtml += '<div class="skill-fm-row"><span class="skill-fm-label">Platforms:</span><div style="display:flex;gap:4px;flex-wrap:wrap;">';
            meta.platforms.forEach(p => {
              cardHtml += `<span class="skill-fm-pill">${utils.escHtml(p)}</span>`;
            });
            cardHtml += '</div></div>';
          }

          // Tags
          if (meta.tags && meta.tags.length) {
            cardHtml += '<div class="skill-fm-row"><span class="skill-fm-label">Tags:</span><div style="display:flex;gap:4px;flex-wrap:wrap;">';
            meta.tags.forEach(t => {
              cardHtml += `<span class="skill-fm-tag">#${utils.escHtml(t)}</span>`;
            });
            cardHtml += '</div></div>';
          }

          // Requirements
          if (meta.requires && meta.requires.length) {
            cardHtml += `<div class="skill-fm-row"><span class="skill-fm-label">Requires:</span><span style="font-size:11px;color:var(--muted);">${meta.requires.map(r => utils.escHtml(r)).join(', ')}</span></div>`;
          }

          // Collapsible raw YAML
          cardHtml += `
            <details class="skill-fm-raw">
              <summary>Raw Frontmatter</summary>
              <pre><code>${utils.escHtml(rawText)}</code></pre>
            </details>
          `;

          cardHtml += '</div>';

          details.innerHTML = `
            <summary>
              <span>Metadata &amp; Spec</span>
              <span style="opacity:0.6;font-size:10px;font-weight:normal;">Hermes Format</span>
            </summary>
            ${cardHtml}
          `;
          details.open = true;
        });
      }
    },

    render() {
      this.originTabs.injectTabs();
      this.originTabs.hookRenderSkills();
      this.originTabs.syncOriginBadges();
      this.defaultSelection.injectToggle();
      this.defaultSelection.syncUI();
      this.defaultSelection.syncBadges();
      this.frontmatterCard.enhance();
    }
  };

  if (typeof HC.registerSection === 'function') {
    HC.registerSection('skills', SkillsSection);
  } else {
    HC.sections = HC.sections || {};
    HC.sections.skills = SkillsSection;
  }

})(window.HermesCustom = window.HermesCustom || {});
