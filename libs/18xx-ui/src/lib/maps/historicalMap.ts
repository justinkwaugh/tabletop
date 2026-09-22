import { isLayTile, isLayPrivateTile, isRunTrains, type EighteenXXState } from '@tabletop/18xx'
import { assert, assertExists, type GameAction } from '@tabletop/common'
import jsonpatch from 'fast-json-patch'
import {
    createMapDrawing,
    routeLocationIds,
    type MapSelection,
    type MapRoute
} from './mapDrawing.js'
import { stationMapTokens, type MapViewDefinition } from './stationPresentation.js'
import { routeColor } from '../routes/routePresentation.js'

export function isMapHistoryAction(action: GameAction) {
    return isLayTile(action) || isLayPrivateTile(action) || isRunTrains(action)
}

type MapSnapshot = Pick<
    EighteenXXState,
    'tileInventory' | 'stations' | 'stationReservations' | 'operatingSet' | 'companies'
>

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
        if (patches.length)
            snapshot = jsonpatch.applyPatch(snapshot, structuredClone(patches)).newDocument
    }
    return snapshot
}

export class HistoricalMaps {
    private source?: EighteenXXState
    private view?: MapViewDefinition
    private readonly cache = new Map<string, HistoricalMap>()
    /** ``currentView`` is read per preview so presentation changes (token artwork) invalidate the cache. */
    constructor(private readonly currentView: () => MapViewDefinition) {}

    preview(state: EighteenXXState, actions: readonly GameAction[], action: GameAction) {
        const view = this.currentView()
        if (this.source !== state || this.view !== view) {
            this.source = state
            this.view = view
            this.cache.clear()
        }
        const cached = this.cache.get(action.id)
        if (cached) {
            this.cache.delete(action.id)
            this.cache.set(action.id, cached)
            return cached
        }
        const snapshot = historicalMapSnapshot(state, actions, action.id)
        assert(
            isLayTile(action) || isLayPrivateTile(action) || isRunTrains(action),
            'Historical map requires a company action'
        )
        const company = snapshot.companies.find((company) => company.id === action.companyId)
        assertExists(company, 'Historical map requires its operating company')
        const set = snapshot.operatingSet
        const routes = isRunTrains(action)
            ? action.routes.map((route, index) => ({
                  id: route.trainId,
                  color: routeColor(index),
                  segments: route.paths
              }))
            : []
        const locationId =
            isLayTile(action) || isLayPrivateTile(action) ? action.locationId : undefined
        const selection: MapSelection | undefined = locationId
            ? { kind: 'hex', locationId }
            : undefined
        const preview: HistoricalMap = {
            actionId: action.id,
            label: `${company.name}${set ? ` · OR ${set.number}.${set.roundNumber}` : ''}`,
            kind: isRunTrains(action) ? 'run' : 'track lay',
            revenue: isRunTrains(action) ? action.metadata?.revenue : undefined,
            scene: createMapDrawing(
                view.map,
                {
                    tileSet: view.tileSet,
                    inventory: snapshot.tileInventory
                },
                view.layouts,
                view.markerImages,
                view.placements
            ),
            tokens: stationMapTokens(snapshot, view.stations),
            reservations: snapshot.stationReservations,
            routes,
            selection,
            locations: locationId ? [locationId] : routeLocationIds(routes)
        }
        this.cache.set(action.id, preview)
        if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value!)
        return preview
    }
}

export type HistoricalMap = {
    actionId: string
    label: string
    kind: 'run' | 'track lay'
    revenue?: number
    scene: ReturnType<typeof createMapDrawing>
    tokens: ReturnType<typeof stationMapTokens>
    reservations: EighteenXXState['stationReservations']
    routes: MapRoute[]
    selection?: MapSelection
    locations: string[]
}
