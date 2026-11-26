import {
    laidTileFace,
    locationMarkers,
    sameStopCounts,
    rotateTileFace,
    tileExits,
    getCompany,
    homeStationId,
    type ConstructionState,
    type MapTile,
    type TileFace,
    type TrackPlacement,
    type TrackRequest,
    type TrackRules,
    type TrackStep
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { EighteenUSAMap } from './map.js'
import {
    EighteenUSATileSet,
    CompanyTownTileIds,
    RegionalHeadquartersTileId,
    RuralJunctionTileIds,
    isCompanyTown
} from './tiles.js'
import { EighteenUSAPhases } from './trains.js'
import { NewYorkId, RequiredTileEdges } from './mapFeatures.js'
import {
    AmericanBridgeId,
    FoxBridgeId,
    KeystoneBridgeId,
    NobelsBlastingId,
    PettiboneMullikenId,
    TrackEngineersId,
    companyHolding
} from './privateHolders.js'
import { UnupgradableResourceKinds } from './resourceMarkers.js'

const SecondLayCost = 20
const SkippedColorCost = 10
const RiverDiscount = 10
const MountainDiscount = 15
const BridgePrivateIds = [FoxBridgeId, KeystoneBridgeId, AmericanBridgeId]
const ColorOrder: readonly string[] = ['white', 'yellow', 'green', 'brown', 'gray']
const BrownPhaseId = '5'

const phaseColors = (state: ConstructionState) => EighteenUSAPhases.phase(state.phaseId).tileColors
const hasCity = (face: TileFace) => face.nodes.some((node) => node.kind === 'city')
const cityCount = (face: TileFace) => face.nodes.filter((node) => node.kind === 'city').length
const MetropolisBLabels = ['ATL', 'CHI', 'DEN', 'NO', 'B']
const BTileIds = ['18xx:592', '18xx:593', '18xx:597']
const RelabellingTileIds = [...BTileIds, ...CompanyTownTileIds, RegionalHeadquartersTileId]

/** Whether the company lays the free brown home city of its first operating round (§12.2.4). */
export function homeBrownLay(state: ConstructionState, locationId: string, color: string): boolean {
    const companyId = state.trackStep?.companyId
    if (!companyId || color !== 'brown') return false
    const home = state.stations.find((station) => station.id === homeStationId(companyId))
    return (
        !getCompany(state, companyId).operated &&
        home?.status === 'placed' &&
        home.position.locationId === locationId
    )
}

function countsAsUpgrade(state: ConstructionState, lay: TrackStep['lays'][number]): boolean {
    return lay.upgrade ?? laidTileFace(state, EighteenUSATrackRules, lay).color !== 'yellow'
}

function laysCounted(state: ConstructionState) {
    return (state.trackStep?.lays ?? []).filter((lay) => {
        const face = laidTileFace(state, EighteenUSATrackRules, lay)
        return !homeBrownLay(state, lay.locationId, face.color) || !hasCity(face)
    })
}

// New York's two cities join into one on its brown tile.
function preservesStops(before: TileFace, after: TileFace): boolean {
    return (
        sameStopCounts(before, after) ||
        (before.labels.includes('NY') &&
            after.labels.includes('NY') &&
            cityCount(before) === 2 &&
            cityCount(after) === 1) ||
        (before.color === 'white' && after.labels.includes('C.T.'))
    )
}

export const EighteenUSATrackRules: TrackRules = {
    map: EighteenUSAMap,
    tileSet: EighteenUSATileSet,
    colorOrder: ColorOrder,
    // A Company Town never blocks track either (BGG ruling PR-27c).
    passesStations: (state, _companyId, center) =>
        isCompanyTown(state.tileInventory, center.locationId),
    // P11's company may lay plain track a colour beyond the phase's (P11).
    availableColors(state) {
        const colors = phaseColors(state)
        const companyId = state.trackStep?.companyId
        if (!companyId || companyHolding(state, PettiboneMullikenId) !== companyId) return colors
        const next = ColorOrder[ColorOrder.indexOf(colors[colors.length - 1]) + 1]
        return next ? [...colors, next] : colors
    },
    /**
     * Two tile actions a turn, at most one an upgrade, the second for $20 (§12.2). P7 Track
     * Engineers makes it three for $20 in all; P11 Pettibone & Mulliken lets both of a $20 pair
     * be upgrades, only one of them a city (P7, P11).
     */
    allowance(state, _color, upgrade) {
        const companyId = state.trackStep?.companyId
        const holds = (privateId: string) =>
            !!companyId && companyHolding(state, privateId) === companyId
        const engineers = holds(TrackEngineersId)
        const pettibone = holds(PettiboneMullikenId)
        const lays = laysCounted(state)
        if (lays.length >= (engineers ? 3 : 2))
            return { reason: 'No tile actions are left this turn' }
        const upgrades = lays.filter((lay) => countsAsUpgrade(state, lay))
        if (upgrade && upgrades.length >= (pettibone ? 2 : 1))
            return { reason: 'No more upgrades are allowed this turn' }
        return { cost: lays.length === 1 ? SecondLayCost : 0 }
    },
    /**
     * From phase 5 an empty city hex takes a green city as a lay, the home city of a company yet
     * to operate a brown one as a free action, and plain track skips colours at $10 each, as an
     * upgrade (§12.2.4).
     */
    colorSkip(state, locationId, before, after) {
        if (after.labels.includes('C.T.')) return { cost: 0, upgrade: false }
        if (!EighteenUSAPhases.isAtLeast(state.phaseId, BrownPhaseId)) return undefined
        if (after.labels.includes('RHQ')) return { cost: 0, upgrade: true }
        if (hasCity(before)) {
            if (before.color !== 'white') return undefined
            if (after.color === 'green') return { cost: 0, upgrade: false }
            return homeBrownLay(state, locationId, after.color)
                ? { cost: 0, upgrade: false }
                : undefined
        }
        const step = ColorOrder.indexOf(after.color) - ColorOrder.indexOf(before.color)
        return { cost: SkippedColorCost * (step - 1), upgrade: true }
    },
    preservesStops,
    // P20 and the Free Station subsidy put a station into a full city (P20).
    sharesFullCities: true,
    // A normal city upgraded to brown takes the tile with the most exits that fits (§12.2.2).
    mostExits: (before) => hasCity(before) && before.color === 'green' && !before.labels.length,
    useful: ({ home, newTrack, increasedCityRevenue }) => home || newTrack || increasedCityRevenue,
    homeLocations: () => [],
    // The metropolises' B tiles, the Company Town and the Regional HQ carry labels of their own.
    relabels: (_locationId, definitionId) => RelabellingTileIds.includes(definitionId),
    // Bridge privates' companies pay no $10 river costs, Nobel's no $15 mountain costs (P2, P5,
    // P21, P22).
    terrainCost(state, request, cost) {
        const kinds = EighteenUSAMap.location(request.locationId).terrain?.kinds ?? []
        const owns = (privateId: string) => companyHolding(state, privateId) === request.companyId
        if (kinds.includes('water') && BridgePrivateIds.some(owns))
            return Math.max(0, cost - RiverDiscount)
        if (kinds.includes('mountain') && owns(NobelsBlastingId))
            return Math.max(0, cost - MountainDiscount)
        return cost
    },
    placementRestriction,
    restriction(state, request) {
        const definition = tileDefinition(request.definitionId)
        if (!definition) return 'Unknown tile'
        if (CompanyTownTileIds.includes(request.definitionId))
            return 'Only P27 Company Town lays a Company Town.'
        if (request.definitionId === RegionalHeadquartersTileId)
            return 'Only P16 Regional Headquarters lays its tile.'
        if (!phaseColors(state).includes(definition.face.color) && hasCity(definition.face))
            return 'Only plain track may be a colour beyond the phase (P11).'
        return layRestriction(state, request, true)
    }
}

function tileDefinition(definitionId: string) {
    return EighteenUSATileSet.definitions.find((tile) => tile.id === definitionId)
}

function placedFace(state: ConstructionState, locationId: string): TileFace | undefined {
    const placement = state.tileInventory.placements[locationId]
    return placement ? tileDefinition(placement.definitionId)?.face : undefined
}

function currentFace(state: ConstructionState, locationId: string): TileFace | undefined {
    return placedFace(state, locationId) ?? EighteenUSAMap.location(locationId).preprintedTile
}

/** The metropolises' B tiles, the stubs toward New York and its printed tile. */
function placementRestriction(placement: TrackPlacement, before: MapTile): string | undefined {
    const definition = tileDefinition(placement.definitionId)
    assertExists(definition, `Unknown 18USA tile ${placement.definitionId}`)
    if (
        BTileIds.includes(placement.definitionId) &&
        !before.face.labels.some((label) => MetropolisBLabels.includes(label))
    )
        return 'B tiles upgrade only the Atlanta, Chicago, Denver and New Orleans metropolises.'
    const stub = RequiredTileEdges[placement.locationId]
    if (
        stub !== undefined &&
        definition.face.color === 'yellow' &&
        !tileExits(rotateTileFace(definition.face, placement.rotation)).has(stub)
    )
        return 'The tile must connect to the printed track toward New York.'
    if (placement.locationId === NewYorkId && definition.face.color === 'yellow')
        return 'New York is already yellow.'
    return undefined
}

/**
 * What limits every lay, a private's too: green cities on empty city hexes from phase 5 and ore
 * tokens; and, for a lay that is one of the turn's tile actions, one city upgrade and one lay a
 * hex (§12.2, §13.3, P11).
 */
export function layRestriction(
    state: ConstructionState,
    request: TrackRequest,
    tileAction: boolean
): string | undefined {
    const definition = tileDefinition(request.definitionId)
    if (!definition) return 'Unknown tile'
    const board = placedFace(state, request.locationId)
    const current = currentFace(state, request.locationId)
    if (
        EighteenUSAPhases.isAtLeast(state.phaseId, BrownPhaseId) &&
        current?.color === 'white' &&
        current.nodes.some((node) => node.kind === 'city') &&
        definition.face.color === 'yellow' &&
        !RuralJunctionTileIds.includes(definition.id)
    )
        return 'From phase 5 an empty city hex takes a green city tile (§12.2.4).'
    const unupgradable = locationMarkers(state, { locationId: request.locationId }).find((marker) =>
        UnupgradableResourceKinds.includes(marker.kind)
    )
    if (unupgradable && board) return 'A tile with an ore token may not be upgraded (§13.3).'
    if (
        tileAction &&
        board &&
        hasCity(definition.face) &&
        laysCounted(state).some(
            (lay) =>
                countsAsUpgrade(state, lay) &&
                hasCity(laidTileFace(state, EighteenUSATrackRules, lay))
        )
    )
        return 'Only one city may be upgraded a turn (P11).'
    if (tileAction && state.trackStep?.lays.some((lay) => lay.locationId === request.locationId))
        return 'The second lay must be on a different hex'
    return undefined
}
