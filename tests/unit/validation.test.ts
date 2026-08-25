import { describe, test, expect } from "bun:test";
import { GraphQLError } from "graphql";
import { validateBookmarkInput } from "../../src/lib/validation.js";

describe("validateBookmarkInput", () => {
  test("accepts a valid title and url", () => {
    expect(() =>
      validateBookmarkInput({ title: "Prisma Docs", url: "https://prisma.io/docs" })
    ).not.toThrow();
  });

  test("rejects an empty title", () => {
    expect(() => validateBookmarkInput({ title: "" })).toThrow(GraphQLError);
  });

  test("rejects a whitespace-only title", () => {
    expect(() => validateBookmarkInput({ title: "   " })).toThrow(GraphQLError);
  });

  test("rejects a malformed url", () => {
    expect(() => validateBookmarkInput({ url: "not-a-url" })).toThrow(GraphQLError);
  });

  test("rejects a url with no scheme", () => {
    expect(() => validateBookmarkInput({ url: "prisma.io/docs" })).toThrow(GraphQLError);
  });

  test("skips validation for fields not present, for partial updates", () => {
    expect(() => validateBookmarkInput({ title: "Only title changing" })).not.toThrow();
  });

  test("error extensions identify which field failed", () => {
    try {
      validateBookmarkInput({ title: "" });
      throw new Error("expected validateBookmarkInput to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(GraphQLError);
      expect((error as GraphQLError).extensions.field).toBe("title");
    }
  });
});