// electron/launchAtLogin.cjs
// 开机自启的平台判定与登录项参数构造，从 main.cjs 抽出以便单测覆盖。

// Electron 的 setLoginItemSettings 只在 macOS 与 Windows 上生效；
// Linux 需要用户自行创建 autostart 的 .desktop 文件。
const SUPPORTED_PLATFORMS = ['darwin', 'win32'];

// 静默启动标记：写进登录项参数，主进程启动时据此决定要不要直接把主窗收进任务栏。
const SILENT_LAUNCH_FLAG = '--folia-silent-launch';
// 两种启动模式写入的登录项参数不同，读取时要逐个探测，否则切换模式后会误报未开启。
const LAUNCH_AT_LOGIN_MODES = ['silent', 'foreground'];

function isLaunchAtLoginSupported(platform) {
  return SUPPORTED_PLATFORMS.includes(platform);
}

/**
 * 构造 Windows 登录项的定位参数。
 * 未打包时 process.execPath 指向 Electron 本体，直接注册会让开机启动的是 Electron
 * 而不是 Folia，因此显式带上应用入口路径。
 *
 * 读写必须共用这一组参数：getLoginItemSettings 在 Windows 上是把注册表里的启动命令
 * 与 path + args 拼出的字符串做全等比较，写入时带了静默标记而读取时不带，
 * 会匹配不到刚写入的记录并误报未开启 —— 所以 mode 也要参与查询。
 */
function buildLoginItemQuery({ execPath, isPackaged, appPath, mode }) {
  const isSilent = mode === 'silent';

  if (isPackaged || !appPath) {
    return isSilent ? { args: [SILENT_LAUNCH_FLAG] } : {};
  }

  return {
    path: execPath,
    args: isSilent ? [appPath, SILENT_LAUNCH_FLAG] : [appPath],
  };
}

function buildLoginItemSettings({ enabled, mode, execPath, isPackaged, appPath }) {
  const normalizedMode = mode === 'foreground' ? 'foreground' : 'silent';

  return {
    openAtLogin: Boolean(enabled),
    // openAsHidden 只在 macOS 生效，Windows 靠 SILENT_LAUNCH_FLAG 参数区分。
    openAsHidden: normalizedMode === 'silent',
    ...buildLoginItemQuery({ execPath, isPackaged, appPath, mode: normalizedMode }),
  };
}

/** 主进程启动时判断本次是不是登录项拉起的静默启动。 */
function isSilentLaunch(argv) {
  return Array.isArray(argv) && argv.includes(SILENT_LAUNCH_FLAG);
}

/**
 * 改过 appId 之前写下的自启项。Electron 用 AppUserModelID 当注册表值名，
 * 只管得到当前这个名字，旧名字下的那条会一直留着重复拉起老路径，必须显式清理。
 */
const LEGACY_APP_USER_MODEL_IDS = ['top.izuna.foliamajor'];

module.exports = {
  SILENT_LAUNCH_FLAG,
  LAUNCH_AT_LOGIN_MODES,
  LEGACY_APP_USER_MODEL_IDS,
  isLaunchAtLoginSupported,
  isSilentLaunch,
  buildLoginItemQuery,
  buildLoginItemSettings,
};
