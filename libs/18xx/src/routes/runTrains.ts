import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { TrainRoute, OperatingResult, type TrainRunningState } from './route.js'
import { RouteEvaluation, type RouteRules } from './routeEvaluation.js'
export const RunTrains = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('RunTrains'),
        companyId: Type.String({ minLength: 1 }),
        routes: Type.Array(TrainRoute),
        metadata: Type.Optional(OperatingResult)
    },
    { additionalProperties: false }
)
export type RunTrains = Type.Static<typeof RunTrains>
const Validator = Compile(RunTrains)
export function isRunTrains(action: GameAction): action is RunTrains {
    return (
        action instanceof HydratedRunTrains ||
        (action.type === 'RunTrains' && Validator.Check(action))
    )
}
export class HydratedRunTrains extends HydratableAction<typeof RunTrains> implements RunTrains {
    declare type: 'RunTrains'
    declare playerId: string
    declare companyId: string
    declare routes: TrainRoute[]
    declare metadata?: OperatingResult
    readonly #rules: RouteRules
    constructor(data: RunTrains, rules: RouteRules) {
        super(data instanceof HydratedRunTrains ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & TrainRunningState): void {
        const running = new RouteEvaluation(state, this.#rules)
        assert(
            (this.source === ActionSource.User ||
                (this.source === ActionSource.System &&
                    this.routes.length === 0 &&
                    running.cannotRun(this.companyId))) &&
                state.activePlayerIds.includes(this.playerId) &&
                running.canAct(this.playerId, this.companyId),
            'Only the operating company’s controlling owner may run trains'
        )
        const evaluation = running.evaluate(this.companyId, this.routes)
        assert(evaluation.result, evaluation.reason ?? 'Invalid routes')
        state.routeStep!.result = evaluation.result
        for (const route of evaluation.result.routes)
            state.trainInventory.trains.find((train) => train.id === route.trainId)!.hasRun = true
        this.metadata = evaluation.result
    }
}
