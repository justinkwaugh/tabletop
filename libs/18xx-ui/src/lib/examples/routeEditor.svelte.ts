import { assert } from '@tabletop/common'
import {
    RouteEvaluation,
    trainsOwnedBy,
    type TrainRunningState,
    type RouteRules,
    type TrainRoute,
    type RevenueCenter,
    type RoutePath
} from '@tabletop/18xx'
export class RouteEditor {
    readonly evaluation: RouteEvaluation
    routes: TrainRoute[] = $state.raw([])
    trainId: string | undefined = $state()
    start: RevenueCenter | undefined = $state.raw()
    paths: RoutePath[] = $state.raw([])
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
        return this.companyId
            ? trainsOwnedBy(this.state, { kind: 'company', companyId: this.companyId })
            : []
    }
    get centers() {
        return this.evaluation.network.centers()
    }
    get route(): TrainRoute | undefined {
        return this.trainId && this.start
            ? { trainId: this.trainId, start: this.start, paths: this.paths }
            : undefined
    }
    get preview() {
        return this.route && this.companyId
            ? this.evaluation.evaluateRoute(this.companyId, this.route)
            : undefined
    }
    get submission() {
        return this.companyId ? this.evaluation.evaluate(this.companyId, this.routes) : undefined
    }
    get combinedPreview() {
        return this.companyId && this.route && this.preview?.result
            ? this.evaluation.evaluate(this.companyId, [...this.routes, this.route])
            : this.submission
    }
    get extensions() {
        return this.start ? this.evaluation.network.extensions(this.start, this.paths) : []
    }
    get hasDraft() {
        return Boolean(this.trainId || this.routes.length)
    }
    selectTrain(trainId: string) {
        assert(
            this.trains.some((train) => train.id === trainId),
            'Choose an owned train'
        )
        assert(
            !this.routes.some((route) => route.trainId === trainId),
            'Edit or remove the train’s saved route first'
        )
        this.trainId = trainId
        this.start = undefined
        this.paths = []
    }
    selectStart(start: RevenueCenter) {
        assert(
            this.trainId &&
                this.centers.some(
                    (center) =>
                        center.locationId === start.locationId && center.nodeId === start.nodeId
                ),
            'Choose a revenue center'
        )
        this.start = { locationId: start.locationId, nodeId: start.nodeId }
        this.paths = []
    }
    append(path: RoutePath) {
        assert(
            this.extensions.some(
                (next) => next.locationId === path.locationId && next.pathId === path.pathId
            ),
            'Choose connected track'
        )
        this.paths = [...this.paths, { locationId: path.locationId, pathId: path.pathId }]
    }
    save() {
        assert(this.route && this.preview?.result, 'Complete a legal route')
        this.routes = [...this.routes, this.route]
        this.clearCurrent()
    }
    edit(trainId: string) {
        const route = this.routes.find((route) => route.trainId === trainId)
        assert(route, 'Choose a saved route')
        this.routes = this.routes.filter((route) => route.trainId !== trainId)
        this.trainId = route.trainId
        this.start = route.start
        this.paths = route.paths
    }
    remove(trainId: string) {
        this.routes = this.routes.filter((route) => route.trainId !== trainId)
    }
    back() {
        if (this.paths.length) this.paths = this.paths.slice(0, -1)
        else if (this.start) this.start = undefined
        else this.trainId = undefined
    }
    clear() {
        this.clearCurrent()
        this.routes = []
    }
    private clearCurrent() {
        this.trainId = undefined
        this.start = undefined
        this.paths = []
    }
}
