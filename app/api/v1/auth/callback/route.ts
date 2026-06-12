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
    const { apiToken, characterId, returnUrl } = await service.handleCallback(code, state);

    // Redirect against APP_URL, not the request origin — inside the
    // container the request host is 0.0.0.0:3000, not the public URL.
    const base = process.env.APP_URL ?? req.nextUrl.origin;

    // Set httpOnly cookie for browser clients
    const response = NextResponse.redirect(
      new URL(returnUrl, base),
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
