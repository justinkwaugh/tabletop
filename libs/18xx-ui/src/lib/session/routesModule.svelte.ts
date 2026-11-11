import { assert, assertExists } from '@tabletop/common'
import {
    RouteEvaluation,
    RunTrains,
    trainRoutesOf,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type OperatingResult,
    type TrainRoute
} from '@tabletop/18xx'
import { trainRouteOverlays } from '../routes/routePresentation.js'
import type { MapRoute, MapSelection } from '../maps/mapDrawing.js'
import { RouteEditor } from './routeEditor.svelte.js'
import type { ModuleSession } from './moduleSession.js'
import type { LocalSelection } from '@tabletop/frontend-components'

type RoutesState = ConstructorParameters<typeof RouteEvaluation>[0] &
    Pick<EighteenXXState, 'machineState'>
export type RoutesSession<State extends RoutesState = RoutesState> = Pick<
    ModuleSession<State, Pick<EighteenXXTitleRules, 'routeRules'>>,
    | 'state'
    | 'rules'
    | 'validActionTypes'
    | 'publishing'
    | 'selectionsVisible'
    | 'interactive'
    | 'createPlayerAction'
    | 'applyAction'
>
export type RouteOverlay = MapRoute
type SolvedRoutes<State> = { state: State; result: OperatingResult; exhaustive: boolean }

export class RoutesModule<State extends RoutesState> implements LocalSelection {
    #solved: SolvedRoutes<State> | undefined = $state.raw()
    constructor(
        private readonly session: RoutesSession<State>,
        private readonly networkRoutes: () => readonly RouteOverlay[],
        private readonly mayDrawRoutes: (companyId: string) => boolean = () => false
    ) {}

    editor = $derived.by(() => new RouteEditor(this.session.state, this.session.rules.routeRules))
    canRun = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('RunTrains')
    )
    editorVisible = $derived.by(
        () => this.session.selectionsVisible && this.session.validActionTypes.includes('RunTrains')
    )
    solved = $derived.by((): SolvedRoutes<State> | undefined => {
        if (!this.editorVisible) return undefined
        const state = this.session.state
        const companyId = state.routeStep?.companyId
        if (
            companyId &&
            !new RouteEvaluation(state, this.session.rules.routeRules).runnableTrains(companyId)
                .length
        ) {
            const checked = this.evaluate(state, companyId, [])
            assertExists(checked.result, checked.reason ?? 'Invalid empty train run')
            return { state, result: checked.result, exhaustive: true }
        }
        return this.#solved?.state === state ? this.#solved : undefined
    })
    editable = $derived.by(() => {
        const companyId = this.session.state.routeStep?.companyId
        return this.canRun && !!this.solved && !!companyId && this.mayDrawRoutes(companyId)
    })
    shown = $derived.by(() => (this.editor.draft ? this.editor.result : this.solved?.result))
    drawnReason = $derived.by(() => this.editor.evaluated?.reason)
    submission = $derived.by((): TrainRoute[] | undefined => {
        if (!this.canRun) return undefined
        if (this.editor.draft) return this.editor.evaluated?.result ? this.editor.routes : undefined
        return this.solved && trainRoutesOf(this.solved.result)
    })
    overlays = $derived.by((): RouteOverlay[] => {
        if (this.session.publishing) return []
        const trainIds = this.editor.trains.map((train) => train.id)
        if (!this.editorVisible) {
            // A train bought after the run can rust trains that ran; the run then keeps its order.
            const ran = this.session.state.routeStep?.result?.routes ?? []
            const held = ran.every((route) => trainIds.includes(route.trainId))
            return trainRouteOverlays(ran, held ? trainIds : undefined)
        }
        const draft = this.editor.draft
        if (!draft) return trainRouteOverlays(this.solved?.result.routes ?? [], trainIds)
        const results = this.editor.result?.routes ?? []
        return draft.routes.map((route) => ({
            ...trainRouteOverlays(
                [
                    {
                        ...route,
                        paths: [...route.paths],
                        bonuses: results.find((result) => result.trainId === route.trainId)?.bonuses
                    }
                ],
                trainIds
            )[0],
            ...(route.paths.length ? {} : { start: route.start }),
            ...(route.trainId === draft.trainId ? { chosen: true as const } : {})
        }))
    })
    displayed = $derived.by(() =>
        this.solved || this.session.state.routeStep?.result || this.overlays.length
            ? this.overlays
            : this.networkRoutes()
    )

    setSolved(state: State, result: OperatingResult, exhaustive: boolean) {
        if (state !== this.session.state || !this.canRun) return
        const companyId = state.routeStep?.companyId
        assert(
            companyId && result.companyId === companyId,
            'Automatic routes require the operating company'
        )
        const checked = this.evaluate(state, companyId, trainRoutesOf(result))
        assertExists(checked.result, checked.reason ?? 'Invalid automatic routes')
        this.#solved = { state, result: checked.result, exhaustive }
    }
    selectTrain(trainId: string) {
        const solved = this.solved
        assert(this.editable && solved, 'Routes cannot be drawn')
        this.editor.selectTrain(trainId, trainRoutesOf(solved.result))
    }
    tap(selection: MapSelection): boolean {
        return this.editable && this.editor.tap(selection)
    }
    async run() {
        const companyId = this.session.state.routeStep?.companyId
        const routes = this.submission
        assert(companyId && routes, 'There is no legal run to submit')
        await this.session.applyAction(
            this.session.createPlayerAction(RunTrains, { companyId, routes })
        )
    }

    clearTrain() {
        assert(this.editable, 'Routes cannot be drawn')
        this.editor.clearTrain()
    }
    /** Drops the drawn routes, so the best run found runs again. */
    useBestRun() {
        this.editor.clear()
    }
    hasManual() {
        return this.editor.hasManual()
    }
    undo() {
        return this.editor.undo()
    }
    clear() {
        this.#solved = undefined
        this.editor.clear()
    }

    private evaluate(state: State, companyId: string, routes: TrainRoute[]) {
        return new RouteEvaluation(state, this.session.rules.routeRules).evaluate(companyId, routes)
    }
}
