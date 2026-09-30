# dsh-pdf-reader（vision 模型的 content-aware PDF 阅读）

**分类** vision · **评分** ★★★★☆ · **实测** 2026-08-28 · dsh 0.1.1-rc.2

三工具把 PDF 变成"可规划的结构化阅读"：`pdf_scan` 逐页画像（文本层/栏数/矢量图区/位图/表格/公式风险）→ `pdf_read_page`（mode=mixed：预览+文本+自动区域裁切）→ `pdf_render_region` 定向放大。**让纯文本模型也能读 PDF**。repo：AngelosZou/dsh-pdf-reader。

## 安装

```sh
dsh plugin --profile <name> add dsh-pdf-reader   # npm 0.2.0，零 JS 依赖
# 前置：本机 python3 + pymupdf（探测顺序：项目 venv → python3/py → 主 Python）
#   缺 pymupdf 时给出清晰安装指引（透明失败实测路径）
```

宿主 `inject: ['tools','subprocess','fs','timer']`——子进程走 **DSH 的 subprocess 服务**（规范化，非裸 child_process）。

## 实测结论

- ✅ **纯文本模型读 PDF 实证**（glm-5.3 无视觉输入）：自造 2 页 PDF（文本+5 柱矢量图+无框线表格）→ scan 画像正确（页数/单栏/文本层/字符数）→ read_page 后模型答对：报告标题、柱状图位置与高度递减趋势、表格位置与 4 行数据内容
- ✅ 工具链设计合理：scan 先规划预算再深读，mixed 模式自动裁切区域
- ⚠ **小图形漏检（阈值设计权衡）**：矢量图区过滤阈值 = 页面积 1%（源码 `mini = 0.01 * page_area`，本意滤 logo/装饰线）——实测 5 根柱只检出 4 根（90pt 高柱 4500pt² < 4800pt² 阈值被滤），**模型据画像推断"W5=0 失败"实为错误**（真柱高 90pt）。要害：scan 画像用于"规划"可靠，用于"数据推断"需 `pdf_render_region` 或文本标签兜底
- ✅ 安全：零外联、零 eval；Python 调用经 subprocess 服务（参数数组式）
- ✅ 参数 schema 自建标准形（避 F2 坑；注释明说"matches the shape defineTool returns"）

## 坑与修复

- 1% 阈值漏检（见上）——关键小图形用 render_region 定向渲染核对
- 依赖本机 Python 环境（无沙箱内的 pip 安装）；CI 环境需预装 pymupdf

## 适用

与 free-vision-skill（图片 OCR）、modlens（VLM failover）凑齐**文档读入三件套**：PDF→本件、截图/照片→OCR、复杂视觉→VLM。长 PDF/论文/报告的结构化读入首选。

## 来源

- npm `dsh-pdf-reader` 0.2.0 · 实测证据：/tmp/gr-e2e/pdf-e2e.log、自造 PDF raw scan 对照（4/5 柱检出 + 阈值根因定位 pdf_helper.py:114-117）
