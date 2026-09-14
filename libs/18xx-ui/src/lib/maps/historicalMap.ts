import {
    isLayTile,
    isLayPrivateTile,
    isRunTrains,
    type FinanceExampleState
} from '@tabletop/18xx'
import { assert, assertExists, type GameAction } from '@tabletop/common'
import jsonpatch from 'fast-json-patch'
import { createMapDrawing, type MapSelection, type MapRoute } from './mapDrawing.js'
import { stationMapTokens, type MapViewDefinition } from './stationPresentation.js'
import { routeColor } from '../routes/routePresentation.js'

export function isMapHistoryAction(action: GameAction) {
    return isLayTile(action) || isLayPrivateTile(action) || isRunTrains(action)
}

type MapSnapshot = Pick<FinanceExampleState,
    'tileInventory' | 'stations' | 'stationReservations' | 'operatingSet' | 'companies'>

export function historicalMapSnapshot(
    state: MapSnapshot,
    actions: readonly GameAction[],
    actionId: string
): MapSnapshot {
    const index = actions.findIndex((action) => action.id === actionId)
    assert(index >= 0, 'Historical map action must belong to the displayed history')
    let snapshot = structuredClone({
        tileInventory: state.tileInventory,
        stations: state.stations,
        stationReservations: state.stationReservations,
        operatingSet: state.operatingSet,
        companies: state.companies
    })
    const roots = new Set(Object.keys(snapshot).map((key) => `/${key}`))
    for (let i = actions.length - 1; i > index; i--) {
        const patches = (actions[i].undoPatch ?? []).filter((patch) =>
            roots.has(patch.path.split('/').slice(0, 2).join('/'))
        )
        if (patches.length) snapshot = jsonpatch.applyPatch(snapshot, structuredClone(patches)).newDocument
    }
    return snapshot
}

export class HistoricalMaps {
    private source?: FinanceExampleState
    private readonly cache = new Map<string, HistoricalMap>()
    constructor(private readonly view: MapViewDefinition) {}

    preview(state: FinanceExampleState, actions: readonly GameAction[], action: GameAction) {
        if (this.source !== state) {
            this.source = state
            this.cache.clear()
        }
        const cached = this.cache.get(action.id)
        if (cached) {
            this.cache.delete(action.id)
            this.cache.set(action.id, cached)
            return cached
        }
        const snapshot = historicalMapSnapshot(state, actions, action.id)
        assert(isLayTile(action) || isLayPrivateTile(action) || isRunTrains(action),
            'Historical map requires a company action')
        const company = snapshot.companies.find((company) => company.id === action.companyId)
        assertExists(company, 'Historical map requires its operating company')
        const set = snapshot.operatingSet
        const routes = isRunTrains(action) ? action.routes.map((route, index) => ({
            id: route.trainId,
            color: routeColor(index),
            segments: route.paths
        })) : []
        const locationId = isLayTile(action) || isLayPrivateTile(action) ? action.locationId : undefined
        const selection: MapSelection | undefined = locationId ? { kind: 'hex', locationId } : undefined
        const preview = {
            actionId: action.id,
            label: `${company.name}${set ? ` · OR ${set.number}.${set.roundNumber}` : ''}`,
            kind: isRunTrains(action) ? 'run' : 'track lay',
            revenue: isRunTrains(action) ? action.metadata?.revenue : undefined,
            scene: createMapDrawing(this.view.map, {
                tileSet: this.view.tileSet, inventory: snapshot.tileInventory
            }, this.view.layouts),
            tokens: stationMapTokens(snapshot, this.view.stations),
            reservations: snapshot.stationReservations,
            routes,
            selection,
            locations: locationId ? [locationId] : [...new Set(routes.flatMap((route) =>
                route.segments.map((path) => path.locationId)))]
        }
        this.cache.set(action.id, preview)
        if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value!)
        return preview
    }
}

export type HistoricalMap = {
    actionId: string
    label: string
    kind: string
    revenue?: number
    scene: ReturnType<typeof createMapDrawing>
    tokens: ReturnType<typeof stationMapTokens>
    reservations: FinanceExampleState['stationReservations']
    routes: MapRoute[]
    selection?: MapSelection
    locations: string[]
}
