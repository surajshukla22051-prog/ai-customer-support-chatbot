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
  const helpArticles = [
    { id: "getting-started", category: "GETTING STARTED", title: "Welcome to NovaDesk", summary: "A quick tour of your private support workspace.", answer: "NovaDesk brings help topics, a locally run FAQ assistant, and an editable knowledge library together in one workspace. Use the navigation at the top to browse articles, ask the assistant, update FAQs, or review your conversation history. It works in your browser with no account or AI API key.", keywords: "welcome getting started first visit overview setup workspace" },
    { id: "use-assistant", category: "THE ASSISTANT", title: "Chat with the assistant", summary: "Ask a question and get a grounded FAQ answer.", answer: "Open Ask the assistant, choose a suggested question or type your own, and press Enter. NovaDesk compares your words with FAQ questions, answers, and keywords saved in this browser. A close match returns the saved answer; when the match is weak, it tells you instead of making up an answer.", keywords: "chat assistant ask question how works local ai" },
    { id: "faq-library", category: "KNOWLEDGE & ANSWERS", title: "Build your FAQ library", summary: "Add, edit, search, and organize helpful answers.", answer: "Choose Manage FAQs to maintain the support knowledge base. Add a clear question, a helpful answer, and optional comma-separated keywords. Edit an existing FAQ when information changes, or delete an entry that is no longer relevant. The assistant can use your updated FAQs right away.", keywords: "faq library knowledge base add edit organize create answer" },
    { id: "matching", category: "KNOWLEDGE & ANSWERS", title: "Improve answer matching", summary: "Give the local matcher useful words to work with.", answer: "Write FAQ questions the way a customer might ask them. Include common alternatives as keywords—for example, add 'forgot', 'login', and 'account' to a password-reset FAQ. Keep each answer focused. Matching uses local word relevance, so this is helpful FAQ retrieval rather than a generative AI model.", keywords: "matching keywords improve relevance training score similar words" },
    { id: "no-answer", category: "TROUBLESHOOTING", title: "When no answer is found", summary: "Help NovaDesk find the right FAQ next time.", answer: "If the assistant says it cannot find a reliable answer, try simpler or alternate words. If the answer should be available, open Manage FAQs and add an FAQ for that question, including the important words as keywords. The next matching question can then use that saved answer.", keywords: "no answer fallback troubleshooting cannot find match" },
    { id: "privacy", category: "PRIVACY & WORKSPACE", title: "Privacy and local storage", summary: "Where your FAQs and conversations are kept.", answer: "NovaDesk stores FAQs and conversation history in the browser's local storage on this device and browser profile. Questions are matched locally; the assistant makes no AI API calls. Local storage does not sync to other devices or browsers, and clearing this browser's site data can remove the saved information.", keywords: "privacy secure data local browser device storage account cloud" },
    { id: "backup", category: "PRIVACY & WORKSPACE", title: "Export a workspace backup", summary: "Save FAQs and conversations to a JSON file.", answer: "Use Export All Workspace Data on the help center or Export data in Conversation History. Your browser downloads a JSON file with a timestamp, FAQ library, and saved conversations. Keep the file somewhere safe: NovaDesk does not sync local data between devices.", keywords: "backup export download json file save data restore transfer" },
    { id: "history", category: "PRIVACY & WORKSPACE", title: "Manage conversation history", summary: "Review, search, export, or clear saved chats.", answer: "Open Conversations to search saved chats and inspect their messages. Export data downloads your FAQs and conversations together as a JSON backup. Clear history removes conversation logs from this browser, but it does not delete FAQs.", keywords: "history logs conversations saved chats search review clear delete" },
    { id: "no-api", category: "ABOUT THE AI", title: "Does NovaDesk need an AI API key?", summary: "Understand the local assistant and its limits.", answer: "No API key or paid AI service is needed. NovaDesk uses browser-based text normalization and relevance scoring to retrieve an answer from your FAQ library. It does not generate open-ended answers like a large language model and does not send your question to an AI API.", keywords: "api key no api cost free offline ai model generative cloud" }
  ];

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
    const faqMetric = $("#statFaqs");
    const chatMetric = $("#statChats");
    const faqCount = $("#faqNavCount");
    if (faqMetric) faqMetric.textContent = faqs.length;
    if (chatMetric) chatMetric.textContent = logs.length;
    if (faqCount) faqCount.textContent = faqs.length;
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

  function renderHelpResults(query) {
    const cleanQuery = normalizeText(query);
    const resultSection = $("#helpSearchResults");
    const resultsBox = $("#articleResults");
    if (!cleanQuery) {
      resultSection.hidden = true;
      resultsBox.replaceChildren();
      return;
    }

    const tokens = [...new Set(getTokens(cleanQuery))];
    const articleResults = helpArticles.map(article => {
      const searchable = normalizeText(`${article.title} ${article.summary} ${article.answer} ${article.keywords}`);
      const hits = tokens.filter(token => searchable.includes(token)).length;
      return { ...article, score: hits / Math.max(tokens.length, 1) };
    }).filter(article => article.score > 0)
      .sort((first, second) => second.score - first.score);

    const faqResults = faqs.filter(faq =>
      normalizeText(`${faq.question} ${faq.answer} ${(faq.keywords || []).join(" ")}`)
        .includes(cleanQuery)
      || tokens.some(token => normalizeText(`${faq.question} ${faq.answer} ${(faq.keywords || []).join(" ")}`).includes(token))
    ).map(faq => ({
      id: faq.id,
      category: "YOUR FAQ LIBRARY",
      title: faq.question,
      summary: faq.answer,
      answer: faq.answer,
      score: scoreFaq(cleanQuery, faq) + 0.2
    }));

    const uniqueResults = new Map();
    for (const result of [...articleResults, ...faqResults].sort((first, second) => second.score - first.score)) {
      uniqueResults.set(result.id, result);
    }
    const results = [...uniqueResults.values()].slice(0, 8);
    $("#searchResultsTitle").textContent = `Results for “${query.trim()}”`;
    resultSection.hidden = false;

    if (!results.length) {
      resultsBox.innerHTML = `<div class="search-empty"><span>⌕</span><h3>No exact matches yet</h3><p>Try a shorter search, browse the topics below, or ask the local assistant.</p><button class="button button-primary" type="button" data-view="chat">Ask the assistant <span>↗</span></button></div>`;
      return;
    }

    resultsBox.innerHTML = results.map(article => `
      <button class="article-result-card" type="button" data-open-article="${escapeHtml(article.id)}">
        <span class="article-result-top"><span>${escapeHtml(article.category)}</span><i>↗</i></span>
        <strong>${escapeHtml(article.title)}</strong>
        <span class="article-result-summary">${escapeHtml(article.summary)}</span>
        <span class="article-read">Read guide <b>→</b></span>
      </button>
    `).join("");
  }

  function openHelpArticle(article) {
    $("#articleCategory").textContent = article.category;
    $("#articleTitle").textContent = article.title;
    $("#articleAnswer").textContent = article.answer;
    $("#articleDialog").showModal();
  }

  function routeTo(viewName) {
    $$(".view").forEach(view => view.classList.toggle("active-view", view.id === `view-${viewName}`));
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === viewName));
    const labels = { overview: "Home", chat: "Ask the assistant", faqs: "Manage FAQs", logs: "Conversations" };
    $("#crumbCurrent").textContent = labels[viewName] || viewName;
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
      if (viewButton.closest("#articleDialog")) $("#articleDialog").close();
      routeTo(viewButton.dataset.view);
      if (viewButton.id === "quickAddFaq") openFaqDialog();
    }

    const topicButton = target.closest("[data-search]");
    if (topicButton) {
      const query = topicButton.dataset.search || "";
      $("#helpSearch").value = query;
      renderHelpResults(query);
      $("#helpSearchResults").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const resultButton = target.closest("[data-open-article]");
    if (resultButton) {
      const articleId = resultButton.dataset.openArticle;
      const article = helpArticles.find(item => item.id === articleId)
        || faqs.find(item => item.id === articleId);
      if (article) openHelpArticle({
        category: article.category || "YOUR FAQ LIBRARY",
        title: article.title || article.question,
        answer: article.answer,
        summary: article.summary || article.answer
      });
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
  $("#helpSearchForm").addEventListener("submit", event => {
    event.preventDefault();
    renderHelpResults($("#helpSearch").value);
  });
  $("#helpSearch").addEventListener("input", event => {
    if (!event.target.value.trim()) renderHelpResults("");
  });
  $("#clearHelpSearch").addEventListener("click", () => {
    $("#helpSearch").value = "";
    renderHelpResults("");
    $("#helpSearch").focus();
  });
  $("#closeArticle").addEventListener("click", () => $("#articleDialog").close());
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

  $("#quickExport")?.addEventListener("click", exportWorkspaceData);
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
