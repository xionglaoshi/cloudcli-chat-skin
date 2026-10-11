// 会话皮肤（chat-skin）v1.2.0 · 独立注入版 — 2026-09-18 建
// 由 cloudcli_chat_skin_patch.sh 复制到 <dist>/assets/chat-skin.js，并在 index.html 注入一行加载；
// 每次页面加载自动生效，不需要点任何 tab，也不读写浏览器里的开关值（内存态）。
//
// 目标：不动 CloudCLI 源码，用官方插件机制给「会话区」换一套排版与层级：
//   ① 正式回复 = 正常正文（跨 mac/Win 字体栈 + 统一字号体系）
//   ② 思考块   = 等宽小字 + 灰蓝左竖线（来自应用自己的 Reasoning 折叠组件）
//   ③ 工具块   = 等宽小字 + 工具名着色（.chat-message.tool）
//   ④ 本轮一结束（出现正式回复）→ 自动折叠上一轮的思考/工具块；点标题可再展开
//
// 关键实现约束：
//   - 折叠**复用应用自己的折叠按钮**（button[aria-expanded]），不直接改 DOM 结构、不碰 React 状态
//   - 只按语义类/结构判定（.chat-message.{assistant|tool|user}），不依赖 Tailwind 哈希类名
//   - unmount 时**保留** <style> 与 observer —— 这样切回 Chat 后皮肤继续生效

const STYLE_ID = "cloudcli-chat-skin-style";
const PANEL_ID = "cloudcli-chat-skin-panel";
const PIN_KEY = "chat-skin-pins";
const AUTO_KEY = "chat-skin-autofolded";
const SWITCH_FLAG = "chat-skin-autoswitch-done";
const ECHO_KEYS_KEY = "chat-skin-echo-keys";
// ↓ 2026-09-18 用户拍板：行为固化，不再读写任何「可调整项」，也不要面板开关
const FROZEN_AUTO_FOLD = true;      // 自动折叠：开（每块最多自动折一次）
const FROZEN_ECHO_MODE = "hide";    // 识别到的「思考回声」：隐藏
const LEGACY_KEYS = ["chat-skin-echo-mode", "chat-skin-echo-mode-v2", "chat-skin-autofold-on", "chat-skin-dedin"];

const CSS = String.raw`
/* ============ 会话皮肤 v1（chat-skin）—— 全部变量集中在这里，改配色/字号只动这一段 ============ */
:root {
  --skin-sans: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB",
               "Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei",
               "Noto Sans SC", "Source Han Sans SC", "Helvetica Neue", Arial, sans-serif;
  --skin-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas,
               "Cascadia Mono", "Liberation Mono", "Courier New", monospace;
  --skin-prose-size: 15.5px;
  --skin-prose-lh: 1.78;
  --skin-mono-size: 13px;
  --skin-mono-lh: 1.62;
  --skin-tool-size: 12.5px;
  --skin-code-size: 12.5px;
  --skin-thinking-bar: #7c9cbf;
  --skin-thinking-bg: rgba(124, 156, 191, .07);
  --skin-tool-bar: #93a1af;
  --skin-tool-bg: rgba(147, 161, 175, .07);
  --skin-radius: 10px;
  --skin-gap: 6px;
}
html.dark {
  --skin-thinking-bar: #5f8ec4;
  --skin-thinking-bg: rgba(124, 156, 191, .12);
  --skin-tool-bar: #6b7c8c;
  --skin-tool-bg: rgba(147, 161, 175, .10);
}
/* Windows：同一套字号，仅补偿 PingFang/雅黑 与 SF/Consolas 的度量差 */
html[data-os="win"] {
  --skin-prose-lh: 1.72;
  --skin-mono-size: 12.8px;
  --skin-tool-size: 12.6px;
}
@media (max-width: 640px) {
  :root { --skin-prose-size: 15px; --skin-prose-lh: 1.72; --skin-mono-size: 12.5px; --skin-tool-size: 12.2px; }
}

/* ---------- 正式回复：正文排版 ---------- */
.chat-message[data-skin] { font-family: var(--skin-sans); }
.chat-message[data-skin="prose"] { margin: var(--skin-gap) 0 14px; }
.chat-message[data-skin="prose"] .prose,
.chat-message[data-skin="prose"] .font-serif {
  font-family: var(--skin-sans) !important;
  font-size: var(--skin-prose-size);
  line-height: var(--skin-prose-lh);
  /* 与思考/工具块同宽：原来这里是 max-width: 80ch，会让正文比过程块窄 */
  max-width: none;
  width: 100%;
}
.chat-message[data-skin="prose"],
.chat-message[data-skin="thinking"],
.chat-message[data-skin="tool"] { width: 100%; box-sizing: border-box; }
.chat-message[data-skin="prose"] .prose p,
.chat-message[data-skin="prose"] .prose li { font-size: inherit; line-height: inherit; margin: .55em 0; }
.chat-message[data-skin="prose"] .prose h1 { font-size: 1.42em; font-weight: 650; letter-spacing: -.01em; margin: 1.1em 0 .5em; }
.chat-message[data-skin="prose"] .prose h2 { font-size: 1.22em; font-weight: 650; letter-spacing: -.005em; margin: 1em 0 .45em; }
.chat-message[data-skin="prose"] .prose h3 { font-size: 1.08em; font-weight: 600; margin: .9em 0 .4em; }
.chat-message[data-skin="prose"] .prose ul,
.chat-message[data-skin="prose"] .prose ol { margin: .5em 0 .5em 1.35em; }
.chat-message[data-skin="prose"] .prose table { font-variant-numeric: tabular-nums; font-size: .94em; }
.chat-message[data-skin="prose"] .prose pre,
.chat-message[data-skin="prose"] .prose code,
.chat-message[data-skin="prose"] .prose kbd {
  font-family: var(--skin-mono);
  font-size: var(--skin-code-size);
  line-height: 1.65;
}
.chat-message[data-skin="prose"] .prose blockquote { border-left: 3px solid var(--border); padding-left: .8em; color: var(--muted-foreground); }
html[data-os="win"] .chat-message[data-skin="prose"] .prose { letter-spacing: .012em; }
html[data-os="win"] .chat-message[data-skin="prose"] .prose h1,
html[data-os="win"] .chat-message[data-skin="prose"] .prose h2 { letter-spacing: 0; }

/* ---------- 用户消息：略收敛，和回复形成对比 ---------- */
.chat-message[data-skin="user"] .prose,
.chat-message[data-skin="user"] .font-serif {
  font-family: var(--skin-sans) !important;
  font-size: 15px;
  line-height: 1.7;
}

/* ---------- 思考块：等宽小字 + 灰蓝左竖线 + 药丸状标题 ---------- */
.chat-message[data-skin="thinking"] {
  margin: 8px 0;
  padding: 2px 0 2px 10px;
  border-left: 3px solid var(--skin-thinking-bar);
  border-radius: 0 var(--skin-radius) var(--skin-radius) 0;
  background: var(--skin-thinking-bg);
  font-family: var(--skin-mono) !important;
  font-size: var(--skin-mono-size);
  line-height: var(--skin-mono-lh);
  color: var(--muted-foreground);
}
.chat-message[data-skin="thinking"] button[aria-expanded] {
  font-family: var(--skin-sans) !important;
  font-size: 12px;
  letter-spacing: .01em;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--skin-thinking-bg);
  width: auto;
  max-width: 100%;
}
.chat-message[data-skin="thinking"] .prose,
.chat-message[data-skin="thinking"] pre,
.chat-message[data-skin="thinking"] code {
  font-family: var(--skin-mono) !important;
  font-size: var(--skin-mono-size) !important;
  line-height: var(--skin-mono-lh) !important;
}

/* ---------- 工具块：等宽小字 + 灰底，工具名保留应用自己的配色 ---------- */
.chat-message[data-skin="tool"] {
  margin: 5px 0;
  font-family: var(--skin-mono);
  font-size: var(--skin-tool-size);
}
.chat-message[data-skin="tool"] > button {
  border-radius: var(--skin-radius);
  padding-top: 5px;
  padding-bottom: 5px;
}
.chat-message[data-skin="tool"] .text-xs,
.chat-message[data-skin="tool"] .text-\[10px\] { font-size: var(--skin-tool-size); }
.chat-message[data-skin="tool"] pre { font-family: var(--skin-mono); font-size: var(--skin-code-size); line-height: 1.6; }

/* ---------- 折叠态：让「一行摘要」更像 chip，而不是被截断的段 ---------- */
.chat-message[data-skin="thinking"][data-skin-folded="1"],
.chat-message[data-skin="tool"][data-skin-folded="1"] {
  background: transparent;
  border-left-color: transparent;
  opacity: .92;
}
.chat-message[data-skin-folded="1"] button[aria-expanded] {
  border: 1px solid var(--border);
  background: var(--muted);
}

/* ---------- 重复回声：同一段思考在流式期间会再以正文形式冒一次，压掉它 ---------- */
.chat-message[data-skin="dup"] { display: none !important; }

/* ---------- 回声 → 摘要卡：本地截断，不调模型、不改中转 ---------- */
.chat-message[data-skin="echo"] { margin: 4px 0 10px; }
.chat-message[data-skin="echo"]::before {
  content: "摘要 · 思考回声（点击展开全文）";
  display: block;
  font-size: 11px;
  line-height: 1.5;
  color: var(--muted-foreground);
  opacity: .85;
  margin: 0 0 3px 2px;
}
.chat-message[data-skin="echo"] .prose {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--skin-echo-lines, 3);
  overflow: hidden;
  font-family: var(--skin-mono) !important;
  font-size: 12.8px !important;
  line-height: 1.6 !important;
  color: var(--muted-foreground);
  background: var(--skin-thinking-bg);
  border-left: 3px solid var(--skin-thinking-bar);
  border-radius: 0 var(--skin-radius) var(--skin-radius) 0;
  padding: 6px 10px;
  max-width: 100%;
}
.chat-message[data-skin="echo"][data-skin-expanded="1"]::before { content: "思考回声全文（点击收起）"; }
.chat-message[data-skin="echo"][data-skin-expanded="1"] .prose {
  display: block;
  -webkit-line-clamp: unset;
  max-height: 60vh;
  overflow: auto;
}
`;

const state = {
  observer: null,
  timer: null,
  interval: null,
  pinned: new Set(),
  autoFolded: new Set(),
  echoKeys: new Set(),     // 已判定为回声的消息：永久记忆，绝不撤回（防抖动的关键）
  autoFold: true,
  applyCount: 0,
  dedupe: true,
  deduped: 0,
  echoMode: FROZEN_ECHO_MODE,
};

function normalizeText(s) {
  return String(s || "")
    .replace(/\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/gi, " ")  // 去掉时间戳
    .replace(/[*_`>#|\[\]()]/g, " ")                        // 去掉 markdown 装饰（中转会往摘要首行插 **）
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

/**
 * 「正文是不是某段思考的回声」——只用保守特征（前 120 字相同 + 长度差 <30%），
 * 判定结果一旦成立就永久记住（见 state.echoKeys），避免来回翻标记导致页面抖动。
 */
function looksLikeEcho(prose, thinking) {
  if (!prose || !thinking) return false;
  const a = prose, b = thinking;
  if (Math.min(a.length, b.length) < 60) return false;
  const n = Math.min(120, a.length, b.length);
  if (a.slice(0, n) !== b.slice(0, n)) return false;
  return Math.abs(a.length - b.length) / Math.max(a.length, b.length) < 0.3;
}

/** 思考块正文 = 整块 textContent 去掉触发器文字 */
function thinkingBody(el) {
  const btn = expanderOf(el);
  const trig = btn ? normalizeText(btn.textContent) : "";
  let body = normalizeText(el.textContent);
  if (trig && body.startsWith(trig)) body = body.slice(trig.length).trim();
  return body;
}

/**
 * 抑制「思考回声」：中转把 reasoning 镜像成 summary 后，流式期间同一段会再以正文消息出现一次。
 * 判定用保守的严格匹配：正文与紧邻的前一条思考正文「完全一致」或「前 200 字一致且正文足够长」。
 */
function suppressEchoes(messages) {
  const mode = state.dedupe ? state.echoMode : "off";
  // 把线数写到 :root 上供 CSS 用（摘要 1 行 / 3 行）
  document.documentElement.style.setProperty("--skin-echo-lines", mode === "summary1" ? "1" : "3");
  const markOf = () => {
    if (mode === "off") return "prose";
    return mode === "hide" ? "dup" : "echo";
  };
  // 第一遍：把本轮所有思考块的正文收集起来（顺序无关，避免「回声先到、思考后到」漏判）
  const bodies = [];
  messages.forEach((el) => {
    if (el.getAttribute("data-skin") !== "thinking") return;
    const body = thinkingBody(el);
    if (body) bodies.push(body);
  });
  // 第二遍：判定正文消息，命中即永久记忆（绝不因为下一轮文本变化而撤回）
  let hitCount = 0, newlyMarked = 0;
  messages.forEach((el) => {
    const kind = el.getAttribute("data-skin");
    if (kind !== "prose" && kind !== "dup" && kind !== "echo") return;
    const key = messageKey(el);
    if (!state.echoKeys.has(key)) {
      const own = normalizeText(el.textContent);
      if (!own) return;
      if (!bodies.some((b) => looksLikeEcho(own, b))) return;
      state.echoKeys.add(key);
      newlyMarked++;
    }
    el.setAttribute("data-skin", markOf());
    if (mode === "summary1" || mode === "summary3") el.removeAttribute("data-skin-expanded");
    hitCount++;
  });
  if (newlyMarked) savePins();
  state.deduped = hitCount;
  return hitCount;
}

function detectOS() {
  const ua = navigator.userAgent || "";
  if (/Windows|Win32|Win64/i.test(ua)) return "win";
  if (/Mac OS X|Macintosh/i.test(ua)) return "mac";
  return "other";
}

function injectStyle() {
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }
  document.documentElement.setAttribute("data-os", detectOS());
}

function loadPins() {
  // 内存态：不读浏览器存储（每次页面加载都从零开始，行为由常量决定）
}
function savePins() {
  // 内存态：不写浏览器存储
}

/** 找会话消息列表容器：包含 .chat-message 的最深公共父节点 */
function findMessageList() {
  const first = document.querySelector(".chat-message");
  if (!first) return null;
  let node = first.parentElement;
  while (node && node !== document.body) {
    if (node.querySelectorAll(".chat-message").length > 1) return node;
    node = node.parentElement;
  }
  return first.parentElement;
}

function isThinkingBlock(el) {
  // 思考块 = 助手消息里整条就是 Reasoning 折叠体（根节点 class 含 not-prose + data-state），
  // 且没有「折叠体之外的 markdown 正文」（后者说明这是带 reasoning 附注的正常回复）
  if (!el.classList.contains("assistant")) return false;
  const reasoningRoot = el.querySelector('.not-prose[data-state]');
  if (!reasoningRoot) return false;
  const proseOutside = [...el.querySelectorAll(".prose")].some((p) => !p.closest(".not-prose"));
  return !proseOutside;
}

/** 过程块的稳定标识：优先用消息时间戳，退化时用「兄弟序号」——展开/折叠两侧必须同一口径 */
function messageKey(el) {
  const ts = el.getAttribute("data-message-timestamp");
  if (ts) return `ts:${ts}`;
  const parent = el.parentElement;
  const idx = parent ? [...parent.querySelectorAll(".chat-message")].indexOf(el) : -1;
  return `idx:${idx}`;
}

/** 过程块的折叠开关（思考走 Reasoning 触发器，工具走自己的头部按钮） */
function expanderOf(el) {
  const kind = el.getAttribute("data-skin");
  if (kind === "thinking") return el.querySelector('.not-prose button[aria-expanded]');
  if (kind === "tool") {
    const btns = [...el.querySelectorAll('button[aria-expanded]')];
    return btns[0] || null;
  }
  return null;
}

function tag(messages) {
  let thinking = 0, tool = 0, prose = 0;
  messages.forEach((el) => {
    if (el.classList.contains("tool")) {
      el.setAttribute("data-skin", "tool");
      tool++;
      return;
    }
    if (el.classList.contains("user")) {
      el.setAttribute("data-skin", "user");
      return;
    }
    if (isThinkingBlock(el)) {
      el.setAttribute("data-skin", "thinking");
      thinking++;
      return;
    }
    if (el.classList.contains("assistant")) {
      el.setAttribute("data-skin", "prose");
      prose++;
    }
  });
  return { thinking, tool, prose };
}

/** 本轮结束判定：该过程块之后是否已经出现「有正文的正式回复」 */
function hasLaterProse(messages, index) {
  for (let i = index + 1; i < messages.length; i++) {
    const el = messages[i];
    if (el.getAttribute("data-skin") !== "prose") continue;
    const text = (el.innerText || "").trim();
    if (text.length > 0) return true;
  }
  return false;
}

function foldCompleted(messages) {
  let folded = 0, kept = 0;
  messages.forEach((el, i) => {
    const kind = el.getAttribute("data-skin");
    if (kind !== "thinking" && kind !== "tool") return;
    const btn = expanderOf(el);
    if (!btn) return;
    const key = messageKey(el);
    // ① 用户手动打开过 → 永远保持展开（应用自己把它折了也要重新展开）
    if (state.pinned.has(key)) {
      if (btn.getAttribute("aria-expanded") === "false") {
        btn.click();
        kept++;
      }
      el.setAttribute("data-skin-folded", "0");
      return;
    }
    // ② 已经自动折过一次 → 不再动它（避免「点开后又自动折回」）
    if (state.autoFolded.has(key)) return;
    if (!hasLaterProse(messages, i)) {
      el.setAttribute("data-skin-folded", "0");
      return;
    }
    if (!state.autoFold) return;
    if (btn.getAttribute("aria-expanded") === "true") {
      btn.click();           // 复用应用自己的折叠逻辑（每块只做一次）
      folded++;
    }
    state.autoFolded.add(key);
    el.setAttribute("data-skin-folded", "1");
  });
  if (folded || kept) savePins();
  return { folded, kept };
}

function apply() {
  const list = findMessageList();
  if (!list) return null;
  const messages = [...list.querySelectorAll(".chat-message")];
  const counts = tag(messages);
  const echoes = suppressEchoes(messages);
  const { folded, kept } = foldCompleted(messages);
  state.applyCount++;
  return { total: messages.length, ...counts, echoes, folded, kept, applyCount: state.applyCount };
}

function schedule(delay = 250) {
  if (state.timer) return;
  state.timer = setTimeout(() => {
    state.timer = null;
    try { apply(); } catch (e) { console.warn("[chat-skin] apply failed:", e); }
  }, delay);
}

/** 用户手动点过展开/折叠的块 → 打 pin，后续不再自动动它 */
function watchUserToggles() {
  if (document.__chatSkinClickBound) return;
  document.__chatSkinClickBound = true;
  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    // 摘要卡：点一下展开/收起全文
    const echo = target ? target.closest('.chat-message[data-skin="echo"]') : null;
    if (echo) {
      const opened = echo.getAttribute("data-skin-expanded") === "1";
      if (opened) echo.removeAttribute("data-skin-expanded");
      else echo.setAttribute("data-skin-expanded", "1");
      return;
    }
    const btn = target ? target.closest('button[aria-expanded]') : null;
    if (!btn) return;
    const msg = btn.closest(".chat-message");
    if (!msg) return;
    const kind = msg.getAttribute("data-skin");
    if (kind !== "thinking" && kind !== "tool") return;
    const key = messageKey(msg);
    // 点击后 aria-expanded 会翻转：当前为 false 表示这次点击是「展开」→ 固定为展开
    const willOpen = btn.getAttribute("aria-expanded") === "false";
    if (willOpen) {
      state.pinned.add(key);      // 手动展开 → 固化，之后不再自动折叠
      state.autoFolded.delete(key);
    } else {
      state.pinned.delete(key);   // 手动折叠 → 也不再自动动它
      state.autoFolded.add(key);
    }
    savePins();
  }, true);
}


function start() {
  injectStyle();
  loadPins();   // 只读「手动展开过哪些块 / 已自动折过哪些块 / 已判定的回声」这类运行时记忆
  watchUserToggles();
  apply();
  if (state.observer) state.observer.disconnect();
  state.observer = new MutationObserver(() => schedule());
  // 只观察结构变化（不观察 characterData，避免流式输出时高频触发）
  state.observer.observe(document.body, { childList: true, subtree: true });
  if (!state.interval) state.interval = setInterval(() => schedule(0), 2000);
}

// ============ 自动启动（独立注入版：每页加载即生效，无需点任何 tab） ============

window.__chatSkin = {
  apply,
  stats: () => ({
    applyCount: state.applyCount,
    pinned: state.pinned.size,
    autoFolded: state.autoFolded.size,
    echoKeys: state.echoKeys.size,
    echoMode: state.echoMode,
    autoFold: state.autoFold,
  }),
};

function boot() {
  try { start(); } catch (err) { console.warn("[chat-skin] boot failed:", err); }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();

