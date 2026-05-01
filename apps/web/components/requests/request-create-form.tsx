"use client";

import { RequestCreateWizard } from "./request-create-wizard";

export function RequestCreateForm({
  fixedCommunityId,
  successRedirectHref
}: {
  fixedCommunityId?: number;
  successRedirectHref?: string;
} = {}) {
  return (
    <RequestCreateWizard variant="embedded" fixedCommunityId={fixedCommunityId} successRedirectHref={successRedirectHref} />
  );
}
