// 带标注路由测试集：43 例
// label = 客观最优路由（inspect-first / direct / neutral）
// group: A/B 明确检查类, C/D 明确创建类, E 否定对抗, F 混合任务, G 中性(应沉默)
export const CASES = [
  // ── A. 中文·明确检查类 ──
  { id: 'a1', group: 'A', label: 'inspect', text: '修复登录页在 Safari 上白屏的问题' },
  { id: 'a2', group: 'A', label: 'inspect', text: '排查为什么每天凌晨的定时任务没有触发' },
  { id: 'a3', group: 'A', label: 'inspect', text: '帮我调试 WebSocket 频繁断连的问题' },
  { id: 'a4', group: 'A', label: 'inspect', text: '审查这个 PR 里有没有安全漏洞' },
  { id: 'a5', group: 'A', label: 'inspect', text: '把这个项目从 Vue2 迁移到 Vue3' },
  { id: 'a6', group: 'A', label: 'inspect', text: '首屏加载要 8 秒，优化一下，查查为什么这么慢' },
  { id: 'a7', group: 'A', label: 'inspect', text: '线上接口偶尔返回 500，帮我排查根因' },

  // ── B. 英文·明确检查类 ──
  { id: 'b1', group: 'B', label: 'inspect', text: 'Fix the flaky integration test in CI' },
  { id: 'b2', group: 'B', label: 'inspect', text: 'Debug why the Node worker process exits randomly' },
  { id: 'b3', group: 'B', label: 'inspect', text: 'Review this pull request for security issues' },
  { id: 'b4', group: 'B', label: 'inspect', text: 'Diagnose the memory leak in the renderer process' },
  { id: 'b5', group: 'B', label: 'inspect', text: 'Migrate the database from Postgres 13 to 16' },
  { id: 'b6', group: 'B', label: 'inspect', text: 'The build is broken on macOS, find out why' },

  // ── C. 中文·明确创建类 ──
  { id: 'c1', group: 'C', label: 'direct', text: '新建一个用户管理页面，包含增删改查' },
  { id: 'c2', group: 'C', label: 'direct', text: '从零搭建一个博客网站' },
  { id: 'c3', group: 'C', label: 'direct', text: '写一个防抖函数，带 TypeScript 类型' },
  { id: 'c4', group: 'C', label: 'direct', text: '生成 100 条模拟用户测试数据' },
  { id: 'c5', group: 'C', label: 'direct', text: '给这个 CLI 新增一个导出命令' },
  { id: 'c6', group: 'C', label: 'direct', text: '实现一个 Excel 导出功能' },

  // ── D. 英文·明确创建类 ──
  { id: 'd1', group: 'D', label: 'direct', text: 'Create a landing page for our new product' },
  { id: 'd2', group: 'D', label: 'direct', text: 'Scaffold a Next.js app with Tailwind' },
  { id: 'd3', group: 'D', label: 'direct', text: 'Write a debounce utility function' },
  { id: 'd4', group: 'D', label: 'direct', text: 'Build a REST API for a todo app' },
  { id: 'd5', group: 'D', label: 'direct', text: 'Implement OAuth login with Google' },
  { id: 'd6', group: 'D', label: 'direct', text: 'Add a dark mode toggle to the settings page' },

  // ── E. 否定/对抗（真值与字面关键词相反或缺失）──
  { id: 'e1', group: 'E', label: 'direct',  text: '不要修复旧代码，直接重写整个模块' },
  { id: 'e2', group: 'E', label: 'inspect', text: '别急着写代码，先调查一下线上到底哪里慢' },
  { id: 'e3', group: 'E', label: 'inspect', text: '先别实现，帮我分析一下这个方案的可行性' },
  { id: 'e4', group: 'E', label: 'direct',  text: "Don't debug it — just rewrite the whole thing from scratch" },
  { id: 'e5', group: 'E', label: 'inspect', text: "Don't create a new page; fix the existing one instead" },
  { id: 'e6', group: 'E', label: 'direct',  text: 'No need to review anything, just ship it' },

  // ── F. 混合任务（检查与创建并存；真值=存在错误/调查约束时 inspect 优先）──
  { id: 'f1', group: 'F', label: 'inspect', text: '新建一个报表页面，但现在运行报错' },
  { id: 'f2', group: 'F', label: 'inspect', text: 'Add a new export feature, but the build is currently broken' },
  { id: 'f3', group: 'F', label: 'inspect', text: '重构支付模块，顺便新增退款功能' },
  { id: 'f4', group: 'F', label: 'inspect', text: 'Investigate the latency spike, then build a small dashboard for it' },
  { id: 'f5', group: 'F', label: 'inspect', text: '升级依赖之后跑不起来了，帮我修，再继续开发新功能' },
  { id: 'f6', group: 'F', label: 'inspect', text: '帮我检查这个配置有没有问题，没有的话就按它新写一个服务' },

  // ── G. 中性（不构成工程任务，期望沉默不注入）──
  { id: 'g1', group: 'G', label: 'neutral', text: '你好，你都能做些什么？' },
  { id: 'g2', group: 'G', label: 'neutral', text: '解释一下 CAP 定理' },
  { id: 'g3', group: 'G', label: 'neutral', text: '总结一下这篇文章的核心观点' },
  { id: 'g4', group: 'G', label: 'neutral', text: 'What model are you running on?' },
  { id: 'g5', group: 'G', label: 'neutral', text: 'How does DNS resolution work?' },
  { id: 'g6', group: 'G', label: 'neutral', text: '这两个概念有什么区别？' },
];
