"use client";

import { useQuery } from "@tanstack/react-query";

import { useToast } from "../components/ui/toaster";
import type { Document } from "../lib/ipfs/schemas";

export type IpfsDocumentResponse = {
  cid: string;
  type: Document["type"];
  version: string;
  data: Document;
  html: { body: string } | null;
  retrievedAt: string;
};

export function useIpfsDocument(cid?: string, enabled = true) {
  const { push } = useToast();

  return useQuery<IpfsDocumentResponse | null>({
    queryKey: ["ipfs", cid],
    queryFn: async () => {
      if (!cid) {
        return null;
      }
      const response = await fetch(`/api/ipfs/${cid}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch IPFS document: ${response.status}`);
      }
      const data = (await response.json()) as IpfsDocumentResponse;
      return data;
    },
    enabled: Boolean(cid && enabled),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}
