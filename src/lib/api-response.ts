import { NextResponse } from "next/server";
import { AppError, ValidationError } from "@/lib/errors";
import logger from "@/lib/logger";

export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ data }, { status });
}

export function okList<T>(
  items: T[],
  total?: number,
  offset = 0,
  limit?: number
): NextResponse<ApiSuccessResponse<T[]>> {
  const count = total ?? items.length;
  const pageSize = limit ?? items.length;
  const res = NextResponse.json({ data: items } as ApiSuccessResponse<T[]>, { status: 200 });
  res.headers.set("X-Total-Count", String(count));
  res.headers.set("X-Offset", String(offset));
  res.headers.set("X-Limit", String(pageSize));
  return res;
}

export function created<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return ok(data, 201);
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(
  err: unknown,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  if (err instanceof ValidationError) {
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.fields ? { fields: err.fields } : {}),
        },
      },
      { status: err.statusCode }
    );
  }

  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.statusCode }
    );
  }

  const id = requestId ?? crypto.randomUUID();
  logger.error({ err, requestId: id }, "Unhandled error in API route");

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        ...(process.env.NODE_ENV === "development" && { requestId: id }),
      },
    },
    { status: 500 }
  );
}
