import { ActionSource, type GameAction } from '@tabletop/common'
import {
    CHICAGO_BONUS,
    FIVE_DOLLAR_BONUS,
    MachineState,
    USA_CITIES,
    USA_HEXES,
    isPlaceLocomotive,
    isRideJourney,
    railroadsIn,
    usaCity,
    type CityCapacity,
    type CityId,
    type HexId,
    type HydratedRideTheRailsGameState,
    type Link,
    type RailroadId,
    type Track
} from '@tabletop/ride-the-rails'
import { stationOf, type Station } from './boardGeometry.js'
import { trackSlot, type TrackSlot } from './trackLayout.js'

export type CapacityMark = '×1' | '∞'

export type CityBonusMark =
    { kind: 'chicago'; amount: number } | { kind: 'five'; amount: number; taken: boolean }

export type CityPiece = {
    cityId: CityId
    name: string
    hexId: HexId
    station: Station
    capacityMark: CapacityMark | undefined
    startColours: readonly RailroadId[]
    bonus: CityBonusMark | undefined
    /** R-4.3.3: a West or East Coast city, where a Transcontinental line starts or ends. */
    transcontinentalEnd: boolean
    passenger: boolean
}

// R-4.1.4: the six East Coast cities hold one locomotive, Chicago any number.
export function capacityMark(capacity: CityCapacity): CapacityMark | undefined {
    return capacity === 1 ? '×1' : capacity === 'unlimited' ? '∞' : undefined
}

// R-4.3.1, R-4.3.2: Chicago pays every placement; a $5 city only its first locomotive.
function cityBonus(track: Track, cityId: CityId): CityBonusMark | undefined {
    const city = usaCity(cityId)
    if (city.bonus === CHICAGO_BONUS.id) {
        return { kind: 'chicago', amount: CHICAGO_BONUS.amount }
    }
    if (city.bonus === FIVE_DOLLAR_BONUS.id) {
        return {
            kind: 'five',
            amount: FIVE_DOLLAR_BONUS.amount,
            taken: railroadsIn(track, city.hexId).length > 0
        }
    }
    return undefined
}

/** Every city as the map draws it, from the map data and the displayed state. */
export function cityPieces(state: HydratedRideTheRailsGameState): CityPiece[] {
    return USA_CITIES.map((city) => ({
        cityId: city.id,
        name: city.name,
        hexId: city.hexId,
        station: stationOf(city.id),
        capacityMark: capacityMark(city.capacity),
        startColours: city.startColours,
        bonus: cityBonus(state.track, city.id),
        transcontinentalEnd: city.groups.length > 0,
        passenger: state.passengers.includes(city.id)
    }))
}

export type LocomotivePiece = {
    key: string
    hexId: HexId
    railroadId: RailroadId
    slot: TrackSlot
}

/**
 * Every locomotive on the map, in map order and each hex's placement order. A hex holding one
 * cube stands it in the middle, unless a ghost cube is drawn there (`standAside`): then it takes
 * the first slot, where it will stand once the ghost's placement is made.
 */
export function locomotivePieces(
    track: Track,
    standAside: ReadonlySet<HexId> = new Set()
): LocomotivePiece[] {
    return USA_HEXES.flatMap((hex) => {
        const railroadIds = railroadsIn(track, hex.id)
        const held = railroadIds.length + (standAside.has(hex.id) ? 1 : 0)
        return railroadIds.map((railroadId, index) => ({
            key: `${hex.id}:${railroadId}`,
            hexId: hex.id,
            railroadId,
            slot: trackSlot(hex.id, index, held)
        }))
    })
}

export type ThisTurnPlacements = {
    playerId: string
    locomotives: LocomotivePiece[]
}

// R-3.2: the locomotives placed in the building turn under way, each still on the map.
export function thisTurnPlacements(
    state: HydratedRideTheRailsGameState,
    actions: readonly GameAction[]
): ThisTurnPlacements | undefined {
    if (state.machineState !== MachineState.Building || !state.building?.placed) {
        return undefined
    }
    const placements = []
    for (let index = actions.length - 1; index >= 0; index--) {
        const action = actions[index]
        if (!isPlaceLocomotive(action)) {
            break
        }
        placements.unshift(action)
    }
    const turn = placements.slice(-state.building.placed)
    if (turn.length === 0) {
        return undefined
    }
    const placed = new Set(turn.map((action) => `${action.hexId}:${action.railroadId}`))
    return {
        playerId: turn[0].playerId,
        locomotives: locomotivePieces(state.track).filter((piece) => placed.has(piece.key))
    }
}

/** Who looks at the board: the seat now deciding, or not, and whether in History View. */
export type JourneyViewer = { isMyTurn: boolean; isViewingHistory: boolean }

/**
 * The last journey (U-7): the links of the latest player action when it is a journey; the system
 * actions it carried (end of round, skipped shares) keep it. The seat now deciding, in Live View,
 * starts its turn on a clean board, so it is not drawn for that seat; a seat watching keeps it
 * until the next action, and History View draws the displayed step's journey.
 */
export function lastJourneyLinks(actions: readonly GameAction[], viewer: JourneyViewer): Link[] {
    if (viewer.isMyTurn && !viewer.isViewingHistory) {
        return []
    }
    const latest = actions.findLast((action) => action.source !== ActionSource.System)
    return isRideJourney(latest) ? latest.links : []
}

/** R-4.2: where each railroad started, from the placements that record a start. */
export function railroadStarts(actions: readonly GameAction[]): Map<RailroadId, HexId> {
    const starts = new Map<RailroadId, HexId>()
    for (const action of actions) {
        if (isPlaceLocomotive(action) && action.metadata?.isStart) {
            starts.set(action.railroadId, action.hexId)
        }
    }
    return starts
}
