import { assertExists } from '@tabletop/common'
import { FRONTIER } from './frontier/map.js'
import { KEYSTONE } from './keystone/map.js'
import { OLD_FRONTIER } from './oldFrontier/map.js'
import { SOUTH_AFRICA } from './southAfrica/map.js'
import { TEXAS_SPECIAL } from './texasSpecial/map.js'
import {
    MapId,
    SettlementKind,
    type ExternalConnectionDefinition,
    type LinkDefinition,
    type MapDefinition,
    type RailroadDefinition,
    type RailroadId,
    type SettlementDefinition
} from './types.js'

export class SarMap {
    private readonly settlementsById: Map<string, SettlementDefinition>
    private readonly linksById: Map<string, LinkDefinition>
    private readonly connectionsById: Map<string, ExternalConnectionDefinition>

    constructor(readonly definition: MapDefinition) {
        this.settlementsById = new Map(definition.settlements.map((place) => [place.id, place]))
        this.linksById = new Map(definition.links.map((trackLink) => [trackLink.id, trackLink]))
        this.connectionsById = new Map(
            definition.externalConnections.map((connection) => [connection.id, connection])
        )
    }

    get id(): MapId {
        return this.definition.id
    }

    get railroads(): readonly RailroadDefinition[] {
        return this.definition.railroads
    }

    get settlements(): readonly SettlementDefinition[] {
        return this.definition.settlements
    }

    get links(): readonly LinkDefinition[] {
        return this.definition.links
    }

    get externalConnections(): readonly ExternalConnectionDefinition[] {
        return this.definition.externalConnections
    }

    get initialOffering(): readonly RailroadId[] {
        return this.definition.initialOffering
    }

    railroad(railroadId: RailroadId): RailroadDefinition {
        const found = this.definition.railroads.find((railroad) => railroad.id === railroadId)
        assertExists(found, `${railroadId} is not on the ${this.definition.name} map`)
        return found
    }

    home(railroadId: RailroadId): string {
        return this.railroad(railroadId).homeId
    }

    homeOf(settlementId: string): RailroadId | undefined {
        return this.definition.railroads.find((railroad) => railroad.homeId === settlementId)?.id
    }

    opensInInitialOffering(railroadId: RailroadId): boolean {
        return this.definition.initialOffering.includes(railroadId)
    }

    settlement(settlementId: string): SettlementDefinition {
        const found = this.settlementsById.get(settlementId)
        assertExists(found, `Unknown settlement ${settlementId}`)
        return found
    }

    link(linkId: string): LinkDefinition {
        const found = this.linksById.get(linkId)
        assertExists(found, `Unknown track link ${linkId}`)
        return found
    }

    externalConnection(connectionId: string): ExternalConnectionDefinition {
        const found = this.connectionsById.get(connectionId)
        assertExists(found, `Unknown external connection ${connectionId}`)
        return found
    }

    linksAt(settlementId: string): LinkDefinition[] {
        return this.definition.links.filter((candidate) => candidate.ends.includes(settlementId))
    }

    otherEnd(trackLink: LinkDefinition, settlementId: string): string {
        return trackLink.ends[0] === settlementId ? trackLink.ends[1] : trackLink.ends[0]
    }

    incomeLevels(settlementId: string): readonly number[] {
        const kind = this.settlement(settlementId).kind
        if (kind === SettlementKind.MetroArea) {
            const levels = this.definition.metroIncome[settlementId]
            assertExists(levels, `No income track for metro area ${settlementId}`)
            return levels
        }
        const levels = this.definition.settlementIncome[kind]
        assertExists(levels, `No income track for ${kind} on the ${this.definition.name} map`)
        return levels
    }

    isOneWayFrom(trackLink: LinkDefinition, settlementId: string): boolean {
        return trackLink.oneWayFrom === undefined || trackLink.oneWayFrom === settlementId
    }

    // The dividend after which a link crossing a closed border may be built; 0 when it never closes.
    linkOpensAfterDividend(linkId: string): number {
        return (
            this.definition.closedBorders?.find((border) => border.linkIds.includes(linkId))
                ?.opensAfterDividend ?? 0
        )
    }

    maxDevelopments(settlementId: string): number {
        return this.incomeLevels(settlementId).length - 1
    }

    startingCash(playerCount: number): number {
        const cash = this.definition.startingCash[playerCount]
        assertExists(cash, `No starting cash for ${playerCount} players`)
        return cash
    }

    offerStockSlots(playerCount: number): number {
        const slots = this.definition.offerStockSlots[playerCount]
        assertExists(slots, `No Offer Stock slots for ${playerCount} players`)
        return slots
    }
}

const MAPS: Record<MapId, SarMap> = {
    [MapId.SouthAfrica]: new SarMap(SOUTH_AFRICA),
    [MapId.TexasSpecial]: new SarMap(TEXAS_SPECIAL),
    [MapId.Frontier]: new SarMap(FRONTIER),
    [MapId.Keystone]: new SarMap(KEYSTONE),
    [MapId.OldFrontier]: new SarMap(OLD_FRONTIER)
}

export function sarMap(mapId: MapId): SarMap {
    return MAPS[mapId]
}
