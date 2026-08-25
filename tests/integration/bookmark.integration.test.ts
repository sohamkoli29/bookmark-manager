import { describe, test, expect, afterAll } from "bun:test";
import { prisma } from "../../src/lib/prisma.js";

// Real integration test against Postgres — requires `docker compose up -d`
// and DATABASE_URL pointing at a migrated database.

describe("Bookmark <-> Folder integration (real Postgres)", () => {
  const testRunId = `test-${Date.now()}`;
  let createdFolderId: string;

  afterAll(async () => {
    if (createdFolderId) {
      await prisma.folder.delete({ where: { id: createdFolderId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  test("creates a folder and bookmark, then reads them back from Postgres", async () => {
    const folder = await prisma.folder.create({
      data: { name: `Integration Folder ${testRunId}` },
    });
    createdFolderId = folder.id;

    expect(folder.id).toBeTruthy();
    expect(folder.name).toBe(`Integration Folder ${testRunId}`);

    const bookmark = await prisma.bookmark.create({
      data: {
        title: `Integration Bookmark ${testRunId}`,
        url: "https://example.com/integration-test",
        tags: ["integration", "test"],
        folderId: folder.id,
      },
    });

    expect(bookmark.folderId).toBe(folder.id);

    const folderWithBookmarks = await prisma.folder.findUnique({
      where: { id: folder.id },
      include: { bookmarks: true },
    });

    expect(folderWithBookmarks).not.toBeNull();
    expect(folderWithBookmarks?.bookmarks).toHaveLength(1);
    expect(folderWithBookmarks?.bookmarks[0]?.id).toBe(bookmark.id);
  });

  test("cascade deletes bookmarks when their folder is deleted", async () => {
    const folder = await prisma.folder.create({ data: { name: `Cascade Test ${testRunId}` } });
    const bookmark = await prisma.bookmark.create({
      data: { title: "To be cascade-deleted", url: "https://example.com/cascade", folderId: folder.id },
    });

    await prisma.folder.delete({ where: { id: folder.id } });

    const found = await prisma.bookmark.findUnique({ where: { id: bookmark.id } });
    expect(found).toBeNull();
  });
});