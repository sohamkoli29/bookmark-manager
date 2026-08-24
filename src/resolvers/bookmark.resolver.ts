import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../lib/context.js";

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

export const bookmarkResolvers = {
  Query: {
    bookmarks: async (_parent: unknown, _args: BookmarksArgs, _ctx: GraphQLContext) => {
      throw new GraphQLError("Not implemented yet");
    },
  },
  Mutation: {
    createBookmark: async (_parent: unknown, _args: CreateBookmarkArgs, _ctx: GraphQLContext) => {
      throw new GraphQLError("Not implemented yet");
    },
    updateBookmark: async (_parent: unknown, _args: UpdateBookmarkArgs, _ctx: GraphQLContext) => {
      throw new GraphQLError("Not implemented yet");
    },
    deleteBookmark: async (_parent: unknown, _args: DeleteBookmarkArgs, _ctx: GraphQLContext) => {
      throw new GraphQLError("Not implemented yet");
    },
    moveBookmark: async (_parent: unknown, _args: MoveBookmarkArgs, _ctx: GraphQLContext) => {
      throw new GraphQLError("Not implemented yet");
    },
  },
  Bookmark: {
    // folder field resolver lands in Phase 5
  },
};