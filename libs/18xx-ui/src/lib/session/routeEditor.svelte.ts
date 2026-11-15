import { assert } from '@tabletop/common'
import {
    getStagedSelectionValue,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import {
    RouteEvaluation,
    sameCenter,
    type OperatingResult,
    type RevenueCenter,
    type RouteResult,
    type RoutePath,
    type RouteWalk,
    type Train,
    type TrainRoute,
    type TrainRunningState,
    type RouteRules
} from '@tabletop/18xx'
import type { MapSelection } from '../maps/mapDrawing.js'

/** A route with no track yet is only its start. */
export type DraftRoute = Omit<TrainRoute, 'paths' | 'attachmentIds'> & {
    paths: readonly RoutePath[]
}
export type RouteDraft = {
    routes: readonly DraftRoute[]
    trainId?: string
    /** The train each piece of attached rolling stock runs with, by the stock's id. */
    attachedTo?: Readonly<Record<string, string>>
}
type Stages = { draft: RouteDraft }
const Order: readonly 'draft'[] = ['draft']
/** The most hexes one tap may add to a route. */
const LongestJoin = 30
/** How many steps of track one tap may search before it gives up. */
const JoinBudget = 200_000

export class RouteEditor {
    readonly evaluation: RouteEvaluation
    #stages: StagedSelectionState<Stages> = $state({})
    constructor(
        readonly state: TrainRunningState,
        readonly rules: RouteRules
    ) {
        this.evaluation = new RouteEvaluation(state, rules)
    }
    get companyId() {
        return this.state.routeStep?.companyId
    }
    get trains() {
        return this.companyId ? this.evaluation.runnableTrains(this.companyId) : []
    }
    /** Rolling stock the company may attach to its trains for the run, such as a Pullman. */
    get attachments() {
        return this.companyId ? this.evaluation.attachments(this.companyId) : []
    }
    get draft(): RouteDraft | undefined {
        return getStagedSelectionValue<Stages, 'draft'>(this.#stages, 'draft')
    }
    get trainId() {
        return this.draft?.trainId
    }
    /** The drawn routes as they would run: a start alone runs only for a train that runs at one station. */
    get routes(): TrainRoute[] {
        const draft = this.draft
        if (!draft) return []
        const attached = Object.entries(draft.attachedTo ?? {})
        return draft.routes.flatMap((route) => {
            if (!route.paths.length && !this.runsAtStation(route.trainId)) return []
            const attachmentIds = attached
                .filter(([, trainId]) => trainId === route.trainId)
                .map(([attachmentId]) => attachmentId)
            return [
                {
                    ...route,
                    paths: [...route.paths],
                    ...(attachmentIds.length ? { attachmentIds } : {})
                }
            ]
        })
    }
    private runsAtStation(trainId: string): boolean {
        const train = this.trains.find((candidate) => candidate.id === trainId)
        return (
            !!train &&
            this.rules.depot.trainDefinition(train.definitionId).distance.stationRun === true
        )
    }
    get evaluated() {
        const companyId = this.companyId
        return this.draft && companyId
            ? this.evaluation.evaluate(companyId, this.routes)
            : undefined
    }
    /** Each drawn route paid on its own while the whole run is not legal. */
    get result(): OperatingResult | undefined {
        const companyId = this.companyId
        const evaluated = this.evaluated
        if (!companyId || !evaluated) return undefined
        if (evaluated.result) return evaluated.result
        const routes = this.routes.flatMap((route): RouteResult[] => {
            const result = this.evaluation.evaluateRoute(companyId, route).result
            return result ? [result] : []
        })
        return {
            companyId,
            routes,
            revenue: routes.reduce((total, route) => total + route.revenue, 0)
        }
    }
    hasManual() {
        return hasManualStagedSelection<Stages>(this.#stages, Order)
    }
    /** Choosing the chosen train again lets it go. */
    selectTrain(trainId: string, base: readonly TrainRoute[]) {
        assert(
            this.trains.some((train) => train.id === trainId),
            'Choose an owned train'
        )
        const draft = this.draft ?? this.drafted(base)
        this.push({
            routes: draft.routes,
            ...(draft.attachedTo ? { attachedTo: draft.attachedTo } : {}),
            ...(draft.trainId === trainId ? {} : { trainId })
        })
    }
    /** The rolling stock the chosen train could take over from the train that carries it now. */
    get movableAttachments() {
        const draft = this.draft
        const companyId = this.companyId
        const train = this.trains.find((candidate) => candidate.id === draft?.trainId)
        if (!draft || !companyId || !train) return []
        const carries = (candidate: Train, stockId: string) =>
            !!this.evaluation.runningDefinition(companyId, candidate, [stockId]).definition
        // With one train able to carry it there is nothing to choose: the best run decides.
        return this.attachments.filter(
            (stock) =>
                draft.attachedTo?.[stock.id] !== train.id &&
                carries(train, stock.id) &&
                this.trains.filter((candidate) => carries(candidate, stock.id)).length > 1
        )
    }
    /** Runs a piece of rolling stock with the chosen train in place of the one that carried it. */
    attach(attachmentId: string) {
        const draft = this.draft
        assert(
            draft?.trainId && this.movableAttachments.some((stock) => stock.id === attachmentId),
            'The chosen train cannot take this rolling stock'
        )
        this.push({ ...draft, attachedTo: { ...draft.attachedTo, [attachmentId]: draft.trainId } })
    }
    private drafted(base: readonly TrainRoute[]): RouteDraft {
        const attachedTo = Object.fromEntries(
            base.flatMap((route) =>
                (route.attachmentIds ?? []).map((attachmentId) => [attachmentId, route.trainId])
            )
        )
        return {
            routes: base.map(({ trainId, start, paths, extension }) => ({
                trainId,
                start,
                paths,
                ...(extension ? { extension } : {})
            })),
            ...(Object.keys(attachedTo).length ? { attachedTo } : {})
        }
    }
    tap(selection: MapSelection): boolean {
        const draft = this.draft
        const trainId = draft?.trainId
        if (!draft || !trainId) return false
        const route = draft.routes.find((candidate) => candidate.trainId === trainId)
        const next =
            selection.kind === 'path'
                ? route && this.alongTrack(route, selection)
                : this.toStop(trainId, route, this.stopAt(selection))
        if (next === undefined) return false
        const routes = [
            ...draft.routes.filter((candidate) => candidate.trainId !== trainId),
            ...(next ? [next] : [])
        ]
        const order = this.trains.map((train) => train.id)
        this.push({
            trainId,
            ...(draft.attachedTo ? { attachedTo: draft.attachedTo } : {}),
            routes: routes.toSorted(
                (first, second) => order.indexOf(first.trainId) - order.indexOf(second.trainId)
            )
        })
        return true
    }
    /** Empties the chosen train's route, keeping the train chosen so the next tap starts it again. */
    clearTrain() {
        const draft = this.draft
        assert(draft?.trainId, 'Choose a train to clear its route')
        const trainId = draft.trainId
        this.push({
            ...draft,
            routes: draft.routes.filter((route) => route.trainId !== trainId)
        })
    }
    undo(): boolean {
        const { nextState, poppedStage } = popHighestManualStagedSelection<Stages>(
            this.#stages,
            Order
        )
        if (!poppedStage) return false
        this.#stages = nextState
        return true
    }
    clear() {
        this.#stages = {}
    }

    // Each tap replaces the draft without keeping the last one, so Undo drops the whole drawing.
    private push(draft: RouteDraft) {
        this.#stages = setStagedSelectionValue<Stages, 'draft'>(
            this.#stages,
            Order,
            'draft',
            draft,
            'manual'
        )
    }
    private stopAt(selection: MapSelection): RevenueCenter | undefined {
        const centers = this.evaluation.network
            .centers()
            .filter((center) => center.locationId === selection.locationId)
        if (selection.kind === 'hex') return centers.length === 1 ? centers[0] : undefined
        if (selection.kind === 'path') return undefined
        return centers.find((center) => center.nodeId === selection.nodeId)
    }
    private toStop(
        trainId: string,
        route: DraftRoute | undefined,
        stop: RevenueCenter | undefined
    ): DraftRoute | null | undefined {
        if (!stop) return undefined
        if (!route) return { trainId, start: stop, paths: [] }
        const stops = this.stopsOf(route)
        const index = stops.findIndex(({ center }) => sameCenter(center, stop))
        if (index < 0)
            return this.join(route, (walk) => {
                const last = walk.visits.at(-1)
                return !!last && sameCenter(last, stop)
            })
        if (index === 0 && stops.length === 1) return null
        const kept = stops[index === stops.length - 1 ? index - 1 : index]
        return { trainId, start: route.start, paths: route.paths.slice(0, kept.paths) }
    }
    private alongTrack(route: DraftRoute, path: RoutePath): DraftRoute | undefined {
        if (route.paths.some((taken) => this.samePath(taken, path))) return undefined
        return this.join(route, (walk) => walk.paths.some((taken) => this.samePath(taken, path)))
    }
    private stopsOf(route: DraftRoute): { center: RevenueCenter; paths: number }[] {
        const network = this.evaluation.network
        const stops = [{ center: route.start, paths: 0 }]
        for (let count = 1; count <= route.paths.length; count++) {
            const visits = network.trace(route.start, route.paths.slice(0, count)).trace?.visits
            const last = visits?.at(-1)
            if (visits && last && visits.length > stops.length)
                stops.push({
                    center: { locationId: last.locationId, nodeId: last.nodeId },
                    paths: count
                })
        }
        return stops
    }
    private join(route: DraftRoute, reaches: (walk: RouteWalk) => boolean): DraftRoute | undefined {
        const reversed = this.reversed(route)
        return this.extend(route, reaches) ?? (reversed && this.extend(reversed, reaches))
    }
    private reversed(route: DraftRoute): DraftRoute | undefined {
        const end = this.stopsOf(route).at(-1)
        if (!route.paths.length || !end || end.paths !== route.paths.length) return undefined
        return { trainId: route.trainId, start: end.center, paths: route.paths.toReversed() }
    }
    /** Fewest hexes first, so a freight train's join is its shortest. */
    private extend(
        route: DraftRoute,
        reaches: (walk: RouteWalk) => boolean
    ): DraftRoute | undefined {
        const companyId = this.companyId
        const trace = this.evaluation.network.trace(route.start, route.paths).trace
        if (!companyId || !trace || trace.end.endpoint.kind !== 'node') return undefined
        const end = { locationId: trace.end.locationId, nodeId: trace.end.endpoint.nodeId }
        let budget = JoinBudget
        for (let hexes = 1; hexes <= LongestJoin && budget > 0; hexes++) {
            const found: RoutePath[][] = []
            let further = false
            this.evaluation.network.walk(
                end,
                { used: new Set(trace.resources) },
                (walk, atStop) => {
                    if (--budget <= 0) return false
                    if (walk.crossings > hexes) {
                        further = true
                        return false
                    }
                    if (!atStop) return true
                    if (reaches(walk)) {
                        if (walk.crossings === hexes) found.push([...walk.paths])
                        return false
                    }
                    const stop = walk.visits.at(-1)
                    return (
                        !!stop &&
                        stop.node.kind !== 'offboard' &&
                        !trace.visits.some((visit) => sameCenter(visit, stop))
                    )
                }
            )
            for (const paths of found.toSorted((first, second) => first.length - second.length)) {
                const extended: TrainRoute = {
                    trainId: route.trainId,
                    start: route.start,
                    paths: [...route.paths, ...paths]
                }
                if (this.evaluation.evaluateRoute(companyId, extended, false).result)
                    return extended
            }
            if (!further) return undefined
        }
        return undefined
    }
    private samePath(first: RoutePath, second: RoutePath): boolean {
        return first.locationId === second.locationId && first.pathId === second.pathId
    }
}
