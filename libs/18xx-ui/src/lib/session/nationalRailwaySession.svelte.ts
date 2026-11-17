import type {
    EighteenXXState,
    HydratedEighteenXXState,
    MergerRounds,
    TitleStateSchema
} from '@tabletop/18xx'
import type { MapViewDefinition } from '../maps/stationPresentation.js'
import type { QueuedRouteWorker } from '../routes/routeSolveQueue.js'
import type { AwaitedDecision } from '../table/awaitedDecision.js'
import {
    EighteenXXSession,
    type EighteenXXSessionRules,
    type SessionOptions
} from './eighteenXXSession.svelte.js'
import { MergerRoundModule } from './mergerRoundModule.svelte.js'
import type { TitlePresentation } from './titlePresentation.js'
import { TrainlessMajorModule } from './trainlessMajorModule.svelte.js'

/**
 * The session of a title with a national railway, its merger rounds and its trainless majors'
 * nationalisation, as 1861 and 1867 have (1861 §11–§12, 1867 GTG §9–§10).
 */
export class NationalRailwaySession<
    Schema extends TitleStateSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState
> extends EighteenXXSession<Schema, State> {
    readonly mergers: MergerRoundModule
    readonly trainless: TrainlessMajorModule

    constructor(
        options: SessionOptions<Schema, State>,
        definition: {
            rules: EighteenXXSessionRules<Schema, State>
            mapView: MapViewDefinition
            presentation: TitlePresentation<EighteenXXState<Schema>>
            mergerRounds: MergerRounds
            createRouteWorker?: () => QueuedRouteWorker
        }
    ) {
        super(
            options,
            definition.rules,
            definition.mapView,
            definition.presentation,
            definition.createRouteWorker
        )
        this.mergers = new MergerRoundModule(this.moduleSession, definition.mergerRounds)
        this.trainless = new TrainlessMajorModule(this.moduleSession)
        for (const selection of this.mergers.selections) this.localSelections.register(selection)
    }

    protected override titleAwaitedDecision(state: State): AwaitedDecision | undefined {
        const names = {
            playerName: (id: string) => this.getPlayerName(id),
            companyName: (id: string) => this.companyName(id)
        }
        return (
            this.trainless.awaitedDecision(state, names) ??
            this.mergers.awaitedDecision(state, names)
        )
    }
}
