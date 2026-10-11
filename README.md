# cloudcli-chat-skin

CloudCLI 会话界面皮肤（v1.3.0）：统一正文、思考与工具块的宽度及排版；一轮完成后自动折叠前轮过程块，保留当前页面中手动展开的状态，并隐藏重复的思考回声。

## 安装

```sh
git clone https://github.com/xionglaoshi/cloudcli-chat-skin.git
cd cloudcli-chat-skin
sh install.sh /path/to/cloudcli/dist
mkdir -p ~/.claude-code-ui/plugins/cloudcli-chat-skin/dist
cp manifest.json ~/.claude-code-ui/plugins/cloudcli-chat-skin/
cp dist/index.js ~/.claude-code-ui/plugins/cloudcli-chat-skin/dist/
```

`install.sh` 将 `assets/chat-skin.js` 复制到 CloudCLI 的静态资源目录，并备份、修改 `index.html`，使皮肤随页面加载。默认部署子路径为 `/codex`；其他部署路径需同步修改 `install.sh` 的注入 URL 和 `dist/index.js` 的 `SRC`。安装目录需具备写权限。

插件 tab 只用于加载兜底与状态自检；核心逻辑在 `assets/chat-skin.js`。升级 CloudCLI 后需再次运行安装脚本，随后刷新页面。运行中不读写 localStorage/sessionStorage；手动展开记录只存在当前页面内存，刷新后清空。

## 文件与自检

- `assets/chat-skin.js`：核心脚本，从既有重建教程恢复。
- `install.sh`：静态脚本安装与页面注入，重复运行会刷新脚本并避免重复注入。
- `manifest.json`、`dist/index.js`：CloudCLI 插件元数据及入口。

```sh
node --check assets/chat-skin.js
node --input-type=module --check < dist/index.js
bash -n install.sh
```

皮肤依赖 CloudCLI 的消息 DOM 契约。宿主改变结构时可能无法命中，可在插件状态页核对统计。MIT 授权，见 [LICENSE](LICENSE)。
