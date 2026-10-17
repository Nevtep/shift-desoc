import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => ""
}));

import { CommunityScopeRedirect } from "./community-scope-redirect";

describe("CommunityScopeRedirect", () => {
  it("replaces the route with the community-scoped href", () => {
    render(<CommunityScopeRedirect href="/communities/3/governance/proposals/9" />);
    expect(replace).toHaveBeenCalledWith("/communities/3/governance/proposals/9");
  });

  it("does nothing when no href is known yet", () => {
    replace.mockClear();
    render(<CommunityScopeRedirect href={null} />);
    expect(replace).not.toHaveBeenCalled();
  });
});
