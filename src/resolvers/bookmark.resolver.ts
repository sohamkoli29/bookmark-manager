import { GraphQLError } from "graphql";
import type { Bookmark } from "@prisma/client";
import type { GraphQLContext } from "../lib/context.js";
import { paginateBookmarks } from "../lib/pagination.js";
import { validateBookmarkInput } from "../lib/validation.js";

interface BookmarksArgs {
  folderId?: string;
  search?: string;
  take?: number;
  cursor?: string;
}

interface CreateBookmarkArgs {
  input: {
    title: string;
    url: string;
    tags?: string[];
    folderId: string;
  };
}

interface UpdateBookmarkArgs {
  id: string;
  input: {
    title?: string;
    url?: string;
    tags?: string[];
  };
}

interface DeleteBookmarkArgs {
  id: string;
}

interface MoveBookmarkArgs {
  id: string;
  folderId: string;
}

interface BookmarkConnection {
  edges: { cursor: string; node: Bookmark }[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
}

async function requireFolder(ctx: GraphQLContext, folderId: string): Promise<void> {
  const folder = await ctx.prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) {
    throw new GraphQLError(`Folder with id "${folderId}" not found`, {
      extensions: { code: "FOLDER_NOT_FOUND" },
    });
  }
}

async function requireBookmark(ctx: GraphQLContext, id: string): Promise<Bookmark> {
  const bookmark = await ctx.prisma.bookmark.findUnique({ where: { id } });
  if (!bookmark) {
    throw new GraphQLError(`Bookmark with id "${id}" not found`, {
      extensions: { code: "BOOKMARK_NOT_FOUND" },
    });
  }
  return bookmark;
}

export const bookmarkResolvers = {
  Query: {
    bookmarks: async (
      _parent: unknown,
      args: BookmarksArgs,
      ctx: GraphQLContext
    ): Promise<BookmarkConnection> => {
      const where = {
        ...(args.folderId ? { folderId: args.folderId } : {}),
        ...(args.search
          ? { title: { contains: args.search, mode: "insensitive" as const } }
          : {}),
      };

            const page = await paginateBookmarks(ctx.prisma, {
        where,
        take: args.take,
        cursor: args.cursor,
      });

      return {
        edges: page.items.map((item) => ({ cursor: item.id, node: item })),
        pageInfo: { endCursor: page.endCursor, hasNextPage: page.hasNextPage },
      };
    },
  },

  Mutation: {
    createBookmark: async (
      _parent: unknown,
      args: CreateBookmarkArgs,
      ctx: GraphQLContext
    ): Promise<Bookmark> => {
      validateBookmarkInput({ title: args.input.title, url: args.input.url });
      await requireFolder(ctx, args.input.folderId);

      return ctx.prisma.bookmark.create({
        data: {
          title: args.input.title,
          url: args.input.url,
          tags: args.input.tags ?? [],
          folderId: args.input.folderId,
        },
      });
    },

    updateBookmark: async (
      _parent: unknown,
      args: UpdateBookmarkArgs,
      ctx: GraphQLContext
    ): Promise<Bookmark> => {
      validateBookmarkInput({ title: args.input.title, url: args.input.url });
      await requireBookmark(ctx, args.id);

      return ctx.prisma.bookmark.update({
        where: { id: args.id },
        data: {
          ...(args.input.title !== undefined ? { title: args.input.title } : {}),
          ...(args.input.url !== undefined ? { url: args.input.url } : {}),
          ...(args.input.tags !== undefined ? { tags: args.input.tags } : {}),
        },
      });
    },

    deleteBookmark: async (
      _parent: unknown,
      args: DeleteBookmarkArgs,
      ctx: GraphQLContext
    ): Promise<Bookmark> => {
      await requireBookmark(ctx, args.id);
      return ctx.prisma.bookmark.delete({ where: { id: args.id } });
    },

    moveBookmark: async (
      _parent: unknown,
      args: MoveBookmarkArgs,
      ctx: GraphQLContext
    ): Promise<Bookmark> => {
      await requireBookmark(ctx, args.id);
      await requireFolder(ctx, args.folderId);

      return ctx.prisma.bookmark.update({
        where: { id: args.id },
        data: { folderId: args.folderId },
      });
    },
  },

  Bookmark: {
    folder: async (parent: Bookmark, _args: unknown, ctx: GraphQLContext) => {
      return ctx.prisma.folder.findUniqueOrThrow({ where: { id: parent.folderId } });
    },
  },
};