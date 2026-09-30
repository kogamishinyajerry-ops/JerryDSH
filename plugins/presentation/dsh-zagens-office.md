# DSH-Office（PPTX/DOCX/XLSX/PDF 读写编辑）

**分类** presentation · **评分** ★★★（概念满分，macOS 不可用）· **实测** 2026-08-23 · dsh 0.1.1-rc.2 · **Windows x64 引擎限定**

四个工具（office_schema 取 JSON 契约 / office_write 新建 / office_edit 按 op 改 / office_read 回读核对）驱动本机 zagens-office 引擎直接产出 Office 文档与 PDF——展示材料制作的刚需面。repo：didclawapp-ai/DSH-Office（zagens 官方）。

## 安装

```sh
dsh plugin --profile <name> add github:didclawapp-ai/DSH-Office   # 包名 dsh-zagens-office
# 引擎二进制不在包里：模型按提示自取（~/.zagens-pro/bin），或 config.bin / ZAGENS_OFFICE_BIN 指定
```

## 实测结论（macOS = 加载+透明失败模式）

- ✅ 加载：`[zagens-office] plugin loaded; bin not on disk yet`（启动日志）；boot 正常
- ✅ **透明失败**：`office_schema` 返回结构化错误（binary not found + 精确 INSTALL_HINT：manifest URL/镜像/sha256 校验/config.bin 覆盖四条路），模型如实转述、未擅自下载（prompt 明令禁止也遵守了）
- ✅ **官方清单核验**：office-latest.json 只有 Windows x64 产物（.exe + windows-x64.zip，v0.12.0，带 sha256）——**无 darwin 构建，macOS 本机不可用**，与错误提示一致
- ✅ 安全设计：引擎调用走 `execFile`（无 shell）；下载责任交给模型自身工具+sha256 校验（插件运行时不自下载）；插件还会把 zagens-office skill 从模型目录隐藏避免重复入口

## 坑与修复

- **平台限定是硬伤**：macOS 用户（本机）只能透明失败或 Windows 虚机/Wine；等 darwin 产物再复测
- 引擎是闭源厂商二进制（zagens.com）——装进生产 profile 前自行评估供应链信任
- 提示词指示模型"不要问用户、自行下载"——在受控环境高效，在敏感环境建议用 config.bin 预置

## 适用

Windows 工作站的展示材料生产线（PPTX/DOCX/XLSX/PDF 直出）；macOS 观望。macOS 上的替代路线：genui（对话内展示）+ pandoc/脚本（外置文档）。

## 来源

- GitHub didclawapp-ai/DSH-Office（v0.1.0）· zagens.com/download/office-latest.json（2026-08-23 快照）· 实测证据：/tmp/gr-e2e/office-e2e.log
