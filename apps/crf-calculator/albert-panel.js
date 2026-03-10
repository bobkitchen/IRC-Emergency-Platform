/**
 * Albert Slide-Over Panel — Self-contained vanilla JS module.
 *
 * Drop this + albert-panel.css onto any Classification / CRF page.
 * Auto-detects which site it's on and intercepts Ask Albert nav clicks
 * to toggle a Navigator-style slide-over chat panel.
 *
 * Dependencies: marked.js (loaded dynamically if missing), irc-shared.iife.js
 */
(function () {
  'use strict';

  // ── Site detection ──────────────────────────────────────────────
  var SITE_CONFIGS = {
    classification: {
      site: 'classification',
      xTitle: 'IRC Emergency Classification',
      welcome: 'I can help with classification data, emergency response processes, guidelines, and response tasks across all sectors.',
      examples: [
        'What triggers a reclassification?',
        'What are the 7 response phases?',
        'What tasks happen in the R4 planning phase?',
        'How does the complex emergency rule work?'
      ]
    },
    crf: {
      site: 'crf',
      xTitle: 'IRC CRF Calculator',
      welcome: 'I can help with CRF allocation methodology, funding ceilings, response plan requirements, and emergency classification data.',
      examples: [
        'How is the CRF allocation calculated?',
        'What is the 10% scale target?',
        'What sections are in the CRF response plan?',
        'What are the Orange vs Red funding ceilings?'
      ]
    }
  };

  function detectSite() {
    var path = window.location.pathname;
    if (path.indexOf('crf') !== -1) return 'crf';
    // Check page title or hostname for CRF
    if (document.title.toLowerCase().indexOf('crf') !== -1) return 'crf';
    return 'classification';
  }

  var siteKey = detectSite();
  var SITE = SITE_CONFIGS[siteKey];

  // ── Navigator base URL for RAG data ─────────────────────────────
  var NAVIGATOR_BASE = (function () {
    var h = window.location.hostname;
    if (h === 'bobkitchen.github.io') return '/emergency-response-navigator/';
    if (h === 'localhost' || h === '127.0.0.1') return '/emergency-response-navigator/';
    return 'https://bobkitchen.github.io/emergency-response-navigator/';
  })();

  // ── State ───────────────────────────────────────────────────────
  var state = {
    isOpen: false,
    apiKey: null,
    model: 'google/gemini-2.5-flash',
    messages: [],
    isStreaming: false,
    classifications: [],
    ragChunks: null,
    ragResources: null,
    ragReady: false
  };

  // ── DOM references (set in buildDOM) ────────────────────────────
  var els = {};

  // ── Ensure marked.js is loaded ──────────────────────────────────
  function ensureMarked(cb) {
    if (window.marked) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/marked@12/marked.min.js';
    s.onload = cb;
    s.onerror = function () { console.error('Failed to load marked.js'); cb(); };
    document.head.appendChild(s);
  }

  // ── Build panel DOM ─────────────────────────────────────────────
  function buildDOM() {
    // Overlay (mobile click-to-close)
    var overlay = document.createElement('div');
    overlay.className = 'albert-overlay';
    overlay.addEventListener('click', closePanel);
    document.body.appendChild(overlay);
    els.overlay = overlay;

    // Panel
    var panel = document.createElement('div');
    panel.className = 'albert-panel';
    panel.innerHTML = buildPanelHTML();
    document.body.appendChild(panel);
    els.panel = panel;

    // Cache inner elements
    els.headerLeft = panel.querySelector('.albert-panel-header-left');
    els.headerTitle = panel.querySelector('.albert-panel-header-title');
    els.headerDesc = panel.querySelector('.albert-panel-header-desc');
    els.clearBtn = panel.querySelector('#ap-clear-btn');
    els.closeBtn = panel.querySelector('#ap-close-btn');
    els.messages = panel.querySelector('.albert-panel-messages');
    els.apiWarning = panel.querySelector('#ap-api-warning');
    els.examplesWrap = panel.querySelector('#ap-examples-wrap');
    els.ragStatus = panel.querySelector('#ap-rag-status');
    els.streamingIndicator = panel.querySelector('#ap-streaming');
    els.scrollAnchor = panel.querySelector('#ap-scroll-anchor');
    els.textarea = panel.querySelector('#ap-textarea');
    els.sendBtn = panel.querySelector('#ap-send-btn');

    // Settings modal
    var settingsOverlay = document.createElement('div');
    settingsOverlay.className = 'albert-panel-settings-overlay';
    settingsOverlay.innerHTML = buildSettingsHTML();
    document.body.appendChild(settingsOverlay);
    els.settingsOverlay = settingsOverlay;
    els.settingsKeyInput = settingsOverlay.querySelector('#ap-settings-key');
    els.settingsModelSelect = settingsOverlay.querySelector('#ap-settings-model');

    bindEvents();
  }

  function buildPanelHTML() {
    var avatarSrc = getAlbertAvatarSrc();
    return (
      '<div class="albert-panel-header">' +
        '<div class="albert-panel-header-left">' +
          '<img src="' + avatarSrc + '" alt="Albert" class="albert-panel-avatar-lg" id="ap-avatar">' +
          '<div class="albert-panel-header-info">' +
            '<h3 class="albert-panel-header-title large">Ask Albert</h3>' +
            '<p class="albert-panel-header-desc">Your AI-powered guide to IRC\'s emergency response tools, templates, and ways of working. Albert knows it all.</p>' +
          '</div>' +
        '</div>' +
        '<div class="albert-panel-header-actions">' +
          '<button id="ap-clear-btn" title="Clear chat" style="display:none;">' +
            '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>' +
          '</button>' +
          '<button id="ap-close-btn" title="Close">' +
            '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +

      '<div class="albert-panel-messages">' +
        '<div id="ap-api-warning" class="albert-panel-api-warning" style="display:none;">' +
          '<strong>API Key Required</strong>' +
          '<p>Set your OpenRouter API key in <button id="ap-open-settings-inline">Settings</button> to use Ask Albert. Free models available.</p>' +
        '</div>' +
        '<div id="ap-examples-wrap">' +
          '<p class="albert-panel-examples-label">Try asking</p>' +
          '<div class="albert-panel-examples" id="ap-examples"></div>' +
        '</div>' +
        '<div id="ap-rag-status" class="albert-panel-rag-status loading">Loading knowledge base...</div>' +
        '<div id="ap-streaming" class="albert-panel-streaming" style="display:none;">' +
          '<div class="albert-panel-dots"><span class="albert-panel-dot"></span><span class="albert-panel-dot"></span><span class="albert-panel-dot"></span></div>' +
        '</div>' +
        '<div id="ap-scroll-anchor"></div>' +
      '</div>' +

      '<div class="albert-panel-input">' +
        '<div class="albert-panel-input-row">' +
          '<textarea id="ap-textarea" class="albert-panel-textarea" placeholder="Ask about emergency response..." rows="1"></textarea>' +
          '<button id="ap-send-btn" class="albert-panel-send-btn" aria-label="Send">' +
            '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function buildSettingsHTML() {
    return (
      '<div class="albert-panel-settings-box">' +
        '<h3>Albert Settings</h3>' +
        '<div class="albert-panel-settings-field">' +
          '<label for="ap-settings-key">OpenRouter API Key</label>' +
          '<input type="password" id="ap-settings-key" placeholder="sk-or-v1-..." autocomplete="off">' +
          '<div class="albert-panel-settings-help">' +
            'Get a free key at <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>' +
          '</div>' +
        '</div>' +
        '<div class="albert-panel-settings-field">' +
          '<label for="ap-settings-model">AI Model</label>' +
          '<select id="ap-settings-model">' +
            '<option value="google/gemini-2.5-flash">Google Gemini 2.5 Flash</option>' +
            '<option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B Instruct</option>' +
            '<option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B Instruct</option>' +
          '</select>' +
        '</div>' +
        '<button class="albert-panel-clear-btn" id="ap-settings-clear">Clear conversation</button>' +
        '<div class="albert-panel-settings-btns">' +
          '<button class="ap-btn-cancel" id="ap-settings-cancel">Cancel</button>' +
          '<button class="ap-btn-save" id="ap-settings-save">Save</button>' +
        '</div>' +
      '</div>'
    );
  }

  function getAlbertAvatarSrc() {
    // Both sites have albert.png in their root
    return 'albert.png';
  }

  // ── Event binding ───────────────────────────────────────────────
  function bindEvents() {
    // Close panel
    els.closeBtn.addEventListener('click', closePanel);

    // Clear chat
    els.clearBtn.addEventListener('click', clearChat);

    // Send message
    els.sendBtn.addEventListener('click', sendMessage);
    els.textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    els.textarea.addEventListener('input', autoResize);

    // Example chips
    var examplesContainer = els.panel.querySelector('#ap-examples');
    SITE.examples.forEach(function (text) {
      var btn = document.createElement('button');
      btn.className = 'albert-panel-example-btn';
      btn.textContent = text;
      btn.addEventListener('click', function () {
        els.textarea.value = text;
        els.textarea.focus();
        autoResize();
        sendMessage();
      });
      examplesContainer.appendChild(btn);
    });

    // Inline settings open
    var inlineSettingsBtn = els.panel.querySelector('#ap-open-settings-inline');
    if (inlineSettingsBtn) {
      inlineSettingsBtn.addEventListener('click', openSettings);
    }

    // Settings modal
    els.settingsOverlay.querySelector('#ap-settings-cancel').addEventListener('click', closeSettings);
    els.settingsOverlay.querySelector('#ap-settings-save').addEventListener('click', saveSettings);
    els.settingsOverlay.querySelector('#ap-settings-clear').addEventListener('click', function () {
      clearChat();
      closeSettings();
    });
    els.settingsOverlay.addEventListener('click', function (e) {
      if (e.target === els.settingsOverlay) closeSettings();
    });

    // Intercept Ask Albert nav buttons
    interceptAskAlbertLinks();

    // Escape key to close
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (els.settingsOverlay.classList.contains('visible')) {
          closeSettings();
        } else if (state.isOpen) {
          closePanel();
        }
      }
    });
  }

  function interceptAskAlbertLinks() {
    // Intercept all Ask Albert nav links (current and future via event delegation)
    document.addEventListener('click', function (e) {
      var link = e.target.closest('.ask-albert-btn');
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });
  }

  // ── Panel open/close ────────────────────────────────────────────
  function togglePanel() {
    if (state.isOpen) closePanel(); else openPanel();
  }

  function openPanel() {
    state.isOpen = true;
    els.panel.classList.add('open');
    els.overlay.classList.add('visible');
    updateHeaderState();
    els.textarea.focus();
    // Disable body scroll on mobile
    if (window.innerWidth <= 640) {
      document.body.style.overflow = 'hidden';
    }
  }

  function closePanel() {
    state.isOpen = false;
    els.panel.classList.remove('open');
    els.overlay.classList.remove('visible');
    updateHeaderState();
    document.body.style.overflow = '';
  }

  function updateHeaderState() {
    // Toggle active class on Ask Albert buttons
    var btns = document.querySelectorAll('.ask-albert-btn');
    btns.forEach(function (btn) {
      if (state.isOpen) {
        btn.classList.add('albert-active');
      } else {
        btn.classList.remove('albert-active');
      }
    });
  }

  // ── Header appearance (compact when messages exist) ─────────────
  function updateHeaderAppearance() {
    var hasMessages = state.messages.length > 0;
    var avatar = els.panel.querySelector('#ap-avatar');

    if (hasMessages) {
      avatar.className = 'albert-panel-avatar-sm';
      els.headerTitle.className = 'albert-panel-header-title small';
      els.headerDesc.textContent = 'Your IRC emergency response guide';
      els.clearBtn.style.display = '';
      els.examplesWrap.style.display = 'none';
    } else {
      avatar.className = 'albert-panel-avatar-lg';
      els.headerTitle.className = 'albert-panel-header-title large';
      els.headerDesc.textContent = "Your AI-powered guide to IRC's emergency response tools, templates, and ways of working. Albert knows it all.";
      els.clearBtn.style.display = 'none';
      els.examplesWrap.style.display = '';
    }
  }

  // ── Chat operations ─────────────────────────────────────────────
  function sendMessage() {
    var text = els.textarea.value.trim();
    if (!text || state.isStreaming) return;
    if (!state.apiKey) { openSettings(); return; }

    // Hide welcome, show chat
    els.examplesWrap.style.display = 'none';
    if (els.ragStatus) els.ragStatus.style.display = 'none';

    // User message
    var userMsgId = 'ap-' + Date.now() + '-u';
    state.messages.push({ id: userMsgId, role: 'user', content: text });
    appendMessage(userMsgId, 'user', text);

    // Clear input
    els.textarea.value = '';
    els.textarea.style.height = 'auto';
    scrollToBottom();
    updateHeaderAppearance();

    // Stream response
    state.isStreaming = true;
    updateInputState();
    streamAlbertResponse(text);
  }

  function appendMessage(id, role, content) {
    var div = document.createElement('div');
    div.className = 'albert-panel-msg ' + role;
    div.id = 'apmsg-' + id;

    if (role === 'user') {
      div.innerHTML = '<div class="albert-panel-msg-bubble">' + escapeHtml(content) + '</div>';
    } else {
      var html = window.marked ? marked.parse(content) : escapeHtml(content);
      div.innerHTML =
        '<div class="albert-panel-msg-inner">' +
          '<img src="' + getAlbertAvatarSrc() + '" alt="Albert" class="albert-panel-msg-avatar" onerror="this.style.display=\'none\'">' +
          '<div class="albert-panel-msg-bubble"><div class="ap-md">' + html + '</div></div>' +
        '</div>';
    }

    // Insert before streaming indicator and scroll anchor
    els.messages.insertBefore(div, els.streamingIndicator);
  }

  function clearChat() {
    state.messages = [];
    // Remove all message elements
    var msgs = els.messages.querySelectorAll('.albert-panel-msg');
    msgs.forEach(function (m) { m.remove(); });
    localStorage.removeItem('irc_albert_chat_' + SITE.site);
    updateHeaderAppearance();
  }

  function scrollToBottom() {
    setTimeout(function () {
      els.scrollAnchor.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  }

  function updateInputState() {
    var hasKey = !!state.apiKey;
    els.textarea.disabled = !hasKey || state.isStreaming;
    els.sendBtn.disabled = !hasKey || state.isStreaming;
    els.textarea.placeholder = hasKey ? 'Ask about emergency response...' : 'Set API key first...';
    els.apiWarning.style.display = hasKey ? 'none' : '';
    els.streamingIndicator.style.display = state.isStreaming ? '' : 'none';

    // Disable example buttons if no key
    var exBtns = els.panel.querySelectorAll('.albert-panel-example-btn');
    exBtns.forEach(function (b) { b.disabled = !hasKey; });
  }

  function autoResize() {
    els.textarea.style.height = 'auto';
    els.textarea.style.height = Math.min(els.textarea.scrollHeight, 120) + 'px';
  }

  // ── Streaming API call ──────────────────────────────────────────
  async function streamAlbertResponse(userMessage) {
    els.streamingIndicator.style.display = '';
    scrollToBottom();

    try {
      var systemPrompt = buildSystemPrompt(userMessage);
      var conversationMessages = state.messages.map(function (m) {
        return { role: m.role === 'albert' ? 'assistant' : m.role, content: m.content };
      });

      var response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + state.apiKey,
          'HTTP-Referer': window.location.href,
          'X-Title': SITE.xTitle
        },
        body: JSON.stringify({
          model: state.model,
          messages: [{ role: 'system', content: systemPrompt }]
            .concat(conversationMessages)
            .concat([{ role: 'user', content: userMessage }]),
          temperature: 0.3,
          max_tokens: 2000,
          stream: true
        })
      });

      if (!response.ok) {
        var errText = await response.text();
        var errMsg;
        try {
          var errData = JSON.parse(errText);
          errMsg = errData.error?.message || 'API error (' + response.status + ')';
        } catch (_) {
          errMsg = 'API error (' + response.status + ')';
        }
        throw new Error(errMsg);
      }

      // Create Albert message element for streaming
      var albertMsgId = 'ap-' + Date.now() + '-a';
      var div = document.createElement('div');
      div.className = 'albert-panel-msg albert';
      div.id = 'apmsg-' + albertMsgId;
      div.innerHTML =
        '<div class="albert-panel-msg-inner">' +
          '<img src="' + getAlbertAvatarSrc() + '" alt="Albert" class="albert-panel-msg-avatar" onerror="this.style.display=\'none\'">' +
          '<div class="albert-panel-msg-bubble"><div class="ap-md" id="ap-stream-' + albertMsgId + '"></div></div>' +
        '</div>';
      els.messages.insertBefore(div, els.streamingIndicator);

      var contentEl = document.getElementById('ap-stream-' + albertMsgId);
      var fullContent = '';
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      while (true) {
        var result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line.startsWith('data: ')) continue;
          var data = line.substring(6);
          if (data === '[DONE]') break;

          try {
            var parsed = JSON.parse(data);
            var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
            if (delta && delta.content) {
              fullContent += delta.content;
              if (window.marked) {
                contentEl.innerHTML = marked.parse(fullContent);
              } else {
                contentEl.textContent = fullContent;
              }
              scrollToBottom();
            }
          } catch (_e) { /* skip unparseable */ }
        }
      }

      state.messages.push({ id: albertMsgId, role: 'albert', content: fullContent });
      saveChatHistory();

    } catch (error) {
      var errorDetail = (error && error.message) ? error.message : String(error);
      var errorMsg;
      if (errorDetail === 'Type error' || errorDetail === 'Failed to fetch') {
        errorMsg = 'Unable to reach the AI service. Check your API key or try again in a moment.';
      } else {
        errorMsg = 'Error: ' + errorDetail;
      }
      var errId = 'ap-' + Date.now() + '-err';
      state.messages.push({ id: errId, role: 'albert', content: errorMsg });
      appendMessage(errId, 'albert', errorMsg);
    } finally {
      state.isStreaming = false;
      els.streamingIndicator.style.display = 'none';
      updateInputState();
      updateHeaderAppearance();
      scrollToBottom();
    }
  }

  // ── RAG engine ──────────────────────────────────────────────────
  function loadRAGData() {
    var chunksP = fetch(NAVIGATOR_BASE + 'search-chunks.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { state.ragChunks = d; })
      .catch(function () {});

    var resP = fetch(NAVIGATOR_BASE + 'resource-index.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { state.ragResources = d; })
      .catch(function () {});

    Promise.all([chunksP, resP]).then(function () {
      state.ragReady = !!(state.ragChunks || state.ragResources);
      if (els.ragStatus) {
        if (state.ragChunks && state.ragResources) {
          els.ragStatus.textContent = 'Knowledge base loaded (' + state.ragChunks.length + ' chunks, ' + state.ragResources.length + ' resources)';
          els.ragStatus.className = 'albert-panel-rag-status ready';
        } else if (state.ragChunks || state.ragResources) {
          els.ragStatus.textContent = 'Knowledge base partially loaded';
          els.ragStatus.className = 'albert-panel-rag-status ready';
        } else {
          els.ragStatus.textContent = 'Knowledge base unavailable';
          els.ragStatus.className = 'albert-panel-rag-status error';
        }
        setTimeout(function () { els.ragStatus.style.display = 'none'; }, 5000);
      }
    });
  }

  function searchRAG(query, limit) {
    limit = limit || 8;
    if (!state.ragChunks) return [];
    var terms = query.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 2; });
    if (terms.length === 0) return [];

    var scored = [];
    for (var i = 0; i < state.ragChunks.length; i++) {
      var chunk = state.ragChunks[i];
      var text = (chunk.title + ' ' + chunk.content).toLowerCase();
      var score = 0;
      for (var t = 0; t < terms.length; t++) {
        var idx = 0;
        while ((idx = text.indexOf(terms[t], idx)) !== -1) { score++; idx += terms[t].length; }
        if (chunk.title && chunk.title.toLowerCase().indexOf(terms[t]) !== -1) score += 3;
      }
      if (score > 0) scored.push({ chunk: chunk, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, limit).map(function (s) { return s.chunk; });
  }

  function searchResources(query, limit) {
    limit = limit || 8;
    if (!state.ragResources) return [];
    var terms = query.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 2; });
    if (terms.length === 0) return [];

    var scored = [];
    for (var i = 0; i < state.ragResources.length; i++) {
      var res = state.ragResources[i];
      var text = ((res.name || '') + ' ' + (res.sector || '') + ' ' + (res.task || '')).toLowerCase();
      var score = 0;
      for (var t = 0; t < terms.length; t++) {
        if (text.indexOf(terms[t]) !== -1) score++;
      }
      if (score > 0) scored.push({ resource: res, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, limit).map(function (s) { return s.resource; });
  }

  // ── Classification data ─────────────────────────────────────────
  function loadClassifications() {
    if (window.IRCShared && window.IRCShared.fetchClassifications) {
      IRCShared.fetchClassifications().then(function (data) {
        if (data && data.length > 0) state.classifications = data;
      }).catch(function () {});
    }
  }

  function buildClassificationSummary() {
    var cls = state.classifications;
    if (!cls || cls.length === 0) return '';
    var stances = {};
    for (var i = 0; i < cls.length; i++) {
      var s = (cls[i].stance || 'unknown').toLowerCase();
      stances[s] = (stances[s] || 0) + 1;
    }
    var parts = ['LIVE CLASSIFICATION DATA (' + cls.length + ' records):'];
    var keys = Object.keys(stances).sort(function (a, b) { return stances[b] - stances[a]; });
    for (var k = 0; k < keys.length; k++) {
      parts.push('- ' + keys[k] + ': ' + stances[keys[k]]);
    }
    return parts.join('\n');
  }

  // ── System prompt ───────────────────────────────────────────────
  function buildSystemPrompt(userQuery) {
    var ragContext = '';
    if (state.ragReady && userQuery) {
      var chunks = searchRAG(userQuery, 8);
      if (chunks.length > 0) {
        ragContext += '\n\n## Relevant Tasks & Guidelines (from IRC Emergency Management Guidelines)\n';
        for (var i = 0; i < chunks.length; i++) {
          var c = chunks[i];
          ragContext += '\n### ' + (c.title || c.id) + ' [' + (c.type || '') + ']\n' + c.content + '\n';
        }
      }
      var resources = searchResources(userQuery, 8);
      if (resources.length > 0) {
        ragContext += '\n\n## Relevant Resources & Templates\n';
        for (var r = 0; r < resources.length; r++) {
          var res = resources[r];
          ragContext += '- **' + res.name + '** (' + (res.sector || '') + ') \u2014 ' + (res.task || '') + (res.url ? ' [Link](' + res.url + ')' : '') + '\n';
        }
      }
    }

    var classContext = buildClassificationSummary();

    var focusPriority = '';
    if (SITE.site === 'crf') {
      focusPriority =
        '## Your Focus Priority\n' +
        'You are embedded in the CRF Allocation Calculator. Prioritize questions about:\n' +
        '- CRF allocation ceilings ($1M Orange, $2M Red), the $47.34 per-client cost\n' +
        '- CRF request process, response plan requirements (Sections A-G)\n' +
        '- 14-day deadline for logframe + budget submission\n' +
        '- 10% scale target, affected population, and allocation methodology\n' +
        '- Early Action funding ($100K per region earmarked in CRF)\n' +
        "For detailed classification data charts or trends, suggest the Classification app's Ask Albert.";
    } else {
      focusPriority =
        '## Your Focus Priority\n' +
        'You are embedded in the Emergency Classification System. Prioritize questions about:\n' +
        '- Classification data, severity ratings, stance lookups\n' +
        '- Trends across countries, regions, crisis types\n' +
        '- Reclassification rules and expiration\n' +
        '- Complex emergency escalation rules (3 Yellows -> Orange, 2 Oranges -> Red)\n' +
        "For CRF allocation details, suggest the CRF Calculator's Ask Albert.";
    }

    return (
      "You are Albert, the IRC Emergency Response AI Assistant. You have deep knowledge of IRC's Emergency Management Guidelines, the Classification System, CRF funding processes, and the complete emergency response lifecycle.\n\n" +
      'CORE KNOWLEDGE:\n' +
      '- Classification stances: White (Outside Mission Scope), Yellow (Monitor & Prepare), Orange (Mobilize), Red (Maximum Response)\n' +
      '- Severity scale: 0-10. Each classification open 6 weeks (42 days)\n' +
      '- Complex emergency rules: 3 Yellows -> Orange, 2 Oranges -> Red\n' +
      '- Response Imperative: respond to all Orange and Red classifications, 10% scale target\n' +
      '- 7 Response Phases: R1 Emergency Onset, R2 Context Analysis, R3 Strategy Development, R4 Response Planning, R5 Implementation, R6 Learnings, R7 Transition & Handover\n' +
      '- 13 Functional Sectors: Response Management, Finance, People & Culture, Supply Chain, Safety & Security, Safeguarding, Technical Programs, MEAL, Grants, Partnerships, Integra Launch\n' +
      '- Emergency Unit Services: classification, escalation, deployment, surge support\n' +
      '- CRF (Crisis Response Fund): $1M ceiling for Orange, $2M for Red emergencies, $47.34 per-client cost, 14-day deadline for logframe + budget, 10% scale target, Early Action $100K/region\n' +
      '- CRF Response Plan sections: A (Crisis Context), B (IRC Context), C (Response Strategy), D (10% Scale Target), E (Staffing), F (Partnerships), G (Budget)\n\n' +
      focusPriority + '\n\n' +
      '## Guidelines\n' +
      '- Be direct and actionable. Use markdown formatting.\n' +
      '- When referencing specific tasks, cite the task ID (e.g., RMIE-001) and sector.\n' +
      '- When referencing resources, include links if available.\n' +
      "- If the user asks about topics outside your focus, still answer helpfully but suggest the more relevant app.\n" +
      '- Keep responses concise but thorough. Use bullet points and headers for clarity.\n' +
      (ragContext ? '\n\n## CONTEXT FROM IRC KNOWLEDGE BASE\nUse the following retrieved context to inform your answers. Cite specific tasks and resources when relevant.' + ragContext : '') +
      (classContext ? '\n\n' + classContext : '')
    );
  }

  // ── Chat persistence ────────────────────────────────────────────
  function saveChatHistory() {
    try {
      var saveable = state.messages.map(function (m) {
        return { id: m.id, role: m.role, content: m.content };
      });
      localStorage.setItem('irc_albert_chat_' + SITE.site, JSON.stringify(saveable));
    } catch (_) {}
  }

  function restoreChatHistory() {
    try {
      var saved = localStorage.getItem('irc_albert_chat_' + SITE.site);
      if (!saved) return;
      var messages = JSON.parse(saved);
      if (!messages || messages.length === 0) return;

      for (var i = 0; i < messages.length; i++) {
        state.messages.push(messages[i]);
        appendMessage(messages[i].id, messages[i].role === 'albert' ? 'albert' : 'user', messages[i].content);
      }
      updateHeaderAppearance();
    } catch (_) {}
  }

  // ── Settings ────────────────────────────────────────────────────
  function openSettings() {
    els.settingsKeyInput.value = state.apiKey || '';
    els.settingsModelSelect.value = state.model;
    els.settingsOverlay.classList.add('visible');
  }

  function closeSettings() {
    els.settingsOverlay.classList.remove('visible');
  }

  function saveSettings() {
    var newKey = els.settingsKeyInput.value.trim();
    var newModel = els.settingsModelSelect.value;
    if (newKey) {
      state.apiKey = newKey;
      localStorage.setItem('irc_openrouter_api_key', newKey);
    }
    if (newModel) {
      state.model = newModel;
      localStorage.setItem('irc_openrouter_model', newModel);
      localStorage.setItem('irc_albert_model', newModel); // legacy compat
    }
    closeSettings();
    updateInputState();
  }

  // ── Utilities ───────────────────────────────────────────────────
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Initialization ──────────────────────────────────────────────
  function init() {
    // Load saved API key
    state.apiKey = localStorage.getItem('irc_openrouter_api_key') || localStorage.getItem('irc_openrouter_key') || null;
    var savedModel = localStorage.getItem('irc_openrouter_model') || localStorage.getItem('irc_albert_model');
    if (savedModel) state.model = savedModel;

    ensureMarked(function () {
      buildDOM();
      updateInputState();
      updateHeaderAppearance();
      restoreChatHistory();
      loadRAGData();
      loadClassifications();

      // Auto-open if URL has #albert hash (for redirects from ask-albert.html)
      if (window.location.hash === '#albert') {
        openPanel();
      }
    });
  }

  // Auto-initialize on DOM ready (use setTimeout to ensure page scripts run first)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 0);
    });
  } else {
    setTimeout(init, 0);
  }
})();
