# 第三方组件说明

听读自身的源码与项目资源使用 [MIT 许可证](LICENSE)。依赖和系统组件仍遵循各自的许可证。

| 组件 | 用途 | 许可证与来源 |
| --- | --- | --- |
| Electron 44.7.0 | Windows 桌面运行环境，包含 Chromium、Node.js 等组件 | [Electron / MIT](https://github.com/electron/electron/blob/main/LICENSE)；具体版本的许可证及第三方声明随 Windows 运行环境保留 |
| electron-builder 26.15.3 | 本地 Windows 打包工具 | [electron-builder / MIT](https://github.com/electron-userland/electron-builder/blob/master/LICENSE)，仅作为开发依赖 |
| 系统字体、语音引擎、Android WebView | 界面字体、朗读和手机版页面承载 | 由用户设备或系统提供，不将这些资源的权利归入本项目 |

Windows 便携包中的 Electron 运行文件保留 `LICENSE.electron.txt` 和 `LICENSES.chromium.html`；程序解包后的运行目录可查看这些文件。应用自身的 `LICENSE` 和本说明也随软件包提供。Android APK 的 `assets/` 中附有 `LICENSE.txt` 和本说明。

JDK 与 Android SDK 是构建工具，不存入源码仓库，也不作为完整工具链随应用分发。开发依赖的详细版本与来源记录在 `package-lock.json`，各依赖的许可证保留在安装后的包目录中。
