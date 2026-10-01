"""断点 A/B 实机 UI 验证：执行台"确认并授权（不提交）"真实界面操作。

验证点：
1. 面板加载 READY 任务（修正后的 EXECUTOR 身份 + proj_a 项目被服务端接受）。
2. 授权按钮为"确认并授权（不提交）"，点击后弹出含 task/revision/preparation/
   prepared_digest/执行预算的一次性确认。
3. 确认后授权生效（任务 AUTHORIZED），面板给出 authorization_id + prepared_digest，
   并明确说明未入队任何作业、首次提交由 AGENT runner 经 MCP 完成。
4. 服务端证据：任务 AUTHORIZED 且 runs 数量为 0（面板没有代提交）。
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

TASK_ID = sys.argv[1]
API = "http://127.0.0.1:8600/api/v1"
PANEL = f"http://127.0.0.1:8600/panels/executor/index.html?task={TASK_ID}"
OUT = Path("/Users/Zhuanz/projects/jerry-personal/JerryDSH/acceptance/ui")
OUT.mkdir(parents=True, exist_ok=True)
HEADERS = {
    "X-Dev-Subject": "probe-ui",
    "X-Dev-Roles": "EXECUTOR",
    "X-Dev-Projects": "proj_a",
}


def api_get(path: str):
    req = urllib.request.Request(f"{API}{path}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto(PANEL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT / "01-task-loaded.png"), full_page=True)

        # 1) 任务卡加载成功（READY 徽章存在即身份/项目被接受）
        body_text = page.inner_text("body")
        assert TASK_ID in body_text, f"task id not rendered; page text head: {body_text[:300]}"
        print("[1] task card rendered with identity accepted (no 403/401 block)")

        # 2) 仅授权按钮存在且可点击
        btn = page.get_by_role("button", name="确认并授权（不提交）")
        assert btn.count() == 1, "authorize-only button missing"
        assert btn.is_enabled(), "authorize button disabled (unexpected: READY + no blockers)"
        btn.click()
        page.wait_for_timeout(500)
        modal_text = page.inner_text(".modal")
        page.screenshot(path=str(OUT / "02-authorize-confirm-modal.png"), full_page=True)
        for token in ("仅授权，不提交", "prepared_digest", "执行预算", f"准备 prep_", "修订 R"):
            assert token in modal_text, f"modal missing token {token}; modal: {modal_text[:400]}"
        print("[2] confirmation modal shows task/revision/preparation/digest/budget")

        # 3) 一次性确认 → 授权生效
        page.get_by_role("button", name="确认并授权（不提交）").last.click()
        page.wait_for_timeout(1200)
        result_text = page.inner_text(".modal") if page.locator(".modal").count() else ""
        page.screenshot(path=str(OUT / "03-authorized-result.png"), full_page=True)
        assert "authorization_id" in result_text, f"no authorization_id shown: {result_text[:400]}"
        assert "未提交" in result_text or "没有入队任何作业" in result_text, result_text[:400]
        assert "submit_runs" in result_text, result_text[:400]
        auth_line = next(
            ln for ln in result_text.splitlines() if "authorization_id" in ln
        )
        print(f"[3] {auth_line.strip()[:120]}")

        # 4) 服务端证据：AUTHORIZED 且零 Run（面板没有代提交）
        task = api_get(f"/tasks/{TASK_ID}")
        assert task["task_state"] == "AUTHORIZED", task["task_state"]
        runs = api_get(f"/tasks/{TASK_ID}/runs")
        run_count = len(runs.get("items", []))
        assert run_count == 0, f"panel submitted runs! count={run_count}"
        print(f"[4] server-side: task_state=AUTHORIZED, runs={run_count} (panel did NOT submit)")
        browser.close()
    print("UI-AUTHORIZE-ONLY-VERIFIED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
