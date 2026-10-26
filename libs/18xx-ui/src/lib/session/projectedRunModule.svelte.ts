import type { AutoroutingRequest } from '@tabletop/18xx-autorouter'
import {
    RouteEvaluation,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type Train,
    type TrainRunningState
} from '@tabletop/18xx'
import { isMapRouteValid, type MapRoute } from '../maps/mapDrawing.js'
import type { RouteSolution } from '../routes/latestRouteSolver.js'
import { trainRouteOverlays } from '../routes/routePresentation.js'
import type { MapModule } from './mapModule.svelte.js'
import type { ModuleSession } from './moduleSession.js'

type ProjectedRunState = Pick<EighteenXXState, 'machineState' | 'trackStep' | 'stationStep'>
export type ProjectedRunSession = Pick<
    ModuleSession<ProjectedRunState, Pick<EighteenXXTitleRules, 'routeRules'>>,
    'state' | 'rules' | 'validActionTypes' | 'viewingHistory'
>
export type ProjectedRunMap = Pick<
    MapModule,
    'displayedTileInventory' | 'displayedStationState' | 'displayedScene'
>
export type RunProjectionRequest = AutoroutingRequest & { trains: readonly Train[] }
export type RunProjection = { request: RunProjectionRequest; solution: RouteSolution }

export class ProjectedRunModule {
    constructor(
        private readonly session: ProjectedRunSession,
        private readonly map: ProjectedRunMap,
        private readonly snapshot: () => TrainRunningState
    ) {}

    private operatingCompanyId = $derived.by((): string | undefined => {
        const { machineState, trackStep, stationStep } = this.session.state
        if (machineState === 'LayingTrack') return trackStep?.companyId
        if (machineState === 'PlacingStation') return stationStep?.companyId
        return undefined
    })
    companyId = $derived.by((): string | undefined => {
        const { validActionTypes, viewingHistory } = this.session
        if (viewingHistory) return undefined
        const constructing = validActionTypes.some(
            (type) => type === 'FinishTrack' || type === 'FinishStations' || type === 'PlaceStation'
        )
        return constructing ? this.operatingCompanyId : undefined
    })
    request = $derived.by((): RunProjectionRequest | undefined => {
        const companyId = this.companyId
        if (!companyId) return undefined
        const { stations, stationReservations } = this.map.displayedStationState
        const state: TrainRunningState = {
            ...this.snapshot(),
            tileInventory: this.map.displayedTileInventory,
            stations,
            stationReservations,
            routeStep: { companyId }
        }
        const trains = new RouteEvaluation(state, this.session.rules.routeRules).runnableTrains(
            companyId
        )
        return trains.length ? { state, companyId, trains } : undefined
    })
    // Kept from one preview to the next and across the company's own actions, but a company's
    // run from an earlier turn must never show in its next one.
    latest = $derived.by((): RunProjection | undefined => {
        void this.operatingCompanyId
        return undefined
    })
    current = $derived.by(() => !!this.request && this.latest?.request === this.request)
    overlays = $derived.by((): MapRoute[] => {
        if (!this.request || !this.latest) return []
        const overlays = trainRouteOverlays(this.latest.solution.result.routes)
        return overlays.every((route) => isMapRouteValid(this.map.displayedScene, route))
            ? overlays
            : []
    })

    setSolved(request: RunProjectionRequest, solution: RouteSolution) {
        if (request.companyId === this.companyId) this.latest = { request, solution }
    }
    setFailed(request: RunProjectionRequest) {
        if (request.companyId === this.companyId) this.latest = undefined
    }
}
