(() => {
  "use strict";

  const storageKeys = { faqs: "novadesk_faqs_v1", logs: "novadesk_logs_v1" };
  const starterFaqs = [
    { id: "faq-1", question: "How can I reset my password?", answer: "To reset your password, open the sign-in page and click 'Forgot Password'. Enter your registered email and check your inbox or spam folder for instructions.", keywords: ["password", "reset", "login", "forgot"] },
    { id: "faq-2", question: "What are your support hours?", answer: "Our system assistant is active 24/7. Human support personnel are available Monday through Friday from 9 AM to 6 PM.", keywords: ["hours", "time", "human", "available"] },
    { id: "faq-3", question: "How do I cancel my subscription?", answer: "Navigate to Account Settings → Billing & Plans. Click on 'Cancel Subscription' and follow the confirmation prompts on the screen.", keywords: ["cancel", "subscription", "billing", "plan", "stop"] },
    { id: "faq-4", question: "Which payment methods are accepted?", answer: "We accept all major credit cards, debit cards, PayPal, and Apple Pay. You can view payment options at checkout.", keywords: ["payment", "card", "paypal", "pay", "money"] }
  ];
  const stopWords = new Set("a an and are as at be can do does for from how i in is it of on or our please the to was what when where which who why with you your my".split(" "));
  const relatedTerms = {
    pass: ["password"], pwd: ["password"], forgot: ["reset", "password"], reset: ["forgot", "password"],
    login: ["sign", "account"], signin: ["login", "password"], sign: ["login"], account: ["login"],
    cancel: ["stop", "subscription"], stop: ["cancel", "subscription"], subscription: ["plan", "billing"],
    plan: ["subscription", "billing"], billing: ["payment", "subscription"], pay: ["payment"],
    card: ["payment"], paypal: ["payment"], money: ["payment"], timing: ["hours"], time: ["hours"],
    available: ["hours"], human: ["support"], support: ["help"], help: ["support"],
    kaise: ["how"], password: ["reset", "forgot"], "customer": ["support"]
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const readStorage = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };
  const writeStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast("Browser storage is unavailable or full. Your latest changes may not be saved.");
      return false;
    }
  };
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  let faqs = readStorage(storageKeys.faqs, null);
  if (!Array.isArray(faqs)) {
    faqs = starterFaqs.map(faq => ({ ...faq, keywords: [...faq.keywords] }));
    writeStorage(storageKeys.faqs, faqs);
  }
  let logs = readStorage(storageKeys.logs, []);
  if (!Array.isArray(logs)) logs = [];
  let activeChatSession = null;
  let toastTimeout;

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Just now" : date.toLocaleString([], {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function normalizeText(value) {
    return String(value).toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getTokens(value) {
    return normalizeText(value).split(" ").filter(token => token.length > 1 && !stopWords.has(token));
  }

  function scoreFaq(query, faq) {
    const queryTokens = [...new Set(getTokens(query))];
    if (!queryTokens.length) return 0;

    const questionTokens = new Set(getTokens(faq.question));
    const keywordTokens = new Set(getTokens((faq.keywords || []).join(" ")));
    const answerTokens = new Set(getTokens(faq.answer));
    let matched = 0;
    let questionHits = 0;

    for (const token of queryTokens) {
      const related = relatedTerms[token] || [];
      const hasMatch = questionTokens.has(token) || keywordTokens.has(token) || answerTokens.has(token)
        || related.some(term => questionTokens.has(term) || keywordTokens.has(term) || answerTokens.has(term));
      if (hasMatch) matched++;
      if (questionTokens.has(token) || related.some(term => questionTokens.has(term))) questionHits++;
    }

    const queryText = normalizeText(query);
    const questionText = normalizeText(faq.question);
    const phraseBonus = queryText.length > 3 && questionText.includes(queryText) ? 0.16 : 0;
    return (matched / queryTokens.length) * 0.72
      + (questionHits / queryTokens.length) * 0.28
      + phraseBonus;
  }

  function matchFaq(query) {
    let bestMatch = null;
    let bestScore = 0;
    for (const faq of faqs) {
      const score = scoreFaq(query, faq);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }
    return bestScore >= 0.34 ? bestMatch : null;
  }

  function getAssistantReply(query) {
    const text = normalizeText(query);
    if (/^(hi|hey|hello|good morning|good afternoon|good evening|namaste)( there)?$/.test(text)) {
      return { text: "Hey! I can help with questions in this support library. Try one of the suggested questions below.", matched: false };
    }
    if (/^(thanks|thank you|thx|shukriya)$/.test(text)) {
      return { text: "You're welcome! Let me know if you have another support question.", matched: false };
    }
    if (/^(who are you|what can you do|help)$/.test(text)) {
      return { text: "I'm NovaDesk, a private FAQ assistant. I match your question against this workspace's FAQs right in your browser—no API or cloud AI required.", matched: false };
    }

    const match = matchFaq(query);
    return match
      ? { text: match.answer, matched: true }
      : { text: "I couldn't find a reliable answer in this FAQ library. Try different words, or add the answer in FAQ Manager so I can help next time.", matched: false };
  }

  function persistLogs() {
    logs = logs.slice(0, 50);
    writeStorage(storageKeys.logs, logs);
  }

  function startChat() {
    activeChatSession = { id: `chat-${Date.now()}`, createdAt: new Date().toISOString(), messages: [] };
    logs.unshift(activeChatSession);
    persistLogs();
    renderChatMessages();
    renderSuggestions();
    renderMetrics();
  }

  function submitUserQuestion(value) {
    const text = value.trim();
    if (!text) return;
    if (!activeChatSession) startChat();

    activeChatSession.messages.push({ role: "user", text, time: new Date().toISOString() });
    const reply = getAssistantReply(text);
    activeChatSession.messages.push({
      role: "assistant", text: reply.text, matched: reply.matched, time: new Date().toISOString()
    });

    persistLogs();
    renderChatMessages();
    renderMetrics();
    $("#chatInput").value = "";
    $("#chatInput").focus();
  }

  function renderChatMessages() {
    const box = $("#chatMessages");
    if (!box) return;
    const messages = activeChatSession?.messages || [];
    if (!messages.length) {
      box.innerHTML = `<div class="message-row"><div class="message-bubble">👋 Hi! I'm NovaDesk. Ask me a support question, or try one of the suggestions below.</div></div>`;
    } else {
      box.innerHTML = messages.map(message => `
        <div class="message-row ${message.role === "user" ? "user" : ""}">
          <div class="message-bubble">
            ${escapeHtml(message.text)}
            ${message.role === "assistant" && message.matched ? '<span class="match-label">✓ Matched to your FAQ library</span>' : ""}
          </div>
        </div>
      `).join("");
    }
    box.scrollTop = box.scrollHeight;
  }

  function renderSuggestions() {
    const box = $("#suggestedQuestions");
    if (!box) return;
    box.innerHTML = faqs.slice(0, 3).map(faq =>
      `<button class="suggestion" type="button" data-q="${escapeHtml(faq.question)}">${escapeHtml(faq.question)}</button>`
    ).join("");
  }

  function renderFaqList() {
    const query = normalizeText($("#faqSearch")?.value || "");
    const container = $("#faqList");
    const filtered = faqs.filter(faq =>
      normalizeText(`${faq.question} ${faq.answer} ${(faq.keywords || []).join(" ")}`).includes(query)
    );
    $("#faqCountLabel").textContent = `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}`;
    $("#faqNavCount").textContent = faqs.length;

    if (!filtered.length) {
      container.innerHTML = `<div class="no-results">No FAQs match your search. Try another term or add a new FAQ.</div>`;
      return;
    }

    container.innerHTML = filtered.map((faq, index) => `
      <article class="faq-card">
        <div class="faq-card-top">
          <div class="faq-number">${String(index + 1).padStart(2, "0")}</div>
          <div class="faq-main">
            <h3>${escapeHtml(faq.question)}</h3>
            <p>${escapeHtml(faq.answer)}</p>
          </div>
          <div class="faq-actions">
            <button class="small-action" type="button" data-edit="${escapeHtml(faq.id)}">Edit</button>
            <button class="small-action delete" type="button" data-delete="${escapeHtml(faq.id)}">Delete</button>
          </div>
        </div>
        ${(faq.keywords || []).length ? `<div class="keyword-row">${faq.keywords.map(keyword =>
          `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}</div>` : ""}
      </article>
    `).join("");
  }

  function renderLogsGrid() {
    const box = $("#logsList");
    const filterTerm = normalizeText($("#logSearch")?.value || "");
    const filteredLogs = logs.filter(session =>
      normalizeText((session.messages || []).map(message => message.text).join(" ")).includes(filterTerm)
    );

    if (!filteredLogs.length) {
      box.innerHTML = `<div class="no-results">Your conversations will appear here after you chat with NovaDesk.</div>`;
      return;
    }

    box.innerHTML = filteredLogs.map(session => {
      const messages = Array.isArray(session.messages) ? session.messages : [];
      const firstQuestion = messages.find(message => message.role === "user")?.text || "New conversation";
      const lastReply = messages.filter(message => message.role === "assistant").at(-1)?.text || "No reply yet";
      return `
        <article class="log-row">
          <div class="log-avatar" aria-hidden="true">✦</div>
          <div class="log-info">
            <strong>${escapeHtml(firstQuestion)}</strong>
            <p>${escapeHtml(lastReply)}</p>
          </div>
          <div class="log-meta">
            <strong>${messages.length} messages</strong>
            <span>${escapeHtml(formatDate(session.createdAt))}</span>
          </div>
          <button class="log-open" type="button" data-view-log="${escapeHtml(session.id)}">View chat</button>
        </article>
      `;
    }).join("");
  }

  function renderMetrics() {
    $("#statFaqs").textContent = faqs.length;
    $("#statChats").textContent = logs.length;
    $("#faqNavCount").textContent = faqs.length;
    renderWorkspaceBoard();
  }

  function renderWorkspaceBoard() {
    const faqList = $("#boardFaqs");
    const chatList = $("#boardChats");
    if (!faqList || !chatList) return;

    $("#boardFaqCount").textContent = faqs.length;
    $("#boardChatCount").textContent = logs.length;
    faqList.innerHTML = faqs.length
      ? faqs.slice(0, 3).map((faq, index) => `
        <article class="board-card faq-board-card">
          <div class="board-art board-art-${index + 1}" aria-hidden="true"><span>${index === 0 ? "01" : index === 1 ? "02" : "03"}</span><i></i></div>
          <span class="board-card-label">FAQ · ${escapeHtml((faq.keywords || [])[0] || "SUPPORT")}</span>
          <h4>${escapeHtml(faq.question)}</h4>
          <p>${escapeHtml(faq.answer)}</p>
        </article>
      `).join("")
      : `<div class="board-empty">Your first FAQ will show up here.</div>`;

    chatList.innerHTML = logs.length
      ? logs.slice(0, 3).map(session => {
        const question = session.messages?.find(message => message.role === "user")?.text || "New conversation";
        const answer = session.messages?.filter(message => message.role === "assistant").at(-1)?.text || "Waiting for the first question.";
        return `
          <article class="board-card conversation-board-card">
            <div class="conversation-card-top"><span class="conversation-orb" aria-hidden="true">✦</span><span>${escapeHtml(formatDate(session.createdAt))}</span></div>
            <span class="board-card-label">CUSTOMER QUESTION</span>
            <h4>${escapeHtml(question)}</h4>
            <p>${escapeHtml(answer)}</p>
          </article>
        `;
      }).join("")
      : `<div class="board-empty">Start a chat to add your first conversation.</div>`;
  }

  function routeTo(viewName) {
    $$(".view").forEach(view => view.classList.toggle("active-view", view.id === `view-${viewName}`));
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === viewName));
    $("#crumbCurrent").textContent = viewName === "faqs" ? "FAQ Manager" : viewName.charAt(0).toUpperCase() + viewName.slice(1);
    if (viewName === "chat") { renderChatMessages(); renderSuggestions(); }
    if (viewName === "faqs") renderFaqList();
    if (viewName === "logs") renderLogsGrid();
  }

  function openFaqDialog(faq = null) {
    $("#faqForm").reset();
    $("#faqId").value = faq?.id || "";
    $("#faqQuestion").value = faq?.question || "";
    $("#faqAnswer").value = faq?.answer || "";
    $("#faqKeywords").value = (faq?.keywords || []).join(", ");
    $("#faqDialogTitle").textContent = faq ? "Edit FAQ" : "Add a FAQ";
    $("#faqDialog").showModal();
  }

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const viewButton = target.closest("[data-view]");
    if (viewButton) {
      routeTo(viewButton.dataset.view);
      if (viewButton.id === "quickAddFaq") openFaqDialog();
    }

    const suggestion = target.closest("[data-q]");
    if (suggestion) submitUserQuestion(suggestion.dataset.q);

    const deleteButton = target.closest("[data-delete]");
    if (deleteButton && confirm("Delete this FAQ?")) {
      faqs = faqs.filter(faq => faq.id !== deleteButton.dataset.delete);
      writeStorage(storageKeys.faqs, faqs);
      renderFaqList();
      renderSuggestions();
      renderMetrics();
      showToast("FAQ removed.");
    }

    const editButton = target.closest("[data-edit]");
    if (editButton) {
      const faq = faqs.find(item => item.id === editButton.dataset.edit);
      if (faq) openFaqDialog(faq);
    }

    const logButton = target.closest("[data-view-log]");
    if (logButton) {
      const session = logs.find(item => item.id === logButton.dataset.viewLog);
      if (!session) return;
      $("#conversationDetail").innerHTML = (session.messages || []).map(message => `
        <div class="detail-message">
          <div class="detail-message-head"><strong>${escapeHtml(message.role)}</strong><span>${escapeHtml(formatDate(message.time))}</span></div>
          <p>${escapeHtml(message.text)}</p>
        </div>
      `).join("") || "No messages in this conversation.";
      $("#conversationDialog").showModal();
    }
  });

  $("#chatForm").addEventListener("submit", event => {
    event.preventDefault();
    submitUserQuestion($("#chatInput").value);
  });
  $("#newChatBtn").addEventListener("click", () => {
    activeChatSession = null;
    renderChatMessages();
    showToast("Ready for a new conversation.");
  });
  $("#faqSearch").addEventListener("input", renderFaqList);
  $("#logSearch").addEventListener("input", renderLogsGrid);
  $("#addFaqBtn").addEventListener("click", () => openFaqDialog());
  $("#closeFaqDialog").addEventListener("click", () => $("#faqDialog").close());
  $("#cancelFaqBtn").addEventListener("click", () => $("#faqDialog").close());
  $("#closeConversation").addEventListener("click", () => $("#conversationDialog").close());

  $("#faqForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = $("#faqId").value;
    const faq = {
      id: id || `faq-${Date.now()}`,
      question: $("#faqQuestion").value.trim(),
      answer: $("#faqAnswer").value.trim(),
      keywords: $("#faqKeywords").value.split(",").map(keyword => keyword.trim()).filter(Boolean)
    };
    faqs = id ? faqs.map(item => item.id === id ? faq : item) : [faq, ...faqs];
    writeStorage(storageKeys.faqs, faqs);
    $("#faqDialog").close();
    renderFaqList();
    renderSuggestions();
    renderMetrics();
    showToast(id ? "FAQ updated." : "FAQ added to your local knowledge base.");
  });

  function exportWorkspaceData() {
    const bundle = { exportedAt: new Date().toISOString(), faqs, conversations: logs };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "novadesk-workspace-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Workspace backup downloaded.");
  }

  $("#quickExport").addEventListener("click", exportWorkspaceData);
  $("#exportLogsBtn").addEventListener("click", exportWorkspaceData);
  $("#clearLogsBtn").addEventListener("click", () => {
    if (!confirm("Clear all saved conversations? This cannot be undone.")) return;
    logs = [];
    activeChatSession = null;
    persistLogs();
    renderLogsGrid();
    renderChatMessages();
    renderMetrics();
    showToast("Conversation history cleared.");
  });

  routeTo("overview");
  renderMetrics();
})();
