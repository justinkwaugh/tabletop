import {
    privatePowerUsed,
    privateTokenStationId,
    trackReachability,
    EighteenXXTransferTiming,
    RailwayMapState,
    StationPlacement,
    TileEdges,
    addCompanyStations,
    closePrivate,
    controllingOwner,
    locationMarkers,
    placeLocationMarker,
    tileFacesStop,
    type CompanyDecisionState,
    type PrivatePowerRules,
    type PrivateTrackTerms,
    type TrackRequest
} from '@tabletop/18xx'
import { EighteenUSAMap } from './map.js'
import {
    EighteenUSATileSet,
    CompanyTownTileIds,
    PlainCityTileIds,
    RegionalHeadquartersTileId,
    RuralJunctionTileIds,
    isCompanyTown
} from './tiles.js'
import { EighteenUSAPhases } from './trains.js'
import {
    BridgeCityIds,
    GreatNorthernBorderIds,
    ResourceLocationIds,
    resourcesAt,
    type ResourceKind
} from './mapFeatures.js'
import { RedAreas, ImportExportHubToken } from './redAreas.js'
import { resourceSubsidyKinds } from './subsidies.js'
import { SubsidyPrivateIds, isSubsidyPrivate } from './privates.js'
import {
    AmericanBridgeId,
    AmericanLocomotiveId,
    BoomtownId,
    CompanyTownId,
    ExpressFreightId,
    FoxBridgeId,
    GreatNorthernId,
    HendricksonIronId,
    ImportExportHubId,
    KeystoneBridgeId,
    LehighCoalId,
    PeabodyCoalId,
    ReeceOilId,
    RegionalHeadquartersId,
    RuralJunctionId,
    StandardOilId,
    AnacondaCopperId,
    ConsolidationCoalId,
    SuemWynnId,
    companyHolding
} from './privateHolders.js'
import {
    BridgeMarker,
    CoalMarker,
    ExpressFreightMarker,
    ImportExportMarker,
    OilMarker,
    OreMarker,
    ResourceMarkerKinds
} from './resourceMarkers.js'
import { privateUsesMade, recordPrivateUse, type EighteenUSAState } from './state.js'
import { EighteenUSATrackRules } from './trackRules.js'
import { EighteenUSAStations, StationLimit } from './owedStations.js'
import { isMetropolis } from './metropolisRules.js'
import { NewYorkId } from './mapFeatures.js'
import { EighteenUSAStationRules } from './stationRules.js'
import { redAreaRevenues } from './map.js'
import { BeforeRunStates } from './pullmans.js'

type PowerState = CompanyDecisionState & EighteenUSAState

const YellowTrackIds = ['18xx:7', '18xx:8', '18xx:9']
const ResourceMarkers: Readonly<Record<ResourceKind, string>> = {
    coal: CoalMarker,
    oil: OilMarker,
    ore: OreMarker
}
// Coal and ore tokens waive their hex's $15 terrain (§13.1, §13.3).
const ResourceTerrainDiscount: Readonly<Record<ResourceKind, number>> = {
    coal: 15,
    oil: 0,
    ore: 15
}

type ResourcePower = { kinds: readonly ResourceKind[]; uses: number }
const ResourcePowers: Readonly<Record<string, ResourcePower>> = {
    [LehighCoalId]: { kinds: ['coal'], uses: 1 },
    [ReeceOilId]: { kinds: ['oil'], uses: 1 },
    [HendricksonIronId]: { kinds: ['ore'], uses: 1 },
    [StandardOilId]: { kinds: ['oil'], uses: 2 },
    [PeabodyCoalId]: { kinds: ['coal'], uses: 2 },
    [KeystoneBridgeId]: { kinds: ['coal', 'ore'], uses: 1 },
    [AnacondaCopperId]: { kinds: ['ore'], uses: 2 },
    [ConsolidationCoalId]: { kinds: ['coal'], uses: 3 }
}
const BridgePowers: Readonly<Record<string, number>> = {
    [FoxBridgeId]: 1,
    [KeystoneBridgeId]: 1,
    [AmericanBridgeId]: 2
}

function presidedCompany(state: PowerState, privateId: string, playerId: string) {
    const companyId = companyHolding(state, privateId)
    return companyId && controllingOwner(state, companyId)?.playerId === playerId
        ? companyId
        : undefined
}

/** The company holding the private, when its president lays track for it this turn. */
function layingCompany(state: PowerState, privateId: string, playerId: string) {
    const companyId = presidedCompany(state, privateId, playerId)
    return companyId &&
        state.machineState === 'LayingTrack' &&
        state.trackStep?.companyId === companyId
        ? companyId
        : undefined
}

/** The company holding the private, when it is operating and its president acts for it. */
function operatingCompany(state: PowerState, privateId: string, playerId: string) {
    const companyId = presidedCompany(state, privateId, playerId)
    return companyId && EighteenXXTransferTiming.operatingCompany(state) === companyId
        ? companyId
        : undefined
}

function reaches(state: PowerState, companyId: string, locationId: string): boolean {
    return trackReachability(state, EighteenUSATrackRules, companyId).canReach(locationId)
}

function emptyHex(state: PowerState, locationId: string): boolean {
    return !state.tileInventory.placements[locationId]
}

function neighbourIds(locationId: string): string[] {
    return TileEdges.flatMap((edge) => EighteenUSAMap.neighbor(locationId, edge)?.id ?? [])
}

function resourceKindsOf(state: PowerState, privateId: string): readonly ResourceKind[] {
    if (privateId === SubsidyPrivateIds.resource)
        return resourceSubsidyKinds(
            state.companies
                .filter((company) => company.kind === 'private' && !isSubsidyPrivate(company.id))
                .map((company) => company.id)
        )
    return ResourcePowers[privateId]?.kinds ?? []
}

function resourceUses(privateId: string): number {
    return privateId === SubsidyPrivateIds.resource ? 1 : (ResourcePowers[privateId]?.uses ?? 0)
}

/** The kind of token a resource lay at this hex places: the first the power has that the hex offers. */
export function resourceKindFor(
    state: PowerState,
    privateId: string,
    locationId: string
): ResourceKind | undefined {
    const offered = resourcesAt(locationId)
    return resourceKindsOf(state, privateId).find((kind) => offered.includes(kind))
}

// A resource token goes down with the hex's first, yellow tile, whose track points into a
// neighbouring city; neither a Company Town nor a resource tile counts (§13, P27).
function resourceTerms(
    state: PowerState,
    privateId: string,
    companyId: string
): PrivateTrackTerms | undefined {
    if (privateUsesMade(state, privateId) >= resourceUses(privateId)) return undefined
    const kinds = resourceKindsOf(state, privateId)
    const locationIds = kinds
        .flatMap((kind) => ResourceLocationIds[kind])
        .filter((locationId, index, all) => all.indexOf(locationId) === index)
        .filter((locationId) => emptyHex(state, locationId))
    if (!locationIds.length) return undefined
    const discount = Math.max(...kinds.map((kind) => ResourceTerrainDiscount[kind]))
    const subsidy = privateId === SubsidyPrivateIds.resource
    return {
        companyId,
        locationIds,
        definitionIds: YellowTrackIds,
        payer: { kind: 'company', companyId },
        connected: true,
        reusable: true,
        ...(subsidy ? {} : { countsAsOrdinaryLay: true as const }),
        ...(discount ? { terrainDiscount: discount } : {}),
        restriction: (request: TrackRequest) =>
            tileFacesStop(state, EighteenUSATrackRules, request, ['city', 'offboard'], (id) =>
                locationMarkers(state, { locationId: id }).some((marker) =>
                    ResourceMarkerKinds.includes(marker.kind)
                )
            )
                ? undefined
                : 'A resource tile’s track must point into a city (§13).'
    }
}

// P9 turns a plain yellow city green, as a free extra action, whatever the phase (P9).
function boomtownTerms(state: PowerState, companyId: string, locationIds: readonly string[]) {
    return {
        companyId,
        locationIds,
        definitionIds: PlainCityTileIds.green,
        payer: { kind: 'company' as const, companyId },
        connected: true,
        colors: ['green'],
        restriction: (request: TrackRequest) => {
            const placement = state.tileInventory.placements[request.locationId]
            return placement && PlainCityTileIds.yellow.includes(placement.definitionId)
                ? undefined
                : 'Only a plain yellow city becomes a boomtown.'
        }
    }
}

function plainYellowCities(state: PowerState): string[] {
    return Object.entries(state.tileInventory.placements)
        .filter(
            ([locationId, placement]) =>
                PlainCityTileIds.yellow.includes(placement.definitionId) &&
                !isMetropolis(state, locationId)
        )
        .map(([locationId]) => locationId)
}

// The Regional HQ upgrades a green or brown city that is no metropolis, from phase 5 (P16).
function regionalHeadquartersTerms(state: PowerState, companyId: string) {
    if (!EighteenUSAPhases.isAtLeast(state.phaseId, '5')) return undefined
    const mapState = new RailwayMapState(EighteenUSAMap, EighteenUSATileSet, state.tileInventory)
    const locationIds = EighteenUSAMap.definition.locations
        .map((location) => location.id)
        .filter((locationId) => {
            const face = mapState.tile(locationId).face
            return (
                ['green', 'brown'].includes(face.color) &&
                face.nodes.some((node) => node.kind === 'city' && node.stationSlots > 0) &&
                !isMetropolis(state, locationId) &&
                !face.labels.length
            )
        })
    return {
        companyId,
        locationIds,
        definitionIds: [RegionalHeadquartersTileId],
        payer: { kind: 'company' as const, companyId },
        connected: true,
        countsAsOrdinaryLay: true as const,
        relabels: true as const,
        colors: ['gray']
    }
}

// The Great Northern lays one more yellow track a round on the northern border, free of terrain
// (P17).
function greatNorthernTerms(state: PowerState, companyId: string) {
    if (privateUsesMade(state, greatNorthernRoundKey(state)) > 0) return undefined
    return {
        companyId,
        locationIds: GreatNorthernBorderIds.filter((locationId) => emptyHex(state, locationId)),
        definitionIds: YellowTrackIds,
        payer: { kind: 'company' as const, companyId },
        connected: true,
        free: true as const,
        reusable: true as const
    }
}

function greatNorthernRoundKey(state: PowerState): string {
    const set = state.operatingSet
    return `${GreatNorthernId}@${set?.number ?? 0}.${set?.roundNumber ?? 0}`
}

// A rural junction replaces an empty city hex, never beside another one (P26).
function ruralJunctionTerms(state: PowerState, companyId: string) {
    const placed = Object.entries(state.tileInventory.placements)
        .filter(([, placement]) => RuralJunctionTileIds.includes(placement.definitionId))
        .map(([locationId]) => locationId)
    if (placed.length >= RuralJunctionTileIds.length) return undefined
    const locationIds = EighteenUSAMap.definition.locations
        .filter(
            (location) =>
                location.buildable &&
                emptyHex(state, location.id) &&
                location.preprintedTile.nodes.some((node) => node.kind === 'city') &&
                !isMetropolis(state, location.id) &&
                !neighbourIds(location.id).some((id) => placed.includes(id))
        )
        .map((location) => location.id)
    return {
        companyId,
        locationIds,
        definitionIds: RuralJunctionTileIds,
        payer: { kind: 'company' as const, companyId },
        connected: true,
        countsAsOrdinaryLay: true as const,
        relabels: true as const,
        reusable: true as const
    }
}

// A Company Town goes on an empty hex with no station, not beside a metropolis (P27).
function companyTownTerms(state: PowerState, companyId: string) {
    const locationIds = EighteenUSAMap.definition.locations
        .filter(
            (location) =>
                location.buildable &&
                emptyHex(state, location.id) &&
                !state.stations.some(
                    (station) =>
                        station.status === 'placed' && station.position.locationId === location.id
                ) &&
                !neighbourIds(location.id).some(
                    (id) => id === NewYorkId || isMetropolis(state, id)
                ) &&
                location.id !== NewYorkId &&
                !isMetropolis(state, location.id)
        )
        .map((location) => location.id)
    return {
        companyId,
        locationIds,
        definitionIds: CompanyTownTileIds,
        payer: { kind: 'company' as const, companyId },
        connected: true,
        countsAsOrdinaryLay: true as const,
        relabels: true as const,
        colors: ['gray']
    }
}

// The Boomtown subsidy upgrades the company's home city to green in its first operating round,
// as a free action (Subsidy Tiles).
function boomtownSubsidyTerms(state: PowerState, companyId: string) {
    const home = state.stations.find(
        (station) => station.companyId === companyId && station.id === `${companyId}:home`
    )
    if (home?.status !== 'placed') return undefined
    return boomtownTerms(state, companyId, [home.position.locationId])
}

function trackTerms(state: PowerState, privateId: string, playerId: string) {
    const companyId = layingCompany(state, privateId, playerId)
    if (!companyId) return undefined
    if (ResourcePowers[privateId] || privateId === SubsidyPrivateIds.resource)
        return resourceTerms(state, privateId, companyId)
    switch (privateId) {
        case BoomtownId:
            return boomtownTerms(state, companyId, plainYellowCities(state))
        case SubsidyPrivateIds.boomtown:
            return boomtownSubsidyTerms(state, companyId)
        case RegionalHeadquartersId:
            return regionalHeadquartersTerms(state, companyId)
        case GreatNorthernId:
            return greatNorthernTerms(state, companyId)
        case RuralJunctionId:
            return ruralJunctionTerms(state, companyId)
        case CompanyTownId:
            return companyTownTerms(state, companyId)
    }
    return undefined
}

function bridgesPlaced(state: PowerState, privateId: string): number {
    return locationMarkers(state, { kind: BridgeMarker, privateCompanyId: privateId }).length
}

// A bridge goes on a reachable river city without one, never New Orleans as a metropolis (§13.4).
function bridgeLocations(state: PowerState, companyId: string): string[] {
    const bridged = locationMarkers(state, { kind: BridgeMarker }).map(
        (marker) => marker.locationId
    )
    return BridgeCityIds.filter(
        (locationId) =>
            !bridged.includes(locationId) &&
            !(locationId === 'I19' && isMetropolis(state, locationId)) &&
            reaches(state, companyId, locationId)
    )
}

function redAreaLocations(state: PowerState, companyId: string): string[] {
    return RedAreas.flatMap((area) =>
        area.locationIds.some((locationId) => reaches(state, companyId, locationId))
            ? [area.locationIds[0]]
            : []
    )
}

/**
 * The Company Town's company places a bonus station on it from the supply, unless it already
 * holds eight (P27; BGG ruling: the bonus is forfeit at eight).
 */
function placeCompanyTownStation(state: PowerState, companyId: string, locationId: string) {
    if (EighteenUSAStations.limitedStations(state, companyId) >= StationLimit) return
    addCompanyStations(state, companyId, 1)
    const station = state.stations.at(-1)
    if (!station) return
    state.stations = state.stations.map((entry) =>
        entry.id === station.id
            ? { ...entry, status: 'placed', position: { locationId, nodeId: 'city', slot: 0 } }
            : entry
    )
}

export const EighteenUSAPrivatePowerRules: PrivatePowerRules = {
    trackTerms: (state: PowerState, privateId, playerId) => trackTerms(state, privateId, playerId),
    afterTrackLay(state: PowerState, privateId, details) {
        if (privateId === GreatNorthernId) {
            recordPrivateUse(state, greatNorthernRoundKey(state))
            return { payments: [], closedPrivateIds: [] }
        }
        if (privateId === CompanyTownId) {
            placeCompanyTownStation(state, details.companyId, details.locationId)
            return { payments: [], closedPrivateIds: [privateId] }
        }
        if (privateId === RuralJunctionId) {
            const placed = Object.values(state.tileInventory.placements).filter((placement) =>
                RuralJunctionTileIds.includes(placement.definitionId)
            ).length
            return {
                payments: [],
                closedPrivateIds: placed >= RuralJunctionTileIds.length ? [privateId] : []
            }
        }
        const kind = resourceKindFor(state, privateId, details.locationId)
        if (kind) {
            recordPrivateUse(state, privateId)
            placeLocationMarker(state, {
                locationId: details.locationId,
                kind: ResourceMarkers[kind],
                privateCompanyId: privateId
            })
            const usedUp = privateUsesMade(state, privateId) >= resourceUses(privateId)
            // Keystone's bridge outlives its resource token (P21).
            const closes =
                usedUp && !(privateId === KeystoneBridgeId && bridgesPlaced(state, privateId) < 1)
            return { payments: [], closedPrivateIds: closes ? [privateId] : [] }
        }
        return { payments: [], closedPrivateIds: [privateId] }
    },
    markerTerms(state: PowerState, privateId, playerId) {
        const companyId = operatingCompany(state, privateId, playerId)
        if (!companyId) return undefined
        const bridges = BridgePowers[privateId]
        if (bridges && bridgesPlaced(state, privateId) < bridges) {
            const locationIds = bridgeLocations(state, companyId)
            return locationIds.length ? { kind: BridgeMarker, locationIds } : undefined
        }
        const marker = privateId === ExpressFreightId ? ExpressFreightMarker : ImportExportMarker
        // P8's marker counts toward the company's eight stations (BGG ruling PR-8).
        const roomFor =
            privateId !== ExpressFreightId ||
            EighteenUSAStations.limitedStations(state, companyId) < StationLimit
        if (
            (privateId === ImportExportHubId || privateId === ExpressFreightId) &&
            roomFor &&
            !locationMarkers(state, { kind: marker }).length
        ) {
            const locationIds = redAreaLocations(state, companyId)
            return locationIds.length ? { kind: marker, locationIds } : undefined
        }
        return undefined
    },
    // P6 lays its own token over the red area's, and is discarded (P6).
    afterMarker(state: PowerState, privateId, locationId) {
        if (privateId !== ImportExportHubId) return
        const area = RedAreas.find((entry) => entry.locationIds.includes(locationId))
        if (!area) return
        state.redAreaTokens = { ...state.redAreaTokens, [area.id]: ImportExportHubToken.id }
        state.tileInventory = {
            ...state.tileInventory,
            dealtRevenues: {
                ...state.tileInventory.dealtRevenues,
                ...redAreaRevenues(area.id, ImportExportHubToken.id)
            }
        }
        closePrivate(state, privateId)
    },
    tokenTerms(state: PowerState, privateId, playerId) {
        const companyId = operatingCompany(state, privateId, playerId)
        if (!companyId) return undefined
        if (privateId !== SuemWynnId && privateId !== SubsidyPrivateIds.freeStation)
            return undefined
        if (privatePowerUsed(state, privateId) || !privateTokenStationId(state, companyId))
            return undefined
        const placement = new StationPlacement(state, EighteenUSAStationRules)
        const positions = EighteenUSAMap.definition.locations.flatMap((location) =>
            placement.mapState.tile(location.id).face.nodes.flatMap((node) => {
                if (node.kind !== 'city' || node.stationSlots === 0) return []
                const held = state.stations.flatMap((station) =>
                    station.status === 'placed' && station.position.locationId === location.id
                        ? [station]
                        : []
                )
                if (held.some((station) => station.companyId === companyId)) return []
                if (isCompanyTown(state.tileInventory, location.id)) return []
                const inCity = held.filter((station) => station.position.nodeId === node.id)
                const full = inCity.length >= node.stationSlots
                // Suem & Wynn joins only a full city; the Free Station any reachable one (P20).
                if (privateId === SuemWynnId && !full) return []
                if (!reaches(state, companyId, location.id)) return []
                const open = placement.openSlots(companyId, location.id, node.id)[0]
                const slot = full ? node.stationSlots : open
                return slot === undefined
                    ? []
                    : [{ locationId: location.id, nodeId: node.id, slot }]
            })
        )
        return positions.length ? { companyId, positions } : undefined
    },
    // American Locomotive may be discarded before the run to buy a bank train at 10% off (P25).
    earlyTrainCompany(state: PowerState, privateId, playerId) {
        if (privateId !== AmericanLocomotiveId) return undefined
        const companyId = operatingCompany(state, privateId, playerId)
        return companyId && BeforeRunStates.includes(state.machineState) ? companyId : undefined
    },
    betweenTurnsPrivateIds: []
}
