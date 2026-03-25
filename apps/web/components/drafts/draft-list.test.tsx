import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DraftList } from "./draft-list";
import { renderWithProviders } from "../../tests/unit/utils";

describe("DraftList", () => {
  it("renders community-scoped detail links when builder is provided", async () => {
    renderWithProviders(
      <DraftList
        communityId="8"
        detailHrefBuilder={(draft) => `/communities/8/coordination/drafts/${draft.id}`}
      />
    );

    const link = await screen.findByRole("link", { name: /view details/i });
    expect(link).toHaveAttribute("href", "/communities/8/coordination/drafts/10");
  });
});
