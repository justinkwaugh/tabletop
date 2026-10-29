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
import { controllingOwner, type FinancialState } from '../finance/finance.js'
import {
    IgnoredRunInstructionStops,
    declaredRunInstructionFor,
    setIgnoredRunStops,
    type IgnorableRunInstructionStop,
    type RunInstructionState
} from './instructedRuns.js'

export const SetRunInstructionStops = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('SetRunInstructionStops'),
        outOfTurn: Type.Literal(true),
        supersedable: Type.Literal(true),
        supersessionScope: Type.Literal('companyId'),
        companyId: Type.String({ minLength: 1 }),
        ignoredStops: IgnoredRunInstructionStops
    },
    { additionalProperties: false }
)
export type SetRunInstructionStops = Type.Static<typeof SetRunInstructionStops>
const Validator = Compile(SetRunInstructionStops)
export function isSetRunInstructionStops(action: GameAction): action is SetRunInstructionStops {
    return (
        action instanceof HydratedSetRunInstructionStops ||
        (action.type === 'SetRunInstructionStops' && Validator.Check(action))
    )
}

export function runInstructionStopsProblem(
    state: FinancialState & RunInstructionState,
    request: Pick<SetRunInstructionStops, 'playerId' | 'companyId'>
): string | undefined {
    const declared = declaredRunInstructionFor(state, request.companyId)
    if (!declared || declared.playerId !== request.playerId)
        return 'There is no run instruction to change'
    if (controllingOwner(state, request.companyId)?.playerId !== request.playerId)
        return 'Only the company’s president may instruct it'
    return undefined
}

export class HydratedSetRunInstructionStops
    extends HydratableAction<typeof SetRunInstructionStops>
    implements SetRunInstructionStops
{
    declare type: 'SetRunInstructionStops'
    declare playerId: string
    declare outOfTurn: true
    declare supersedable: true
    declare supersessionScope: 'companyId'
    declare companyId: string
    declare ignoredStops: IgnorableRunInstructionStop[]
    constructor(data: SetRunInstructionStops) {
        super(data instanceof HydratedSetRunInstructionStops ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & FinancialState & RunInstructionState): void {
        assert(
            this.source === ActionSource.User,
            'Run instruction stops are a president’s decision'
        )
        const problem = runInstructionStopsProblem(state, this)
        assert(!problem, problem)
        const declared = declaredRunInstructionFor(state, this.companyId)
        assertExists(declared, 'There is no run instruction to change')
        setIgnoredRunStops(declared, this.ignoredStops)
        if (
            declared.stopReason &&
            declared.ignoredStops?.some((stop) => stop === declared.stopReason)
        )
            delete declared.stopReason
    }
}
