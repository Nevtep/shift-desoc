import type {
  CommentsByRequestResult,
  DraftsQueryResult,
  RequestQueryResult
} from "../../lib/graphql/queries";

export type RequestStatus = NonNullable<RequestQueryResult["request"]>["status"];

export type RequestDetailRequest = {
  id: number;
  communityId: number;
  author: string;
  status: RequestStatus;
  createdAt?: string | number | null;
  cid?: string | null;
  tags?: string[];
};

export type DraftView = {
  id: number;
  status?: DraftsQueryResult["drafts"]["nodes"][number]["status"] | null;
  requestId: number;
};

export type CommentView = CommentsByRequestResult["comments"]["nodes"][number] & {
  optimistic?: boolean;
  status?: "pending" | "confirmed" | "failed";
  error?: string;
  isModerated?: boolean;
};
