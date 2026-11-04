import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  })
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => ""
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined })
}));

import GlobalDraftsPage from "../../../app/drafts/page";
import GlobalProposalsPage from "../../../app/governance/proposals/page";

describe("global governance/drafts routes defer to community scoping", () => {
  it("redirects /governance/proposals?communityId=7 to the community-scoped list", async () => {
    await expect(
      GlobalProposalsPage({ searchParams: Promise.resolve({ communityId: "7" }) })
    ).rejects.toThrow("NEXT_REDIRECT:/communities/7/governance/proposals");
  });

  it("redirects /drafts?communityId=7 to the community-scoped drafts list", async () => {
    await expect(GlobalDraftsPage({ searchParams: Promise.resolve({ communityId: "7" }) })).rejects.toThrow(
      "NEXT_REDIRECT:/communities/7/coordination/drafts"
    );
  });

  it("ignores non-numeric communityId and keeps the cross-community aggregate view", async () => {
    redirectMock.mockClear();
    await GlobalProposalsPage({ searchParams: Promise.resolve({ communityId: "abc" }) });
    await GlobalDraftsPage({ searchParams: Promise.resolve({ communityId: "abc" }) });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
