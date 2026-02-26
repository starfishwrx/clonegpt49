(function () {
  const state = {
    sessions: [],
    activeId: "",
    sending: false,
    models: [],
    selectedProvider: "gemini",
    selectedModel: "gemini-2.5-flash",
  };

  const KEY = "chat_ui_sessions_v3";

  const historyList = document.getElementById("historyList");
  const messagesEl = document.getElementById("messages");
  const messageInput = document.getElementById("messageInput");
  const apiInput = document.getElementById("apiInput");
  const chatForm = document.getElementById("chatForm");
  const sendBtn = document.getElementById("sendBtn");
  const statusText = document.getElementById("statusText");
  const msgTpl = document.getElementById("msgTpl");
  const newChatBtn = document.getElementById("newChatBtn");
  const sidebar = document.getElementById("sidebar");
  const openSidebarBtn = document.getElementById("openSidebarBtn");
  const closeSidebarBtn = document.getElementById("closeSidebarBtn");

  const modelPicker = document.getElementById("modelPicker");
  const modelPickerBtn = document.getElementById("modelPickerBtn");
  const modelPickerText = document.getElementById("modelPickerText");
  const modelMenu = document.getElementById("modelMenu");
  const modelOptions = document.getElementById("modelOptions");

  function uid() {
    return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function getSession() {
    return state.sessions.find((s) => s.id === state.activeId) || null;
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(state.sessions));
  }

  function titleFromText(text) {
    return (text || "").replace(/\s+/g, " ").trim().slice(0, 22) || "新对话";
  }

  function loadSessions() {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : [];
      state.sessions = Array.isArray(data) ? data : [];
    } catch (_) {
      state.sessions = [];
    }

    if (!state.sessions.length) {
      createSession();
      return;
    }
    state.activeId = state.sessions[0].id;
    renderAll();
  }

  function createSession() {
    const session = {
      id: uid(),
      title: "新对话",
      messages: [],
      createdAt: Date.now(),
    };
    state.sessions.unshift(session);
    state.activeId = session.id;
    persist();
    renderAll();
  }

  function setStatus(text) {
    statusText.textContent = text;
  }

  function autoResize() {
    messageInput.style.height = "auto";
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 220)}px`;
  }

  function appendMessage(role, content) {
    const session = getSession();
    if (!session) return;
    session.messages.push({ role, content, at: Date.now() });
    if (role === "user" && session.title === "新对话") {
      session.title = titleFromText(content);
    }
    persist();
    renderAll();
  }

  function updateLastAssistantMessage(content) {
    const session = getSession();
    if (!session || !session.messages.length) return;
    const last = session.messages[session.messages.length - 1];
    if (last.role === "assistant") {
      last.content = content;
      persist();
      renderMessages();
    }
  }

  function renderHistory() {
    historyList.innerHTML = "";
    state.sessions.forEach((s) => {
      const btn = document.createElement("button");
      btn.className = `history-item${s.id === state.activeId ? " active" : ""}`;
      btn.textContent = s.title || "新对话";
      btn.addEventListener("click", () => {
        state.activeId = s.id;
        renderAll();
        sidebar.classList.remove("open");
      });
      historyList.appendChild(btn);
    });
  }

  function renderMessages() {
    const session = getSession();
    messagesEl.innerHTML = "";

    if (!session || !session.messages.length) {
      const empty = document.createElement("div");
      empty.className = "msg-row assistant";
      empty.innerHTML = '<div class="avatar"></div><div class="bubble">你好，可以开始提问了。</div>';
      messagesEl.appendChild(empty);
      return;
    }

    session.messages.forEach((msg) => {
      const row = msgTpl.content.firstElementChild.cloneNode(true);
      row.classList.add(msg.role === "user" ? "user" : "assistant");
      row.querySelector(".bubble").textContent = msg.content;
      messagesEl.appendChild(row);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderAll() {
    renderHistory();
    renderMessages();
  }

  function setSending(flag) {
    state.sending = flag;
    sendBtn.disabled = flag;
    messageInput.disabled = flag;
    setStatus(flag ? "思考中..." : "就绪");
  }

  function modelsUrl(apiUrl) {
    if (apiUrl.endsWith("/api/chat")) return apiUrl.slice(0, -9) + "/api/models";
    if (apiUrl.endsWith("/")) return apiUrl + "api/models";
    return apiUrl + "/api/models";
  }

  function buildFallbackModels() {
    return [
      { provider: "gemini", model: "gemini-2.5-flash", desc: "通用" },
      { provider: "gemini", model: "gemini-2.5-pro", desc: "高质量" },
      { provider: "gemini", model: "gemini-2.0-flash", desc: "快速" },
      { provider: "anthropic", model: "anthropic.claude-sonnet-4-5-20250929", desc: "平衡" },
      { provider: "anthropic", model: "anthropic.claude-opus-4-5-20251101", desc: "高质量" },
      { provider: "anthropic", model: "anthropic.claude-haiku-4-5-20251001", desc: "轻量" },
    ];
  }

  async function loadModels() {
    const url = modelsUrl(apiInput.value.trim());
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("models api failed");
      const data = await resp.json();
      const providers = Array.isArray(data.providers) ? data.providers : [];
      const list = [];
      providers.forEach((p) => {
        const arr = Array.isArray(p.available_env_models) ? p.available_env_models : [];
        if (arr.length) {
          arr.forEach((name) => list.push({ provider: p.provider, model: name, desc: "环境变量" }));
        } else if (p.default_model) {
          list.push({ provider: p.provider, model: p.default_model, desc: "默认" });
        }
      });
      state.models = list.length ? list : buildFallbackModels();
    } catch (_) {
      state.models = buildFallbackModels();
    }

    const first = state.models[0];
    if (first && !state.selectedModel) {
      state.selectedProvider = first.provider;
      state.selectedModel = first.model;
    }
    if (!state.models.some((m) => m.provider === state.selectedProvider && m.model === state.selectedModel)) {
      state.selectedProvider = first.provider;
      state.selectedModel = first.model;
    }

    renderModelMenu();
    updateModelPickerText();
  }

  function updateModelPickerText() {
    modelPickerText.textContent = `${state.selectedProvider} / ${state.selectedModel}`;
  }

  function renderModelMenu() {
    modelOptions.innerHTML = "";
    state.models.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "model-option";
      const active = item.provider === state.selectedProvider && item.model === state.selectedModel;
      if (active) btn.classList.add("active");
      btn.innerHTML = `<div class="model-main">${item.model}</div><div class="model-sub">${item.provider} · ${item.desc}</div>`;
      btn.addEventListener("click", () => {
        state.selectedProvider = item.provider;
        state.selectedModel = item.model;
        updateModelPickerText();
        modelMenu.classList.add("hidden");
        renderModelMenu();
      });
      modelOptions.appendChild(btn);
    });
  }

  function extractError(payload, fallback) {
    if (!payload) return fallback;
    if (typeof payload === "string") return payload;
    if (typeof payload.detail === "string") return payload.detail;
    return fallback;
  }

  async function sendMessage(text) {
    const apiUrl = apiInput.value.trim();
    if (!apiUrl) {
      appendMessage("assistant", "后端地址不能为空。");
      return;
    }

    appendMessage("user", text);
    appendMessage("assistant", "...");
    setSending(true);

    try {
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          provider: state.selectedProvider,
          model: state.selectedModel,
        }),
      });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) {
        updateLastAssistantMessage(`请求失败：${extractError(payload, `HTTP ${resp.status}`)}`);
        return;
      }
      const reply = payload && typeof payload.reply === "string" ? payload.reply : "";
      updateLastAssistantMessage(reply || "模型未返回文本内容。");
    } catch (err) {
      updateLastAssistantMessage(`请求失败：${err && err.message ? err.message : "网络错误"}`);
    } finally {
      setSending(false);
    }
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.sending) return;
    const text = messageInput.value.trim();
    if (!text) return;
    messageInput.value = "";
    autoResize();
    await sendMessage(text);
  });

  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  messageInput.addEventListener("input", autoResize);

  modelPickerBtn.addEventListener("click", () => {
    modelMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!modelPicker.contains(e.target)) {
      modelMenu.classList.add("hidden");
    }
  });

  apiInput.addEventListener("change", loadModels);

  newChatBtn.addEventListener("click", () => {
    createSession();
    messageInput.focus();
  });

  openSidebarBtn.addEventListener("click", () => sidebar.classList.add("open"));
  closeSidebarBtn.addEventListener("click", () => sidebar.classList.remove("open"));

  loadSessions();
  autoResize();
  loadModels();
})();
