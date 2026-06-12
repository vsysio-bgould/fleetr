"use client";

import { useFleet } from "@/contexts/FleetContext";
import type { ClientMessage } from "@/config/party-messages";

/**
 * Thin wrapper over FleetContext's send() function.
 * Messages are the canonical ClientMessage union from party-messages.ts.
 */
export function useFleetParty() {
  const { send, connection } = useFleet();

  function sendMessage(msg: ClientMessage) {
    send(msg);
  }

  return { send: sendMessage, connection };
}
