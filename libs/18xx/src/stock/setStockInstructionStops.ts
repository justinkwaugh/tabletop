import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import {
    IgnoredStockInstructionStops,
    declaredStockInstructionFor,
    withIgnoredStops,
    type IgnorableStockInstructionStop
} from './stockInstruction.js'
import type { StockState } from './stockState.js'

export const SetStockInstructionStops = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('SetStockInstructionStops'),
        outOfTurn: Type.Literal(true),
        supersedable: Type.Literal(true),
        ignoredStops: IgnoredStockInstructionStops
    },
    { additionalProperties: false }
)
export type SetStockInstructionStops = Type.Static<typeof SetStockInstructionStops>
const Validator = Compile(SetStockInstructionStops)
export function isSetStockInstructionStops(action: GameAction): action is SetStockInstructionStops {
    return (
        action instanceof HydratedSetStockInstructionStops ||
        (action.type === 'SetStockInstructionStops' && Validator.Check(action))
    )
}

export function stockInstructionStopsProblem(
    state: StockState,
    request: Pick<SetStockInstructionStops, 'playerId'>
): string | undefined {
    if (state.stockRound.completed) return 'The stock round has completed'
    if (!declaredStockInstructionFor(state, request.playerId))
        return 'There is no instruction to change'
    return undefined
}

export class HydratedSetStockInstructionStops
    extends HydratableAction<typeof SetStockInstructionStops>
    implements SetStockInstructionStops
{
    declare type: 'SetStockInstructionStops'
    declare playerId: string
    declare outOfTurn: true
    declare supersedable: true
    declare ignoredStops: IgnorableStockInstructionStop[]
    constructor(data: SetStockInstructionStops) {
        super(data instanceof HydratedSetStockInstructionStops ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & StockState): void {
        assert(
            this.source === ActionSource.User,
            'Standing instruction stops are a player decision'
        )
        assert(!state.stockRound.completed, 'The stock round has completed')
        const declared = declaredStockInstructionFor(state, this.playerId)
        assertExists(declared, 'There is no instruction to change')
        declared.instruction = withIgnoredStops(declared.instruction, this.ignoredStops)
        delete declared.stopReason
    }
}
