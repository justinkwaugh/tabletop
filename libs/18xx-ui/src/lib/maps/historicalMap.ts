import type { MapSession } from '../session/mapModule.svelte.js'
import {
    isChooseHomeStation,
    isLayTile,
    isPlacePrivateMarker,
    isPlacePrivateStation,
    isPlaceStation,
    isPrivateTileLay,
    isRunTrains,
    type EighteenXXState
} from '@tabletop/18xx'
import { assertExists, RecordedHistory, type GameAction, type GameState } from '@tabletop/common'
import { trainRouteOverlays } from '../routes/routePresentation.js'
import { createMapDrawing, routeLocationIds, type MapRoute } from './mapDrawing.js'
import { stationMapTokens, type MapViewDefinition } from './stationPresentation.js'
import type { TitlePresentation } from '../session/titlePresentation.js'

/** Where an action changed the map, for the map preview its history row opens. */
export type HistoryMapPlacement = {
    /** What the preview's heading calls it, such as "station" or "Port token". */
    kind: string
    /** The company the preview's heading names. */
    companyId: string
    locationIds: readonly string[]
}

function familyMapPlacement(action: GameAction): HistoryMapPlacement | undefined {
    if (isLayTile(action) || isPrivateTileLay(action))
        return { kind: 'track lay', companyId: action.companyId, locationIds: [action.locationId] }
    if (isPlaceStation(action))
        return {
            kind: 'station',
            companyId: action.companyId,
            locationIds: [action.position.locationId]
        }
    if (isPlacePrivateStation(action))
        return {
            kind: 'station',
            companyId: action.metadata?.companyId ?? action.privateCompanyId,
            locationIds: [action.position.locationId]
        }
    if (isChooseHomeStation(action))
        return {
            kind: 'home station',
            companyId: action.companyId,
            locationIds: [action.locationId]
        }
    if (isPlacePrivateMarker(action))
        return {
            kind: 'marker',
            companyId: action.privateCompanyId,
            locationIds: [action.locationId]
        }
    return undefined
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
        private readonly read: (state: State) => HistoricalMapState,
        /** The reservations that still hold a space, as the title's station rules judge them. */
        private readonly openReservations: (
            state: HistoricalMapState
        ) => HistoricalMapState['stationReservations'] = (state) => state.stationReservations,
        private readonly titlePlacement: TitlePresentation['historyMapPlacement'] = undefined
    ) {}

    previews(action: GameAction): boolean {
        return !!this.subject(action)
    }

    private subject(action: GameAction): HistoryMapPlacement | undefined {
        if (isRunTrains(action))
            return { kind: 'run', companyId: action.companyId, locationIds: [] }
        return familyMapPlacement(action) ?? this.titlePlacement?.(action)
    }

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
        const subject = this.subject(action)
        assertExists(subject, 'Historical map requires a map action')
        const snapshot = this.read(new RecordedHistory(state, actions).after(action.id))
        const company = snapshot.companies.find((company) => company.id === subject.companyId)
        assertExists(company, 'Historical map requires its operating company')
        const set = snapshot.operatingSet
        const run = isRunTrains(action) ? action : undefined
        const routes = trainRouteOverlays(run?.routes ?? [])
        const preview: HistoricalMap = {
            actionId: action.id,
            label: `${this.companyName(company.id)}${set ? ` · OR ${set.number}.${set.roundNumber}` : ''}`,
            kind: subject.kind,
            revenue: run?.metadata?.revenue,
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
            reservations: this.openReservations(snapshot),
            stationAppearances: view.stations,
            routes,
            outlinedLocationIds: subject.locationIds,
            locations: run ? routeLocationIds(routes, view) : [...subject.locationIds]
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
    reservations: EighteenXXState['stationReservations']
    stationAppearances: MapViewDefinition['stations']
    routes: MapRoute[]
    /** The hexes the action placed on. */
    outlinedLocationIds: readonly string[]
    locations: string[]
}
