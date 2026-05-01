"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, ClipboardList } from "lucide-react";

import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import { getClientLocale, getI18n, type AppLocale } from "../../lib/i18n";

import { formatDate, isIpfsDocumentResponse, shortAddress, statusBadge } from "./helpers";

export type RequestListRow = Omit<import("../../lib/graphql/queries").RequestNode, "communityId"> & {
  communityId: number;
};

export type RequestDetailHrefBuilder = (request: RequestListRow) => string;

function formatRequestListDate(iso: string, locale: AppLocale): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return formatDate(iso);
    return d.toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return formatDate(iso);
  }
}

function localizedStatusLabel(status: string): { label: string; className: string } {
  const t = getI18n().requestList;
  const { className } = statusBadge(status);
  const label =
    status === "OPEN_DEBATE"
      ? t.statusOpenDebate
      : status === "FROZEN"
        ? t.statusFrozen
        : status === "ARCHIVED"
          ? t.statusArchived
          : statusBadge(status).label;
  return { label, className };
}

export function RequestListItem({
  request,
  communityName,
  detailHrefBuilder,
  detailHref
}: {
  request: RequestListRow;
  communityName?: string;
  detailHrefBuilder?: RequestDetailHrefBuilder;
  detailHref?: string;
}) {
  const t = getI18n().requestList;
  const locale = getClientLocale();
  const { data: ipfs } = useIpfsDocument(request.cid, Boolean(request.cid));
  const ipfsDoc = isIpfsDocumentResponse(ipfs) ? ipfs : null;
  const title =
    ipfsDoc?.data && typeof ipfsDoc.data === "object" && "type" in ipfsDoc.data && (ipfsDoc.data as { type?: string }).type === "request"
      ? (ipfsDoc.data as { title?: string }).title ?? null
      : null;

  const resolvedDetailHref = detailHref ?? (detailHrefBuilder ? detailHrefBuilder(request) : `/requests/${request.id}`);
  const displayTitle = title ?? t.requestFallback.replace("{id}", request.id);
  const communityLabel = communityName ?? `Community ${request.communityId}`;
  const dateLabel = formatRequestListDate(request.createdAt, locale);
  const badge = localizedStatusLabel(request.status);

  return (
    <li>
      <Link
        href={resolvedDetailHref as Route}
        className="group relative block overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(246,240,225,0.88)] via-background to-background/96 p-5 shadow-[0_4px_18px_rgba(86,102,69,0.08)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-[0_12px_32px_rgba(221,136,72,0.12)] focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-90 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-secondary/15 group-hover:text-secondaryDark group-hover:ring-secondary/25">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="font-heading text-base font-semibold leading-snug text-primary transition-colors group-hover:text-primaryDark sm:text-lg">
                {displayTitle}
              </h3>
              <p className="text-xs text-muted-foreground">
                {communityLabel} · #{request.communityId}
              </p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${badge.className} ring-1 ring-black/[0.04]`}>
            {badge.label}
          </span>
        </div>

        <div className="mt-4 space-y-2 border-t border-primary/10 pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {t.created}{" "}
              <time dateTime={request.createdAt}>{dateLabel}</time>
            </span>
            <span aria-hidden className="text-border">
              ·
            </span>
            <span>
              <span className="font-medium text-foreground">{t.author}:</span>{" "}
              <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[11px] text-foreground">{shortAddress(request.author)}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {request.tags?.length ? (
              request.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted/70 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-[11px] italic text-muted-foreground">—</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-secondary transition-colors group-hover:text-secondaryDark">
            {t.viewDetails}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </Link>
    </li>
  );
}
