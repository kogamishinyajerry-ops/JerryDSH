# dsh-browser-control（CDP 浏览器控制）

**分类** capability · **评分** ★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

CDP 驱动 Chrome：导航 / console+pageError+networkError 捕获 / 截图 / 任意 JS eval / mobile 仿真。6 个 `browser_*` 工具进模型工具集。

## 安装

```sh
dsh plugin --profile web add dsh-browser-control
```

## 实测结论（隔离 headless Chrome @ CDP :9222，空 user-data-dir）

- ✅ `browser_status` → 正确探测（Chrome/151 Headless, Protocol 1.3）
- ✅ `browser_open <本地测试页>` → title 正确、0 错误、body 预览正确
- ✅ `browser_eval document.getElementById('hdr').textContent` → 精确返回 DOM 文本

## 坑与修复

- ⚠ **登录态隐私权衡**：`browser_launch` / `scripts/launch.sh` 会把日常 Chrome 的 Cookies/Login Data/Local Storage/IndexedDB **只读拷贝到 `/tmp/chrome-e2e-profile`** 起 CDP 实例——单向不回写，但本机任何进程可读。测试时我没用它，自起空实例；生产用前想清楚
- Roadmap 尚无点击/填表（0.1.0 早期）；Playwright 后端计划中
- canvas/G6/echarts 截图空白有专门修法（新 tab + bringToFront + 踢 raf，见仓库 docs）

## 适用

agent 操作网页的能力底座：已登录站点的读取/截图/自动化（用 launch.sh 时）、或无状态网页的通用驱动（自起 CDP 实例时）。

## 来源

- npm `dsh-browser-control` 0.1.0 · [GitHub PangYiMing/dsh-browser-control](https://github.com/PangYiMing/dsh-browser-control) · 实测细节 [research/03](../../research/03-capability-plugins.md)
