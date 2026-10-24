"""_verify_probe.py - MCP stdio protocol probe for the medini-agent server.

Usage: python _verify_probe.py <server.py path>

Performs: initialize -> tools/list -> tools/call medini_doctor.
Prints a compact PASS/FAIL summary; exit code 0 = all green.
"""
from __future__ import annotations

import asyncio
import json
import sys


async def main(server_py: str) -> int:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    params = StdioServerParameters(
        command=sys.executable,
        args=[server_py],
        env={"PYTHONIOENCODING": "utf-8", "MEDINI_MCP_LOG": "INFO"},
    )

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            names = sorted(t.name for t in tools.tools)
            print(f"tools/list: {len(names)} tools")
            for n in names:
                print(f"  - {n}")

            result = await session.call_tool("medini_doctor", {})
            payload = None
            for block in result.content:
                if getattr(block, "type", "") == "text":
                    payload = json.loads(block.text)
                    break

            ok = bool(payload and payload.get("ok"))
            print(f"medini_doctor: ok={ok}")
            if payload and not ok:
                print(json.dumps(payload.get("error", {}), ensure_ascii=False, indent=2)[:1500])

            healthy = ok and len(names) >= 14
            print("PROBE:", "PASS" if healthy else "FAIL")
            return 0 if healthy else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1])))
