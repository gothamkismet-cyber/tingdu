# 参与听读

欢迎通过 [Issues](https://github.com/gothamkismet-cyber/tingdu/issues) 报告问题、提出功能建议，也欢迎提交 Pull Request。

## 开始开发

使用 Node.js 22.12 或更新版本，推荐 Node.js 24。附带的自动检查模板面向 Windows 和 Linux，尚未在仓库启用。Windows PowerShell 如果拦截 `npm.ps1`，把下列 `npm` 写成 `npm.cmd`。

```sh
git clone https://github.com/gothamkismet-cyber/tingdu.git
cd tingdu
npm ci --ignore-scripts
npm test
npm run check
npm start
```

浏览器访问 `http://127.0.0.1:4173/`。`--ignore-scripts` 跳过 Electron 运行环境下载；开发桌面版时执行 `node node_modules/electron/install.js`，再执行 `npm run desktop`。

## 修改约定

- `web/dist/` 就是可编辑的网页源码，没有另一套前端构建目录。页面使用原生 HTML、CSS 和 JavaScript。
- 学习设置、判题、目标和备份格式集中在 `core.js`；页面交互在 `app.js`；朗读和录音在 `audio.js`。
- 更改现有词条时保留其稳定 ID。历史记录、进行中的练习和旧备份需要继续可读。
- 沿用现有颜色变量、夜间模式、键盘操作和减少动态效果选项；有界面变化时检查桌面与窄屏。
- 音色来自用户设备。不要把缺失的英式或日语音色替换成另一种语言或口音。
- 只为有实际行为风险的逻辑补测试。提交前运行 `npm test` 和 `npm run check`，并在 PR 中说明实际页面验证与未验证项。

## 报告问题

请描述使用的系统/浏览器或 APK 版本、复现步骤、实际与预期表现。朗读问题请附音色名称与口音选择。截图中去掉自己的学习内容、用户名和本机路径；不要上传真实学习备份或签名密钥。

## 打包与许可证

打包步骤见 [构建说明](docs/BUILDING.md)。源码仓库不保存安装包、开发工具链、签名凭据或本机学习记录。发布包放在 GitHub Releases。

向本项目提交内容，即表示你有权按项目的 MIT 许可证贡献这些内容。引入第三方资源时请同时提供来源与许可证。
