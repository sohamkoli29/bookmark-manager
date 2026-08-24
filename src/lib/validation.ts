import { z } from "zod";
import { GraphQLError } from "graphql";

const bookmarkTitleSchema = z
  .string()
  .refine((val) => val.trim().length > 0, {
    message: "Title cannot be empty or whitespace-only",
  });

const bookmarkUrlSchema = z.string().refine(
  (val) => {
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: "URL is malformed or invalid" }
);

interface ValidatableBookmarkInput {
  title?: string;
  url?: string;
}

/**
 * Throws a GraphQLError (not a raw exception) on the first validation
 * failure found. Only validates fields that are actually present, so
 * partial updateBookmark inputs don't get flagged for missing fields.
 */
export function validateBookmarkInput(input: ValidatableBookmarkInput): void {
  if (input.title !== undefined) {
    const result = bookmarkTitleSchema.safeParse(input.title);
    if (!result.success) {
      throw new GraphQLError(result.error.issues[0]?.message ?? "Invalid title", {
        extensions: { code: "BAD_USER_INPUT", field: "title" },
      });
    }
  }

  if (input.url !== undefined) {
    const result = bookmarkUrlSchema.safeParse(input.url);
    if (!result.success) {
      throw new GraphQLError(result.error.issues[0]?.message ?? "Invalid url", {
        extensions: { code: "BAD_USER_INPUT", field: "url" },
      });
    }
  }
}