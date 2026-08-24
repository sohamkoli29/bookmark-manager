import { createSchema, createYoga } from "graphql-yoga";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { prisma } from "./lib/prisma.js";
import { folderResolvers } from "./resolvers/folder.resolver.js";
import { bookmarkResolvers } from "./resolvers/bookmark.resolver.js";
import type { GraphQLContext } from "./lib/context.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(join(__dirname, "schema", "schema.graphql"), "utf-8");

const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    Query: {
      ...folderResolvers.Query,
      ...bookmarkResolvers.Query,
    },
    Mutation: {
      ...folderResolvers.Mutation,
      ...bookmarkResolvers.Mutation,
    },
    Folder: folderResolvers.Folder,
    Bookmark: bookmarkResolvers.Bookmark,
  },
});

const yoga = createYoga<GraphQLContext>({
  schema,
  graphqlEndpoint: "/graphql",
  context: (): GraphQLContext => ({ prisma }),
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

Bun.serve({
  port: PORT,
  fetch: (request: Request) => yoga.fetch(request),
});

console.log(`GraphQL server running at http://localhost:${PORT}/graphql`);