<p align="center">
  <img src="/img/head2.png" alt="Folia" width="100%" />
</p>

<div align="center">

# Folia Major (setube 版)

Lyrics Reimagined // 辞曲新境

基于 [chthollyphile/folia-major](https://github.com/chthollyphile/folia-major) 的二次开发版本

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

## 关于本项目

本仓库是 Folia Major 的二次开发分支，在上游版本的基础上增加了若干上游未纳入规划的功能。

上游项目是一个以全屏沉浸式歌词播放为核心的音乐播放器，支持网易云、酷狗、Navidrome 和本地音乐库，通过智能歌词匹配、AI 生成配色主题以及多种全屏歌词动画提供听歌体验。核心功能与架构均来自上游，本仓库仅在其之上做增量修改。

> [!IMPORTANT]
> 本仓库与上游项目**没有隶属关系**，并非官方分支，请勿向上游反馈本仓库引入的问题。
> 如果你需要的是原版，请前往 [chthollyphile/folia-major](https://github.com/chthollyphile/folia-major)。

## 相对上游的改动

### 桌面端窗口与启动行为

- **关闭到托盘**：点击窗口关闭按钮时隐藏到系统托盘而非退出应用，与原有的「最小化到托盘」独立，可任意组合。托盘不可用或应用正在退出时不会拦截关闭，避免窗口消失后无法找回。
- **开机自动运行**：登录系统后自动启动。仅 macOS / Windows 生效，Linux 上显示为不可用并提示手动创建 autostart 项。

### 启动时的播放行为

- **启动时自动播放**：恢复上次会话后立即开始播放。
- **启动时记住上一次播放进度**：记录当前歌曲的播放位置，下次启动恢复同一首歌时从该位置继续。开头与结尾附近的进度不会记录。

### 随机播放模式

在原有的顺序播放、列表循环、单曲循环之外新增随机播放，切换链为 `顺序 → 列表循环 → 单曲循环 → 随机`。

与上游已有的「随机打乱播放队列」不同：后者会永久改变队列顺序，本模式保持队列顺序不变，只改变推进顺序，关闭后即可回到原始顺序。

实现上采用「一轮内顺序预先确定」的路线图模型，因此：下一首可预知（预取有效）、随机顺序可跨会话恢复、「下一首播放」在随机模式下依然生效。

## 核心能力

| 模块 | 说明 |
| --- | --- |
| 在线搜索与播放 | 搜索歌曲、歌手或专辑后即可播放，并自动加载相关封面与歌词。 |
| 本地音乐支持 | 可导入本地音频文件，在本地保存索引信息，不上传文件内容。 |
| 智能歌词匹配 | 本地歌曲可自动匹配在线歌词与封面，也支持手动修正匹配结果。 |
| 本地歌词文件识别 | 自动加载同目录同名 `.lrc`、`.vtt`、`.ttml`、`.qrc`、`.yrc`、`.krc` 歌词文件。 |
| Now Playing 接入 | 支持通过本机 Now Playing 服务接入外部播放器的歌曲、时间轴与歌词信息。 |
| AI 主题生成 | 基于歌曲情绪与歌词内容生成沉浸式背景与视觉参数。 |
| 多端体验 | 提供 Web 部署方式，同时支持桌面端打包分发。 |

![visualizer](./img/visualizer.png)

## 构建与开发

本项目要求 Node.js 24 或更高版本。

```bash
npm install
cp .env.example .env.local   # 按需填写环境变量
npm run dev                  # Web 开发服务器
npm run dev:electron         # Electron 开发模式
npm run build:electron       # 打包桌面端
```

需要自行部署 [NeteaseCloudMusicApiEnhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) 提供后端服务，并配置 `VITE_NETEASE_API_BASE`。AI 主题功能需要配置 Gemini 或 OpenAI 兼容接口。详细的环境变量说明见 [.env.example](.env.example) 与上游的[技术说明文档](docs/technical.md)。

## 法律与免责声明

本项目主要用于展示播放动效、界面设计与相关工程实现。应用中涉及的在线音乐流媒体、歌词、专辑封面及其他内容，其版权均归对应权利人所有。

本仓库及其源代码仅供个人学习、技术交流与非营利测试使用。请勿将其用于商业盈利用途。若因对在线资源的传播、加工或再分发而引发版权纠纷或其他责任，均由使用者自行承担，项目开发者不承担相关责任。

请始终尊重数字版权，并在条件允许时通过官方平台支持正版音乐。

## 版权与许可

本项目基于 `AGPL-3.0` 许可证开源，与上游项目保持一致。

原始项目版权归 **chthollyphile** 及其贡献者所有：

- 上游仓库：<https://github.com/chthollyphile/folia-major>
- 上游贡献者名单：[CONTRIBUTORS.md](CONTRIBUTORS.md)
- 许可证全文：[LICENSE](LICENSE)

本仓库在上游代码基础上进行修改，修改内容以 commit 历史为准，同样以 AGPL-3.0 授权。依据 AGPL-3.0，任何基于本项目的衍生作品在分发或通过网络提供服务时，同样需要以 AGPL-3.0 开放源代码。

## 致谢

特别感谢上游项目 [chthollyphile/folia-major](https://github.com/chthollyphile/folia-major) 及其全体贡献者。

同时感谢以下项目和资源：

- [chenmozhijin/LDDC](https://github.com/chenmozhijin/LDDC)
- [NeteaseCloudMusicApiEnhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)
- [chenglou/pretext](https://github.com/chenglou/pretext)
- [MakcRe/KuGouMusicApi](https://github.com/MakcRe/KuGouMusicApi)
- [paper-design/shaders](https://github.com/paper-design/shaders)

本项目接入了 [Apple Music-like Lyrics TTML 逐词歌词库](https://github.com/amll-dev/amll-ttml-db) 以提供高质量的歌词文件，感谢此歌词库的作者和贡献者们。
