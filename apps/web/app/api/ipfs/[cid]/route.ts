import { NextResponse } from "next/server";
import { getEnv } from "@shift/shared";

import {
  type Document,
  DocumentSchema
} from "../../../../lib/ipfs/schemas";
import { renderMarkdownToHtml } from "../../../../lib/ipfs/markdown";

export const runtime = "edge";

const CID_PATTERN = /^[a-zA-Z0-9]+$/;
const MAX_DOCUMENT_CHAR_LENGTH = 1_000_000;

export async function GET(request: Request) {
  const pathname = new URL(request.url).pathname;
  const cid = pathname.split("/").pop();

  if (!cid) {
    return NextResponse.json(
      { error: "Missing CID" },
      { status: 400, headers: buildBaseHeaders("unknown") }
    );
  }

  if (!CID_PATTERN.test(cid)) {
    return NextResponse.json(
      { error: "Invalid CID" },
      { status: 400, headers: buildBaseHeaders(cid) }
    );
  }

  const env = getEnv();
  const gateway = (env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs").replace(
    /\/$/,
    ""
  );
  const url = `${gateway}/${cid}`;

  const headers: Record<string, string> = {
    Accept: "application/json"
  };
  if (env.PINATA_JWT) {
    headers.Authorization = `Bearer ${env.PINATA_JWT}`;
  }

  const response = await fetch(url, {
    headers
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Gateway responded with ${response.status}` },
      { status: response.status, headers: buildBaseHeaders(cid) }
    );
  }

  const text = await response.text();

  if (text.length > MAX_DOCUMENT_CHAR_LENGTH) {
    return NextResponse.json(
      { error: "Document too large" },
      { status: 413, headers: buildBaseHeaders(cid) }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 422, headers: buildBaseHeaders(cid) }
    );
  }

  const normalized = normalizeDocument(parsed);
  const result = DocumentSchema.safeParse(normalized);
  if (!result.success) {
    return NextResponse.json(
      { error: "Schema validation failed", issues: result.error.issues },
      { status: 422, headers: buildBaseHeaders(cid) }
    );
  }

  const document = result.data;
  const html = await buildHtmlPayload(document);

  return NextResponse.json(
    {
      cid,
      type: document.type,
      version: document.version,
      data: document,
      html,
      retrievedAt: new Date().toISOString()
    },
    {
      status: 200,
      headers: buildCacheHeaders(cid)
    }
  );
}

function normalizeDocument(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;

  const maybe: Record<string, unknown> = raw as Record<string, unknown>;

  // Backward compatibility: older request uploads lacked version/bodyMarkdown fields.
  if (maybe.type === "request") {
    return {
      version: typeof maybe.version === "string" && maybe.version.length ? maybe.version : "1",
      type: "request",
      title: maybe.title,
      summary: maybe.summary,
      bodyMarkdown:
        typeof maybe.bodyMarkdown === "string" && maybe.bodyMarkdown.length
          ? maybe.bodyMarkdown
          : (typeof maybe.body === "string" ? maybe.body : ""),
      tags: Array.isArray(maybe.tags) ? maybe.tags : [],
      attachments: maybe.attachments,
      createdAt: coerceIsoDate(maybe.createdAt),
      createdBy: maybe.createdBy
    };
  }

  if (maybe.type === "comment") {
    return {
      version: typeof maybe.version === "string" && maybe.version.length ? maybe.version : "1",
      type: "comment",
      bodyMarkdown: typeof maybe.bodyMarkdown === "string" ? maybe.bodyMarkdown : "",
      requestId: maybe.requestId,
      parentId: maybe.parentId,
      createdAt: coerceIsoDate(maybe.createdAt),
      createdBy: maybe.createdBy
    };
  }

  return raw;
}

function coerceIsoDate(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "string" && value.length) {
    const d = new Date(value);
    if (!Number.isNaN(d.valueOf())) return d.toISOString();
  }

  if (typeof value === "number") {
    const millis = value < 1e12 ? value * 1000 : value;
    const d = new Date(millis);
    if (!Number.isNaN(d.valueOf())) return d.toISOString();
  }

  return undefined;
}

async function buildHtmlPayload(document: Document) {
  if (document.type === "claimEvidence") {
    return null;
  }

  const markdown = document.bodyMarkdown;
  return {
    body: await renderMarkdownToHtml(markdown)
  };
}

function buildCacheHeaders(cid: string) {
  return {
    ...buildBaseHeaders(cid),
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: cid
  } satisfies Record<string, string>;
}

function buildBaseHeaders(cid: string) {
  return {
    "Content-Type": "application/json",
    "x-ipfs-cid": cid
  } satisfies Record<string, string>;
}
