import {
    RailwayMapState,
    companyStationCenters,
    controllingOwner,
    laidTileFace,
    privateOwner,
    rotateTileFace,
    tileExits,
    type ConstructionState,
    type TrackRequest,
    type TrackRules
} from '@tabletop/18xx'
import { BcrId, P4Id } from './companies.js'
import { MajorHomes1880, Map1880, PrintedStubs1880, isBoomtown } from './map.js'
import { requireState1880 } from './state.js'
import { isInvestor } from './stock.js'
import { OOLabel, TileColorOrder1880, TileSet1880, preservesStops1880 } from './tiles.js'
import { Phases1880, phaseLetter } from './trains.js'

/** P4 takes ¥20 off building in a river hex, for all its owner's companies (§VI). */
const RiverDiscount = 20

/** Foreign investors build only until the first 4-train (§VII). */
export function investorsActive(state: { phaseId: string }): boolean {
    return !Phases1880.isAtLeast(state.phaseId, 'B3')
}

/** Whether the company holds a building permit for the current phase (§VIII). */
export function holdsPermit(state: ConstructionState, companyId: string): boolean {
    const permits = requireState1880(state).permits[companyId] ?? ''
    return permits.includes(phaseLetter(state.phaseId))
}

const isUpgrade = (color: string) => color !== 'yellow'

/**
 * The company's home hexes still without track, where it must lay its tile before anywhere else
 * (§X Laying Track).
 */
function untrackedHomes(state: ConstructionState, companyId: string): string[] {
    const mapState = new RailwayMapState(Map1880, TileSet1880, state.tileInventory)
    return companyStationCenters(state, companyId)
        .map((center) => center.locationId)
        .filter((locationId) => !mapState.tile(locationId).face.paths.length)
}

/** A tile where Beijing's starting sections are printed keeps their connection (§X). */
function dropsStub(request: TrackRequest): boolean {
    const stub = PrintedStubs1880[request.locationId]
    if (stub === undefined) return false
    const definition = TileSet1880.definitions.find((entry) => entry.id === request.definitionId)
    return !!definition && !tileExits(rotateTileFace(definition.face, request.rotation)).has(stub)
}

/**
 * Two yellow tiles, or one tile laid or upgraded: the BCR always, others from phase B; one tile
 * before. A foreign investor lays or upgrades exactly one tile (§VII, §X).
 */
function allowance(state: ConstructionState, color: string): ReturnType<TrackRules['allowance']> {
    const step = state.trackStep
    const companyId = step?.companyId
    if (!companyId) return { reason: 'No company is building.' }
    const lays = step.lays
    if (isInvestor(companyId)) {
        if (!investorsActive(state)) return { reason: 'Foreign investors no longer build.' }
        return lays.length ? { reason: 'A foreign investor lays one tile a turn.' } : { cost: 0 }
    }
    if (!holdsPermit(state, companyId))
        return { reason: 'The company has no building permit for this phase.' }
    if (!lays.length) return { cost: 0 }
    const twoLays = companyId === BcrId || Phases1880.isAtLeast(state.phaseId, 'B1')
    if (!twoLays || lays.length > 1)
        return { reason: 'The company has laid all the tiles it may this turn.' }
    if (isUpgrade(laidTileFace(state, TrackRules1880, lays[0]).color) || isUpgrade(color))
        return { reason: 'A second tile is a yellow one, after a yellow one.' }
    return { cost: 0 }
}

export const TrackRules1880: TrackRules = {
    map: Map1880,
    tileSet: TileSet1880,
    colorOrder: TileColorOrder1880,
    availableColors: (state) => Phases1880.phase(state.phaseId).tileColors,
    allowance,
    preservesStops: preservesStops1880,
    // A city upgraded to brown takes a six-sided tile where one fits (§X Upgrading Tiles).
    mostExits: (before) =>
        before.color === 'green' &&
        before.nodes.some((node) => node.kind === 'city') &&
        !before.labels.includes(OOLabel),
    // A double medium city may take the OO tile (§X Laying Track).
    relabels: (locationId, definitionId) =>
        isBoomtown(Map1880.location(locationId).preprintedTile) && definitionId === '1880:235',
    useful: ({ home, newTrack, connectedCity, connectedTown, connectedTerminal }) =>
        home || newTrack || connectedCity || connectedTown || connectedTerminal,
    homeLocations: (companyId) => {
        const home = MajorHomes1880[companyId]
        return home ? [home] : []
    },
    // P4 takes ¥20 off a river hex for every company its owner directs (§VI).
    terrainCost(state, request, cost) {
        const location = Map1880.location(request.locationId)
        if (!location.terrain?.kinds.includes('water')) return cost
        const owner = privateOwner(state, P4Id)
        const director = controllingOwner(state, request.companyId)
        return owner?.kind === 'player' && director?.playerId === owner.playerId
            ? Math.max(0, cost - RiverDiscount)
            : cost
    },
    restriction(state, request) {
        const homes = untrackedHomes(state, request.companyId)
        if (homes.length && !homes.includes(request.locationId))
            return 'A company lays its first tile in its home hex.'
        if (dropsStub(request)) return 'The tile must keep the printed starting section.'
        return undefined
    }
}
