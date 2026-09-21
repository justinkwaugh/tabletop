import { assert, assertExists } from '@tabletop/common'
import {
    RouteEvaluation,
    RunTrains,
    trainsOwnedBy,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type OperatingResult,
    type RevenueCenter,
    type RoutePath
} from '@tabletop/18xx'
import { routeColor } from '../routes/routePresentation.js'
import type { MapSelection } from '../maps/mapDrawing.js'
import { RouteEditor } from './routeEditor.svelte.js'
import type { ModuleSession } from './moduleSession.js'
import type { LocalSelection } from './localSelections.js'

type RoutesState = ConstructorParameters<typeof RouteEvaluation>[0] &
    Pick<EighteenXXState, 'machineState'>
export type RoutesSession<State extends RoutesState = RoutesState> = ModuleSession<
    State,
    Pick<EighteenXXTitleRules, 'routeRules'>
>
export type RouteOverlay = { id: string; color: string; segments: readonly RoutePath[] }
type SolvedRoutes<State> = { state: State; result: OperatingResult; exhaustive: boolean }

function submittedRoutes(result: OperatingResult) {
    return result.routes.map(({ trainId, start, paths }) => ({ trainId, start, paths }))
}

export class RoutesModule<State extends RoutesState> implements LocalSelection {
    #solved: SolvedRoutes<State> | undefined = $state.raw()
    constructor(
        private readonly session: RoutesSession<State>,
        private readonly inspectMap: (selection: MapSelection) => void,
        private readonly networkRoutes: () => readonly RouteOverlay[]
    ) {}

    editor = $derived.by(
        () => new RouteEditor(this.session.state, this.session.rules.routeRules)
    )
    canRun = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('RunTrains')
    )
    draftVisible = $derived.by(
        () => this.session.selectionsVisible && this.session.state.machineState === 'RunningTrains'
    )
    solved = $derived.by((): SolvedRoutes<State> | undefined => {
        if (!this.draftVisible) return undefined
        const state = this.session.state
        const companyId = state.routeStep?.companyId
        if (companyId && !trainsOwnedBy(state, { kind: 'company', companyId }).length) {
            const checked = this.evaluate(state, companyId, [])
            assertExists(checked.result, checked.reason ?? 'Invalid empty train run')
            return { state, result: checked.result, exhaustive: true }
        }
        return this.#solved?.state === state ? this.#solved : undefined
    })
    overlays = $derived.by((): RouteOverlay[] => {
        if (this.session.publishing) return []
        const routes = this.draftVisible
            ? (this.solved?.result.routes ?? this.editor.routes)
            : (this.session.state.routeStep?.result?.routes ?? [])
        const overlays: RouteOverlay[] = routes.map((route, index) => ({
            id: route.trainId,
            color: routeColor(index),
            segments: route.paths
        }))
        if (this.draftVisible && this.editor.route)
            overlays.push({ id: 'route-draft', color: '#d58400', segments: this.editor.paths })
        return overlays
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
        const checked = this.evaluate(state, companyId, submittedRoutes(result))
        assertExists(checked.result, checked.reason ?? 'Invalid automatic routes')
        this.#solved = { state, result: checked.result, exhaustive }
    }
    async runSolved() {
        const result = this.solved?.result
        assert(this.canRun && result, 'Wait for the train routes to be calculated')
        await this.session.applyAction(
            this.session.createPlayerAction(RunTrains, {
                companyId: result.companyId,
                routes: submittedRoutes(result)
            })
        )
    }
    selectTrain(trainId: string) {
        this.assertActive()
        this.editor.selectTrain(trainId)
    }
    selectStart(start: RevenueCenter) {
        this.assertActive()
        this.editor.selectStart(start)
        this.inspectMap({ kind: 'node', ...start })
    }
    appendPath(path: RoutePath) {
        this.assertActive()
        this.editor.append(path)
        this.inspectMap({ kind: 'path', ...path })
    }
    save() {
        this.assertActive()
        this.editor.save()
    }
    edit(trainId: string) {
        this.assertActive()
        this.editor.edit(trainId)
    }
    remove(trainId: string) {
        this.assertActive()
        this.editor.remove(trainId)
    }
    back() {
        this.editor.back()
    }
    async confirm() {
        const editor = this.editor
        assert(
            this.canRun && editor.companyId && !editor.trainId && editor.submission?.result,
            'Finish the route draft before submitting'
        )
        await this.session.applyAction(
            this.session.createPlayerAction(RunTrains, {
                companyId: editor.companyId,
                routes: editor.routes
            })
        )
    }

    hasManual() {
        return this.editor.hasDraft
    }
    undo() {
        if (!this.editor.hasDraft) return false
        this.editor.clear()
        return true
    }
    clear() {
        this.#solved = undefined
        this.editor.clear()
    }

    private assertActive() {
        assert(this.canRun, 'Routes are not active')
    }
    private evaluate(
        state: State,
        companyId: string,
        routes: ReturnType<typeof submittedRoutes>
    ) {
        return new RouteEvaluation(state, this.session.rules.routeRules).evaluate(companyId, routes)
    }
}
