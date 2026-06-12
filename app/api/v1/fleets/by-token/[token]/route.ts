import { NextRequest } from "next/server";
import { ok, errorResponse } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";
import db from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = await Promise.resolve(params);
    const fleet = await db.fleet.findFirst({
      where: { joinToken: token, disbandedAt: null },
      select: { id: true, name: true },
    });
    if (!fleet) throw new NotFoundError("Fleet");
    return ok({ fleetId: fleet.id, name: fleet.name });
  } catch (err) {
    return errorResponse(err);
  }
}
