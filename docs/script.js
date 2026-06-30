const BACKEND_URL = "https://tax-chatbot-a46m.onrender.com";

// ── Per-session state ────────────────────────────────────────────────────────
let messages        = [];
let isLoading       = false;
let chatIsOpen      = false;
let webpageContext  = null;   // scraped text — lives only in this session
let webpageUrl      = null;   // the URL that was read

// ── DOM refs ─────────────────────────────────────────────────────────────────
const chatWindow    = document.getElementById("chat-window");
const chatInput     = document.getElementById("chat-input");
const sendBtn       = document.getElementById("send-btn");
const chatMessages  = document.getElementById("chat-messages");
const fabIcon       = document.getElementById("fab-icon");
const contextBanner = document.getElementById("context-banner");
const contextUrlEl  = document.getElementById("context-url-display");
const modelStatus   = document.getElementById("model-status");
const readingOverlay= document.getElementById("reading-overlay");
const readingStatus = document.getElementById("reading-status");
const readingSub    = document.getElementById("reading-sub");

// ── Chat open/close ──────────────────────────────────────────────────────────
function openChat()  { if (!chatIsOpen) toggleChat(); }
function closeChat() { if (chatIsOpen)  toggleChat(); }
function toggleChat() {
  chatIsOpen = !chatIsOpen;
  if (chatIsOpen) {
    chatWindow.classList.remove("hidden");
    chatWindow.classList.add("flex");
    fabIcon.textContent = "expand_more";
    fabIcon.style.fontVariationSettings = "";
    setTimeout(() => chatInput.focus(), 100);
  } else {
    chatWindow.classList.add("hidden");
    chatWindow.classList.remove("flex");
    fabIcon.textContent = "forum";
    fabIcon.style.fontVariationSettings = "'FILL' 1";
  }
}

// ── Clear chat (keeps webpage context) ───────────────────────────────────────
function clearChat() {
  messages = [];
  webpageContext = null;
  webpageUrl = null;
  contextBanner.style.display = "none";
  modelStatus.textContent = "Powered by Llama 3.3 70B";
  chatMessages.innerHTML = `
    <div class="bg-error-container/10 border border-error/20 p-3 rounded-xl flex gap-2">
      <span class="material-symbols-outlined text-error text-[16px] flex-shrink-0 mt-0.5">warning</span>
      <p class="text-[12px] text-on-surface-variant leading-relaxed">TaxWise AI provides general information only — not professional tax advice.</p>
    </div>
    <div class="flex gap-3 msg-enter">
      <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
        <span class="material-symbols-outlined text-primary text-[16px]">smart_toy</span>
      </div>
      <div class="bg-surface-container px-4 py-3 rounded-2xl rounded-tl-none max-w-[85%]">
        <p class="text-[14px] text-on-surface leading-relaxed">
          Hello! I'm TaxWise AI 👋<br><br>
          Ask me tax &amp; finance questions — or type <strong style="color:#adc6ff">Read this webpage: [URL]</strong> to load any webpage!
        </p>
      </div>
    </div>`;
}

function clearWebpageContext() {
  webpageContext = null;
  webpageUrl = null;
  contextBanner.style.display = "none";
  modelStatus.textContent = "Powered by Llama 3.3 70B";
  appendBotMessage("Webpage context cleared! I'm back to general Tax & Finance mode. Ask me anything!");
}

// ── Ask from landing card ─────────────────────────────────────────────────────
function askQuestion(question) {
  openChat();
  setTimeout(() => {
    chatInput.value = question;
    sendMessage();
  }, 350);
}

// ── URL detector ──────────────────────────────────────────────────────────────
function detectWebpageCommand(text) {
  const patterns = [
    /read\s+this\s+webpage\s*:\s*(https?:\/\/\S+)/i,
    /read\s+this\s+webpage\s*:\s*(www\.\S+)/i,
    /read\s+webpage\s*:\s*(https?:\/\/\S+)/i,
    /read\s*:\s*(https?:\/\/\S+)/i,
    /analyze\s+this\s+webpage\s*:\s*(https?:\/\/\S+)/i,
    /summarize\s+this\s+webpage\s*:\s*(https?:\/\/\S+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].replace(/[.,;)]+$/, ""); // strip trailing punctuation
  }
  return null;
}

// ── Webpage reading ───────────────────────────────────────────────────────────
async function readWebpage(url) {
  readingOverlay.classList.add("show");
  readingStatus.textContent = "Reading main page...";
  readingSub.textContent = url.length > 50 ? url.slice(0, 50) + "…" : url;

  try {
    const res = await fetch(`${BACKEND_URL}/read-webpage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    readingStatus.textContent = "Reading internal links...";

    const data = await res.json();
    webpageContext = data.content;
    webpageUrl     = data.url;

    // Show context banner
    contextUrlEl.textContent = data.url;
    contextBanner.style.display = "flex";
    modelStatus.textContent = "Webpage mode · Llama 3.3 70B";

    readingOverlay.classList.remove("show");

    appendBotMessage(
      `✅ **Webpage loaded successfully!**\n\n` +
      `📄 **URL:** ${data.url}\n` +
      `🔗 **Internal links read:** ${data.links_found}\n` +
      `📊 **Content indexed:** ${(data.char_count / 1000).toFixed(1)}k characters\n\n` +
      `I've read the main page and ${data.links_found} internal links (depth 1). ` +
      `Ask me anything about this webpage!`
    );

  } catch (e) {
    readingOverlay.classList.remove("show");
    appendBotMessage(`⚠️ **Couldn't read that webpage.**\n\nError: ${e.message}\n\nPlease check the URL and try again. Some websites block automated access.`);
  }
}

// ── Format markdown ───────────────────────────────────────────────────────────
function formatText(text) {
  return text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
    .replace(/`([^`]+)`/g,"<code style='background:#1b1f2b;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:12px;color:#adc6ff'>$1</code>")
    .replace(/^### (.+)$/gm,"<strong>$1</strong>")
    .replace(/^## (.+)$/gm,"<strong>$1</strong>")
    .replace(/^# (.+)$/gm,"<strong>$1</strong>")
    .replace(/^\* (.+)$/gm,"<li style='margin:3px 0;color:#94A3B8'>$1</li>")
    .replace(/^- (.+)$/gm,"<li style='margin:3px 0;color:#94A3B8'>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm,"<li style='margin:3px 0;color:#94A3B8'>$2</li>")
    .replace(/(<li.*<\/li>\n?)+/g,m=>`<ul style='padding-left:18px;margin:6px 0'>${m}</ul>`)
    .replace(/\n{2,}/g,"<br><br>").replace(/\n/g,"<br>");
}

// ── Append messages ───────────────────────────────────────────────────────────
function appendUserMessage(text) {
  const div = document.createElement("div");
  div.className = "flex gap-3 justify-end msg-enter";
  div.innerHTML = `
    <div class="bg-primary/20 border border-primary/20 px-4 py-3 rounded-2xl rounded-tr-none max-w-[85%]">
      <p class="text-[14px] text-on-surface leading-relaxed">${text.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>
    </div>
    <div class="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center flex-shrink-0">
      <span class="material-symbols-outlined text-on-surface-variant text-[16px]">person</span>
    </div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendBotMessage(text) {
  const div = document.createElement("div");
  div.className = "flex gap-3 msg-enter";
  div.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
      <span class="material-symbols-outlined text-primary text-[16px]">smart_toy</span>
    </div>
    <div class="bg-surface-container px-4 py-3 rounded-2xl rounded-tl-none max-w-[85%]">
      <p class="text-[14px] text-on-surface leading-relaxed">${formatText(text)}</p>
    </div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "flex gap-3 msg-enter"; div.id = "typing-indicator";
  div.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
      <span class="material-symbols-outlined text-primary text-[16px]">smart_toy</span>
    </div>
    <div class="bg-surface-container px-4 py-3 rounded-2xl rounded-tl-none">
      <div style="display:flex;gap:5px;align-items:center;padding:2px 0">
        <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
      </div>
    </div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function removeTyping() { const t=document.getElementById("typing-indicator"); if(t) t.remove(); }

// ── Main send ─────────────────────────────────────────────────────────────────
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isLoading) return;

  // Check if it's a "Read this webpage" command
  const urlToRead = detectWebpageCommand(text);
  if (urlToRead) {
    appendUserMessage(text);
    chatInput.value = "";
    chatInput.style.height = "auto";
    await readWebpage(urlToRead);
    return;
  }

  // Regular chat
  messages.push({ role: "user", content: text });
  appendUserMessage(text);
  chatInput.value = "";
  chatInput.style.height = "auto";

  isLoading = true;
  sendBtn.disabled = true;
  showTyping();

  try {
    const body = { messages };
    // Attach webpage context if active (session-scoped)
    if (webpageContext) {
      body.webpage_context = webpageContext;
      body.webpage_url     = webpageUrl;
    }

    const res = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    messages.push({ role: "assistant", content: data.reply });
    removeTyping();
    appendBotMessage(data.reply);

  } catch (err) {
    removeTyping();
    appendBotMessage("⚠️ Sorry, I couldn't reach the server. Please try again in a moment.");
    messages.pop();
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

// ── Input handlers ────────────────────────────────────────────────────────────
chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
chatInput.addEventListener("input", function() {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 100) + "px";
});