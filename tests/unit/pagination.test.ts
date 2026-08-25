import { describe, test, expect, beforeEach, mock } from "bun:test";

const findManyMock = mock();

mock.module("../../src/lib/prisma.js", () => ({
  prisma: { bookmark: { findMany: findManyMock } },
}));

const { paginateBookmarks } = await import("../../src/lib/pagination.js");

function makeBookmark(id: string, createdAt: Date) {
  return {
    id,
    title: `Bookmark ${id}`,
    url: "https://example.com",
    tags: [] as string[],
    folderId: "folder_1",
    createdAt,
  };
}

describe("paginateBookmarks", () => {
  beforeEach(() => {
    findManyMock.mockClear();
  });

  test("hasNextPage is false and endCursor is the real last item when results fit within take", async () => {
    const items = [
      makeBookmark("a", new Date("2026-01-01")),
      makeBookmark("b", new Date("2026-01-02")),
    ];
    findManyMock.mockResolvedValue(items);

    const page = await paginateBookmarks({ take: 5 });

    expect(page.items).toHaveLength(2);
    expect(page.hasNextPage).toBe(false);
    expect(page.endCursor).toBe("b");
  });

  test("detects hasNextPage and slices off the lookahead row correctly", async () => {
    const items = [
      makeBookmark("a", new Date("2026-01-01")),
      makeBookmark("b", new Date("2026-01-02")),
      makeBookmark("c", new Date("2026-01-03")), // the +1 lookahead row
    ];
    findManyMock.mockResolvedValue(items);

    const page = await paginateBookmarks({ take: 2 });

    expect(page.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(page.hasNextPage).toBe(true);
    expect(page.endCursor).toBe("b"); // cursor is the last *returned* item, not "c"
  });

  test("passes cursor and skip:1 to prisma when a cursor is given", async () => {
    findManyMock.mockResolvedValue([]);

    await paginateBookmarks({ take: 2, cursor: "b" });

    const callArgs = findManyMock.mock.calls[0]?.[0] as { cursor?: { id: string }; skip?: number };
    expect(callArgs.cursor).toEqual({ id: "b" });
    expect(callArgs.skip).toBe(1);
  });

  test("clamps take to between 1 and 100", async () => {
    findManyMock.mockResolvedValue([]);

    await paginateBookmarks({ take: 0 });
    expect((findManyMock.mock.calls[0]?.[0] as { take: number }).take).toBe(2); // clamped to 1, +1 lookahead

    await paginateBookmarks({ take: 500 });
    expect((findManyMock.mock.calls[1]?.[0] as { take: number }).take).toBe(101); // clamped to 100, +1 lookahead
  });
});