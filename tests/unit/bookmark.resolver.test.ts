import { describe, test, expect } from "bun:test";
import type { Mock } from "bun:test";
import { mock } from "bun:test";
import { GraphQLError } from "graphql";
import { bookmarkResolvers } from "../../src/resolvers/bookmark.resolver.js";
import type { GraphQLContext } from "../../src/lib/context.js";
import type { Bookmark, Folder } from "@prisma/client";

interface MockPrisma {
  folder: {
    findUnique: Mock<(...args: unknown[]) => Promise<Folder | null>>;
    findUniqueOrThrow: Mock<(...args: unknown[]) => Promise<Folder>>;
  };
  bookmark: {
    findUnique: Mock<(...args: unknown[]) => Promise<Bookmark | null>>;
    findMany: Mock<(...args: unknown[]) => Promise<Bookmark[]>>;
    create: Mock<(...args: unknown[]) => Promise<Bookmark>>;
    update: Mock<(...args: unknown[]) => Promise<Bookmark>>;
    delete: Mock<(...args: unknown[]) => Promise<Bookmark>>;
  };
}

function createContext(): { ctx: GraphQLContext; prisma: MockPrisma } {
  const prisma: MockPrisma = {
    folder: { findUnique: mock(), findUniqueOrThrow: mock() },
    bookmark: { findUnique: mock(), findMany: mock(), create: mock(), update: mock(), delete: mock() },
  };
  return { ctx: { prisma } as unknown as GraphQLContext, prisma };
}

const sampleFolder: Folder = {
  id: "folder_1",
  name: "Work",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const sampleBookmark: Bookmark = {
  id: "bookmark_1",
  title: "Prisma Docs",
  url: "https://prisma.io/docs",
  tags: [],
  folderId: "folder_1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("bookmarkResolvers.Mutation.createBookmark", () => {
  test("creates a bookmark when title, url are valid and the folder exists", async () => {
    const { ctx, prisma } = createContext();
    prisma.folder.findUnique.mockResolvedValue(sampleFolder);
    prisma.bookmark.create.mockResolvedValue(sampleBookmark);

    const result = await bookmarkResolvers.Mutation.createBookmark(
      null,
      { input: { title: "Prisma Docs", url: "https://prisma.io/docs", folderId: "folder_1" } },
      ctx
    );

    expect(result).toEqual(sampleBookmark);
    expect(prisma.bookmark.create).toHaveBeenCalledTimes(1);
  });

  test("rejects a whitespace-only title without touching the database", async () => {
    const { ctx, prisma } = createContext();

    await expect(
      bookmarkResolvers.Mutation.createBookmark(
        null,
        { input: { title: "   ", url: "https://prisma.io/docs", folderId: "folder_1" } },
        ctx
      )
    ).rejects.toThrow(GraphQLError);

    expect(prisma.folder.findUnique).not.toHaveBeenCalled();
    expect(prisma.bookmark.create).not.toHaveBeenCalled();
  });

  test("rejects a malformed url without creating the bookmark", async () => {
    const { ctx, prisma } = createContext();

    await expect(
      bookmarkResolvers.Mutation.createBookmark(
        null,
        { input: { title: "Valid title", url: "not-a-url", folderId: "folder_1" } },
        ctx
      )
    ).rejects.toThrow(GraphQLError);

    expect(prisma.bookmark.create).not.toHaveBeenCalled();
  });

  test("throws when the target folder does not exist", async () => {
    const { ctx, prisma } = createContext();
    prisma.folder.findUnique.mockResolvedValue(null);

    await expect(
      bookmarkResolvers.Mutation.createBookmark(
        null,
        { input: { title: "Valid title", url: "https://prisma.io/docs", folderId: "missing" } },
        ctx
      )
    ).rejects.toThrow(GraphQLError);

    expect(prisma.bookmark.create).not.toHaveBeenCalled();
  });
});

describe("bookmarkResolvers.Mutation.moveBookmark", () => {
  test("throws when the bookmark does not exist", async () => {
    const { ctx, prisma } = createContext();
    prisma.bookmark.findUnique.mockResolvedValue(null);

    await expect(
      bookmarkResolvers.Mutation.moveBookmark(null, { id: "missing", folderId: "folder_1" }, ctx)
    ).rejects.toThrow(GraphQLError);

    expect(prisma.bookmark.update).not.toHaveBeenCalled();
  });

  test("throws when the target folder does not exist", async () => {
    const { ctx, prisma } = createContext();
    prisma.bookmark.findUnique.mockResolvedValue(sampleBookmark);
    prisma.folder.findUnique.mockResolvedValue(null);

    await expect(
      bookmarkResolvers.Mutation.moveBookmark(null, { id: "bookmark_1", folderId: "missing" }, ctx)
    ).rejects.toThrow(GraphQLError);

    expect(prisma.bookmark.update).not.toHaveBeenCalled();
  });

  test("moves the bookmark when both bookmark and target folder exist", async () => {
    const { ctx, prisma } = createContext();
    prisma.bookmark.findUnique.mockResolvedValue(sampleBookmark);
    prisma.folder.findUnique.mockResolvedValue({ ...sampleFolder, id: "folder_2" });
    prisma.bookmark.update.mockResolvedValue({ ...sampleBookmark, folderId: "folder_2" });

    const result = await bookmarkResolvers.Mutation.moveBookmark(
      null,
      { id: "bookmark_1", folderId: "folder_2" },
      ctx
    );

    expect(result.folderId).toBe("folder_2");
    expect(prisma.bookmark.update).toHaveBeenCalledWith({
      where: { id: "bookmark_1" },
      data: { folderId: "folder_2" },
    });
  });
});

describe("bookmarkResolvers.Mutation.deleteBookmark", () => {
  test("throws when the bookmark does not exist", async () => {
    const { ctx, prisma } = createContext();
    prisma.bookmark.findUnique.mockResolvedValue(null);

    await expect(
      bookmarkResolvers.Mutation.deleteBookmark(null, { id: "missing" }, ctx)
    ).rejects.toThrow(GraphQLError);

    expect(prisma.bookmark.delete).not.toHaveBeenCalled();
  });

  test("deletes the bookmark when it exists", async () => {
    const { ctx, prisma } = createContext();
    prisma.bookmark.findUnique.mockResolvedValue(sampleBookmark);
    prisma.bookmark.delete.mockResolvedValue(sampleBookmark);

    const result = await bookmarkResolvers.Mutation.deleteBookmark(null, { id: "bookmark_1" }, ctx);

    expect(result).toEqual(sampleBookmark);
    expect(prisma.bookmark.delete).toHaveBeenCalledWith({ where: { id: "bookmark_1" } });
  });
});

describe("bookmarkResolvers.Query.bookmarks", () => {
  test("builds a where clause with folderId and case-insensitive search when both are given", async () => {
    const { ctx, prisma } = createContext();
    prisma.bookmark.findMany.mockResolvedValue([]);

    await bookmarkResolvers.Query.bookmarks(
      null,
      { folderId: "folder_1", search: "docs", take: 10, cursor: undefined },
      ctx
    );

    const callArgs = prisma.bookmark.findMany.mock.calls[0]?.[0] as {
      where: { folderId?: string; title?: { contains: string; mode: string } };
    };
    expect(callArgs.where.folderId).toBe("folder_1");
    expect(callArgs.where.title).toEqual({ contains: "docs", mode: "insensitive" });
  });

  test("omits folderId and title filters when neither is provided", async () => {
    const { ctx, prisma } = createContext();
    prisma.bookmark.findMany.mockResolvedValue([]);

    await bookmarkResolvers.Query.bookmarks(null, {}, ctx);

    const callArgs = prisma.bookmark.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(callArgs.where.folderId).toBeUndefined();
    expect(callArgs.where.title).toBeUndefined();
  });

  test("maps prisma results into edges and pageInfo", async () => {
    const { ctx, prisma } = createContext();
    prisma.bookmark.findMany.mockResolvedValue([sampleBookmark]);

    const result = await bookmarkResolvers.Query.bookmarks(null, { take: 1 }, ctx);

    expect(result.edges).toEqual([{ cursor: sampleBookmark.id, node: sampleBookmark }]);
    expect(result.pageInfo).toEqual({ endCursor: sampleBookmark.id, hasNextPage: false });
  });
});

describe("bookmarkResolvers.Bookmark.folder", () => {
  test("resolves the parent folder by folderId", async () => {
    const { ctx, prisma } = createContext();
    prisma.folder.findUniqueOrThrow.mockResolvedValue(sampleFolder);

    const result = await bookmarkResolvers.Bookmark.folder(sampleBookmark, {}, ctx);

    expect(result).toEqual(sampleFolder);
    expect(prisma.folder.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "folder_1" } });
  });
});