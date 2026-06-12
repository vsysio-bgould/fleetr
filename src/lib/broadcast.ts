import logger from "@/lib/logger";

/**
 * Broadcast a ServerMessage to all PartyKit connections in a fleet room.
 * Fire-and-forget safe — logs on failure but does not throw.
 */
export async function broadcastToFleet(
  fleetId: string,
  message: object
): Promise<void> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const secret = process.env.PARTYKIT_SECRET ?? "";

  try {
    const res = await fetch(
      `${appUrl}/api/v1/internal/fleets/${fleetId}/broadcast`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PartyKit-Secret": secret,
        },
        body: JSON.stringify(message),
      }
    );

    if (!res.ok) {
      logger.warn({ fleetId, status: res.status }, "Fleet broadcast failed");
    }
  } catch (err) {
    logger.warn({ fleetId, err }, "Fleet broadcast network error");
  }
}
