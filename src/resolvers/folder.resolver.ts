import type { Bookmark, Folder } from "@prisma/client";
import type { GraphQLContext } from "../lib/context.js";

interface FolderByIdArgs {
  id: string;
}

interface CreateFolderArgs {
  input: { name: string };
}

export const folderResolvers = {
  Query: {
    folders: async (
      _parent: unknown,
      _args: Record<string, never>,
      ctx: GraphQLContext
    ): Promise<Folder[]> => {
      return ctx.prisma.folder.findMany({ orderBy: { createdAt: "asc" } });
    },

    folder: async (
      _parent: unknown,
      args: FolderByIdArgs,
      ctx: GraphQLContext
    ): Promise<Folder | null> => {
      return ctx.prisma.folder.findUnique({ where: { id: args.id } });
    },
  },

  Mutation: {
    createFolder: async (
      _parent: unknown,
      args: CreateFolderArgs,
      ctx: GraphQLContext
    ): Promise<Folder> => {
      return ctx.prisma.folder.create({ data: { name: args.input.name } });
    },
  },

  Folder: {
    // Nested field resolver — bookmarks are only fetched when a query
    // actually asks for them (not eagerly joined into folders/folder).
    bookmarks: async (
      parent: Folder,
      _args: unknown,
      ctx: GraphQLContext
    ): Promise<Bookmark[]> => {
      return ctx.prisma.bookmark.findMany({
        where: { folderId: parent.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
    },
  },
};