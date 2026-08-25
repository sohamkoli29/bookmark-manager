import { describe, test, expect } from "bun:test";
import { paginateBookmarks } from "../../src/lib/pagination.js";

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

function fakePrisma(findManyImpl: (...args: unknown[]) => Promise<unknown[]>) {
  return { bookmark: { findMany: findManyImpl } };
}

describe("paginateBookmarks", () => {
  test("hasNextPage is false and endCursor is the real last item when results fit within take", async () => {
    const items = [
      makeBookmark("a", new Date("2026-01-01")),
      makeBookmark("b", new Date("2026-01-02")),
    ];
    const prisma = fakePrisma(async () => items);

    const page = await paginateBookmarks(prisma as never, { take: 5 });

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
    const prisma = fakePrisma(async () => items);

    const page = await paginateBookmarks(prisma as never, { take: 2 });

    expect(page.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(page.hasNextPage).toBe(true);
    expect(page.endCursor).toBe("b"); // cursor is the last *returned* item, not "c"
  });

  test("passes cursor and skip:1 to prisma when a cursor is given", async () => {
    let receivedArgs: { cursor?: { id: string }; skip?: number } | undefined;
    const prisma = fakePrisma(async (...args: unknown[]) => {
      receivedArgs = args[0] as { cursor?: { id: string }; skip?: number };
      return [];
    });

    await paginateBookmarks(prisma as never, { take: 2, cursor: "b" });

    expect(receivedArgs?.cursor).toEqual({ id: "b" });
    expect(receivedArgs?.skip).toBe(1);
  });

  test("clamps take to between 1 and 100", async () => {
    const receivedTakes: number[] = [];
    const prisma = fakePrisma(async (...args: unknown[]) => {
      receivedTakes.push((args[0] as { take: number }).take);
      return [];
    });

    await paginateBookmarks(prisma as never, { take: 0 });
    await paginateBookmarks(prisma as never, { take: 500 });

    expect(receivedTakes[0]).toBe(2); // clamped to 1, +1 lookahead
    expect(receivedTakes[1]).toBe(101); // clamped to 100, +1 lookahead
  });
});