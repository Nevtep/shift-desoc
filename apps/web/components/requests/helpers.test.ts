import { describe, expect, it } from "vitest";

import { buildCommentTree, commentTreeKey } from "./helpers";

describe("request comment tree keys", () => {
  it("normalizes composite ids to native id segment", () => {
    expect(commentTreeKey("8:12")).toBe("12");
    expect(commentTreeKey(12)).toBe("12");
    expect(commentTreeKey(null)).toBe("root");
  });

  it("groups replies under composite parent ids", () => {
    const tree = buildCommentTree([
      {
        id: "8:12",
        parentId: null,
        createdAt: "2026-03-25T00:00:00.000Z"
      },
      {
        id: "8:13",
        parentId: 12,
        createdAt: "2026-03-25T00:01:00.000Z"
      }
    ]);

    const root = tree.get("root") ?? [];
    const replies = tree.get(commentTreeKey("8:12")) ?? [];

    expect(root).toHaveLength(1);
    expect(replies).toHaveLength(1);
    expect(replies[0]?.id).toBe("8:13");
  });
});
