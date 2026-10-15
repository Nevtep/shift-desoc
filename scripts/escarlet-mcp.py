#!/opt/hermes/.venv/bin/python
"""Call the Escarlet MCP (v3) directly from a shell, for payloads too large to
pass through a model tool call (asset uploads).

Hermes' own `escarlet` MCP server is the normal path for every capability.
Use this helper only to upload generated media: it base64-encodes local files
into the call arguments so the bytes never enter the model context.

Env: ESCARLET_MCP_URL (…/mcp/v3), ESCARLET_MCP_TOKEN (Bearer).

Usage:
  escarlet-mcp.py tools                       # list tool names
  escarlet-mcp.py call <tool> --args '<json>' [--file key=/path/img.png ...]
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import sys

import httpx2
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

MAX_OUTPUT_CHARS = 20_000


def _env(key: str) -> str:
    """Process env first; fall back to Hermes' persisted .env, since the
    terminal tool may scrub secret-looking variables from subprocesses."""
    value = os.environ.get(key, "")
    if value:
        return value
    env_file = os.path.join(os.environ.get("HERMES_HOME", "/opt/data"), ".env")
    try:
        with open(env_file) as fh:
            for line in fh:
                name, sep, val = line.rstrip("\n").partition("=")
                if sep and name == key:
                    return val
    except OSError:
        pass
    return ""


def _client() -> httpx2.AsyncClient:
    token = _env("ESCARLET_MCP_TOKEN")
    if not token:
        sys.exit("ESCARLET_MCP_TOKEN is not set")
    return httpx2.AsyncClient(
        headers={"Authorization": f"Bearer {token}"},
        timeout=httpx2.Timeout(60.0, read=300.0),
        follow_redirects=True,
    )


async def _run(argv: argparse.Namespace) -> int:
    url = _env("ESCARLET_MCP_URL")
    if not url:
        sys.exit("ESCARLET_MCP_URL is not set")
    async with _client() as http_client:
        async with streamable_http_client(url, http_client=http_client) as streams:
            async with ClientSession(streams[0], streams[1]) as session:
                await session.initialize()
                if argv.command == "tools":
                    result = await session.list_tools()
                    for tool in result.tools:
                        print(tool.name)
                    return 0

                arguments = json.loads(argv.args or "{}")
                for spec in argv.file or []:
                    key, _, path = spec.partition("=")
                    if not key or not path:
                        sys.exit(f"--file expects key=/path, got {spec!r}")
                    with open(path, "rb") as fh:
                        arguments[key] = base64.b64encode(fh.read()).decode("ascii")
                result = await session.call_tool(argv.tool, arguments)
                payload = result.model_dump(mode="json", exclude_none=True)
                text = json.dumps(payload, ensure_ascii=False)
                if len(text) > MAX_OUTPUT_CHARS:
                    text = text[:MAX_OUTPUT_CHARS] + "…(truncated)"
                print(text)
                return 1 if payload.get("isError") else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("tools")
    call = sub.add_parser("call")
    call.add_argument("tool")
    call.add_argument("--args", default="{}")
    call.add_argument("--file", action="append", help="key=/path: base64-encode a file into arguments[key]")
    return asyncio.run(_run(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
