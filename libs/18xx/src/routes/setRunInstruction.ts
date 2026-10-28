import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import {
    RunInstruction,
    declaredRunInstructionFor,
    setIgnoredRunStops,
    removeRunInstruction,
    setRunInstruction,
    type RunInstructionState,
    type StandingRunInstruction,
    instructableCompanyIds
} from './instructedRuns.js'
import type { TrainRunningState } from './route.js'
import { trainIdsOwnedBy } from '../trains/train.js'
import type { RouteRules } from './routeEvaluation.js'
import { evaluateInstructedRoutes } from './runInstructionEvaluation.js'

export const SetRunInstruction = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('SetRunInstruction'),
        outOfTurn: Type.Literal(true),
        supersedable: Type.Literal(true),
        supersessionScope: Type.Literal('companyId'),
        companyId: Type.String({ minLength: 1 }),
        instruction: Type.Optional(RunInstruction)
    },
    { additionalProperties: false }
)
export type SetRunInstruction = Type.Static<typeof SetRunInstruction>
const Validator = Compile(SetRunInstruction)
export function isSetRunInstruction(action: GameAction): action is SetRunInstruction {
    return (
        action instanceof HydratedSetRunInstruction ||
        (action.type === 'SetRunInstruction' && Validator.Check(action))
    )
}

type State = TrainRunningState & RunInstructionState

export function runInstructionProblem(
    state: State,
    rules: RouteRules,
    request: Pick<
        SetRunInstruction,
        'playerId' | 'companyId' | 'instruction' | 'supersedesActionId'
    >
): string | undefined {
    const { companyId } = request
    if (!instructableCompanyIds(state, request.playerId).includes(companyId))
        return 'Only the president of an open railway may instruct it'
    // A clear that names the declaration it replaces withdraws it: replaying without that
    // declaration leaves nothing to clear.
    if (!request.instruction)
        return request.supersedesActionId !== undefined ||
            declaredRunInstructionFor(state, companyId)
            ? undefined
            : 'There is no run instruction to clear'
    return evaluateInstructedRoutes(state, rules, companyId, request.instruction.run.routes).reason
}

export class HydratedSetRunInstruction
    extends HydratableAction<typeof SetRunInstruction>
    implements SetRunInstruction
{
    declare type: 'SetRunInstruction'
    declare playerId: string
    declare outOfTurn: true
    declare supersedable: true
    declare supersessionScope: 'companyId'
    declare companyId: string
    declare instruction?: RunInstruction
    readonly #rules: RouteRules
    constructor(data: SetRunInstruction, rules: RouteRules) {
        super(data instanceof HydratedSetRunInstruction ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & State): void {
        assert(this.source === ActionSource.User, 'A run instruction is a president’s decision')
        const problem = runInstructionProblem(state, this.#rules, this)
        assert(!problem, problem)
        if (!this.instruction) {
            removeRunInstruction(state, this.companyId)
            return
        }
        const { payout, run, ignoredStops = [] } = this.instruction
        const { result } = evaluateInstructedRoutes(state, this.#rules, this.companyId, run.routes)
        assertExists(result, 'A run instruction starts from a legal run')
        const standing: StandingRunInstruction = {
            companyId: this.companyId,
            playerId: this.playerId,
            payout,
            declaredRevenue: result.revenue,
            declaredTrainIds: trainIdsOwnedBy(state, {
                kind: 'company',
                companyId: this.companyId
            }),
            runs: [structuredClone(run)]
        }
        setIgnoredRunStops(standing, ignoredStops)
        setRunInstruction(state, standing)
    }
}
