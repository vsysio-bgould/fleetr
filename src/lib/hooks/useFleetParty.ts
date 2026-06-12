"use client";

import { useFleet } from "@/contexts/FleetContext";

/**
 * Thin wrapper over FleetContext's send() function.
 * Use this when you need to send a message to the PartyKit room.
 */
export function useFleetParty() {
  const { send, connection } = useFleet();

  function sendMessage(type: string, payload?: Record<string, unknown>) {
    send({ type, payload: payload ?? {} });
  }

  return { send: sendMessage, connection };
}
