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
    StockInstruction,
    StockInstructionStopReason,
    removeStandingStockInstruction,
    setStandingStockInstruction,
    standingStockInstructionFor,
    createStandingStockInstruction
} from './stockInstruction.js'
import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

export const StopStockInstruction = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('StopStockInstruction'),
        reason: StockInstructionStopReason,
        replacement: Type.Optional(StockInstruction)
    },
    { additionalProperties: false }
)
export type StopStockInstruction = Type.Static<typeof StopStockInstruction>
const Validator = Compile(StopStockInstruction)
export function isStopStockInstruction(action: GameAction): action is StopStockInstruction {
    return (
        action instanceof HydratedStopStockInstruction ||
        (action.type === 'StopStockInstruction' && Validator.Check(action))
    )
}

export class HydratedStopStockInstruction
    extends HydratableAction<typeof StopStockInstruction>
    implements StopStockInstruction
{
    declare type: 'StopStockInstruction'
    declare playerId: string
    declare reason: StockInstructionStopReason
    declare replacement?: StockInstruction
    readonly #rules: StockRules
    constructor(data: StopStockInstruction, rules: StockRules) {
        super(data instanceof HydratedStopStockInstruction ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & StockState): void {
        assert(this.source === ActionSource.System, 'Instructions stop automatically')
        assertExists(
            standingStockInstructionFor(state, this.playerId),
            'There is no standing instruction to stop'
        )
        if (this.replacement)
            setStandingStockInstruction(
                state,
                createStandingStockInstruction(state, this.playerId, this.replacement, this.#rules)
            )
        else removeStandingStockInstruction(state, this.playerId)
    }
}
