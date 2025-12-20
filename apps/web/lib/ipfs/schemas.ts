import { z } from "zod";

export const AttachmentSchema = z.object({
  cid: z.string().min(1),
  type: z.enum(["image", "file", "link"]).default("image"),
  label: z.string().optional(),
  description: z.string().optional()
});

export const BaseDocumentSchema = z.object({
  type: z.enum(["request", "draftVersion", "claimEvidence"]),
  version: z.string().min(1)
});

export const RequestDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("request"),
  title: z.string().min(1),
  summary: z.string().optional(),
  bodyMarkdown: z.string().min(1),
  tags: z.array(z.string()).default([]),
  attachments: z.array(AttachmentSchema).optional()
});

export const DraftVersionDocumentSchema = BaseDocumentSchema.extend({
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

export const EvidenceItemSchema = z.object({
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

export const ClaimEvidenceDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("claimEvidence"),
  claimId: z.string().min(1),
  submittedAt: z.string(),
  evidence: z.array(EvidenceItemSchema)
});

export const DocumentSchema = z.discriminatedUnion("type", [
  RequestDocumentSchema,
  DraftVersionDocumentSchema,
  ClaimEvidenceDocumentSchema
]);

export type Attachment = z.infer<typeof AttachmentSchema>;
export type RequestDocument = z.infer<typeof RequestDocumentSchema>;
export type DraftVersionDocument = z.infer<typeof DraftVersionDocumentSchema>;
export type ClaimEvidenceDocument = z.infer<typeof ClaimEvidenceDocumentSchema>;
export type Document = z.infer<typeof DocumentSchema>;
