import { NextRequest, NextResponse } from "next/server";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { z } from "zod";

import { getEnv } from "@shift/shared";

export const runtime = "edge";

const CID_PATTERN = /^[a-zA-Z0-9]+$/;
const MAX_DOCUMENT_CHAR_LENGTH = 1_000_000;

const AttachmentSchema = z.object({
  cid: z.string().min(1),
  type: z.enum(["image", "file", "link"]).default("image"),
  label: z.string().optional(),
  description: z.string().optional()
});

const BaseDocumentSchema = z.object({
  type: z.enum(["request", "draftVersion", "claimEvidence"]),
  version: z.string().min(1)
});

const RequestDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("request"),
  title: z.string().min(1),
  summary: z.string().optional(),
  bodyMarkdown: z.string().min(1),
  tags: z.array(z.string()).default([]),
  attachments: z.array(AttachmentSchema).optional()
});

const DraftVersionDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("draftVersion"),
  draftId: z.string().min(1),
  author: z.string().min(1),
  bodyMarkdown: z.string().min(1),
  changelog: z.array(z.string()).default([]),
  actionBundlePreview: z.object({
    targets: z.array(z.string()),
    values: z.array(z.string()),
    signatures: z.array(z.string())
  })
});

const EvidenceItemSchema = z.object({
  cid: z.string().min(1),
  type: z.enum(["file", "image", "link", "text"]).default("file"),
  title: z.string().optional(),
  description: z.string().optional(),
  timestamp: z.string().optional(),
  geo: z
    .object({
      lat: z.number(),
      lng: z.number()
    })
    .optional()
});

const ClaimEvidenceDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("claimEvidence"),
  claimId: z.string().min(1),
  submittedAt: z.string(),
  evidence: z.array(EvidenceItemSchema)
});

const DocumentSchema = z.discriminatedUnion("type", [
  RequestDocumentSchema,
  DraftVersionDocumentSchema,
  ClaimEvidenceDocumentSchema
]);

type Document = z.infer<typeof DocumentSchema>;

type RouteParams = {
  params: {
    cid: string;
  };
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
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
    headers,
    cache: "force-cache"
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
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize, defaultSchema)
    .use(rehypeStringify)
    .process(markdown);

  return {
    body: String(file)
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
