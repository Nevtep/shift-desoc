#!/usr/bin/env python3
"""Build the sanitized Engram bundle that sync-engram.sh sends to Hermes.

Engram chunks carry verbatim prompts and local paths besides the curated
observations. Before anything leaves this machine the bundle:

  * drops every prompt (raw user/agent input is where pasted secrets land),
  * blanks session working directories (local usernames and layout),
  * keeps observations and their relation mutations (the actual learnings),
  * scans the whole decoded payload that would be sent, every record type,
    and refuses to build the bundle if anything looks like a credential.

It writes <out>/.engram/{manifest.json,config.json,chunks/*.jsonl.gz} (the
layout `engram sync --import` reads) and <out>/decoded/*.jsonl (plain text,
for gitleaks). Chunk ids are kept, so Engram's own idempotency still applies.

Exit codes: 0 bundle ready, 1 usage/IO error, 2 possible secret found
(nothing to send), 3 no chunk left to send.
"""
import argparse
import gzip
import json
import os
import re
import shutil
import sys

DETECTORS = [
    ("jwt", re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("private-key-block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("aws-access-key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("github-token", re.compile(r"\b(?:ghp|gho|ghs|ghu|ghr|github_pat)_[A-Za-z0-9_]{20,}")),
    ("anthropic-openai-key", re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}")),
    ("linear-key", re.compile(r"\blin_(?:api|oauth)_[A-Za-z0-9]{20,}")),
    ("slack-token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("telegram-bot-token", re.compile(r"\b\d{8,10}:AA[A-Za-z0-9_-]{30,}\b")),
    ("rpc-url-with-key", re.compile(r"(?:infura\.io/v3|alchemy\.com/v2|quiknode\.pro)/[A-Za-z0-9_-]{16,}")),
    ("url-with-credentials", re.compile(r"\b[a-z][a-z0-9+.-]*://[^\s:/@\"'<>]+:[^\s@/\"'<>]+@[^\s\"'<>]+")),
    ("hex-private-key", re.compile(r"\b0x[a-fA-F0-9]{64}\b")),
    # A bare 64-hex value, unless it is labelled as a sha256 digest.
    ("bare-hex-key", re.compile(r"(?<![0-9a-fA-Fx:])(?<!sha256:)[a-fA-F0-9]{64}(?![0-9a-fA-F])")),
    ("seed-phrase", re.compile(
        r"(?i)\b(?:mnemonic|seed(?:\s+phrase)?|recovery\s+phrase|secret\s+recovery)\b\W{0,5}"
        r"(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b")),
    ("assignment-of-secret", re.compile(
        r"(?i)\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|private[_-]?key|jwt|mnemonic)\b"
        r"\s*[:=]\s*[\"']?[A-Za-z0-9/+_\-.]{12,}")),
]


def redact(value):
    return value if len(value) <= 12 else f"{value[:4]}…{value[-2:]} ({len(value)} chars)"


def string_values(value):
    """Every string in a decoded record, with JSON-encoded strings (mutation
    payloads) expanded, so detectors see raw text rather than escaped JSON."""
    if isinstance(value, dict):
        for v in value.values():
            yield from string_values(v)
    elif isinstance(value, list):
        for v in value:
            yield from string_values(v)
    elif isinstance(value, str):
        yield value
        if value[:1] in "{[":
            try:
                yield from string_values(json.loads(value))
            except ValueError:
                pass


def scan(values):
    findings = []
    for text in values:
        for name, rx in DETECTORS:
            for m in rx.finditer(text):
                findings.append((name, redact(m.group(0))))
    return findings


def sanitize_record(rec):
    rec = dict(rec)
    rec["prompts"] = []
    sessions = []
    for s in rec.get("sessions") or []:
        s = dict(s)
        if "directory" in s:
            s["directory"] = ""
        sessions.append(s)
    if "sessions" in rec:
        rec["sessions"] = sessions
    mutations = []
    for m in rec.get("mutations") or []:
        if m.get("entity") == "prompt":
            continue
        if m.get("entity") == "session" and isinstance(m.get("payload"), str):
            try:
                payload = json.loads(m["payload"])
            except ValueError:
                payload = None
            if isinstance(payload, dict) and "directory" in payload:
                payload["directory"] = ""
                m = dict(m, payload=json.dumps(payload, ensure_ascii=False))
        mutations.append(m)
    if "mutations" in rec:
        rec["mutations"] = mutations
    return rec


def discard(src, cid):
    path = os.path.join(src, "manifest.json")
    try:
        manifest = json.load(open(path))
    except (OSError, ValueError) as e:
        print(f"cannot read manifest: {e}", file=sys.stderr)
        return 1
    before = len(manifest.get("chunks", []))
    manifest["chunks"] = [c for c in manifest.get("chunks", []) if c.get("id") != cid]
    chunk = os.path.join(src, "chunks", f"{cid}.jsonl.gz")
    if before == len(manifest["chunks"]) and not os.path.exists(chunk):
        print(f"chunk {cid} not found", file=sys.stderr)
        return 1
    json.dump(manifest, open(path, "w"), indent=2)
    if os.path.exists(chunk):
        os.remove(chunk)
    print(f"Discarded local chunk {cid} (it was never sent).")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--src", required=True, help="local .engram directory")
    ap.add_argument("--out", help="output directory (created)")
    ap.add_argument("--pushed", help="file listing chunk ids already sent (one per line)")
    ap.add_argument("--discard", metavar="CHUNK_ID",
                    help="delete a local chunk and its manifest entry (e.g. one that was flagged), then exit")
    args = ap.parse_args()
    if args.discard:
        return discard(args.src, args.discard)
    if not args.out:
        ap.error("--out is required unless --discard is used")

    try:
        manifest = json.load(open(os.path.join(args.src, "manifest.json")))
    except (OSError, ValueError) as e:
        print(f"cannot read manifest: {e}", file=sys.stderr)
        return 1
    pushed = set()
    if args.pushed and os.path.exists(args.pushed):
        pushed = {line.strip() for line in open(args.pushed) if line.strip()}

    todo = [c for c in manifest.get("chunks", []) if c.get("id") not in pushed]
    if not todo:
        print("Nothing new to send: every local chunk was already pushed to Hermes.")
        return 3

    out_engram = os.path.join(args.out, ".engram")
    out_chunks = os.path.join(out_engram, "chunks")
    out_decoded = os.path.join(args.out, "decoded")
    os.makedirs(out_chunks, exist_ok=True)
    os.makedirs(out_decoded, exist_ok=True)

    findings, summary, chunks_out = [], [], []
    for c in todo:
        cid = c["id"]
        src = os.path.join(args.src, "chunks", f"{cid}.jsonl.gz")
        try:
            lines = gzip.open(src, "rt", encoding="utf-8").read().splitlines()
        except OSError as e:
            print(f"cannot read chunk {cid}: {e}", file=sys.stderr)
            return 1
        clean = [sanitize_record(json.loads(l)) for l in lines if l.strip()]
        text = "\n".join(json.dumps(r, ensure_ascii=False) for r in clean) + "\n"
        values = [v for r in clean for v in string_values(r)]
        # Scan exactly what would be sent: every string of every record type.
        for name, sample in scan(values):
            findings.append((cid, name, sample))
        with gzip.open(os.path.join(out_chunks, f"{cid}.jsonl.gz"), "wt", encoding="utf-8") as f:
            f.write(text)
        with open(os.path.join(out_decoded, f"{cid}.jsonl"), "w", encoding="utf-8") as f:
            f.write(text)
        # Raw string values too, so gitleaks rules see unescaped text.
        with open(os.path.join(out_decoded, f"{cid}.values.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(values) + "\n")
        obs = [o for r in clean for o in r.get("observations") or []]
        muts = sum(len(r.get("mutations") or []) for r in clean)
        summary.append((cid, obs, muts, c.get("prompts", 0)))
        chunks_out.append(dict(c, prompts=0))

    if findings:
        print("Possible secrets in the payload; nothing will be sent:", file=sys.stderr)
        for cid, name, sample in findings:
            print(f"  chunk {cid}: {name}: {sample}", file=sys.stderr)
        print("Remove them from local Engram (engram delete <id> --hard), discard the affected local "
              "chunk (engram-sanitize.py --src .engram --discard <chunk>), export again, and re-run.",
              file=sys.stderr)
        shutil.rmtree(args.out, ignore_errors=True)
        return 2

    json.dump(dict(manifest, chunks=chunks_out), open(os.path.join(out_engram, "manifest.json"), "w"), indent=2)
    cfg = os.path.join(args.src, "config.json")
    if os.path.exists(cfg):
        shutil.copy(cfg, os.path.join(out_engram, "config.json"))

    for cid, obs, muts, dropped in summary:
        print(f"chunk {cid}: {len(obs)} observation(s), {muts} relation mutation(s), "
              f"{dropped} prompt(s) dropped")
        for o in obs:
            print(f"  - [{o.get('type')}] {o.get('title')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
