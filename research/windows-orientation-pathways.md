# Windows 主显示器横竖屏程序化切换：可行通路研究

> 研究日期：2026-09-29；本机环境：Windows（Console 会话，非 RDP），双屏。
> 目标读者：DSH 插件 host 半（与屏幕同机的 Node 进程，用 `child_process` 起 `pwsh` 或拉起 CLI）。
> 方法：只认一手来源（Microsoft Learn Win32 文档、PowerShell 官方文档、工具官网/仓库）。
> 本机实测只做了**只读查询**（`EnumDisplaySettings`），**没有执行任何真实旋转**。

## 结论先行（推荐排序）

| 排序 | 通路 | 需管理员 | 需重启/注销 | 是否持久 | 备注 |
|---|---|---|---|---|---|
| 1 | 纯 PowerShell P/Invoke：`ChangeDisplaySettingsEx` + `DEVMODE.dmDisplayOrientation` | 否（`CDS_UPDATEREGISTRY` 写 USER profile；仅 `CDS_GLOBAL` 涉及全用户） | 否（返回 `DISP_CHANGE_RESTART` 时才需重启，属例外） | 是（带 `CDS_UPDATEREGISTRY`；不带则仅动态、注销丢失） | 零依赖，DSH host 半直接 `pwsh -Command` 调用，**首选** |
| 2 | 捆绑 CLI：NirSoft **MultiMonitorTool** `/SetOrientation` | 否（用户态 display API；官网未标注提权要求） | 否 | 立即生效；官网未明示是否写注册表持久化，关键场景建议验证或配 `/LoadConfig` 开机任务 | 单文件免安装，适合不想写 P/Invoke 的降级方案；注意杀软对 NirSoft 偶发误报 |
| 3 | P/Invoke：CCD `QueryDisplayConfig` + `SetDisplayConfig` 改 `targetInfo.rotation` | 否（控制台会话；**RDP 远端会话明确拒绝**） | 否 | `SDC_SAVE_TO_DATABASE` 则持久，否则临时 | 功能最强（可精确到单 path），但结构体多、代码量大；仅当通路 1 在目标机器上被驱动/GPO 挡住时考虑 |
| 4 | 12noon **Display Changer X**（DCX 配置文件） | 否 | 否 | 配置文件即持久状态 | 支持 rotation，但走微软商店付费授权（10  license 起），最后手段 |
| — | `nircmd setdisplay` | — | — | — | **不能转方向**（官方语法无 orientation 参数），排除 |
| — | `QRes` | — | — | — | **只能改分辨率/色深**，Win95–XP 时代工具，排除 |
| — | `display-switch.exe`（haimgel/display-switch） | — | — | — | USB KVM 输入切换器，**重名、与旋转无关**，排除 |

---

## 1. `ChangeDisplaySettingsEx` + `DEVMODE.dmDisplayOrientation`（主通路）

### 1.1 MS 文档依据

- 函数页：<https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-changedisplaysettingsexw>
  - 签名：`LONG ChangeDisplaySettingsExW(LPCWSTR lpszDeviceName, DEVMODEW *lpDevMode, HWND hwnd, DWORD dwflags, LPVOID lParam)`；`hwnd` 保留必须 `NULL`。
  - `lpszDeviceName`：只能是 `EnumDisplayDevices` 返回的设备名（如 `\\.\DISPLAY1`）；`NULL` = 默认显示设备（文档注明用 `DISPLAY_DEVICE_PRIMARY_DEVICE` 判定）。
  - 关键 flags：`0`=动态改当前屏；`CDS_TEST`=只测不改；`CDS_UPDATEREGISTRY`=动态改**并写注册表**；`CDS_NORESET`=只写注册表不生效；`CDS_GLOBAL`（必须配 `CDS_UPDATEREGISTRY`）=存全局影响全用户；`CDS_SET_PRIMARY`=设主屏。
  - 持久化原文：“If CDS_UPDATEREGISTRY is specified … the information is stored in the registry”；且 **“The mode information is stored in the USER profile.”**（同页 `ChangeDisplaySettings` 文档亦同：<https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-changedisplaysettingsa>）→ 带该 flag 注销/重启后仍在；不带（`dwFlags=0`）则纯动态。
  - 返回码：`DISP_CHANGE_SUCCESSFUL / BADDUALVIEW / BADFLAGS / BADMODE / BADPARAM / FAILED / NOTUPDATED / RESTART`（`RESTART`=必须重启才生效）。
  - **权限说明：MS 文档全文无管理员/提权要求**（与 `SetDisplayConfig` 的 `ERROR_ACCESS_DENIED` 条款对照，见 §2）。普通用户动态切换 + 写自身 USER profile 即够；只有 `CDS_GLOBAL`（全用户）才隐含提权。
- 结构体页：<https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-devmodea>
  - `dmDisplayOrientation` 仅对显示设备有效，需配 `dmFields & DM_DISPLAYORIENTATION`。取值（注意是**逆时针**起算）：
    - `DMDO_DEFAULT`（自然方向）、`DMDO_90`（逆时针 90°）、`DMDO_180`、`DMDO_270`（= 顺时针 90°）。
  - 数值按 SDK `wingdi.h` 为 0/1/2/3，社区两处独立实现一致（见 §1.2）。
  - 原文：“To determine whether the display orientation is portrait or landscape orientation, check the ratio of `dmPelsWidth` to `dmPelsHeight`.” → 90°/270° 竖屏时**必须对调宽高**，否则大概率 `DISP_CHANGE_BADMODE`（见 §4.1）。
  - 调用前必须 `dmSize = sizeof(DEVMODE)`；文档 Remarks 要求“用 `EnumDisplaySettings` 返回的 DEVMODE 做基线再改”。
- 基线查询页：<https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enumdisplaysettingsa>（`ENUM_CURRENT_SETTINGS`=-1 取当前；`ENUM_REGISTRY_SETTINGS`=-2 取注册表存值）。
- 设备枚举页：<https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enumdisplaydevicesa>（`\\.\DISPLAYx` 名称来源）。
- P/Invoke 机制（PowerShell 官方）：<https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/add-type?view=powershell-7.5>（Example 4 明确 `Add-Type` + `[DllImport("user32.dll")]` 调原生 API；`MemberDefinition` 即 P/Invoke 通道）。

### 1.2 PowerShell `Add-Type` C# P/Invoke 现成写法（2 个独立来源）

**来源 A — GitHub `gmiwoj/Windows-Display-Orientation-Script`（MIT，PowerShell）：**
<https://github.com/gmiwoj/Windows-Display-Orientation-Script>（脚本原文：<https://raw.githubusercontent.com/gmiwoj/Windows-Display-Orientation-Script/main/windows-display-orientation-script.ps1>）
关键行（已逐行核对，全文拉取）：

```csharp
[DllImport("user32.dll")]
internal static extern DISP_CHANGE ChangeDisplaySettingsEx(
    string lpszDeviceName, ref DEVMODE lpDevMode, IntPtr hwnd,
    DisplaySettingsFlags dwflags, IntPtr lParam);
…
int temp = dm.dmPelsHeight; dm.dmPelsHeight = dm.dmPelsWidth; dm.dmPelsWidth = temp; // 先对调宽高
dm.dmDisplayOrientation = NativeMethods.DMDO_270; // 按参数 0/90/180/270 顺时针映射
DISP_CHANGE iRet = NativeMethods.ChangeDisplaySettingsEx(
    d.DeviceName, ref dm, IntPtr.Zero,
    DisplaySettingsFlags.CDS_UPDATEREGISTRY, IntPtr.Zero);
```

该脚本用 `EnumDisplayDevices(null, deviceID, …)` 拿 `DeviceName`，再 `EnumDisplaySettings(d.DeviceName, ENUM_CURRENT_SETTINGS, …)` 取基线。注意它把 CLI 角度（顺时针）换算成了 `DMDO_*`（逆时针）：`90顺时针→DMDO_270(3)`，恰好印证 MS“逆时针起算”语义。

**来源 B — Stack Overflow Q12644786 回答（Amrinder，得票 10，`Add-Type` + `ChangeDisplaySettings`）：**
<https://stackoverflow.com/questions/12644786/powershell-script-to-change-screen-orientation>（回答 `id=24346514`，API 全文已拉取）
关键行：

```csharp
[DllImport("user32.dll")]
public static extern int ChangeDisplaySettings(ref DEVMODE devMode, int flags);
public const int DMDO_DEFAULT = 0; public const int DMDO_90 = 1;
public const int DMDO_180 = 2;     public const int DMDO_270 = 3;
…
int temp = dm.dmPelsHeight; dm.dmPelsHeight = dm.dmPelsWidth; dm.dmPelsWidth = temp; // 同样先对调
int iRet = NativeMethods.ChangeDisplaySettings(ref dm, NativeMethods.CDS_TEST);      // 先 TEST
iRet = NativeMethods.ChangeDisplaySettings(ref dm, NativeMethods.CDS_UPDATEREGISTRY); // 再真正写
```

并按返回值区分 `DISP_CHANGE_SUCCESSFUL / DISP_CHANGE_RESTART（提示重启）/ FAILED`。注意它用的是不带 `Ex` 的 `ChangeDisplaySettings`——**只能动默认（主）屏**；多屏指定 `\\.\DISPLAYx` 必须用 `ChangeDisplaySettingsEx`（来源 A 写法）。

辅助印证 — SO Q47652252 accepted answer 给出同样映射 `0=Default, 1=90°逆时针, 2=180°, 3=270°(顺时针90°)`：<https://stackoverflow.com/questions/47652252/change-screen-orientation-with-powershell-where-are-the-registry-values-stored>。

---

## 2. `SetDisplayConfig` / CCD API 旋转路径

### MS 文档依据

- `SetDisplayConfig`：<https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setdisplayconfig>
  - 签名：`LONG SetDisplayConfig(UINT32 numPathArrayElements, DISPLAYCONFIG_PATH_INFO *pathArray, UINT32 numModeInfoArrayElements, DISPLAYCONFIG_MODE_INFO *modeInfoArray, UINT32 flags)`。
  - 旋转落在 path 的 target 端：`DISPLAYCONFIG_PATH_TARGET_INFO.rotation`（见 <https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-displayconfig_path_target_info>：“rotation — A value that specifies the rotation of the target”）。
  - 取值 `DISPLAYCONFIG_ROTATION`：<https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ne-wingdi-displayconfig_rotation>（`IDENTITY=1` 横屏，`ROTATE90=2` 顺时针 90° 竖屏，`ROTATE180=3`，`ROTATE270=4`；**注意这套是顺时针、且从 1 起，**与 `DMDO_*` 0 起逆时针不同，不要混用）。
  - **可以只转主屏**：`pathArray` 里只把主屏所在 active path 的 `targetInfo.rotation` 改掉，其余 path 原样回填，flags 用 `SDC_APPLY | SDC_USE_SUPPLIED_DISPLAY_CONFIG`；加 `SDC_SAVE_TO_DATABASE` 则写入 CCD 数据库持久化，不加则临时。标准流程是先 `QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS)` 取现状（<https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-querydisplayconfig>，MS 给了完整 C++ 枚举示例，`GetDisplayConfigBufferSizes` + `QueryDisplayConfig` 循环处理 `ERROR_INSUFFICIENT_BUFFER`），改完再 `SetDisplayConfig`；先用 `SDC_VALIDATE | SDC_USE_SUPPLIED_DISPLAY_CONFIG` 试算。
- **远端会话限制（一手）**：`SetDisplayConfig` 返回码表明确 `ERROR_ACCESS_DENIED` = “The caller does not have access to the console session. This error occurs if the calling process does not have access to the current desktop **or is running on a remote session**.”`QueryDisplayConfig` 同理。→ **RDP 里 CCD 这条路是被文档明确拒绝的**。
- 评估：协议上最精细，但 PowerShell 下要手写 `DISPLAYCONFIG_PATH_INFO / MODE_INFO / LUID` 等一串 P/Invoke，沒有“一行命令”形态；且同样受驱动/GPO 限制。对 DSH host 半而言是通路 1 失败时的备用，不是首选。

---

## 3. 现成 CLI

### 3.1 ✅ NirSoft MultiMonitorTool — `/SetOrientation`（可转，推荐捆绑）

- 官网：<https://www.nirsoft.net/utils/multi_monitor_tool.html>（页面原文已拉取）。
- 语法（官网命令参考区原文）：
  - `MultiMonitorTool.exe /SetOrientation <Monitor> <Orientation [0, 90, 180, 270]>`
  - 示例：`MultiMonitorTool.exe /SetOrientation 2 270`；`MultiMonitorTool.exe /SetOrientation \\.\DISPLAY2 180`；`MultiMonitorTool.exe /SetOrientation 1 0 2 0`（一次转多屏）。
  - 完整配置形态：`MultiMonitorTool.exe /SetMonitors "Name=\\.\DISPLAY1 Primary=1 BitsPerPixel=32 Width=1920 Height=1080 DisplayFlags=0 DisplayFrequency=60 DisplayOrientation=0 PositionX=0 PositionY=0" …`（v2.00 changelog，`DisplayOrientation` 即方向字段）。
- 官网未标注管理员要求（用户态 display 调用即可）；单文件免安装免费软件；v1.60 引入方向切换，v2.11/2.15 仍在跟进 Win11 24H2 兼容（官网 changelog）。
- 持久化：官网只写“设置监视器”，未明示是否落注册表；需要“注销后还在”请实测验证，或改用 §1 的 `CDS_UPDATEREGISTRY` 路径。

### 3.2 ❌ nircmd `setdisplay`——无旋转能力（排除，但必须说清）

- 官网：<https://www.nirsoft.net/utils/nircmd.html>（`setdisplay` 细则在 <https://www.nirsoft.net/utils/nircmd2.html>，已拉取原文）。
- 官方语法：`setdisplay {monitor:index/name} [width] [height] [color bits] {refresh rate} {-updatereg} {-allusers}`；示例只有 `nircmd.exe setdisplay 800 600 24`、`setdisplay monitor:1 1024 768 24 90`。**参数止于分辨率/色深/刷新率，没有 orientation。** 多屏可用 `monitor:` 前缀，持久化用 `-updatereg`（`-allusers` 配对），但都与旋转无关。结论：nircmd 不能用于本任务。

### 3.3 ❌ QRes——只能改分辨率/色深（排除）

- 官网：<https://qres.sourceforge.net/>（SourceForge，BSD 开源）。
- 自述：给 Win95/98 QuickRes 套自动化前端，“switch color mode or screen resolution”，支持 NT/2000/XP；**无方向概念**。且是 2005 年归档的老工具。排除。

### 3.4 ⚠️ 12noon Display Changer X——支持 rotation，走配置文件（备选）

- 官网：<https://12noon.com/?page_id=4793>（已拉取）。
- 原文功能：“Change the resolution of any Windows display (**width, height, color depth, refresh rate, scaling, and rotation**) permanently or only while a specific application is running.” 用法：`dcx.exe [path to DCX configuration file]`，命令行即应用配置。支持 Win10/11。
- 约束：微软商店分发、付费授权；老 `dc.exe` 经典版页面已下线（`?page_id=80` 现 404）。需管理员：否（未标注）；持久：配置文件本身即持久。

### 3.5 ❌ display-switch.exe——重名陷阱（排除）

- <https://github.com/haimgel/display-switch> 自述：“Turn a $30 USB switch into a full-featured multi-monitor KVM switch”——是 USB 切换器联动的**输入源/KVM**切换，与屏幕旋转无关。任务中“display-switch.exe setdisplay”应指别的同名小工具，不要与此仓库混淆；本仓库**不可用**。

---

## 4. 失败模式

### 4.1 横竖切换必须对调 `dmPelsWidth / dmPelsHeight`

- 90°/270°（竖屏）必须交换宽高，0°/180° 保持。来源 A、B 两个脚本都先 `swap` 再设方向；MS 文档以“宽高比判定横竖”佐证（§1.1）。
- 不交换而硬设方向 → 驱动判定为不支持的 mode → `DISP_CHANGE_BADMODE`（“The graphics mode is not supported.”）。

### 4.2 多显示器必须传显式 `DeviceName`

- `ChangeDisplaySettingsEx(lpszDeviceName=…)` 传 `EnumDisplayDevices` 给出的 `\\.\DISPLAY1`（主屏判定看 `DISPLAY_DEVICE_PRIMARY_DEVICE`）；不带 `Ex` 的 `ChangeDisplaySettings` **只能改默认屏**（MS 原文：“To change the settings of a specified display device, use ChangeDisplaySettingsEx”）。
- 本机实测 quirks：同一台机器上 `EnumDisplaySettings(NULL, ENUM_CURRENT_SETTINGS)` 在 DSH 起的 `pwsh` 进程里返回失败（0），而显式 `\\.\DISPLAY1` / `\\.\DISPLAY2` 成功（3840×2160、2560×1440，均为 orient 0）。→ **脚本里永远用显式设备名 + 先枚举 present 的 DISPLAYx，不要传 NULL**（§6 查询片段即此写法，已验证）。

### 4.3 被组策略/驱动禁用

- 表现就是 `DISP_CHANGE_BADMODE`（mode 不被支持：驱动裁了竖屏 mode）或 `DISP_CHANGE_FAILED`（“The display driver failed the specified graphics mode.”）。部分核显/OEM 驱动 + 组策略可隐藏“方向”选项，本质都是可用 mode 列表里没有竖屏项。
- 先行探测：`CDS_TEST` 干跑（来源 B 示范），返回成功再真正写；或枚举全部 mode（`EnumDisplaySettings` index 0,1,2…直到返回 0）看有无竖屏项。
- 社区证据（非官方、仅参考）：方向持久化另有一份注册表镜像 `HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers\Configuration\…\00\00` 下 `Rotation`=1~4（1 横屏/2 竖屏/3 横翻/4 竖翻），见 SO 回答 <https://stackoverflow.com/a/60038232>。**不要直接写该键**（驱动私有状态），只作诊断对照。

### 4.4 远程桌面会话限制

- CCD（`Query/SetDisplayConfig`）：MS 文档明确 `ERROR_ACCESS_DENIED`（“running on a remote session”），见 §2。
- `ChangeDisplaySettingsEx`：MS 无逐字 RDP 条款；但 RDP 会话内显示的是虚拟 RDP 显示驱动（非控制台会话物理屏），预期同样受限/行为未定义。DSH 场景是“Node 与屏同机”，必须保证调起 `pwsh` 的进程跑在**控制台会话的交互式桌面**（服务 Session 0、非交互计划任务同样可能失败）。本机 `SESSIONNAME=Console` 下只读查询正常，可作对照基线。

### 4.5 何时要重启/注销、持久性对照

| 写法 | 即时生效 | 注销/重启后 |
|---|---|---|
| `ChangeDisplaySettingsEx(..., 0)` | 是 | 丢失（动态） |
| `ChangeDisplaySettingsEx(..., CDS_UPDATEREGISTRY)` | 是（`SUCCESSFUL`） | 保留（USER profile；显卡控制面板看到的即此值） |
| 返回 `DISP_CHANGE_RESTART` | 否 | 需重启 |
| `SetDisplayConfig(... SDC_APPLY\|SDC_USE_SUPPLIED_DISPLAY_CONFIG)` | 是 | 临时 |
| `+ SDC_SAVE_TO_DATABASE` | 是 | 保留（CCD 数据库） |

---

## 5. 给 DSH host 半的调用建议

1. **默认走 §1**：Node `spawn('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File', rotate.ps1, device, angle])`，脚本内先 `CDS_TEST` 再 `CDS_UPDATEREGISTRY`，按进程退出码 + `DISP_CHANGE_*` 映射报错。
2. **降级走 §3.1**：插件包内带 `MultiMonitorTool.exe`（x64），`execFile(... ['/SetOrientation','\\\\.\\DISPLAY1','90'])`。注意：NirSoft 二进制偶发杀软误报，打包前先过目标环境白名单。
3. 两种都返回 `BADMODE/FAILED` → 认为是驱动/GPO 锁死，转人工提示（勿反复重试，避免闪屏）。
4. 调用进程必须在控制台交互会话；RDP/Service Session 下先自检 `GetSystemMetrics(SM_REMOTESESSION)=0x1000` 再动手。

---

## 6. 可直接跑的最小 PowerShell 片段

> 约定：`dmDisplayOrientation` 0=横屏默认，1=逆时针90°，2=180°，3=顺时针90°（竖屏最常用）。
> 竖屏 =（对调宽高 + orientation 1 或 3）；横屏 =（恢复宽高 + orientation 0）。

### 6.0 只读：查询各屏当前方向（✅ 已在本机验证通过）

本机输出：`\\.\DISPLAY1 orient=0 Landscape 3840x2160`，`\\.\DISPLAY2 orient=0 Landscape 2560x1440`。

```powershell
$code = @'
using System; using System.Runtime.InteropServices;
public class DispRO {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmDeviceName;
    public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
    public int dmFields, dmPositionX, dmPositionY, dmDisplayOrientation, dmDisplayFixedOutput;
    public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmFormName;
    public short dmLogPixels;
    public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
    public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
  }
  [DllImport("user32.dll", CharSet=CharSet.Ansi)]
  public static extern int EnumDisplaySettings(string dev, int mode, ref DEVMODE dm);
}
'@
Add-Type -TypeDefinition $code
$names = @('Landscape(0)','Portrait 90-CCW(1)','Landscape-flipped(2)','Portrait 90-CW(3)')
foreach ($n in 1..4) {
  $dev = "\\.\DISPLAY$n"
  $dm = New-Object DispRO+DEVMODE
  $dm.dmSize = [Runtime.InteropServices.Marshal]::SizeOf($dm)
  if ([DispRO]::EnumDisplaySettings($dev, -1, [ref]$dm)) {
    "$dev orient=$($dm.dmDisplayOrientation) $($names[$dm.dmDisplayOrientation]) $($dm.dmPelsWidth)x$($dm.dmPelsHeight)"
  }
}
```

### 6.1 切换到竖屏（⚠️ 真实改屏，未在本机执行，仅静态核对过签名）

```powershell
# 用法：.\Rotate.ps1 '\\.\DISPLAY1' 3   # 3 = 顺时针90°竖屏；1 = 逆时针90°竖屏
param([string]$Device = '\\.\DISPLAY1', [int]$Orientation = 3)
$code = @'
using System; using System.Runtime.InteropServices;
public class DispRot {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmDeviceName;
    public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
    public int dmFields, dmPositionX, dmPositionY, dmDisplayOrientation, dmDisplayFixedOutput;
    public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmFormName;
    public short dmLogPixels;
    public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
    public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
  }
  [DllImport("user32.dll", CharSet=CharSet.Ansi)]
  public static extern int EnumDisplaySettings(string dev, int mode, ref DEVMODE dm);
  [DllImport("user32.dll", CharSet=CharSet.Ansi)]
  public static extern int ChangeDisplaySettingsEx(string dev, ref DEVMODE dm, IntPtr hwnd, int flags, IntPtr lParam);
}
'@
Add-Type -TypeDefinition $code
$dm = New-Object DispRot+DEVMODE
$dm.dmSize = [Runtime.InteropServices.Marshal]::SizeOf($dm)
if (-not [DispRot]::EnumDisplaySettings($Device, -1, [ref]$dm)) { throw "EnumDisplaySettings failed for $Device" }
$t = $dm.dmPelsWidth; $dm.dmPelsWidth = $dm.dmPelsHeight; $dm.dmPelsHeight = $t  # 竖屏对调宽高
$dm.dmDisplayOrientation = $Orientation
$dm.dmFields = 0x80 -bor 0x80000 -bor 0x100000  # DM_DISPLAYORIENTATION | DM_PELSWIDTH | DM_PELSHEIGHT
$CDS_TEST = 2; $CDS_UPDATEREGISTRY = 1
$rc = [DispRot]::ChangeDisplaySettingsEx($Device, [ref]$dm, [IntPtr]::Zero, $CDS_TEST, [IntPtr]::Zero)
if ($rc -ne 0) { throw "CDS_TEST rejected with code $rc (mode unsupported?)" }
$rc = [DispRot]::ChangeDisplaySettingsEx($Device, [ref]$dm, [IntPtr]::Zero, $CDS_UPDATEREGISTRY, [IntPtr]::Zero)
if ($rc -eq 0) { "OK: $Device -> orientation $Orientation" }
elseif ($rc -eq 1) { "OK but RESTART required (code 1)" }
else { throw "ChangeDisplaySettingsEx failed with code $rc" }
```

### 6.2 切回横屏

```powershell
# 用法：.\Rotate.ps1 '\\.\DISPLAY1' 0   # 0 = 横屏默认（脚本同 6.1，宽高会对调回来）
```

横屏恢复即把 `$Orientation` 取 0 重跑 §6.1（基线是当前竖屏分辨率，对调后正好回到横屏宽高）。`180°` 同理取 2（宽高不对调也成立，但脚本统一对调两次即还原，无害）。

---

## 来源清单（全部已打开原文核实）

**Microsoft Learn（Win32）：**

- <https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-changedisplaysettingsexw> — 签名/flags/返回码/USER-profile 持久化
- <https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-changedisplaysettingsa> — 默认屏限定、USER profile 佐证
- <https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-devmodea> — `DMDO_*` 逆时针语义、宽高比判横竖
- <https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enumdisplaysettingsa> — 基线查询
- <https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enumdisplaydevicesa> — 设备名来源
- <https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setdisplayconfig> — CCD 写入 + `ERROR_ACCESS_DENIED` 远端会话条款
- <https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-querydisplayconfig> — CCD 读取 + 同款拒绝条款 + C++ 示例
- <https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ne-wingdi-displayconfig_rotation> — CCD 旋转枚举（顺时针，1 起）
- <https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-displayconfig_path_target_info> — `rotation` 字段位置

**PowerShell 官方：**

- <https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/add-type?view=powershell-7.5> — `Add-Type` P/Invoke 通道（Example 4）

**独立社区实现（2+）：**

- <https://github.com/gmiwoj/Windows-Display-Orientation-Script>（MIT；脚本：<https://raw.githubusercontent.com/gmiwoj/Windows-Display-Orientation-Script/main/windows-display-orientation-script.ps1>）
- <https://stackoverflow.com/questions/12644786/powershell-script-to-change-screen-orientation>（回答 id 24346514，`CDS_TEST`→`CDS_UPDATEREGISTRY` 双步 + 返回码处理）
- <https://stackoverflow.com/questions/47652252/change-screen-orientation-with-powershell-where-are-the-registry-values-stored>（DMDO 0-3 映射 + 注册表 Rotation 对照）

**工具官网/仓库：**

- <https://www.nirsoft.net/utils/multi_monitor_tool.html>（`/SetOrientation`、`/SetMonitors … DisplayOrientation=`）
- <https://www.nirsoft.net/utils/nircmd.html> + <https://www.nirsoft.net/utils/nircmd2.html>（`setdisplay` 无 orientation 参数——排除依据）
- <https://qres.sourceforge.net/>（仅分辨率/色深——排除依据）
- <https://12noon.com/?page_id=4793>（Display Changer X 支持 rotation，走 DCX 文件）
- <https://github.com/haimgel/display-switch>（KVM 切换，重名排除）
