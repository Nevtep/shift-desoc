import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@shift/shared";

import {
  type Document,
  DocumentSchema
} from "../../../../lib/ipfs/schemas";
import { renderMarkdownToHtml } from "../../../../lib/ipfs/markdown";

export const runtime = "edge";

const CID_PATTERN = /^[a-zA-Z0-9]+$/;
const MAX_DOCUMENT_CHAR_LENGTH = 1_000_000;

export async function GET(_request: NextRequest, context: any) {
  const { params } = context as { params: { cid: string } };
  const { cid } = params;

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

  const result = DocumentSchema.safeParse(parsed);
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
