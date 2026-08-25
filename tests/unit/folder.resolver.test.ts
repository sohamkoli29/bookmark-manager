import { describe, test, expect, mock } from "bun:test";
import type { Mock } from "bun:test";
import { folderResolvers } from "../../src/resolvers/folder.resolver.js";
import type { GraphQLContext } from "../../src/lib/context.js";
import type { Folder, Bookmark } from "@prisma/client";

interface MockPrisma {
  folder: {
    findMany: Mock<(...args: unknown[]) => Promise<Folder[]>>;
    findUnique: Mock<(...args: unknown[]) => Promise<Folder | null>>;
    create: Mock<(...args: unknown[]) => Promise<Folder>>;
  };
  bookmark: {
    findMany: Mock<(...args: unknown[]) => Promise<Bookmark[]>>;
  };
}

function createContext(): { ctx: GraphQLContext; prisma: MockPrisma } {
  const prisma: MockPrisma = {
    folder: { findMany: mock(), findUnique: mock(), create: mock() },
    bookmark: { findMany: mock() },
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

describe("folderResolvers.Query", () => {
  test("folders returns all folders from prisma", async () => {
    const { ctx, prisma } = createContext();
    prisma.folder.findMany.mockResolvedValue([sampleFolder]);

    const result = await folderResolvers.Query.folders(null, {}, ctx);

    expect(result).toEqual([sampleFolder]);
    expect(prisma.folder.findMany).toHaveBeenCalledTimes(1);
  });

  test("folder returns null when not found", async () => {
    const { ctx, prisma } = createContext();
    prisma.folder.findUnique.mockResolvedValue(null);

    const result = await folderResolvers.Query.folder(null, { id: "missing" }, ctx);

    expect(result).toBeNull();
  });

  test("folder returns the matching folder by id", async () => {
    const { ctx, prisma } = createContext();
    prisma.folder.findUnique.mockResolvedValue(sampleFolder);

    const result = await folderResolvers.Query.folder(null, { id: "folder_1" }, ctx);

    expect(result).toEqual(sampleFolder);
    expect(prisma.folder.findUnique).toHaveBeenCalledWith({ where: { id: "folder_1" } });
  });
});

describe("folderResolvers.Mutation", () => {
  test("createFolder creates a folder with the given name", async () => {
    const { ctx, prisma } = createContext();
    prisma.folder.create.mockResolvedValue(sampleFolder);

    const result = await folderResolvers.Mutation.createFolder(null, { input: { name: "Work" } }, ctx);

    expect(result).toEqual(sampleFolder);
    expect(prisma.folder.create).toHaveBeenCalledWith({ data: { name: "Work" } });
  });
});

describe("folderResolvers.Folder.bookmarks", () => {
  test("fetches bookmarks scoped to the parent folder id", async () => {
    const { ctx, prisma } = createContext();
    prisma.bookmark.findMany.mockResolvedValue([sampleBookmark]);

    const result = await folderResolvers.Folder.bookmarks(sampleFolder, {}, ctx);

    expect(result).toEqual([sampleBookmark]);
    const callArgs = prisma.bookmark.findMany.mock.calls[0]?.[0] as { where: { folderId: string } };
    expect(callArgs.where.folderId).toBe("folder_1");
  });
});