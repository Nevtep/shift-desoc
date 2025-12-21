import {
  type RequestsQueryResult
} from "../../lib/graphql/queries";
import { QueryObserverResult, RefetchOptions } from "@tanstack/react-query";
import { StatusMessage } from "./status-message.component";

export type RequestListErrorProps = {
  refetch: (options?: RefetchOptions | undefined) => Promise<QueryObserverResult<RequestsQueryResult, Error>>
};

export function RequestListError({refetch}: RequestListErrorProps) {
  return <div className="space-y-2">
    <StatusMessage message="Failed to load requests." tone="error" />
    <button className="text-sm underline" onClick={() => void refetch()}>
      Retry
    </button>
  </div>;
}

