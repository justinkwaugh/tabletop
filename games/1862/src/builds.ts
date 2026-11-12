import {
    ConstructionReachability,
    RailwayMapState,
    actsFor,
    cityIsBlocked,
    openTrackStopLines,
    rotateTileFace,
    stepAction,
    TileEdge,
    type PlacedStation,
    type StepAction
} from '@tabletop/18xx'
import { ActionSource, assert, assertExists, type HydratedAction } from '@tabletop/common'
import * as Type from 'typebox'
import {
    LondonLocationIds,
    LondonSpaceCount,
    LondonSpacesLocationId,
    LondonSpacesNodeId,
    Map1862
} from './map.js'
import { homeBuildLocation } from './homes.js'
import type { HydratedState1862 } from './state.js'
import { TileSet1862 } from './tiles.js'
import { titleAction } from './titleAction.js'

/** A small station is worth £20 to Local trains (§7.8.2). */
export const SmallStationRevenue = 20

/** Whether the operating company may still make its turn's one build of this kind (§7.6). */
function buildOpen(state: HydratedState1862, playerId: string, companyId: string): boolean {
    const step = state.trackStep
    return (
        state.machineState === 'LayingTrack' &&
        step?.companyId === companyId &&
        !step.completed &&
        !step.lays.length &&
        !state.build &&
        !state.lner &&
        !homeBuildLocation(state, companyId) &&
        actsFor(state, playerId, companyId)
    )
}

/** The lines of plain track that can take a small station, by location, as the map sees them. */
export function smallStationLines(
    state: HydratedState1862
): Record<string, [TileEdge, TileEdge][]> {
    const mapState = new RailwayMapState(Map1862, TileSet1862, state.tileInventory)
    const lines: Record<string, [TileEdge, TileEdge][]> = {}
    for (const locationId of Object.keys(state.tileInventory.placements)) {
        const tile = mapState.tile(locationId)
        const open = openTrackStopLines(rotateTileFace(tile.face, tile.rotation))
        if (open.length) lines[locationId] = open
    }
    return lines
}

const sameLine = (a: readonly TileEdge[], b: readonly TileEdge[]) =>
    (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])

const PlaceSmallStationAction = titleAction('PlaceSmallStation', {
    companyId: Type.String({ minLength: 1 }),
    locationId: Type.String({ minLength: 1 }),
    edges: Type.Tuple([TileEdge, TileEdge])
})
export const PlaceSmallStation = PlaceSmallStationAction.schema
export const isPlaceSmallStation = PlaceSmallStationAction.is

/**
 * In place of laying track, a small station on any line of plain track that has none, anywhere
 * on the board; no route is needed (§7.6.4).
 */
export class HydratedPlaceSmallStation extends PlaceSmallStationAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof PlaceSmallStation>['companyId']
    declare locationId: Type.Static<typeof PlaceSmallStation>['locationId']
    declare edges: Type.Static<typeof PlaceSmallStation>['edges']
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            buildOpen(state, this.playerId, this.companyId) &&
            !!smallStationLines(state)[this.locationId]?.some((line) => sameLine(line, this.edges))
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'A small station goes on an open line of plain track')
        const placement = state.tileInventory.placements[this.locationId]
        assertExists(placement, 'A small station stands on a laid tile')
        placement.trackStops = [
            ...(placement.trackStops ?? []),
            { edges: [...this.edges], revenue: SmallStationRevenue }
        ]
        state.build = 'small-station'
    }
}

/** The companies with a station in London, which holds four (§7.6.5). */
export function londonStations(state: HydratedState1862): PlacedStation[] {
    return state.stations.filter(
        (station): station is PlacedStation =>
            station.status === 'placed' &&
            station.position.locationId === LondonSpacesLocationId &&
            station.position.nodeId === LondonSpacesNodeId
    )
}

/** Whether the company's track reaches London, where a London link must be placed (§7.6.5). */
export function reachesLondon(state: HydratedState1862, companyId: string): boolean {
    const mapState = new RailwayMapState(Map1862, TileSet1862, state.tileInventory)
    const reach = new ConstructionReachability(mapState, state, companyId, (locationId, nodeId) => {
        const node = mapState.tile(locationId).face.nodes.find((entry) => entry.id === nodeId)
        return !!node && cityIsBlocked(state, companyId, locationId, node)
    })
    return LondonLocationIds.some((locationId) => reach.canReach(locationId))
}

export function canBuildToLondon(state: HydratedState1862, playerId: string, companyId: string) {
    const stations = londonStations(state)
    return (
        buildOpen(state, playerId, companyId) &&
        stations.length < LondonSpaceCount &&
        !stations.some((station) => station.companyId === companyId) &&
        state.stations.some(
            (station) => station.companyId === companyId && station.status === 'available'
        ) &&
        reachesLondon(state, companyId)
    )
}

const BuildToLondonAction = titleAction('BuildToLondon', {
    companyId: Type.String({ minLength: 1 })
})
export const BuildToLondon = BuildToLondonAction.schema
export const isBuildToLondon = BuildToLondonAction.is

/**
 * In place of laying track, a station in one of London's four spaces, which lets the company's
 * trains run into London. It is the turn's build and its station (§7.6.5).
 */
export class HydratedBuildToLondon extends BuildToLondonAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof BuildToLondon>['companyId']
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            canBuildToLondon(state, this.playerId, this.companyId)
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'The company reaches London, which has a space for it')
        const station = state.stations.find(
            (entry) => entry.companyId === this.companyId && entry.status === 'available'
        )
        assertExists(station, 'The company has a station to place')
        const used = new Set(londonStations(state).map((entry) => entry.position.slot))
        const slot = Array.from({ length: LondonSpaceCount }, (_, index) => index).find(
            (index) => !used.has(index)
        )
        assertExists(slot, 'London has a free space')
        state.stations[state.stations.indexOf(station)] = {
            id: station.id,
            companyId: this.companyId,
            status: 'placed',
            position: { locationId: LondonSpacesLocationId, nodeId: LondonSpacesNodeId, slot }
        }
        state.build = 'london'
    }
}

export const BuildSteps: readonly StepAction<HydratedState1862>[] = [
    stepAction(
        PlaceSmallStationAction.type,
        (action: HydratedAction): action is HydratedPlaceSmallStation =>
            action instanceof HydratedPlaceSmallStation,
        (state, playerId) =>
            !!state.trackStep &&
            buildOpen(state, playerId, state.trackStep.companyId) &&
            Object.keys(smallStationLines(state)).length > 0
    ),
    stepAction(
        BuildToLondonAction.type,
        (action: HydratedAction): action is HydratedBuildToLondon =>
            action instanceof HydratedBuildToLondon,
        (state, playerId) =>
            !!state.trackStep && canBuildToLondon(state, playerId, state.trackStep.companyId)
    )
]

export const BuildActions = [
    PlaceSmallStationAction.define((action) => new HydratedPlaceSmallStation(action)),
    BuildToLondonAction.define((action) => new HydratedBuildToLondon(action))
]
