export interface EsiFleetMembership {
  fleetId: string;
  fleetBossId: number;
  role:
    | "fleet_commander"
    | "wing_commander"
    | "squad_commander"
    | "squad_member";
  squadId?: number;
  wingId?: number;
}

export interface EsiCharacter {
  name: string;
  corporationId: number;
}

export interface EsiFleetInfo {
  isFreeMove: boolean;
  isRegistered: boolean;
  isVoiceEnabled: boolean;
  motd: string;
}

export interface EsiTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
  characterId: number;
  characterName: string;
}

export interface IEsiClient {
  exchangeCode(code: string): Promise<EsiTokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<EsiTokenResponse>;
  getFleetMembership(
    characterId: number,
    accessToken: string
  ): Promise<EsiFleetMembership | null>;
  getCharacter(characterId: number): Promise<EsiCharacter>;
  getLocation(
    characterId: number,
    accessToken: string
  ): Promise<{ solarSystemId: number } | null>;
  getFleetMembers(
    esiFleetId: string,
    accessToken: string
  ): Promise<Array<{ character_id: number; role: string }>>;
  getFleetInfo(esiFleetId: string, accessToken: string): Promise<EsiFleetInfo>;
  updateFleetSettings(
    esiFleetId: string,
    accessToken: string,
    settings: { motd: string; isFreeMove: boolean }
  ): Promise<void>;
}
