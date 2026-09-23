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
    removeStandingStockInstruction,
    setStandingStockInstruction,
    standingStockInstructionFor,
    stockPositionSnapshot
} from './stockInstruction.js'
import type { StockState } from './stockState.js'

export const StopStockInstruction = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('StopStockInstruction'),
        reason: Type.String(),
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
    declare reason: string
    declare replacement?: StockInstruction
    constructor(data: StopStockInstruction) {
        super(data instanceof HydratedStopStockInstruction ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & StockState): void {
        assert(this.source === ActionSource.System, 'Instructions stop automatically')
        assertExists(
            standingStockInstructionFor(state, this.playerId),
            'There is no standing instruction to stop'
        )
        if (this.replacement)
            setStandingStockInstruction(state, {
                playerId: this.playerId,
                instruction: this.replacement,
                snapshot: stockPositionSnapshot(state, this.playerId)
            })
        else removeStandingStockInstruction(state, this.playerId)
    }
}
