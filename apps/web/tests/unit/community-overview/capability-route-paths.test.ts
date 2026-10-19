import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  MANAGER_CAPABILITY_ROUTE_KEYS,
  managerCapabilityRoutePath
} from "../../../lib/community-overview/routes";

// Capability hrefs are cast to `Route` at the Link call sites, which bypasses
// typedRoutes; this keeps every capability path pointing at a real app route.
const appDir = path.resolve(__dirname, "../../../app");

describe("manager capability route paths", () => {
  it.each(Object.values(MANAGER_CAPABILITY_ROUTE_KEYS))("%s resolves to an app page", (key) => {
    const routePath = managerCapabilityRoutePath(key);
    expect(routePath.startsWith("/")).toBe(true);
    expect(fs.existsSync(path.join(appDir, routePath, "page.tsx"))).toBe(true);
  });
});
