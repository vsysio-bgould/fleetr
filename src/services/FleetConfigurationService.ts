import db from "@/lib/db";
import type { IEsiClient, EsiFleetInfo } from "@/infra/esi/types";
import { EsiTokenStore } from "@/infra/esi/EsiTokenStore";
import { NotFoundError, ScopeNotGrantedError } from "@/lib/errors";

const WRITE_SCOPE = "esi-fleets.write_fleet.v1";

export class FleetConfigurationService {
  constructor(
    private readonly esiClient: IEsiClient,
    private readonly tokenStore = new EsiTokenStore()
  ) {}

  async get(fleetId: string): Promise<EsiFleetInfo & { joinUrl: string }> {
    const fleet = await this.getFleet(fleetId);
    const token = await this.getFcToken(fleet.fcCharacterId);
    const info = await this.esiClient.getFleetInfo(fleet.esiFleetId, token.accessToken);
    return { ...info, joinUrl: this.buildJoinUrl(fleet.joinToken) };
  }

  async appendFleetrLink(fleetId: string): Promise<EsiFleetInfo & { joinUrl: string }> {
    const fleet = await this.getFleet(fleetId);
    const token = await this.getFcToken(fleet.fcCharacterId);
    if (!token.scopes.includes(WRITE_SCOPE)) {
      throw new ScopeNotGrantedError(WRITE_SCOPE, "FLEET_WRITE");
    }

    const info = await this.esiClient.getFleetInfo(fleet.esiFleetId, token.accessToken);
    const joinUrl = this.buildJoinUrl(fleet.joinToken);
    const link = `<br><br>Fleetr: <a href="${joinUrl}">${joinUrl}</a>`;
    const motd = info.motd.includes(joinUrl) ? info.motd : `${info.motd}${link}`;

    await this.esiClient.updateFleetSettings(fleet.esiFleetId, token.accessToken, {
      motd,
      isFreeMove: info.isFreeMove,
    });

    return { ...info, motd, joinUrl };
  }

  private async getFleet(fleetId: string) {
    const fleet = await db.fleet.findUnique({
      where: { id: fleetId },
      select: { esiFleetId: true, joinToken: true, fcCharacterId: true },
    });
    if (!fleet) throw new NotFoundError("Fleet");
    return fleet;
  }

  private async getFcToken(characterId: number) {
    const token = await this.tokenStore.get(characterId);
    if (!token) throw new NotFoundError("FC ESI token");
    return token;
  }

  private buildJoinUrl(joinToken: string): string {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    return `${appUrl}/join/${joinToken}`;
  }
}
