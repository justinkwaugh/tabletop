import { assertExists } from '@tabletop/common'
import {
    homeStationId,
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
    type PrivateTrackOption,
    type PrivateTrackTerms,
    type StationPosition,
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
    ResourceKinds,
    GreatNorthernBorderIds,
    ResourceLocationIds,
    resourcesAt,
    type ResourceKind
} from './mapFeatures.js'
import { RedAreas, ImportExportHubToken } from './redAreas.js'
import { resourceSubsidyKinds } from './subsidies.js'
import { ResourceTokens } from './resources.js'
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
import { EighteenUSATrackRules, layRestriction } from './trackRules.js'
import { EighteenUSAStations, StationLimit } from './owedStations.js'
import { isMetropolis } from './metropolisRules.js'
import { NewYorkId } from './mapFeatures.js'
import { EighteenUSAStationRules } from './stationRules.js'
import { redAreaRevenues } from './map.js'
import { BeforeRunStates } from './pullmans.js'

type PowerState = CompanyDecisionState & EighteenUSAState

const YellowTrackIds = ['18xx:7', '18xx:8', '18xx:9']
const ResourceLabels: Readonly<Record<ResourceKind, string>> = {
    coal: 'Coal',
    oil: 'Oil',
    ore: 'Ore'
}
const ResourceMarkers: Readonly<Record<ResourceKind, string>> = {
    coal: CoalMarker,
    oil: OilMarker,
    ore: OreMarker
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

function resourcePowerIds(): string[] {
    return [...Object.keys(ResourcePowers), SubsidyPrivateIds.resource]
}

function usesLeft(state: PowerState, privateId: string): boolean {
    return privateUsesMade(state, privateId) < resourceUses(privateId)
}

/** The company's other resource powers with a use left, which may join this one's lay. */
function partnerPowerIds(state: PowerState, privateId: string, companyId: string): string[] {
    return resourcePowerIds().filter(
        (id) => id !== privateId && companyHolding(state, id) === companyId && usesLeft(state, id)
    )
}

const optionId = (kinds: readonly ResourceKind[]) => kinds.join('+')

function optionKinds(option: string): ResourceKind[] {
    const named = option.split('+')
    return ResourceKinds.filter((kind) => named.includes(kind))
}

function emptyResourceHexes(state: PowerState, kinds: readonly ResourceKind[]): string[] {
    return ResourceLocationIds[kinds[0]].filter(
        (locationId) =>
            emptyHex(state, locationId) &&
            kinds.every((kind) => resourcesAt(locationId).includes(kind))
    )
}

/**
 * The tokens a resource lay may place: one of the power's kinds, or at B10 and B12 both of the
 * hex's kinds, the other from another of the company's resource powers (§13, P21).
 */
function resourceOptions(
    state: PowerState,
    privateId: string,
    companyId: string
): PrivateTrackOption[] {
    const own = resourceKindsOf(state, privateId)
    const partners = partnerPowerIds(state, privateId, companyId).flatMap((id) =>
        resourceKindsOf(state, id)
    )
    const pairs = ResourceKinds.flatMap((first) =>
        ResourceKinds.filter(
            (second) =>
                ResourceKinds.indexOf(second) > ResourceKinds.indexOf(first) &&
                ((own.includes(first) && partners.includes(second)) ||
                    (own.includes(second) && partners.includes(first)))
        ).map((second) => [first, second])
    )
    return [...own.map((kind) => [kind]), ...pairs].flatMap((kinds) => {
        const locationIds = emptyResourceHexes(state, kinds)
        return locationIds.length
            ? [
                  {
                      id: optionId(kinds),
                      label: kinds.map((kind) => ResourceLabels[kind]).join(' and '),
                      locationIds
                  }
              ]
            : []
    })
}

type ResourceSupply = { kind: ResourceKind; privateId: string }

/**
 * The private supplying each kind of token a lay places, one token each, the laying power among
 * them: Keystone Bridge takes whichever kind its partner lacks.
 */
function resourceSuppliers(
    state: PowerState,
    privateId: string,
    companyId: string,
    kinds: readonly ResourceKind[]
): ResourceSupply[] {
    const partners = partnerPowerIds(state, privateId, companyId)
    const assign = (remaining: readonly ResourceKind[], powers: readonly string[]) =>
        remaining.reduce<ResourceSupply[] | undefined>((chosen, kind) => {
            const supplier =
                chosen &&
                powers.find(
                    (id) =>
                        !chosen.some((entry) => entry.privateId === id) &&
                        resourceKindsOf(state, id).includes(kind)
                )
            return chosen && supplier ? [...chosen, { kind, privateId: supplier }] : undefined
        }, [])
    const own = kinds.filter((kind) => resourceKindsOf(state, privateId).includes(kind))
    for (const kind of own) {
        const rest = assign(
            kinds.filter((other) => other !== kind),
            partners
        )
        if (rest)
            return [{ kind, privateId }, ...rest].sort(
                (a, b) => ResourceKinds.indexOf(a.kind) - ResourceKinds.indexOf(b.kind)
            )
    }
    throw new Error(`No held privates supply ${kinds.join(' and ')} tokens`)
}

// A resource token goes down with the hex's first, yellow tile, whose track points into a
// neighbouring city; neither a Company Town nor a resource tile counts (§13, P27).
function resourceTerms(
    state: PowerState,
    privateId: string,
    companyId: string
): PrivateTrackTerms | undefined {
    if (!usesLeft(state, privateId)) return undefined
    const kinds = resourceKindsOf(state, privateId)
    const options = resourceOptions(state, privateId, companyId)
    const locationIds = options
        .flatMap((option) => option.locationIds)
        .filter((locationId, index, all) => all.indexOf(locationId) === index)
    if (!locationIds.length) return undefined
    const discount = Math.max(...kinds.map((kind) => ResourceTokens[kind].waivedTerrainCost ?? 0))
    const subsidy = privateId === SubsidyPrivateIds.resource
    return {
        companyId,
        locationIds,
        definitionIds: YellowTrackIds,
        payer: { kind: 'company', companyId },
        connected: true,
        reusable: true,
        ...(subsidy ? {} : { countsAsOrdinaryLay: true as const }),
        ...(options.length > 1 ? { options } : {}),
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
                !isMetropolis(state, locationId)
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

// The Great Northern lays one more yellow tile a round on the northern border, Helena's and
// Fargo's cities among them, free of terrain (P17).
function greatNorthernTerms(state: PowerState, companyId: string) {
    if (privateUsesMade(state, greatNorthernRoundKey(state)) > 0) return undefined
    return {
        companyId,
        locationIds: GreatNorthernBorderIds.filter((locationId) => emptyHex(state, locationId)),
        definitionIds: [...YellowTrackIds, ...PlainCityTileIds.yellow],
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
    const home = state.stations.find((station) => station.id === homeStationId(companyId))
    if (home?.status !== 'placed') return undefined
    return boomtownTerms(state, companyId, [home.position.locationId])
}

function trackTerms(
    state: PowerState,
    privateId: string,
    playerId: string
): PrivateTrackTerms | undefined {
    const terms = privateTerms(state, privateId, playerId)
    if (!terms) return undefined
    const own = terms.restriction
    return {
        ...terms,
        restriction: (request) =>
            own?.(request) ?? layRestriction(state, request, !!terms.countsAsOrdinaryLay)
    }
}

function privateTerms(
    state: PowerState,
    privateId: string,
    playerId: string
): PrivateTrackTerms | undefined {
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

// A Company Town on a $10 river hex takes a bridge as a printed bridge city does (§13.4, P27).
function bridgeCityIds(state: PowerState): string[] {
    const towns = Object.keys(state.tileInventory.placements).filter(
        (locationId) =>
            isCompanyTown(state.tileInventory, locationId) &&
            !BridgeCityIds.includes(locationId) &&
            EighteenUSAMap.location(locationId).terrain?.kinds.includes('water')
    )
    return [...BridgeCityIds, ...towns]
}

// A bridge goes on a reachable river city without one, never New Orleans as a metropolis (§13.4).
function bridgeLocations(state: PowerState, companyId: string): string[] {
    const bridged = locationMarkers(state, { kind: BridgeMarker }).map(
        (marker) => marker.locationId
    )
    return bridgeCityIds(state).filter(
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
    const [stationId] = addCompanyStations(state, companyId, 1)
    state.stations = state.stations.map((entry) =>
        entry.id === stationId
            ? { ...entry, status: 'placed', position: { locationId, nodeId: 'city', slot: 0 } }
            : entry
    )
}

/**
 * Where a station the company may place beside the turn's goes: any reachable city it has no
 * station in, never a Company Town; into a full one beside the others, and only a full one
 * for Suem & Wynn, New York counting as one city (P20, RT-1, Subsidy Tiles).
 */
function tokenPositions(
    state: PowerState,
    companyId: string,
    fullOnly: boolean
): StationPosition[] {
    const placement = new StationPlacement(state, EighteenUSAStationRules)
    return EighteenUSAMap.definition.locations.flatMap((location) => {
        const held = state.stations.flatMap((station) =>
            station.status === 'placed' && station.position.locationId === location.id
                ? [station]
                : []
        )
        if (
            held.some((station) => station.companyId === companyId) ||
            isCompanyTown(state.tileInventory, location.id)
        )
            return []
        const cities = placement.mapState
            .tile(location.id)
            .face.nodes.filter((node) => node.kind === 'city' && node.stationSlots > 0)
        const open = (nodeId: string) => placement.openSlots(companyId, location.id, nodeId)[0]
        const full = cities.every((node) => open(node.id) === undefined)
        if (!cities.length || (fullOnly && !full) || !reaches(state, companyId, location.id))
            return []
        return cities.flatMap((node) => {
            const slot = full
                ? held.filter((station) => station.position.nodeId === node.id).length
                : open(node.id)
            return slot === undefined ? [] : [{ locationId: location.id, nodeId: node.id, slot }]
        })
    })
}

export const EighteenUSAPrivatePowerRules: PrivatePowerRules = {
    trackTerms: (state: PowerState, privateId, playerId) => trackTerms(state, privateId, playerId),
    afterTrackLay(state: PowerState, privateId, details, option) {
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
        if (resourcePowerIds().includes(privateId)) {
            const kinds = option
                ? optionKinds(option)
                : resourceKindsOf(state, privateId).filter((kind) =>
                      resourcesAt(details.locationId).includes(kind)
                  )
            const suppliers = resourceSuppliers(
                state,
                privateId,
                details.companyId,
                kinds.slice(0, option ? kinds.length : 1)
            )
            for (const supplier of suppliers) {
                recordPrivateUse(state, supplier.privateId)
                placeLocationMarker(state, {
                    locationId: details.locationId,
                    kind: ResourceMarkers[supplier.kind],
                    privateCompanyId: supplier.privateId
                })
            }
            // Keystone's river waiver outlives its tokens (P21).
            const closedPrivateIds = suppliers
                .map((supplier) => supplier.privateId)
                .filter((id) => !usesLeft(state, id) && id !== KeystoneBridgeId)
            return { payments: [], closedPrivateIds }
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
        assertExists(area, 'Import/Export Hub marks a red area')
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
        if (!companyId || privatePowerUsed(state, privateId)) return undefined
        const fromSupply = privateId === SubsidyPrivateIds.freeStation
        if (privateId !== SuemWynnId && !fromSupply) return undefined
        if (
            fromSupply
                ? EighteenUSAStations.limitedStations(state, companyId) >= StationLimit
                : !privateTokenStationId(state, companyId)
        )
            return undefined
        const positions = tokenPositions(state, companyId, privateId === SuemWynnId)
        return positions.length
            ? { companyId, positions, ...(fromSupply ? { fromSupply: true as const } : {}) }
            : undefined
    },
    // American Locomotive may be discarded before the run to buy a bank train at 10% off (P25).
    earlyTrainCompany(state: PowerState, privateId, playerId) {
        if (privateId !== AmericanLocomotiveId) return undefined
        const companyId = operatingCompany(state, privateId, playerId)
        return companyId && BeforeRunStates.includes(state.machineState) ? companyId : undefined
    },
    betweenTurnsPrivateIds: []
}
