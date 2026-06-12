import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseBody, parseQuery } from "@/lib/validate";
import { ValidationError } from "@/lib/errors";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const schema = z.object({
  name: z.string().min(1),
  count: z.number().int().positive(),
});

describe("parseBody", () => {
  it("returns parsed data when valid", async () => {
    const req = makeRequest({ name: "test", count: 5 });
    const result = await parseBody(req, schema);
    expect(result).toEqual({ name: "test", count: 5 });
  });

  it("throws ValidationError with field details when invalid", async () => {
    const req = makeRequest({ name: "", count: -1 });
    try {
      await parseBody(req, schema);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const e = err as ValidationError;
      expect(e.fields).toBeDefined();
      expect(Object.keys(e.fields!)).toContain("count");
    }
  });

  it("throws ValidationError when body is not JSON", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not json",
    });
    await expect(parseBody(req, schema)).rejects.toThrow(ValidationError);
  });
});

describe("parseQuery", () => {
  const querySchema = z.object({
    limit: z.coerce.number().int().positive().default(50),
    event: z.string().optional(),
  });

  it("coerces and returns valid query params", () => {
    const params = new URLSearchParams("limit=10&event=fleet.created");
    const result = parseQuery(params, querySchema);
    expect(result.limit).toBe(10);
    expect(result.event).toBe("fleet.created");
  });

  it("applies schema defaults when param is absent", () => {
    const params = new URLSearchParams();
    const result = parseQuery(params, querySchema);
    expect(result.limit).toBe(50);
  });

  it("throws ValidationError when param is invalid", () => {
    const params = new URLSearchParams("limit=not-a-number");
    expect(() => parseQuery(params, querySchema)).toThrow(ValidationError);
  });
});
