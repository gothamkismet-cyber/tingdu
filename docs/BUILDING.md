# 构建听读

## 环境

- Node.js 22.12 或更新版本，推荐 Node.js 24。
- Windows 便携版：在 Windows x64 上构建，使用锁定的 Electron 和 electron-builder。
- Android：JDK 17、Android SDK Platform 35、Build Tools 35.0.0。当前构建验证在 Windows 完成，不需要 Gradle。
- 首次安装依赖、Electron、JDK 或 Android SDK 需要网络；这些工具不随源码仓库上传。

Windows PowerShell 中可将下文 `npm` 写成 `npm.cmd`。

## 网页与自动检查

```sh
npm ci --ignore-scripts
npm test
npm run check
npm start
```

浏览器访问 `http://127.0.0.1:4173/`。这里的 `web/dist/` 就是源文件，不需要再编译前端。服务启动后，Windows 可在另一个终端运行 `node scripts/check-audio.mjs` 检查本机语音接口；这不能证明实际扬声器音质。

## Windows 便携版

```sh
npm ci
npm run desktop
npm run build:exe
```

如果先前使用了 `npm ci --ignore-scripts`，请先执行 `node node_modules/electron/install.js` 下载 Electron 运行环境。

`build:exe` 现在输出 `release/听读-<版本号>-Windows-x64.zip`，其中包含可以直接运行的 `听读.exe` 和必需运行文件。发布时复制为英文文件名 `tingdu-<版本号>-windows-x64.zip`，不改变文件内容。完整解压一次后直接运行，免去每次启动解包的开销；保留整个文件夹。构建时的展开目录是 `release/win-unpacked/`。当前没有 Windows 代码签名证书。

若确实需要旧式单文件包，可运行 `npm run build:portable`，输出 `release/听读-<版本号>-Windows-x64.exe`。它每次启动会解压运行环境，速度慢于文件夹版，因此不作为默认下载。

包内包含项目 LICENSE、第三方声明，以及 Electron / Chromium 自带的许可文件。请保留这些文件。

桌面版支持诊断参数 `--verify-startup` 和 `--diagnostic-output=<绝对路径.json>`。两者一起使用时，诊断数据写入输出文件，学习数据隔离在该文件父目录下的 `desktop-test-data/`。`renderer.pageReadyMs` 是页面内部的就绪时间，不包含进程启动；声音探测与生成音频单独检查，不再阻塞页面就绪。比较完整启动耗时应从外部启动进程计时到日志的 `window-loaded` / `renderer-ready`。诊断检查页面加载和保存，不等于完成了真实窗口、麦克风和声音体验验证。

## Android APK

从 [Adoptium](https://adoptium.net/temurin/releases/?version=17) 获取 JDK 17，并从 [Android 官方工具页面](https://developer.android.com/tools) 获取 SDK 命令行工具。按工具说明安装平台和构建工具：

```sh
sdkmanager "platforms;android-35" "build-tools;35.0.0"
```

在 PowerShell 中设置实际安装路径后构建：

```powershell
$env:JAVA_HOME = 'C:\Tools\jdk-17'
$env:ANDROID_HOME = 'C:\Tools\android-sdk'
npm.cmd run build:apk
```

也可放在项目内的 `.toolchain/jdk/` 与 `.toolchain/android-sdk/`；设置环境变量时优先使用环境变量。脚本选择 SDK 目录中版本最高的平台和 Build Tools，复现本版时建议只安装上述已验证版本。

Windows 的 Android 资源工具需要纯英文暂存路径。脚本优先使用 `TINGDU_ANDROID_BUILD` 指定的英文路径，其次使用项目 `build/android/` 或系统临时目录。需要手动指定时：

```powershell
$env:TINGDU_ANDROID_BUILD = 'C:\tingdu-build'
npm.cmd run build:apk
```

每次构建都会在暂存目录下新建独立的 `run-*` 子目录，**不会清空你指定的目录**。中间文件保留，确认不再需要后可自行清理对应子目录。

输出为 `release/听读-<版本号>-Android.apk`，公开下载名为 `tingdu-<版本号>-android.apk`。脚本检查签名、必需资源和资源路径；项目许可放在包内 `assets/LICENSE.txt` 和 `assets/THIRD_PARTY_NOTICES.md`。

### 签名与更新

第一次构建会在 `android/signing/` 创建本地签名密钥与密码文件。这个目录被 Git 忽略，请单独妥善备份。后续更新需要相同密钥，不能把它提交到 GitHub。

自己构建或 fork 后生成的密钥与官方 APK 不同，因此不能直接覆盖官方应用；必要时先导出学习备份，再卸载旧应用、安装自己的版本并恢复。保留本项目原密钥构建的版本可继续覆盖更新。

## 发布检查

1. 同步 `package.json` 和 `package-lock.json` 版本，更新更新记录和说明。
2. 在干净源码目录中运行 `npm ci --ignore-scripts`、`npm test`、`npm run check`。
3. 打包 Windows 与 Android，核对包内源码、许可、APK 签名和桌面诊断。
4. 实际检查界面与有条件验证的设备功能，明确记录未验证项。
5. 仅把源码、测试、文档和公开截图提交到仓库；安装包放入 GitHub Release。
6. 给两个发布文件生成 SHA-256 校验值，并核对上传后的名称与大小。

## 启用 GitHub 自动检查

仓库提供 [ci.yml 模板](ci.yml)，在 Node.js 24 的 Windows / Linux 环境运行测试和源码检查。当前模板尚未启用；将它复制到 `.github/workflows/ci.yml` 并提交即可启用。通过 OAuth 凭据推送时需要包含 `workflow` 权限。

模板仅运行检查，不持有签名凭据，也不自动生成或上传发布包。

## 当前开发依赖提示

2026-10-09 的 `npm audit` 报告 8 个中等级别受影响依赖，来自打包工具间接使用的 `sprintf-js` 格式化异常问题（[GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)）。这些依赖用于本地构建，没有打入应用自身的源码包；生产依赖检查为 0 项告警。这不代表 Electron 运行环境经过完整安全审计。

该公告目前没有列出修复版本；npm 建议的自动修复会把 electron-builder 从 26.15.3 降到 26.5.0。本版保留已验证的构建版本，没有执行强制降级。升级构建依赖时需重新检查这项公告和实际打包结果。
