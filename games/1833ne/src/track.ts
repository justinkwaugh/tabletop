import * as Type from 'typebox'
import {
    ConnectedTrack,
    TrackConstruction,
    addCompanyStations,
    completedCrossingCost,
    controllingOwner,
    getCompany,
    unpaidTerrainCost,
    yellowPlusOneAllowance,
    type CashPayment,
    type ConstructionState,
    type TileFace,
    type TrackRequest,
    type TrackRules
} from '@tabletop/18xx'
import { FirstRoundReservedHexes, Map1833NE, Places, TerrainDiscounts } from './map.js'
import { blockedByPrivate, mapState, ownsPrivate, type LowellPurchase } from './privates.js'
import { FallbackBrownCities, PreferredBrownCities, TileSet1833NE } from './tiles.js'
import { Phases1833NE } from './trains.js'

const TrackData = { map: Map1833NE, tileSet: TileSet1833NE }
const SherbrookeTile = '1833ne:N11'

/** The two corporations of the golden spike and their joint Sherbrooke token. */
export const StLawrenceCompanies = ['StL&A', 'A&StL'] as const
export const GoldenSpikeBonus = 100

export const TrackFields1833NE = {
    /** Which St. Lawrence corporations have laid a yellow tile, toward the golden spike. */
    spikeLayers: Type.Array(Type.String(), { uniqueItems: true }),
    goldenSpike: Type.Optional(Type.Literal(true))
}
type SpikeState = Type.Static<Type.TObject<typeof TrackFields1833NE>>
type State = ConstructionState & SpikeState

/** The printed lower cost of a hex's terrain for this corporation in this phase, if any (§6.49). */
function discountedTerrain(state: ConstructionState, request: TrackRequest, terrain: number) {
    const discount = TerrainDiscounts.find(
        (entry) =>
            entry.locationIds.includes(request.locationId) &&
            (!entry.companyId || entry.companyId === request.companyId) &&
            (!entry.fromPhaseId || Phases1833NE.isAtLeast(state.phaseId, entry.fromPhaseId))
    )
    return discount ? discount.cost : terrain
}

type RoundState = ConstructionState & {
    operatingSet?: { number: number; roundNumber: number }
    lowellPurchase?: LowellPurchase
}

function lowellLayIsFree(state: RoundState, request: TrackRequest): boolean {
    const purchase = state.lowellPurchase
    return (
        request.locationId === 'G20' &&
        purchase?.companyId === request.companyId &&
        purchase.operatingSet === state.operatingSet?.number &&
        purchase.round === state.operatingSet?.roundNumber
    )
}

const MultiCityLabels = ['B', 'Mo', 'Po']
const count = (face: TileFace, kind: string) =>
    face.nodes.filter((node) => node.kind === kind).length

/**
 * Upgrades keep their towns; Boston's, Montreal's and Portland's distinct cities and terminals
 * combine as they upgrade, every other tile keeps its cities.
 */
export function preservesStops1833NE(before: TileFace, after: TileFace): boolean {
    if (count(before, 'town') !== count(after, 'town')) return false
    if (before.labels.some((label) => MultiCityLabels.includes(label)))
        return (
            count(after, 'city') + count(after, 'offboard') <=
            count(before, 'city') + count(before, 'offboard')
        )
    return (
        count(before, 'city') === count(after, 'city') &&
        count(before, 'offboard') === count(after, 'offboard')
    )
}

function firstOperatingRound(state: RoundState): boolean {
    return state.operatingSet?.number === 1 && state.operatingSet.roundNumber === 1
}

export const TrackRules1833NE: TrackRules = {
    ...TrackData,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => Phases1833NE.phase(state.phaseId).tileColors,
    allowance: (state, color) => yellowPlusOneAllowance(TrackData)(state, color),
    preservesStops: preservesStops1833NE,
    useful: ({ newTrack, connectedCity }) => newTrack || connectedCity,
    homeLocations: (companyId) => Map1833NE.reservedLocationIds(companyId),
    // Manchester's green tiles become unlabelled brown cities (p. 21).
    relabels: (locationId, definitionId) =>
        locationId === 'F17' &&
        [...PreferredBrownCities, ...FallbackBrownCities].includes(definitionId),
    restriction(state, request) {
        if (blockedByPrivate(state, request.locationId))
            return 'A player-owned private company blocks this hex.'
        // Sherbrooke's tile has an orientation arrow: it joins north, north-east and south (§6.46).
        if (request.definitionId === SherbrookeTile && request.rotation !== 0)
            return 'Sherbrooke’s tile is laid as its arrow shows, joining north, north-east and south.'
        const reserved = FirstRoundReservedHexes[request.locationId]
        if (reserved && reserved !== request.companyId && firstOperatingRound(state))
            return `Only the ${reserved} may build here in the first operating round.`
        if (
            FallbackBrownCities.includes(request.definitionId) &&
            preferredBrownFits(state, request)
        )
            return 'A 60 or 70 brown city fits here.'
        return undefined
    },
    borderCost: (state, request, edge, cost) =>
        completedCrossingCost(TrackData, state, request, edge, cost),
    terrainCost(state, request, cost) {
        if (lowellLayIsFree(state, request)) return 0
        const terrain = unpaidTerrainCost(TrackData, state, request.locationId)
        const hexsides = cost - terrain
        return Math.max(20, discountedTerrain(state, request, terrain)) + hexsides
    },
    afterLay(state: State, details) {
        const face = mapState(state).tile(details.locationId).face
        if (face.color === 'yellow' && StLawrenceCompanies.some((id) => id === details.companyId))
            if (!state.spikeLayers.includes(details.companyId))
                state.spikeLayers.push(details.companyId)
        if (details.locationId === Places.sherbrooke && face.color === 'yellow')
            placeJointToken(state)
        return { payments: goldenSpike(state), closedPrivateIds: [] }
    }
}

/** Whether a 60 or 70 brown city could be laid instead, so a 50 may not (p. 21). */
function preferredBrownFits(state: ConstructionState, request: TrackRequest): boolean {
    const construction = new TrackConstruction(state, {
        ...TrackRules1833NE,
        restriction: (inner, candidate) =>
            FallbackBrownCities.includes(candidate.definitionId)
                ? 'Only preferred cities'
                : TrackRules1833NE.restriction(inner, candidate)
    })
    return construction
        .choices(request.locationId)
        .some((choice) => PreferredBrownCities.includes(choice.definitionId))
}

/**
 * The St. Lawrence corporations' joint token goes free to Sherbrooke when its yellow tile is
 * laid (§6.53): one piece, the StL&A's, which the A&StL uses as its own.
 */
function placeJointToken(state: State): void {
    addCompanyStations(state, 'StL&A', 1)
    const station = state.stations.at(-1)
    if (station?.status !== 'available') return
    state.stations[state.stations.length - 1] = {
        id: station.id,
        companyId: 'StL&A',
        status: 'placed',
        position: { locationId: Places.sherbrooke, nodeId: 'city', slot: 0 }
    }
    state.stationAccess = [
        ...(state.stationAccess ?? []),
        { companyId: 'A&StL', locationId: Places.sherbrooke, nodeId: 'city', sourceId: 'joint' }
    ]
}

/**
 * When track first joins Montreal and Portland, each St. Lawrence corporation that has laid a
 * yellow tile pays its president $100 from the bank (corporate mats).
 */
function goldenSpike(state: State): CashPayment[] {
    if (state.goldenSpike || !joined(state)) return []
    state.goldenSpike = true
    return state.spikeLayers.flatMap((companyId): CashPayment[] => {
        const company = getCompany(state, companyId)
        const president = controllingOwner(state, companyId)
        return company.closed || !president
            ? []
            : [{ from: { kind: 'bank' }, to: president, amount: GoldenSpikeBonus }]
    })
}

function joined(state: ConstructionState): boolean {
    const map = mapState(state)
    const origins = map
        .tile(Places.montreal)
        .face.nodes.filter((node) => node.kind === 'city')
        .map((node) => ({ locationId: Places.montreal, nodeId: node.id }))
    const network = new ConnectedTrack(map, origins)
    return map
        .tile(Places.portland)
        .face.nodes.some((node) =>
            network.reaches(Places.portland, { kind: 'node', nodeId: node.id })
        )
}

export function lowellPurchaseOwner(state: ConstructionState, companyId: string): boolean {
    return ownsPrivate(state, companyId, 'P2')
}
