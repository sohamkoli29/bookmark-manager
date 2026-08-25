import type { Bookmark, Prisma, PrismaClient } from "@prisma/client";

export interface BookmarkPageArgs {
  where?: Prisma.BookmarkWhereInput;
  take?: number;
  cursor?: string;
}

export interface BookmarkPage {
  items: Bookmark[];
  endCursor: string | null;
  hasNextPage: boolean;
}

const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

export async function paginateBookmarks(
  prisma: Pick<PrismaClient, "bookmark">,
  { where, take, cursor }: BookmarkPageArgs
): Promise<BookmarkPage> {
  const pageSize = Math.min(Math.max(take ?? DEFAULT_TAKE, 1), MAX_TAKE);

  const results = await prisma.bookmark.findMany({
    where,
    take: pageSize + 1, // fetch one extra to detect hasNextPage
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1, // don't re-return the cursor record itself
        }
      : {}),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], // stable order — createdAt alone can tie
  });

  const hasNextPage = results.length > pageSize;
  const items = hasNextPage ? results.slice(0, pageSize) : results;
  const endCursor = items.length > 0 ? items[items.length - 1]!.id : null;

  return { items, endCursor, hasNextPage };
}