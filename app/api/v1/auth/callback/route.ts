import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/AuthService";
import { EsiClient } from "@/infra/esi/EsiClient";
import { EsiTokenStore } from "@/infra/esi/EsiTokenStore";
import { errorResponse } from "@/lib/api-response";
import { UnauthorizedError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      throw new UnauthorizedError("Missing code or state in callback");
    }

    const service = new AuthService(new EsiClient(), new EsiTokenStore());
    const { apiToken, characterId } = await service.handleCallback(code, state);

    // Set httpOnly cookie for browser clients
    const response = NextResponse.redirect(
      new URL("/", req.nextUrl.origin),
      { status: 302 }
    );

    response.cookies.set("fleetr_token", apiToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Also expose in JSON for non-browser clients that intercept the response
    // (The redirect is the primary response; this is a convenience header)
    response.headers.set("X-Fleetr-Token", apiToken);
    response.headers.set("X-Fleetr-Character-Id", String(characterId));

    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
