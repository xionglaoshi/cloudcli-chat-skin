#!/bin/bash
# CloudCLI「会话皮肤」注入补丁 —— 2026-09-18 建
#
# 背景：官方插件机制只在「插件自己的 tab 被激活」时才挂载它，所以插件版皮肤每次刷新都要
#       手动点一次 tab。用户要求「打开每个会话默认就是这套皮肤，不需要手动开启」。
#
# 做法（不改 CloudCLI 源码逻辑，只加一行 <script> + 一个我们自己的静态文件）：
#   ① 把 ~/.codex/assets/cloudcli-chat-skin/chat-skin.js 复制到 <dist>/assets/chat-skin.js
#   ② 在 <dist>/index.html 的 </head> 前注入
#        <script defer src="/codex/assets/chat-skin.js"></script>
#      （前缀 /codex 与现有子路径补丁一致；插件里那份仍是同一套逻辑的入口）
#
# 幂等：已注入则只刷新静态文件；找不到 </head> 会报错退出。brew/npm 升级覆盖 dist 后，
#       由 cloudcli_mac_start.sh 每次启动自动重打。
set -eu

DIST="${1:-${CLOUDCLI_DIST:-/opt/homebrew/lib/node_modules/@cloudcli-ai/cloudcli/dist}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/assets/chat-skin.js"
ARCHIVE="$HOME/.codex/_archive/cloudcli-chat-skin-patch/$(date +%Y%m%d-%H%M%S)"
TAG='<script defer src="/codex/assets/chat-skin.js"></script>'

[ -f "$SRC" ] || { echo "chat-skin 源文件不存在: $SRC" >&2; exit 1; }
[ -d "$DIST/assets" ] || { echo "dist/assets 不存在: $DIST" >&2; exit 1; }

# ① 静态文件
mkdir -p "$DIST/assets"
if [ ! -f "$DIST/assets/chat-skin.js" ] || ! cmp -s "$SRC" "$DIST/assets/chat-skin.js"; then
	mkdir -p "$ARCHIVE"
	[ -f "$DIST/assets/chat-skin.js" ] && cp -p "$DIST/assets/chat-skin.js" "$ARCHIVE/chat-skin.js.bak" || true
	cp -f "$SRC" "$DIST/assets/chat-skin.js"
	chmod 644 "$DIST/assets/chat-skin.js"
	echo "已更新静态文件: $DIST/assets/chat-skin.js"
else
	echo "静态文件已是最新: $DIST/assets/chat-skin.js"
fi

# ② index.html 注入
HTML="$DIST/index.html"
[ -f "$HTML" ] || { echo "index.html 不存在: $HTML" >&2; exit 1; }
if grep -qF "assets/chat-skin.js" "$HTML"; then
	echo "index.html 已注入，无需改动"
else
	mkdir -p "$ARCHIVE"
	cp -p "$HTML" "$ARCHIVE/index.html.bak"
	/usr/bin/env python3 - "$HTML" "$TAG" <<'PY'
import sys
path, tag = sys.argv[1], sys.argv[2]
html = open(path, encoding="utf-8").read()
if "</head>" not in html:
    print("FAIL 找不到 </head>，未改动")
    raise SystemExit(2)
html = html.replace("</head>", f"  {tag}\n</head>", 1)
open(path, "w", encoding="utf-8").write(html)
print("已注入 index.html:", tag)
PY
	echo "index.html 备份: $ARCHIVE/index.html.bak"
fi

