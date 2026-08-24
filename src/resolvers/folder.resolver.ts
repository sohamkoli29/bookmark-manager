import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../lib/context.js";

interface FolderByIdArgs {
  id: string;
}

interface CreateFolderArgs {
  input: { name: string };
}

export const folderResolvers = {
  Query: {
    folders: async (_parent: unknown, _args: Record<string, never>, _ctx: GraphQLContext) => {
      throw new GraphQLError("Not implemented yet");
    },
    folder: async (_parent: unknown, _args: FolderByIdArgs, _ctx: GraphQLContext) => {
      throw new GraphQLError("Not implemented yet");
    },
  },
  Mutation: {
    createFolder: async (_parent: unknown, _args: CreateFolderArgs, _ctx: GraphQLContext) => {
      throw new GraphQLError("Not implemented yet");
    },
  },
  Folder: {
    // bookmarks field resolver (nested Folder -> Bookmark[]) lands in Phase 5
  },
};