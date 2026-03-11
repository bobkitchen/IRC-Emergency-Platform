/**
 * Albert Slide-Over Panel — Self-contained vanilla JS module.
 *
 * Drop this + albert-panel.css onto any Classification / CRF page.
 * Auto-detects which site it's on and uses Supabase Edge Functions
 * for RAG search and chat — no API key required.
 *
 * Dependencies: marked.js (loaded dynamically if missing)
 */
(function () {
  'use strict';

  // ── Edge Function URL ─────────────────────────────────────────────
  var SUPABASE_FUNCTION_URL = 'https://qykjjfbdvwqxqmsgiebs.supabase.co/functions/v1';

  // ── Site detection ──────────────────────────────────────────────
  var STATIC_EXAMPLES = {
    classification: [
      'What triggers a reclassification?',
      'What are the 7 response phases?',
      'What tasks happen in the R4 planning phase?',
      'How does the complex emergency rule work?'
    ],
    crf: [
      'How is the CRF allocation calculated?',
      'What is the 10% scale target?',
      'What sections are in the CRF response plan?',
      'What are the Orange vs Red funding ceilings?'
    ]
  };

  var SITE_CONFIGS = {
    classification: {
      site: 'classification',
      xTitle: 'IRC Emergency Classification',
      welcome: 'I can help with classification data, emergency response processes, guidelines, and response tasks across all sectors.',
      examples: STATIC_EXAMPLES.classification.slice()
    },
    crf: {
      site: 'crf',
      xTitle: 'IRC CRF Calculator',
      welcome: 'I can help with CRF allocation methodology, funding ceilings, response plan requirements, and emergency classification data.',
      examples: STATIC_EXAMPLES.crf.slice()
    }
  };

  /**
   * Generate dynamic example queries from live classification data.
   * Looks for IRC.db.data (array of classification objects).
   * Returns an array of dynamic queries, or empty if no data is available.
   */
  function generateDynamicExamples(siteKey) {
    var data = window.IRC && window.IRC.db && window.IRC.db.data;
    if (!data || !Array.isArray(data) || data.length === 0) return [];

    var now = new Date();
    // Filter to active, non-expired, high-severity classifications
    var active = data.filter(function (c) {
      if (!c.country || !c.stance) return false;
      var stance = c.stance.toLowerCase();
      if (stance !== 'red' && stance !== 'orange') return false;
      if (c.expirationDate && new Date(c.expirationDate) < now) return false;
      return true;
    });

    if (active.length === 0) return [];

    // Sort by severity (red first), then by most recent date
    active.sort(function (a, b) {
      var stanceRank = { red: 2, orange: 1 };
      var rankA = stanceRank[a.stance.toLowerCase()] || 0;
      var rankB = stanceRank[b.stance.toLowerCase()] || 0;
      if (rankB !== rankA) return rankB - rankA;
      return new Date(b.date || 0) - new Date(a.date || 0);
    });

    var dynamic = [];
    var seen = {};

    for (var i = 0; i < active.length && dynamic.length < 2; i++) {
      var c = active[i];
      var key = c.country.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;

      var stanceLabel = c.stance.charAt(0).toUpperCase() + c.stance.slice(1).toLowerCase();

      if (siteKey === 'crf') {
        dynamic.push("What's the CRF ceiling for " + c.country + "'s " + stanceLabel + " emergency?");
      } else {
        if (dynamic.length === 0) {
          dynamic.push('Tell me about the ' + c.country + ' ' + stanceLabel + ' classification');
        } else {
          dynamic.push('How many ' + stanceLabel + ' emergencies are active right now?');
        }
      }
    }

    return dynamic;
  }

  /**
   * Refresh the example chips in the panel with dynamic data if available.
   * Called after initialization and after a delay to allow IRC.db.data to load.
   */
  function refreshExamplesIfNeeded(siteKey) {
    var dynamic = generateDynamicExamples(siteKey);
    if (dynamic.length === 0) return;

    var staticFallbacks = STATIC_EXAMPLES[siteKey] || [];
    // Combine: dynamic examples first, then fill with static up to 4 total
    var combined = dynamic.concat(staticFallbacks).slice(0, 4);
    SITE.examples = combined;

    // Re-render example chips if the panel has been built
    var examplesContainer = document.getElementById('ap-examples');
    if (!examplesContainer) return;
    examplesContainer.innerHTML = '';

    combined.forEach(function (text) {
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
  }

  function detectSite() {
    var path = window.location.pathname;
    if (path.indexOf('crf') !== -1) return 'crf';
    if (document.title.toLowerCase().indexOf('crf') !== -1) return 'crf';
    return 'classification';
  }

  var siteKey = detectSite();
  var SITE = SITE_CONFIGS[siteKey];

  // ── State ───────────────────────────────────────────────────────
  var state = {
    isOpen: false,
    model: 'google/gemini-2.5-flash',
    messages: [],
    isStreaming: false
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
    els.examplesWrap = panel.querySelector('#ap-examples-wrap');
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
        '<div id="ap-examples-wrap">' +
          '<p class="albert-panel-examples-label">Try asking</p>' +
          '<div class="albert-panel-examples" id="ap-examples"></div>' +
        '</div>' +
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
        '<p style="font-size:12px;color:#16a34a;background:#f0fdf4;padding:8px 12px;border-radius:6px;margin-bottom:12px;">Albert is ready to use — no API key needed.</p>' +
        '<div class="albert-panel-settings-field">' +
          '<label for="ap-settings-model">AI Model</label>' +
          '<select id="ap-settings-model">' +
            '<option value="google/gemini-2.5-flash">Google Gemini 2.5 Flash</option>' +
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
    return 'albert.png';
  }

  // ── Event binding ───────────────────────────────────────────────
  function bindEvents() {
    els.closeBtn.addEventListener('click', closePanel);
    els.clearBtn.addEventListener('click', clearChat);
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

    // Hide welcome, show chat
    els.examplesWrap.style.display = 'none';

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

    els.messages.insertBefore(div, els.streamingIndicator);
  }

  function clearChat() {
    state.messages = [];
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
    els.textarea.disabled = state.isStreaming;
    els.sendBtn.disabled = state.isStreaming;
    els.textarea.placeholder = 'Ask about emergency response...';
    els.streamingIndicator.style.display = state.isStreaming ? '' : 'none';
  }

  function autoResize() {
    els.textarea.style.height = 'auto';
    els.textarea.style.height = Math.min(els.textarea.scrollHeight, 120) + 'px';
  }

  // ── Streaming via Edge Function ──────────────────────────────────
  async function streamAlbertResponse(userMessage) {
    els.streamingIndicator.style.display = '';
    scrollToBottom();

    try {
      // Build conversation history for the Edge Function
      var conversationMessages = state.messages.map(function (m) {
        return { role: m.role === 'albert' ? 'assistant' : m.role, content: m.content };
      });

      var response = await fetch(SUPABASE_FUNCTION_URL + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationMessages,
          site: SITE.site,
          model: state.model
        })
      });

      if (!response.ok) {
        var errText = await response.text();
        var errMsg;
        try {
          var errData = JSON.parse(errText);
          errMsg = errData.error || 'Service error (' + response.status + ')';
        } catch (_) {
          errMsg = 'Service error (' + response.status + ')';
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
        errorMsg = 'Unable to reach the AI service. Please try again in a moment.';
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
    els.settingsModelSelect.value = state.model;
    els.settingsOverlay.classList.add('visible');
  }

  function closeSettings() {
    els.settingsOverlay.classList.remove('visible');
  }

  function saveSettings() {
    var newModel = els.settingsModelSelect.value;
    if (newModel) {
      state.model = newModel;
      localStorage.setItem('irc_openrouter_model', newModel);
    }
    closeSettings();
  }

  // ── Utilities ───────────────────────────────────────────────────
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Initialization ──────────────────────────────────────────────
  function init() {
    var savedModel = localStorage.getItem('irc_openrouter_model');
    if (savedModel) state.model = savedModel;

    ensureMarked(function () {
      buildDOM();
      updateInputState();
      updateHeaderAppearance();
      restoreChatHistory();

      // Try to generate dynamic examples immediately
      refreshExamplesIfNeeded(siteKey);
      // Retry after a delay in case IRC.db.data loads asynchronously
      setTimeout(function () { refreshExamplesIfNeeded(siteKey); }, 1500);
      setTimeout(function () { refreshExamplesIfNeeded(siteKey); }, 4000);

      // Auto-open if URL has #albert hash
      if (window.location.hash === '#albert') {
        openPanel();
      }
    });
  }

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 0);
    });
  } else {
    setTimeout(init, 0);
  }
})();
