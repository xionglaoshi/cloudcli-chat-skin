// 会话皮肤 · 插件入口（v1.3.0，2026-09-18）
//
// 皮肤本体已改为「随页面自动注入」：由 cloudcli_chat_skin_patch.sh 把
// ~/.codex/assets/cloudcli-chat-skin/chat-skin.js 复制到 <dist>/assets/chat-skin.js，
// 并在 index.html 里注入一行 <script defer src="/codex/assets/chat-skin.js">。
// 因此本插件不再自己实现皮肤逻辑（避免两份逻辑漂移），只做两件事：
//   ① 兜底加载皮肤脚本（若注入那行因为升级丢失，点一下本 tab 也能把它补上）
//   ② 显示运行统计，供排障自检

const SRC = "/codex/assets/chat-skin.js";

function loadSkin() {
  if (window.__chatSkin) return Promise.resolve("already");
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = `${SRC}?t=${Date.now()}`;
    s.defer = true;
    s.onload = () => resolve(window.__chatSkin ? "loaded" : "loaded-no-api");
    s.onerror = () => resolve("failed");
    document.head.appendChild(s);
  });
}

export async function mount(container) {
  const status = await loadSkin();
  if (!container) return;
  const stats = window.__chatSkin?.stats ? window.__chatSkin.stats() : null;
  container.innerHTML = `
    <div style="padding:16px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;font-size:13px;line-height:1.7;color:var(--foreground)">
      <div style="font-size:15px;font-weight:600;margin-bottom:6px">会话皮肤 v1.3.0（已固化 · 自动注入）</div>
      <div style="color:var(--muted-foreground)">
        皮肤状态：<b>${window.__chatSkin ? "已挂载" : "未挂载（" + status + "）"}</b><br>
        ${stats ? `扫描 ${stats.applyCount} 次 · 手动展开保持 ${stats.pinned} · 已自动折 ${stats.autoFolded} · 已隐藏回声 ${stats.echoKeys}` : ""}
      </div>
      <div style="margin-top:12px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--muted)">
        <b>固化设置（2026-09-18 用户拍板，无调整入口）</b><br>
        · 自动折叠：<b>开</b>（每块最多自动折一次）<br>
        · 手动展开：<b>永久保持</b>（应用自己折了会重新展开）<br>
        · 思考回声：<b>隐藏</b>（最终回复后不再出现「摘要 · 思考回声」）<br>
        · 排版：正文/思考/工具<b>同宽</b>，正文 15.5px
      </div>
      <div style="margin-top:10px;color:var(--muted-foreground)">
        皮肤已随页面自动生效，<b>不需要点任何 tab</b>；本页仅用于状态自检。
      </div>
    </div>`;
}

export function unmount() {}
