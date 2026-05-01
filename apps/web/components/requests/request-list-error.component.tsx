"use client";

import { QueryObserverResult, RefetchOptions } from "@tanstack/react-query";

import { getI18n } from "../../lib/i18n";
import {
  type RequestsQueryResult
} from "../../lib/graphql/queries";
import { StatusMessage } from "./status-message.component";

export type RequestListErrorProps = {
  refetch: (options?: RefetchOptions | undefined) => Promise<QueryObserverResult<RequestsQueryResult, Error>>
};

export function RequestListError({ refetch }: RequestListErrorProps) {
  const t = getI18n().requestList;
  return (
    <div className="card-tight space-y-3 border-destructive/25">
      <StatusMessage message={t.loadFailed} tone="error" />
      <button type="button" className="btn-ghost cursor-pointer text-sm" onClick={() => void refetch()}>
        {t.retry}
      </button>
    </div>
  );
}
