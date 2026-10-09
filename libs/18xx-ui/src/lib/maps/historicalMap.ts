import type { MapSession } from '../session/mapModule.svelte.js'
import { isLayTile, isPrivateTileLay, isRunTrains, type EighteenXXState } from '@tabletop/18xx'
import {
    assert,
    assertExists,
    RecordedHistory,
    type GameAction,
    type GameState
} from '@tabletop/common'
import { routeColor } from '../routes/routePresentation.js'
import {
    createMapDrawing,
    routeLocationIds,
    type MapRoute,
    type MapSelection
} from './mapDrawing.js'
import { stationMapTokens, type MapViewDefinition } from './stationPresentation.js'

export function isMapHistoryAction(action: GameAction) {
    return isLayTile(action) || isPrivateTileLay(action) || isRunTrains(action)
}

export type HistoricalMapState = MapSession['state'] & Pick<EighteenXXState, 'operatingSet'>

export class HistoricalMaps<State extends GameState = EighteenXXState> {
    private source?: State
    private actions?: readonly GameAction[]
    private view?: MapViewDefinition
    private readonly cache = new Map<string, HistoricalMap>()
    /** ``currentView`` is read per preview so presentation changes (token artwork) invalidate the cache. */
    constructor(
        private readonly currentView: () => MapViewDefinition,
        private readonly companyName: (companyId: string) => string,
        private readonly read: (state: State) => HistoricalMapState
    ) {}

    preview(state: State, actions: readonly GameAction[], action: GameAction) {
        const view = this.currentView()
        if (this.source !== state || this.actions !== actions || this.view !== view) {
            this.source = state
            this.actions = actions
            this.view = view
            this.cache.clear()
        }
        const cached = this.cache.get(action.id)
        if (cached) {
            this.cache.delete(action.id)
            this.cache.set(action.id, cached)
            return cached
        }
        const snapshot = this.read(new RecordedHistory(state, actions).after(action.id))
        assert(
            isLayTile(action) || isPrivateTileLay(action) || isRunTrains(action),
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
            isLayTile(action) || isPrivateTileLay(action) ? action.locationId : undefined
        const selection: MapSelection | undefined = locationId
            ? { kind: 'hex', locationId }
            : undefined
        const preview: HistoricalMap = {
            actionId: action.id,
            label: `${this.companyName(company.id)}${set ? ` · OR ${set.number}.${set.roundNumber}` : ''}`,
            kind: isRunTrains(action) ? 'run' : 'track lay',
            revenue: isRunTrains(action) ? action.metadata?.revenue : undefined,
            scene: createMapDrawing(
                view.map,
                {
                    tileSet: view.tileSet,
                    inventory: snapshot.tileInventory,
                    markers: snapshot.locationMarkers
                },
                view
            ),
            tokens: stationMapTokens(snapshot, view.stations),
            reservations: snapshot.stationReservations,
            stationAppearances: view.stations,
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
    stationAppearances: MapViewDefinition['stations']
    routes: MapRoute[]
    selection?: MapSelection
    locations: string[]
}
