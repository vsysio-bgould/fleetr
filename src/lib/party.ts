import logger from "@/lib/logger";

export function buildPartyKitHttpUrl(roomId: string): string {
  const configured =
    process.env.PARTYKIT_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_PARTYKIT_HOST ??
    "localhost:1999";
  const base = configured.match(/^https?:\/\//)
    ? configured
    : `http://${configured}`;
  return new URL(`/parties/main/${roomId}`, base).toString();
}

export async function getConnectedViewerCount(fleetId: string): Promise<number | null> {
  const secret = process.env.PARTYKIT_SECRET;
  if (!secret) return null;

  try {
    const res = await fetch(buildPartyKitHttpUrl(`fleet-${fleetId}`), {
      method: "GET",
      headers: { "X-PartyKit-Secret": secret },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { connectedViewers?: number };
    return typeof body.connectedViewers === "number" ? body.connectedViewers : null;
  } catch (err) {
    logger.warn({ fleetId, err }, "PartyKit presence query failed");
    return null;
  }
}
